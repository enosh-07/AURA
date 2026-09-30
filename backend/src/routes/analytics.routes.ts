import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.middleware.js';
import { analyticsService } from '../services/analytics.service.js';

const router = Router();

/** POST /api/v1/analytics/listen — log a playback event */
router.post('/listen', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { trackId, durationListened, completed, deviceId, qualityTier, sessionId } = req.body;
    if (!trackId || durationListened === undefined) {
      res.status(400).json({ success: false, error: { message: 'trackId and durationListened required.' } });
      return;
    }
    await analyticsService.logPlayback(req.user!.id, { trackId, durationListened, completed, deviceId, qualityTier, sessionId });
    res.status(202).json({ success: true, data: { logged: true } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { message: e.message } });
  }
});

/** POST /api/v1/analytics/skip — log a skip event */
router.post('/skip', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { trackId, positionSec, sessionId } = req.body;
    if (!trackId) {
      res.status(400).json({ success: false, error: { message: 'trackId required.' } });
      return;
    }
    await analyticsService.logSkip(req.user!.id, { trackId, positionSec: positionSec ?? 0, sessionId });
    res.status(202).json({ success: true, data: { logged: true } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { message: e.message } });
  }
});

/** GET /api/v1/analytics/insights — user listening insights */
router.get('/insights', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const data = await analyticsService.getInsights(req.user!.id);
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { message: e.message } });
  }
});

/** GET /api/v1/analytics/top-artists */
router.get('/top-artists', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const data = await analyticsService.getTopArtists(req.user!.id, days);
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { message: e.message } });
  }
});

/** GET /api/v1/analytics/trends */
router.get('/trends', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const data = await analyticsService.getTrends(req.user!.id);
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { message: e.message } });
  }
});

/** GET /api/v1/analytics/listening-time */
router.get('/listening-time', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const granularity = (req.query.granularity as string) === 'week' ? 'week' : 'day';
    const days = parseInt(req.query.days as string) || 30;
    const data = await analyticsService.getListeningTime(req.user!.id, granularity, days);
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { message: e.message } });
  }
});

export default router;
