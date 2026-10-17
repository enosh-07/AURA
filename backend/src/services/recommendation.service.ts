/**
 * Recommendation Service
 *
 * Ranking pipeline:
 *   1. Candidate generation (tracks from catalog)
 *   2. Feature extraction (genre, mood, energy, bpm)
 *   3. Scoring (affinity from listening history)
 *   4. Diversity adjustment (avoid genre monoculture)
 *   5. Repetition penalty (reduce recently played tracks)
 *   6. Final ranking
 *
 * This is NOT random shuffle. Scores are computed from real listening data.
 */

import { prisma } from './prisma.js';
import { analyticsService } from './analytics.service.js';
import { onlineMusicService } from './onlineMusic.service.js';

export type MixType = 'discover' | 'favorites' | 'chill' | 'energy' | 'focus' | 'new';

const MIX_CONFIG: Record<MixType, {
  title: string;
  description: string;
  targetMoods: string[];
  targetGenres: string[];
  bpmRange?: [number, number];
  energyRange?: [number, number];
  preferRecent?: boolean;
  preferUnheard?: boolean;
  size: number;
}> = {
  discover: {
    title: 'Discover Mix',
    description: 'Fresh sounds picked just for you based on your taste',
    targetMoods: [],
    targetGenres: [],
    preferUnheard: true,
    size: 20,
  },
  favorites: {
    title: 'Favorites Mix',
    description: 'Your most-loved tracks, curated into a perfect session',
    targetMoods: [],
    targetGenres: [],
    size: 20,
  },
  chill: {
    title: 'Chill Mix',
    description: 'Low-tempo ambient sounds for unwinding',
    targetMoods: ['Chill', 'Focus', 'Sleep'],
    targetGenres: ['Lo-Fi', 'Ambient', 'Classical', 'Jazz'],
    bpmRange: [60, 100],
    energyRange: [0, 0.5],
    size: 15,
  },
  energy: {
    title: 'Energy Mix',
    description: 'High-tempo tracks to power your workout',
    targetMoods: ['Energy', 'Workout', 'Hype'],
    targetGenres: ['Electronic', 'Synthwave', 'Rock', 'Hip-Hop'],
    bpmRange: [120, 180],
    energyRange: [0.6, 1.0],
    size: 15,
  },
  focus: {
    title: 'Focus Mix',
    description: 'Instrumental and minimal tracks for deep work',
    targetMoods: ['Focus', 'Study'],
    targetGenres: ['Lo-Fi', 'Ambient', 'Classical'],
    bpmRange: [70, 100],
    energyRange: [0.1, 0.5],
    size: 15,
  },
  new: {
    title: 'New Music Mix',
    description: 'Fresh tracks added to AURA this week',
    targetMoods: [],
    targetGenres: [],
    preferRecent: true,
    preferUnheard: true,
    size: 20,
  },
};

export class RecommendationService {
  private memCache: Map<string, { data: any; expiresAt: number }> = new Map();

  // ============================================================
  // DAILY MIXES
  // ============================================================

  async getDailyMixes(userId: string, force = false) {
    const cacheKey = `daily-mixes:${userId}`;
    const cached = this.memCache.get(cacheKey);
    if (!force && cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    // Check DB for recent mixes (expires once per day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingMixes = await prisma.dailyMix.findMany({
      where: {
        userId,
        generatedAt: { gte: today },
      },
      orderBy: { mixType: 'asc' },
    });

    if (!force && existingMixes.length >= 4) {
      const formatted = await this.formatDailyMixes(existingMixes);
      this.setCache(cacheKey, formatted, 30 * 60 * 1000); // 30 min cache
      return formatted;
    }

