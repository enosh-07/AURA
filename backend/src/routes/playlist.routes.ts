import { Router, Response } from 'express';
import {
  getPlaylists,
  getPlaylistById,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
} from '../controllers/playlist.controller.js';
import { optionalAuth, requireAuth, AuthRequest } from '../middleware/auth.middleware.js';
import { playlistService } from '../services/playlist.service.js';

const router = Router();

router.get('/', optionalAuth, getPlaylists);
router.get('/:id', optionalAuth, getPlaylistById);
router.post('/', requireAuth, createPlaylist);
router.put('/:id', requireAuth, updatePlaylist);
router.delete('/:id', requireAuth, deletePlaylist);
router.post('/:id/tracks', requireAuth, addTrackToPlaylist);
router.delete('/:id/tracks/:trackId', requireAuth, removeTrackFromPlaylist);

// ============================================================
// COLLABORATOR ENDPOINTS (Phase 3)
// ============================================================

/** GET /api/v1/playlists/:id/collaborators */
router.get('/:id/collaborators', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const data = await playlistService.getCollaborators(String(req.params.id), req.user?.id || '');
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(403).json({ success: false, error: { message: e.message } });
  }
});

/** POST /api/v1/playlists/:id/collaborators */
router.post('/:id/collaborators', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, role = 'VIEWER' } = req.body;
    if (!userId) {
      res.status(400).json({ success: false, error: { message: 'userId required.' } });
      return;
    }
    const collab = await playlistService.addCollaborator(req.user!.id, String(req.params.id), userId, role);
    res.status(201).json({ success: true, data: collab });
  } catch (e: any) {
    res.status(403).json({ success: false, error: { message: e.message } });
  }
});

/** DELETE /api/v1/playlists/:id/collaborators/:userId */
router.delete('/:id/collaborators/:userId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await playlistService.removeCollaborator(req.user!.id, String(req.params.id), String(req.params.userId));
    res.json({ success: true });
  } catch (e: any) {
    res.status(403).json({ success: false, error: { message: e.message } });
  }
});

/** GET /api/v1/playlists/:id/activity */
router.get('/:id/activity', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const data = await playlistService.getActivity(String(req.params.id), req.user!.id);
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(403).json({ success: false, error: { message: e.message } });
  }
});

export default router;
