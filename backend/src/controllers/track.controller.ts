import { Request, Response, NextFunction } from 'express';
import { trackService } from '../services/track.service.js';
import { streamService } from '../services/stream.service.js';
import { onlineMusicService } from '../services/onlineMusic.service.js';
import { audioValidationService } from '../services/audioValidation.service.js';
import { audioVariantService } from '../services/audio-variant.service.js';
import { streamSecurityService } from '../services/stream-security.service.js';
import { audioProfileService } from '../services/intelligence/index.js';
import { AuthRequest } from '../middleware/auth.middleware.js';

export const getTracks = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await trackService.getTracks(req.query, req.user?.id);
    res.status(200).json({
      success: true,
      data: result.tracks,
      meta: result.meta,
    });
  } catch (err) {
    next(err);
  }
};

export const getTrackById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const track = await trackService.getTrackById(req.params.id as string, req.user?.id);
    res.status(200).json({ success: true, data: track });
  } catch (err) {
    next(err);
  }
};

export const streamTrack = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await streamService.streamTrack(req, res, req.params.id as string);
  } catch (err) {
    next(err);
  }
};

export const getLyrics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, artist, album, duration } = req.query;
    const lyrics = await trackService.getLyrics(req.params.id as string, {
      title: title as string | undefined,
      artist: artist as string | undefined,
      album: album as string | undefined,
      duration: duration ? Number(duration) : undefined,
    });
    res.status(200).json({ success: true, data: lyrics });
  } catch (err) {
    next(err);
  }
};

export const likeTrack = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await trackService.toggleLike(req.user!.id, req.params.id as string, true, req.body);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

export const unlikeTrack = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await trackService.toggleLike(req.user!.id, req.params.id as string, false);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

export const getLikedTrackIds = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const trackIds = await trackService.getLikedTrackIds(req.user!.id);
    res.status(200).json({ success: true, data: trackIds });
  } catch (err) {
    next(err);
  }
};

export const uploadTrack = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: { message: 'No audio file provided' } });
      return;
    }

    const {
      title,
      artist,
      album,
      duration,
      genre,
      year,
      bpm,
      mood,
      accentColor,
      artworkUrl,
      lyricsLrc,
      plainLyrics,
    } = req.body || {};

    // Lossless Audio System Validation
    const validation = await audioValidationService.validateAudioFile(
      req.file.path,
      req.file.originalname,
      'USER_UPLOAD'
    );

    const newTrack = await trackService.createTrack({
      title: title || req.file.originalname.replace(/\.[^/.]+$/, ''),
      artist: artist || 'Unknown Artist',
      album: album || 'Local Studio Uploads',
      duration: validation.duration || Number(duration) || 180,
      genre: genre || 'Electronic',
      year: Number(year) || new Date().getFullYear(),
      bpm: bpm ? Number(bpm) : undefined,
      mood: mood || 'Energy',
      accentColor: accentColor || '#f3c5a6',
      artworkUrl: artworkUrl,
      audioFileUrl: req.file.filename,
      lyricsLrc,
      plainLyrics,
      codec: validation.codec,
      container: validation.container,
      bitDepth: validation.bitDepth,
      sampleRate: validation.sampleRate,
      channelCount: validation.channels,
      bitrate: validation.bitrate,
      fileSize: validation.fileSize,
      sourceType: validation.sourceType,
      qualityTier: validation.qualityTier,
      losslessStatus: validation.losslessStatus,
      isLossless: validation.isLossless,
      isGenuineLossless: validation.isGenuineLossless,
      validationReport: JSON.stringify(validation),
    });

    // Create the default AudioVariant for this track
    await audioVariantService.upsertVariant({
      trackId: newTrack.id,
      qualityTier: validation.qualityTier,
      codec: validation.codec,
      container: validation.container,
      bitrate: validation.bitrate,
      sampleRate: validation.sampleRate,
      bitDepth: validation.bitDepth,
      channels: validation.channels,
      fileSize: validation.fileSize,
      fileUrl: req.file.filename,
      isLossless: validation.isLossless,
      isGenuineLossless: validation.isGenuineLossless,
      validationNotes: validation.validationNotes,
      mimeType: validation.mimeType,
      isDefault: true,
    });

    // Execute Audio Intelligence Pipeline (DSP, LUFS, BPM, Camelot Key, Fingerprint)
    let audioProfile = null;
    try {
      audioProfile = await audioProfileService.analyzeAndSaveTrack(newTrack.id, req.file.path);
    } catch (analysisErr) {
      console.warn('[TrackController] Audio intelligence pipeline warning:', analysisErr);
    }

    res.status(201).json({
      success: true,
      data: {
        ...newTrack,
        validation,
        audioProfile,
      },
      message: 'Track validated, indexed, and analyzed with Audio Intelligence Pipeline',
    });
  } catch (err) {
    next(err);
  }
};

