/**
 * Device Socket — Cross-device playback synchronization
 *
 * Real-time events:
 *  - playback.updated  — user updated playback state on a device
 *  - device.connected  — device joined user's session
 *  - device.disconnected — device left user's session
 *  - queue.updated     — queue changed
 *
 * Security: each user joins their own private room (userId).
 * No cross-user leakage.
 */

import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { deviceService } from '../services/device.service.js';

export const setupDeviceSocket = (io: Server) => {
  const deviceNamespace = io.of('/ws/devices');

  deviceNamespace.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token as string;
    if (!token) {
      next(new Error('Authentication required for device sync.'));
      return;
    }
    try {
      const decoded = jwt.verify(token, ENV.JWT_ACCESS_SECRET) as { id: string; email: string };
      (socket as any).userId = decoded.id;
      next();
    } catch {
      next(new Error('Invalid token.'));
    }
  });

  deviceNamespace.on('connection', (socket: Socket) => {
    const userId = (socket as any).userId as string;
    if (!userId) { socket.disconnect(); return; }

    // Join user's private room
    socket.join(`user:${userId}`);

    // Notify other devices this device connected
    socket.to(`user:${userId}`).emit('device.connected', {
      socketId: socket.id,
      timestamp: new Date().toISOString(),
    });

    /** Update playback state and broadcast to all other user devices */
    socket.on('playback.update', async (data: {
      deviceId?: string;
      currentTrackId?: string;
      positionSec?: number;
      isPlaying?: boolean;
      volume?: number;
      queue?: string[];
      playbackMode?: string;
    }) => {
      try {
        await deviceService.updatePlaybackState(userId, data.deviceId, {
          currentTrackId: data.currentTrackId,
          positionSec: data.positionSec,
          isPlaying: data.isPlaying,
          volume: data.volume,
          queueJson: data.queue ? JSON.stringify(data.queue) : undefined,
          playbackMode: data.playbackMode as any,
        });

        // Broadcast to all OTHER devices of this user
        socket.to(`user:${userId}`).emit('playback.updated', {
          ...data,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        socket.emit('error', { message: 'Failed to sync playback state.' });
      }
    });

    /** Queue updated event */
    socket.on('queue.update', (data: { deviceId?: string; queue: string[] }) => {
      socket.to(`user:${userId}`).emit('queue.updated', {
        queue: data.queue,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('disconnect', () => {
      socket.to(`user:${userId}`).emit('device.disconnected', {
        socketId: socket.id,
        timestamp: new Date().toISOString(),
      });
    });
  });
};
