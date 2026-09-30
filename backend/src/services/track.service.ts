import { prisma } from './prisma.js';
import { audioVariantService } from './audio-variant.service.js';

export interface GetTracksQuery {
  q?: string;
  genre?: string;
  mood?: string;
  page?: number;
  limit?: number;
  sort?: string;
}

export class TrackService {
  async getTracks(query: GetTracksQuery, userId?: string) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (query.genre && query.genre !== 'All') {
      where.genre = { equals: query.genre };
    }

    if (query.mood) {
      where.mood = { equals: query.mood };
    }

    if (query.q) {
      const q = query.q.trim();
      where.OR = [
        { title: { contains: q } },
        { artist: { contains: q } },
        { album: { contains: q } },
        { genre: { contains: q } },
      ];
    }

    const [tracks, total] = await Promise.all([
      prisma.track.findMany({
        where,
        skip,
        take: limit,
        include: { variants: true },
        orderBy: query.sort === 'popular' ? { playCount: 'desc' } : { createdAt: 'desc' },
      }),
      prisma.track.count({ where }),
    ]);

    let userLikes: string[] = [];
    if (userId) {
      const likes = await prisma.userLikedTrack.findMany({
        where: { userId },
        select: { trackId: true },
      });
      userLikes = likes.map((l) => l.trackId);
    }

    const formattedTracks = tracks.map((t) => ({
      ...t,
      audioUrl: `/api/v1/tracks/${t.id}/stream`,
      isLiked: userLikes.includes(t.id),
      qualityTier: (t.qualityTier || 'STANDARD').toUpperCase(),
      lossless: t.isGenuineLossless ?? false,
      variants: t.variants.map((v) => audioVariantService.formatVariant(v)),
    }));

