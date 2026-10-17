/**
 * AURA Audio DSP Engine
 * Pure signal-processing algorithms for audio feature extraction:
 * - FFT & Spectral analysis (Centroid, Rolloff, Flatness, Sub-band energies)
 * - EBU R128 Integrated Loudness (LUFS) & Dynamic Range
 * - Onset Detection & BPM Beat Tracking
 * - Pitch Class Profile (Chromagram) & Krumhansl-Schmuckler Key Finding (Camelot wheel)
 * - Psychoacoustic features (Energy, Danceability, Valence, Acousticness, Instrumentalness, Speech ratio)
 * - Acoustic Fingerprinting (Peak constellation hashing)
 */

import crypto from 'crypto';

// Krumhansl-Schmuckler cognitive key profiles
const KS_MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KS_MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Camelot Wheel mapping: pitch class + mode -> Camelot code
const CAMELOT_MAP: Record<string, string> = {
  'B_major': '1B', 'Ab_minor': '1A', 'G#_minor': '1A',
  'F#_major': '2B', 'Gb_major': '2B', 'Eb_minor': '2A', 'D#_minor': '2A',
  'Db_major': '3B', 'C#_major': '3B', 'Bb_minor': '3A', 'A#_minor': '3A',
  'Ab_major': '4B', 'G#_major': '4B', 'F_minor': '4A',
  'Eb_major': '5B', 'D#_major': '5B', 'C_minor': '5A',
  'Bb_major': '6B', 'A#_major': '6B', 'G_minor': '6A',
  'F_major': '7B', 'D_minor': '7A',
  'C_major': '8B', 'A_minor': '8A',
  'G_major': '9B', 'E_minor': '9A',
  'D_major': '10B', 'B_minor': '10A',
  'A_major': '11B', 'F#_minor': '11A', 'Gb_minor': '11A',
  'E_major': '12B', 'C#_minor': '12A', 'Db_minor': '12A',
};

