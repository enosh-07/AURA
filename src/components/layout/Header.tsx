import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { useAuthStore } from '../../stores/useAuthStore';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Bell,
  Sparkles,
  Sliders,
  X,
  User as UserIcon,
  LogOut,
  Check,
} from 'lucide-react';

export const Header: React.FC = () => {
  const searchQuery = useUIStore((state) => state.searchQuery);
  const setSearchQuery = useUIStore((state) => state.setSearchQuery);
  const setActiveView = useUIStore((state) => state.setActiveView);
  const activeView = useUIStore((state) => state.activeView);
  const setAICompanionOpen = useUIStore((state) => state.setAICompanionOpen);
  const setAudioLabOpen = useUIStore((state) => state.setAudioLabOpen);

  const { user, isAuthenticated, setAuthModalOpen, logout } = useAuthStore();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    if (e.target.value.trim().length > 0 && activeView !== 'search') {
      setActiveView('search');
    }
  };

  return (
    <header className="h-16 px-6 sm:px-8 bg-[#0a0908]/90 backdrop-blur-xl flex items-center justify-between gap-4 sticky top-0 z-20 select-none">
      {/* Left: Back & Forward Navigation Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveView('home')}
          className="w-8 h-8 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] flex items-center justify-center text-[#8f867e] hover:text-[#fbf6f1] transition-all"
          title="Back to Home"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => setActiveView('search')}
          className="w-8 h-8 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] flex items-center justify-center text-[#8f867e] hover:text-[#fbf6f1] transition-all"
          title="Search"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Center/Right: Pill Search Bar */}
      <div className="relative flex-1 max-w-md group mx-auto sm:mx-0">
        <Search className="w-3.5 h-3.5 text-[#6e665f] absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-[#f3c5a6] transition-colors" />
        <input
          type="text"
          placeholder="Search songs, artists, playlists..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="w-full pl-10 pr-9 py-2 bg-[#141312] border border-white/[0.08] rounded-full text-xs text-[#fbf6f1] placeholder:text-[#6e665f] focus:outline-none focus:border-[#f3c5a6]/50 focus:ring-1 focus:ring-[#f3c5a6]/30 transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8f867e] hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Right: Round Notifications, AI, and Audio Lab */}
      <div className="flex items-center gap-2.5">
        {/* Notification Bell */}
        <button
          onClick={() => setActiveView('insights')}
          className="relative w-8 h-8 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] flex items-center justify-center text-[#8f867e] hover:text-[#fbf6f1] transition-all"
          title="Notifications & Insights"
        >
          <Bell className="w-3.5 h-3.5" />
          <span className="w-1.5 h-1.5 rounded-full bg-[#f3c5a6] absolute top-2 right-2 ring-2 ring-[#0a0908]" />
        </button>

        {/* AI & Equalizer Action */}
        <button
          onClick={() => setAudioLabOpen(true)}
          className="w-8 h-8 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] flex items-center justify-center text-[#8f867e] hover:text-[#f3c5a6] transition-all"
          title="Audio Lab & Equalizer"
        >
          <Sliders className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => setAICompanionOpen(true)}
          className="w-8 h-8 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] flex items-center justify-center text-[#8f867e] hover:text-[#f3c5a6] transition-all"
          title="AURA Companion"
        >
          <Sparkles className="w-3.5 h-3.5" />
        </button>

        {/* User Account / Profile & Real-Time Sync Indicator */}
        <div className="relative flex items-center gap-2">
          {isAuthenticated && user ? (
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu((prev) => !prev)}
                className="flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
              >
                <div className="relative">
                  <img
                    src={user.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                    alt={user.name}
                    className="w-6 h-6 rounded-full object-cover ring-1 ring-aura-cyan"
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#0a0908] animate-pulse" />
                </div>
                <span className="hidden sm:inline text-xs font-medium text-white max-w-[100px] truncate">
                  {user.name}
                </span>
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-[#0e1017] border border-white/10 p-2 shadow-2xl z-50 backdrop-blur-xl">
                  <div className="px-3 py-2 border-b border-white/10 mb-1">
                    <p className="text-xs font-bold text-white truncate flex items-center justify-between">
                      <span>{user.name}</span>
                      {user.email?.includes('gmail') || (user as any).googleId ? (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                          Google
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-white/60">
                          Email
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-white/50 truncate font-mono mt-0.5">{user.email}</p>
                  </div>
                  <div className="px-3 py-1.5 text-[11px] text-emerald-400 font-mono flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Real-time DB Active</span>
                  </div>
                  <div className="px-3 py-1 text-[10px] text-white/40 leading-tight">
                    Every playlist, song like, EQ band & playback position is saved directly to your cloud DB.
                  </div>
                  <button
                    onClick={() => {
                      logout();
                      setShowProfileMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-red-400 hover:bg-red-500/10 transition-colors mt-2"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setAuthModalOpen(true, 'login')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-aura-cyan/10 hover:bg-aura-cyan/20 border border-aura-cyan/30 text-aura-cyan text-xs font-semibold transition-all shadow-sm"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
