import { Router } from 'express';
import multer from 'multer';
import { storageController } from '../controllers/storage.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { MAX_AUDIO_SIZE_BYTES, MAX_IMAGE_SIZE_BYTES } from '../services/storage.provider.js';

const router = Router();

// Use memory storage — files validated before disk write
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AUDIO_SIZE_BYTES },
});

// Upload endpoint — auth required
router.post('/upload', requireAuth, upload.single('file'), (req, res) =>
  storageController.upload(req as any, res)
);

// Serve files — public (local provider)
router.get('/serve/:bucket/:key', (req, res) =>
  storageController.serve(req, res)
);

// Delete — auth required
router.delete('/:bucket/:key', requireAuth, (req, res) =>
  storageController.deleteFile(req as any, res)
);

export default router;
