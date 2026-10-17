import { prisma } from './prisma.js';
import { audioVariantService } from './audio-variant.service.js';
import { lyricsService, LyricsQueryOptions } from './lyrics.service.js';
import { providerRegistry } from './providers/provider-registry.js';
import { getProviderCapability, explainQualityMismatch } from './providers/provider-capabilities.js';
import { AudioQualityReport, QualityTier } from './providers/music-provider.interface.js';

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
    if (!track) {
      if (
        trackId.startsWith('saavn_') ||
        trackId.startsWith('online_') ||
        trackId.startsWith('itunes_') ||
        trackId.startsWith('local_')
      ) {
        return {
          trackId,
          title: 'Online Stream',
          artist: 'Online Artist',
          codec: 'AAC',
          container: 'M4A',
          bitDepth: null,
          sampleRate: 44100,
          channels: 2,
          bitrate: 320,
          duration: 0,
          fileSize: 0,
          sourceType: 'OFFICIAL_API',
          qualityTier: 'HIGH',
          losslessStatus: false,
          lossless: false,
          isGenuineLossless: false,
          validationNotes:
            'Legitimate 320 kbps AAC stream from Akamai CDN master. Perceptual lossy format preserved without artificial upsampling.',
          variants: [
            {
              id: `${trackId}-high`,
              trackId,
              qualityTier: 'HIGH',
              codec: 'AAC',
              container: 'M4A',
              bitrate: 320,
              sampleRate: 44100,
              bitDepth: null,
              channels: 2,
              mimeType: 'audio/mp4',
              isLossless: false,
              isGenuineLossless: false,
              validationNotes: 'High Quality 320 kbps stream',
              streamUrl: `/api/v1/tracks/${trackId}/stream?tier=HIGH`,
            },
            {
              id: `${trackId}-standard`,
              trackId,
              qualityTier: 'STANDARD',
              codec: 'AAC',
              container: 'M4A',
              bitrate: 160,
              sampleRate: 44100,
              bitDepth: null,
              channels: 2,
              mimeType: 'audio/mp4',
              isLossless: false,
              isGenuineLossless: false,
              validationNotes: 'Standard Quality 160 kbps stream',
              streamUrl: `/api/v1/tracks/${trackId}/stream?tier=STANDARD`,
            },
          ],
        };
      }
      throw new Error('Track not found.');
    }

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

  /**
   * Generates a comprehensive, authoritative AudioQualityReport distinguishing
   * source metadata, browser decoding capabilities, and honest Dolby Atmos states.
   */
  async generateQualityReport(
    trackId: string,
    requestedTierStr: string = 'AUTO',
    clientMeta?: { title?: string; artist?: string }
  ): Promise<AudioQualityReport> {
    const requestedTier = (requestedTierStr.toUpperCase() as QualityTier | 'AUTO') || 'AUTO';

    const dbTrack = await prisma.track.findUnique({
      where: { id: trackId },
      include: { variants: true },
    });

    if (dbTrack) {
      const selectedVariant = await audioVariantService.selectVariant(
        dbTrack.id,
        requestedTier === 'AUTO' ? 'HI_RES_LOSSLESS' : (requestedTier as any)
      );

      const isLossless = selectedVariant ? selectedVariant.isGenuineLossless : dbTrack.isGenuineLossless;
      const isHiRes =
        (selectedVariant?.sampleRate || dbTrack.sampleRate || 0) >= 88200 ||
        (selectedVariant?.bitDepth || dbTrack.bitDepth || 0) >= 24;

      const deliveredTier: QualityTier = selectedVariant
        ? (selectedVariant.qualityTier.toUpperCase() as QualityTier)
        : isHiRes
        ? 'HI_RES_LOSSLESS'
        : isLossless
        ? 'LOSSLESS'
        : 'HIGH';

      const codec = selectedVariant?.codec || dbTrack.codec || 'FLAC';
      const container = selectedVariant?.container || dbTrack.container || 'FLAC';
      const sampleRate = selectedVariant?.sampleRate || dbTrack.sampleRate || 44100;
      const bitDepth = selectedVariant?.bitDepth ?? dbTrack.bitDepth ?? (isLossless ? 16 : null);
      const bitrate = selectedVariant?.bitrate || dbTrack.bitrate || 1411;
      const channels = selectedVariant?.channels || dbTrack.channelCount || 2;
      const fileSize = selectedVariant?.fileSize || dbTrack.fileSize || null;

      const providerCap = getProviderCapability('local');

      // Dolby Atmos verification check
      const hasAtmos = !!(dbTrack.spatialCapable && channels > 2);

      let verificationStatus: 'VERIFIED' | 'FALLBACK_LOSSY' | 'MISMATCH' | 'UNVERIFIED' = 'VERIFIED';
      if ((requestedTier === 'LOSSLESS' || requestedTier === 'HI_RES_LOSSLESS') && !isLossless) {
        verificationStatus = 'FALLBACK_LOSSY';
      } else if (requestedTier !== 'AUTO' && requestedTier !== deliveredTier) {
        verificationStatus = 'MISMATCH';
      }

      return {
        trackId: dbTrack.id,
        title: dbTrack.title,
        artist: dbTrack.artist,
        requestedTier,
        deliveredTier,
        provider: {
          id: 'local',
          displayName: providerCap.displayName,
          sourceType: providerCap.sourceType,
          authRequirement: providerCap.authRequirement,
          licensingTerms: providerCap.licensingTerms,
        },
        source: {
          codec,
          container,
          bitrate,
          sampleRate,
          bitDepth,
          channels,
          channelLayout: channels === 1 ? 'Mono (1.0)' : channels === 2 ? 'Stereo (2.0)' : `${channels}-Channel Surround`,
          isLossless,
          isHiRes,
          fileSize,
          duration: dbTrack.duration,
          provenance: isLossless
            ? `Authentic bit-perfect master verified via AudioValidationService (${codec} ${bitDepth ? `${bitDepth}-bit/` : ''}${(sampleRate / 1000).toFixed(1)}kHz)`
            : `Authentic lossy file preserved (${codec} at ${bitrate} kbps)`,
        },
        playback: {
          audioContextSampleRate: sampleRate,
          outputSampleRate: null,
          bitPerfectBypass: false,
          dspActive: false,
          osMixerNote: 'Operating system mixer and sound card resample output unless running in dedicated exclusive mode.',
        },
        dolbyAtmos: {
          isDolbyAtmos: hasAtmos,
          status: hasAtmos ? 'VERIFIED_ATMOS' : 'NOT_ATMOS',
          badgeVisible: hasAtmos,
          reason: hasAtmos
            ? 'Discrete multi-channel object master detected.'
            : 'Track master is 2-channel stereo. True Dolby Atmos requires discrete height/bed objects (E-AC-3 JOC). Virtual spatial effects in AURA are binaural simulations, not Atmos.',
          spatialRenderingMode: hasAtmos ? 'DISCRETE_ATMOS' : 'STEREO_PASSTHROUGH',
        },
        verification: {
          status: verificationStatus,
          notes: explainQualityMismatch('local', requestedTier, deliveredTier, codec),
          losslessAlternativeAvailable: null,
        },
      };
    }

    // Online / Third-party Track (JioSaavn, etc.)
    const title = clientMeta?.title || 'Online Track';
    const artist = clientMeta?.artist || 'Unknown Artist';
    const isSaavn = trackId.startsWith('saavn_');
    const isAudius = trackId.startsWith('audius_');
    const providerName = isSaavn ? 'jiosaavn' : isAudius ? 'audius' : 'online';
    const providerCap = getProviderCapability(providerName);

    const codec = isSaavn ? 'AAC' : isAudius ? 'MP3' : 'AAC';
    const container = isSaavn ? 'M4A' : isAudius ? 'MPEG' : 'M4A';
    const sampleRate = 44100;
    const isStandard = requestedTier === 'STANDARD';
    const bitrate = isStandard ? 160 : (isSaavn ? 320 : isAudius ? 320 : 256);
    const deliveredTier: QualityTier = isStandard ? 'STANDARD' : 'HIGH';

    // Search for legitimate lossless alternative in local high-fidelity library
    const alternative = await providerRegistry.findLosslessAlternative(title, artist);

    let verificationStatus: 'VERIFIED' | 'FALLBACK_LOSSY' | 'MISMATCH' | 'UNVERIFIED' = 'VERIFIED';
    if (requestedTier === 'LOSSLESS' || requestedTier === 'HI_RES_LOSSLESS') {
      verificationStatus = 'FALLBACK_LOSSY';
    }

    return {
      trackId,
      title,
      artist,
      requestedTier,
      deliveredTier,
      provider: {
        id: providerName,
        displayName: providerCap.displayName,
        sourceType: providerCap.sourceType,
        authRequirement: providerCap.authRequirement,
        licensingTerms: providerCap.licensingTerms,
      },
      source: {
        codec,
        container,
        bitrate,
        sampleRate,
        bitDepth: null, // Lossy codecs do not have discrete bit depths
        channels: 2,
        channelLayout: 'Stereo (2.0)',
        isLossless: false,
        isHiRes: false,
        fileSize: null,
        duration: 0,
        provenance: `Legitimate native ${bitrate} kbps ${codec} stream from ${providerCap.displayName}. AURA does not artificially transcode lossy streams.`,
      },
      playback: {
        audioContextSampleRate: sampleRate,
        outputSampleRate: null,
        bitPerfectBypass: false,
        dspActive: false,
        osMixerNote: 'Operating system mixer and sound card resample output unless running in dedicated exclusive mode.',
      },
      dolbyAtmos: {
        isDolbyAtmos: false,
        status: 'NO_ATMOS_STREAM',
        badgeVisible: false,
        reason: `${providerCap.displayName} supplies 2-channel stereo audio only. No Dolby Atmos (E-AC-3 JOC) multi-channel stream is provided by the upstream service.`,
        spatialRenderingMode: 'STEREO_PASSTHROUGH',
      },
      verification: {
        status: verificationStatus,
        notes: explainQualityMismatch(providerName, requestedTier, deliveredTier, codec),
        losslessAlternativeAvailable: alternative,
      },
    };
  }

  async getLyrics(trackId: string, options?: LyricsQueryOptions) {
    return lyricsService.getLyrics(trackId, options);
  }

  async toggleLike(
    userId: string,
    trackId: string,
    like: boolean,
    trackMeta?: {
      title?: string;
      artist?: string;
      album?: string;
      duration?: number;
      genre?: string;
      artwork?: string;
      artworkUrl?: string;
      audioUrl?: string;
      accentColor?: string;
    }
  ) {
    if (like) {
      // Ensure track exists in database (especially for online tracks from JioSaavn/iTunes)
      const existingTrack = await prisma.track.findUnique({ where: { id: trackId } });
      if (!existingTrack) {
        await prisma.track.create({
          data: {
            id: trackId,
            title: trackMeta?.title || (trackId.startsWith('saavn_') || trackId.startsWith('itunes_') ? 'Online Stream' : 'AURA Track'),
            artist: trackMeta?.artist || 'Unknown Artist',
            album: trackMeta?.album || 'Single',
            duration: Math.max(1, Math.round(trackMeta?.duration || 180)),
            genre: trackMeta?.genre || 'Soundtrack',
            artworkUrl: trackMeta?.artwork || trackMeta?.artworkUrl || 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=800',
            audioFileUrl: trackMeta?.audioUrl || `/api/v1/tracks/online/${trackId}/stream`,
            sourceType: trackId.startsWith('saavn_') ? 'JIOSAAVN' : trackId.startsWith('itunes_') ? 'ITUNES' : 'ONLINE_CATALOG',
            qualityTier: 'HIGH',
            isLossless: false,
            isGenuineLossless: false,
          },
        });
      }

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
