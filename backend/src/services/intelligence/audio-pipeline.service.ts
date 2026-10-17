/**
 * AURA Audio Intelligence Pipeline Service
 * Complete multi-stage analysis pipeline:
 * Audio Ingestion → Metadata Extraction → Codec Validation → Fingerprint Generation
 * → Loudness Analysis → BPM Detection → Key Detection → Energy Analysis
 * → Spectral Analysis → Mood/Genre Classification → Duplicate Detection → Audio Profile
 */

import fs from 'fs';
import { parseFile, IAudioMetadata } from 'music-metadata';
import { AudioValidationService } from '../audioValidation.service.js';
import { AudioDspEngine } from './audio-dsp.engine.js';
import { AudioSampleExtractor, DecodedPcmAudio } from './audio-sample-extractor.js';
import {
  AudioAnalysisInput,
  AudioProfileOutput,
  AudioMetadataExtract,
  DuplicateDetectionCandidate,
} from './audio-intelligence.types.js';
import { prisma } from '../prisma.js';

export class AudioPipelineService {
  private validationService: AudioValidationService;

  constructor() {
    this.validationService = new AudioValidationService();
  }

  /**
   * Executes the full Audio Intelligence Pipeline for an audio file
   */
  public async analyzeAudio(input: AudioAnalysisInput): Promise<{
    profile: AudioProfileOutput;
    duplicates: DuplicateDetectionCandidate[];
  }> {
    const { filePath, trackId = 'transient-analysis', originalFilename, sourceType = 'USER_UPLOAD' } = input;

    if (!fs.existsSync(filePath)) {
      throw new Error(`Audio file not found for pipeline analysis: ${filePath}`);
    }

    // =========================================================================
    // STAGE 1 & 2: Metadata Extraction & Technical Validation
    // =========================================================================
    let mmMeta: IAudioMetadata | null = null;
    try {
      mmMeta = await parseFile(filePath, { duration: true });
    } catch (err) {
      console.warn('[AudioPipeline] music-metadata parse warning:', err);
    }

    const validation = await this.validationService.validateAudioFile(
      filePath,
      originalFilename,
      sourceType
    );

    // Parse embedded ID3 / Vorbis tags if available
    const tagBpm = mmMeta?.common?.bpm || (input.metadataHints?.bpm ?? undefined);
    const tagKey = mmMeta?.common?.key || (input.metadataHints?.key ?? undefined);
    const tagGenre = mmMeta?.common?.genre?.[0] || input.metadataHints?.genre;

    // =========================================================================
    // STAGE 3: Sample Extraction for DSP Analysis
    // =========================================================================
    const pcmData: DecodedPcmAudio | null = await AudioSampleExtractor.extractPcmSamples(filePath, 180);
    const hasAudioSamples = pcmData && pcmData.samples.length > 0;

    let samples: Float32Array;
    let sampleRate = validation.sampleRate || 44100;

    if (hasAudioSamples) {
      samples = pcmData.samples;
      sampleRate = pcmData.sampleRate;
    } else {
      samples = new Float32Array(0);
    }

    // =========================================================================
    // STAGE 4: Fingerprint Generation
    // =========================================================================
    const fingerprintResult = hasAudioSamples
      ? AudioDspEngine.generateAcousticFingerprint(samples, sampleRate)
      : {
          fingerprint: 'fp_unsupported_' + Date.now(),
          fingerprintRaw: '',
          durationMs: (validation.duration || 180) * 1000,
          sampleCount: 0,
        };

    // =========================================================================
    // STAGE 5: Loudness Analysis (EBU R128)
    // =========================================================================
    let integratedLoudness: number | null = null;
    let loudnessRange: number | null = null;
    let truePeak: number | null = null;
    let dynamicRange: number | null = null;

    if (hasAudioSamples) {
      const loudness = AudioDspEngine.analyzeLoudness(samples, sampleRate);
      integratedLoudness = loudness.integratedLoudness;
      loudnessRange = loudness.loudnessRange;
      truePeak = loudness.truePeak;
      dynamicRange = loudness.dynamicRange;
    }

    // ReplayGain tags fallback if samples were not decodeable
    if (integratedLoudness === null && mmMeta?.common?.replaygain_track_gain?.dB !== undefined) {
      // Approximate LUFS: -18.0 + replaygain dB
      integratedLoudness = parseFloat((-18.0 + mmMeta.common.replaygain_track_gain.dB).toFixed(1));
    }

    // =========================================================================
    // STAGE 6: Spectral Analysis & FFT
    // =========================================================================
    let spectralCentroid: number | null = null;
    let spectralRolloff: number | null = null;
    let spectralFlatness: number | null = null;
    let spectralSpread: number | null = null;
    let bandEnergies: Record<string, number> | null = null;
    let magnitudes: Float32Array | null = null;

    if (hasAudioSamples && samples.length >= 2048) {
      // Pick a representative middle section (avoiding lead-in silence)
      const offset = Math.min(samples.length - 2048, Math.floor(samples.length * 0.3));
      const windowSamples = samples.subarray(offset, offset + 2048);
      const hanning = AudioDspEngine.applyHanningWindow(windowSamples);
      magnitudes = AudioDspEngine.computeFFT(hanning);

      const spectral = AudioDspEngine.analyzeSpectrum(magnitudes, sampleRate);
      spectralCentroid = spectral.spectralCentroid;
      spectralRolloff = spectral.spectralRolloff;
      spectralFlatness = spectral.spectralFlatness;
      spectralSpread = spectral.spectralSpread;
      bandEnergies = spectral.bandEnergies;
    }

    // =========================================================================
    // STAGE 7: BPM Detection
    // =========================================================================
    let bpm: number | null = null;
    let bpmConfidence: number | null = null;

    if (hasAudioSamples && samples.length >= sampleRate * 3) {
      const bpmResult = AudioDspEngine.detectBpm(samples, sampleRate, tagBpm);
      bpm = bpmResult.bpm;
      bpmConfidence = bpmResult.confidence;
    } else if (tagBpm && tagBpm >= 40 && tagBpm <= 240) {
      bpm = Math.round(tagBpm);
      bpmConfidence = 0.85;
    }

    // =========================================================================
    // STAGE 8: Musical Key Detection (Camelot Notation)
    // =========================================================================
    let musicalKey: string | null = null;
    let scale: string | null = null;
    let camelotKey: string | null = null;
    let keyConfidence: number | null = null;

    if (magnitudes && magnitudes.length > 0) {
      const keyResult = AudioDspEngine.detectKey(magnitudes, sampleRate, tagKey);
      musicalKey = keyResult.musicalKey;
      scale = keyResult.scale;
      camelotKey = keyResult.camelotKey;
      keyConfidence = keyResult.keyConfidence;
    } else if (tagKey) {
      musicalKey = tagKey;
      scale = tagKey.toLowerCase().includes('m') ? 'minor' : 'major';
      keyConfidence = 0.8;
    }

    // =========================================================================
    // STAGE 9: Energy & Psychoacoustic Features
    // =========================================================================
    let energy: number | null = null;
    let danceability: number | null = null;
    let valence: number | null = null;
    let acousticness: number | null = null;
    let instrumentalness: number | null = null;
    let speechRatio: number | null = null;

    if (hasAudioSamples && bpm && scale) {
      // Calculate RMS for sample segment
      let sumSq = 0;
      for (let i = 0; i < samples.length; i++) sumSq += samples[i] * samples[i];
      const rms = Math.sqrt(sumSq / samples.length);

      const psycho = AudioDspEngine.extractPsychoacousticFeatures({
        rms,
        dynamicRange: dynamicRange ?? 10,
        spectralCentroid: spectralCentroid ?? 2500,
        spectralRolloff: spectralRolloff ?? 6000,
        spectralFlatness: spectralFlatness ?? 0.3,
        subBassEnergy: bandEnergies?.subBass ?? 0.1,
        brillianceEnergy: bandEnergies?.brilliance ?? 0.1,
        bpm,
        scale: scale === 'minor' ? 'minor' : 'major',
        confidence: bpmConfidence ?? 0.5,
      });

      energy = psycho.energy;
      danceability = psycho.danceability;
      valence = psycho.valence;
      acousticness = psycho.acousticness;
      instrumentalness = psycho.instrumentalness;
      speechRatio = psycho.speechRatio;
    }

    // =========================================================================
    // STAGE 10: Mood & Genre Classification
    // =========================================================================
    let primaryMood: string | null = null;
    let secondaryMood: string | null = null;
    let detectedGenre: string | null = tagGenre || input.metadataHints?.genre || null;
    let genreConfidence: number | null = tagGenre ? 0.9 : null;

    if (bpm && energy !== null && valence !== null && scale) {
      const classification = AudioDspEngine.classifyMoodAndGenre({
        bpm,
        energy,
        valence,
        danceability: danceability ?? 0.5,
        acousticness: acousticness ?? 0.2,
        musicalKey: musicalKey ?? 'C',
        scale: scale === 'minor' ? 'minor' : 'major',
        tagGenre: detectedGenre || undefined,
        tagMood: input.metadataHints?.genre,
      });

      primaryMood = classification.primaryMood;
      secondaryMood = classification.secondaryMood;
      if (!detectedGenre) {
        detectedGenre = classification.detectedGenre;
        genreConfidence = classification.genreConfidence;
      }
    }

    // =========================================================================
    // STAGE 11: Duplicate & Version Detection
    // =========================================================================
    const duplicates = await this.detectDuplicates(
      trackId,
      fingerprintResult.fingerprint,
      validation.duration || 180
    );

    // =========================================================================
    // STAGE 12: Assemble Audio Profile
    // =========================================================================
    const profile: AudioProfileOutput = {
      trackId,
      bpm,
      bpmConfidence,
      danceability,
      musicalKey,
      keyConfidence,
      camelotKey,
      scale,
      integratedLoudness,
      loudnessRange,
      truePeak,
      dynamicRange,
      energy,
      valence,
      acousticness,
      instrumentalness,
      speechRatio,
      spectralCentroid,
      spectralRolloff,
      spectralFlatness,
      spectralSpread,
      spectralFeatures: bandEnergies ? JSON.stringify(bandEnergies) : null,
      primaryMood,
      secondaryMood,
      detectedGenre,
      genreConfidence,
      fingerprint: fingerprintResult.fingerprint,
      fingerprintRaw: fingerprintResult.fingerprintRaw || null,
      durationMs: fingerprintResult.durationMs,
      analyzedAt: new Date(),
      analyzerVersion: '1.0.0-auradsp',
      analysisSource: hasAudioSamples ? 'NATIVE_DSP' : 'METADATA_EXTRACT',
      isComplete: Boolean(hasAudioSamples && bpm !== null && musicalKey !== null),
    };

    return { profile, duplicates };
  }

