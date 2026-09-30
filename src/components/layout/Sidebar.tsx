import React from 'react';
import { useUIStore, MainView } from '../../stores/useUIStore';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { useAuthStore } from '../../stores/useAuthStore';
import {
  Home,
  Search,
  BookOpen,
  Heart,
  ListMusic,
  Disc,
  Users,
  Plus,
  ChevronDown,
  Sparkles,
  Command,
  Sliders,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface SidebarPlaylist {
  id: string;
  name: string;
  artwork: string;
}

const DEFAULT_PLAYLISTS: SidebarPlaylist[] = [
  {
    id: 'pl-late-night',
    name: 'Late Night Drive',
    artwork: 'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?w=100&auto=format&fit=crop&q=80',
  },
  {
    id: 'pl-acoustic',
    name: 'Acoustic Mornings',
    artwork: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=100&auto=format&fit=crop&q=80',
  },
  {
    id: 'pl-heartbreak',
    name: 'Heartbreak Diaries',
    artwork: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=100&auto=format&fit=crop&q=80',
  },
  {
    id: 'pl-good-vibes',
    name: 'Good Vibes',
    artwork: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=100&auto=format&fit=crop&q=80',
  },
];

export const Sidebar: React.FC = () => {
  const activeView = useUIStore((state) => state.activeView);
  const setActiveView = useUIStore((state) => state.setActiveView);
  const isSidebarCollapsed = useUIStore((state) => state.isSidebarCollapsed);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const setAudioLabOpen = useUIStore((state) => state.setAudioLabOpen);

  const playlists = useLibraryStore((state) => state.playlists);
  const createPlaylist = useLibraryStore((state) => state.createPlaylist);
  const { user, isAuthenticated, setAuthModalOpen } = useAuthStore();

  const navItems = [
    { id: 'home' as MainView, label: 'Home', icon: Home },
    { id: 'search' as MainView, label: 'Search', icon: Search },
    { id: 'library' as MainView, label: 'Your Library', icon: BookOpen },
    { id: 'playlist' as MainView, label: 'Liked Songs', icon: Heart },
    { id: 'playlist' as MainView, label: 'Playlists', icon: ListMusic },
    { id: 'album' as MainView, label: 'Albums', icon: Disc },
    { id: 'artist' as MainView, label: 'Artists', icon: Users },
  ];

  const handleCreatePlaylist = async () => {
    const pl = await createPlaylist('New Curated Mix', 'Custom listening session');
    setActiveView('playlist', pl.id);
  };

  return (
    <aside
      className={`hidden md:flex flex-col h-full bg-[#0d0c0b] border-r border-white/[0.06] transition-all duration-300 relative z-30 select-none ${
        isSidebarCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header: Sparkle Icon + Title */}
      <div className="p-6 pb-5 flex items-center justify-between">
        <div
          onClick={() => setActiveView('home')}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <span className="text-[#f3c5a6] text-lg font-bold group-hover:rotate-45 transition-transform duration-300">
            ✦
          </span>
          {!isSidebarCollapsed && (
            <span className="text-sm font-semibold tracking-[0.25em] text-[#fbf6f1] uppercase font-sans">
              MIDNIGHT
            </span>
          )}
        </div>

        <button
          onClick={toggleSidebar}
          className="p-1 rounded-lg hover:bg-white/5 text-[#8f867e] hover:text-[#f3c5a6] transition-colors"
          title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isSidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Main Nav Items */}
      <div className="px-3 flex flex-col gap-1">
        {navItems.map((item, idx) => {
          const Icon = item.icon;
          const isActive =
            item.label === 'Home'
              ? activeView === 'home'
              : item.label === 'Search'
              ? activeView === 'search'
              : item.label === 'Your Library'
              ? activeView === 'library'
              : item.label === 'Liked Songs'
              ? activeView === 'playlist' && idx === 3
              : item.label === 'Playlists'
              ? activeView === 'playlist' && idx === 4
              : item.label === 'Albums'
              ? activeView === 'album'
              : item.label === 'Artists'
              ? activeView === 'artist'
              : false;

          return (
            <button
              key={`${item.label}-${idx}`}
              onClick={() => setActiveView(item.id)}
              className={`flex items-center gap-3.5 w-full px-4 py-2.5 rounded-xl font-medium text-xs transition-all ${
                isActive
                  ? 'bg-[#251e1a] text-[#f3c5a6] font-semibold shadow-inner'
                  : 'text-[#8f867e] hover:text-[#fbf6f1] hover:bg-white/[0.04]'
              } ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
              title={isSidebarCollapsed ? item.label : undefined}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[#f3c5a6]' : 'text-[#8f867e]'}`} />
              {!isSidebarCollapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </div>

      {/* Playlists Section */}
      {!isSidebarCollapsed && (
        <div className="mt-6 px-4 flex-1 overflow-y-auto scrollbar-none flex flex-col gap-3">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[#6e665f] uppercase tracking-wider px-1">
            <span>Your Playlists</span>
            <button
              onClick={handleCreatePlaylist}
              className="p-1 rounded hover:bg-white/5 text-[#8f867e] hover:text-[#f3c5a6] transition-colors"
              title="Create playlist"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-col gap-1">
            {DEFAULT_PLAYLISTS.map((pl) => (
              <div
                key={pl.id}
                onClick={() => setActiveView('playlist', pl.id)}
                className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-white/[0.04] cursor-pointer group transition-all"
              >
                <div className="w-9 h-9 rounded-lg overflow-hidden bg-[#1a1816] flex-shrink-0 shadow">
                  <img src={pl.artwork} alt={pl.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                </div>
                <span className="text-xs font-medium text-[#c4b9af] group-hover:text-white truncate">
                  {pl.name}
                </span>
              </div>
            ))}

            {playlists.slice(0, 3).map((pl) => (
              <div
                key={pl.id}
                onClick={() => setActiveView('playlist', pl.id)}
                className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-white/[0.04] cursor-pointer group transition-all"
              >
                <div className="w-9 h-9 rounded-lg overflow-hidden bg-[#1a1816] flex items-center justify-center flex-shrink-0 text-[#8f867e] group-hover:text-[#f3c5a6] border border-white/[0.06]">
                  <Disc className="w-4 h-4" />
                </div>
                <span className="text-xs font-medium text-[#c4b9af] group-hover:text-white truncate">
                  {pl.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Profile Footer: Avatar + Username */}
      <div className="p-4 mt-auto border-t border-white/[0.06]">
        <div
          onClick={() => (!isAuthenticated ? setAuthModalOpen(true) : null)}
          className={`flex items-center gap-3 p-1.5 rounded-2xl hover:bg-white/[0.04] cursor-pointer transition-colors ${
            isSidebarCollapsed ? 'justify-center' : ''
          }`}
        >
          <div className="w-8 h-8 rounded-full overflow-hidden bg-[#1f1d1b] border border-white/10 flex-shrink-0">
            <img
              src={
                user?.avatarUrl ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'
              }
              alt="User"
              className="w-full h-full object-cover"
            />
          </div>
          {!isSidebarCollapsed && (
            <div className="flex items-center justify-between flex-1 min-w-0">
              <span className="text-xs font-medium text-[#c4b9af] hover:text-white truncate">
                {user?.name || 'madebyadah'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[#6e665f]" />
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
