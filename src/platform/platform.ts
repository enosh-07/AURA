/**
 * AURA Platform Abstraction Layer
 * ================================
 * Central platform detection and capability registry.
 *
 * Components should NEVER call `navigator.userAgent` or
 * `window.__TAURI__` directly. Use `platform` and `capabilities` instead.
 *
 * Capability flags are conservative: only set true when the feature
 * has been verified on that platform.
 */

// ---------------------------------------------------------------------------
// Platform ID
// ---------------------------------------------------------------------------

export type PlatformId =
  | 'web'
  | 'android'
  | 'ios'
  | 'windows'
  | 'macos'
  | 'linux';

function detectPlatform(): PlatformId {
  // Tauri injects window.__TAURI__ in its WebView
  if (typeof window !== 'undefined' && '__TAURI__' in window) {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('windows')) return 'windows';
    if (ua.includes('mac os') || ua.includes('macos')) return 'macos';
    return 'linux';
  }

  // Capacitor injects window.Capacitor
  if (typeof window !== 'undefined' && 'Capacitor' in window) {
    const cap = (window as any).Capacitor;
    const plat: string = cap?.getPlatform?.() ?? '';
    if (plat === 'android') return 'android';
    if (plat === 'ios') return 'ios';
  }

  return 'web';
}

export const PLATFORM: PlatformId = detectPlatform();

export const isWeb = PLATFORM === 'web';
export const isAndroid = PLATFORM === 'android';
export const isIOS = PLATFORM === 'ios';
export const isMobile = isAndroid || isIOS;
export const isWindows = PLATFORM === 'windows';
export const isMacOS = PLATFORM === 'macos';
export const isLinux = PLATFORM === 'linux';
export const isDesktop = isWindows || isMacOS || isLinux;
export const isCapacitor = isMobile;
export const isTauri = isDesktop;

// ---------------------------------------------------------------------------
// Capability Registry
// ---------------------------------------------------------------------------

export interface PlatformCapabilities {
  // --- 11 Canonical Core Capabilities (Phase 13.2) ---
  /** Background audio playback without app suspension */
  backgroundPlayback: boolean;
  /** Persistent key-value or binary offline storage (IndexedDB, AppData, or native FS) */
  offlineStorage: boolean;
  /** OS-level push or local notifications */
  nativeNotifications: boolean;
  /** Media keys, lock screen & System Media Transport Controls (SMTC / MPRIS / MediaSession) */
  mediaControls: boolean;
  /** Direct native filesystem read/write access */
  filesystemAccess: boolean;
  /** Native package and track download management */
  nativeDownloads: boolean;
  /** aura:// deep link protocol routing */
  deepLinks: boolean;
  /** Native OS share sheet */
  nativeShare: boolean;
  /** Bluetooth audio device management / routing */
  bluetoothAudio: boolean;
  /** Spatial audio / 3D stereo panning engine */
  spatialAudio: boolean;
  /** Local audio file ingestion & tag parsing */
  localMusicImport: boolean;

  // --- Extended / Legacy Compatibility Aliases ---
  /** Legacy alias for backgroundPlayback */
  audioBackgroundPlayback: boolean;
  /** Legacy alias for localMusicImport */
  localFileAccess: boolean;
  /** Legacy alias for mediaControls */
  mediaSession: boolean;
  /** Legacy alias for nativeDownloads */
  downloadManager: boolean;
  /** Legacy alias for mediaControls */
  systemMediaControls: boolean;
  /** 10-band EQ via Web Audio */
  equalizer: boolean;
  /** Canvas-based audio visualizer */
  visualizer: boolean;
  /** Lossless audio decoding & telemetry */
  losslessPlayback: boolean;
  /** Push notifications */
  pushNotifications: boolean;
  /** File picker dialog */
  filePicker: boolean;
  /** App auto-update mechanism */
  autoUpdate: boolean;
  /** System tray integration */
  systemTray: boolean;
  /** Global or window keyboard shortcuts */
  keyboardShortcuts: boolean;
}

export type PlatformCapabilityKey = keyof PlatformCapabilities;