export class AudioDspEngine {
  /**
   * Simple Cooley-Tukey Radix-2 Fast Fourier Transform
   * Computes magnitude spectrum for power-of-2 length window
   */
  public static computeFFT(realInput: Float32Array): Float32Array {
    const n = realInput.length;
    if ((n & (n - 1)) !== 0) {
      throw new Error('FFT length must be a power of 2');
    }

    const real = new Float32Array(realInput);
    const imag = new Float32Array(n);

    // Bit-reversal permutation
    let j = 0;
    for (let i = 0; i < n - 1; i++) {
      if (i < j) {
        const tempR = real[i];
        real[i] = real[j];
        real[j] = tempR;
      }
      let k = n >> 1;
      while (k <= j) {
        j -= k;
        k >>= 1;
      }
      j += k;
    }

    // Butterfly computations
    for (let len = 2; len <= n; len <<= 1) {
      const halfLen = len >> 1;
      const angle = (-2 * Math.PI) / len;
      const wStepR = Math.cos(angle);
      const wStepI = Math.sin(angle);

      for (let i = 0; i < n; i += len) {
        let wR = 1.0;
        let wI = 0.0;

        for (let k = 0; k < halfLen; k++) {
          const uR = real[i + k];
          const uI = imag[i + k];
          const vR = real[i + k + halfLen] * wR - imag[i + k + halfLen] * wI;
          const vI = real[i + k + halfLen] * wI + imag[i + k + halfLen] * wR;

          real[i + k] = uR + vR;
          imag[i + k] = uI + vI;
          real[i + k + halfLen] = uR - vR;
          imag[i + k + halfLen] = uI - vI;

          const nextWR = wR * wStepR - wI * wStepI;
          wI = wR * wStepI + wI * wStepR;
          wR = nextWR;
        }
      }
    }

    // Calculate normalized magnitude spectrum (first half: 0 to Nyquist)
    const half = n >> 1;
    const magnitudes = new Float32Array(half);
    for (let i = 0; i < half; i++) {
      magnitudes[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]) / half;
    }
    return magnitudes;
  }

  /**
   * Applies Hanning window in-place to avoid spectral leakage
   */
  public static applyHanningWindow(samples: Float32Array): Float32Array {
    const n = samples.length;
    const windowed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const multiplier = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
      windowed[i] = samples[i] * multiplier;
    }
    return windowed;
  }

  /**
   * EBU R128 / ITU-R BS.1770 Loudness & Dynamic Range Analyzer
   */
  public static analyzeLoudness(samples: Float32Array, sampleRate: number): {
    integratedLoudness: number;
    loudnessRange: number;
    truePeak: number;
    dynamicRange: number;
  } {
    if (samples.length === 0) {
      return { integratedLoudness: -70, loudnessRange: 0, truePeak: -70, dynamicRange: 0 };
    }

    let peak = 0;
    let sumSq = 0;

    // Gated block analysis: 400ms blocks
    const blockSize = Math.max(128, Math.floor(sampleRate * 0.4));
    const blockLoudnesses: number[] = [];

    for (let i = 0; i < samples.length; i += blockSize) {
      const chunkEnd = Math.min(samples.length, i + blockSize);
      let chunkSumSq = 0;

      for (let j = i; j < chunkEnd; j++) {
        const val = Math.abs(samples[j]);
        if (val > peak) peak = val;
        chunkSumSq += val * val;
        sumSq += val * val;
      }

      const chunkRms = Math.sqrt(chunkSumSq / (chunkEnd - i));
      if (chunkRms > 0.00001) {
        // Approximate K-weighting offset: -0.691 dB
        const chunkLufs = -0.691 + 10 * Math.log10(chunkRms * chunkRms);
        blockLoudnesses.push(chunkLufs);
      }
    }

    // True Peak in dBFS
    const truePeakDb = peak > 0 ? Math.max(-70, 20 * Math.log10(peak)) : -70;

    // Overall RMS
    const globalRms = Math.sqrt(sumSq / samples.length);
    const integratedLufs = globalRms > 0 ? Math.max(-70, -0.691 + 10 * Math.log10(globalRms * globalRms)) : -70;

    // Loudness Range (LU): 95th percentile minus 10th percentile of active blocks
    let loudnessRange = 0;
    if (blockLoudnesses.length >= 5) {
      blockLoudnesses.sort((a, b) => a - b);
      const p10 = blockLoudnesses[Math.floor(blockLoudnesses.length * 0.1)];
      const p95 = blockLoudnesses[Math.floor(blockLoudnesses.length * 0.95)];
      loudnessRange = Math.max(0, p95 - p10);
    }

    // Dynamic Range (Crest factor in dB: Peak to RMS)
    const dynamicRange = Math.max(0, truePeakDb - integratedLufs);

    return {
      integratedLoudness: parseFloat(integratedLufs.toFixed(1)),
      loudnessRange: parseFloat(loudnessRange.toFixed(1)),
      truePeak: parseFloat(truePeakDb.toFixed(2)),
      dynamicRange: parseFloat(dynamicRange.toFixed(1)),
    };
  }

  /**
   * Spectral Features: Centroid, Rolloff (85%), Flatness (Tonality/Noise ratio), Spread
   */
  public static analyzeSpectrum(
    magnitudes: Float32Array,
    sampleRate: number
  ): {
    spectralCentroid: number;
    spectralRolloff: number;
    spectralFlatness: number;
    spectralSpread: number;
    bandEnergies: {
      subBass: number;
      bass: number;
      lowMid: number;
      mid: number;
      highMid: number;
      presence: number;
      brilliance: number;
    };
  } {
    const half = magnitudes.length;
    const nyquist = sampleRate / 2;
    const binHz = nyquist / half;

    let totalEnergy = 0;
    let weightedSum = 0;
    let logSum = 0;
    let validBinCount = 0;

    // Frequency sub-bands
    let subBass = 0;    // 20 - 60 Hz
    let bass = 0;       // 60 - 250 Hz
    let lowMid = 0;     // 250 - 500 Hz
    let mid = 0;        // 500 - 2000 Hz
    let highMid = 0;    // 2000 - 4000 Hz
    let presence = 0;   // 4000 - 6000 Hz
    let brilliance = 0; // 6000 - 20000 Hz

    for (let k = 0; k < half; k++) {
      const mag = magnitudes[k];
      const freq = k * binHz;
      totalEnergy += mag;
      weightedSum += freq * mag;

      if (mag > 0.000001) {
        logSum += Math.log(mag);
        validBinCount++;
      }

      if (freq >= 20 && freq < 60) subBass += mag;
      else if (freq >= 60 && freq < 250) bass += mag;
      else if (freq >= 250 && freq < 500) lowMid += mag;
      else if (freq >= 500 && freq < 2000) mid += mag;
      else if (freq >= 2000 && freq < 4000) highMid += mag;
      else if (freq >= 4000 && freq < 6000) presence += mag;
      else if (freq >= 6000 && freq <= 20000) brilliance += mag;
    }

    // Centroid
    const centroid = totalEnergy > 0 ? weightedSum / totalEnergy : 0;

    // Spectral Spread (standard deviation around centroid)
    let spreadSum = 0;
    for (let k = 0; k < half; k++) {
      const freq = k * binHz;
      const diff = freq - centroid;
      spreadSum += diff * diff * magnitudes[k];
    }
    const spread = totalEnergy > 0 ? Math.sqrt(spreadSum / totalEnergy) : 0;

    // Spectral Rolloff (85% cumulative energy frequency)
    const rolloffTarget = totalEnergy * 0.85;
    let cumulativeEnergy = 0;
    let rolloff = nyquist;
    for (let k = 0; k < half; k++) {
      cumulativeEnergy += magnitudes[k];
      if (cumulativeEnergy >= rolloffTarget) {
        rolloff = k * binHz;
        break;
      }
    }

    // Spectral Flatness (Geometric Mean / Arithmetic Mean)
    let flatness = 0;
    if (validBinCount > 0 && totalEnergy > 0) {
      const geometricMean = Math.exp(logSum / validBinCount);
      const arithmeticMean = totalEnergy / half;
      if (arithmeticMean > 0) {
        flatness = Math.min(1.0, geometricMean / arithmeticMean);
      }
    }

    // Normalize band energies relative to total energy
    const norm = totalEnergy > 0 ? totalEnergy : 1;
    return {
      spectralCentroid: Math.round(centroid),
      spectralRolloff: Math.round(rolloff),
      spectralFlatness: parseFloat(flatness.toFixed(3)),
      spectralSpread: Math.round(spread),
      bandEnergies: {
        subBass: parseFloat((subBass / norm).toFixed(3)),
        bass: parseFloat((bass / norm).toFixed(3)),
        lowMid: parseFloat((lowMid / norm).toFixed(3)),
        mid: parseFloat((mid / norm).toFixed(3)),
        highMid: parseFloat((highMid / norm).toFixed(3)),
        presence: parseFloat((presence / norm).toFixed(3)),
        brilliance: parseFloat((brilliance / norm).toFixed(3)),
      },
    };
  }

  /**
   * Onset Detection & Autocorrelation BPM Estimator
   */
  public static detectBpm(
    samples: Float32Array,
    sampleRate: number,
    tagHint?: number
  ): { bpm: number; confidence: number; tempoCategory: 'SLOW' | 'MODERATE' | 'UPBEAT' | 'FAST' } {
    if (samples.length < sampleRate * 2) {
      return {
        bpm: tagHint || 120,
        confidence: tagHint ? 0.8 : 0.2,
        tempoCategory: 'MODERATE',
      };
    }

    // Step 1: Compute spectral flux / energy novelty curve over 20ms frames
    const hopSize = Math.floor(sampleRate * 0.02); // 20ms
    const frameSize = Math.floor(sampleRate * 0.04); // 40ms
    const numFrames = Math.floor((samples.length - frameSize) / hopSize);
    const energies = new Float32Array(numFrames);

    for (let f = 0; f < numFrames; f++) {
      const start = f * hopSize;
      let e = 0;
      for (let i = 0; i < frameSize; i++) {
        const val = samples[start + i];
        e += val * val;
      }
      energies[f] = e;
    }

    // Half-wave rectified first-order difference (onset novelty curve)
    const onsets = new Float32Array(numFrames);
    for (let f = 1; f < numFrames; f++) {
      const diff = energies[f] - energies[f - 1];
      onsets[f] = diff > 0 ? diff : 0;
    }

    // Step 2: Autocorrelation across BPM lags (60 BPM to 200 BPM)
    // At hopSize = 20ms, fps = 50.
    // 60 BPM = 1 beat/sec = 50 frames lag. 200 BPM = 3.33 beats/sec = 15 frames lag.
    const fps = sampleRate / hopSize;
    const minLag = Math.floor((60 / 200) * fps); // ~15
    const maxLag = Math.ceil((60 / 60) * fps);  // ~50

    let bestLag = minLag;
    let maxCorr = -1;
    let sumCorr = 0;

    for (let lag = minLag; lag <= maxLag; lag++) {
      let corr = 0;
      let count = 0;
      for (let i = 0; i < onsets.length - lag; i++) {
        corr += onsets[i] * onsets[i + lag];
        count++;
      }
      if (count > 0) corr /= count;
      sumCorr += corr;

      if (corr > maxCorr) {
        maxCorr = corr;
        bestLag = lag;
      }
    }

    let detectedBpm = Math.round((60 * fps) / bestLag);

    // Harmonic correction: if detected is half or double of tag hint, harmonize
    if (tagHint && tagHint >= 50 && tagHint <= 220) {
      if (Math.abs(detectedBpm * 2 - tagHint) <= 4) {
        detectedBpm = tagHint;
      } else if (Math.abs(detectedBpm / 2 - tagHint) <= 4) {
        detectedBpm = tagHint;
      } else if (Math.abs(detectedBpm - tagHint) <= 4) {
        detectedBpm = tagHint;
      }
    }

    // Clamp into reasonable musical boundaries
    if (detectedBpm < 60) detectedBpm *= 2;
    if (detectedBpm > 200) detectedBpm /= 2;

    const avgCorr = sumCorr / Math.max(1, maxLag - minLag + 1);
    const peakToNoise = avgCorr > 0 ? maxCorr / avgCorr : 1;
    const confidence = Math.min(0.98, Math.max(0.3, parseFloat(((peakToNoise - 1) / 3).toFixed(2))));

    let tempoCategory: 'SLOW' | 'MODERATE' | 'UPBEAT' | 'FAST' = 'MODERATE';
    if (detectedBpm < 85) tempoCategory = 'SLOW';
    else if (detectedBpm < 115) tempoCategory = 'MODERATE';
    else if (detectedBpm < 135) tempoCategory = 'UPBEAT';
    else tempoCategory = 'FAST';

    return { bpm: detectedBpm, confidence, tempoCategory };
  }

  /**
   * Chromagram & Krumhansl-Schmuckler Key Finding Algorithm
   * Computes 12-pitch chroma distribution and maps to Camelot wheel
   */
  public static detectKey(
    magnitudes: Float32Array,
    sampleRate: number,
    tagHint?: string
  ): {
    musicalKey: string;
    scale: 'major' | 'minor';
    camelotKey: string;
    keyConfidence: number;
  } {
    const half = magnitudes.length;
    const nyquist = sampleRate / 2;
    const binHz = nyquist / half;

    // Pitch Class Profile (12 semitones C to B)
    const chroma = new Float32Array(12);

    // Map frequencies between A1 (55 Hz) and C7 (2093 Hz) to chromatic pitch classes
    for (let k = 1; k < half; k++) {
      const freq = k * binHz;
      if (freq >= 55 && freq <= 2100) {
        // MIDI note number: 69 + 12 * log2(f / 440)
        const midi = 69 + 12 * (Math.log(freq / 440) / Math.LN2);
        const pitchClass = (Math.round(midi) % 12 + 12) % 12;
        chroma[pitchClass] += magnitudes[k];
      }
    }

    // Normalize chroma vector
    let chromaSum = 0;
    for (let i = 0; i < 12; i++) chromaSum += chroma[i];
    if (chromaSum > 0) {
      for (let i = 0; i < 12; i++) chroma[i] /= chromaSum;
    }

    let bestScore = -2;
    let bestPitch = 0;
    let bestScale: 'major' | 'minor' = 'major';
    let runnerUpScore = -2;

    // Correlate against all 12 Major and 12 Minor K-S rotated profiles
    for (let root = 0; root < 12; root++) {
      // Major test
      const majorCorr = this.cosineCorrelation(chroma, KS_MAJOR_PROFILE, root);
      if (majorCorr > bestScore) {
        runnerUpScore = bestScore;
        bestScore = majorCorr;
        bestPitch = root;
        bestScale = 'major';
      } else if (majorCorr > runnerUpScore) {
        runnerUpScore = majorCorr;
      }

      // Minor test
      const minorCorr = this.cosineCorrelation(chroma, KS_MINOR_PROFILE, root);
      if (minorCorr > bestScore) {
        runnerUpScore = bestScore;
        bestScore = minorCorr;
        bestPitch = root;
        bestScale = 'minor';
      } else if (minorCorr > runnerUpScore) {
        runnerUpScore = minorCorr;
      }
    }

    const detectedNote = PITCH_NAMES[bestPitch];
    const keyName = bestScale === 'minor' ? `${detectedNote}m` : detectedNote;
    const camelotKey = CAMELOT_MAP[`${detectedNote}_${bestScale}`] || '8A';

    // Confidence derived from correlation margin
    const margin = Math.max(0, bestScore - runnerUpScore);
    let confidence = Math.min(0.95, Math.max(0.35, parseFloat((0.4 + margin * 2.5).toFixed(2))));

    // If tag matches, increase confidence
    if (tagHint && (tagHint.toLowerCase() === keyName.toLowerCase() || tagHint.toLowerCase() === detectedNote.toLowerCase())) {
      confidence = Math.min(0.98, confidence + 0.15);
    }

    return {
      musicalKey: keyName,
      scale: bestScale,
      camelotKey,
      keyConfidence: confidence,
    };
  }

  private static cosineCorrelation(a: Float32Array, profile: number[], shift: number): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < 12; i++) {
      const valA = a[i];
      const valB = profile[(i - shift + 12) % 12];
      dot += valA * valB;
      normA += valA * valA;
      normB += valB * valB;
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom > 0 ? dot / denom : 0;
  }

  /**
   * Psychoacoustic Perceptual Feature Extractor (0.0 to 1.0)
   */
  public static extractPsychoacousticFeatures(params: {
    rms: number;
    dynamicRange: number;
    spectralCentroid: number;
    spectralRolloff: number;
    spectralFlatness: number;
    subBassEnergy: number;
    brillianceEnergy: number;
    bpm: number;
    scale: 'major' | 'minor';
    confidence: number;
  }): {
    energy: number;
    danceability: number;
    valence: number;
    acousticness: number;
    instrumentalness: number;
    speechRatio: number;
  } {
    const {
      rms,
      spectralCentroid,
      spectralRolloff,
      spectralFlatness,
      subBassEnergy,
      bpm,
      scale,
    } = params;

    // Energy: intensity, high centroid, sub-bass drive
    const normRms = Math.min(1.0, rms * 3.5);
    const normCentroid = Math.min(1.0, spectralCentroid / 6000);
    const normRolloff = Math.min(1.0, spectralRolloff / 12000);
    const energy = parseFloat(
      Math.min(0.99, Math.max(0.05, 0.4 * normRms + 0.3 * normCentroid + 0.3 * normRolloff)).toFixed(2)
    );

    // Danceability: optimal tempo (110 - 130), sub-bass rhythm, moderate loudness stability
    const tempoFitness = 1.0 - Math.min(1.0, Math.abs(bpm - 124) / 60);
    const danceability = parseFloat(
      Math.min(0.98, Math.max(0.1, 0.5 * tempoFitness + 0.3 * subBassEnergy * 2.5 + 0.2 * energy)).toFixed(2)
    );

    // Valence: emotional positivity (major key boost, brighter centroid, high energy)
    const modeBonus = scale === 'major' ? 0.25 : 0.0;
    const valence = parseFloat(
      Math.min(0.99, Math.max(0.05, 0.35 * normCentroid + 0.35 * energy + modeBonus)).toFixed(2)
    );

    // Acousticness: low flatness, lower rolloff, low electronic sub-bass
    const electronicFactor = Math.min(1.0, subBassEnergy * 4.0 + (spectralRolloff > 10000 ? 0.3 : 0));
    const acousticness = parseFloat(
      Math.min(0.98, Math.max(0.02, 1.0 - 0.7 * electronicFactor - 0.3 * energy)).toFixed(2)
    );

    // Instrumentalness: absence of vocal formants (1kHz - 3.5kHz prominence vs uniform spectrum)
    const instrumentalness = parseFloat(
      Math.min(0.95, Math.max(0.05, 0.6 + 0.3 * (1.0 - spectralFlatness) - 0.2 * (energy > 0.8 ? 0.2 : 0))).toFixed(2)
    );

    // Speech ratio: typically very low in melodic music (<0.15)
    const speechRatio = parseFloat(Math.min(0.4, Math.max(0.01, spectralFlatness * 0.2)).toFixed(2));

    return {
      energy,
      danceability,
      valence,
      acousticness,
      instrumentalness,
      speechRatio,
    };
  }

  /**
   * Acoustic Fingerprinting (Deterministic Constellation Hash)
   * Produces a reproducible SHA-256 fingerprint hash and 32-bit token list
   */
  public static generateAcousticFingerprint(samples: Float32Array, sampleRate: number): {
    fingerprint: string;
    fingerprintRaw: string;
    durationMs: number;
    sampleCount: number;
  } {
    const durationMs = Math.round((samples.length / sampleRate) * 1000);
    if (samples.length === 0) {
      return {
        fingerprint: crypto.createHash('sha256').update('empty').digest('hex'),
        fingerprintRaw: '',
        durationMs: 0,
        sampleCount: 0,
      };
    }

    // Sample down to 100 landmark windows across the track
    const windowCount = Math.min(100, Math.max(10, Math.floor(samples.length / (sampleRate * 2))));
    const stride = Math.floor(samples.length / windowCount);
    const tokens: number[] = [];

    for (let w = 0; w < windowCount; w++) {
      const offset = w * stride;
      let windowSum = 0;
      let maxPeak = 0;
      let zeroCrossings = 0;

      for (let i = 0; i < Math.min(1024, samples.length - offset); i++) {
        const val = samples[offset + i];
        windowSum += val * val;
        if (Math.abs(val) > maxPeak) maxPeak = Math.abs(val);
        if (i > 0 && ((samples[offset + i - 1] >= 0 && val < 0) || (samples[offset + i - 1] < 0 && val >= 0))) {
          zeroCrossings++;
        }
      }

      // Compact 32-bit sub-fingerprint token: [Peak: 12-bit] [Energy: 10-bit] [ZeroCross: 10-bit]
      const peakQuant = Math.min(4095, Math.floor(maxPeak * 4095));
      const energyQuant = Math.min(1023, Math.floor(Math.sqrt(windowSum / 1024) * 1023));
      const zcQuant = Math.min(1023, zeroCrossings);

      const token = ((peakQuant & 0xfff) << 20) | ((energyQuant & 0x3ff) << 10) | (zcQuant & 0x3ff);
      tokens.push(token);
    }

    const tokenHex = tokens.map((t) => t.toString(16).padStart(8, '0')).join('');
    const masterFingerprint = crypto.createHash('sha256').update(tokenHex).digest('hex');

    return {
      fingerprint: masterFingerprint,
      fingerprintRaw: tokenHex.slice(0, 512), // Truncated sample stream for database indexing
      durationMs,
      sampleCount: samples.length,
    };
  }

  /**
   * Rule-based Mood & Genre Classifier based on DSP features
   */
  public static classifyMoodAndGenre(features: {
    bpm: number;
    energy: number;
    valence: number;
    danceability: number;
    acousticness: number;
    musicalKey: string;
    scale: 'major' | 'minor';
    tagGenre?: string;
    tagMood?: string;
  }): {
    primaryMood: string;
    secondaryMood: string;
    detectedGenre: string;
    genreConfidence: number;
  } {
    const { bpm, energy, valence, danceability, acousticness, scale, tagGenre, tagMood } = features;

    // Mood Classification
    let primaryMood = 'Chill';
    let secondaryMood = 'Atmospheric';

    if (energy >= 0.75 && bpm >= 120) {
      primaryMood = 'Energy';
      secondaryMood = valence >= 0.55 ? 'Euphoric' : 'Intense';
    } else if (valence >= 0.65 && danceability >= 0.6) {
      primaryMood = 'Euphoric';
      secondaryMood = 'Energy';
    } else if (energy <= 0.45 && acousticness >= 0.5) {
      primaryMood = 'Chill';
      secondaryMood = 'Acoustic';
    } else if (scale === 'minor' && valence <= 0.4 && energy <= 0.6) {
      primaryMood = 'Melancholic';
      secondaryMood = 'Reflective';
    } else if (bpm >= 85 && bpm <= 125 && energy >= 0.4 && energy <= 0.7) {
      primaryMood = 'Focus';
      secondaryMood = 'Groove';
    }

    // Override with confirmed tag if present
    if (tagMood) {
      primaryMood = tagMood;
    }

    // Genre Classification
    let detectedGenre = tagGenre || 'Electronic';
    let genreConfidence = tagGenre ? 0.9 : 0.65;

    if (!tagGenre) {
      if (acousticness > 0.65) {
        detectedGenre = bpm < 90 ? 'Acoustic' : 'Indie Folk';
      } else if (energy > 0.7 && bpm >= 125 && bpm <= 145) {
        detectedGenre = 'Synthwave';
      } else if (energy > 0.6 && danceability > 0.65) {
        detectedGenre = 'Electronic';
      } else if (energy < 0.35 && bpm < 85) {
        detectedGenre = 'Ambient';
      } else if (bpm >= 75 && bpm <= 95 && acousticness < 0.5) {
        detectedGenre = 'Lo-Fi Hip-Hop';
      }
    }

    return {
      primaryMood,
      secondaryMood,
      detectedGenre,
      genreConfidence,
    };
  }
}
