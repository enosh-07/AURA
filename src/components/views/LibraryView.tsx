import React, { useState } from 'react';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { useAudioStore } from '../../stores/useAudioStore';
import { useUIStore } from '../../stores/useUIStore';
import { TrackRow } from '../common/TrackRow';
import {
  Library,
  Heart,
  ListMusic,
  FolderOpen,
  Plus,
  Play,
  Music,
  Disc,
} from 'lucide-react';

export const LibraryView: React.FC = () => {
  const allTracks = useLibraryStore((state) => state.allTracks);
  const localTracks = useLibraryStore((state) => state.localTracks);
  const likedSongIds = useLibraryStore((state) => state.likedSongIds);
  const playlists = useLibraryStore((state) => state.playlists);
  const createPlaylist = useLibraryStore((state) => state.createPlaylist);

  const playTrack = useAudioStore((state) => state.playTrack);
  const setActiveView = useUIStore((state) => state.setActiveView);

  const [activeTab, setActiveTab] = useState<'all' | 'liked' | 'playlists' | 'local'>('all');

  const likedTracks = allTracks.filter((t) => likedSongIds.includes(t.id));

  const handleCreatePlaylist = async () => {
    const pl = await createPlaylist('Untitled Playlist', 'Created in Library');
    setActiveView('playlist', pl.id);
  };

  const currentDisplayTracks =
    activeTab === 'liked'
      ? likedTracks
      : activeTab === 'local'
      ? localTracks
      : allTracks;

  return (
    <div className="flex flex-col gap-6 pb-32 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Audio Collection</h1>
          <p className="text-xs text-aura-muted mt-1">
            Your personal catalog, custom compilations, and liked frequencies.
          </p>
        </div>

        <button
          onClick={handleCreatePlaylist}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-aura-cyan to-aura-violet text-aura-void text-xs font-bold shadow-glow-cyan/20 hover:scale-105 transition-transform"
        >
          <Plus className="w-4 h-4" />
          Create Playlist
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'all'
              ? 'bg-aura-cyan text-aura-void font-bold shadow-glow-cyan/20'
              : 'bg-white/5 hover:bg-white/10 text-slate-300'
          }`}
        >
          <Music className="w-3.5 h-3.5" />
          All Songs ({allTracks.length})
        </button>

        <button
          onClick={() => setActiveTab('liked')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'liked'
              ? 'bg-aura-crimson text-white font-bold'
              : 'bg-white/5 hover:bg-white/10 text-slate-300'
          }`}
        >
          <Heart className="w-3.5 h-3.5 fill-current" />
          Liked ({likedTracks.length})
        </button>

        <button
          onClick={() => setActiveTab('playlists')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'playlists'
              ? 'bg-aura-violet text-white font-bold'
              : 'bg-white/5 hover:bg-white/10 text-slate-300'
          }`}
        >
          <ListMusic className="w-3.5 h-3.5" />
          Playlists ({playlists.length})
        </button>

        <button
          onClick={() => setActiveTab('local')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'local'
              ? 'bg-aura-amber text-aura-void font-bold'
              : 'bg-white/5 hover:bg-white/10 text-slate-300'
          }`}
        >
          <FolderOpen className="w-3.5 h-3.5" />
          Imported Files ({localTracks.length})
        </button>
      </div>

      {/* Content based on Tab */}
      {activeTab === 'playlists' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {playlists.map((pl) => (
            <div
              key={pl.id}
              onClick={() => setActiveView('playlist', pl.id)}
              className="p-4 rounded-3xl bg-aura-card hover:bg-aura-surface border border-aura-border hover:border-aura-violet/40 transition-all cursor-pointer group flex flex-col gap-3 shadow-lg"
            >
              <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-aura-surface">
                <img
                  src={pl.coverUrl}
                  alt={pl.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <div className="w-12 h-12 rounded-full bg-aura-cyan text-aura-void flex items-center justify-center shadow-lg">
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white group-hover:text-aura-cyan transition-colors truncate">
                  {pl.title}
                </h3>
                <p className="text-xs text-aura-muted mt-0.5">{pl.trackIds.length} tracks</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-1 bg-aura-card/40 rounded-3xl p-3 border border-aura-border">
          {currentDisplayTracks.length > 0 ? (
            currentDisplayTracks.map((track, idx) => (
              <TrackRow
                key={track.id}
                track={track}
                index={idx}
                playlistContext={currentDisplayTracks}
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-aura-muted gap-3">
              <Library className="w-10 h-10 opacity-30 text-aura-cyan" />
              <p className="text-sm font-semibold text-slate-300">
                {activeTab === 'liked'
                  ? 'No liked tracks yet'
                  : activeTab === 'local'
                  ? 'No imported audio files found'
                  : 'Your library is empty'}
              </p>
              {activeTab === 'local' && (
                <button
                  onClick={() => setActiveView('studio')}
                  className="px-4 py-2 rounded-xl bg-aura-cyan text-aura-void text-xs font-bold"
                >
                  Go to Local Music Studio
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
