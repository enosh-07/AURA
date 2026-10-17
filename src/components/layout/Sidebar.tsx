import React, { useState } from 'react';
import { useUIStore, MainView } from '../../stores/useUIStore';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { UserAvatar } from '../common/UserAvatar';
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
  LogOut,
  User as UserIcon,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const activeView = useUIStore((state) => state.activeView);
  const setActiveView = useUIStore((state) => state.setActiveView);
  const isSidebarCollapsed = useUIStore((state) => state.isSidebarCollapsed);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const setAudioLabOpen = useUIStore((state) => state.setAudioLabOpen);

  const playlists = useLibraryStore((state) => state.playlists);
  const createPlaylist = useLibraryStore((state) => state.createPlaylist);
  const { user, isAuthenticated, setAuthModalOpen, logout } = useAuthStore();
  const [showAccountMenu, setShowAccountMenu] = useState(false);

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
            {playlists.length > 0 ? (
              playlists.map((pl) => (
                <div
                  key={pl.id}
                  onClick={() => setActiveView('playlist', pl.id)}
                  className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-white/[0.04] cursor-pointer group transition-all"
                >
                  <div className="w-8 h-8 rounded-lg overflow-hidden bg-[#1a1816] flex items-center justify-center flex-shrink-0 text-[#8f867e] group-hover:text-[#f3c5a6] border border-white/[0.06]">
                    {pl.coverUrl ? (
                      <img src={pl.coverUrl} alt={pl.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <Disc className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-medium text-[#c4b9af] group-hover:text-white truncate">
                      {pl.title}
                    </span>
                    <span className="text-[10px] text-[#6e665f] font-mono">
                      {pl.trackIds.length} {pl.trackIds.length === 1 ? 'track' : 'tracks'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-3 py-3.5 rounded-xl bg-white/[0.02] border border-dashed border-white/[0.06] flex flex-col items-center justify-center text-center gap-1.5 my-1">
                <Disc className="w-4 h-4 text-[#6e665f]" />
                <span className="text-[11px] text-[#8f867e]">No custom playlists yet</span>
                <button
                  onClick={handleCreatePlaylist}
                  className="text-[10px] font-semibold text-[#f3c5a6] hover:underline"
                >
                  + Create your first
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Profile Footer: Real User Identity / Guest Account */}
      <div className="p-4 mt-auto border-t border-white/[0.06] relative">
        <div
          onClick={() => {
            if (!isAuthenticated) {
              setAuthModalOpen(true, 'login');
            } else {
              setShowAccountMenu((prev) => !prev);
            }
          }}
          className={`flex items-center gap-3 p-1.5 rounded-2xl hover:bg-white/[0.04] cursor-pointer transition-colors ${
            isSidebarCollapsed ? 'justify-center' : ''
          }`}
          title={isAuthenticated ? (user?.name || user?.email || 'Account') : 'Sign in to AURA'}
        >
          <UserAvatar
            avatarUrl={user?.avatarUrl}
            name={user?.name}
            email={user?.email}
            size="md"
            isGuest={!isAuthenticated}
          />
          {!isSidebarCollapsed && (
            <div className="flex items-center justify-between flex-1 min-w-0">
              <div className="flex flex-col min-w-0 pr-1">
                <span className="text-xs font-medium text-[#c4b9af] hover:text-white truncate">
                  {isAuthenticated
                    ? user?.name || user?.email?.split('@')[0] || 'AURA Listener'
                    : 'Guest Listener'}
                </span>
                <span className="text-[10px] text-[#8f867e] truncate">
                  {isAuthenticated ? (user?.email || 'Synced Library') : 'Tap to sign in'}
                </span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-[#6e665f] transition-transform ${
                  showAccountMenu ? 'rotate-180' : ''
                }`}
              />
            </div>
          )}
        </div>

        {/* Authenticated User Account Popover */}
        {isAuthenticated && showAccountMenu && (
          <div className="absolute bottom-full left-4 right-4 mb-2 p-3 rounded-2xl bg-[#12131a] border border-white/10 shadow-2xl backdrop-blur-2xl z-50 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2.5 pb-2.5 border-b border-white/10 mb-2">
              <UserAvatar
                avatarUrl={user?.avatarUrl}
                name={user?.name}
                email={user?.email}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">
                  {user?.name || user?.email?.split('@')[0] || 'AURA Member'}
                </p>
                <p className="text-[10px] text-white/50 truncate font-mono">{user?.email}</p>
              </div>
            </div>

            <div className="flex items-center justify-between py-1 px-1.5 text-[10px] text-emerald-400 font-mono mb-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Cloud Library Active</span>
              </span>
              <span className="text-white/40">Sync ON</span>
            </div>

            <button
              onClick={() => {
                logout();
                setShowAccountMenu(false);
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-medium transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out of AURA</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
