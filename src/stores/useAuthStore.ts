import { create } from 'zustand';
import { apiClient } from '../services/apiClient';
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
  authMode: 'login' | 'register';
  error: string | null;

  setAuthModalOpen: (open: boolean, mode?: 'login' | 'register') => void;
  setError: (error: string | null) => void;
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<boolean>;
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

  setAuthModalOpen: (open: boolean, mode: 'login' | 'register' = 'login') => {
    set({ isAuthModalOpen: open, authMode: mode, error: null });
  },

  setError: (error: string | null) => set({ error }),

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
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
      // Real-time DB sync for playlists, liked tracks & saved playback state
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

  googleLogin: async (payload) => {
    set({ isLoading: true, error: null });
    try {
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
    apiClient.setToken(null);
    set({ user: null, isAuthenticated: false });
    useLibraryStore.getState().syncUserData().catch(console.error);
  },

  checkAuth: async () => {
    try {
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
