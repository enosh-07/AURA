import React, { useState, useEffect } from 'react';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { useAudioStore } from '../../stores/useAudioStore';
import { useUIStore } from '../../stores/useUIStore';
import { TrackRow } from '../common/TrackRow';
import { apiClient } from '../../services/apiClient';
import { Track } from '../../types/audio';
import {
  Play,
  Shuffle,
  Trash2,
  Edit2,
  Check,
  X,
  Disc,
  Clock,
  ArrowLeft,
  Plus,
  Sparkles,
} from 'lucide-react';

export const PlaylistView: React.FC = () => {
  const selectedPlaylistId = useUIStore((state) => state.selectedPlaylistId);
  const setActiveView = useUIStore((state) => state.setActiveView);

  const playlists = useLibraryStore((state) => state.playlists);
  const allTracks = useLibraryStore((state) => state.allTracks);
  const deletePlaylist = useLibraryStore((state) => state.deletePlaylist);
  const updatePlaylist = useLibraryStore((state) => state.updatePlaylist);
  const addTrackToPlaylist = useLibraryStore((state) => state.addTrackToPlaylist);
  const removeTrackFromPlaylist = useLibraryStore((state) => state.removeTrackFromPlaylist);

  const playTrack = useAudioStore((state) => state.playTrack);
  const toggleShuffle = useAudioStore((state) => state.toggleShuffle);

  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDesc, setEditedDesc] = useState('');
  const [recommendations, setRecommendations] = useState<Track[]>([]);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);

  const playlist = playlists.find((p) => p.id === selectedPlaylistId);

  // Get tracks for this playlist
  const playlistTracks = playlist
    ? (playlist.trackIds
        .map((id) => allTracks.find((t) => t.id === id))
        .filter(Boolean) as typeof allTracks)
    : [];

  const totalDuration = playlistTracks.reduce((acc, t) => acc + t.duration, 0);
  const formatTotalTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    return `${mins} min ${seconds % 60} sec`;
  };

  // Fetch smart additions based on first track or discover mix
  useEffect(() => {
    if (!playlist) return;
    let isCancelled = false;

    const fetchRecs = async () => {
      setIsLoadingRecs(true);
      try {
        let recs: Track[] = [];
        if (playlistTracks.length > 0) {
          recs = await apiClient.getSimilarTracks(playlistTracks[0].id, 5);
        }
        if (recs.length === 0) {
          recs = await apiClient.getDiscoverMix();
        }

        // Filter out tracks already in playlist
        const existingIds = new Set(playlist.trackIds);
        const filtered = recs.filter((t) => !existingIds.has(t.id));

        if (!isCancelled) {
          setRecommendations(filtered.slice(0, 4));
        }
      } catch {
        // Ignore fallback
      } finally {
        if (!isCancelled) setIsLoadingRecs(false);
      }
    };

    fetchRecs();
    return () => {
      isCancelled = true;
    };
  }, [playlist?.id, playlistTracks.length]);

  if (!playlist) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-aura-muted gap-3">
        <Disc className="w-12 h-12 opacity-30 text-aura-cyan" />
        <p className="text-sm">Playlist not found</p>
        <button
          onClick={() => setActiveView('library')}
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs text-white"
        >
          Return to Library
        </button>
      </div>
    );
  }

  const handleStartEdit = () => {
    setEditedTitle(playlist.title);
    setEditedDesc(playlist.description || '');
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (editedTitle.trim()) {
      await updatePlaylist(playlist.id, {
        title: editedTitle.trim(),
        description: editedDesc.trim(),
      });
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handlePlayAll = (shuffle = false) => {
    if (playlistTracks.length === 0) return;
    if (shuffle) toggleShuffle();
    playTrack(playlistTracks[0], playlistTracks);
  };

  const handleDelete = async () => {
    if (window.confirm(`Delete playlist "${playlist.title}"?`)) {
      await deletePlaylist(playlist.id);
      setActiveView('library');
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-32 animate-in fade-in duration-300">
      {/* Back button */}
      <button
        onClick={() => setActiveView('library')}
        className="self-start flex items-center gap-2 text-xs font-semibold text-aura-muted hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Library
      </button>

      {/* Playlist Hero Header */}
      <div className="flex flex-col md:flex-row items-center md:items-end gap-6 p-6 rounded-3xl bg-gradient-to-b from-aura-card to-aura-base border border-aura-border shadow-xl">
        <div className="w-44 h-44 sm:w-52 sm:h-52 rounded-2xl overflow-hidden shadow-2xl flex-shrink-0 bg-aura-surface border border-white/10">
          <img src={playlist.coverUrl} alt={playlist.title} className="w-full h-full object-cover" />
        </div>

        <div className="flex-1 flex flex-col gap-2 min-w-0 text-center md:text-left">
          <span className="text-[10px] uppercase font-mono tracking-widest text-aura-cyan font-bold">
            Curated Playlist
          </span>

          {isEditing ? (
            <div className="flex flex-col gap-2.5 max-w-lg">
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                placeholder="Playlist Title"
                className="bg-aura-surface border border-aura-cyan/50 focus:border-aura-cyan rounded-xl px-3.5 py-2 text-xl font-bold text-white outline-none"
                autoFocus
              />
              <input
                type="text"
                value={editedDesc}
                onChange={(e) => setEditedDesc(e.target.value)}
                placeholder="Add an optional description"
                className="bg-aura-surface border border-aura-border focus:border-aura-cyan rounded-xl px-3 py-1.5 text-xs text-aura-muted outline-none"
              />
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleSaveEdit}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-aura-cyan text-aura-void text-xs font-bold shadow-glow-cyan hover:scale-105 active:scale-95 transition-all"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight truncate">
                {playlist.title}
              </h1>
              <p className="text-xs sm:text-sm text-aura-muted line-clamp-2">
                {playlist.description || 'Custom listening compilation'}
              </p>
            </>
          )}

          <div className="flex items-center justify-center md:justify-start gap-3 text-xs text-aura-muted font-mono pt-2">
            <span>{playlistTracks.length} tracks</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formatTotalTime(totalDuration)}
            </span>
          </div>

          {/* Actions: Play All, Shuffle, Edit, Delete */}
          <div className="flex items-center justify-center md:justify-start gap-3 pt-3">
            <button
              onClick={() => handlePlayAll(false)}
              disabled={playlistTracks.length === 0}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-aura-cyan to-aura-violet text-aura-void font-extrabold text-xs shadow-glow-cyan hover:scale-105 active:scale-95 disabled:opacity-40 transition-all"
            >
              <Play className="w-4 h-4 fill-current" />
              Play All
            </button>

            <button
              onClick={() => handlePlayAll(true)}
              disabled={playlistTracks.length === 0}
              className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-aura-muted hover:text-white border border-white/5 disabled:opacity-40 transition-colors"
              title="Shuffle Play"
            >
              <Shuffle className="w-4 h-4" />
            </button>

            {!isEditing && (
              <button
                onClick={handleStartEdit}
                className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-aura-muted hover:text-aura-cyan border border-white/5 transition-colors"
                title="Edit Playlist Details"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={handleDelete}
              className="p-3 rounded-2xl bg-white/5 hover:bg-red-500/20 text-aura-muted hover:text-red-400 border border-white/5 transition-colors"
              title="Delete Playlist"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Playlist Track List */}
      <div className="flex flex-col gap-1 bg-aura-card/40 rounded-3xl p-3 border border-aura-border">
        {playlistTracks.length > 0 ? (
          playlistTracks.map((track, idx) => (
            <TrackRow
              key={`${track.id}-${idx}`}
              track={track}
              index={idx}
              playlistContext={playlistTracks}
              onRemoveFromPlaylist={() => removeTrackFromPlaylist(playlist.id, track.id)}
            />
          ))
        ) : (
          <div className="p-12 text-center text-aura-muted text-xs">
            This playlist has no tracks yet. Use "Add to Playlist" from any song row to curate it!
          </div>
        )}
      </div>

      {/* Recommended Sonic Additions */}
      {recommendations.length > 0 && (
        <div className="flex flex-col gap-3 p-5 rounded-3xl bg-aura-card/30 border border-aura-border/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-aura-cyan" />
              <h3 className="text-sm font-bold text-white">Recommended for this Playlist</h3>
            </div>
            <span className="text-[10px] text-aura-muted font-mono">Acoustic Proximity Matching</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            {recommendations.map((track) => (
              <div
                key={track.id}
                className="group flex items-center justify-between p-3 rounded-2xl bg-aura-surface/60 hover:bg-aura-surface border border-white/5 hover:border-aura-cyan/30 transition-all"
              >
                <div
                  className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
                  onClick={() => playTrack(track, [track])}
                >
                  <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-aura-void">
                    <img src={track.artwork} alt={track.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate group-hover:text-aura-cyan transition-colors">
                      {track.title}
                    </p>
                    <p className="text-[11px] text-aura-muted truncate">{track.artist}</p>
                  </div>
                </div>

                <button
                  onClick={() => addTrackToPlaylist(playlist.id, track.id)}
                  title="Add to Playlist"
                  className="p-2 ml-2 rounded-xl bg-white/5 hover:bg-aura-cyan hover:text-aura-void text-aura-muted transition-colors flex-shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
