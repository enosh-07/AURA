# AURA Cross-Platform Build Guide

## Supported Platforms

| Platform | Target | Build Tool | Status |
|----------|--------|-----------|--------|
| Web | Browser | Vite | ✅ Production ready |
| Android | APK / AAB | Capacitor + Android Studio | ✅ Configured |
| iOS | .ipa / Xcode | Capacitor + Xcode | ✅ Configured (macOS only) |
| Windows | .exe / NSIS | Tauri | ✅ Configured |
| macOS | .app / DMG | Tauri | ✅ Configured |
| Linux | AppImage / deb | Tauri | ✅ Configured |

---

## Prerequisites

### All Platforms
- Node.js 20+
- npm 10+
- Git

### Android
- Android Studio (Hedgehog or later)
- Android SDK 34+
- Java 17+
- `ANDROID_HOME` environment variable set

### iOS (macOS only)
- macOS 13 (Ventura) or later
- Xcode 15+
- CocoaPods: `sudo gem install cocoapods`
- Apple Developer account (for device testing / App Store)

> ⚠️ **iOS builds cannot be produced on Windows.**  
> You can generate and sync the `ios/` project on Windows,  
> but you need macOS with Xcode to compile the `.ipa`.

### Desktop (Windows / macOS / Linux)
- Rust 1.77+: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- Windows: Visual Studio C++ Build Tools (for Rust compilation)
- Linux: `libwebkit2gtk-4.1-dev libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`

---

## Environment Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your values:
   ```env
   VITE_API_BASE_URL=http://localhost:4000/api/v1
   VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
   VITE_DEEP_LINK_DOMAIN=aura.example.com
   ```

---

## Build Commands

### Web

```bash
# Development server (http://localhost:3000)
npm run dev

# Production build → dist/
npm run build

# Preview production build locally
npm run preview
```

### Android

```bash
# First time: add Android platform
npx cap add android

# Build and open in Android Studio
npm run cap:android
# Equivalent to:
#   npm run build
#   npx cap sync android
#   npx cap open android

# Run directly on connected device / emulator
npm run cap:run:android

# Just sync changes without opening Android Studio
npm run cap:sync
```

**In Android Studio:**
- Select your device/emulator
- Click ▶ Run (or Shift+F10)
- For release: Build → Generate Signed Bundle / APK

### iOS (macOS only)

```bash
# First time: add iOS platform
npx cap add ios

# Build and open in Xcode
npm run cap:ios
# Equivalent to:
#   npm run build
#   npx cap sync ios
#   npx cap open ios

# Run directly on connected device / simulator
npm run cap:run:ios
```

**In Xcode:**
- Select your target device/simulator
- Click ▶ Run (Cmd+R)
- For release: Product → Archive → Distribute App

### Desktop (Tauri)

```bash
# Development (hot-reload desktop window)
npm run tauri:dev
# Or equivalently:
npx tauri dev

# Production build
npm run tauri:build
# Or:
npx tauri build
```

**Output locations:**
- Windows: `src-tauri/target/release/bundle/nsis/AURA_1.0.0_x64-setup.exe`
- macOS: `src-tauri/target/release/bundle/macos/AURA.app`
- Linux: `src-tauri/target/release/bundle/appimage/aura_1.0.0_amd64.AppImage`

---

## Live Reload on Physical Device (Mobile)

1. Find your machine's local IP address (e.g., `192.168.1.100`)
2. In `capacitor.config.ts`, uncomment the server URL:
   ```ts
   server: {
     url: 'http://192.168.1.100:3000',
     cleartext: false,
   }
   ```
3. Run the Vite dev server:
   ```bash
   npm run dev
   ```
4. Sync and run on device:
   ```bash
   npx cap sync
   npx cap run android  # or ios
   ```

> ⚠️ Remove the `server.url` for production builds.

---

## Deep Links

AURA supports the `aura://` URL scheme and HTTPS universal links.

