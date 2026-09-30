/**
 * Settings Routes
 * GET  /api/v1/settings/eq-presets
 * POST /api/v1/settings/eq-presets
 * PUT  /api/v1/settings/eq-presets/:id
 * DELETE /api/v1/settings/eq-presets/:id
 *
 * GET  /api/v1/settings/visualizer-presets
 * POST /api/v1/settings/visualizer-presets
 * PUT  /api/v1/settings/visualizer-presets/:id
 * DELETE /api/v1/settings/visualizer-presets/:id
 *
 * GET  /api/v1/settings/audio-lab (alias for /users/preferences/audio-lab)
 * PUT  /api/v1/settings/audio-lab
 */

import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.middleware.js';
import { settingsService } from '../services/settings.service.js';

const router = Router();

// ============================================================
// EQ PRESETS
// ============================================================

router.get('/eq-presets', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const data = await settingsService.getEQPresets(req.user!.id);
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { message: e.message } });
  }
});

router.post('/eq-presets', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { name, bands, bassBoost, treble, stereoPan, reverbLevel } = req.body;
    if (!name || !Array.isArray(bands)) {
      res.status(400).json({ success: false, error: { message: 'name and bands[10] required.' } });
      return;
    }
    const preset = await settingsService.createEQPreset(req.user!.id, { name, bands, bassBoost, treble, stereoPan, reverbLevel });
    res.status(201).json({ success: true, data: preset });
  } catch (e: any) {
    res.status(400).json({ success: false, error: { message: e.message } });
  }
});

router.put('/eq-presets/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const preset = await settingsService.updateEQPreset(req.user!.id, String(req.params.id), req.body);
    res.json({ success: true, data: preset });
  } catch (e: any) {
    res.status(400).json({ success: false, error: { message: e.message } });
  }
});

router.delete('/eq-presets/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await settingsService.deleteEQPreset(req.user!.id, String(req.params.id));
    res.json({ success: true });
  } catch (e: any) {
    res.status(404).json({ success: false, error: { message: e.message } });
  }
});

// ============================================================
// VISUALIZER PRESETS
// ============================================================

router.get('/visualizer-presets', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const data = await settingsService.getVisualizerPresets(req.user!.id);
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { message: e.message } });
  }
});

router.post('/visualizer-presets', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { name, mode, config } = req.body;
    if (!name || !mode) {
      res.status(400).json({ success: false, error: { message: 'name and mode required.' } });
      return;
    }
    const preset = await settingsService.createVisualizerPreset(req.user!.id, { name, mode, config });
    res.status(201).json({ success: true, data: preset });
  } catch (e: any) {
    res.status(400).json({ success: false, error: { message: e.message } });
  }
});

router.put('/visualizer-presets/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const preset = await settingsService.updateVisualizerPreset(req.user!.id, String(req.params.id), req.body);
    res.json({ success: true, data: preset });
  } catch (e: any) {
    res.status(400).json({ success: false, error: { message: e.message } });
  }
});

router.delete('/visualizer-presets/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await settingsService.deleteVisualizerPreset(req.user!.id, String(req.params.id));
    res.json({ success: true });
  } catch (e: any) {
    res.status(404).json({ success: false, error: { message: e.message } });
  }
});

// ============================================================
// AUDIO LAB SETTINGS (cross-device sync)
// ============================================================

router.get('/audio-lab', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const data = await settingsService.getAudioLabSettings(req.user!.id);
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { message: e.message } });
  }
});

router.put('/audio-lab', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await settingsService.updateAudioLabSettings(req.user!.id, req.body);
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ success: false, error: { message: e.message } });
  }
});

export default router;
