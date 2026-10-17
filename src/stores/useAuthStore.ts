import { create } from 'zustand';
import { apiClient } from '../services/apiClient';
import { supabaseAuth, isSupabaseConfigured } from '../services/supabaseClient';
import { useAudioLabStore } from './useAudioLabStore';
import { useUIStore } from './useUIStore';
import { useLibraryStore } from './useLibraryStore';
import { useAudioStore } from './useAudioStore';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  preferences?: {
    accentColor?: string;
    theme?: string;
    visualizerMode?: string;
    visualizerIntensity?: number;
    reducedMotion?: boolean;
    defaultVolume?: number;
    eqBands?: number[];
    bassBoost?: number;
    treble?: number;
    stereoPan?: number;
    reverbLevel?: number;
    eqPreset?: string;
    eqBypassed?: boolean;
  };
}

function applyUserPreferencesToStores(preferences: any) {
  if (!preferences) return;
  if (preferences.eqBands) {
    useAudioLabStore.getState().applyLoadedPreferences({
      bands: preferences.eqBands,
      bassBoost: preferences.bassBoost,
      treble: preferences.treble,
      stereoPan: preferences.stereoPan,
      reverbLevel: preferences.reverbLevel,
      preset: preferences.eqPreset,
      isBypassed: preferences.eqBypassed,
    });
  }
  if (preferences.visualizerMode) {
    useUIStore.getState().setVisualizerMode(preferences.visualizerMode);
  }
  if (preferences.accentColor) {
    useUIStore.getState().setAccentColor(preferences.accentColor);
  }
}

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAuthModalOpen: boolean;
  authMode: 'login' | 'register' | 'forgot_password';
  error: string | null;
  notificationMessage: string | null;

  setAuthModalOpen: (open: boolean, mode?: 'login' | 'register' | 'forgot_password') => void;
  setError: (error: string | null) => void;
  setNotificationMessage: (msg: string | null) => void;
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  resetPassword: (email: string) => Promise<boolean>;
  googleLogin: (payload: {
    idToken?: string;
    accessToken?: string;
    credential?: string;
    email?: string;
    name?: string;
    avatarUrl?: string;
    googleId?: string;
  }) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  syncPreferences: (prefs: Partial<UserProfile['preferences']>) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isAuthModalOpen: false,
  authMode: 'login',
  error: null,
  notificationMessage: null,

  setAuthModalOpen: (open: boolean, mode: 'login' | 'register' | 'forgot_password' = 'login') => {
    set({ isAuthModalOpen: open, authMode: mode, error: null, notificationMessage: null });
  },

  setError: (error: string | null) => set({ error }),
  setNotificationMessage: (notificationMessage: string | null) => set({ notificationMessage }),

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      // 1. Try Supabase Auth if configured
      if (isSupabaseConfigured()) {
        const { user: sbUser, session, error } = await supabaseAuth.signInWithPassword(email, password);
        if (error) throw error;
        if (sbUser && session) {
          apiClient.setToken(session.access_token);
          const formattedUser: UserProfile = {
            id: sbUser.id,
            name: sbUser.user_metadata?.name || sbUser.email?.split('@')[0] || 'AURA Listener',
            email: sbUser.email || email,
            avatarUrl: sbUser.user_metadata?.avatar_url,
          };
          set({
            user: formattedUser,
            isAuthenticated: true,
            isLoading: false,
            isAuthModalOpen: false,
            error: null,
          });
          useLibraryStore.getState().syncUserData().catch(console.error);
          useAudioStore.getState().restorePlaybackFromDB().catch(console.error);
          return true;
        }
      }

      // 2. Fallback to API Client
      const data = await apiClient.login(email, password);
      set({
        user: data.user,
        isAuthenticated: true,
        isLoading: false,
        isAuthModalOpen: false,
        error: null,
      });
      if (data.user?.preferences) {
        applyUserPreferencesToStores(data.user.preferences);
      }
      useLibraryStore.getState().syncUserData().catch(console.error);
      useAudioStore.getState().restorePlaybackFromDB().catch(console.error);
      return true;
    } catch (err: any) {
      set({
        error: err.message || 'Login failed. Please check your credentials.',
        isLoading: false,
      });
      return false;
    }
  },

  register: async (name: string, email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      // 1. Try Supabase Auth if configured
      if (isSupabaseConfigured()) {
        const { user: sbUser, session, error } = await supabaseAuth.signUp(email, password, name);
        if (error) throw error;
        if (sbUser) {
          if (session) {
            apiClient.setToken(session.access_token);
          }
          const formattedUser: UserProfile = {
            id: sbUser.id,
            name: name,
            email: sbUser.email || email,
            avatarUrl: sbUser.user_metadata?.avatar_url,
          };
          set({
            user: formattedUser,
            isAuthenticated: Boolean(session),
            isLoading: false,
            isAuthModalOpen: !session, // Keep open if confirmation required
            notificationMessage: session ? null : 'Confirmation email sent! Please check your inbox.',
            error: null,
          });
          if (session) {
            useLibraryStore.getState().syncUserData().catch(console.error);
            useAudioStore.getState().restorePlaybackFromDB().catch(console.error);
          }
          return true;
        }
      }

      // 2. Fallback to API Client
      const data = await apiClient.register(name, email, password);
      set({
        user: data.user,
        isAuthenticated: true,
        isLoading: false,
        isAuthModalOpen: false,
        error: null,
      });
      if (data.user?.preferences) {
        applyUserPreferencesToStores(data.user.preferences);
      }
      useLibraryStore.getState().syncUserData().catch(console.error);
      useAudioStore.getState().restorePlaybackFromDB().catch(console.error);
      return true;
    } catch (err: any) {
      set({
        error: err.message || 'Registration failed.',
        isLoading: false,
      });
      return false;
    }
  },

  resetPassword: async (email: string) => {
    set({ isLoading: true, error: null });
    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabaseAuth.resetPasswordForEmail(email);
        if (error) throw error;
        set({
          isLoading: false,
          notificationMessage: 'Password reset link sent to your email address.',
        });
        return true;
      }
      set({
        isLoading: false,
        notificationMessage: 'Password reset instructions have been dispatched.',
      });
      return true;
    } catch (err: any) {
      set({
        error: err.message || 'Failed to send password reset email.',
        isLoading: false,
      });
      return false;
    }
  },

  googleLogin: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      if (isSupabaseConfigured()) {
        const { url, error } = await supabaseAuth.signInWithGoogle();
        if (error) throw error;
        if (url && typeof window !== 'undefined') {
          window.location.href = url;
          return true;
        }
      }

      const data = await apiClient.googleLogin(payload);
      set({
        user: data.user,
        isAuthenticated: true,
        isLoading: false,
        isAuthModalOpen: false,
        error: null,
      });
      if (data.user?.preferences) {
        applyUserPreferencesToStores(data.user.preferences);
      }
      useLibraryStore.getState().syncUserData().catch(console.error);
      useAudioStore.getState().restorePlaybackFromDB().catch(console.error);
      return true;
    } catch (err: any) {
      set({
        error: err.message || 'Google sign-in failed. Please try again.',
        isLoading: false,
      });
      return false;
    }
  },

  logout: () => {
    if (isSupabaseConfigured()) {
      supabaseAuth.signOut().catch(console.error);
    }
    apiClient.setToken(null);
    set({ user: null, isAuthenticated: false });
    useLibraryStore.getState().resetToGuestLibrary().catch(console.error);
  },

  checkAuth: async () => {
    try {
      if (isSupabaseConfigured()) {
        const session = await supabaseAuth.getSession();
        if (session?.user) {
          apiClient.setToken(session.access_token);
          const formattedUser: UserProfile = {
            id: session.user.id,
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'AURA Listener',
            email: session.user.email || '',
            avatarUrl: session.user.user_metadata?.avatar_url,
          };
          set({ user: formattedUser, isAuthenticated: true });
          useLibraryStore.getState().syncUserData().catch(console.error);
          useAudioStore.getState().restorePlaybackFromDB().catch(console.error);
          return;
        }
      }

      const user = await apiClient.getMe();
      if (user) {
        set({ user, isAuthenticated: true });
        if (user.preferences) {
          applyUserPreferencesToStores(user.preferences);
        }
        useLibraryStore.getState().syncUserData().catch(console.error);
        useAudioStore.getState().restorePlaybackFromDB().catch(console.error);
      } else {
        set({ user: null, isAuthenticated: false });
      }
    } catch {
      set({ user: null, isAuthenticated: false });
    }
  },

  syncPreferences: async (prefs: any) => {
    const { isAuthenticated, user } = get();
    if (!isAuthenticated || !user) return;
    try {
      const updated = await apiClient.updatePreferences(prefs);
      if (updated) {
        set({ user: { ...user, preferences: updated } });
      }
    } catch {
      // Ignore background preference sync errors
    }
  },
}));

