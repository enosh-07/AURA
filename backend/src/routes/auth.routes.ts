import { Router, Request, Response } from 'express';
import { register, login, googleAuth, getMe, updatePreferences } from '../controllers/auth.controller.js';
import { requireAuth, AuthRequest } from '../middleware/auth.middleware.js';
import { authLimiter } from '../middleware/ratelimit.middleware.js';
import { authService } from '../services/auth.service.js';
import { settingsService } from '../services/settings.service.js';

const router = Router();

// Apply stricter rate limiting to auth endpoints
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/google', authLimiter, googleAuth);
router.get('/me', requireAuth, getMe);
router.put('/preferences', requireAuth, updatePreferences);

/** POST /api/v1/auth/refresh — exchange refresh token for new access token */
router.post('/refresh', authLimiter, async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ success: false, error: { message: 'refreshToken required.' } });
      return;
    }
    const result = await authService.refreshAccessToken(refreshToken);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(401).json({ success: false, error: { code: 'INVALID_REFRESH_TOKEN', message: e.message } });
  }
});

/** POST /api/v1/auth/logout — revoke refresh token */
router.post('/logout', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    try {
      await authService.revokeRefreshToken(refreshToken);
    } catch {}
  }
  res.json({ success: true });
});

// ============================================================
// USER PREFERENCES / AUDIO LAB (canonical path from API_CONTRACT.md)
// ============================================================

router.get('/users/preferences/audio-lab', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const data = await settingsService.getAudioLabSettings(req.user!.id);
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { message: e.message } });
  }
});

router.put('/users/preferences/audio-lab', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await settingsService.updateAudioLabSettings(req.user!.id, req.body);
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ success: false, error: { message: e.message } });
  }
});

export default router;
