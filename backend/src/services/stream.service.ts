import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';
import { prisma } from './prisma.js';
import { audioVariantService, QualityPreference } from './audio-variant.service.js';

export class StreamService {
  async streamTrack(req: Request, res: Response, trackId: string) {
    const track = await prisma.track.findUnique({
      where: { id: trackId },
      include: { variants: true },
    });

    if (!track) {
      res.status(404).json({ success: false, error: { message: 'Track not found' } });
      return;
    }

    // Step 1: Quality Preference from Query or Header
    const requestedQuality =
      ((req.query.quality as string) ||
        (req.query.tier as string) ||
        (req.headers['x-audio-quality'] as string) ||
        'AUTO').toUpperCase() as QualityPreference;

    // Step 2: Check variants for best match
    const selectedVariant = await audioVariantService.selectVariant(trackId, requestedQuality);

    // Prepare response metadata headers (Never falsely report a track as lossless)
    const activeCodec = selectedVariant?.codec || track.codec || 'PCM';
    const activeContainer = selectedVariant?.container || track.container || 'WAVE';
    const activeBitDepth = selectedVariant?.bitDepth || track.bitDepth || 16;
    const activeSampleRate = selectedVariant?.sampleRate || track.sampleRate || 44100;
    const activeChannels = selectedVariant?.channels || track.channelCount || 2;
    const activeQualityTier = selectedVariant?.qualityTier || track.qualityTier || 'STANDARD';
    const isGenuineLossless = selectedVariant ? selectedVariant.isGenuineLossless : track.isGenuineLossless;
    const activeBitrate = selectedVariant?.bitrate || track.bitrate || 0;

    res.setHeader('X-Audio-Codec', activeCodec);
    res.setHeader('X-Audio-Container', activeContainer);
    res.setHeader('X-Audio-Bit-Depth', String(activeBitDepth));
    res.setHeader('X-Audio-Sample-Rate', String(activeSampleRate));
    res.setHeader('X-Audio-Channels', String(activeChannels));
    res.setHeader('X-Audio-Quality-Tier', activeQualityTier);
    res.setHeader('X-Audio-Lossless', isGenuineLossless ? 'true' : 'false');
    res.setHeader('X-Audio-Bitrate', String(activeBitrate));

    // Expose headers for browser fetch / audio element inspection
    res.setHeader(
      'Access-Control-Expose-Headers',
      'X-Audio-Codec, X-Audio-Container, X-Audio-Bit-Depth, X-Audio-Sample-Rate, X-Audio-Channels, X-Audio-Quality-Tier, X-Audio-Lossless, X-Audio-Bitrate, Content-Range, Accept-Ranges, Content-Length'
    );

    // Step 3: Identify file target
    const targetFile = selectedVariant ? selectedVariant.fileUrl : track.audioFileUrl;

    // Check candidate paths for local audio
    const storageDirs = [
      path.join(process.cwd(), 'storage', 'audio'),
      path.join(process.cwd(), 'backend', 'storage', 'audio'),
      path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../../storage/audio'),
    ];

    // Direct path check
    if (targetFile && fs.existsSync(targetFile)) {
      this.streamLocalFile(req, res, targetFile);
      return;
    }

    // Storage directory check for targetFile filename
    if (targetFile) {
      for (const dir of storageDirs) {
        const fullPath = path.join(dir, targetFile);
        if (fs.existsSync(fullPath)) {
          this.streamLocalFile(req, res, fullPath);
          return;
        }
      }
    }

    // Check for trackId.flac or trackId.wav in storage dirs
    for (const dir of storageDirs) {
      const flacPath = path.join(dir, `${trackId}.flac`);
      if (fs.existsSync(flacPath)) {
        this.streamLocalFile(req, res, flacPath);
        return;
      }
      const wavPath = path.join(dir, `${trackId}.wav`);
      if (fs.existsSync(wavPath)) {
        this.streamLocalFile(req, res, wavPath);
        return;
      }
    }

    // If target is a remote URL (CDN), proxy the stream
    if (targetFile && (targetFile.startsWith('http://') || targetFile.startsWith('https://'))) {
      await this.proxyRemoteAudio(req, res, targetFile);
      return;
    }

    res.status(404).json({ success: false, error: { message: 'Audio stream source not found' } });
  }

  private streamLocalFile(req: Request, res: Response, filePath: string) {
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    const ext = path.extname(filePath).toLowerCase();

    let contentType = 'audio/mpeg';
    if (ext === '.flac') contentType = 'audio/flac';
    else if (ext === '.wav') contentType = 'audio/wav';
    else if (ext === '.aiff' || ext === '.aif') contentType = 'audio/aiff';
    else if (ext === '.m4a' || ext === '.alac') contentType = 'audio/mp4';
    else if (ext === '.ogg' || ext === '.opus') contentType = 'audio/ogg';

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize) {
        res.status(416).send(`Requested range not satisfiable\n${start} >= ${fileSize}`);
        return;
      }

      const chunkSize = end - start + 1;
      const file = fs.createReadStream(filePath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
      });

      file.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
      });
      fs.createReadStream(filePath).pipe(res);
    }
  }

  private async proxyRemoteAudio(req: Request, res: Response, remoteUrl: string) {
    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: '*/*',
    };

    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    try {
      const remoteRes = await fetch(remoteUrl, { headers });

      res.status(remoteRes.status);
      remoteRes.headers.forEach((value, key) => {
        if (['content-range', 'accept-ranges', 'content-length', 'content-type'].includes(key.toLowerCase())) {
          res.setHeader(key, value);
        }
      });

      if (!res.getHeader('content-type')) {
        res.setHeader('content-type', 'audio/mpeg');
      }

      if (remoteRes.body) {
        const reader = remoteRes.body.getReader();
        const pump = async () => {
          const { done, value } = await reader.read();
          if (done) {
            res.end();
            return;
          }
          res.write(value);
          await pump();
        };
        await pump();
      } else {
        res.end();
      }
    } catch (err) {
      console.error('Remote audio stream error:', err);
      res.status(502).json({ success: false, error: { message: 'Failed to stream remote audio source' } });
    }
  }
}

export const streamService = new StreamService();
