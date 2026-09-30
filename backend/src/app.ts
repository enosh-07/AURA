import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { ENV } from './config/env.js';
import { errorHandler } from './middleware/error.middleware.js';
import { generalLimiter } from './middleware/ratelimit.middleware.js';

import authRoutes from './routes/auth.routes.js';
import trackRoutes from './routes/track.routes.js';
import playlistRoutes from './routes/playlist.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import aiRoutes from './routes/ai.routes.js';
import roomRoutes from './routes/room.routes.js';
import storageRoutes from './routes/storage.routes.js';
import deviceRoutes from './routes/device.routes.js';
import downloadRoutes from './routes/download.routes.js';
import recommendationRoutes from './routes/recommendation.routes.js';
import settingsRoutes from './routes/settings.routes.js';

export const app = express();

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, native desktop apps)
      if (!origin) return callback(null, true);
      if (
        origin.includes('localhost') ||
        origin.includes('127.0.0.1') ||
        origin.startsWith('tauri://') ||
        origin.startsWith('http://tauri.localhost') ||
        origin.startsWith('https://tauri.localhost') ||
        origin.startsWith('capacitor://') ||
        origin === ENV.CLIENT_URL
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Range'],
    exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length'],
  })
);

app.use(morgan('dev'));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply general rate limiting to all API routes
app.use('/api/', generalLimiter);

// Healthcheck
app.get('/api/v1/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/tracks', trackRoutes);
app.use('/api/v1/playlists', playlistRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/rooms', roomRoutes);
app.use('/api/v1/storage', storageRoutes);
app.use('/api/v1/devices', deviceRoutes);
app.use('/api/v1/downloads', downloadRoutes);
app.use('/api/v1/recommendations', recommendationRoutes);
app.use('/api/v1/settings', settingsRoutes);

// Error handling middleware (must be last)
app.use(errorHandler);
