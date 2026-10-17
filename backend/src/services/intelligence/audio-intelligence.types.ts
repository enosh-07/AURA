/**
 * AURA Audio Intelligence Pipeline - Type Definitions
 * Strict contracts for audio analysis, DSP metrics, musical feature extraction,
 * and audio fingerprinting.
 */

export interface AudioAnalysisInput {
  filePath: string;
  trackId?: string;
  originalFilename?: string;
  sourceType?: string;
  mimeType?: string;
  metadataHints?: {
    title?: string;
    artist?: string;
    album?: string;
    genre?: string;
    bpm?: number;
    key?: string;
  };
}

export interface AudioMetadataExtract {
  title?: string;
  artist?: string;
  album?: string;
  year?: number;
  genre?: string;
  durationSec: number;
  sampleRate: number;
  channels: number;
  bitDepth: number;
  bitrateKbps: number;
  codec: string;
  container: string;
  fileSizeBytes: number;
  isLossless: boolean;
  isGenuineLossless: boolean;
  qualityTier: 'STANDARD' | 'HIGH' | 'LOSSLESS' | 'HI_RES_LOSSLESS';
  tagBpm?: number;
  tagKey?: string;
  replayGainTrackGainDb?: number;
  replayGainTrackPeakDb?: number;
}

export interface AudioFingerprintResult {
  fingerprint: string;
  fingerprintRaw?: string;
  durationMs: number;
  sampleCount: number;
}

export interface LoudnessResult {
  integratedLoudness: number | null; // Integrated LUFS (e.g. -14.2 LUFS)
  loudnessRange: number | null;      // Loudness Range in LU
  truePeak: number | null;           // Peak in dBFS
  dynamicRange: number | null;       // Dynamic range in dB
}

export interface BpmDetectionResult {
  bpm: number | null;
  bpmConfidence: number | null;      // 0.0 - 1.0
  tempoCategory?: 'SLOW' | 'MODERATE' | 'UPBEAT' | 'FAST';
}

export interface KeyDetectionResult {
  musicalKey: string | null;         // Standard pitch e.g. "Am", "C#", "Eb"
  scale: 'major' | 'minor' | null;
  camelotKey: string | null;         // Camelot notation e.g. "8A", "12B"
  keyConfidence: number | null;      // 0.0 - 1.0
}

export interface SpectralAnalysisResult {
  spectralCentroid: number | null;   // Spectral brightness in Hz
  spectralRolloff: number | null;    // 85% energy rolloff frequency in Hz
  spectralFlatness: number | null;   // Ratio 0.0 (pure tone) to 1.0 (white noise)
  spectralSpread: number | null;     // Bandwidth variance in Hz
  bandEnergies: {
    subBass: number;                 // 20 - 60 Hz
    bass: number;                    // 60 - 250 Hz
    lowMid: number;                  // 250 - 500 Hz
    mid: number;                     // 500 - 2000 Hz
    highMid: number;                 // 2000 - 4000 Hz
    presence: number;                // 4000 - 6000 Hz
    brilliance: number;              // 6000 - 20000 Hz
  } | null;
}

export interface PsychoacousticFeatures {
  energy: number | null;             // Perceptual intensity & activity (0.0 - 1.0)
  danceability: number | null;       // Rhythmic regularity & beat strength (0.0 - 1.0)
  valence: number | null;            // Musical positiveness & warmth (0.0 - 1.0)
  acousticness: number | null;       // Confidence track is acoustic (0.0 - 1.0)
  instrumentalness: number | null;   // Absence of vocal content (0.0 - 1.0)
  speechRatio: number | null;        // Presence of spoken words vs music (0.0 - 1.0)
}

export interface MoodGenreClassification {
  primaryMood: string | null;
  secondaryMood: string | null;
  detectedGenre: string | null;
  genreConfidence: number | null;
}

export interface DuplicateDetectionCandidate {
  trackId: string;
  title: string;
  artist: string;
  fingerprint: string;
  similarity: number;                // 0.0 - 1.0 (1.0 = exact match)
  matchType: 'EXACT_DUPLICATE' | 'SAME_RECORDING' | 'REMASTER_OR_ALT' | 'UNLIKELY';
}

export interface AudioProfileOutput {
  id?: string;
  trackId: string;
  bpm: number | null;
  bpmConfidence: number | null;
  danceability: number | null;
  musicalKey: string | null;
  keyConfidence: number | null;
  camelotKey: string | null;
  scale: string | null;
  integratedLoudness: number | null;
  loudnessRange: number | null;
  truePeak: number | null;
  dynamicRange: number | null;
  energy: number | null;
  valence: number | null;
  acousticness: number | null;
  instrumentalness: number | null;
  speechRatio: number | null;
  spectralCentroid: number | null;
  spectralRolloff: number | null;
  spectralFlatness: number | null;
  spectralSpread: number | null;
  spectralFeatures: string | null;   // JSON string of band energies
  primaryMood: string | null;
  secondaryMood: string | null;
  detectedGenre: string | null;
  genreConfidence: number | null;
  fingerprint: string | null;
  fingerprintRaw: string | null;
  durationMs: number | null;
  analyzedAt: Date;
  analyzerVersion: string;
  analysisSource: string;
  isComplete: boolean;
}
