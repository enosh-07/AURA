/**
 * AURA Background Playback — Platform Abstraction
 * =================================================
 * Controls the audio session category and background play behaviour across:
 *   - Web:     Media Session API (browser-tab-close pauses; limited background)
 *   - Android: Capacitor triggers the native MediaSession / foreground Service
 *              via the MusicControls plugin — actual Android Service is
 *              configured in the native Android project
 *   - iOS:     Capacitor sets AVAudioSession category to playback so audio
 *              continues when the screen locks
 *   - Desktop: No extra work needed — OS process keeps running in background
 *
 * This module signals intent. The actual background service code lives in
 * the native project (android/) and is wired to the Capacitor plugin.
 */

import { PLATFORM, isCapacitor, capabilities } from './platform';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BackgroundPlaybackState = 'active' | 'inactive' | 'unsupported';

// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------

/**
 * Call this once when the user first triggers playback.
 * Must be called from a user-gesture context.
 */
export async function activateBackgroundPlayback(): Promise<BackgroundPlaybackState> {
  if (!capabilities.audioBackgroundPlayback) return 'unsupported';

  if (isCapacitor) {
    return activateCapacitorBackground();
  }

  // Desktop: nothing to activate — OS handles it
  // Web: Media Session API is already set via mediaControls.update()
  return 'active';
}

async function activateCapacitorBackground(): Promise<BackgroundPlaybackState> {
  try {
    if (PLATFORM === 'ios') {
      // On iOS, background audio is enabled by:
      // 1. UIBackgroundModes 'audio' in Info.plist (done in the ios/ native project)
      // 2. The @capgo/capacitor-media-session plugin bridges Web Media Session to AVAudioSession
      // When the Media Session API is active and audio is playing, iOS keeps the app alive.
      console.info('[AURA] iOS background audio: enabled via @capgo/capacitor-media-session + AVAudioSession');
      return 'active';
    }

    if (PLATFORM === 'android') {
      // Android background audio is handled by the ExoPlayer-based foreground service
      // that @capgo/capacitor-media-session configures automatically.
      // The MediaSession notification keeps the process alive.
      console.info('[AURA] Android background audio: enabled via @capgo/capacitor-media-session foreground service');
      return 'active';
    }

    return 'inactive';
  } catch (err) {
    console.warn('[AURA] Background playback activation failed:', err);
    return 'inactive';
  }
}

// ---------------------------------------------------------------------------
// Deactivation
// ---------------------------------------------------------------------------

export async function deactivateBackgroundPlayback(): Promise<void> {
  if (!isCapacitor) return;
  // @capgo/capacitor-media-session cleans up automatically when
  // the media session is cleared via navigator.mediaSession.metadata = null
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = 'none';
  }
}

// ---------------------------------------------------------------------------
// Visibility / focus change hooks
// ---------------------------------------------------------------------------

let _onBackground: (() => void) | null = null;
let _onForeground: (() => void) | null = null;
let _appStateListener: (() => void) | null = null;

export function setBackgroundPlaybackCallbacks(callbacks: {
  onBackground?: () => void;
  onForeground?: () => void;
}) {
  _onBackground = callbacks.onBackground ?? null;
  _onForeground = callbacks.onForeground ?? null;
}

/**
 * Register lifecycle listeners so the player can react when the
 * app goes to background / returns to foreground.
 */
export async function registerAppLifecycleListeners(): Promise<void> {
  if (_appStateListener) return; // already registered

  if (isCapacitor) {
    const { App } = await import('@capacitor/app');
    const handle = await App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        _onForeground?.();
      } else {
        _onBackground?.();
      }
    });
    _appStateListener = () => handle.remove();
    return;
  }

  // Web / Desktop — use Page Visibility API
  const handler = () => {
    if (document.visibilityState === 'hidden') {
      _onBackground?.();
    } else {
      _onForeground?.();
    }
  };
  document.addEventListener('visibilitychange', handler);
  _appStateListener = () => document.removeEventListener('visibilitychange', handler);
}

export function removeAppLifecycleListeners(): void {
  _appStateListener?.();
  _appStateListener = null;
}

// ---------------------------------------------------------------------------
// iOS-specific: keep audio active when silent switch is on
// ---------------------------------------------------------------------------

/**
 * On iOS the WebView requires that audio has been started from a user
 * gesture before AVAudioSession background mode kicks in.
 * This is handled automatically by the HTMLAudioElement.play() call in
 * AudioEngine. No extra steps needed here.
 */
export const iosAudioSessionNote = `
iOS Background Audio Notes:
- Add UIBackgroundModes 'audio' to Info.plist (done in ios/ native project).
- AVAudioSession category is set to 'playback' by the MusicControls plugin.
- The WebView HTMLAudioElement.play() MUST be triggered by a user gesture
  on first launch. Subsequent background playback works automatically.
`;
