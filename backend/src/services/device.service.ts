/**
 * Device Service — Cross-device playback synchronization.
 *
 * Each authenticated user can register multiple devices.
 * Playback state is synced via REST + WebSocket events.
 *
 * Platform note: real-time sync requires an active network connection.
 * This service stores the last known state; WS events push live updates.
 */

import { prisma } from './prisma.js';

export type PlaybackMode = 'normal' | 'shuffle' | 'repeat' | 'repeat_one';

export class DeviceService {
  // ============================================================
  // DEVICE REGISTRATION
  // ============================================================

  async registerDevice(userId: string, data: {
    name: string;
    platform: string;
    browser?: string;
    userAgent?: string;
    deviceId?: string; // client-provided stable ID
  }) {
    // If client sent a stable deviceId, upsert on it
    if (data.deviceId) {
      const existing = await prisma.device.findFirst({
        where: { id: data.deviceId, userId },
      });
      if (existing) {
        return prisma.device.update({
          where: { id: data.deviceId },
          data: {
            name: data.name,
            platform: data.platform,
            browser: data.browser,
            userAgent: data.userAgent,
            lastSeenAt: new Date(),
          },
        });
      }
    }

    return prisma.device.create({
      data: {
        id: data.deviceId,
        userId,
        name: data.name,
        platform: data.platform,
        browser: data.browser,
        userAgent: data.userAgent,
      },
    });
  }

  async getDevices(userId: string) {
    return prisma.device.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  async deleteDevice(userId: string, deviceId: string) {
    const device = await prisma.device.findFirst({ where: { id: deviceId, userId } });
    if (!device) throw new Error('Device not found.');
    await prisma.device.delete({ where: { id: deviceId } });
    return { success: true };
  }

  async touchDevice(deviceId: string) {
    await prisma.device.updateMany({
      where: { id: deviceId },
      data: { lastSeenAt: new Date() },
    });
  }

  // ============================================================
  // PLAYBACK STATE
  // ============================================================

  async updatePlaybackState(userId: string, deviceId: string | undefined, data: {
    currentTrackId?: string | null;
    positionSec?: number;
    isPlaying?: boolean;
    volume?: number;
    queueJson?: string;
    playbackMode?: PlaybackMode;
    losslessTier?: string;
    bitPerfectMode?: boolean;
  }) {
    return prisma.playbackSession.upsert({
      where: {
        // Unique per user+device — use userId as fallback key if no device
        id: deviceId ? `${userId}-${deviceId}` : userId,
      },
      update: {
        ...data,
        updatedAt: new Date(),
      },
      create: {
        id: deviceId ? `${userId}-${deviceId}` : userId,
        userId,
        deviceId: deviceId || undefined,
        currentTrackId: data.currentTrackId ?? null,
        positionSec: data.positionSec ?? 0,
        isPlaying: data.isPlaying ?? false,
        volume: data.volume ?? 0.8,
        queueJson: data.queueJson ?? '[]',
        playbackMode: data.playbackMode ?? 'normal',
        losslessTier: data.losslessTier ?? 'HI_RES_LOSSLESS',
        bitPerfectMode: data.bitPerfectMode ?? false,
      },
    });
  }

  async getPlaybackState(userId: string, deviceId?: string) {
    if (deviceId) {
      const session = await prisma.playbackSession.findUnique({
        where: { id: `${userId}-${deviceId}` },
      });
      if (session) return await this.formatSession(session);
    }

    // Return the most recently updated session for this user
    const latest = await prisma.playbackSession.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    return latest ? await this.formatSession(latest) : null;
  }

  async transferPlayback(userId: string, fromDeviceId: string, toDeviceId: string) {
    const fromState = await prisma.playbackSession.findUnique({
      where: { id: `${userId}-${fromDeviceId}` },
    });
    if (!fromState) throw new Error('No playback state found on source device.');

    // Copy state to target device
    const transferred = await this.updatePlaybackState(userId, toDeviceId, {
      currentTrackId: fromState.currentTrackId,
      positionSec: fromState.positionSec,
      isPlaying: fromState.isPlaying,
      volume: fromState.volume,
      queueJson: fromState.queueJson || '[]',
      playbackMode: fromState.playbackMode as PlaybackMode,
      losslessTier: fromState.losslessTier || undefined,
      bitPerfectMode: fromState.bitPerfectMode ?? false,
    });

    // Pause the source device
    await this.updatePlaybackState(userId, fromDeviceId, { isPlaying: false });

    return await this.formatSession(transferred);
  }

  private async formatSession(session: any) {
    let currentTrack = null;
    if (session.currentTrackId) {
      try {
        currentTrack = await prisma.track.findUnique({
          where: { id: session.currentTrackId },
        });
      } catch {}
    }

    return {
      ...session,
      currentTrack,
      queue: session.queueJson ? JSON.parse(session.queueJson) : [],
    };
  }
}

export const deviceService = new DeviceService();
