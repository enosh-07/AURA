/**
 * AURA Real-Time Cross-Tab & Cross-Device Library Sync
 * ====================================================
 * Coordinates instant synchronization of liked tracks, playlists,
 * and user preferences across active browser tabs and listening sessions.
 */

export interface SyncMessage {
  type: 'LIKE_MUTATION' | 'PLAYLIST_MUTATION' | 'PREFERENCE_MUTATION' | 'LIBRARY_REFRESH';
  userId?: string;
  payload?: any;
  timestamp: number;
}

class RealtimeSyncManager {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<(event: SyncMessage) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel('aura_library_sync_bus');
      this.channel.onmessage = (ev: MessageEvent<SyncMessage>) => {
        if (ev.data && ev.data.type) {
          this.listeners.forEach((listener) => {
            try {
              listener(ev.data);
            } catch (err) {
              console.warn('Realtime sync listener error:', err);
            }
          });
        }
      };
    }
  }

  public broadcast(type: SyncMessage['type'], payload?: any, userId?: string) {
    if (this.channel) {
      try {
        this.channel.postMessage({
          type,
          payload,
          userId,
          timestamp: Date.now(),
        });
      } catch {
        // Fallback for isolated contexts
      }
    }
  }

  public subscribe(fn: (event: SyncMessage) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
}

export const realtimeSync = new RealtimeSyncManager();