function buildCapabilities(): PlatformCapabilities {
  const hasMediaSession = typeof navigator !== 'undefined' && 'mediaSession' in navigator;
  const hasWebAudio =
    typeof window !== 'undefined' &&
    (!!window.AudioContext || !!(window as any).webkitAudioContext);
  const hasSpatialAudio =
    hasWebAudio &&
    typeof window !== 'undefined' &&
    (typeof StereoPannerNode !== 'undefined' ||
      (typeof AudioContext !== 'undefined' && 'createStereoPanner' in AudioContext.prototype) ||
      (typeof AudioContext !== 'undefined' && 'createPanner' in AudioContext.prototype));
  const hasNativeShare = typeof navigator !== 'undefined' && 'share' in navigator;
  const hasWindowNotifications = typeof window !== 'undefined' && 'Notification' in window;

  switch (PLATFORM) {
    case 'android':
      return {
        // 11 Core Capabilities
        backgroundPlayback: true,
        offlineStorage: true,
        nativeNotifications: true,
        mediaControls: true,
        filesystemAccess: true,
        nativeDownloads: true,
        deepLinks: true,
        nativeShare: true,
        bluetoothAudio: true,
        spatialAudio: hasSpatialAudio,
        localMusicImport: true,

        // Legacy / Extended
        audioBackgroundPlayback: true,
        localFileAccess: true,
        mediaSession: true,
        downloadManager: true,
        systemMediaControls: true,
        equalizer: hasWebAudio,
        visualizer: hasWebAudio,
        losslessPlayback: true,
        pushNotifications: true,
        filePicker: true,
        autoUpdate: false, // Managed via store
        systemTray: false,
        keyboardShortcuts: false,
      };

    case 'ios':
      return {
        // 11 Core Capabilities
        backgroundPlayback: true,
        offlineStorage: true,
        nativeNotifications: true,
        mediaControls: true,
        filesystemAccess: true,
        nativeDownloads: true,
        deepLinks: true,
        nativeShare: true,
        bluetoothAudio: true,
        spatialAudio: hasSpatialAudio,
        localMusicImport: true,

        // Legacy / Extended
        audioBackgroundPlayback: true,
        localFileAccess: true,
        mediaSession: true,
        downloadManager: true,
        systemMediaControls: true,
        equalizer: hasWebAudio,
        visualizer: hasWebAudio,
        losslessPlayback: true,
        pushNotifications: true,
        filePicker: true,
        autoUpdate: false,
        systemTray: false,
        keyboardShortcuts: false,
      };

    case 'windows':
      return {
        // 11 Core Capabilities
        backgroundPlayback: true,
        offlineStorage: true,
        nativeNotifications: true,
        mediaControls: true,
        filesystemAccess: true,
        nativeDownloads: true,
        deepLinks: true,
        nativeShare: hasNativeShare || true,
        bluetoothAudio: false, // Managed transparently by Windows audio driver
        spatialAudio: hasSpatialAudio,
        localMusicImport: true,

        // Legacy / Extended
        audioBackgroundPlayback: true,
        localFileAccess: true,
        mediaSession: hasMediaSession,
        downloadManager: true,
        systemMediaControls: true, // Windows SMTC
        equalizer: hasWebAudio,
        visualizer: hasWebAudio,
        losslessPlayback: true,
        pushNotifications: true,
        filePicker: true,
        autoUpdate: true,
        systemTray: true,
        keyboardShortcuts: true,
      };

    case 'macos':
      return {
        // 11 Core Capabilities
        backgroundPlayback: true,
        offlineStorage: true,
        nativeNotifications: true,
        mediaControls: true,
        filesystemAccess: true,
        nativeDownloads: true,
        deepLinks: true,
        nativeShare: hasNativeShare || true,
        bluetoothAudio: false,
        spatialAudio: hasSpatialAudio,
        localMusicImport: true,

        // Legacy / Extended
        audioBackgroundPlayback: true,
        localFileAccess: true,
        mediaSession: hasMediaSession,
        downloadManager: true,
        systemMediaControls: true,
        equalizer: hasWebAudio,
        visualizer: hasWebAudio,
        losslessPlayback: true,
        pushNotifications: true,
        filePicker: true,
        autoUpdate: true,
        systemTray: true,
        keyboardShortcuts: true,
      };

    case 'linux':
      return {
        // 11 Core Capabilities
        backgroundPlayback: true,
        offlineStorage: true,
        nativeNotifications: true,
        mediaControls: hasMediaSession,
        filesystemAccess: true,
        nativeDownloads: true,
        deepLinks: true,
        nativeShare: false,
        bluetoothAudio: false,
        spatialAudio: hasSpatialAudio,
        localMusicImport: true,

        // Legacy / Extended
        audioBackgroundPlayback: true,
        localFileAccess: true,
        mediaSession: hasMediaSession,
        downloadManager: true,
        systemMediaControls: hasMediaSession,
        equalizer: hasWebAudio,
        visualizer: hasWebAudio,
        losslessPlayback: true,
        pushNotifications: false,
        filePicker: true,
        autoUpdate: true,
        systemTray: true,
        keyboardShortcuts: true,
      };

    default: // web
      return {
        // 11 Core Capabilities
        backgroundPlayback: hasMediaSession,
        offlineStorage: true, // IndexedDB persistent key-value/blob storage
        nativeNotifications: hasWindowNotifications,
        mediaControls: hasMediaSession,
        filesystemAccess: false,
        nativeDownloads: false, // Web uses offlineStorage (IndexedDB), not direct filesystem
        deepLinks: false,
        nativeShare: hasNativeShare,
        bluetoothAudio: false,
        spatialAudio: hasSpatialAudio,
        localMusicImport: true, // File input & Drag/Drop

        // Legacy / Extended
        audioBackgroundPlayback: hasMediaSession,
        localFileAccess: false,
        mediaSession: hasMediaSession,
        downloadManager: false,
        systemMediaControls: hasMediaSession,
        equalizer: hasWebAudio,
        visualizer: hasWebAudio,
        losslessPlayback: true,
        pushNotifications: false,
        filePicker: false,
        autoUpdate: false,
        systemTray: false,
        keyboardShortcuts: true,
      };
  }
}

export const capabilities: PlatformCapabilities = buildCapabilities();

/**
 * Checks if a specific platform capability is enabled in the current runtime.
 */
export function hasCapability(cap: PlatformCapabilityKey): boolean {
  return !!capabilities[cap];
}

// ---------------------------------------------------------------------------
// App Version
// ---------------------------------------------------------------------------

export const APP_VERSION: string =
  typeof window !== 'undefined' &&
  '__TAURI__' in window &&
  (window as any).__TAURI__?.app?.getVersion
    ? 'tauri'
    : (import.meta as any).env?.VITE_APP_VERSION ?? '1.0.0';
