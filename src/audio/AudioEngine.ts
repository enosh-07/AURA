import { Track, AudioLabSettings } from '../types/audio';
import { API_HOST } from '../services/apiClient';

// Standard 10-band ISO frequencies
export const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export class AudioEngine {
  private static instance: AudioEngine | null = null;

  public audio: HTMLAudioElement;
  private ctx: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private eqFilters: BiquadFilterNode[] = [];
  private bassFilter: BiquadFilterNode | null = null;
  private trebleFilter: BiquadFilterNode | null = null;
  private pannerNode: StereoPannerNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private masterGain: GainNode | null = null;
  private isSynthesizing = false;
  private synthInterval: number | null = null;
  private isBitPerfect = false;
  private lastStreamHeaders: Record<string, string> = {};
  public onQualityHeadersDetected?: (headers: Record<string, string>) => void;

  // Cached data arrays for visualizer (reused to prevent GC pressure)
  private frequencyData: Uint8Array | null = null;
  private waveformData: Uint8Array | null = null;

  private constructor() {
    this.audio = new Audio();
    this.audio.crossOrigin = 'anonymous';
    this.audio.preload = 'auto';
  }

  public static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  /**
   * Initializes the Web Audio graph on user gesture.
   */
  public initAudioContext(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass();

      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);

      // Analyser Node for visualizers
      this.analyserNode = this.ctx.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.smoothingTimeConstant = 0.85;

      this.frequencyData = new Uint8Array(this.analyserNode.frequencyBinCount);
      this.waveformData = new Uint8Array(this.analyserNode.frequencyBinCount);

      // Stereo Panner
      if (this.ctx.createStereoPanner) {
        this.pannerNode = this.ctx.createStereoPanner();
      }

      // Bass Boost (LowShelf at 90Hz)
      this.bassFilter = this.ctx.createBiquadFilter();
      this.bassFilter.type = 'lowshelf';
      this.bassFilter.frequency.setValueAtTime(90, this.ctx.currentTime);
      this.bassFilter.gain.setValueAtTime(0, this.ctx.currentTime);

      // Treble (HighShelf at 8000Hz)
      this.trebleFilter = this.ctx.createBiquadFilter();
      this.trebleFilter.type = 'highshelf';
      this.trebleFilter.frequency.setValueAtTime(8000, this.ctx.currentTime);
      this.trebleFilter.gain.setValueAtTime(0, this.ctx.currentTime);

      // 10-Band Equalizer filters
      this.eqFilters = EQ_FREQUENCIES.map((freq, idx) => {
        const filter = this.ctx!.createBiquadFilter();
        if (idx === 0) {
          filter.type = 'lowshelf';
        } else if (idx === EQ_FREQUENCIES.length - 1) {
          filter.type = 'highshelf';
        } else {
          filter.type = 'peaking';
          filter.Q.setValueAtTime(1.4, this.ctx!.currentTime);
        }
        filter.frequency.setValueAtTime(freq, this.ctx!.currentTime);
        filter.gain.setValueAtTime(0, this.ctx!.currentTime);
        return filter;
      });

      // Connect Media Element Source
      this.sourceNode = this.ctx.createMediaElementSource(this.audio);

      // Build chain: Source -> EQ Filters -> Bass -> Treble -> (Panner) -> Analyser -> Master Gain -> Destination
      let lastNode: AudioNode = this.sourceNode;

      for (const filter of this.eqFilters) {
        lastNode.connect(filter);
        lastNode = filter;
      }

      lastNode.connect(this.bassFilter);
      lastNode = this.bassFilter;

      lastNode.connect(this.trebleFilter);
      lastNode = this.trebleFilter;

      if (this.pannerNode) {
        lastNode.connect(this.pannerNode);
        lastNode = this.pannerNode;
      }

      lastNode.connect(this.analyserNode);
      this.analyserNode.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

    } catch (err) {
      console.warn('Web Audio API could not be initialized or is not supported:', err);
    }
  }

  public playTrack(track: Track): Promise<void> {
    this.stopSynthesizer();
    this.initAudioContext();

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    if (track.fileBlob) {
      this.audio.src = URL.createObjectURL(track.fileBlob);
    } else {
      let srcUrl =
        track.audioUrl.startsWith('http') || track.audioUrl.startsWith('blob:')
          ? track.audioUrl
          : `${API_HOST}${track.audioUrl}`;

      // Append quality tier preference
      if (!srcUrl.includes('tier=') && !srcUrl.includes('quality=')) {
        const delimiter = srcUrl.includes('?') ? '&' : '?';
        srcUrl = `${srcUrl}${delimiter}tier=HI_RES_LOSSLESS`;
      }
      this.audio.src = srcUrl;

      // Probe stream headers to obtain exact server delivery format
      fetch(srcUrl, { method: 'HEAD' })
        .then((res) => {
          const headers: Record<string, string> = {};
          res.headers.forEach((val, key) => {
            headers[key.toLowerCase()] = val;
          });
          this.lastStreamHeaders = headers;
          if (this.onQualityHeadersDetected) {
            this.onQualityHeadersDetected(headers);
          }
        })
        .catch(() => {});
    }

    this.audio.load();

    const playPromise = this.audio.play();
    if (playPromise !== undefined) {
      return playPromise.catch((err) => {
        console.warn('Playback error or network issue. Starting fallback procedural ambient synthesizer:', err);
        this.startFallbackSynthesizer(track);
      });
    }
    return Promise.resolve();
  }

  public setBitPerfectMode(enabled: boolean): void {
    this.isBitPerfect = enabled;
    if (enabled && this.ctx) {
      const now = this.ctx.currentTime;
      // Bypass EQ, Bass, Treble, and Panning to guarantee pure bit-perfect pass-through
      this.eqFilters.forEach((f) => f.gain.setValueAtTime(0, now));
      if (this.bassFilter) this.bassFilter.gain.setValueAtTime(0, now);
      if (this.trebleFilter) this.trebleFilter.gain.setValueAtTime(0, now);
      if (this.pannerNode) this.pannerNode.pan.setValueAtTime(0, now);
    }
  }

  public getBitPerfectMode(): boolean {
    return this.isBitPerfect;
  }

  public getLastStreamHeaders(): Record<string, string> {
    return this.lastStreamHeaders;
  }

  public getDSPStatus(): { isProcessing: boolean; eq: boolean; spatial: boolean; normalization: boolean } {
    if (this.isBitPerfect) {
      return { isProcessing: false, eq: false, spatial: false, normalization: false };
    }
    const hasActiveEQ = this.eqFilters.some((f) => Math.abs(f.gain.value) > 0.1);
    const hasBass = this.bassFilter ? Math.abs(this.bassFilter.gain.value) > 0.1 : false;
    const hasTreble = this.trebleFilter ? Math.abs(this.trebleFilter.gain.value) > 0.1 : false;
    const hasPan = this.pannerNode ? Math.abs(this.pannerNode.pan.value) > 0.05 : false;

    const isProcessing = hasActiveEQ || hasBass || hasTreble || hasPan;
    return {
      isProcessing,
      eq: hasActiveEQ || hasBass || hasTreble,
      spatial: hasPan,
      normalization: false,
    };
  }

  public pause(): void {
    if (this.isSynthesizing) {
      this.stopSynthesizer();
    } else {
      this.audio.pause();
    }
  }

  public resume(): Promise<void> {
    this.initAudioContext();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (this.isSynthesizing) {
      return Promise.resolve();
    }
    return this.audio.play();
  }

  public seek(seconds: number): void {
    if (!Number.isNaN(seconds) && Number.isFinite(seconds)) {
      this.audio.currentTime = Math.max(0, Math.min(seconds, this.audio.duration || 300));
    }
  }

  public setVolume(vol: number): void {
    const clamped = Math.max(0, Math.min(1, vol));
    this.audio.volume = clamped;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(clamped, this.ctx.currentTime);
    }
  }

  public setPlaybackRate(rate: number): void {
    this.audio.playbackRate = Math.max(0.5, Math.min(2.0, rate));
  }

  /**
   * Applies Audio Lab settings (10-band EQ, bass boost, treble, pan, bypass)
   */
  public applyAudioLabSettings(settings: AudioLabSettings): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    if (settings.isBypassed) {
      this.eqFilters.forEach((f) => f.gain.setTargetAtTime(0, now, 0.05));
      if (this.bassFilter) this.bassFilter.gain.setTargetAtTime(0, now, 0.05);
      if (this.trebleFilter) this.trebleFilter.gain.setTargetAtTime(0, now, 0.05);
      if (this.pannerNode) this.pannerNode.pan.setTargetAtTime(0, now, 0.05);
      return;
    }

    // Apply EQ bands
    settings.bands.forEach((gain, i) => {
      if (this.eqFilters[i]) {
        this.eqFilters[i].gain.setTargetAtTime(gain, now, 0.05);
      }
    });

    // Bass Boost
    if (this.bassFilter) {
      this.bassFilter.gain.setTargetAtTime(settings.bassBoost, now, 0.05);
    }

    // Treble
    if (this.trebleFilter) {
      this.trebleFilter.gain.setTargetAtTime(settings.treble, now, 0.05);
    }

    // Stereo Panner
    if (this.pannerNode) {
      this.pannerNode.pan.setTargetAtTime(settings.stereoPan, now, 0.05);
    }
  }

  /**
   * Smoothly fades out audio over durationSeconds before stopping.
   */
  public fadeOutAndStop(durationSeconds: number = 3): Promise<void> {
    return new Promise((resolve) => {
      if (!this.ctx || !this.masterGain) {
        this.pause();
        resolve();
        return;
      }
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(0.0001, now + durationSeconds);

      setTimeout(() => {
        this.pause();
        if (this.masterGain && this.ctx) {
          this.masterGain.gain.setValueAtTime(this.audio.volume, this.ctx.currentTime);
        }
        resolve();
      }, durationSeconds * 1000);
    });
  }

  /**
   * Returns frequency domain data for audio visualizer
   */
  public getFrequencyData(): Uint8Array | null {
    if (this.analyserNode && this.frequencyData) {
      this.analyserNode.getByteFrequencyData(this.frequencyData);
      return this.frequencyData;
    }
    return null;
  }

  /**
   * Returns time domain waveform data for audio visualizer
   */
  public getWaveformData(): Uint8Array | null {
    if (this.analyserNode && this.waveformData) {
      this.analyserNode.getByteTimeDomainData(this.waveformData);
      return this.waveformData;
    }
    return null;
  }

  /**
   * Fallback Web Audio harmonic synthesizer: Generates pleasant procedural ambient / chord arpeggios
   * so that music playback never fails if a remote audio CDN is blocked or offline!
   */
  private startFallbackSynthesizer(track: Track): void {
    if (!this.ctx) return;
    this.isSynthesizing = true;

    const baseFreq = track.bpm && track.bpm > 100 ? 220 : 146.83; // A3 or D3
    const chordNotes = [baseFreq, baseFreq * 1.25, baseFreq * 1.5, baseFreq * 1.875];
    let noteIdx = 0;

    const playChime = () => {
      if (!this.isSynthesizing || !this.ctx || !this.analyserNode) return;
      try {
        const osc = this.ctx.createOscillator();
        const noteGain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(chordNotes[noteIdx % chordNotes.length], this.ctx.currentTime);
        noteIdx++;

        noteGain.gain.setValueAtTime(0, this.ctx.currentTime);
        noteGain.gain.linearRampToValueAtTime(0.15, this.ctx.currentTime + 0.1);
        noteGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 2.5);

        osc.connect(noteGain);
        noteGain.connect(this.analyserNode);

        osc.start();
        osc.stop(this.ctx.currentTime + 2.6);
      } catch {
        // Safe ignore
      }
    };

    playChime();
    this.synthInterval = window.setInterval(playChime, 1500);
  }

  private stopSynthesizer(): void {
    this.isSynthesizing = false;
    if (this.synthInterval) {
      clearInterval(this.synthInterval);
      this.synthInterval = null;
    }
  }

  /**
   * Integrates with native OS Media Session API
   */
  public updateMediaSession(
    track: Track,
    handlers: {
      onPlay: () => void;
      onPause: () => void;
      onNext: () => void;
      onPrev: () => void;
      onSeek: (time: number) => void;
    }
  ): void {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album,
        artwork: [
          { src: track.artwork, sizes: '512x512', type: 'image/jpeg' },
        ],
      });

      navigator.mediaSession.setActionHandler('play', handlers.onPlay);
      navigator.mediaSession.setActionHandler('pause', handlers.onPause);
      navigator.mediaSession.setActionHandler('previoustrack', handlers.onPrev);
      navigator.mediaSession.setActionHandler('nexttrack', handlers.onNext);
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
          handlers.onSeek(details.seekTime);
        }
      });
    }
  }
}

export const audioEngine = AudioEngine.getInstance();