export const getQualityInfo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const info = await trackService.getQualityInfo(req.params.id as string);
    res.status(200).json({ success: true, data: info });
  } catch (err) {
    next(err);
  }
};

export const getQualityReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const trackId = req.params.id as string;
    const tier =
      (req.query.requestedTier as string) ||
      (req.query.tier as string) ||
      (req.query.quality as string) ||
      'AUTO';
    const title = req.query.title as string | undefined;
    const artist = req.query.artist as string | undefined;

    const report = await trackService.generateQualityReport(trackId, tier, { title, artist });
    res.status(200).json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
};

export const findLosslessAlternative = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let title = (req.query.title as string) || '';
    let artist = (req.query.artist as string) || '';
    let album = req.query.album as string | undefined;

    // If ID provided without explicit title/artist, look up track details
    const trackId = req.params.id as string;
    if (trackId && (!title || !artist)) {
      const { prisma } = await import('../services/prisma.js');
      const dbTrack = await prisma.track.findUnique({ where: { id: trackId } });
      if (dbTrack) {
        title = title || dbTrack.title;
        artist = artist || dbTrack.artist;
        album = album || dbTrack.album || undefined;
      }
    }

    const { providerRegistry } = await import('../services/providers/provider-registry.js');
    const alternative = await providerRegistry.findLosslessAlternative(title, artist, album);

    res.status(200).json({
      success: true,
      data: alternative,
      hasAlternative: !!alternative,
    });
  } catch (err) {
    next(err);
  }
};

export const searchAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = (req.query.q as string) || '';
    const result = await trackService.searchAll(q);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

export const getOnlineTrending = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const languageOrGenre = (req.query.language as string) || (req.query.genre as string) || 'All';
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 30;
    const tracks = await onlineMusicService.getTrending(languageOrGenre, limit);
    res.status(200).json({ success: true, data: tracks });
  } catch (err) {
    next(err);
  }
};

export const searchOnline = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = (req.query.q as string) || '';
    const language = (req.query.language as string) || undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    // Return full bundle if client requested catalog bundle
    const result = await onlineMusicService.searchCatalog(q, language, limit);
    res.status(200).json({
      success: true,
      data: result.tracks, // backward compatible list
      bundle: result, // { tracks, artists, albums }
    });
  } catch (err) {
    next(err);
  }
};

export const getOnlineArtist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const artistId = req.params.id as string;
    const artist = await onlineMusicService.getArtistDetails(artistId);
    if (!artist) {
      res.status(404).json({ success: false, error: { message: 'Artist not found' } });
      return;
    }
    res.status(200).json({ success: true, data: artist });
  } catch (err) {
    next(err);
  }
};

export const getOnlineAlbum = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const albumId = req.params.id as string;
    const album = await onlineMusicService.getAlbumDetails(albumId);
    if (!album) {
      res.status(404).json({ success: false, error: { message: 'Album not found' } });
      return;
    }
    res.status(200).json({ success: true, data: album });
  } catch (err) {
    next(err);
  }
};

export const streamOnlineTrack = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await onlineMusicService.streamTrack(req.params.id as string, req, res);
  } catch (err) {
    next(err);
  }
};

export const getStreamToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const trackId = req.params.id as string;
    const userId = req.user?.id || 'public_listener';
    const requestedTier = ((req.query.tier as string) || (req.query.quality as string) || 'HI_RES_LOSSLESS').toUpperCase();

    const signed = streamSecurityService.generateSignedToken(trackId, userId, requestedTier as any);

    res.status(200).json({
      success: true,
      data: {
        trackId,
        token: signed.token,
        expiresAt: signed.expiresAt,
        streamUrl: signed.streamPath,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getAudioProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const trackId = req.params.id as string;
    const profile = await audioProfileService.getProfileByTrackId(trackId);
    if (!profile) {
      res.status(404).json({
        success: false,
        error: { message: `Audio profile not found for track ${trackId}` },
      });
      return;
    }
    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (err) {
    next(err);
  }
};

export const analyzeTrack = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const trackId = req.params.id as string;
    const profile = await audioProfileService.analyzeAndSaveTrack(trackId);
    if (!profile) {
      res.status(400).json({
        success: false,
        error: { message: `Audio analysis could not be completed for track ${trackId}. File might not be stored locally.` },
      });
      return;
    }
    res.status(200).json({
      success: true,
      data: profile,
      message: 'Audio intelligence pipeline analysis completed',
    });
  } catch (err) {
    next(err);
  }
};


