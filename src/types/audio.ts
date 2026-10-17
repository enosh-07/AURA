export type RepeatMode = 'off' | 'all' | 'one';

export type PlayerPresentationMode = 'full' | 'mini';
export type FullPlayerTab = 'artwork' | 'live-lyrics';

export type LyricsLoadingStatus = 'idle' | 'loading' | 'loaded' | 'error' | 'not_found' | 'instrumental';
export type LyricsSource = 'embedded' | 'database' | 'lrclib' | 'none';

export interface LyricsLine {
  time: number; // in seconds
  text: string;
}

export interface LyricsState {
  trackId: string | null;
  status: LyricsLoadingStatus;
  source: LyricsSource;
  hasSync: boolean;
  isInstrumental: boolean;
  lines: LyricsLine[];
  plainLyrics?: string;
  error?: string | null;
}

export type QualityTier = 'STANDARD' | 'HIGH' | 'LOSSLESS' | 'HI_RES_LOSSLESS';
export type QualityPreference = 'AUTO' | 'STANDARD' | 'HIGH' | 'LOSSLESS' | 'HI_RES_LOSSLESS';

export interface AudioVariant {
  id: string;
  trackId: string;
  qualityTier: QualityTier;
  codec: string;
  container?: string;
  bitrate?: number;
  sampleRate?: number;
  bitDepth?: number;
  channels?: number;
  fileSize?: number;
  mimeType: string;
  isLossless: boolean;
  isGenuineLossless: boolean;
  validationNotes?: string;
  isDefault?: boolean;
  streamUrl: string;
}

export type VerificationStatus = 'VERIFIED' | 'FALLBACK_LOSSY' | 'MISMATCH' | 'UNVERIFIED';
export type AtmosStatus = 'VERIFIED_ATMOS' | 'NOT_ATMOS' | 'NO_ATMOS_STREAM' | 'UNSUPPORTED_PLATFORM';

export interface AudioQualityReport {
  trackId: string;
  title: string;
  artist: string;
  requestedTier: QualityTier | 'AUTO';
  deliveredTier: QualityTier;
  provider: {
    id: string;
    displayName: string;
    sourceType: string;
    authRequirement: string;
    licensingTerms: string;
  };
  source: {
    codec: string;
    container: string;
    bitrate: number | null;
    sampleRate: number | null;
    bitDepth: number | null;
    channels: number;
    channelLayout: string;
    isLossless: boolean;
    isHiRes: boolean;
    fileSize: number | null;
    duration: number;
    provenance: string;
  };
  playback: {
    audioContextSampleRate: number | null;
    outputSampleRate: number | null;
    bitPerfectBypass: boolean;
    dspActive: boolean;
    osMixerNote: string;
  };
  dolbyAtmos: {
    isDolbyAtmos: boolean;
    status: AtmosStatus;
    badgeVisible: boolean;
    reason: string;
    spatialRenderingMode: 'DISCRETE_ATMOS' | 'AURA_BINAURAL_SIMULATION' | 'STEREO_PASSTHROUGH';
  };
  verification: {
    status: VerificationStatus;
    notes: string;
    losslessAlternativeAvailable?: {
      trackId: string;
      title: string;
      artist: string;
      album?: string;
      provider: string;
      tier: QualityTier;
      codec: string;
      sampleRate: number;
      bitDepth?: number;
    } | null;
  };
}

export interface TrackQualityInfo {
  trackId: string;
  title: string;
  artist: string;
  codec: string;
  container: string;
  bitDepth: number;
  sampleRate: number;
  channels: number;
  bitrate: number;
  duration: number;
  fileSize: number;
  sourceType: string;
  qualityTier: QualityTier;
  losslessStatus: boolean;
  lossless: boolean;
  isGenuineLossless: boolean;
  validationNotes?: string;
  variants: AudioVariant[];
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  album: string;
  albumId?: string;
  duration: number; // in seconds
  artwork: string;
  artworkUrl?: string;
  audioUrl: string;
  streamUrl?: string;
  genre: string;
  year?: number;
  isLocal?: boolean;
  isOnline?: boolean;
  fileBlob?: Blob;
  lyrics?: LyricsLine[];
  plainLyrics?: string;
  bpm?: number;
  mood?: string;
  accentColor?: string; // hex or rgb for dynamic artwork lighting
  playCount?: number;

  // Genuine Lossless Audio System Fields
  codec?: string;
  container?: string;
  bitDepth?: number;
  sampleRate?: number;
  channels?: number;
  bitrate?: number;
  fileSize?: number;
  sourceType?: string;
  qualityTier?: QualityTier;
  losslessStatus?: boolean;
  lossless?: boolean;
  isLossless?: boolean;
  isGenuineLossless?: boolean;
  validationNotes?: string;
  variants?: AudioVariant[];
  currentVariant?: AudioVariant;
  audioProfile?: AudioProfile;
}

export interface AudioProfile {
  id?: string;
  trackId: string;
  bpm: number | null;
  bpmConfidence: number | null;
  danceability: number | null;
  musicalKey: string | null;
  keyConfidence: number | null;
  camelotKey: string | null;
  scale: string | null;
  integratedLoudness: number | null; // LUFS
  loudnessRange: number | null;      // LU
  truePeak: number | null;           // dBFS
  dynamicRange: number | null;       // dB
  energy: number | null;
  valence: number | null;
  acousticness: number | null;
  instrumentalness: number | null;
  speechRatio: number | null;
  spectralCentroid: number | null;   // Hz
  spectralRolloff: number | null;    // Hz
  spectralFlatness: number | null;
  spectralSpread: number | null;
  spectralFeatures?: string | null;
  primaryMood: string | null;
  secondaryMood: string | null;
  detectedGenre: string | null;
  genreConfidence: number | null;
  fingerprint: string | null;
  durationMs: number | null;
  analyzedAt: string | Date;
  analyzerVersion: string;
  analysisSource: string;
  isComplete: boolean;
}

export interface Playlist {
  id: string;
  title: string;
  description: string;
  coverUrl: string;
  trackIds: string[];
  createdAt: string;
  isCustom?: boolean;
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  artwork: string;
  year: number;
  trackIds: string[];
  genre: string;
  trackCount?: number;
  tracks?: Track[];
}

export interface Artist {
  id: string;
  name: string;
  avatar: string;
  bio?: string;
  trackIds: string[];
  genre?: string;
  monthlyListeners?: number;
  verified?: boolean;
  topTracks?: Track[];
  albums?: Album[];
}

export type VisualizerMode =
  | 'bars'
  | 'circular'
  | 'waveform'
  | 'particles'
  | 'fluid'
  | 'pulse'
  | 'neon'
  | 'minimal';

export interface AudioLabSettings {
  bands: number[]; // 10 bands: 32Hz, 64Hz, 125Hz, 250Hz, 500Hz, 1kHz, 2kHz, 4kHz, 8kHz, 16kHz (-12 to +12 dB)
  bassBoost: number; // 0 to +12 dB
  treble: number; // -12 to +12 dB
  stereoPan: number; // -1 (Left) to +1 (Right)
  reverbLevel: number; // 0 to 1
  isBypassed: boolean;
  preset: string;
}

export interface ListeningSession {
  trackId: string;
  timestamp: number;
  durationListened: number;
  completed: boolean;
}
