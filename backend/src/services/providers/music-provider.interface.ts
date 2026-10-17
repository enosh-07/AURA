/**
 * AURA Music Provider Interface
 * ==============================
 * Defines the unified contract for music catalog providers (Local Database,
 * JioSaavn, iTunes, Audius, etc.).
 *
 * All external and internal streaming integrations must conform to this interface.
 */

export type QualityTier = 'STANDARD' | 'HIGH' | 'LOSSLESS' | 'HI_RES_LOSSLESS';

export interface ProviderTrack {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  album?: string;
  albumId?: string;
  duration: number;
  genre?: string;
  bpm?: number;
  mood?: string;
  accentColor?: string;
  artwork: string;
  audioUrl?: string;
  playCount?: number;
  year?: number;
  qualityTier?: QualityTier;
  codec?: string;
  bitrate?: number;
  sampleRate?: number;
  bitDepth?: number;
  isLossless?: boolean;
  isGenuineLossless?: boolean;
  isOnline: boolean;
  provider: string; // 'local' | 'jiosaavn' | 'itunes' | 'audius' | 'open_archive' | 'qobuz' | 'tidal'
}

export interface ProviderArtist {
  id: string;
  name: string;
  avatar: string;
  genre?: string;
  monthlyListeners?: number;
  verified?: boolean;
  trackCount?: number;
  topTracks?: ProviderTrack[];
  albums?: ProviderAlbum[];
  provider: string;
}

export interface ProviderAlbum {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  artwork: string;
  year?: number;
  genre?: string;
  trackCount?: number;
  tracks?: ProviderTrack[];
  provider: string;
}

export interface StreamResolution {
  streamUrl: string;
  duration?: number;
  codec: string;
  container?: string;
  bitrate?: number;
  sampleRate?: number;
  bitDepth?: number;
  channels?: number;
  qualityTier: QualityTier;
  isLossless: boolean;
  isGenuineLossless: boolean;
  validationNotes?: string;
  mimeType: string;
  isDirectFile?: boolean;
  filePath?: string;
  headers?: Record<string, string>;
}

export interface CatalogSearchBundle {
  tracks: ProviderTrack[];
  artists: ProviderArtist[];
  albums: ProviderAlbum[];
}

export interface IMusicProvider {
  /** Unique provider identifier */
  readonly name: string;

  /** Health / availability check */
  isAvailable(): Promise<boolean>;

  /** Search across catalog tracks, artists, and albums */
  search(query: string, options?: { limit?: number; language?: string }): Promise<CatalogSearchBundle>;

  /** Fetch trending or curated charts */
  getTrending(languageOrGenre?: string, limit?: number): Promise<ProviderTrack[]>;

  /** Resolve audio stream URL with fidelity metadata */
  resolveStream(
    track: { id: string; title: string; artist: string; audioUrl?: string },
    preferredTier?: QualityTier
  ): Promise<StreamResolution | null>;

  /** Get detailed artist profile */
  getArtistDetails?(artistId: string): Promise<ProviderArtist | null>;

  /** Get detailed album information */
  getAlbumDetails?(albumId: string): Promise<ProviderAlbum | null>;
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

