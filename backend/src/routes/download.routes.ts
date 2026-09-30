import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.middleware.js';
import { downloadService } from '../services/download.service.js';

const router = Router();

/** POST /api/v1/downloads/:trackId — request a download */
router.post('/:trackId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { platform = 'web', qualityTier = 'standard' } = req.body;
    const result = await downloadService.requestDownload(
      req.user!.id,
      String(req.params.trackId),
      platform,
      qualityTier
    );
    res.status(201).json({ success: true, data: result });
  } catch (e: any) {
    res.status(404).json({ success: false, error: { message: e.message } });
  }
});

/** GET /api/v1/downloads — list user's downloads */
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const downloads = await downloadService.getDownloads(req.user!.id);
    res.json({ success: true, data: downloads });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { message: e.message } });
  }
});

/** PUT /api/v1/downloads/:trackId/progress — update download progress (from native client) */
router.put('/:trackId/progress', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { progress, status } = req.body;
    await downloadService.updateProgress(req.user!.id, String(req.params.trackId), Number(progress), status);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { message: e.message } });
  }
});

/** DELETE /api/v1/downloads/:trackId — remove download */
router.delete('/:trackId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await downloadService.removeDownload(req.user!.id, String(req.params.trackId));
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { message: e.message } });
  }
});

export default router;
