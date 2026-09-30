import { Router, Response } from 'express';
import { requireAuth, optionalAuth, AuthRequest } from '../middleware/auth.middleware.js';
import { aiLimiter } from '../middleware/ratelimit.middleware.js';
import { aiService } from '../services/ai.service.js';

const router = Router();

// All AI routes have their own rate limiting
router.use(aiLimiter);

// ============================================================
// MUSIC CURATION (existing endpoint, enhanced)
// POST /api/v1/ai/curate
// ============================================================

router.post('/curate', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { prompt, currentTrackId, userMood } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ success: false, error: { message: 'prompt is required.' } });
      return;
    }
    const data = await aiService.curateMusic(req.user?.id, prompt, currentTrackId, userMood);
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { message: 'AI curation failed.', details: e.message } });
  }
});

// ============================================================
// AI DJ
// ============================================================

/** POST /api/v1/ai/dj/session — create a new DJ session */
router.post('/dj/session', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { prompt } = req.body;
    const session = await aiService.createDJSession(req.user!.id, prompt);
    res.status(201).json({ success: true, data: { sessionId: session.id } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { message: e.message } });
  }
});

/** POST /api/v1/ai/dj/next — get next track from DJ */
router.post('/dj/next', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId, currentTrackId, requestedMood, requestedEnergy } = req.body;
    if (!sessionId) {
      res.status(400).json({ success: false, error: { message: 'sessionId required.' } });
      return;
    }
    const track = await aiService.getDJNextTrack(req.user!.id, sessionId, { currentTrackId, requestedMood, requestedEnergy });
    res.json({ success: true, data: track });
  } catch (e: any) {
    res.status(404).json({ success: false, error: { message: e.message } });
  }
});

/** POST /api/v1/ai/dj/feedback — like/skip/love for DJ session adjustment */
router.post('/dj/feedback', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId, trackId, feedback } = req.body;
    if (!sessionId || !trackId || !['like', 'skip', 'love'].includes(feedback)) {
      res.status(400).json({ success: false, error: { message: 'sessionId, trackId, and feedback (like|skip|love) required.' } });
      return;
    }
    const result = await aiService.recordDJFeedback(req.user!.id, sessionId, trackId, feedback);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(404).json({ success: false, error: { message: e.message } });
  }
});

// ============================================================
// NATURAL LANGUAGE PLAYLIST GENERATION
// POST /api/v1/ai/playlists/generate
// ============================================================

router.post('/playlists/generate', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { prompt, maxTracks, createPlaylist } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ success: false, error: { message: 'prompt is required.' } });
      return;
    }
    const data = await aiService.generatePlaylist(req.user!.id, prompt, { maxTracks, createPlaylist });
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { message: 'Playlist generation failed.', details: e.message } });
  }
});

export default router;