    // Generate fresh mixes
    const mixes = await this.generateAllDailyMixes(userId);
    this.setCache(cacheKey, mixes, 30 * 60 * 1000);
    return mixes;
  }

  private async generateAllDailyMixes(userId: string) {
    const mixTypes: MixType[] = ['favorites', 'discover', 'chill', 'energy', 'focus', 'new'];
    const results = [];

    for (const mixType of mixTypes) {
      try {
        const tracks = await this.rankTracksForMix(userId, mixType);
        if (tracks.length === 0) continue;

        const config = MIX_CONFIG[mixType];
        const expiresAt = new Date();
        expiresAt.setHours(23, 59, 59, 999); // expires at end of day

        const mix = await prisma.dailyMix.upsert({
          where: { id: `${userId}-${mixType}-${new Date().toISOString().slice(0, 10)}` },
          update: {
            trackIdsJson: JSON.stringify(tracks.map((t) => t.id)),
            generatedAt: new Date(),
            expiresAt,
          },
          create: {
            id: `${userId}-${mixType}-${new Date().toISOString().slice(0, 10)}`,
            userId,
            mixType,
            title: config.title,
            description: config.description,
            trackIdsJson: JSON.stringify(tracks.map((t) => t.id)),
            expiresAt,
          },
        });

        results.push({
          ...mix,
          tracks: tracks.slice(0, config.size),
        });
      } catch (err) {
        console.warn(`Failed to generate ${mixType} mix:`, err);
      }
    }

    return results;
  }

  // ============================================================
  // RANKING PIPELINE
  // ============================================================

  private async rankTracksForMix(userId: string, mixType: MixType) {
    const config = MIX_CONFIG[mixType];

    // 1. Get all catalog tracks
    const allTracks = await prisma.track.findMany({
      orderBy: config.preferRecent ? { createdAt: 'desc' } : { playCount: 'desc' },
      take: 200,
    });

    // 2. Get user history for scoring
    const history = await prisma.listeningHistory.findMany({
      where: { userId },
      select: {
        trackId: true,
        completed: true,
        skipped: true,
        durationListened: true,
        timestamp: true,
      },
      orderBy: { timestamp: 'desc' },
      take: 500,
    });

    const likedTrackIds = new Set(
      (await prisma.userLikedTrack.findMany({ where: { userId }, select: { trackId: true } }))
        .map((l) => l.trackId)
    );

    // Build affinity map from history
    const affinityMap = this.buildAffinityMap(history, likedTrackIds);

    // 3. Score each track
    const scored = allTracks.map((track) => {
      let score = 0;

      // Affinity score (0–50)
      const affinity = affinityMap.get(track.id) || 0;

      // For favorites: boost heavily listened tracks
      if (mixType === 'favorites') {
        score += affinity * 50;
      } else if (mixType === 'discover') {
        // Penalize heard tracks, boost unheard
        score += affinity > 0 ? -20 : 30;
      } else {
        score += affinity * 20;
      }

      // Mood filter match (0–20)
      if (config.targetMoods.length > 0 && track.mood) {
        if (config.targetMoods.includes(track.mood)) score += 20;
      }

      // Genre filter match (0–20)
      if (config.targetGenres.length > 0) {
        if (config.targetGenres.includes(track.genre)) score += 20;
      }

      // BPM range match (0–10)
      if (config.bpmRange && track.bpm) {
        const [min, max] = config.bpmRange;
        if (track.bpm >= min && track.bpm <= max) score += 10;
      }

      // Energy range match (0–10)
      if (config.energyRange && track.energy != null) {
        const [min, max] = config.energyRange;
        if (track.energy >= min && track.energy <= max) score += 10;
      }

      // Recency bonus for 'new' mix
      if (config.preferRecent) {
        const daysOld = (Date.now() - track.createdAt.getTime()) / (1000 * 60 * 60 * 24);
        score += Math.max(0, 20 - daysOld);
      }

      // Popularity signal (0–5)
      score += Math.min(5, (track.playCount || 0) / 100);

      // 4. Repetition penalty: tracks heard in last 24h
      const recentlyPlayed = history.filter(
        (h) => h.trackId === track.id && h.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000)
      );
      if (recentlyPlayed.length > 0) score -= 15;

      // Penalize skipped tracks
      const skipped = history.filter((h) => h.trackId === track.id && h.skipped);
      score -= skipped.length * 10;

      return { ...track, _score: score };
    });

    // 5. Sort by score descending
    scored.sort((a, b) => b._score - a._score);

    // 6. Diversity adjustment — avoid >40% same genre
    return this.diversify(scored, config.size);
  }

  private buildAffinityMap(
    history: Array<{ trackId: string; completed: boolean; skipped: boolean; durationListened: number; timestamp: Date }>,
    likedIds: Set<string>
  ): Map<string, number> {
    const map = new Map<string, number>();

    for (const h of history) {
      const existing = map.get(h.trackId) || 0;
      let delta = 0;
      if (h.completed) delta += 1.0;
      else if (!h.skipped) delta += 0.5;
      else delta -= 0.3;
      map.set(h.trackId, existing + delta);
    }

    // Boost liked tracks
    for (const id of likedIds) {
      map.set(id, (map.get(id) || 0) + 2.0);
    }

    return map;
  }

  private diversify(tracks: any[], maxSize: number): any[] {
    const result: any[] = [];
    const genreCounts: Record<string, number> = {};
    const maxPerGenre = Math.ceil(maxSize * 0.4);

    for (const track of tracks) {
      if (result.length >= maxSize) break;
      const count = genreCounts[track.genre] || 0;
      if (count < maxPerGenre) {
        result.push(track);
        genreCounts[track.genre] = count + 1;
      }
    }

    // Fill remaining slots if needed
    if (result.length < maxSize) {
      for (const track of tracks) {
        if (result.length >= maxSize) break;
        if (!result.includes(track)) result.push(track);
      }
    }

    return result;
  }

  // ============================================================
  // DISCOVER & SIMILAR
  // ============================================================

  async getDiscoverMix(userId: string) {
    const cacheKey = `discover:${userId}`;
    const cached = this.memCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    const tracks = await this.rankTracksForMix(userId, 'discover');
    this.setCache(cacheKey, tracks, 60 * 60 * 1000); // 1hr cache
    return tracks;
  }

  async getSimilarTracks(trackId: string, limit = 10) {
    const cacheKey = `similar:${trackId}:${limit}`;
    const cached = this.memCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    const sourceTrack = await prisma.track.findUnique({ where: { id: trackId } });
    if (!sourceTrack) throw new Error('Track not found.');

    // Find tracks with same genre + similar mood, then sort by BPM proximity
    const candidates = await prisma.track.findMany({
      where: {
        id: { not: trackId },
        OR: [
          { genre: sourceTrack.genre },
          { mood: sourceTrack.mood || undefined },
        ],
      },
      take: 100,
    });

    const scored = candidates.map((t) => {
      let score = 0;
      if (t.genre === sourceTrack.genre) score += 30;
      if (t.mood === sourceTrack.mood) score += 20;
      if (t.bpm && sourceTrack.bpm) {
        const bpmDiff = Math.abs(t.bpm - sourceTrack.bpm);
        score += Math.max(0, 15 - bpmDiff);
      }
      if (t.energy != null && sourceTrack.energy != null) {
        const energyDiff = Math.abs(t.energy - sourceTrack.energy);
        score += Math.max(0, 10 - energyDiff * 10);
      }
      return { ...t, _score: score };
    });

    scored.sort((a, b) => b._score - a._score);
    const result = scored.slice(0, limit).map(({ _score, ...t }) => ({
      ...t,
      audioUrl: `/api/v1/tracks/${t.id}/stream`,
    }));

    this.setCache(cacheKey, result, 30 * 60 * 1000);
    return result;
  }

  // ============================================================
  // SMART TRANSITION METADATA
  // ============================================================

  async getTransitionMetadata(trackId: string) {
    const track = await prisma.track.findUnique({
      where: { id: trackId },
      select: {
        id: true,
        title: true,
        artist: true,
        bpm: true,
        energy: true,
        musicalKey: true,
        mood: true,
        genre: true,
        introDuration: true,
        outroDuration: true,
        duration: true,
      },
    });
    if (!track) throw new Error('Track not found.');

    // Find compatible next tracks
    const compatible = await this.getSimilarTracks(trackId, 5);

    return {
      track: {
        ...track,
        // Frontend uses these fields to calculate crossfade timing
        crossfadePoint: track.outroDuration
          ? track.duration - (track.outroDuration || 5)
          : track.duration - 8,
        recommendedCrossfadeDuration: this.recommendCrossfade(track.bpm),
      },
      compatibleNextTracks: compatible,
      transitionHints: {
        bpmMatch: compatible.map((t: any) => ({
          trackId: t.id,
          bpmDelta: track.bpm && t.bpm ? Math.abs(track.bpm - t.bpm) : null,
          keyCompatible: this.checkKeyCompatibility(track.musicalKey, t.musicalKey),
        })),
      },
    };
  }

  private recommendCrossfade(bpm: number | null | undefined): number {
    if (!bpm) return 4;
    // At 120 BPM: beat = 0.5s → use 2 beats = 1s, scale to 4s default
    const beatMs = (60 / bpm) * 1000;
    const beats = 4;
    return Math.min(8, Math.max(2, (beatMs * beats) / 1000));
  }

  private checkKeyCompatibility(keyA: string | null | undefined, keyB: string | null | undefined): boolean {
    if (!keyA || !keyB) return false;
    if (keyA === keyB) return true;

    // Camelot Wheel harmonic mixing rules
    const matchA = keyA.match(/^(\d{1,2})([AB])$/i);
    const matchB = keyB.match(/^(\d{1,2})([AB])$/i);

    if (matchA && matchB) {
      const numA = parseInt(matchA[1], 10);
      const letterA = matchA[2].toUpperCase();
      const numB = parseInt(matchB[1], 10);
      const letterB = matchB[2].toUpperCase();

      // Rule 1: Relative major/minor switch (e.g. 8A <-> 8B)
      if (numA === numB) return true;

      // Rule 2: Adjacent keys on Camelot wheel (circular modulo 12: 12 <-> 1)
      if (letterA === letterB) {
        const diff = Math.abs(numA - numB);
        if (diff === 1 || diff === 11) return true;
      }
    }

    return false;
  }

  // ============================================================
  // PERSONALIZED HOME DASHBOARD PIPELINE
  // ============================================================

  /**
   * Generates a fully personalized Home feed based on genuine listening history.
   * If user has no history or is anonymous, returns authentic provider-backed discovery
   * without fabricated plays or mock songs.
   */
  async getPersonalizedHome(userId?: string) {
    if (userId) {
      const recentTracks = await analyticsService.getRecentlyPlayed(userId, 10);
      const hasHistory = recentTracks.length > 0;

      if (hasHistory) {
        const [dailyMixes, discoverTracks, favoriteTracks, topArtists] = await Promise.all([
          this.getDailyMixes(userId).catch(() => []),
          this.getDiscoverMix(userId).catch(() => []),
          this.rankTracksForMix(userId, 'favorites').catch(() => []),
          analyticsService.getTopArtists(userId, 30).catch(() => []),
        ]);

        // Find seed track for "Because you listened to..."
        let becauseYouListenedTo: any = null;
        if (recentTracks.length > 0) {
          const seedTrack = recentTracks[0];
          try {
            const similar = await this.getSimilarTracks(seedTrack.id, 6);
            if (similar.length > 0) {
              becauseYouListenedTo = {
                seedTrack: {
                  id: seedTrack.id,
                  title: seedTrack.title,
                  artist: seedTrack.artist,
                  genre: seedTrack.genre,
                  bpm: seedTrack.bpm,
                  artwork: seedTrack.artworkUrl || seedTrack.artwork,
                },
                reason: `Inspired by your recent listening to "${seedTrack.title}" (${seedTrack.genre || 'Music'}${seedTrack.bpm ? ` • ${seedTrack.bpm} BPM` : ''})`,
                tracks: similar,
              };
            }
          } catch (_) {}
        }

        const madeForYou = favoriteTracks.length > 0 ? favoriteTracks.slice(0, 10) : recentTracks;

        return {
          isNewUser: false,
          madeForYou,
          recentlyPlayed: recentTracks,
          dailyMixes,
          becauseYouListenedTo,
          discoverNew: discoverTracks.slice(0, 8),
          topArtists,
          favoriteSounds: favoriteTracks.slice(0, 8),
        };
      }
    }

    // New User / Anonymous First-Listen Discovery Experience
    // Legitimate provider-backed trending + genre starter cards, NO fake history
    const trending = await onlineMusicService.getTrending('All', 20).catch(() => []);
    const localCatalog = await prisma.track.findMany({
      take: 12,
      orderBy: { playCount: 'desc' },
      include: { variants: true },
    });

    const formattedCatalog = localCatalog.map((t) => ({
      ...t,
      audioUrl: `/api/v1/tracks/${t.id}/stream`,
    }));

    return {
      isNewUser: true,
      madeForYou: trending.slice(0, 10),
      recentlyPlayed: [],
      dailyMixes: [],
      becauseYouListenedTo: null,
      discoverNew: trending.slice(10, 20),
      topArtists: [],
      favoriteSounds: formattedCatalog,
      trending,
      curatedMixes: [
        {
          id: 'mix-chill',
          title: 'Deep Ambient & Lo-Fi',
          subtitle: 'Sub-bass drones & calm rhythms for unwinding',
          genre: 'Lo-Fi',
          artwork: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=600&auto=format&fit=crop&q=80',
          query: 'lofi chill ambient study beats',
        },
        {
          id: 'mix-energy',
          title: 'Synthwave & High Octane',
          subtitle: 'High-tempo driving frequencies',
          genre: 'Synthwave',
          artwork: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&auto=format&fit=crop&q=80',
          query: 'synthwave cyberpunk retro electro',
        },
        {
          id: 'mix-hits',
          title: 'Global & Regional Anthems',
          subtitle: 'Top charts & cinematic soundtracks',
          genre: 'Soundtrack',
          artwork: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80',
          query: 'anirudh rahman weeknd hits',
        },
        {
          id: 'mix-focus',
          title: 'Quantum Equilibrium',
          subtitle: 'Instrumental precision for deep work',
          genre: 'Focus',
          artwork: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=600&auto=format&fit=crop&q=80',
          query: 'peaceful acoustic instrumental piano',
        },
      ],
      welcomeBanner: {
        title: 'Welcome to AURA',
        subtitle: 'Start listening or upload your lossless collection to generate your personalized Daily Mixes.',
        hasStartedListening: false,
      },
    };
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private setCache(key: string, data: any, ttlMs: number) {
    this.memCache.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  private async formatDailyMixes(mixes: any[]) {
    const trackIds = mixes.flatMap((m) => JSON.parse(m.trackIdsJson || '[]'));
    const uniqueIds = [...new Set(trackIds)];

    const tracks = await prisma.track.findMany({ where: { id: { in: uniqueIds } } });
    const trackMap = new Map(tracks.map((t) => [t.id, { ...t, audioUrl: `/api/v1/tracks/${t.id}/stream` }]));

    return mixes.map((mix) => ({
      ...mix,
      tracks: JSON.parse(mix.trackIdsJson || '[]')
        .map((id: string) => trackMap.get(id))
        .filter(Boolean),
    }));
  }
}

export const recommendationService = new RecommendationService();
