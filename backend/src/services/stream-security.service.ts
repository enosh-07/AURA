/**
 * AURA Stream Security & Authorization Service
 * ============================================
 * Generates and validates cryptographic signed stream tokens, manages URL expiration,
 * enforces stream authorization, and controls active concurrent streaming sessions.
 */

import crypto from 'crypto';
import { ENV } from '../config/env.js';
import { QualityTier } from './audioValidation.service.js';

export interface StreamTokenPayload {
  trackId: string;
  userId: string;
  tier: QualityTier;
  exp: number; // Unix timestamp in seconds
  nonce: string;
}

export interface ActiveStreamSession {
  userId: string;
  trackId: string;
  clientIp: string;
  startedAt: number;
  lastHeartbeat: number;
}

export class StreamSecurityService {
  private readonly secretKey: string;
  private readonly defaultExpirySeconds: number = 7200; // 2 hours
  private readonly maxConcurrentStreamsPerUser: number = 3;

  // Active in-flight stream sessions: userId -> ActiveStreamSession[]
  private activeStreams: Map<string, ActiveStreamSession[]> = new Map();

  constructor() {
    this.secretKey = ENV.JWT_ACCESS_SECRET || 'aura_stream_security_master_key_default';
    // Run cleanup for stale sessions every 30 seconds
    setInterval(() => this.cleanupStaleSessions(), 30000).unref();
  }

  /**
   * Generates a signed stream token and full signed stream URL
   */
  public generateSignedToken(
    trackId: string,
    userId: string = 'public_listener',
    tier: QualityTier = 'HI_RES_LOSSLESS',
    expiresInSeconds: number = this.defaultExpirySeconds
  ): { token: string; expiresAt: number; streamPath: string } {
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const nonce = crypto.randomBytes(8).toString('hex');

    const dataToSign = `${trackId}:${userId}:${tier}:${exp}:${nonce}`;
    const hmac = crypto.createHmac('sha256', this.secretKey).update(dataToSign).digest('hex');

    // Token format: base64(dataToSign).hmac
    const payloadEncoded = Buffer.from(dataToSign, 'utf-8').toString('base64url');
    const token = `${payloadEncoded}.${hmac}`;

    return {
      token,
      expiresAt: exp * 1000,
      streamPath: `/api/v1/tracks/${trackId}/stream?token=${encodeURIComponent(token)}&tier=${tier}`,
    };
  }

  /**
   * Verifies the cryptographic signature, expiration, and format of a stream token
   */
  public verifyToken(
    trackId: string,
    token: string
  ): { isValid: boolean; payload?: StreamTokenPayload; error?: string } {
    if (!token) {
      return { isValid: false, error: 'MISSING_STREAM_TOKEN' };
    }

    try {
      const [payloadB64, signature] = token.split('.');
      if (!payloadB64 || !signature) {
        return { isValid: false, error: 'INVALID_TOKEN_FORMAT' };
      }

      const decoded = Buffer.from(payloadB64, 'base64url').toString('utf-8');
      const parts = decoded.split(':');
      if (parts.length < 5) {
        return { isValid: false, error: 'MALFORMED_TOKEN_PAYLOAD' };
      }

      const [tokenTrackId, userId, tier, expStr, nonce] = parts;
      const exp = parseInt(expStr, 10);

      // Verify trackId matches
      if (tokenTrackId !== trackId) {
        return { isValid: false, error: 'TOKEN_TRACK_MISMATCH' };
      }

      // Verify expiration
      const nowSec = Math.floor(Date.now() / 1000);
      if (nowSec > exp) {
        return { isValid: false, error: 'STREAM_TOKEN_EXPIRED' };
      }

      // Verify HMAC signature
      const expectedHmac = crypto.createHmac('sha256', this.secretKey).update(decoded).digest('hex');
      const sigBuffer = Buffer.from(signature, 'hex');
      const expectedBuffer = Buffer.from(expectedHmac, 'hex');

      if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
        return { isValid: false, error: 'INVALID_SIGNATURE' };
      }

      return {
        isValid: true,
        payload: {
          trackId: tokenTrackId,
          userId,
          tier: tier as QualityTier,
          exp,
          nonce,
        },
      };
    } catch (err: any) {
      return { isValid: false, error: err.message || 'VERIFICATION_FAILED' };
    }
  }

  /**
   * Enforces concurrent stream limitations per user
   */
  public registerStreamSession(userId: string, trackId: string, clientIp: string): { allowed: boolean; activeCount: number } {
    if (!userId || userId === 'public_listener' || userId === 'anonymous') {
      return { allowed: true, activeCount: 1 };
    }

    this.cleanupStaleSessions();

    const userSessions = this.activeStreams.get(userId) || [];

    // If already playing this track from this IP, refresh heartbeat
    const existing = userSessions.find((s) => s.trackId === trackId && s.clientIp === clientIp);
    if (existing) {
      existing.lastHeartbeat = Date.now();
      return { allowed: true, activeCount: userSessions.length };
    }

    // Check limit
    if (userSessions.length >= this.maxConcurrentStreamsPerUser) {
      return { allowed: false, activeCount: userSessions.length };
    }

    // Register new session
    userSessions.push({
      userId,
      trackId,
      clientIp,
      startedAt: Date.now(),
      lastHeartbeat: Date.now(),
    });

    this.activeStreams.set(userId, userSessions);
    return { allowed: true, activeCount: userSessions.length };
  }

  /**
   * Cleans up stream sessions older than 45 seconds
   */
  public cleanupStaleSessions(): void {
    const cutoff = Date.now() - 45000; // 45s heartbeat window
    for (const [userId, sessions] of this.activeStreams.entries()) {
      const active = sessions.filter((s) => s.lastHeartbeat > cutoff);
      if (active.length === 0) {
        this.activeStreams.delete(userId);
      } else {
        this.activeStreams.set(userId, active);
      }
    }
  }
}

export const streamSecurityService = new StreamSecurityService();
