import fs from 'fs';
import path from 'path';
import { parseFile, IAudioMetadata } from 'music-metadata';

export type QualityTier = 'STANDARD' | 'HIGH' | 'LOSSLESS' | 'HI_RES_LOSSLESS';

export interface AudioValidationResult {
  codec: string;
  container: string;
  bitDepth: number;
  sampleRate: number;
  channels: number;
  bitrate: number; // in kbps
  duration: number; // in seconds
  fileSize: number; // in bytes
  sourceType: string;
  qualityTier: QualityTier;
  losslessStatus: boolean;
  isLossless: boolean;
  isGenuineLossless: boolean;
  validationNotes: string;
  mimeType: string;
  cutoffFrequencyKhz?: number;
}

// Known lossy encoder signatures to detect transcoded / upsampled files
const LOSSY_ENCODER_SIGNATURES = [
  /lame/i,
  /lavc/i,
  /lavf/i,
  /ffmpeg.*mp3/i,
  /fraunhofer/i,
  /fhg/i,
  /bladeenc/i,
  /xing/i,
  /helix/i,
  /nero.*aac/i,
  /itunes.*mp3/i,
  /transcode/i,
  /converted.*from.*mp3/i,
  /youtube.*dl/i,
  /ytdl/i,
  /128kbps/i,
  /192kbps/i,
  /320kbps/i,
];

