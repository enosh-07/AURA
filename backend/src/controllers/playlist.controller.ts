import { Response, NextFunction } from 'express';
import { playlistService } from '../services/playlist.service.js';
import { AuthRequest } from '../middleware/auth.middleware.js';

export const getPlaylists = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const playlists = await playlistService.getPlaylists(req.user?.id);
    res.status(200).json({ success: true, data: playlists });
  } catch (err) {
    next(err);
  }
};

export const getPlaylistById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const playlist = await playlistService.getPlaylistById(req.params.id as string, req.user?.id);
    res.status(200).json({ success: true, data: playlist });
  } catch (err) {
    next(err);
  }
};

export const createPlaylist = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const playlist = await playlistService.createPlaylist(req.user!.id, req.body);
    res.status(201).json({ success: true, data: playlist });
  } catch (err) {
    next(err);
  }
};

export const updatePlaylist = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const playlist = await playlistService.updatePlaylist(req.user!.id, req.params.id as string, req.body);
    res.status(200).json({ success: true, data: playlist });
  } catch (err) {
    next(err);
  }
};

export const deletePlaylist = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await playlistService.deletePlaylist(req.user!.id, req.params.id as string);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

export const addTrackToPlaylist = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await playlistService.addTrackToPlaylist(
      req.user!.id,
      req.params.id as string,
      req.body.trackId
    );
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

export const removeTrackFromPlaylist = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await playlistService.removeTrackFromPlaylist(
      req.user!.id,
      req.params.id as string,
      req.params.trackId as string
    );
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};
