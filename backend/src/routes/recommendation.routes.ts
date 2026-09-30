import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.middleware.js';
import { recommendationService } from '../services/recommendation.service.js';

const router = Router();

/** GET /api/v1/recommendations/daily — 6 personalized daily mixes */
router.get('/daily', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const force = req.query.regenerate === 'true';
    const mixes = await recommendationService.getDailyMixes(req.user!.id, force);
    res.json({ success: true, data: mixes });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { message: e.message } });
  }
});

/** GET /api/v1/recommendations/discover — discovery mix (unheard tracks) */
router.get('/discover', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const tracks = await recommendationService.getDiscoverMix(req.user!.id);
    res.json({ success: true, data: tracks });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { message: e.message } });
  }
});

/** GET /api/v1/recommendations/similar/:trackId — similar track recommendations */
router.get('/similar/:trackId', async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(20, parseInt(req.query.limit as string) || 10);
    const tracks = await recommendationService.getSimilarTracks(String(req.params.trackId), limit);
    res.json({ success: true, data: tracks });
  } catch (e: any) {
    res.status(404).json({ success: false, error: { message: e.message } });
  }
});

/** GET /api/v1/recommendations/transition/:trackId — smart transition metadata */
router.get('/transition/:trackId', async (req: AuthRequest, res: Response) => {
  try {
    const data = await recommendationService.getTransitionMetadata(String(req.params.trackId));
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(404).json({ success: false, error: { message: e.message } });
  }
});

export default router;
