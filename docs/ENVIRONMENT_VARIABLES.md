# AURA Environment Variables Specification & Security Matrix

This document defines all configuration variables across the **AURA** web client, Next.js App Router, backend services, and third-party integrations (Supabase, Cloudflare R2, Resend).

---

## 1. Security Hierarchy & Exposure Rules

- **Client-Exposed (`NEXT_PUBLIC_*` / `VITE_*`):**
  - Bundled into client-side JavaScript binaries.
  - Visible to anyone inspecting network requests or application source code.
  - **NEVER** place service role keys, master secrets, S3 write keys, or payment credentials in client variables.
- **Server-Only (Private Secrets):**
  - Read solely by Node.js server environments or Vercel Serverless / Edge Route Handlers.
  - Kept strictly out of client builds and source control (`.gitignore`).

---

## 2. Frontend & Next.js Environment Variables

| Variable Name | Required | Default / Example | Scope | Description |
| :--- | :---: | :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` / `VITE_SUPABASE_URL` | **Yes** | `https://xyzcompany.supabase.co` | Client & Server | The REST and WebSocket endpoint for Supabase PostgreSQL and Realtime. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY` | **Yes** | `eyJhbGciOi...` | Client & Server | Public anonymous API key with RLS enforcement. Safe for browser exposure. |
| `NEXT_PUBLIC_MEDIA_URL` / `VITE_MEDIA_URL` | Optional | `https://media.aura.audio` | Client | CDN hostname for high-speed streaming of tracks, covers, and waveforms. |
| `VITE_API_URL` | Optional | `http://localhost:3001` (Dev) / `https://api.aura.audio` (Prod) | Client | Fallback REST API address when operating outside Vercel serverless routes. |
| `VITE_GEMINI_API_KEY` | Optional | `AIzaSy...` | Client | API key for client-side Gemini AI music companion suggestions. |
| `VITE_APP_NAME` | No | `AURA` | Client | Display name for the player UI. |
| `VITE_APP_VERSION` | No | `1.0.0` | Client | Application build and release identifier. |
| `VITE_ENABLE_LOSSLESS` | No | `true` | Client | Feature flag enabling 24-bit/96kHz high-resolution audio codecs. |
| `VITE_AUDIO_BUFFER_SIZE` | No | `4096` | Client | Web Audio API circular buffer length for DSP processing. |
| `VITE_ENABLE_VISUALIZER_HIGH_DPI` | No | `true` | Client | Enables Retina / High-DPI canvas scaling for 60fps audio visualizers. |

---

## 3. Backend & Vercel Serverless Environment Variables

### 3.1 Server Core & Security
| Variable Name | Required | Default / Example | Scope | Description |
| :--- | :---: | :--- | :--- | :--- |
| `PORT` | Optional | `3001` | Server | TCP port for local Node.js Express server. Ignored by Vercel serverless. |
| `NODE_ENV` | **Yes** | `production` / `development` | Server | Runtime environment mode. Enforces strict secret checks when `production`. |
| `CORS_ORIGIN` | Optional | `http://localhost:3000,https://aura.audio` | Server | Comma-separated list of allowed origins for cross-origin resource sharing. |
| `JWT_SECRET` | Optional | `min-32-char-random-secret` | Server | Legacy fallback JWT signing secret if Supabase Auth is unavailable. |
| `JWT_EXPIRES_IN` | Optional | `7d` | Server | Expiration window for legacy session tokens. |

### 3.2 Supabase Service Integration
| Variable Name | Required | Default / Example | Scope | Description |
| :--- | :---: | :--- | :--- | :--- |
| `SUPABASE_URL` | **Yes** | `https://xyzcompany.supabase.co` | Server | Base project URL for server-side Supabase client. |
| `SUPABASE_ANON_KEY` | **Yes** | `eyJhbGciOi...` | Server | Anonymous key for public server queries. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | `eyJhbGciOi...` | Server (Private) | **Elevated privilege key**. Bypasses RLS for administrative operations. |
| `SUPABASE_JWT_SECRET` | Optional | `your-supabase-jwt-secret` | Server (Private) | Secret used by Supabase to sign auth JWTs, enabling zero-network token verification. |

### 3.3 Cloudflare R2 Media Storage
| Variable Name | Required | Default / Example | Scope | Description |
| :--- | :---: | :--- | :--- | :--- |
| `STORAGE_PROVIDER` | **Yes** | `r2` (or `local` in dev) | Server | Active storage backend adapter (`r2` or `local`). |
| `CLOUDFLARE_R2_ENDPOINT` | If `r2` | `https://<account-id>.r2.cloudflarestorage.com` | Server (Private) | S3-compatible API endpoint for Cloudflare R2 account. |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | If `r2` | `<access-key-id>` | Server (Private) | Cloudflare R2 API token access key ID. |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | If `r2` | `<secret-access-key>` | Server (Private) | Cloudflare R2 API token secret key. |
| `CLOUDFLARE_R2_BUCKET_NAME` | If `r2` | `aura-media-production` | Server | Target bucket name storing audio masters and media assets. |
| `CLOUDFLARE_R2_PUBLIC_URL` | Optional | `https://media.aura.audio` | Server & Client | Custom domain URL for public CDN playback and asset retrieval. |
| `LOCAL_STORAGE_PATH` | If `local` | `./uploads` | Server | Local disk path used when running purely in offline/local mock mode. |

### 3.4 Resend Transactional Email
| Variable Name | Required | Default / Example | Scope | Description |
| :--- | :---: | :--- | :--- | :--- |
| `RESEND_API_KEY` | Optional | `re_123456789...` | Server (Private) | API authorization key generated in the Resend console. |
| `RESEND_FROM_EMAIL` | Optional | `AURA Music <notifications@aura.audio>` | Server | Verified sender address configured in DNS. Defaults to Resend test sender if unconfigured. |

### 3.5 Rate Limiting & Edge Caching
| Variable Name | Required | Default / Example | Scope | Description |
| :--- | :---: | :--- | :--- | :--- |
| `RATE_LIMIT_WINDOW_MS` | No | `900000` (15 mins) | Server | Time window for rate limiter. |
| `RATE_LIMIT_MAX_REQUESTS` | No | `100` | Server | Max allowed requests per IP within the window. |
| `CACHE_MAX_AGE_AUDIO` | No | `31536000` (1 year) | Server | `Cache-Control: max-age` header for immutable audio segments. |
| `CACHE_MAX_AGE_LYRICS` | No | `86400` (24 hours) | Server | `Cache-Control: max-age` header for synchronized lyrics data. |
| `CACHE_MAX_AGE_METADATA` | No | `3600` (1 hour) | Server | `Cache-Control: max-age` header for track and artist catalog metadata. |

---

## 4. Environment Validation & Boot Diagnostics

The AURA backend includes automated environment validation via [`backend/src/config/env.ts`](file:///c:/Users/benos/Desktop/AURA/backend/src/config/env.ts):
- On startup (`validateEnv()`), every critical variable is validated.
- In `NODE_ENV=production`, missing secrets trigger an explicit error with troubleshooting guidance.
- In `NODE_ENV=development`, missing variables log structured warnings and gracefully fall back to local mock adapters.