  /**
   * Searches the database for matching fingerprints to detect duplicates and remasters
   */
  public async detectDuplicates(
    currentTrackId: string,
    fingerprint: string,
    durationSec: number
  ): Promise<DuplicateDetectionCandidate[]> {
    if (!fingerprint) return [];

    try {
      // Find existing profiles with identical or close fingerprints
      const matches: any[] = await (prisma as any).audioProfile.findMany({
        where: {
          fingerprint: fingerprint,
          trackId: { not: currentTrackId },
        },
        include: {
          track: {
            select: { id: true, title: true, artist: true, duration: true },
          },
        },
        take: 5,
      });

      return matches.map((m: any) => {
        const durDiff = Math.abs((m.track.duration || 0) - durationSec);
        let matchType: 'EXACT_DUPLICATE' | 'SAME_RECORDING' | 'REMASTER_OR_ALT' | 'UNLIKELY' = 'EXACT_DUPLICATE';

        if (durDiff > 10) {
          matchType = 'REMASTER_OR_ALT';
        } else if (durDiff > 2) {
          matchType = 'SAME_RECORDING';
        }

        return {
          trackId: m.track.id,
          title: m.track.title,
          artist: m.track.artist,
          fingerprint: m.fingerprint || '',
          similarity: durDiff <= 2 ? 1.0 : parseFloat((1.0 - durDiff / durationSec).toFixed(2)),
          matchType,
        };
      });
    } catch {
      return [];
    }
  }
}

export const audioPipelineService = new AudioPipelineService();
