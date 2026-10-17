/**
 * AURA Music Provider Registry
 * =============================
 * Central orchestrator managing all registered IMusicProvider adapters.
 * Directs search, discovery, and stream resolution requests through the
 * appropriate provider with transparent fallback.
 */

import {
  IMusicProvider,
  ProviderTrack,
  CatalogSearchBundle,
  StreamResolution,
  QualityTier,
} from './music-provider.interface.js';
import { localProvider } from './local.provider.js';
import { jioSaavnProvider } from './jiosaavn.provider.js';

export class MusicProviderRegistry {
  private providers: Map<string, IMusicProvider> = new Map();

  constructor() {
    this.registerProvider(localProvider);
    this.registerProvider(jioSaavnProvider);
  }

  public registerProvider(provider: IMusicProvider): void {
    this.providers.set(provider.name, provider);
  }

  public getProvider(name: string): IMusicProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Search across all available providers and merge results seamlessly
   */
  public async searchAll(
    query: string,
    options?: { limit?: number; language?: string }
  ): Promise<CatalogSearchBundle> {
    const limit = options?.limit ?? 20;

    // Run local search and online search concurrently
    const [localRes, onlineRes] = await Promise.allSettled([
      localProvider.search(query, { limit }),
      jioSaavnProvider.search(query, { limit, language: options?.language }),
    ]);

    const localTracks = localRes.status === 'fulfilled' ? localRes.value.tracks : [];
    const onlineTracks = onlineRes.status === 'fulfilled' ? onlineRes.value.tracks : [];
    const onlineArtists = onlineRes.status === 'fulfilled' ? onlineRes.value.artists : [];
    const onlineAlbums = onlineRes.status === 'fulfilled' ? onlineRes.value.albums : [];

    // Prioritize high-fidelity local tracks, then deduplicate by title + artist
    const mergedTracks: ProviderTrack[] = [...localTracks];
    const seenTitles = new Set(localTracks.map((t) => `${t.title.toLowerCase()}___${t.artist.toLowerCase()}`));

    for (const ot of onlineTracks) {
      const key = `${ot.title.toLowerCase()}___${ot.artist.toLowerCase()}`;
      if (!seenTitles.has(key)) {
        seenTitles.add(key);
        mergedTracks.push(ot);
      }
    }

    return {
      tracks: mergedTracks.slice(0, limit * 2),
      artists: onlineArtists,
      albums: onlineAlbums,
    };
  }

  /**
   * Resolve an audio stream by detecting provider prefix or matching catalog
   */
  public async resolveStream(
    track: { id: string; title: string; artist: string; audioUrl?: string },
    preferredTier: QualityTier = 'HI_RES_LOSSLESS'
  ): Promise<StreamResolution | null> {
    // 1. When user requests LOSSLESS or HI-RES, check if an authentic lossless master exists
    if (preferredTier === 'LOSSLESS' || preferredTier === 'HI_RES_LOSSLESS') {
      const alternative = await this.findLosslessAlternative(track.title, track.artist);
      if (alternative) {
        const altStream = await localProvider.resolveStream(
          { id: alternative.trackId, title: alternative.title, artist: alternative.artist },
          preferredTier
        );
        if (altStream) {
          altStream.validationNotes = `Intelligent Source Selection: Matched genuine ${alternative.codec} master (${alternative.bitDepth ? `${alternative.bitDepth}-bit/` : ''}${Math.round(alternative.sampleRate / 1000)}kHz) from AURA High-Fidelity Vault.`;
          return altStream;
        }
      }
    }

    // 2. If it has a specific online prefix
    if (
      track.id.startsWith('saavn_') ||
      track.id.startsWith('itunes_') ||
      track.id.startsWith('audius_') ||
      track.id.startsWith('online_')
    ) {
      return jioSaavnProvider.resolveStream(track, preferredTier);
    }

    // 3. Try local provider
    const localStream = await localProvider.resolveStream(track, preferredTier);
    if (localStream && (localStream.isDirectFile || localStream.streamUrl)) {
      return localStream;
    }

    // 4. Fallback to online provider (match full-length master)
    return jioSaavnProvider.resolveStream(track, preferredTier);
  }

  /**
   * Search authorized providers (e.g. Local high-fidelity vault) for a genuine lossless master
   * of the given track. Returns details of the alternative without substituting recordings.
   */
  public async findLosslessAlternative(
    title: string,
    artist: string,
    album?: string
  ): Promise<{
    trackId: string;
    title: string;
    artist: string;
    album?: string;
    provider: string;
    tier: QualityTier;
    codec: string;
    sampleRate: number;
    bitDepth?: number;
  } | null> {
    if (!title) return null;
    const cleanTitle = title.toLowerCase().replace(/[^\w\s]/g, '').trim();
    const cleanArtist = (artist || '').toLowerCase().replace(/[^\w\s]/g, '').trim();

    try {
      const { prisma } = await import('../prisma.js');
      const localMatches = await prisma.track.findMany({
        where: {
          isGenuineLossless: true,
        },
        include: { variants: true },
      });

      for (const t of localMatches) {
        const tTitle = t.title.toLowerCase().replace(/[^\w\s]/g, '').trim();
        const tArtist = t.artist.toLowerCase().replace(/[^\w\s]/g, '').trim();

        const titleMatch = tTitle.includes(cleanTitle) || cleanTitle.includes(tTitle);
        const artistMatch = !cleanArtist || tArtist.includes(cleanArtist) || cleanArtist.includes(tArtist);

        if (titleMatch && artistMatch) {
          const tier: QualityTier = (t.qualityTier || 'LOSSLESS') as QualityTier;
          return {
            trackId: t.id,
            title: t.title,
            artist: t.artist,
            album: t.album || undefined,
            provider: 'local',
            tier,
            codec: t.codec || 'FLAC',
            sampleRate: t.sampleRate || 44100,
            bitDepth: t.bitDepth || 16,
          };
        }
      }
    } catch {
      // Database query error handled gracefully
    }

    return null;
  }
}

export const providerRegistry = new MusicProviderRegistry();

