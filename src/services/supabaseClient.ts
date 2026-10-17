/**
 * AURA Supabase Client — Browser, Desktop & Mobile Runtime
 *
 * Provides:
 * 1. Supabase Auth (Email/Password, OAuth, Password Reset, Session Recovery)
 * 2. Supabase Realtime (Synchronized Listening Rooms, Device Playback Sync, Presence)
 * 3. PostgreSQL Database access protected by Row Level Security (RLS)
 *
 * Safe degradation: If Supabase credentials are not yet configured in .env,
 * this client gracefully operates in fallback mode without crashing.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Retrieve environment variables across Vite, Next.js, and runtime environments
const getEnvVar = (keys: string[]): string => {
  if (typeof window !== 'undefined') {
    for (const key of keys) {
      const val = (import.meta as any).env?.[key];
      if (val) return val;
      const localVal = localStorage.getItem(`aura_${key.toLowerCase()}`);
      if (localVal) return localVal;
    }
  }
  return '';
};

const supabaseUrl =
  getEnvVar(['VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL']) ||
  'https://your-project-id.supabase.co';

const supabaseAnonKey =
  getEnvVar(['VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']) ||
  'your-anon-key-placeholder';

export const isSupabaseConfigured = (): boolean => {
  return (
    Boolean(supabaseUrl) &&
    !supabaseUrl.includes('your-project-id') &&
    Boolean(supabaseAnonKey) &&
    !supabaseAnonKey.includes('placeholder')
  );
};

// Create client instance with resilient options
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
  realtime: {
    params: {
      eventsPerSecond: 20,
    },
  },
});

// ==============================================================================
// AUTHENTICATION WRAPPERS
// ==============================================================================

export interface SupabaseAuthResult {
  user: any | null;
  session: any | null;
  error: Error | null;
}

export const supabaseAuth = {
  /**
   * Register with email and password
   */
  async signUp(email: string, password: string, name: string): Promise<SupabaseAuthResult> {
    if (!isSupabaseConfigured()) {
      return { user: null, session: null, error: new Error('Supabase is not configured yet.') };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          full_name: name,
        },
      },
    });

    if (error) return { user: null, session: null, error };
    return { user: data.user, session: data.session, error: null };
  },

  /**
   * Sign in with email and password
   */
  async signInWithPassword(email: string, password: string): Promise<SupabaseAuthResult> {
    if (!isSupabaseConfigured()) {
      return { user: null, session: null, error: new Error('Supabase is not configured yet.') };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) return { user: null, session: null, error };
    return { user: data.user, session: data.session, error: null };
  },

  /**
   * Trigger Google OAuth login
   */
  async signInWithGoogle(redirectTo?: string): Promise<{ url?: string; error: Error | null }> {
    if (!isSupabaseConfigured()) {
      return { error: new Error('Supabase is not configured yet.') };
    }

    const targetUrl = redirectTo || (typeof window !== 'undefined' ? window.location.origin : '');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: targetUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) return { error };
    return { url: data.url || undefined, error: null };
  },

  /**
   * Request password recovery / reset email via Resend / Supabase Auth
   */
  async resetPasswordForEmail(email: string, redirectTo?: string): Promise<{ error: Error | null }> {
    if (!isSupabaseConfigured()) {
      return { error: new Error('Supabase is not configured yet.') };
    }

    const targetUrl = redirectTo || (typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : '');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: targetUrl,
    });

    return { error };
  },

  /**
   * Sign out and clear stored session
   */
  async signOut(): Promise<{ error: Error | null }> {
    if (!isSupabaseConfigured()) return { error: null };
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  /**
   * Get current session
   */
  async getSession() {
    if (!isSupabaseConfigured()) return null;
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  /**
   * Listen to auth state changes
   */
  onAuthStateChange(callback: (event: string, session: any) => void) {
    if (!isSupabaseConfigured()) {
      return { unsubscribe: () => {} };
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
    return subscription;
  },
};

// ==============================================================================
// REALTIME LISTENING ROOMS & SYNCHRONIZATION
// ==============================================================================

export interface RoomSyncEvent {
  isPlaying: boolean;
  currentTime: number;
  trackId: string;
  senderId: string;
  timestamp: number;
}

export class SupabaseRealtimeService {
  private activeChannels: Map<string, any> = new Map();

  /**
   * Joins a Social Listening Room using Supabase Realtime Broadcast & Presence
   */
  public joinRoom(
    roomId: string,
    user: { id: string; name: string; avatarUrl?: string },
    callbacks: {
      onPlaybackSync: (event: RoomSyncEvent) => void;
      onChatMessage: (message: { id: string; userId: string; userName: string; text: string; timestamp: string }) => void;
      onPresenceChange?: (participants: any[]) => void;
    }
  ) {
    if (!isSupabaseConfigured()) {
      console.warn('⚡ Realtime: Supabase not configured. Operating in local mode.');
      return () => {};
    }

    const channelName = `room:${roomId}`;
    this.leaveRoom(roomId); // Clean up any existing channel

    const channel = supabase.channel(channelName, {
      config: {
        presence: { key: user.id },
        broadcast: { ack: false, self: false },
      },
    });

    // 1. Listen for playback sync events (host_play, host_pause, host_seek)
    channel.on('broadcast', { event: 'playback_sync' }, ({ payload }) => {
      callbacks.onPlaybackSync(payload);
    });

    // 2. Listen for live room chat messages
    channel.on('broadcast', { event: 'chat_message' }, ({ payload }) => {
      callbacks.onChatMessage(payload);
    });

    // 3. Track participant presence
    channel.on('presence', { event: 'sync' }, () => {
      if (callbacks.onPresenceChange) {
        const presenceState = channel.presenceState();
        const participants = Object.values(presenceState).flat();
        callbacks.onPresenceChange(participants);
      }
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          id: user.id,
          name: user.name,
          avatar: user.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120',
          joinedAt: new Date().toISOString(),
        });
      }
    });

    this.activeChannels.set(roomId, channel);

    // Return cleanup function
    return () => this.leaveRoom(roomId);
  }

  /**
   * Broadcasts a playback state update to room participants
   */
  public broadcastPlayback(roomId: string, syncData: Omit<RoomSyncEvent, 'timestamp'>) {
    const channel = this.activeChannels.get(roomId);
    if (!channel) return;

    channel.send({
      type: 'broadcast',
      event: 'playback_sync',
      payload: {
        ...syncData,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Broadcasts a chat message to room participants
   */
  public broadcastChatMessage(roomId: string, message: { id: string; userId: string; userName: string; text: string }) {
    const channel = this.activeChannels.get(roomId);
    if (!channel) return;

    channel.send({
      type: 'broadcast',
      event: 'chat_message',
      payload: {
        ...message,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Leaves room and unsubscribes from channel
   */
  public leaveRoom(roomId: string) {
    const channel = this.activeChannels.get(roomId);
    if (channel) {
      supabase.removeChannel(channel);
      this.activeChannels.delete(roomId);
    }
  }
}

export const realtimeService = new SupabaseRealtimeService();
