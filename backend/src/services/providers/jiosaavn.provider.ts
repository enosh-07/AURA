/**
 * JioSaavn Music Provider Adapter
 * ================================
 * Adapts JioSaavn and online multi-language catalog services to the
 * common IMusicProvider interface.
 *
 * Preserves 100% of the JioSaavn DES cipher decryptor, Indian regional catalog,
 * and 320kbps CD master resolution.
 */

import {
  IMusicProvider,
  ProviderTrack,
  ProviderArtist,
  ProviderAlbum,
  CatalogSearchBundle,
  StreamResolution,
  QualityTier,
} from './music-provider.interface.js';
import { onlineMusicService, OnlineTrack, OnlineArtist, OnlineAlbum } from '../onlineMusic.service.js';

export class JioSaavnProviderAdapter implements IMusicProvider {
  public readonly name = 'jiosaavn';

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch('https://www.jiosaavn.com/api.php?__call=autocomplete.get&query=test', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async search(query: string, options?: { limit?: number; language?: string }): Promise<CatalogSearchBundle> {
    const bundle = await onlineMusicService.searchCatalog(query, options?.language, options?.limit ?? 20);
    return {
      tracks: bundle.tracks.map((t) => this.mapTrack(t)),
      artists: bundle.artists.map((a) => this.mapArtist(a)),
      albums: bundle.albums.map((al) => this.mapAlbum(al)),
    };
  }

  async getTrending(languageOrGenre = 'All', limit = 30): Promise<ProviderTrack[]> {
    const tracks = await onlineMusicService.getTrending(languageOrGenre, limit);
    return tracks.map((t) => this.mapTrack(t));
  }

  async resolveStream(
    track: { id: string; title: string; artist: string; audioUrl?: string },
    preferredTier: QualityTier = 'HIGH'
  ): Promise<StreamResolution | null> {
    const isStandard = preferredTier === 'STANDARD';
    const targetBitrate = isStandard ? 160 : 320;
    const targetTier: QualityTier = isStandard ? 'STANDARD' : 'HIGH';

    // 1. Direct stream check if already an HTTP link
    if (track.audioUrl && (track.audioUrl.startsWith('http://') || track.audioUrl.startsWith('https://'))) {
      const adaptedUrl = isStandard
        ? track.audioUrl.replace('_320.mp4', '_160.mp4')
        : track.audioUrl;
      return {
        streamUrl: adaptedUrl,
        codec: 'AAC',
        container: 'M4A',
        bitrate: targetBitrate,
        sampleRate: 44100,
        bitDepth: undefined,
        channels: 2,
        qualityTier: targetTier,
        isLossless: false,
        isGenuineLossless: false,
        mimeType: 'audio/mp4',
        validationNotes: `Streamed via ${targetBitrate}kbps Akamai CDN delivery`,
      };
    }

    // 2. Resolve stream using onlineMusicService full-length resolution
    const resolved = await onlineMusicService.resolveFullLengthStream(track.title, track.artist);
    if (!resolved || !resolved.streamUrl) {
      return null;
    }

    const adaptedUrl = isStandard
      ? resolved.streamUrl.replace('_320.mp4', '_160.mp4')
      : resolved.streamUrl;

    return {
      streamUrl: adaptedUrl,
      duration: resolved.duration,
      codec: 'AAC',
      container: 'M4A',
      bitrate: targetBitrate,
      sampleRate: 44100,
      bitDepth: undefined,
      channels: 2,
      qualityTier: targetTier,
      isLossless: false,
      isGenuineLossless: false,
      validationNotes: `Streamed via ${targetBitrate}kbps Akamai CDN master`,
      mimeType: 'audio/mp4',
    };
  }

  async getArtistDetails(artistId: string): Promise<ProviderArtist | null> {
    const a = await onlineMusicService.getArtistDetails(artistId);
    return a ? this.mapArtist(a) : null;
  }

  async getAlbumDetails(albumId: string): Promise<ProviderAlbum | null> {
    const al = await onlineMusicService.getAlbumDetails(albumId);
    return al ? this.mapAlbum(al) : null;
  }

  private mapTrack(t: OnlineTrack): ProviderTrack {
    return {
      id: t.id,
      title: t.title,
      artist: t.artist,
      artistId: t.artistId,
      album: t.album,
      albumId: t.albumId,
      duration: t.duration,
      genre: t.genre,
      bpm: t.bpm,
      accentColor: t.accentColor,
      artwork: t.artwork,
      audioUrl: t.audioUrl,
      playCount: t.playCount,
      year: t.year,
      qualityTier: 'HIGH',
      codec: 'AAC',
      bitrate: 320,
      sampleRate: 44100,
      bitDepth: 16,
      isLossless: false,
      isGenuineLossless: false,
      isOnline: true,
      provider: 'jiosaavn',
    };
  }

  private mapArtist(a: OnlineArtist): ProviderArtist {
    return {
      id: a.id,
      name: a.name,
      avatar: a.avatar,
      genre: a.genre,
      monthlyListeners: a.monthlyListeners,
      verified: a.verified,
      trackCount: a.trackCount,
      topTracks: a.topTracks?.map((t) => this.mapTrack(t)),
      albums: a.albums?.map((al) => this.mapAlbum(al)),
      provider: 'jiosaavn',
    };
  }

  private mapAlbum(al: OnlineAlbum): ProviderAlbum {
    return {
      id: al.id,
      title: al.title,
      artist: al.artist,
      artistId: al.artistId,
      artwork: al.artwork,
      year: al.year,
      genre: al.genre,
      trackCount: al.trackCount,
      tracks: al.tracks?.map((t) => this.mapTrack(t)),
      provider: 'jiosaavn',
    };
  }
}

export const jioSaavnProvider = new JioSaavnProviderAdapter();
