import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  getTracks,
  getTrackById,
  streamTrack,
  getLyrics,
  likeTrack,
  unlikeTrack,
  uploadTrack,
  searchAll,
  getOnlineTrending,
  searchOnline,
  getOnlineArtist,
  getOnlineAlbum,
  streamOnlineTrack,
  getQualityInfo,
  getLikedTrackIds,
} from '../controllers/track.controller.js';
import { optionalAuth, requireAuth } from '../middleware/auth.middleware.js';

const storageDir = path.join(process.cwd(), 'storage', 'audio');
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, storageDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `track-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('audio/') || /\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  },
});

const router = Router();

// Online Multi-Language Streaming & Catalog
router.get('/online/trending', getOnlineTrending);
router.get('/online/search', searchOnline);
router.get('/online/artist/:id', getOnlineArtist);
router.get('/online/album/:id', getOnlineAlbum);
router.get('/online/:id/stream', streamOnlineTrack);

router.get('/search/all', searchAll);
router.get('/', optionalAuth, getTracks);
router.get('/me/likes', requireAuth, getLikedTrackIds);
router.post('/upload', optionalAuth, upload.single('audio'), uploadTrack);
router.get('/:id', optionalAuth, getTrackById);
router.get('/:id/stream', streamTrack);
router.get('/:id/quality-info', getQualityInfo);
router.get('/:id/lyrics', getLyrics);
router.post('/:id/like', requireAuth, likeTrack);
router.delete('/:id/like', requireAuth, unlikeTrack);

// Audio quality variants
import { audioVariantService } from '../services/audio-variant.service.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { Response } from 'express';
router.get('/:id/variants', async (req: AuthRequest, res: Response) => {
  try {
    const variants = await audioVariantService.getVariants(String(req.params.id));
    const preference = (req.query.quality as string) || 'auto';
    const selected = await audioVariantService.selectVariant(String(req.params.id), preference as any);
    res.json({
      success: true,
      data: {
        variants: variants.map((v) => audioVariantService.formatVariant(v)),
        selected: selected ? audioVariantService.formatVariant(selected) : null,
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: { message: e.message } });
  }
});

export default router;

