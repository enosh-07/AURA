/**
 * Storage Controller
 * POST /api/v1/storage/upload
 * GET  /api/v1/storage/serve/:bucket/:key
 * DELETE /api/v1/storage/:bucket/:key
 */

import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';
import { storageService } from '../services/storage.service.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { ALLOWED_AUDIO_MIME, ALLOWED_IMAGE_MIME } from '../services/storage.provider.js';

export class StorageController {
  async upload(req: AuthRequest, res: Response): Promise<void> {
    try {
      const file = (req as any).file;
      if (!file) {
        res.status(400).json({ success: false, error: { code: 'NO_FILE', message: 'No file attached.' } });
        return;
      }

      const type: string = req.body.type || 'audio';
      const mimeType: string = file.mimetype;
      const fileSize: number = file.size;
      const buffer: Buffer = file.buffer;

      let result;
      if (type === 'artwork') {
        if (!ALLOWED_IMAGE_MIME.has(mimeType)) {
          res.status(422).json({ success: false, error: { code: 'INVALID_MIME', message: `Unsupported image type: ${mimeType}` } });
          return;
        }
        result = await storageService.uploadArtwork(buffer, file.originalname, mimeType, fileSize);
      } else {
        if (!ALLOWED_AUDIO_MIME.has(mimeType)) {
          res.status(422).json({ success: false, error: { code: 'INVALID_MIME', message: `Unsupported audio type: ${mimeType}` } });
          return;
        }
        result = await storageService.uploadAudio(buffer, file.originalname, mimeType, fileSize);
      }

      res.status(201).json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'UPLOAD_FAILED', message: err.message || 'Upload failed.' } });
    }
  }

  async serve(req: Request, res: Response): Promise<void> {
    try {
      const bucket = String(req.params.bucket);
      const key = String(req.params.key);

      if (!['audio', 'artwork'].includes(bucket)) {
        res.status(400).json({ success: false, error: { message: 'Invalid bucket.' } });
        return;
      }

      const filePath = path.join(process.cwd(), 'storage', bucket, key);
      if (!fs.existsSync(filePath)) {
        res.status(404).json({ success: false, error: { message: 'File not found.' } });
        return;
      }

      const ext = path.extname(key).toLowerCase();
      const mimeMap: Record<string, string> = {
        '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.flac': 'audio/flac',
        '.ogg': 'audio/ogg', '.aac': 'audio/aac', '.m4a': 'audio/mp4',
        '.webm': 'audio/webm', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif',
      };
      const contentType = mimeMap[ext] || 'application/octet-stream';
      const stat = fs.statSync(filePath);
      const range = req.headers.range;

      if (range && contentType.startsWith('audio/')) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        if (start >= stat.size) { res.status(416).send('Requested range not satisfiable'); return; }
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${stat.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': end - start + 1,
          'Content-Type': contentType,
        });
        fs.createReadStream(filePath, { start, end }).pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': stat.size,
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=31536000',
        });
        fs.createReadStream(filePath).pipe(res);
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: { message: 'Failed to serve file.' } });
    }
  }

  async deleteFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const bucket = String(req.params.bucket);
      const key = String(req.params.key);
      if (!['audio', 'artwork'].includes(bucket)) {
        res.status(400).json({ success: false, error: { message: 'Invalid bucket.' } });
        return;
      }
      await storageService.deleteFile(bucket as any, key);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { message: err.message || 'Delete failed.' } });
    }
  }
}

export const storageController = new StorageController();
