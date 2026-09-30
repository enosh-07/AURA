/**
 * AURA Deep Links — Platform Abstraction
 * =========================================
 * Handles aura:// and HTTPS universal links across:
 *   - Web:         Ignored (handled by URL routing)
 *   - Android:     Capacitor App plugin appUrlOpen event
 *   - iOS:         Capacitor App plugin appUrlOpen event
 *   - Desktop:     Tauri deep-link plugin event
 *
 * Route patterns:
 *   aura://track/<id>
 *   aura://album/<id>
 *   aura://playlist/<id>
 *   aura://artist/<id>
 *   aura://oauth/callback (auth flow only, not user-facing)
 *
 * HTTPS universal links (future — configure domain in production):
 *   https://aura.example.com/track/<id>  →  aura://track/<id>
 */

import { isCapacitor, isTauri } from './platform';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DeepLinkRoute =
  | { type: 'track'; id: string }
  | { type: 'album'; id: string }
  | { type: 'playlist'; id: string }
  | { type: 'artist'; id: string }
  | { type: 'oauth-callback'; params: URLSearchParams }
  | { type: 'unknown'; raw: string };

export type DeepLinkHandler = (route: DeepLinkRoute) => void;

// ---------------------------------------------------------------------------
// URL parser
// ---------------------------------------------------------------------------

export function parseDeepLink(url: string): DeepLinkRoute {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;    // 'track', 'album', etc. in aura:// scheme
    const path = parsed.pathname;    // '/<id>'
    const id = path.replace(/^\//, '');

    // aura://oauth/callback#access_token=...
    if (host === 'oauth' && path.startsWith('/callback')) {
      const params = new URLSearchParams(parsed.hash.slice(1) || parsed.search);
      return { type: 'oauth-callback', params };
    }

    if (host === 'track' && id) return { type: 'track', id };
    if (host === 'album' && id) return { type: 'album', id };
    if (host === 'playlist' && id) return { type: 'playlist', id };
    if (host === 'artist' && id) return { type: 'artist', id };

    // HTTPS universal link fallback
    if (parsed.protocol === 'https:') {
      const segments = path.split('/').filter(Boolean);
      if (segments[0] === 'track' && segments[1]) return { type: 'track', id: segments[1] };
      if (segments[0] === 'album' && segments[1]) return { type: 'album', id: segments[1] };
      if (segments[0] === 'playlist' && segments[1]) return { type: 'playlist', id: segments[1] };
      if (segments[0] === 'artist' && segments[1]) return { type: 'artist', id: segments[1] };
    }
  } catch {
    // Not a valid URL
  }
  return { type: 'unknown', raw: url };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

let _handlers: DeepLinkHandler[] = [];
let _registered = false;

export function addDeepLinkHandler(handler: DeepLinkHandler): () => void {
  _handlers.push(handler);
  return () => {
    _handlers = _handlers.filter((h) => h !== handler);
  };
}

function dispatchDeepLink(url: string) {
  const route = parseDeepLink(url);
  _handlers.forEach((h) => h(route));
}

/**
 * Call once at app startup to register platform deep link listeners.
 */
export async function registerDeepLinkListeners(): Promise<void> {
  if (_registered) return;
  _registered = true;

  if (isCapacitor) {
    const { App } = await import('@capacitor/app');
    await App.addListener('appUrlOpen', (data) => {
      if (data.url) dispatchDeepLink(data.url);
    });

    // Handle app launched via deep link
    const launchUrl = await App.getLaunchUrl();
    if (launchUrl?.url) dispatchDeepLink(launchUrl.url);
    return;
  }

  if (isTauri) {
    const { listen } = await import('@tauri-apps/api/event');
    await listen<string>('deep-link://new-url', (event) => {
      dispatchDeepLink(event.payload);
    });

    // Also check command line args for launch URL
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const args = await invoke<string[]>('plugin:deep-link|get_current_url');
      if (Array.isArray(args)) args.forEach(dispatchDeepLink);
    } catch {
      // Plugin command may not be available
    }
    return;
  }

  // Web: parse current URL on load
  const url = window.location.href;
  if (url.includes('/track/') || url.includes('/album/') || url.includes('/playlist/')) {
    dispatchDeepLink(url);
  }
}

// ---------------------------------------------------------------------------
// Generate share-able deep links
// ---------------------------------------------------------------------------

const DEEP_LINK_DOMAIN = (import.meta as any).env?.VITE_DEEP_LINK_DOMAIN ?? 'aura.example.com';

export function buildDeepLink(type: 'track' | 'album' | 'playlist' | 'artist', id: string): { native: string; https: string } {
  return {
    native: `aura://${type}/${id}`,
    https: `https://${DEEP_LINK_DOMAIN}/${type}/${id}`,
  };
}
