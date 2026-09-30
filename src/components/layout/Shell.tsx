import React, { useEffect } from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { useAnalyticsStore } from '../../stores/useAnalyticsStore';

import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { MiniPlayer } from '../player/MiniPlayer';
import { FullscreenPlayer } from '../player/FullscreenPlayer';
import { AudioLabModal } from '../audioLab/AudioLabModal';
import { LyricsView } from '../lyrics/LyricsView';
import { SleepTimerModal } from '../common/SleepTimerModal';
import { AuraCompanionModal } from '../ai/AuraCompanionModal';
import { QueueDrawer } from '../player/QueueDrawer';
import { CommandPalette } from '../common/CommandPalette';
import { AuthModal } from '../auth/AuthModal';
import { AudioQualityPanel } from '../player/AudioQualityPanel';
import { useAuthStore } from '../../stores/useAuthStore';

import { HomeView } from '../views/HomeView';
import { SearchView } from '../views/SearchView';
import { LibraryView } from '../views/LibraryView';
import { PlaylistView } from '../views/PlaylistView';
import { InsightsView } from '../views/InsightsView';
import { SocialRoomView } from '../views/SocialRoomView';
import { LocalMusicStudio } from '../studio/LocalMusicStudio';
import { ArtistView } from '../views/ArtistView';
import { AlbumView } from '../views/AlbumView';
import { useAudioStore } from '../../stores/useAudioStore';

export const Shell: React.FC = () => {
  const activeView = useUIStore((state) => state.activeView);
  const loadInitialData = useLibraryStore((state) => state.loadInitialData);
  const loadHistory = useAnalyticsStore((state) => state.loadHistory);
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const currentTrack = useAudioStore((state) => state.currentTrack);

  useEffect(() => {
    checkAuth();
    loadInitialData();
    loadHistory();
  }, [checkAuth, loadInitialData, loadHistory]);

  const renderView = () => {
    switch (activeView) {
      case 'home':
        return <HomeView />;
      case 'search':
        return <SearchView />;
      case 'artist':
        return <ArtistView />;
      case 'album':
        return <AlbumView />;
      case 'library':
        return <LibraryView />;
      case 'playlist':
        return <PlaylistView />;
      case 'insights':
        return <InsightsView />;
      case 'social':
        return <SocialRoomView />;
      case 'studio':
        return <LocalMusicStudio />;
      default:
        return <HomeView />;
    }
  };

  const dynamicAccent = currentTrack?.accentColor || '#00f2fe';

  return (
    <div className="flex h-screen w-screen bg-[#0a0908] text-[#f4eee8] overflow-hidden relative font-sans">
      {/* Dynamic Ambient Background Glow */}
      <div
        className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full blur-[180px] opacity-[0.08] pointer-events-none transition-all duration-1000 bg-[#f3c5a6]"
      />
      <div
        className="absolute top-1/2 -right-40 w-[500px] h-[500px] rounded-full blur-[180px] opacity-[0.06] pointer-events-none transition-all duration-1000 bg-[#d4a373]"
      />
      <div className="absolute inset-0 bg-aura-mesh pointer-events-none opacity-50" />
      {/* Sidebar on desktop */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <Header />

        <main className="flex-1 overflow-y-auto px-4 sm:px-8 pt-4 sm:pt-6 pb-36 md:pb-28 max-w-7xl w-full mx-auto scroll-smooth">
          {renderView()}
        </main>

        {/* Mobile Navigation */}
        <MobileNav />

        {/* Persistent Bottom Mini Player */}
        <MiniPlayer />
      </div>

      {/* Global Modals & Overlays */}
      <FullscreenPlayer />
      <AudioLabModal />
      <LyricsView />
      <SleepTimerModal />
      <AuraCompanionModal />
      <QueueDrawer />
      <CommandPalette />
      <AuthModal />
      <AudioQualityPanel />
    </div>
  );
};
