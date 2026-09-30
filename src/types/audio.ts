export type RepeatMode = 'off' | 'all' | 'one';

export interface LyricsLine {
  time: number; // in seconds
  text: string;
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
  audioUrl: string;
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
