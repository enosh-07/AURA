# AURA — Backend API Contract & Specification

This document specifies the exact backend REST API and WebSocket interfaces required by the **AURA Next-Generation Music Player** frontend. It provides complete endpoint specifications, HTTP methods, request/response formats, authentication rules, TypeScript definitions, and an integration matrix.

A backend engineer or **Claude Code** can implement this API without ambiguity.

---

## Table of Contents

1. [Architecture & Protocol Standards](#1-architecture--protocol-standards)
2. [Authentication & Authorization](#2-authentication--authorization)
3. [Core Endpoints Specification](#3-core-endpoints-specification)
   - [3.1 Authentication & User Management](#31-authentication--user-management)
   - [3.2 Tracks & Audio Streaming](#32-tracks--audio-streaming)
   - [3.3 Lyrics Telemetry](#33-lyrics-telemetry)
   - [3.4 Playlists & Curation](#34-playlists--curation)
   - [3.5 Listening Telemetry & Analytics](#35-listening-telemetry--analytics)
   - [3.6 AURA AI Music Intelligence](#36-aura-ai-music-intelligence)
   - [3.7 Audio Lab & User Preferences](#37-audio-lab--user-preferences)
   - [3.8 Social Listening Rooms & WebSockets](#38-social-listening-rooms--websockets)
4. [Complete TypeScript Type Definitions](#4-complete-typescript-type-definitions)
5. [Frontend State & Mock vs Real Backend Matrix](#5-frontend-state--mock-vs-real-backend-matrix)
6. [Database Schema Mapping (PostgreSQL & Prisma Reference)](#6-database-schema-mapping-postgresql--prisma-reference)

---

## 1. Architecture & Protocol Standards

* **Base URL:** `http://localhost:4000/api/v1` (or configured via `VITE_API_BASE_URL`)
* **Transport:** HTTPS / HTTP/1.1 or HTTP/2
* **Audio Streaming Transport:** HTTP 206 Partial Content (Byte-Range requests)
* **Real-time Protocol:** WebSockets (`ws://localhost:4000/ws` or Socket.io)
* **Content Type:** `application/json` for data payloads; `multipart/form-data` for audio/image uploads
* **Standard Response Envelope:**
  ```json
  {
    "success": true,
    "data": { ... },
    "message": "Optional message",
    "meta": {
      "page": 1,
      "limit": 20,
      "total": 120
    }
  }
  ```
* **Standard Error Envelope:**
  ```json
  {
    "success": false,
    "error": {
      "code": "RESOURCE_NOT_FOUND",
      "message": "Track with ID track-123 was not found",
      "details": {}
    }
  }
  ```

---

## 2. Authentication & Authorization

* **Mechanism:** JWT (JSON Web Tokens) with short-lived Access Tokens (15 min) and long-lived Refresh Tokens (7 days) via HTTP-only Cookies or Bearer header.
* **Header Format:**
  ```http
  Authorization: Bearer <access_token>
  ```
* **Protected Routes:** All routes under `/api/v1/users`, `/api/v1/playlists` (mutation), `/api/v1/analytics`, `/api/v1/rooms`, and `/api/v1/tracks/:id/like` require an authenticated session.
* **Public Routes:** `GET /api/v1/tracks`, `GET /api/v1/tracks/:id/stream`, `GET /api/v1/tracks/:id/lyrics`, `POST /api/v1/auth/login`, `POST /api/v1/auth/register`.

---

## 3. Core Endpoints Specification

### 3.1 Authentication & User Management

#### `POST /api/v1/auth/register`
Creates a new user account and seeds default preferences.
* **Auth:** Public
* **Request Body:**
  ```json
  {
    "name": "Alex Mercer",
    "email": "alex@aura.audio",
    "password": "SecurePassword123!"
  }
  ```
* **Response (201 Created):**
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "usr_c819a",
        "name": "Alex Mercer",
        "email": "alex@aura.audio",
        "avatarUrl": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200",
        "createdAt": "2026-09-20T14:00:00Z"
      },
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "d8a19bc8f..."
    }
  }
  ```

#### `POST /api/v1/auth/login`
Authenticates user with email and password.
* **Auth:** Public
* **Request Body:**
  ```json
  {
    "email": "alex@aura.audio",
    "password": "SecurePassword123!"
  }
  ```
* **Response (200 OK):** Same structure as register.

#### `GET /api/v1/auth/me`
Fetches the currently authenticated user's profile and preferences.
* **Auth:** Required (`Bearer`)
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "id": "usr_c819a",
      "name": "Alex Mercer",
      "email": "alex@aura.audio",
      "avatarUrl": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200",
      "preferences": {
        "accentColor": "#00f2fe",
        "theme": "dark",
        "visualizerMode": "bars",
        "reducedMotion": false,
        "defaultVolume": 0.8
      }
    }
  }
  ```

---

### 3.2 Tracks & Audio Streaming

#### `GET /api/v1/tracks`
Fetches a paginated catalog of available tracks with support for fuzzy search, genre filtering, and mood querying.
* **Auth:** Public
* **Query Parameters:**
  | Param | Type | Required | Description |
  | :--- | :--- | :--- | :--- |
  | `q` | string | No | Search query for title, artist, or album |
  | `genre` | string | No | Filter by genre (e.g., `Synthwave`, `Lo-Fi`, `Ambient`) |
  | `mood` | string | No | Filter by mood (e.g., `Focus`, `Chill`, `Energy`, `Workout`) |
  | `page` | integer | No | Default `1` |
  | `limit` | integer | No | Default `20`, Max `100` |
  | `sort` | string | No | `popular`, `recent`, `bpm`, `duration` |
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "track-1",
        "title": "Neon Horizon",
        "artist": "CYBERPULSE",
        "album": "Odyssey 2099",
        "duration": 194,
        "genre": "Synthwave",
        "year": 2024,
        "bpm": 124,
        "mood": "Energy",
        "accentColor": "#00f2fe",
        "artworkUrl": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=800",
        "audioUrl": "/api/v1/tracks/track-1/stream",
        "isLiked": true,
        "playCount": 1420
      }
    ],
    "meta": {
      "page": 1,
      "limit": 20,
      "total": 6,
      "totalPages": 1
    }
  }
  ```

#### `GET /api/v1/tracks/:id`
Returns single track details.
* **Auth:** Public / Optional Bearer (to return `isLiked` status for user)

#### `GET /api/v1/tracks/:id/stream`
Streams the binary audio file supporting HTTP 206 Partial Content range requests for seamless timeline scrubbing and zero latency.
* **Auth:** Public
* **Request Headers:**
  ```http
  Range: bytes=0-1048576
  ```
* **Response Headers (206 Partial Content):**
  ```http
  Content-Type: audio/mpeg
  Content-Range: bytes 0-1048576/4194304
  Content-Length: 1048577
  Accept-Ranges: bytes
  ```

#### `POST /api/v1/tracks/:id/like`
Adds track to user's Liked Songs collection.
* **Auth:** Required (`Bearer`)
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": { "trackId": "track-1", "isLiked": true }
  }
  ```

#### `DELETE /api/v1/tracks/:id/like`
Removes track from user's Liked Songs collection.
* **Auth:** Required (`Bearer`)
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": { "trackId": "track-1", "isLiked": false }
  }
  ```

---

### 3.3 Lyrics Telemetry

#### `GET /api/v1/tracks/:id/lyrics`
Retrieves time-synchronized LRC lyrics and plain-text fallbacks for a track.
* **Auth:** Public
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "trackId": "track-1",
      "hasSync": true,
      "format": "lrc",
      "lines": [
        { "time": 0, "text": "[Instrumental Intro - Analog Arpeggio]" },
        { "time": 14, "text": "Midnight lights along the coastal grid" },
        { "time": 22, "text": "Chasing shadows where the skyline hid" },
        { "time": 30, "text": "Electric pulse, the engines hum tonight" },
        { "time": 38, "text": "We break away into the violet light" }
      ],
      "plainLyrics": "Midnight lights along the coastal grid\nChasing shadows where the skyline hid..."
    }
  }
  ```

---

### 3.4 Playlists & Curation

#### `GET /api/v1/playlists`
Retrieves playlists created by the user or marked as public/curated.
* **Auth:** Optional Bearer (returns public + user's playlists)
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "pl-synthwave",
        "title": "Neon Nights & Cyber City",
        "description": "Analog synthesizers and retro-futuristic basslines.",
        "coverUrl": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=800",
        "isPublic": true,
        "trackCount": 2,
        "totalDuration": 402,
        "createdAt": "2026-09-20T10:00:00Z",
        "owner": {
          "id": "usr_system",
          "name": "AURA Editorial"
        }
      }
    ]
  }
  ```

#### `GET /api/v1/playlists/:id`
Retrieves full playlist with embedded track objects.
* **Auth:** Public for public playlists; Required for private user playlists
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "id": "pl-synthwave",
      "title": "Neon Nights & Cyber City",
      "description": "Analog synthesizers and retro-futuristic basslines.",
      "coverUrl": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=800",
      "tracks": [
        {
          "id": "track-1",
          "title": "Neon Horizon",
          "artist": "CYBERPULSE",
          "duration": 194,
          "artworkUrl": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=800",
          "audioUrl": "/api/v1/tracks/track-1/stream"
        }
      ]
    }
  }
  ```

#### `POST /api/v1/playlists`
Creates a custom user playlist.
* **Auth:** Required (`Bearer`)
* **Request Body:**
  ```json
  {
    "title": "Late Night Coding Session",
    "description": "Lo-Fi and Ambient soundscapes for intense focus.",
    "coverUrl": "https://images.unsplash.com/photo-1514565131-fce0801e5785?w=800",
    "isPublic": false,
    "trackIds": ["track-2", "track-3"]
  }
  ```
* **Response (201 Created):** Created Playlist object.

#### `POST /api/v1/playlists/:id/tracks`
Adds track(s) to a playlist.
* **Auth:** Required (`Bearer`)
* **Request Body:**
  ```json
  {
    "trackId": "track-5",
    "position": 3
  }
  ```

#### `DELETE /api/v1/playlists/:id/tracks/:trackId`
Removes a track from a playlist.
* **Auth:** Required (`Bearer`)
* **Response (200 OK):** `{ "success": true }`

---

### 3.5 Listening Telemetry & Analytics

#### `POST /api/v1/analytics/listen`
Logs an acoustic playback event when the user listens to a track.
* **Auth:** Required (`Bearer`)
* **Request Body:**
  ```json
  {
    "trackId": "track-1",
    "durationListened": 180,
    "completed": true,
    "timestamp": 1789895000000,
    "clientTelemetry": {
      "visualizerMode": "bars",
      "audioLabPreset": "Bass Heavy",
      "eqBypassed": false
    }
  }
  ```
* **Response (202 Accepted):**
  ```json
  {
    "success": true,
    "data": { "logged": true }
  }
  ```

#### `GET /api/v1/analytics/insights`
Calculates and returns user listening statistics and visualizations.
* **Auth:** Required (`Bearer`)
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "totalMinutes": 142,
      "listeningStreakDays": 7,
      "diversityIndex": 0.94,
      "topGenres": [
        { "genre": "Lo-Fi", "playCount": 19, "percentage": 37 },
        { "genre": "Synthwave", "playCount": 14, "percentage": 27 },
        { "genre": "Electronic", "playCount": 11, "percentage": 21 },
        { "genre": "Ambient", "playCount": 8, "percentage": 15 }
      ],
      "dailyActivity": [
        { "date": "2026-09-14", "minutes": 24 },
        { "date": "2026-09-15", "minutes": 35 },
        { "date": "2026-09-16", "minutes": 18 },
        { "date": "2026-09-17", "minutes": 42 },
        { "date": "2026-09-18", "minutes": 50 },
        { "date": "2026-09-19", "minutes": 38 },
        { "date": "2026-09-20", "minutes": 15 }
      ],
      "topTracks": [
        { "trackId": "track-2", "title": "Midnight Rain in Shibuya", "playCount": 19 },
        { "trackId": "track-1", "title": "Neon Horizon", "playCount": 14 }
      ]
    }
  }
  ```

---

### 3.6 AURA AI Music Intelligence

#### `POST /api/v1/ai/curate`
Proxies natural language intent queries through server-side LLM orchestration (Google Gemini 1.5 Flash or Claude/OpenAI) using securely stored backend API keys.
* **Auth:** Optional / Required (rate-limited for unauthenticated users)
* **Request Body:**
  ```json
  {
    "prompt": "Play something calm for studying with no vocal distractions",
    "currentTrackId": "track-1",
    "userMood": "Focus",
    "context": {
      "currentTimeZone": "Asia/Kolkata",
      "hourOfDay": 14
    }
  }
  ```
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "message": "I've synthesized a deep focus session for you. Lowered transient dynamics, warm harmonic saturation, and zero intrusive vocals.",
      "reasoning": "Selected tracks with sub-90 BPM and gentle ambient frequencies.",
      "suggestedTracks": [
        {
          "id": "track-2",
          "title": "Midnight Rain in Shibuya",
          "artist": "Komorebi & Sora",
          "duration": 168
        },
        {
          "id": "track-3",
          "title": "Deep Quantum Drift",
          "artist": "Aetheria Protocol",
          "duration": 220
        }
      ],
      "action": {
        "type": "CREATE_PLAYLIST",
        "label": "Start Focus Flow Mix",
        "payload": {
          "title": "Deep Focus & Flow",
          "trackIds": ["track-2", "track-3"]
        }
      }
    }
  }
  ```

---

### 3.7 Audio Lab & User Preferences

#### `GET /api/v1/users/preferences/audio-lab`
Fetches user's saved 10-Band EQ settings and DSP profiles.
* **Auth:** Required (`Bearer`)
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "bands": [7.0, 6.0, 4.5, 2.0, 0, -1.0, -1.0, 0, 1.0, 1.5],
      "bassBoost": 6.0,
      "treble": 0.0,
      "stereoPan": 0.0,
      "reverbLevel": 0.15,
      "isBypassed": false,
      "preset": "Bass Heavy"
    }
  }
  ```

#### `PUT /api/v1/users/preferences/audio-lab`
Persists user's equalizer and DSP preferences across sessions.
* **Auth:** Required (`Bearer`)
* **Request Body:** Same as response above.
* **Response (200 OK):** `{ "success": true }`

---

### 3.8 Social Listening Rooms & WebSockets

#### `POST /api/v1/rooms`
Creates a real-time synchronized listening room.
* **Auth:** Required (`Bearer`)
* **Request Body:**
  ```json
  {
    "name": "CYBERPULSE Sonic Node #404",
    "isPrivate": false
  }
  ```
* **Response (201 Created):**
  ```json
  {
    "success": true,
    "data": {
      "roomId": "node-404",
      "name": "CYBERPULSE Sonic Node #404",
      "hostId": "usr_c819a",
      "wsEndpoint": "ws://localhost:4000/ws/rooms/node-404",
      "inviteUrl": "http://localhost:3000?room=node-404"
    }
  }
  ```

#### WebSocket Gateway (`/ws/rooms/:roomId`)
Bi-directional real-time communication for playback sync and live room chat.

* **Client Message Types:**
  1. `JOIN_ROOM`: `{ "type": "JOIN_ROOM", "userId": "usr_c819a", "token": "..." }`
  2. `HOST_SYNC_PLAY`: `{ "type": "HOST_SYNC_PLAY", "trackId": "track-1", "timestamp": 42.5 }`
  3. `HOST_SYNC_PAUSE`: `{ "type": "HOST_SYNC_PAUSE", "timestamp": 42.5 }`
  4. `HOST_SYNC_SEEK`: `{ "type": "HOST_SYNC_SEEK", "timestamp": 75.0 }`
  5. `CHAT_MESSAGE`: `{ "type": "CHAT_MESSAGE", "text": "This track sounds amazing in quantum sync!" }`

* **Server Broadcast Events:**
  1. `ROOM_STATE`: Emitted on connection with current track, position, playing boolean, and participants.
  2. `PLAYBACK_SYNC`: Sent to all listeners to synchronize HTML5 audio currentTime (`±50ms` tolerance).
  3. `USER_JOINED` / `USER_LEFT`: Updates participant count and ping table.
  4. `CHAT_BROADCAST`: Broadcasts chat message with sender metadata and server timestamp.

---

## 4. Complete TypeScript Type Definitions

Backend engineers should use these exact interfaces in Express controllers, Prisma queries, and WebSocket handlers:

```typescript
// ==========================================
// User & Auth
// ==========================================
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface UserPreferences {
  accentColor: string;
  theme: 'dark' | 'light';
  visualizerMode: VisualizerMode;
  visualizerIntensity: number;
  reducedMotion: boolean;
  defaultVolume: number;
}

// ==========================================
// Track & Audio
// ==========================================
export interface TrackDto {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // in seconds
  genre: string;
  year?: number;
  bpm?: number;
  mood?: string;
  accentColor: string;
  artworkUrl: string;
  audioUrl: string;
  isLiked?: boolean;
  playCount?: number;
}

export interface LyricsLineDto {
  time: number; // in seconds
  text: string;
}

export interface LyricsResponseDto {
  trackId: string;
  hasSync: boolean;
  format: 'lrc' | 'plain';
  lines: LyricsLineDto[];
  plainLyrics?: string;
}

// ==========================================
// Playlists
// ==========================================
export interface PlaylistSummaryDto {
  id: string;
  title: string;
  description: string;
  coverUrl: string;
  isPublic: boolean;
  trackCount: number;
  totalDuration: number;
  createdAt: string;
  owner: {
    id: string;
    name: string;
  };
}

export interface PlaylistDetailDto extends PlaylistSummaryDto {
  tracks: TrackDto[];
}

export interface CreatePlaylistInput {
  title: string;
  description?: string;
  coverUrl?: string;
  isPublic?: boolean;
  trackIds?: string[];
}

// ==========================================
// Audio Lab & DSP Settings
// ==========================================
export interface AudioLabSettingsDto {
  bands: number[]; // 10 ISO bands: 32Hz, 64Hz, 125Hz, 250Hz, 500Hz, 1kHz, 2kHz, 4kHz, 8kHz, 16kHz (-12 to +12 dB)
  bassBoost: number; // 0 to +12 dB
  treble: number; // -12 to +12 dB
  stereoPan: number; // -1 (Left) to +1 (Right)
  reverbLevel: number; // 0.0 to 1.0
  isBypassed: boolean;
  preset: string;
}

// ==========================================
// Listening Telemetry & Insights
// ==========================================
export interface LogPlaybackInput {
  trackId: string;
  durationListened: number;
  completed: boolean;
  timestamp: number;
}

export interface ListeningInsightsDto {
  totalMinutes: number;
  listeningStreakDays: number;
  diversityIndex: number;
  topGenres: Array<{
    genre: string;
    playCount: number;
    percentage: number;
  }>;
  dailyActivity: Array<{
    date: string; // YYYY-MM-DD
    minutes: number;
  }>;
  topTracks: Array<{
    trackId: string;
    title: string;
    artist?: string;
    playCount: number;
  }>;
}

// ==========================================
// AI Companion
// ==========================================
export interface AICurationInput {
  prompt: string;
  currentTrackId?: string;
  userMood?: string;
}

export interface AICurationResponseDto {
  message: string;
  reasoning?: string;
  suggestedTracks: TrackDto[];
  action?: {
    type: 'PLAY_TRACK' | 'CREATE_PLAYLIST' | 'SET_MOOD' | 'OPEN_VIEW';
    label: string;
    payload?: unknown;
  };
}

// ==========================================
// Social Listening Room
// ==========================================
export interface RoomParticipantDto {
  id: string;
  name: string;
  avatar: string;
  role: 'host' | 'listener';
  ping: number;
}

export interface RoomStateDto {
  roomId: string;
  name: string;
  hostId: string;
  currentTrack: TrackDto | null;
  currentTime: number;
  isPlaying: boolean;
  participants: RoomParticipantDto[];
}
```

---

## 5. Frontend State & Mock vs Real Backend Matrix

| Feature | Current Frontend Implementation | Backend Required for Production |
| :--- | :--- | :--- |
| **Catalog Audio Playback** | Seeded sample tracks with Pixabay/Wikimedia CDN URLs & Web Audio synth fallback. | Stream endpoints (`/tracks/:id/stream`) with HTTP 206 Byte-Range streaming from S3/Postgres. |
| **Synchronized LRC Lyrics** | In-memory timestamped LRC data in `src/audio/sampleTracks.ts`. | Dynamic LRC file storage & delivery via `GET /tracks/:id/lyrics`. |
| **Local Music Studio** | Client-side File API + ID3v2 parser + IndexedDB storage (`idb-keyval`). | Stays client-side (no backend required for private playback), with optional cloud sync endpoint (`/tracks/upload`). |
| **Playlists & Liked Songs** | Seeded playlists + Local IndexedDB mutations (`src/services/idbStorage.ts`). | Persistent database storage via PostgreSQL & Prisma (`/playlists` & `/tracks/:id/like`). |
| **Audio Lab (10-Band EQ)** | Real client-side Web Audio DSP graph in browser memory. | User profile sync (`/users/preferences/audio-lab`) so EQ presets persist across devices. |
| **8-Mode Audio Visualizer** | 100% client-side Web Audio `AnalyserNode` connected to 60 FPS HTML5 Canvas. | None required (client-side rendering is ideal for 0ms latency). |
| **AI Music Companion** | Client-side semantic intent engine + direct user API key option. | Secure backend AI proxy (`POST /api/v1/ai/curate`) with server-side LLM API key handling. |
| **Listening Insights** | Seeded numbers + client-side IndexedDB logging (`useAnalyticsStore.ts`). | Aggregated user listen event logging and statistics computation (`/analytics/insights`). |
| **Sync Listening Room** | Client-side simulated room state with local mock participants and chat. | Real-time WebSocket server gateway (`/ws/rooms/:roomId`) syncing audio timestamps and chat. |

---

## 6. Database Schema Mapping (PostgreSQL & Prisma Reference)

For Claude Code or a Node.js + Prisma backend, the schema directly maps to:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id           String        @id @default(uuid())
  email        String        @unique
  passwordHash String
  name         String
  avatarUrl    String?
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  preferences  UserPreference?
  playlists    Playlist[]
  likedTracks  UserLikedTrack[]
  history      ListeningHistory[]
}

model UserPreference {
  id             String   @id @default(uuid())
  userId         String   @unique
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  accentColor    String   @default("#00f2fe")
  theme          String   @default("dark")
  visualizerMode String   @default("bars")
  eqBands        Float[]  @default([0,0,0,0,0,0,0,0,0,0])
  bassBoost      Float    @default(0)
  treble         Float    @default(0)
  stereoPan      Float    @default(0)
  reverbLevel    Float    @default(0)
  eqPreset       String   @default("Flat Studio")
  eqBypassed     Boolean  @default(false)
}

model Track {
  id          String   @id @default(uuid())
  title       String
  artist      String
  album       String
  duration    Int      // in seconds
  genre       String
  year        Int?
  bpm         Int?
  mood        String?
  accentColor String   @default("#00f2fe")
  artworkUrl  String
  audioFileUrl String
  lyricsLrc   String?  @db.Text
  plainLyrics String?  @db.Text
  createdAt   DateTime @default(now())

  playlistTracks PlaylistTrack[]
  likedBy        UserLikedTrack[]
  history        ListeningHistory[]
}

model Playlist {
  id          String   @id @default(uuid())
  title       String
  description String?
  coverUrl    String?
  isPublic    Boolean  @default(false)
  ownerId     String
  owner       User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tracks      PlaylistTrack[]
}

model PlaylistTrack {
  id         String   @id @default(uuid())
  playlistId String
  playlist   Playlist @relation(fields: [playlistId], references: [id], onDelete: Cascade)
  trackId    String
  track      Track    @relation(fields: [trackId], references: [id], onDelete: Cascade)
  position   Int

  @@unique([playlistId, trackId])
}

model UserLikedTrack {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  trackId   String
  track     Track    @relation(fields: [trackId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@unique([userId, trackId])
}

model ListeningHistory {
  id               String   @id @default(uuid())
  userId           String
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  trackId          String
  track            Track    @relation(fields: [trackId], references: [id], onDelete: Cascade)
  durationListened Int      // in seconds
  completed        Boolean  @default(false)
  timestamp        DateTime @default(now())
}
```
