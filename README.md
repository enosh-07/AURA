# AURA — Next-Generation Cross-Platform Music Player

<div align="center">

![AURA Banner](https://img.shields.io/badge/AURA-v1.0.0-00f2fe?style=for-the-badge&logoColor=white)
![Platforms](https://img.shields.io/badge/Platforms-Windows%20%7C%20macOS%20%7C%20Linux%20%7C%20Android%20%7C%20iOS%20%7C%20Web-f3c5a6?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

**An ultra-modern, high-fidelity lossless music application designed for desktop, mobile, and web.**

[Direct Downloads](#-direct-downloads) • [Architecture](#-architecture) • [Features](#-features) • [Local Development](#-local-development)

</div>

---

## 🚀 Direct Downloads

Pre-built, ready-to-run installers for every platform are automatically built and published with every release:

| Platform | Download Format | Status |
|:---|:---|:---|
| **Windows** | `.exe` (NSIS Installer & Portable) | [Download Latest](https://github.com/USER/AURA/releases/latest) |
| **macOS** | `.dmg` / `.app` (Apple Silicon & Intel) | [Download Latest](https://github.com/USER/AURA/releases/latest) |
| **Linux** | `.AppImage` / `.deb` (x86_64) | [Download Latest](https://github.com/USER/AURA/releases/latest) |
| **Android** | `aura-android.apk` (Direct Install) | [Download Latest](https://github.com/USER/AURA/releases/latest) |
| **iOS** | App Store / TestFlight | Available via Xcode project |
| **Web App** | Browser Version | Runs on `http://localhost:3000` |

---

## 🏛 Architecture

AURA is engineered to share **100% of its frontend UI and audio logic** across desktop, mobile, and web while utilizing native platform APIs for performance, background playback, and system controls:

```
                          ┌──────────────────────────┐
                          │   AURA React Frontend    │
                          │ (React 18 + TS + Zustand)│
                          └─────────────┬────────────┘
                                        │
             ┌──────────────────────────┴──────────────────────────┐
             ▼                                                     ▼
     ┌───────────────┐                                     ┌───────────────┐
     │  Tauri (v2)   │                                     │ Capacitor (8) │
     │ Desktop Engine│                                     │ Mobile Engine │
     └───────┬───────┘                                     └───────┬───────┘
             │                                                     │
   ┌─────────┼─────────┐                                 ┌─────────┴─────────┐
   ▼         ▼         ▼                                 ▼                   ▼
Windows    macOS     Linux                            Android               iOS
 (.exe)    (.app)  (.AppImage)                         (.apk)              (.ipa)
```

- **Frontend**: React 18, TypeScript, Tailwind CSS, Framer Motion, Zustand 5.
- **Desktop Runtime**: **Tauri 2** (Rust) — ultra-lightweight (~30MB executable, ~20MB RAM) with System Media Transport Controls (SMTC) on Windows and MPRIS on Linux.
- **Mobile Runtime**: **Capacitor 8** — native Android background audio services, wake lock, and iOS `AVAudioSession`.
- **Backend API**: Node.js, Express, TypeScript, Prisma ORM, PostgreSQL / SQLite.
- **Real-Time Sync**: Socket.IO for multi-device live synchronization and listening rooms.

---

## ✨ Features

- **Genuine Lossless & Hi-Res Playback**: FLAC, ALAC, WAV, and AIFF audio with bit-depth and sample-rate telemetry.
- **Acoustic Lab (10-Band Graphic Equalizer)**: Parametric filters, bass boost, stereo widening, and custom presets.
- **Interactive Audio Visualizers**: 60fps real-time frequency spectrum, bars, waves, and ambient glowing mesh.
- **System Media Controls**: Hardware media key support, Windows SMTC lock-screen overlay, and mobile notification controls.
- **Offline Download Manager**: Encrypted local caching with IndexedDB, Capacitor Filesystem, and desktop data directory storage.
- **Synchronized Lyrics**: Real-time LRC parser with auto-scroll and karaoke-style line highlighting.
- **AURA AI Companion**: Intelligent musical assistant for discovery, playlist curation, and harmonic transitions.

---

## 🛠 Local Development

### 1. Prerequisites

- **Node.js**: v20 or higher
- **Rust & Cargo**: (For desktop builds) [rustup.rs](https://rustup.rs/)
- **Android Studio / SDK**: (Optional, for mobile Android builds)

### 2. Installation

```bash
git clone https://github.com/USER/AURA.git
cd AURA
npm install
```

### 3. Running Services

#### Web Application (Browser)
```bash
npm run dev
# Open http://localhost:3000 in your browser
```

#### Desktop Application (Windows / macOS / Linux)
```bash
npm run tauri:dev
```

#### Android (Device or Emulator)
```bash
npm run cap:android
# Or run directly on connected device:
npm run cap:run:android
```

#### iOS (macOS with Xcode)
```bash
npm run cap:ios
```

#### Backend API Server
```bash
cd backend
npm install
npm run dev
# API runs on http://localhost:4000
```

---

## 📦 Building Standalone Installers

### Desktop Installer (`.exe` on Windows)
```bash
npm run tauri:build
```
Output: `src-tauri/target/release/bundle/nsis/AURA_1.0.0_x64-setup.exe`

### Android APK
```bash
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
```
Output: `android/app/build/outputs/apk/debug/app-debug.apk`

---

## 🤖 Automatic GitHub Releases

This repository includes a pre-configured GitHub Actions workflow ([`.github/workflows/release.yml`](.github/workflows/release.yml)).

Whenever you create and push a Git tag (e.g. `v1.0.0`):
1. **GitHub compiles Windows `.exe`, macOS `.dmg`, and Linux `.AppImage`**.
2. **GitHub builds the Android `aura-android.apk`**.
3. **All installers are automatically attached to the GitHub Release** for users to download directly.

```bash
git tag v1.0.0
git push origin v1.0.0
```

---

## 📄 License

MIT © AURA Team
