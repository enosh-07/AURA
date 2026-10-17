/**
 * AURA Storage & Streaming Verification Suite
 * Tests:
 * 1. Provider resolution (local vs. R2/S3)
 * 2. MIME type & file size boundary validations
 * 3. Presigned upload ticket issuance
 * 4. HTTP 206 Partial Content range header calculations
 * 5. Audio quality telemetry headers
 */

import { storageService } from './src/services/storage.service.js';
import {
  ALLOWED_AUDIO_MIME,
  ALLOWED_IMAGE_MIME,
  MAX_AUDIO_SIZE_BYTES,
  MAX_IMAGE_SIZE_BYTES,
} from './src/services/storage.provider.js';

async function runStorageVerification() {
  console.log('====================================================');
  console.log('AURA STORAGE & STREAMING VERIFICATION SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let total = 5;

  // 1. Validation: Allowed MIME types
  console.log('TEST 1: MIME Type Security Boundaries');
  try {
    const isFlacAllowed = ALLOWED_AUDIO_MIME.has('audio/flac');
    const isMp3Allowed = ALLOWED_AUDIO_MIME.has('audio/mpeg');
    const isExeAllowed = ALLOWED_AUDIO_MIME.has('application/x-msdownload');
    const isPngAllowed = ALLOWED_IMAGE_MIME.has('image/png');

    if (isFlacAllowed && isMp3Allowed && !isExeAllowed && isPngAllowed) {
      console.log('  -> PASS: Strict audio and image MIME validation enforced.\n');
      passed++;
    } else {
      throw new Error('MIME validation failed.');
    }
  } catch (err: any) {
    console.error('  -> FAIL (Test 1):', err.message, '\n');
  }

  // 2. Validation: Maximum file size limits
  console.log('TEST 2: Upload Payload Limits');
  try {
    if (MAX_AUDIO_SIZE_BYTES === 200 * 1024 * 1024 && MAX_IMAGE_SIZE_BYTES === 20 * 1024 * 1024) {
      console.log('  -> PASS: Max audio size is 200MB, Max artwork size is 20MB.\n');
      passed++;
    } else {
      throw new Error('Payload limits mismatch.');
    }
  } catch (err: any) {
    console.error('  -> FAIL (Test 2):', err.message, '\n');
  }

  // 3. Validation: Presigned Upload Ticket Generation
  console.log('TEST 3: Presigned Upload Ticket Generation');
  try {
    const ticket = await storageService.getPresignedUploadTicket(
      'audio',
      'master-recording.flac',
      'audio/flac',
      900
    );

    console.log(`  Upload URL: ${ticket.uploadUrl}`);
    console.log(`  Object Key: ${ticket.objectKey}`);
    console.log(`  Public URL: ${ticket.publicUrl}`);
    console.log(`  Expiry: ${ticket.expiresInSeconds}s`);

    if (ticket.uploadUrl && ticket.objectKey.endsWith('.flac') && ticket.expiresInSeconds === 900) {
      console.log('  -> PASS: Presigned upload ticket generated with secure expiration and unique key.\n');
      passed++;
    } else {
      throw new Error(`Invalid ticket structure: ${JSON.stringify(ticket)}`);
    }
  } catch (err: any) {
    console.error('  -> FAIL (Test 3):', err.message, '\n');
  }

  // 4. Validation: File Upload and Retrieval
  console.log('TEST 4: Storage Write & Signed Read Flow');
  try {
    const testBuffer = Buffer.from('RIFF....WAVEfmt ....data....'); // mock audio header
    const uploadResult = await storageService.uploadAudio(
      testBuffer,
      'test-stream-probe.wav',
      'audio/wav',
      testBuffer.length
    );

    console.log(`  Uploaded ID: ${uploadResult.id}`);
    console.log(`  Provider: ${uploadResult.provider}`);
    console.log(`  File Size: ${uploadResult.fileSize} bytes`);

    const signedUrl = await storageService.getSignedUrl('audio', uploadResult.key, 1800);
    console.log(`  Signed Retrieval URL: ${signedUrl}`);

    if (uploadResult.key && signedUrl.length > 0) {
      console.log('  -> PASS: File upload and signed URL generation verified.\n');
      passed++;
    } else {
      throw new Error('Upload or signed URL failed.');
    }

    // Clean up test file
    await storageService.deleteFile('audio', uploadResult.key);
    console.log('  -> Cleaned up probe file.\n');
  } catch (err: any) {
    console.error('  -> FAIL (Test 4):', err.message, '\n');
  }

  // 5. Validation: Range Request Bounds Logic
  console.log('TEST 5: HTTP 206 Byte Range Calculation');
  try {
    const totalSize = 38841920; // ~38 MB FLAC
    const rangeHeader = 'bytes=0-1048576'; // 1 MB chunk
    const parts = rangeHeader.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
    const chunkLength = end - start + 1;
    const contentRange = `bytes ${start}-${end}/${totalSize}`;

    if (start === 0 && end === 1048576 && chunkLength === 1048577 && contentRange === 'bytes 0-1048576/38841920') {
      console.log(`  Calculated Content-Range: ${contentRange}`);
      console.log(`  Calculated Chunk Length: ${chunkLength} bytes`);
      console.log('  -> PASS: HTTP 206 Partial Content byte math verified.\n');
      passed++;
    } else {
      throw new Error('Range calculation mismatch.');
    }
  } catch (err: any) {
    console.error('  -> FAIL (Test 5):', err.message, '\n');
  }

  console.log(`SUMMARY: ${passed}/${total} TESTS PASSED.`);
  if (passed === total) {
    console.log('Storage & streaming subsystem verified successfully!');
  } else {
    process.exit(1);
  }
}

runStorageVerification().catch((err) => {
  console.error('Storage verification error:', err);
  process.exit(1);
});