| URL | Opens |
|-----|-------|
| `aura://track/123` | Track page for ID 123 |
| `aura://album/456` | Album page for ID 456 |
| `aura://playlist/789` | Playlist page for ID 789 |
| `aura://artist/abc` | Artist page for ID abc |

### Android Configuration
Add to `android/app/src/main/AndroidManifest.xml` inside the main `<activity>`:
```xml
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="aura" />
</intent-filter>
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="https" android:host="aura.example.com" />
</intent-filter>
```

### iOS Configuration
Add to `ios/App/App/Info.plist`:
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>aura</string>
    </array>
  </dict>
</array>
```

### Desktop (Tauri)
Already configured in `src-tauri/tauri.conf.json` under `plugins.deep-link`.
The `aura://` scheme is registered with the OS via `tauri_plugin_deep_link::register_current_exe()`.

---

## Google Authentication

### Web
Set `VITE_GOOGLE_CLIENT_ID` in `.env` and configure your Google Cloud Console OAuth 2.0 credentials with the correct redirect URIs.

### Android
1. Download `google-services.json` from Google Cloud Console
2. Place it in `android/app/google-services.json`
3. Configure SHA-1 fingerprint in Google Cloud Console

### iOS
1. Download `GoogleService-Info.plist` from Google Cloud Console
2. Place it in `ios/App/App/GoogleService-Info.plist`
3. Add the reversed iOS client ID to `Info.plist` as a URL scheme

### Desktop
Desktop uses the system browser + `aura://oauth/callback` deep link. Set `VITE_GOOGLE_CLIENT_ID` and add `aura://oauth/callback` to your Google Cloud Console OAuth redirect URIs.

---

## Production Database

For production, migrate from SQLite to PostgreSQL:
1. Change `backend/prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
2. Set `DATABASE_URL=postgresql://user:pass@host:5432/aura` in `backend/.env`
3. Run `npx prisma migrate deploy`

---

## Auto-Update (Desktop)

Tauri's built-in updater is configured in `src-tauri/tauri.conf.json`:
```json
"plugins": {
  "updater": {
    "pubkey": "YOUR_SIGNING_KEY",
    "endpoints": ["https://aura.example.com/releases/{{target}}/{{arch}}/{{current_version}}"]
  }
}
```

Generate signing keys: `npx tauri signer generate`

---

## Mobile Distribution

### Android
- **Debug APK**: Built automatically during development
- **Release AAB**: Use Android Studio → Build → Generate Signed Bundle
- **Distribution**: Google Play Store via AAB upload

### iOS
- **TestFlight**: Archive in Xcode → Distribute → App Store Connect → TestFlight
- **App Store**: Archive in Xcode → Distribute → App Store Connect → Submit for Review

> ⚠️ iOS builds require an Apple Developer account ($99/year).

---

## Architecture Notes

### Platform Abstraction Layer (`src/platform/`)
All platform-specific code is isolated here. React components never directly import from `@tauri-apps/*` or `@capacitor/*`.

| Module | Purpose |
|--------|---------|
| `platform.ts` | Platform detection + capability flags |
| `storage.ts` | Unified KV storage |
| `auth.ts` | AuthService (web/mobile/desktop OAuth) |
| `mediaControls.ts` | System media controls bridge |
| `backgroundPlayback.ts` | Audio session management |
| `filesystem.ts` | File picker + read/write |
| `downloads.ts` | DownloadManager |
| `notifications.ts` | Local/push notifications |
| `deepLinks.ts` | Deep link routing |
| `share.ts` | Native share sheet & clipboard fallback |

### Import Rule
```ts
// ✅ Correct — always import from platform barrel
import { capabilities, DownloadManager, AuthService } from '../platform';

// ❌ Wrong — never import platform APIs directly in components
import { Filesystem } from '@capacitor/filesystem';
import { invoke } from '@tauri-apps/api/core';
```