    return {
      tracks: formattedTracks,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getTrackById(id: string, userId?: string) {
    const track = await prisma.track.findUnique({
      where: { id },
      include: { variants: true },
    });
    if (!track) throw new Error('Track not found.');

    let isLiked = false;
    if (userId) {
      const like = await prisma.userLikedTrack.findUnique({
        where: { userId_trackId: { userId, trackId: id } },
      });
      isLiked = !!like;
    }

    return {
      ...track,
      audioUrl: `/api/v1/tracks/${track.id}/stream`,
      isLiked,
      qualityTier: (track.qualityTier || 'STANDARD').toUpperCase(),
      lossless: track.isGenuineLossless ?? false,
      variants: track.variants.map((v) => audioVariantService.formatVariant(v)),
    };
  }

  async getQualityInfo(trackId: string) {
    const track = await prisma.track.findUnique({
      where: { id: trackId },
      include: { variants: true },
    });
    if (!track) throw new Error('Track not found.');

    let validationNotes = track.isGenuineLossless
      ? `GENUINE ${track.qualityTier}: ${track.codec} ${track.bitDepth}-bit / ${((track.sampleRate || 44100) / 1000).toFixed(1)} kHz`
      : `Lossy audio source preserved (${track.codec} at ${track.bitrate} kbps)`;

    if (track.validationReport) {
      try {
        const parsed = JSON.parse(track.validationReport);
        if (parsed.validationNotes) validationNotes = parsed.validationNotes;
      } catch (_) {}
    }

    return {
      trackId: track.id,
      title: track.title,
      artist: track.artist,
      codec: track.codec || 'PCM',
      container: track.container || 'WAVE',
      bitDepth: track.bitDepth || 16,
      sampleRate: track.sampleRate || 44100,
      channels: track.channelCount || 2,
      bitrate: track.bitrate || 1411,
      duration: track.duration,
      fileSize: track.fileSize || 0,
      sourceType: track.sourceType || 'USER_UPLOAD',
      qualityTier: (track.qualityTier || 'STANDARD').toUpperCase(),
      losslessStatus: track.losslessStatus ?? false,
      lossless: track.isGenuineLossless ?? false,
      isGenuineLossless: track.isGenuineLossless ?? false,
      validationNotes,
      variants: track.variants.map((v) => audioVariantService.formatVariant(v)),
    };
  }

  async getLyrics(trackId: string) {
    const track = await prisma.track.findUnique({
      where: { id: trackId },
      select: { id: true, lyricsLrc: true, plainLyrics: true },
    });
    if (!track) throw new Error('Track not found.');

    const lines: { time: number; text: string }[] = [];
    if (track.lyricsLrc) {
      const rawLines = track.lyricsLrc.split('\n');
      for (const line of rawLines) {
        const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
        if (match) {
          const minutes = parseInt(match[1], 10);
          const seconds = parseInt(match[2], 10);
          const millis = parseInt(match[3].padEnd(3, '0').slice(0, 3), 10);
          const totalSeconds = minutes * 60 + seconds + millis / 1000;
          lines.push({ time: totalSeconds, text: match[4].trim() });
        }
      }
    }

    return {
      trackId: track.id,
      hasSync: lines.length > 0,
      format: lines.length > 0 ? 'lrc' : 'plain',
      lines,
      plainLyrics: track.plainLyrics || undefined,
    };
  }

  async toggleLike(userId: string, trackId: string, like: boolean) {
    if (like) {
      await prisma.userLikedTrack.upsert({
        where: { userId_trackId: { userId, trackId } },
        update: {},
        create: { userId, trackId },
      });
      return { trackId, isLiked: true };
    } else {
      await prisma.userLikedTrack.deleteMany({
        where: { userId, trackId },
      });
      return { trackId, isLiked: false };
    }
  }

  async getLikedTrackIds(userId: string) {
    const likes = await prisma.userLikedTrack.findMany({
      where: { userId },
      select: { trackId: true },
    });
    return likes.map((l) => l.trackId);
  }

  async createTrack(data: {
    title: string;
    artist: string;
    album?: string;
    duration: number;
    genre?: string;
    year?: number;
    bpm?: number;
    mood?: string;
    accentColor?: string;
    artworkUrl?: string;
    audioFileUrl: string;
    lyricsLrc?: string;
    plainLyrics?: string;
    codec?: string;
    container?: string;
    bitDepth?: number;
    sampleRate?: number;
    channelCount?: number;
    bitrate?: number;
    fileSize?: number;
    sourceType?: string;
    qualityTier?: string;
    losslessStatus?: boolean;
    isLossless?: boolean;
    isGenuineLossless?: boolean;
    validationReport?: string;
  }) {
    const track = await prisma.track.create({
      data: {
        title: data.title,
        artist: data.artist || 'Unknown Artist',
        album: data.album || 'Single',
        duration: Math.max(1, Math.round(data.duration) || 180),
        genre: data.genre || 'Electronic',
        year: data.year || new Date().getFullYear(),
        bpm: data.bpm,
        mood: data.mood || 'Chill',
        accentColor: data.accentColor || '#00f2fe',
        artworkUrl:
          data.artworkUrl ||
          'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
        audioFileUrl: data.audioFileUrl,
        lyricsLrc: data.lyricsLrc,
        plainLyrics: data.plainLyrics,
        codec: data.codec,
        container: data.container,
        bitDepth: data.bitDepth,
        sampleRate: data.sampleRate,
        channelCount: data.channelCount,
        bitrate: data.bitrate,
        fileSize: data.fileSize,
        sourceType: data.sourceType || 'USER_UPLOAD',
        qualityTier: (data.qualityTier || 'STANDARD').toUpperCase(),
        losslessStatus: data.losslessStatus ?? false,
        isLossless: data.isLossless ?? false,
        isGenuineLossless: data.isGenuineLossless ?? false,
        validationReport: data.validationReport,
      },
    });

    return {
      ...track,
      audioUrl: `/api/v1/tracks/${track.id}/stream`,
      isLiked: false,
    };
  }

  async searchAll(query: string) {
    const q = query?.trim() || '';
    if (!q) {
      return { tracks: [], playlists: [], artists: [] };
    }

    const [tracks, playlists] = await Promise.all([
      prisma.track.findMany({
        where: {
          OR: [
            { title: { contains: q } },
            { artist: { contains: q } },
            { album: { contains: q } },
            { genre: { contains: q } },
          ],
        },
        take: 20,
      }),
      prisma.playlist.findMany({
        where: {
          OR: [
            { title: { contains: q } },
            { description: { contains: q } },
          ],
        },
        include: {
          tracks: { include: { track: true } },
        },
        take: 10,
      }),
    ]);

    const artistSet = new Set<string>();
    tracks.forEach((t) => artistSet.add(t.artist));
    const artists = Array.from(artistSet).map((name) => ({
      id: `art-${encodeURIComponent(name)}`,
      name,
      avatar: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&auto=format&fit=crop&q=80',
    }));

    return {
      tracks: tracks.map((t) => ({
        ...t,
        audioUrl: `/api/v1/tracks/${t.id}/stream`,
      })),
      playlists: playlists.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        coverUrl: p.coverUrl,
        trackCount: p.tracks.length,
      })),
      artists,
    };
  }
}

export const trackService = new TrackService();
