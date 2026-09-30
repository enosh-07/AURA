import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.middleware.js';
import { deviceService } from '../services/device.service.js';

const router = Router();

/** POST /api/v1/devices/register */
router.post('/register', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { name, platform, browser, userAgent, deviceId } = req.body;
    if (!name || !platform) {
      res.status(400).json({ success: false, error: { message: 'name and platform are required.' } });
      return;
    }
    const device = await deviceService.registerDevice(req.user!.id, { name, platform, browser, userAgent, deviceId });
    res.status(201).json({ success: true, data: device });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { message: e.message } });
  }
});

/** GET /api/v1/devices */
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const devices = await deviceService.getDevices(req.user!.id);
    res.json({ success: true, data: devices });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { message: e.message } });
  }
});

/** DELETE /api/v1/devices/:id */
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await deviceService.deleteDevice(req.user!.id, String(req.params.id));
    res.json({ success: true });
  } catch (e: any) {
    res.status(404).json({ success: false, error: { message: e.message } });
  }
});

/** GET /api/v1/devices/state — get current playback state */
router.get('/state', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const deviceId = req.query.deviceId as string | undefined;
    const state = await deviceService.getPlaybackState(req.user!.id, deviceId);
    res.json({ success: true, data: state });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { message: e.message } });
  }
});

/** PUT /api/v1/devices/state — update playback state */
router.put('/state', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { deviceId, currentTrackId, positionSec, isPlaying, volume, queue, playbackMode, losslessTier, bitPerfectMode } = req.body;
    const state = await deviceService.updatePlaybackState(req.user!.id, deviceId, {
      currentTrackId,
      positionSec,
      isPlaying,
      volume,
      queueJson: queue ? JSON.stringify(queue) : undefined,
      playbackMode,
      losslessTier,
      bitPerfectMode,
    });
    res.json({ success: true, data: state });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { message: e.message } });
  }
});

/** POST /api/v1/devices/transfer — transfer playback from one device to another */
router.post('/transfer', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { fromDeviceId, toDeviceId } = req.body;
    if (!fromDeviceId || !toDeviceId) {
      res.status(400).json({ success: false, error: { message: 'fromDeviceId and toDeviceId required.' } });
      return;
    }
    const state = await deviceService.transferPlayback(req.user!.id, fromDeviceId, toDeviceId);
    res.json({ success: true, data: state });
  } catch (e: any) {
    res.status(400).json({ success: false, error: { message: e.message } });
  }
});

export default router;
