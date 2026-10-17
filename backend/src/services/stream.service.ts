/**
 * AURA Production Audio Stream Service
 * =====================================
 * High-performance audio streaming engine supporting:
 *  - Cryptographic stream authorization & signed URL verification
 *  - Concurrent stream session controls
 *  - HTTP 206 Partial Content byte-range streaming with If-Range & ETag validation
 *  - Multi-tier quality variant selection (STANDARD, HIGH, LOSSLESS, HI_RES_LOSSLESS)
 *  - Transparent proxying with connection failure recovery and automatic retry
 *  - CDN-ready cache headers and accurate audio telemetry headers
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Request, Response } from 'express';
import { prisma } from './prisma.js';
import { audioVariantService, QualityPreference } from './audio-variant.service.js';
import { streamSecurityService } from './stream-security.service.js';
import { providerRegistry } from './providers/provider-registry.js';
import { QualityTier } from './providers/music-provider.interface.js';
import { onlineMusicService } from './onlineMusic.service.js';

export class StreamService {
  /**
   * Main stream handler for a track
   */
  async streamTrack(req: Request, res: Response, trackId: string) {
    const token = (req.query.token as string) || (req.headers['x-stream-token'] as string);
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

    // Step 1: Stream Authorization & Signed URL Verification
    let authorizedUserId = 'public_listener';
    let verifiedTier: QualityTier | null = null;

    if (token) {
      const verification = streamSecurityService.verifyToken(trackId, token);
      if (!verification.isValid) {
        res.status(403).json({
          success: false,
          error: {
            code: verification.error,
            message: 'Stream URL is invalid or has expired. Please refresh the playback token.',
          },
        });
        return;
      }
      authorizedUserId = verification.payload!.userId;
      verifiedTier = verification.payload!.tier;
    }

    // Step 2: Concurrent Stream Control
    const sessionCheck = streamSecurityService.registerStreamSession(authorizedUserId, trackId, clientIp);
    if (!sessionCheck.allowed) {
      res.status(429).json({
        success: false,
        error: {
          code: 'CONCURRENT_STREAM_LIMIT_EXCEEDED',
          message: 'Maximum concurrent streaming sessions reached for this account.',
          activeCount: sessionCheck.activeCount,
        },
      });
      return;
    }

    // Step 3: Determine Quality Preference
    const requestedQuality: QualityPreference =
      verifiedTier ||
      ((req.query.quality as string) ||
        (req.query.tier as string) ||
        (req.headers['x-audio-quality'] as string) ||
        'AUTO').toUpperCase() as QualityPreference;

    // Step 4: Resolve Local Track or External Provider
    const track = await prisma.track.findUnique({
      where: { id: trackId },
      include: { variants: true },
    });

    if (track) {
      await this.streamLocalOrVariant(req, res, track, requestedQuality);
      return;
    }

    // Direct streaming for online provider tracks (JioSaavn, iTunes, Audius)
    if (trackId.startsWith('saavn_') || trackId.startsWith('itunes_') || trackId.startsWith('audius_') || trackId.startsWith('online_')) {
      await onlineMusicService.streamTrack(trackId, req, res);
      return;
    }

    // If not in local DB, attempt resolution via provider registry (e.g. JioSaavn/Online)
    const externalStream = await providerRegistry.resolveStream(
      { id: trackId, title: (req.query.title as string) || trackId, artist: (req.query.artist as string) || '' },
      requestedQuality as QualityTier
    );

    if (externalStream && externalStream.streamUrl) {
      this.attachTelemetryHeaders(res, {
        codec: externalStream.codec || 'AAC',
        container: externalStream.container || 'M4A',
        bitDepth: externalStream.isGenuineLossless ? externalStream.bitDepth : null,
        sampleRate: externalStream.sampleRate || 44100,
        channels: externalStream.channels || 2,
        qualityTier: externalStream.qualityTier || 'HIGH',
        requestedTier: requestedQuality,
        isLossless: externalStream.isLossless || false,
        isGenuineLossless: externalStream.isGenuineLossless || false,
        bitrate: externalStream.bitrate || 320,
        fallbackReason:
          requestedQuality === 'LOSSLESS' || requestedQuality === 'HI_RES_LOSSLESS'
            ? 'NO_LOSSLESS_SOURCE_AVAILABLE'
            : undefined,
      });

      if (externalStream.isDirectFile && externalStream.filePath && fs.existsSync(externalStream.filePath)) {
        this.streamLocalFile(req, res, externalStream.filePath);
        return;
      }

      await this.proxyRemoteAudioWithRecovery(req, res, externalStream.streamUrl);
      return;
    }

    res.status(404).json({ success: false, error: { message: 'Audio stream source not found' } });
  }

  /**
   * Streams a database track or its best-matching quality variant
   */
  private async streamLocalOrVariant(
    req: Request,
    res: Response,
    track: any,
    requestedQuality: QualityPreference
  ) {
    const selectedVariant = await audioVariantService.selectVariant(track.id, requestedQuality);

    // Prepare response metadata headers (Never falsely report a track as lossless)
    const activeCodec = selectedVariant?.codec || track.codec || 'FLAC';
    const activeContainer = selectedVariant?.container || track.container || 'FLAC';
    const activeBitDepth = selectedVariant?.bitDepth || track.bitDepth || 24;
    const activeSampleRate = selectedVariant?.sampleRate || track.sampleRate || 96000;
    const activeChannels = selectedVariant?.channels || track.channelCount || 2;
    const activeQualityTier = selectedVariant?.qualityTier || track.qualityTier || 'HI_RES_LOSSLESS';
    const isGenuineLossless = selectedVariant ? selectedVariant.isGenuineLossless : track.isGenuineLossless;
    const activeBitrate = selectedVariant?.bitrate || track.bitrate || 2840;

    this.attachTelemetryHeaders(res, {
      codec: activeCodec,
      container: activeContainer,
      bitDepth: activeBitDepth,
      sampleRate: activeSampleRate,
      channels: activeChannels,
      qualityTier: activeQualityTier,
      isLossless: isGenuineLossless,
      isGenuineLossless,
      bitrate: activeBitrate,
    });

    const targetFile = selectedVariant ? selectedVariant.fileUrl : track.audioFileUrl;

    const storageDirs = [
      path.join(process.cwd(), 'storage', 'audio'),
      path.join(process.cwd(), 'backend', 'storage', 'audio'),
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
      const flacPath = path.join(dir, `${track.id}.flac`);
      if (fs.existsSync(flacPath)) {
        this.streamLocalFile(req, res, flacPath);
        return;
      }
      const wavPath = path.join(dir, `${track.id}.wav`);
      if (fs.existsSync(wavPath)) {
        this.streamLocalFile(req, res, wavPath);
        return;
      }
    }

    // If target is a remote URL (CDN), proxy the stream
    if (targetFile && (targetFile.startsWith('http://') || targetFile.startsWith('https://'))) {
      await this.proxyRemoteAudioWithRecovery(req, res, targetFile);
      return;
    }

    // Fallback: Resolve via provider registry
    const fallback = await providerRegistry.resolveStream({
      id: track.id,
      title: track.title,
      artist: track.artist,
    });

    if (fallback && fallback.streamUrl) {
      await this.proxyRemoteAudioWithRecovery(req, res, fallback.streamUrl);
      return;
    }

    res.status(404).json({ success: false, error: { message: 'Audio stream source not found' } });
  }

  /**
   * Streams a local file with robust HTTP 206 Partial Content, ETag, and If-Range support
   */
  private streamLocalFile(req: Request, res: Response, filePath: string) {
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    const ext = path.extname(filePath).toLowerCase();

    // Generate deterministic ETag based on mtime and size
    const etag = `W/"${stat.size}-${stat.mtime.getTime()}"`;
    res.setHeader('ETag', etag);
    res.setHeader('Last-Modified', stat.mtime.toUTCString());
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    res.setHeader('X-Accel-Buffering', 'no');

    let contentType = 'audio/mpeg';
    if (ext === '.flac') contentType = 'audio/flac';
    else if (ext === '.wav') contentType = 'audio/wav';
    else if (ext === '.aiff' || ext === '.aif') contentType = 'audio/aiff';
    else if (ext === '.m4a' || ext === '.alac') contentType = 'audio/mp4';
    else if (ext === '.ogg' || ext === '.opus') contentType = 'audio/ogg';

    // Handle If-Range header: if ETag or date doesn't match, send whole file
    const ifRange = req.headers['if-range'];
    const rangeValid = !ifRange || ifRange === etag || ifRange === stat.mtime.toUTCString();

    if (range && rangeValid) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize) {
        res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).send('Requested range not satisfiable');
        return;
      }

      const chunkSize = end - start + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
      });

      fileStream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
      });
      fs.createReadStream(filePath).pipe(res);
    }
  }

  /**
   * Proxies upstream remote CDN audio streams with automatic connection recovery and retry
   */
  private async proxyRemoteAudioWithRecovery(
    req: Request,
    res: Response,
    remoteUrl: string,
    retryCount = 0
  ): Promise<void> {
    const maxRetries = 2;
    const forwardHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AURA-Stream-Engine/1.0',
      Accept: '*/*',
    };

    if (req.headers.range) {
      forwardHeaders['Range'] = req.headers.range;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const remoteRes = await fetch(remoteUrl, {
        headers: forwardHeaders,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      res.status(remoteRes.status);
      res.setHeader('Cache-Control', 'public, max-age=43200');
      res.setHeader('X-Accel-Buffering', 'no');

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
          try {
            const { done, value } = await reader.read();
            if (done) {
              res.end();
              return;
            }
            res.write(value);
            await pump();
          } catch (streamErr) {
            // Client closed connection or upstream dropped
            res.end();
          }
        };
        await pump();
      } else {
        res.end();
      }
    } catch (err: any) {
      if (retryCount < maxRetries) {
        await new Promise((r) => setTimeout(r, 400 * (retryCount + 1)));
        return this.proxyRemoteAudioWithRecovery(req, res, remoteUrl, retryCount + 1);
      }

      console.error('Remote audio stream error after retries:', err?.message || err);
      if (!res.headersSent) {
        res.status(502).json({
          success: false,
          error: { code: 'UPSTREAM_STREAM_FAILURE', message: 'Failed to stream upstream audio source' },
        });
      }
    }
  }

  /**
   * Helper to write consistent audio telemetry headers
   */
  private attachTelemetryHeaders(
    res: Response,
    meta: {
      codec: string;
      container: string;
      bitDepth?: number | null;
      sampleRate?: number | null;
      channels?: number;
      qualityTier: string;
      requestedTier?: string;
      isLossless: boolean;
      isGenuineLossless: boolean;
      bitrate?: number | null;
      fallbackReason?: string;
    }
  ) {
    res.setHeader('X-Audio-Codec', meta.codec);
    res.setHeader('X-Audio-Container', meta.container);
    if (meta.isGenuineLossless && meta.bitDepth) {
      res.setHeader('X-Audio-Bit-Depth', String(meta.bitDepth));
    }
    if (meta.sampleRate) {
      res.setHeader('X-Audio-Sample-Rate', String(meta.sampleRate));
    }
    if (meta.channels) {
      res.setHeader('X-Audio-Channels', String(meta.channels));
    }
    res.setHeader('X-Audio-Quality-Tier', meta.qualityTier);
    if (meta.requestedTier) {
      res.setHeader('X-Audio-Requested-Tier', meta.requestedTier);
    }
    res.setHeader('X-Audio-Lossless', meta.isGenuineLossless ? 'true' : 'false');
    if (meta.bitrate) {
      res.setHeader('X-Audio-Bitrate', String(meta.bitrate));
    }
    if (meta.fallbackReason) {
      res.setHeader('X-Audio-Fallback-Reason', meta.fallbackReason);
    }

    res.setHeader(
      'Access-Control-Expose-Headers',
      'X-Audio-Codec, X-Audio-Container, X-Audio-Bit-Depth, X-Audio-Sample-Rate, X-Audio-Channels, X-Audio-Quality-Tier, X-Audio-Requested-Tier, X-Audio-Lossless, X-Audio-Bitrate, X-Audio-Fallback-Reason, Content-Range, Accept-Ranges, Content-Length, ETag, Last-Modified'
    );
  }
}

export const streamService = new StreamService();
