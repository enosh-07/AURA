/**
 * AURA Media Controls — Platform Abstraction
 * =============================================
 * Bridges the AudioEngine's media session metadata to:
 *   - Web:     Browser Media Session API
 *   - Android: Capacitor MusicControls plugin (notification + lock screen)
 *   - iOS:     Capacitor MusicControls plugin (AVAudioSession lock screen)
 *   - Desktop: Tauri system media controls (SMTC on Windows, MPRIS on Linux, etc.)
 *
 * All callers use `mediaControls.update(...)` and `mediaControls.setHandlers(...)`.
 */

import { PLATFORM, isCapacitor, isTauri } from './platform';
import type { Track } from '../types/audio';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MediaControlHandlers {
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (positionSec: number) => void;
  onStop?: () => void;
}

export interface MediaMetadataUpdate {
  track: Track;
  isPlaying: boolean;
  positionSec: number;
  durationSec: number;
}

// ---------------------------------------------------------------------------
// Web — Browser Media Session API
// ---------------------------------------------------------------------------

class WebMediaControls {
  private handlers: MediaControlHandlers | null = null;

  setHandlers(handlers: MediaControlHandlers) {
    this.handlers = handlers;
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.setActionHandler('play', handlers.onPlay);
    navigator.mediaSession.setActionHandler('pause', handlers.onPause);
    navigator.mediaSession.setActionHandler('previoustrack', handlers.onPrev);
    navigator.mediaSession.setActionHandler('nexttrack', handlers.onNext);
    navigator.mediaSession.setActionHandler('stop', handlers.onStop ?? handlers.onPause);
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined) handlers.onSeek(details.seekTime);
    });
  }

  update({ track, isPlaying, positionSec, durationSec }: MediaMetadataUpdate) {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album,
      artwork: [{ src: track.artwork, sizes: '512x512', type: 'image/jpeg' }],
    });

    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

    try {
      navigator.mediaSession.setPositionState({
        duration: durationSec || 0,
        playbackRate: 1,
        position: Math.min(positionSec, durationSec || 0),
      });
    } catch {
      // setPositionState not supported everywhere
    }
  }

  destroy() {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = 'none';
    ['play','pause','previoustrack','nexttrack','stop','seekto'].forEach((a) => {
      try { navigator.mediaSession.setActionHandler(a as MediaSessionAction, null); } catch {}
    });
  }
}

// ---------------------------------------------------------------------------
// Capacitor — @capgo/capacitor-media-session bridges Web Media Session API
// to native Android and iOS lock screen / notification controls.
// ---------------------------------------------------------------------------

class CapacitorMediaControls {
  private handlers: MediaControlHandlers | null = null;
  private webFallback = new WebMediaControls();

  setHandlers(handlers: MediaControlHandlers) {
    this.handlers = handlers;
    // Set handlers on the web Media Session API first.
    // The Capacitor plugin will then mirror these to native.
    this.webFallback.setHandlers(handlers);
  }

  update(meta: MediaMetadataUpdate) {
    // Update the browser Media Session — Capgo plugin syncs it to native
    this.webFallback.update(meta);
  }

  destroy() {
    this.webFallback.destroy();
  }
}

// ---------------------------------------------------------------------------
// Tauri — system media transport controls via Tauri commands
// ---------------------------------------------------------------------------

class TauriMediaControls {
  private handlers: MediaControlHandlers | null = null;
  private webFallback = new WebMediaControls();
  private unlisten: (() => void) | null = null;

  async setHandlers(handlers: MediaControlHandlers) {
    this.handlers = handlers;
    // Also set web media session (works in Tauri WebView)
    this.webFallback.setHandlers(handlers);

    try {
      const { listen } = await import('@tauri-apps/api/event');
      this.unlisten = await listen<string>('aura:media-control', (event) => {
        const h = this.handlers;
        if (!h) return;
        switch (event.payload) {
          case 'play': h.onPlay(); break;
          case 'pause': h.onPause(); break;
          case 'next': h.onNext(); break;
          case 'prev': h.onPrev(); break;
          case 'stop': (h.onStop ?? h.onPause)(); break;
        }
      }) as unknown as () => void;
    } catch {
      // Tauri not available
    }
  }

  async update(meta: MediaMetadataUpdate) {
    // Media Session API works in Tauri WebView too
    this.webFallback.update(meta);

    // Send to Tauri backend for OS-level SMTC/MPRIS
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('update_media_metadata', {
        title: meta.track.title,
        artist: meta.track.artist,
        album: meta.track.album,
        artwork: meta.track.artwork,
        isPlaying: meta.isPlaying,
        positionSec: Math.round(meta.positionSec),
        durationSec: Math.round(meta.durationSec),
      });
    } catch {
      // Tauri command may not exist yet
    }
  }

  destroy() {
    this.webFallback.destroy();
    if (this.unlisten) { this.unlisten(); this.unlisten = null; }
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

type MediaControlsImpl = WebMediaControls | CapacitorMediaControls | TauriMediaControls;

function createMediaControls(): MediaControlsImpl {
  if (isCapacitor) return new CapacitorMediaControls();
  if (isTauri) return new TauriMediaControls();
  return new WebMediaControls();
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

const _impl = createMediaControls();

export const mediaControls = {
  setHandlers: (handlers: MediaControlHandlers) => {
    const impl = _impl as any;
    const result = impl.setHandlers(handlers);
    return result instanceof Promise ? result : Promise.resolve();
  },
  update: (meta: MediaMetadataUpdate) => {
    const impl = _impl as any;
    const result = impl.update(meta);
    return result instanceof Promise ? result : Promise.resolve();
  },
  destroy: () => {
    const impl = _impl as any;
    const result = impl.destroy();
    return result instanceof Promise ? result : Promise.resolve();
  },
};
