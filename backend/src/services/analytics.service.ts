import { prisma } from './prisma.js';

export class AnalyticsService {
  // ============================================================
  // EVENTS
  // ============================================================

  async logPlayback(
    userId: string,
    data: {
      trackId: string;
      durationListened: number;
      completed?: boolean;
      skipped?: boolean;
      skipPositionSec?: number;
      deviceId?: string;
      qualityTier?: string;
      sessionId?: string;
    }
  ) {
    const record = await prisma.listeningHistory.create({
      data: {
        userId,
        trackId: data.trackId,
        durationListened: Math.round(data.durationListened),
        completed: data.completed ?? false,
        skipped: data.skipped ?? false,
        skipPositionSec: data.skipPositionSec,
        deviceId: data.deviceId,
        qualityTier: data.qualityTier,
        sessionId: data.sessionId,
      },
    });

    if (!data.skipped) {
      await prisma.track.update({
        where: { id: data.trackId },
        data: { playCount: { increment: 1 } },
      });
    }

    return record;
  }

  async logSkip(userId: string, data: { trackId: string; positionSec: number; sessionId?: string }) {
    return this.logPlayback(userId, {
      trackId: data.trackId,
      durationListened: Math.round(data.positionSec),
      completed: false,
      skipped: true,
      skipPositionSec: data.positionSec,
      sessionId: data.sessionId,
    });
  }

  // ============================================================
  // INSIGHTS (aggregation-based — no full table scans)
  // ============================================================

  async getInsights(userId: string) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Total listening time (30 days) — aggregate
    const totalSecondsAgg = await prisma.listeningHistory.aggregate({
      where: { userId, timestamp: { gte: thirtyDaysAgo } },
      _sum: { durationListened: true },
      _count: { id: true },
    });
    const totalMinutes = Math.round((totalSecondsAgg._sum.durationListened || 0) / 60);

    // Top genres — group by (SQLite workaround: fetch recent with join)
    const genreHistory = await prisma.listeningHistory.findMany({
      where: { userId, timestamp: { gte: thirtyDaysAgo }, skipped: false },
      include: { track: { select: { genre: true } } },
      orderBy: { timestamp: 'desc' },
      take: 300,
    });

    const genreCounts: Record<string, number> = {};
    const totalPlays = genreHistory.length || 1;
    for (const h of genreHistory) {
      const g = h.track.genre || 'Other';
      genreCounts[g] = (genreCounts[g] || 0) + 1;
    }
    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([genre, count]) => ({
        genre,
        playCount: count,
        percentage: Math.round((count / totalPlays) * 100),
      }));

    // Top tracks — group by trackId
    const trackHistory = await prisma.listeningHistory.findMany({
      where: { userId, timestamp: { gte: thirtyDaysAgo }, skipped: false },
      include: { track: { select: { id: true, title: true, artist: true, artworkUrl: true } } },
      orderBy: { timestamp: 'desc' },
      take: 300,
    });
    const trackCounts: Record<string, { count: number; track: any }> = {};
    for (const h of trackHistory) {
      if (!trackCounts[h.trackId]) trackCounts[h.trackId] = { count: 0, track: h.track };
      trackCounts[h.trackId].count++;
    }
    const topTracks = Object.values(trackCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(({ track, count }) => ({
        trackId: track.id,
        title: track.title,
        artist: track.artist,
        artworkUrl: track.artworkUrl,
        playCount: count,
      }));

    // Daily activity — last 7 days
    const dailyHistory = await prisma.listeningHistory.findMany({
      where: { userId, timestamp: { gte: sevenDaysAgo } },
      select: { durationListened: true, timestamp: true },
    });
    const dailyMap: Record<string, number> = {};
    for (const h of dailyHistory) {
      const key = h.timestamp.toISOString().slice(0, 10);
      dailyMap[key] = (dailyMap[key] || 0) + Math.round(h.durationListened / 60);
    }
    const dailyActivity: { date: string; minutes: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dailyActivity.push({ date: key, minutes: dailyMap[key] || 0 });
    }

    // Streak
    let streak = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      if (dailyMap[key]) streak++;
      else break;
    }

    return {
      totalMinutes,
      listeningStreakDays: streak,
      diversityIndex: topGenres.length > 0 ? Math.min(1, topGenres.length / 5) : 0,
      topGenres,
      dailyActivity,
      topTracks,
    };
  }

  async getTopArtists(userId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const history = await prisma.listeningHistory.findMany({
      where: { userId, timestamp: { gte: since }, skipped: false },
      include: { track: { select: { artist: true, artworkUrl: true } } },
      take: 500,
    });

    const artistCounts: Record<string, { count: number; artworkUrl: string }> = {};
    for (const h of history) {
      const a = h.track.artist;
      if (!artistCounts[a]) artistCounts[a] = { count: 0, artworkUrl: h.track.artworkUrl };
      artistCounts[a].count++;
    }

    return Object.entries(artistCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([artist, { count, artworkUrl }]) => ({ artist, playCount: count, artworkUrl }));
  }

  async getTrends(userId: string) {
    const now = new Date();
    const periods = [7, 14, 30, 60].map((days) => {
      const since = new Date(now);
      since.setDate(since.getDate() - days);
      return { days, since };
    });

    const results: any = {};
    for (const { days, since } of periods) {
      const agg = await prisma.listeningHistory.aggregate({
        where: { userId, timestamp: { gte: since } },
        _sum: { durationListened: true },
        _count: { id: true },
      });
      results[`${days}d`] = {
        totalMinutes: Math.round((agg._sum.durationListened || 0) / 60),
        playCount: agg._count.id,
      };
    }
    return results;
  }

  async getListeningTime(userId: string, granularity: 'day' | 'week' = 'day', days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const history = await prisma.listeningHistory.findMany({
      where: { userId, timestamp: { gte: since } },
      select: { durationListened: true, timestamp: true },
      orderBy: { timestamp: 'asc' },
    });

    const buckets: Record<string, number> = {};
    for (const h of history) {
      let key: string;
      if (granularity === 'week') {
        const d = new Date(h.timestamp);
        d.setDate(d.getDate() - d.getDay());
        key = d.toISOString().slice(0, 10);
      } else {
        key = h.timestamp.toISOString().slice(0, 10);
      }
      buckets[key] = (buckets[key] || 0) + Math.round(h.durationListened / 60);
    }

    return Object.entries(buckets).map(([date, minutes]) => ({ date, minutes }));
  }
}

export const analyticsService = new AnalyticsService();
