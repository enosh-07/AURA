import { Request, Response, NextFunction } from 'express';
import { trackService } from '../services/track.service.js';
import { streamService } from '../services/stream.service.js';
import { onlineMusicService } from '../services/onlineMusic.service.js';
import { audioValidationService } from '../services/audioValidation.service.js';
import { audioVariantService } from '../services/audio-variant.service.js';
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
    const lyrics = await trackService.getLyrics(req.params.id as string);
    res.status(200).json({ success: true, data: lyrics });
  } catch (err) {
    next(err);
  }
};

export const likeTrack = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await trackService.toggleLike(req.user!.id, req.params.id as string, true);
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

    res.status(201).json({
      success: true,
      data: {
        ...newTrack,
        validation,
      },
      message: 'Track validated, indexed, and stored with audio fidelity verification',
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

