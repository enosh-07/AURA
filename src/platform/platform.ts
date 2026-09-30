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
  /** Playback continues when app moves to background / screen locks */
  audioBackgroundPlayback: boolean;
  /** Access to device local filesystem */
  localFileAccess: boolean;
  /** Persistent key-value / binary offline storage */
  offlineStorage: boolean;
  /** OS-level push / local notifications */
  nativeNotifications: boolean;
  /** Browser / OS media session (lock screen, notification controls) */
  mediaSession: boolean;
  /** Read/write arbitrary filesystem paths */
  filesystemAccess: boolean;
  /** Track download management with progress */
  downloadManager: boolean;
  /** Native OS share sheet */
  nativeShare: boolean;
  /** Bluetooth audio device management */
  bluetoothAudio: boolean;
  /** OS system media transport controls */
  systemMediaControls: boolean;
  /** 10-band EQ via Web Audio */
  equalizer: boolean;
  /** Canvas-based audio visualizer */
  visualizer: boolean;
  /** FLAC / lossless streaming */
  losslessPlayback: boolean;
  /** aura:// deep link handling */
  deepLinks: boolean;
  /** Push notifications */
  pushNotifications: boolean;
  /** File picker dialog */
  filePicker: boolean;
  /** App auto-update mechanism */
  autoUpdate: boolean;
  /** System tray integration */
  systemTray: boolean;
  /** Keyboard shortcuts */
  keyboardShortcuts: boolean;
}

function buildCapabilities(): PlatformCapabilities {
  const hasMediaSession = typeof navigator !== 'undefined' && 'mediaSession' in navigator;
  const hasWebAudio =
    typeof window !== 'undefined' &&
    (!!window.AudioContext || !!(window as any).webkitAudioContext);

  switch (PLATFORM) {
    case 'android':
      return {
        audioBackgroundPlayback: true,
        localFileAccess: true,
        offlineStorage: true,
        nativeNotifications: true,
        mediaSession: true,
        filesystemAccess: true,
        downloadManager: true,
        nativeShare: true,
        bluetoothAudio: true,
        systemMediaControls: true,
        equalizer: hasWebAudio,
        visualizer: hasWebAudio,
        losslessPlayback: true,
        deepLinks: true,
        pushNotifications: true,
        filePicker: true,
        autoUpdate: false, // Google Play handles updates
        systemTray: false,
        keyboardShortcuts: false,
      };

    case 'ios':
      return {
        audioBackgroundPlayback: true,
        localFileAccess: true,
        offlineStorage: true,
        nativeNotifications: true,
        mediaSession: true,
        filesystemAccess: true,
        downloadManager: true,
        nativeShare: true,
        bluetoothAudio: true,
        systemMediaControls: true,
        equalizer: hasWebAudio,
        visualizer: hasWebAudio,
        losslessPlayback: true,
        deepLinks: true,
        pushNotifications: true,
        filePicker: true,
        autoUpdate: false, // App Store handles updates
        systemTray: false,
        keyboardShortcuts: false,
      };

    case 'windows':
      return {
        audioBackgroundPlayback: true,
        localFileAccess: true,
        offlineStorage: true,
        nativeNotifications: true,
        mediaSession: hasMediaSession,
        filesystemAccess: true,
        downloadManager: true,
        nativeShare: true,
        bluetoothAudio: false,
        systemMediaControls: true, // Windows SMTC
        equalizer: hasWebAudio,
        visualizer: hasWebAudio,
        losslessPlayback: true,
        deepLinks: true,
        pushNotifications: true,
        filePicker: true,
        autoUpdate: true,
        systemTray: true,
        keyboardShortcuts: true,
      };

    case 'macos':
      return {
        audioBackgroundPlayback: true,
        localFileAccess: true,
        offlineStorage: true,
        nativeNotifications: true,
        mediaSession: hasMediaSession,
        filesystemAccess: true,
        downloadManager: true,
        nativeShare: true,
        bluetoothAudio: false,
        systemMediaControls: true,
        equalizer: hasWebAudio,
        visualizer: hasWebAudio,
        losslessPlayback: true,
        deepLinks: true,
        pushNotifications: true,
        filePicker: true,
        autoUpdate: true,
        systemTray: true,
        keyboardShortcuts: true,
      };

    case 'linux':
      return {
        audioBackgroundPlayback: true,
        localFileAccess: true,
        offlineStorage: true,
        nativeNotifications: true,
        mediaSession: hasMediaSession,
        filesystemAccess: true,
        downloadManager: true,
        nativeShare: false,
        bluetoothAudio: false,
        systemMediaControls: hasMediaSession,
        equalizer: hasWebAudio,
        visualizer: hasWebAudio,
        losslessPlayback: true,
        deepLinks: true,
        pushNotifications: false,
        filePicker: true,
        autoUpdate: true,
        systemTray: true,
        keyboardShortcuts: true,
      };

    default: // web
      return {
        audioBackgroundPlayback: hasMediaSession, // partial via Media Session
        localFileAccess: false,
        offlineStorage: true, // IndexedDB
        nativeNotifications: false,
        mediaSession: hasMediaSession,
        filesystemAccess: false,
        downloadManager: false,
        nativeShare: false,
        bluetoothAudio: false,
        systemMediaControls: hasMediaSession,
        equalizer: hasWebAudio,
        visualizer: hasWebAudio,
        losslessPlayback: true,
        deepLinks: false,
        pushNotifications: false,
        filePicker: false,
        autoUpdate: false,
        systemTray: false,
        keyboardShortcuts: true, // keyboard events in browser
      };
  }
}

export const capabilities: PlatformCapabilities = buildCapabilities();

// ---------------------------------------------------------------------------
// App Version
// ---------------------------------------------------------------------------

export const APP_VERSION: string =
  typeof window !== 'undefined' &&
  '__TAURI__' in window &&
  (window as any).__TAURI__?.app?.getVersion
    ? 'tauri'
    : (import.meta as any).env?.VITE_APP_VERSION ?? '1.0.0';
