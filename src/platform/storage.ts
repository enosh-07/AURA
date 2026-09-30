/**
 * AURA Platform Storage Abstraction
 * ====================================
 * Unified key-value storage that works across:
 *   - Web: localStorage / IndexedDB (via idb-keyval)
 *   - Android / iOS: Capacitor Preferences plugin
 *   - Desktop: Tauri store plugin
 *
 * All values are serialised as JSON strings internally.
 * Do NOT import platform-specific APIs outside this file.
 */

import { PLATFORM } from './platform';

// ---------------------------------------------------------------------------
// Storage Backend Interface
// ---------------------------------------------------------------------------

interface StorageBackend {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}

// ---------------------------------------------------------------------------
// Web Backend (localStorage with async wrapper)
// ---------------------------------------------------------------------------

class WebStorageBackend implements StorageBackend {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    localStorage.setItem(key, JSON.stringify(value));
  }

  async remove(key: string): Promise<void> {
    localStorage.removeItem(key);
  }

  async clear(): Promise<void> {
    localStorage.clear();
  }

  async keys(): Promise<string[]> {
    return Object.keys(localStorage);
  }
}

// ---------------------------------------------------------------------------
// Capacitor Backend (Preferences plugin)
// ---------------------------------------------------------------------------

class CapacitorStorageBackend implements StorageBackend {
  private getPreferences() {
    return import('@capacitor/preferences').then((m) => m.Preferences);
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const Preferences = await this.getPreferences();
      const { value } = await Preferences.get({ key });
      if (value === null || value === undefined) return null;
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    const Preferences = await this.getPreferences();
    await Preferences.set({ key, value: JSON.stringify(value) });
  }

  async remove(key: string): Promise<void> {
    const Preferences = await this.getPreferences();
    await Preferences.remove({ key });
  }

  async clear(): Promise<void> {
    const Preferences = await this.getPreferences();
    await Preferences.clear();
  }

  async keys(): Promise<string[]> {
    const Preferences = await this.getPreferences();
    const { keys } = await Preferences.keys();
    return keys;
  }
}

// ---------------------------------------------------------------------------
// Tauri Backend (Tauri store plugin)
// ---------------------------------------------------------------------------

class TauriStorageBackend implements StorageBackend {
  private store: any = null;

  private async getStore() {
    if (this.store) return this.store;
    try {
      const { Store } = await import('@tauri-apps/plugin-store');
      this.store = await Store.load('aura-store.json', { autoSave: true });
    } catch {
      // Tauri plugin unavailable — fall back to localStorage
      this.store = new WebStorageBackend();
    }
    return this.store;
  }

  async get<T>(key: string): Promise<T | null> {
    const store = await this.getStore();
    if (store instanceof WebStorageBackend) return store.get<T>(key);
    try {
      const val = await store.get(key);
      return val !== undefined && val !== null ? (val as T) : null;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    const store = await this.getStore();
    if (store instanceof WebStorageBackend) return store.set(key, value);
    await store.set(key, value);
  }

  async remove(key: string): Promise<void> {
    const store = await this.getStore();
    if (store instanceof WebStorageBackend) return store.remove(key);
    await store.delete(key);
  }

  async clear(): Promise<void> {
    const store = await this.getStore();
    if (store instanceof WebStorageBackend) return store.clear();
    await store.clear();
  }

  async keys(): Promise<string[]> {
    const store = await this.getStore();
    if (store instanceof WebStorageBackend) return store.keys();
    return store.keys();
  }
}

// ---------------------------------------------------------------------------
// Factory — select backend based on platform
// ---------------------------------------------------------------------------

function createStorageBackend(): StorageBackend {
  switch (PLATFORM) {
    case 'android':
    case 'ios':
      return new CapacitorStorageBackend();
    case 'windows':
    case 'macos':
    case 'linux':
      return new TauriStorageBackend();
    default:
      return new WebStorageBackend();
  }
}

// ---------------------------------------------------------------------------
// Public API — use this everywhere, never access storage directly
// ---------------------------------------------------------------------------

const backend: StorageBackend = createStorageBackend();

export const platformStorage = {
  get: <T>(key: string) => backend.get<T>(key),
  set: <T>(key: string, value: T) => backend.set<T>(key, value),
  remove: (key: string) => backend.remove(key),
  clear: () => backend.clear(),
  keys: () => backend.keys(),
};

// ---------------------------------------------------------------------------
// Auth Token helpers (commonly needed across services)
// ---------------------------------------------------------------------------

const AUTH_TOKEN_KEY = 'aura_auth_token';

export const tokenStorage = {
  getToken: () => platformStorage.get<string>(AUTH_TOKEN_KEY),
  setToken: (token: string) => platformStorage.set(AUTH_TOKEN_KEY, token),
  removeToken: () => platformStorage.remove(AUTH_TOKEN_KEY),
};
