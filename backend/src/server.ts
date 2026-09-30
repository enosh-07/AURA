import http from 'http';
import { Server } from 'socket.io';
import { app } from './app.js';
import { ENV } from './config/env.js';
import { setupRoomSocket } from './sockets/room.socket.js';
import { setupDeviceSocket } from './sockets/device.socket.js';
import { settingsService } from './services/settings.service.js';

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => callback(null, true),
    credentials: true,
  },
});

setupRoomSocket(io);
setupDeviceSocket(io);

// Seed system presets on startup (idempotent)
settingsService.seedSystemPresets().catch((err) => {
  console.warn('⚠️  System preset seeding failed:', err.message);
});

server.listen(ENV.PORT, () => {
  console.log(`⚡ AURA Backend running on http://localhost:${ENV.PORT}`);
  console.log(`🚀 API Base URL: http://localhost:${ENV.PORT}/api/v1`);
  console.log(`📡 WebSocket Gateway: ws://localhost:${ENV.PORT}/ws`);
  console.log(`🤖 AI Provider: ${ENV.AI_PROVIDER}`);
  console.log(`💾 Storage Provider: ${ENV.STORAGE_PROVIDER}`);
});