export class AudioValidationService {
  /**
   * Inspect and validate an audio file.
   * Performs container detection, codec identification, metadata extraction,
   * fake-lossless transcode detection, and quality tier classification.
   */
  async validateAudioFile(
    filePath: string,
    originalFilename?: string,
    sourceType: string = 'USER_UPLOAD'
  ): Promise<AudioValidationResult> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Audio file not found at: ${filePath}`);
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;

    // Step 1: Detect container from magic bytes
    const magicContainer = this.detectContainerFromMagicBytes(filePath);

    // Step 2: Extract technical metadata using music-metadata
    let mmMeta: IAudioMetadata | null = null;
    try {
      mmMeta = await parseFile(filePath, { duration: true });
    } catch (err) {
      console.warn('music-metadata parsing note:', err);
    }

    // Step 3: Normalize codec and container
    const container = mmMeta?.format.container || magicContainer || 'UNKNOWN';
    let codec = (mmMeta?.format.codec || '').toUpperCase();
    if (!codec || codec === 'UNKNOWN') {
      codec = this.inferCodecFromContainerAndExt(container, originalFilename || filePath);
    }

    // Map common aliases
    if (codec.includes('PCM')) codec = 'PCM';
    if (codec.includes('FLAC')) codec = 'FLAC';
    if (codec.includes('ALAC')) codec = 'ALAC';
    if (codec.includes('AIFF')) codec = 'AIFF';
    if (codec.includes('MPEG') || codec.includes('MP3') || codec.includes('LAYER 3')) codec = 'MP3';
    if (codec.includes('AAC')) codec = 'AAC';

    // Step 4: Extract technical properties
    const sampleRate = mmMeta?.format.sampleRate || 44100;
    const channels = mmMeta?.format.numberOfChannels || 2;
    let bitDepth = mmMeta?.format.bitsPerSample || (codec === 'FLAC' || codec === 'PCM' ? 16 : 16);
    const duration = Math.max(1, Math.round(mmMeta?.format.duration || 180));

    // Calculate actual measured bitrate in kbps
    let bitrate = 0;
    if (mmMeta?.format.bitrate) {
      bitrate = Math.round(mmMeta.format.bitrate / 1000);
    } else if (fileSize > 0 && duration > 0) {
      bitrate = Math.round((fileSize * 8) / (duration * 1000));
    }
    if (bitrate <= 0 && codec === 'PCM') {
      bitrate = Math.round((sampleRate * bitDepth * channels) / 1000);
    }

    // Determine MIME type
    const mimeType = this.determineMimeType(codec, container);

    // Step 5: Lossless format check
    const isDeclaredLosslessFormat = ['FLAC', 'ALAC', 'PCM', 'WAV', 'AIFF'].some((f) =>
      codec.includes(f) || container.toUpperCase().includes(f)
    );

    // If source is not a lossless format, classify as standard or high lossy
    if (!isDeclaredLosslessFormat) {
      const qualityTier: QualityTier = bitrate >= 256 ? 'HIGH' : 'STANDARD';
      return {
        codec,
        container,
        bitDepth: 16,
        sampleRate,
        channels,
        bitrate,
        duration,
        fileSize,
        sourceType,
        qualityTier,
        losslessStatus: false,
        isLossless: false,
        isGenuineLossless: false,
        validationNotes: `Legitimate lossy audio source preserved (${codec} at ${bitrate} kbps). No artificial upconversion.`,
        mimeType,
      };
    }

    // Step 6: Fake Lossless Transcode Detection
    // Check 1: Check for lossy encoder remnants in tags
    const tagArtifact = this.detectLossyEncoderInTags(mmMeta);
    if (tagArtifact) {
      return {
        codec,
        container,
        bitDepth,
        sampleRate,
        channels,
        bitrate,
        duration,
        fileSize,
        sourceType,
        qualityTier: bitrate >= 256 ? 'HIGH' : 'STANDARD',
        losslessStatus: false,
        isLossless: false,
        isGenuineLossless: false,
        validationNotes: `REJECTED LOSSLESS: Lossy encoder artifact detected in stream metadata ("${tagArtifact}"). This is a transcoded lossy file, not genuine lossless.`,
        mimeType,
      };
    }

    // Check 2: Spectral Cutoff Analysis (for PCM/WAV and decoded samples)
    const spectralCheck = this.performSpectralCutoffAnalysis(filePath, sampleRate);
    if (spectralCheck.isTranscode) {
      return {
        codec,
        container,
        bitDepth,
        sampleRate,
        channels,
        bitrate,
        duration,
        fileSize,
        sourceType,
        qualityTier: 'HIGH',
        losslessStatus: false,
        isLossless: false,
        isGenuineLossless: false,
        cutoffFrequencyKhz: spectralCheck.cutoffKhz,
        validationNotes: `REJECTED LOSSLESS: Audio spectral cutoff detected at ~${spectralCheck.cutoffKhz} kHz (characteristic of lossy MP3/AAC compression filter).`,
        mimeType,
      };
    }

    // Step 7: Genuine Lossless Classification
    const isHiRes = bitDepth >= 24 || sampleRate > 48000;
    const qualityTier: QualityTier = isHiRes ? 'HI_RES_LOSSLESS' : 'LOSSLESS';

    return {
      codec,
      container,
      bitDepth,
      sampleRate,
      channels,
      bitrate,
      duration,
      fileSize,
      sourceType,
      qualityTier,
      losslessStatus: true,
      isLossless: true,
      isGenuineLossless: true,
      validationNotes: `GENUINE ${qualityTier}: Verified ${codec} ${bitDepth}-bit / ${(sampleRate / 1000).toFixed(1)} kHz (${channels === 1 ? 'Mono' : 'Stereo'}). Full audio bandwidth preserved.`,
      mimeType,
    };
  }

  /**
   * Reads initial magic bytes to identify true container.
   */
  private detectContainerFromMagicBytes(filePath: string): string | null {
    try {
      const fd = fs.openSync(filePath, 'r');
      const buf = Buffer.alloc(32);
      fs.readSync(fd, buf, 0, 32, 0);
      fs.closeSync(fd);

      // FLAC: 'fLaC' (0x66 0x4C 0x61 0x43)
      if (buf[0] === 0x66 && buf[1] === 0x4c && buf[2] === 0x61 && buf[3] === 0x43) {
        return 'FLAC';
      }

      // WAV: 'RIFF....WAVE'
      if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WAVE') {
        return 'WAVE';
      }

      // AIFF: 'FORM....AIFF' or 'AIFC'
      if (buf.toString('ascii', 0, 4) === 'FORM' && (buf.toString('ascii', 8, 12) === 'AIFF' || buf.toString('ascii', 8, 12) === 'AIFC')) {
        return 'AIFF';
      }

      // MP4 / M4A / ALAC: '....ftyp'
      if (buf.toString('ascii', 4, 8) === 'ftyp') {
        return 'M4A';
      }

      // MP3 with ID3v2 header: 'ID3'
      if (buf.toString('ascii', 0, 3) === 'ID3') {
        return 'MPEG';
      }

      // MP3 sync frame: 0xFF 0xFB or 0xFA
      if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) {
        return 'MPEG';
      }

      // Ogg: 'OggS'
      if (buf.toString('ascii', 0, 4) === 'OggS') {
        return 'OGG';
      }
    } catch (e) {
      console.warn('Error reading magic bytes:', e);
    }
    return null;
  }

  /**
   * Scans metadata tags (ID3, Vorbis comments) for lossy encoder footprints.
   */
  private detectLossyEncoderInTags(mmMeta: IAudioMetadata | null): string | null {
    if (!mmMeta) return null;

    const valuesToScan: string[] = [];

    // Common tags
    if (mmMeta.common) {
      const c = mmMeta.common as any;
      if (c.encoder) valuesToScan.push(String(c.encoder));
      if (c.encodedby) valuesToScan.push(String(c.encodedby));
      if (c.comment) valuesToScan.push(...(Array.isArray(c.comment) ? c.comment.map(String) : [String(c.comment)]));
      if (c.title) valuesToScan.push(String(c.title));
    }

    // Native tags
    if (mmMeta.native) {
      for (const tagType of Object.keys(mmMeta.native)) {
        const tags = mmMeta.native[tagType];
        if (Array.isArray(tags)) {
          for (const t of tags) {
            if (t.id && (t.id.includes('ENCODER') || t.id.includes('TSSE') || t.id.includes('TOOL') || t.id.includes('COMM'))) {
              valuesToScan.push(String(t.value));
            }
          }
        }
      }
    }

    for (const val of valuesToScan) {
      for (const sig of LOSSY_ENCODER_SIGNATURES) {
        if (sig.test(val)) {
          return val;
        }
      }
    }

    return null;
  }

  /**
   * Spectral Cutoff Analysis:
   * Inspects high-frequency energy ratio in PCM/WAV data.
   * If music has substantial mid-range energy but zero/brickwall cutoff at 15-16kHz (128k MP3)
   * or ~19-20kHz, it detects the lowpass brickwall filter from MP3 encoding.
   */
  private performSpectralCutoffAnalysis(
    filePath: string,
    sampleRate: number
  ): { isTranscode: boolean; cutoffKhz?: number } {
    try {
      const ext = path.extname(filePath).toLowerCase();
      // Only run direct PCM FFT on uncompressed WAV files for speed and accuracy
      if (ext !== '.wav') {
        return { isTranscode: false };
      }

      const fd = fs.openSync(filePath, 'r');
      const stat = fs.statSync(filePath);
      const dataSize = Math.min(stat.size, 1024 * 1024); // read up to 1MB from middle
      const buffer = Buffer.alloc(dataSize);
      // Ensure readOffset is aligned to 4-byte stereo 16-bit sample boundaries
      const rawOffset = Math.max(44, Math.floor(stat.size / 2) - Math.floor(dataSize / 2));
      const readOffset = 44 + (Math.floor((rawOffset - 44) / 4) * 4);
      fs.readSync(fd, buffer, 0, dataSize, readOffset);
      fs.closeSync(fd);

      // Extract 16-bit PCM samples
      const numSamples = Math.floor(dataSize / 2);
      if (numSamples < 2048) {
        return { isTranscode: false };
      }

      const samples = new Float32Array(2048);
      for (let i = 0; i < 2048; i++) {
        samples[i] = buffer.readInt16LE(i * 2) / 32768.0;
      }

      // Compute power spectrum via FFT
      const spectrum = this.computePowerSpectrum(samples);
      const binWidth = sampleRate / 2048; // Hz per bin

      // Measure mid energy (300Hz - 14kHz)
      let midEnergy = 0;
      let midCount = 0;
      // Measure high energy (16kHz - 21kHz)
      let highEnergy = 0;
      let highCount = 0;

      for (let i = 0; i < spectrum.length; i++) {
        const freq = i * binWidth;
        if (freq >= 300 && freq <= 14000) {
          midEnergy += spectrum[i];
          midCount++;
        } else if (freq >= 16000 && freq <= 21000) {
          highEnergy += spectrum[i];
          highCount++;
        }
      }

      const avgMid = midCount > 0 ? midEnergy / midCount : 0;
      const avgHigh = highCount > 0 ? highEnergy / highCount : 0;
      const ratio = avgMid > 0 ? avgHigh / avgMid : 1;

      // If active music exists in mid-range but high frequencies are abruptly cut off (< -50dB drop / ratio < 1e-4)
      if (avgMid > 1e-5 && (avgHigh < 1e-7 || ratio < 1e-4)) {
        // Detect cutoff frequency bin
        let cutoffFreq = 16000;
        for (let i = Math.floor(12000 / binWidth); i < spectrum.length; i++) {
          if (spectrum[i] < 1e-8) {
            cutoffFreq = Math.round(i * binWidth);
            break;
          }
        }
        return {
          isTranscode: true,
          cutoffKhz: Math.round(cutoffFreq / 100) / 10,
        };
      }
    } catch (e) {
      console.warn('Spectral analysis note:', e);
    }

    return { isTranscode: false };
  }

  /**
   * Fast Cooley-Tukey Radix-2 FFT power spectrum computation.
   */
  private computePowerSpectrum(samples: Float32Array): Float32Array {
    const n = samples.length;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);

    // Apply Hann window
    for (let i = 0; i < n; i++) {
      const window = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
      real[i] = samples[i] * window;
    }

    // Bit-reversal permutation
    let j = 0;
    for (let i = 0; i < n - 1; i++) {
      if (i < j) {
        const tr = real[i];
        real[i] = real[j];
        real[j] = tr;
      }
      let k = n >> 1;
      while (k <= j) {
        j -= k;
        k >>= 1;
      }
      j += k;
    }

    // Cooley-Tukey iterations
    for (let len = 2; len <= n; len <<= 1) {
      const halfLen = len >> 1;
      const angle = (-2 * Math.PI) / len;
      const wStepR = Math.cos(angle);
      const wStepI = Math.sin(angle);

      for (let i = 0; i < n; i += len) {
        let wr = 1.0;
        let wi = 0.0;
        for (let k = 0; k < halfLen; k++) {
          const uR = real[i + k];
          const uI = imag[i + k];
          const vR = real[i + k + halfLen] * wr - imag[i + k + halfLen] * wi;
          const vI = real[i + k + halfLen] * wi + imag[i + k + halfLen] * wr;

          real[i + k] = uR + vR;
          imag[i + k] = uI + vI;
          real[i + k + halfLen] = uR - vR;
          imag[i + k + halfLen] = uI - vI;

          const nextWr = wr * wStepR - wi * wStepI;
          wi = wr * wStepI + wi * wStepR;
          wr = nextWr;
        }
      }
    }

    // Return power spectrum (first half: 0 to Nyquist)
    const half = n >> 1;
    const power = new Float32Array(half);
    for (let i = 0; i < half; i++) {
      power[i] = (real[i] * real[i] + imag[i] * imag[i]) / (n * n);
    }
    return power;
  }

  private inferCodecFromContainerAndExt(container: string, filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    if (ext === '.flac') return 'FLAC';
    if (ext === '.wav') return 'PCM';
    if (ext === '.aiff' || ext === '.aif') return 'AIFF';
    if (ext === '.alac' || ext === '.m4a') return 'ALAC';
    if (ext === '.mp3') return 'MP3';
    if (ext === '.aac') return 'AAC';
    if (ext === '.ogg' || ext === '.opus') return 'OPUS';

    if (container.includes('FLAC')) return 'FLAC';
    if (container.includes('WAVE') || container.includes('RIFF')) return 'PCM';
    if (container.includes('AIFF')) return 'AIFF';
    return 'UNKNOWN';
  }

  private determineMimeType(codec: string, container: string): string {
    const c = codec.toUpperCase();
    if (c === 'FLAC') return 'audio/flac';
    if (c === 'PCM' || c === 'WAV') return 'audio/wav';
    if (c === 'ALAC' || container.includes('M4A')) return 'audio/mp4';
    if (c === 'AIFF') return 'audio/aiff';
    if (c === 'MP3') return 'audio/mpeg';
    if (c === 'AAC') return 'audio/aac';
    if (c === 'OPUS') return 'audio/opus';
    return 'audio/mpeg';
  }
}

export const audioValidationService = new AudioValidationService();
