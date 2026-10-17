/**
 * Local Database Music Provider Adapter
 * =====================================
 * Adapts local Prisma database tracks and multi-tier audio variants
 * into the common IMusicProvider interface.
 */

import fs from 'fs';
import path from 'path';
import {
  IMusicProvider,
  ProviderTrack,
  ProviderArtist,
  ProviderAlbum,
  CatalogSearchBundle,
  StreamResolution,
  QualityTier,
} from './music-provider.interface.js';
import { prisma } from '../prisma.js';
import { audioVariantService } from '../audio-variant.service.js';

export class LocalProviderAdapter implements IMusicProvider {
  public readonly name = 'local';

  async isAvailable(): Promise<boolean> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  async search(query: string, options?: { limit?: number }): Promise<CatalogSearchBundle> {
    const limit = options?.limit ?? 20;
    const cleanQ = query.trim();

    if (!cleanQ) {
      const tracks = await prisma.track.findMany({ take: limit, orderBy: { playCount: 'desc' } });
      return {
        tracks: tracks.map((t) => this.mapTrack(t)),
        artists: [],
        albums: [],
      };
    }

    const tracks = await prisma.track.findMany({
      where: {
        OR: [
          { title: { contains: cleanQ } },
          { artist: { contains: cleanQ } },
          { album: { contains: cleanQ } },
          { genre: { contains: cleanQ } },
        ],
      },
      take: limit,
    });

    return {
      tracks: tracks.map((t) => this.mapTrack(t)),
      artists: [],
      albums: [],
    };
  }

  async getTrending(_languageOrGenre = 'All', limit = 30): Promise<ProviderTrack[]> {
    const tracks = await prisma.track.findMany({
      take: limit,
      orderBy: { playCount: 'desc' },
    });
    return tracks.map((t) => this.mapTrack(t));
  }

  async resolveStream(
    track: { id: string; title: string; artist: string },
    preferredTier: QualityTier = 'HI_RES_LOSSLESS'
  ): Promise<StreamResolution | null> {
    const dbTrack = await prisma.track.findUnique({
      where: { id: track.id },
      include: { variants: true },
    });

    if (!dbTrack) {
      return null;
    }

    // Select best matching variant
    const selectedVariant = await audioVariantService.selectVariant(track.id, preferredTier as any);

    const codec = selectedVariant?.codec || dbTrack.codec || 'FLAC';
    const container = selectedVariant?.container || dbTrack.container || 'FLAC';
    const bitrate = selectedVariant?.bitrate || dbTrack.bitrate || 2840;
    const sampleRate = selectedVariant?.sampleRate || dbTrack.sampleRate || 96000;
    const bitDepth = selectedVariant?.bitDepth || dbTrack.bitDepth || 24;
    const channels = selectedVariant?.channels || dbTrack.channelCount || 2;
    const qualityTier: QualityTier = (selectedVariant?.qualityTier || dbTrack.qualityTier || 'HI_RES_LOSSLESS') as QualityTier;
    const isLossless = selectedVariant?.isLossless ?? dbTrack.isLossless;
    const isGenuineLossless = selectedVariant?.isGenuineLossless ?? dbTrack.isGenuineLossless;
    const mimeType = selectedVariant?.mimeType || 'audio/flac';
    const targetFile = selectedVariant?.fileUrl || dbTrack.audioFileUrl;

    // Check candidate paths for local audio
    const storageDirs = [
      path.join(process.cwd(), 'storage', 'audio'),
      path.join(process.cwd(), 'backend', 'storage', 'audio'),
    ];

    let resolvedFilePath: string | null = null;
    if (targetFile && fs.existsSync(targetFile)) {
      resolvedFilePath = targetFile;
    } else if (targetFile) {
      for (const dir of storageDirs) {
        const full = path.join(dir, targetFile);
        if (fs.existsSync(full)) {
          resolvedFilePath = full;
          break;
        }
      }
    }

    return {
      streamUrl: targetFile,
      duration: dbTrack.duration,
      codec,
      container,
      bitrate,
      sampleRate,
      bitDepth,
      channels,
      qualityTier,
      isLossless,
      isGenuineLossless,
      validationNotes: dbTrack.validationReport ? 'Validated via AudioValidationService' : undefined,
      mimeType,
      isDirectFile: !!resolvedFilePath,
      filePath: resolvedFilePath ?? undefined,
    };
  }

  private mapTrack(t: any): ProviderTrack {
    return {
      id: t.id,
      title: t.title,
      artist: t.artist,
      album: t.album,
      duration: t.duration,
      genre: t.genre,
      bpm: t.bpm,
      mood: t.mood,
      accentColor: t.accentColor,
      artwork: t.artworkUrl,
      audioUrl: `/api/v1/tracks/${t.id}/stream`,
      playCount: t.playCount,
      year: t.year,
      qualityTier: (t.qualityTier || 'STANDARD') as QualityTier,
      codec: t.codec,
      bitrate: t.bitrate,
      sampleRate: t.sampleRate,
      bitDepth: t.bitDepth,
      isLossless: t.isLossless,
      isGenuineLossless: t.isGenuineLossless,
      isOnline: false,
      provider: 'local',
    };
  }
}

export const localProvider = new LocalProviderAdapter();
