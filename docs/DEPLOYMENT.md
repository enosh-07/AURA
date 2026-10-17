# AURA Production & Preview Deployment Guide

This guide details the step-by-step procedures for deploying **AURA** across **Vercel**, **Supabase**, **Cloudflare R2**, and **Resend** with high availability, security hardening, and zero downtime.

---

## 1. Prerequisites & Account Setup

Before initiating deployment, ensure you have administrative access to:
- [Vercel Account](https://vercel.com) (Pro or Enterprise recommended for high-bandwidth media)
- [Supabase Organization](https://supabase.com)
- [Cloudflare Dashboard](https://dash.cloudflare.com) with R2 enabled
- [Resend Account](https://resend.com) with a verified domain
- [GitHub / GitLab Repository](https://github.com) linked to your CI/CD

---

## 2. Supabase Infrastructure Deployment

### Step 2.1: Provision Project
1. Log in to [Supabase](https://supabase.com/dashboard) and click **New Project**.
2. Select your Organization, enter Project Name: `aura-production`, and generate a secure database password (minimum 24 characters).
3. Select your primary deployment region (e.g., `us-east-1` or closest to your primary listener base).
4. Save your **Project URL** (`https://<project-ref>.supabase.co`) and **anon public key**.

### Step 2.2: Apply Database Schema & Migrations
You can apply migrations using the Supabase CLI or directly in the Supabase Dashboard SQL Editor:

**Option A — Supabase CLI (Recommended):**
```bash
# Log in to Supabase CLI
npx supabase login

# Link your local repository to the remote project
npx supabase link --project-ref <your-project-ref>

# Push all migrations in order
npx supabase db push
```

**Option B — Dashboard SQL Editor:**
Run the SQL files located in `supabase/migrations/` in chronological order:
1. `supabase/migrations/20261017000001_initial_schema.sql` (Creates 24 tables, triggers, and indexes).
2. `supabase/migrations/20261017000002_row_level_security.sql` (Enables and configures RLS on all tables).
3. `supabase/migrations/20261017000003_realtime_setup.sql` (Enables Supabase Realtime publication for listening rooms).
4. *(Optional for initial catalog)* `supabase/seed.sql` (Populates default tracks, presets, and EQ curves).

### Step 2.3: Configure Supabase Auth
1. Go to **Authentication -> URL Configuration**.
2. Set **Site URL** to `https://aura.audio` (or your Vercel production domain).
3. In **Redirect URLs**, add:
   - `https://aura.audio/**`
   - `https://*.vercel.app/**` (for preview deployments)
   - `tauri://localhost` (for Desktop native deep links)
   - `capacitor://localhost` (for iOS/Android native deep links)
4. Under **Authentication -> Email Templates**, customize the reset password and confirmation email links to route to your application's `/auth/reset-password` endpoint.

---

## 3. Cloudflare R2 Media Storage Setup

### Step 3.1: Create Buckets
1. In Cloudflare Dashboard, navigate to **R2 -> Create Bucket**.
2. Create two buckets:
   - Primary Audio & Assets: `aura-media-production`
   - Image & Waveform Cache: `aura-cache-production`

### Step 3.2: Configure CORS for Web Audio API & Range Requests
In the bucket settings under **Settings -> CORS Policy**, add the following rule to allow browser audio decoding and byte streaming:
```json
[
  {
    "AllowedOrigins": [
      "https://aura.audio",
      "https://*.vercel.app",
      "tauri://localhost",
      "capacitor://localhost",
      "http://localhost:3000"
    ],
    "AllowedMethods": [
      "GET",
      "HEAD",
      "PUT",
      "POST",
      "DELETE"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag",
      "Content-Range",
      "Accept-Ranges",
      "Content-Length",
      "X-Audio-Codec",
      "X-Audio-Quality-Tier",
      "X-Audio-Bit-Depth",
      "X-Audio-Sample-Rate",
      "X-Audio-Lossless"
    ],
    "MaxAgeSeconds": 86400
  }
]
```

### Step 3.3: Set Up Custom Domain & Public Access
1. Under **Bucket Details -> Public Access**, connect a custom domain: `media.aura.audio`.
2. Cloudflare automatically issues SSL certificates and activates global Edge Caching.

### Step 3.4: Generate S3 API Credentials
1. In **R2 -> Manage R2 API Tokens**, click **Create API Token**.
2. Permissions: **Admin Read & Write** (or Object Read & Write).
3. Specify TTL or leave permanent.
4. Securely copy:
   - `CLOUDFLARE_R2_ACCESS_KEY_ID`
   - `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
   - `CLOUDFLARE_R2_ENDPOINT` (`https://<account-id>.r2.cloudflarestorage.com`)

---

## 4. Resend Transactional Email Setup

### Step 4.1: Add & Verify Sending Domain
1. Log in to [Resend](https://resend.com/domains) and click **Add Domain**.
2. Enter your domain: `aura.audio` (or mail subdomain `mail.aura.audio`).
3. Add the generated DNS records (DKIM, SPF, and MX) to your DNS registrar (Cloudflare / Namecheap / Route 53).
4. Verify domain status until status indicates **Verified**.

### Step 4.2: Create API Key
1. In **API Keys**, click **Create API Key**.
2. Name: `AURA-Production-Backend`.
3. Permissions: **Full Access** or **Sending Access**.
4. Securely record the key: `RESEND_API_KEY=re_123456789...`.

---

## 5. Vercel Web Deployment

### Step 5.1: Connect Git Repository
1. In [Vercel Dashboard](https://vercel.com/new), select your linked Git repository (`AURA`).
2. Project Name: `aura-audio`.
3. Framework Preset: **Other** or **Next.js** (based on selected deployment model).

### Step 5.2: Configure Build & Output Settings
Depending on your operational target:
- **For Hybrid Next.js Deployment (Default):**
  - Build Command: `npm run build:next`
  - Output Directory: `.next`
- **For Pure Static High-Performance Vite SPA:**
  - Build Command: `npm run build`
  - Output Directory: `dist`

### Step 5.3: Set Environment Variables in Vercel
Under **Project Settings -> Environment Variables**, configure:

| Variable Name | Environment | Value Example |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview, Dev | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview, Dev | `eyJhbGciOi...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Production (Secret) | `eyJhbGciOi...` |
| `SUPABASE_JWT_SECRET` | Production (Secret) | `your-supabase-jwt-secret` |
| `NEXT_PUBLIC_MEDIA_URL` | Production, Preview, Dev | `https://media.aura.audio` |
| `CLOUDFLARE_R2_ENDPOINT` | Production (Secret) | `https://<account-id>.r2.cloudflarestorage.com` |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | Production (Secret) | `<access-key-id>` |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | Production (Secret) | `<secret-access-key>` |
| `CLOUDFLARE_R2_BUCKET_NAME` | Production, Preview, Dev | `aura-media-production` |
| `RESEND_API_KEY` | Production (Secret) | `re_...` |
| `RESEND_FROM_EMAIL` | Production | `AURA Music <notifications@aura.audio>` |
| `NODE_ENV` | Production | `production` |

### Step 5.4: Deploy & Verify
Click **Deploy**. Once built:
1. Verify SSL certificate auto-issuance.
2. Visit `https://aura-audio.vercel.app`.
3. Test audio playback, EQ adjustment, and room synchronization.

---

## 6. Native Packaging (Tauri Desktop & Capacitor Mobile)

Because the project preserves the independent Vite compilation pipeline:
- **Desktop (Windows/macOS/Linux):**
  ```bash
  npm run tauri:build
  ```
  Produces standalone installers in `src-tauri/target/release/bundle/`.
- **Android APK / AAB:**
  ```bash
  npm run cap:android
  ```
  Opens Android Studio for signed release APK/AAB generation.
- **iOS IPA:**
  ```bash
  npm run cap:ios
  ```
  Opens Xcode for Archive & TestFlight distribution.

---

## 7. Post-Deployment Verification Checklist

- [ ] Supabase connection healthy (`GET /api/v1/health` returns status `ok`).
- [ ] Supabase RLS is active (`SELECT * FROM tracks` as anon only returns published tracks).
- [ ] Presigned upload ticket generates valid Cloudflare R2 PUT URL (`POST /api/v1/storage/ticket`).
- [ ] Audio stream serves with `206 Partial Content` and byte range headers.
- [ ] Web Audio API 10-band equalizer and visualizers render at 60fps without audio glitches.
- [ ] User signup triggers Resend welcome email with branded dark-mode layout.
- [ ] Realtime listening room updates sync across two distinct browser sessions within 50ms.
