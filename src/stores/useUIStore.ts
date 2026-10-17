import { create } from 'zustand';
import { VisualizerMode } from '../types/audio';

export type MainView =
  | 'home'
  | 'library'
  | 'search'
  | 'insights'
  | 'social'
  | 'studio'
  | 'playlist'
  | 'artist'
  | 'album';

interface UIStoreState {
  activeView: MainView;
  selectedPlaylistId: string | null;
  selectedArtistId: string | null;
  selectedAlbumId: string | null;
  selectedLanguage: string; // 'All', 'Tamil', 'Hindi', 'Telugu', 'English', 'Punjabi', 'Malayalam'
  searchQuery: string;
  selectedMood: string | null;

  // Modals / Overlays
  isFullscreenPlayerOpen: boolean;
  playerPresentationMode: 'full' | 'mini';
  fullPlayerTab: 'artwork' | 'live-lyrics';
  isAudioLabOpen: boolean;
  isLyricsOpen: boolean;
  isAICompanionOpen: boolean;
  isSleepTimerOpen: boolean;
  isCommandPaletteOpen: boolean;
  isQueueDrawerOpen: boolean;
  isQualityPanelOpen: boolean;

  // Visualizer settings
  visualizerMode: VisualizerMode;
  visualizerIntensity: number; // 0.5 to 2.0
  isVisualizerEnabled: boolean;

  // Layout & Styling
  isSidebarCollapsed: boolean;
  accentColor: string;
  reducedMotion: boolean;

  // Setters
  setActiveView: (view: MainView, contextId?: string | null) => void;
  openArtistView: (artistId: string) => void;
  openAlbumView: (albumId: string) => void;
  setSelectedLanguage: (lang: string) => void;
  setSearchQuery: (q: string) => void;
  setSelectedMood: (mood: string | null) => void;
  setFullscreenPlayerOpen: (open: boolean) => void;
  setPlayerPresentationMode: (mode: 'full' | 'mini') => void;
  setFullPlayerTab: (tab: 'artwork' | 'live-lyrics') => void;
  setAudioLabOpen: (open: boolean) => void;
  setLyricsOpen: (open: boolean) => void;
  setAICompanionOpen: (open: boolean) => void;
  setSleepTimerOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setQueueDrawerOpen: (open: boolean) => void;
  setQualityPanelOpen: (open: boolean) => void;
  setVisualizerMode: (mode: VisualizerMode) => void;
  setVisualizerIntensity: (intensity: number) => void;
  toggleVisualizer: () => void;
  toggleSidebar: () => void;
  setAccentColor: (hex: string) => void;
  setReducedMotion: (reduced: boolean) => void;
}

export const useUIStore = create<UIStoreState>((set) => ({
  activeView: 'home',
  selectedPlaylistId: null,
  selectedArtistId: null,
  selectedAlbumId: null,
  selectedLanguage: 'All',
  searchQuery: '',
  selectedMood: null,

  isFullscreenPlayerOpen: false,
  playerPresentationMode: 'mini',
  fullPlayerTab: 'artwork',
  isAudioLabOpen: false,
  isLyricsOpen: false,
  isAICompanionOpen: false,
  isSleepTimerOpen: false,
  isCommandPaletteOpen: false,
  isQueueDrawerOpen: false,
  isQualityPanelOpen: false,

  visualizerMode: 'bars',
  visualizerIntensity: 1.0,
  isVisualizerEnabled: true,

  isSidebarCollapsed: false,
  accentColor: '#00f2fe',
  reducedMotion: false,

  setActiveView: (view, contextId = null) => {
    if (view === 'playlist') {
      set({ activeView: view, selectedPlaylistId: contextId });
    } else if (view === 'artist') {
      set({ activeView: view, selectedArtistId: contextId });
    } else if (view === 'album') {
      set({ activeView: view, selectedAlbumId: contextId });
    } else {
      set({ activeView: view });
    }
  },

  openArtistView: (artistId: string) => {
    set({ activeView: 'artist', selectedArtistId: artistId });
  },

  openAlbumView: (albumId: string) => {
    set({ activeView: 'album', selectedAlbumId: albumId });
  },

  setSelectedLanguage: (selectedLanguage) => set({ selectedLanguage }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSelectedMood: (selectedMood) => set({ selectedMood }),

  setFullscreenPlayerOpen: (isFullscreenPlayerOpen) =>
    set({
      isFullscreenPlayerOpen,
      playerPresentationMode: isFullscreenPlayerOpen ? 'full' : 'mini',
    }),
  setPlayerPresentationMode: (mode) =>
    set({
      playerPresentationMode: mode,
      isFullscreenPlayerOpen: mode === 'full',
    }),
  setFullPlayerTab: (fullPlayerTab) => set({ fullPlayerTab }),
  setAudioLabOpen: (isAudioLabOpen) => set({ isAudioLabOpen }),
  setLyricsOpen: (isLyricsOpen) => {
    if (isLyricsOpen) {
      set({
        fullPlayerTab: 'live-lyrics',
        isFullscreenPlayerOpen: true,
        playerPresentationMode: 'full',
      });
    } else {
      set({ isLyricsOpen: false });
    }
  },
  setAICompanionOpen: (isAICompanionOpen) => set({ isAICompanionOpen }),
  setSleepTimerOpen: (isSleepTimerOpen) => set({ isSleepTimerOpen }),
  setCommandPaletteOpen: (isCommandPaletteOpen) => set({ isCommandPaletteOpen }),
  setQueueDrawerOpen: (isQueueDrawerOpen) => set({ isQueueDrawerOpen }),
  setQualityPanelOpen: (isQualityPanelOpen) => set({ isQualityPanelOpen }),

  setVisualizerMode: (visualizerMode) => set({ visualizerMode }),
  setVisualizerIntensity: (visualizerIntensity) => set({ visualizerIntensity }),
  toggleVisualizer: () => set((state) => ({ isVisualizerEnabled: !state.isVisualizerEnabled })),
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  setAccentColor: (accentColor) => set({ accentColor }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
}));
