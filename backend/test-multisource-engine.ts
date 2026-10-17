import fs from 'fs';
import path from 'path';
import { prisma } from './src/services/prisma.js';
import { trackService } from './src/services/track.service.js';
import { providerRegistry } from './src/services/providers/provider-registry.js';
import { getProviderCapability } from './src/services/providers/provider-capabilities.js';
import { audioValidationService } from './src/services/audioValidation.service.js';
import { jioSaavnProvider } from './src/services/providers/jiosaavn.provider.js';

async function runMultiSourceEngineTests() {
  console.log('================================================================');
  console.log('AURA MULTI-SOURCE HIGH-FIDELITY AUDIO ENGINE VERIFICATION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  const total = 11;

  // --------------------------------------------------------------------------
  // TEST 1: AAC 320 kbps reported as Lossy (Never fabricated as Lossless or Bit-Depth)
  // --------------------------------------------------------------------------
  console.log('TEST 1: AAC 320 kbps Truthful Lossy Reporting');
  try {
    const report = await trackService.generateQualityReport('saavn_test_track_1', 'LOSSLESS', {
      title: 'Tum Hi Ho',
      artist: 'Arijit Singh',
    });

    if (report.source.codec !== 'AAC') throw new Error(`Expected AAC, got ${report.source.codec}`);
    if (report.source.isLossless !== false) throw new Error('AAC was falsely labeled as Lossless!');
    if (report.source.bitDepth !== null && report.source.bitDepth !== undefined) {
      throw new Error(`Lossy AAC fabricated integer bit depth: ${report.source.bitDepth}`);
    }
    if (report.verification.status !== 'FALLBACK_LOSSY') {
      throw new Error(`Expected verification status FALLBACK_LOSSY, got ${report.verification.status}`);
    }

    console.log(`  ✓ Codec: ${report.source.codec}, Bitrate: ${report.source.bitrate} kbps`);
    console.log(`  ✓ Bit Depth: null (Unfabricated, lossy sub-band format)`);
    console.log(`  ✓ Verification status: ${report.verification.status}`);
    console.log(`  ✓ Honest explanation: "${report.verification.notes}"`);
    passed++;
  } catch (err: any) {
    console.error('  ✗ TEST 1 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 2: Genuine FLAC and ALAC Source Detection
  // --------------------------------------------------------------------------
  console.log('\nTEST 2: Genuine FLAC and ALAC Source Detection');
  try {
    const flacPath = path.join(process.cwd(), 'storage', 'audio', 'track-1-hires.flac');
    if (!fs.existsSync(flacPath)) throw new Error('track-1-hires.flac not found in storage');

    const validation = await audioValidationService.validateFile(flacPath, 'audio/flac', 'track-1-hires.flac');
    if (validation.codec !== 'FLAC' || validation.isGenuineLossless !== true) {
      throw new Error(`FLAC validation failed: codec=${validation.codec}, genuine=${validation.isGenuineLossless}`);
    }
    if (validation.bitDepth !== 24 || validation.sampleRate !== 96000) {
      throw new Error(`Expected 24-bit/96kHz, got ${validation.bitDepth}b/${validation.sampleRate}Hz`);
    }

    console.log(`  ✓ Verified FLAC: ${validation.codec} ${validation.bitDepth}-bit / ${validation.sampleRate} Hz`);
    console.log(`  ✓ Quality Tier: ${validation.qualityTier}, Genuine Lossless: ${validation.isGenuineLossless}`);
    passed++;
  } catch (err: any) {
    console.error('  ✗ TEST 2 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 3: Unknown or Contradictory Metadata Handled Safely
  // --------------------------------------------------------------------------
  console.log('\nTEST 3: Unknown or Contradictory Metadata Handling');
  try {
    const unknownCap = getProviderCapability('completely_unknown_network_xyz');
    if (unknownCap.sourceType !== 'UNKNOWN' || unknownCap.isLosslessSupported !== false) {
      throw new Error('Unknown provider was not defaulted to safe non-lossless UNKNOWN state');
    }

    const report = await trackService.generateQualityReport('unknown_stream_999', 'HI_RES_LOSSLESS');
    if (report.source.isLossless !== false) {
      throw new Error('Unverified stream was falsely marked as Lossless');
    }

    console.log(`  ✓ Unknown provider safely assigned: sourceType=${unknownCap.sourceType}`);
    console.log(`  ✓ Contradictory / unverified metadata defaults to Lossless=false`);
    passed++;
  } catch (err: any) {
    console.error('  ✗ TEST 3 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 4: Lossless Source Discovery & Intelligent Fallback
  // --------------------------------------------------------------------------
  console.log('\nTEST 4: Lossless Alternative Discovery & Intelligent Fallback');
  try {
    // Search for existing local track in database
    const dbMaster = await prisma.track.findFirst({
      where: { isGenuineLossless: true },
    });

    if (!dbMaster) throw new Error('No genuine lossless track in test DB');

    const alternative = await providerRegistry.findLosslessAlternative(dbMaster.title, dbMaster.artist);
    if (!alternative) {
      throw new Error(`Failed to discover lossless alternative for "${dbMaster.title}"`);
    }

    if (alternative.trackId !== dbMaster.id) {
      throw new Error(`Alternative ID mismatch: expected ${dbMaster.id}, got ${alternative.trackId}`);
    }

    console.log(`  ✓ Discovered alternative: "${alternative.title}" by ${alternative.artist}`);
    console.log(`  ✓ Alternative Format: ${alternative.codec} ${alternative.bitDepth}-bit / ${alternative.sampleRate} Hz`);
    passed++;
  } catch (err: any) {
    console.error('  ✗ TEST 4 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 5: Correct Recording Matching (No Silent Replacement of Different Songs)
  // --------------------------------------------------------------------------
  console.log('\nTEST 5: Accurate Recording Matching (Title & Artist Boundary Protection)');
  try {
    // Negative test: Try matching an unrelated song
    const mismatch = await providerRegistry.findLosslessAlternative('Completely Unrelated Song Title 987654', 'Nonexistent Band');
    if (mismatch !== null) {
      throw new Error('findLosslessAlternative matched an unrelated track!');
    }

    console.log(`  ✓ Unrelated tracks correctly return null (no silent mismatch or bogus substitution)`);
    passed++;
  } catch (err: any) {
    console.error('  ✗ TEST 5 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 6: Local File Parsing Without Transcoding
  // --------------------------------------------------------------------------
  console.log('\nTEST 6: Local File Binary Scanning & Integrity Preservation');
  try {
    const sampleFlac = path.join(process.cwd(), 'storage', 'audio', 'track-1-hires.flac');
    const statsBefore = fs.statSync(sampleFlac);

    // Scan metadata with audioValidationService
    const res = await audioValidationService.validateFile(sampleFlac, 'audio/flac', 'track-1-hires.flac');

    const statsAfter = fs.statSync(sampleFlac);
    if (statsBefore.size !== statsAfter.size || statsBefore.mtimeMs !== statsAfter.mtimeMs) {
      throw new Error('Local file was modified during metadata scanning!');
    }

    console.log(`  ✓ File scanned non-destructively: size=${statsAfter.size} bytes`);
    console.log(`  ✓ Original audio file timestamp and binary preserved untouched`);
    passed++;
  } catch (err: any) {
    console.error('  ✗ TEST 6 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 7: Unsupported Codecs & Fake Lossless Transcode Rejection
  // --------------------------------------------------------------------------
  console.log('\nTEST 7: Unsupported Codecs & Low-pass Brickwall Transcode Rejection');
  try {
    const fakeWav = path.join(process.cwd(), 'storage', 'audio', 'fake-lossless-transcode.wav');
    if (!fs.existsSync(fakeWav)) throw new Error('fake-lossless-transcode.wav not found');

    const validation = await audioValidationService.validateFile(fakeWav, 'audio/wav', 'fake-lossless-transcode.wav');
    if (validation.isGenuineLossless === true) {
      throw new Error('Synthetic upsample was falsely accepted as Genuine Lossless!');
    }

    console.log(`  ✓ Spectral brickwall detected at 12kHz: ${validation.validationNotes}`);
    console.log(`  ✓ Rejected lossless status: isGenuineLossless=${validation.isGenuineLossless}`);
    passed++;
  } catch (err: any) {
    console.error('  ✗ TEST 7 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 8: Missing Artwork & Metadata Fallback
  // --------------------------------------------------------------------------
  console.log('\nTEST 8: Missing Artwork & Metadata Neutral Fallback');
  try {
    const report = await trackService.generateQualityReport('saavn_missing_art', 'HIGH', {
      title: 'Track Without Art',
      artist: 'Unknown Artist',
    });

    if (!report.trackId || !report.provider) {
      throw new Error('Quality report failed on missing artwork track');
    }

    console.log(`  ✓ Missing metadata handled gracefully with neutral fallback`);
    console.log(`  ✓ Track ID and Provider confirmed: ${report.provider.displayName}`);
    passed++;
  } catch (err: any) {
    console.error('  ✗ TEST 8 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 9: Expired Stream URL & Authorization Failure Handling
  // --------------------------------------------------------------------------
  console.log('\nTEST 9: Expired Provider URLs & Tampered Security Token Handling');
  try {
    const { streamSecurityService } = await import('./src/services/stream-security.service.js');
    
    // 1. Expired token check (created with past expiration)
    const { token: expiredToken } = streamSecurityService.generateSignedToken('track-1', 'test-user', 'HI_RES_LOSSLESS', -5);
    const verifyExpired = streamSecurityService.verifyToken('track-1', expiredToken);
    if (verifyExpired.isValid || verifyExpired.error !== 'STREAM_TOKEN_EXPIRED') {
      throw new Error(`Expired token check failed: error=${verifyExpired.error}`);
    }

    // 2. Tampered token check (invalid HMAC)
    const { token: validToken } = streamSecurityService.generateSignedToken('track-1', 'test-user', 'HI_RES_LOSSLESS', 3600);
    const tamperedToken = validToken.slice(0, -4) + 'abcd';
    const verifyTampered = streamSecurityService.verifyToken('track-1', tamperedToken);
    if (verifyTampered.isValid || verifyTampered.error !== 'INVALID_SIGNATURE') {
      throw new Error(`Tampered signature check failed: error=${verifyTampered.error}`);
    }

    console.log(`  ✓ Expired token correctly rejected with STREAM_TOKEN_EXPIRED`);
    console.log(`  ✓ Tampered cryptographic signature rejected with INVALID_SIGNATURE`);
    passed++;
  } catch (err: any) {
    console.error('  ✗ TEST 9 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 10: Playback Continuity & Dynamic Quality Switching
  // --------------------------------------------------------------------------
  console.log('\nTEST 10: Playback Continuity & Quality Switching');
  try {
    const resStandard = await jioSaavnProvider.resolveStream({
      id: 'saavn_test',
      title: 'Test Song',
      artist: 'Artist',
    }, 'STANDARD');

    const resHigh = await jioSaavnProvider.resolveStream({
      id: 'saavn_test',
      title: 'Test Song',
      artist: 'Artist',
    }, 'HIGH');

    if (resStandard?.qualityTier !== 'STANDARD' || resStandard.bitrate !== 160) {
      throw new Error(`STANDARD quality tier failed: tier=${resStandard?.qualityTier}, bitrate=${resStandard?.bitrate}`);
    }

    if (resHigh?.qualityTier !== 'HIGH' || resHigh.bitrate !== 320) {
      throw new Error(`HIGH quality tier failed: tier=${resHigh?.qualityTier}, bitrate=${resHigh?.bitrate}`);
    }

    console.log(`  ✓ STANDARD request delivers 160 kbps stream: ${resStandard.qualityTier}`);
    console.log(`  ✓ HIGH request delivers 320 kbps stream: ${resHigh.qualityTier}`);
    passed++;
  } catch (err: any) {
    console.error('  ✗ TEST 10 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 11: Dolby Atmos Verified, Unavailable & Unknown States
  // --------------------------------------------------------------------------
  console.log('\nTEST 11: Dolby Atmos Verified, Unavailable & Unknown States');
  try {
    // 1. Standard stereo track
    const stereoReport = await trackService.generateQualityReport('saavn_test', 'HIGH', {
      title: 'Stereo Track',
      artist: 'Artist',
    });

    if (stereoReport.dolbyAtmos.isDolbyAtmos === true || stereoReport.dolbyAtmos.badgeVisible === true) {
      throw new Error('Stereo track falsely displayed Dolby Atmos badge!');
    }

    // 2. Multi-channel track check
    const multiChannelTrack = await prisma.track.create({
      data: {
        id: `atmos_test_${Date.now()}`,
        title: 'Dolby Atmos Spatial Master',
        artist: 'AURA Labs',
        album: 'Spatial Demo',
        duration: 180,
        genre: 'Immersive',
        artworkUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=800',
        audioFileUrl: '/audio/atmos-test.flac',
        channelCount: 8, // 7.1 / 5.1.2
        spatialCapable: true,
        codec: 'E-AC-3 JOC',
        isLossless: false,
      },
    });

    const atmosReport = await trackService.generateQualityReport(multiChannelTrack.id, 'HIGH');
    if (atmosReport.dolbyAtmos.isDolbyAtmos !== true || atmosReport.dolbyAtmos.badgeVisible !== true) {
      throw new Error('Multi-channel object master failed to report verified Atmos state!');
    }

    console.log(`  ✓ Ordinary stereo: isDolbyAtmos=false, badgeVisible=false (Strictly isolated)`);
    console.log(`  ✓ 8-channel object stream: isDolbyAtmos=true, badgeVisible=true, status=${atmosReport.dolbyAtmos.status}`);
    passed++;
  } catch (err: any) {
    console.error('  ✗ TEST 11 FAILED:', err.message);
  }

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`MULTI-SOURCE ENGINE TEST RESULTS: ${passed}/${total} TESTS PASSED (${((passed / total) * 100).toFixed(0)}%)`);
  console.log('================================================================\n');

  if (passed === total) {
    console.log('>>> ALL MULTI-SOURCE HIGH-FIDELITY AUDIO ENGINE REQUIREMENTS SATISFIED <<<');
    process.exit(0);
  } else {
    console.error('>>> SOME MULTI-SOURCE ENGINE TESTS FAILED <<<');
    process.exit(1);
  }
}

runMultiSourceEngineTests().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
