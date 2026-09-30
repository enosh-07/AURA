/**
 * Download Service
 *
 * Platform reality check:
 * - BROWSER: Cannot freely download arbitrary streaming content.
 *   Browser downloads work only for files you own (user-uploaded).
 *   We support PWA cache-manifest approach for browser offline.
 * - DESKTOP/MOBILE NATIVE APP: Can download to local filesystem with user consent.
 *
 * This service tracks download metadata and status.
 * Actual file transfer is handled per platform.
 */

import { prisma } from './prisma.js';

export class DownloadService {
  /**
   * Request a download for a track.
   * For browser platform: returns a cache token for PWA service worker.
   * For desktop/mobile: returns a signed URL the native app can save to disk.
   */
  async requestDownload(userId: string, trackId: string, platform: string, qualityTier = 'standard') {
    const track = await prisma.track.findUnique({ where: { id: trackId } });
    if (!track) throw new Error('Track not found.');

    // Check existing
    const existing = await prisma.download.findUnique({
      where: { userId_trackId: { userId, trackId } },
    });
    if (existing && existing.status === 'complete') {
      return existing;
    }

    // Create or update download record
    const download = await prisma.download.upsert({
      where: { userId_trackId: { userId, trackId } },
      update: {
        status: 'pending',
        progress: 0,
        platform,
        qualityTier,
        updatedAt: new Date(),
      },
      create: {
        userId,
        trackId,
        platform,
        qualityTier,
        status: 'pending',
        progress: 0,
      },
    });

    // For browser: return stream URL (PWA service worker caches it)
    // For desktop/mobile: native app handles the actual download using this URL
    const streamUrl = `/api/v1/tracks/${trackId}/stream`;

    return {
      ...download,
      streamUrl,
      trackTitle: track.title,
      trackArtist: track.artist,
      platform,
      note: platform === 'web'
        ? 'Browser caching via PWA service worker. Not a full file download due to browser sandbox limitations.'
        : 'Download URL valid for native app filesystem write.',
    };
  }

  async updateProgress(userId: string, trackId: string, progress: number, status?: string) {
    const clampedProgress = Math.min(1, Math.max(0, progress));
    return prisma.download.updateMany({
      where: { userId, trackId },
      data: {
        progress: clampedProgress,
        status: status ?? (clampedProgress >= 1 ? 'complete' : 'downloading'),
        updatedAt: new Date(),
      },
    });
  }

  async getDownloads(userId: string) {
    const downloads = await prisma.download.findMany({
      where: { userId },
      include: {
        track: {
          select: { id: true, title: true, artist: true, album: true, duration: true, artworkUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return downloads.map((d) => ({
      ...d,
      streamUrl: `/api/v1/tracks/${d.trackId}/stream`,
    }));
  }

  async removeDownload(userId: string, trackId: string) {
    await prisma.download.deleteMany({ where: { userId, trackId } });
    return { success: true };
  }

  async isDownloaded(userId: string, trackId: string) {
    const dl = await prisma.download.findUnique({
      where: { userId_trackId: { userId, trackId } },
    });
    return dl?.status === 'complete';
  }
}

export const downloadService = new DownloadService();
