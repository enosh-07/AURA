import React, { useState } from 'react';
import { Track } from '../../types/audio';
import { useAudioStore } from '../../stores/useAudioStore';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { useUIStore } from '../../stores/useUIStore';
import {
  Play,
  Pause,
  Heart,
  MoreVertical,
  Plus,
  ListPlus,
  Trash2,
  Music,
  UploadCloud,
  Users,
} from 'lucide-react';

interface TrackRowProps {
  track: Track;
  index: number;
  playlistContext?: Track[];
  onRemoveFromPlaylist?: () => void;
}

export const TrackRow: React.FC<TrackRowProps> = ({
  track,
  index,
  playlistContext,
  onRemoveFromPlaylist,
}) => {
  const currentTrack = useAudioStore((state) => state.currentTrack);
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const playTrack = useAudioStore((state) => state.playTrack);
  const togglePlay = useAudioStore((state) => state.togglePlay);
  const playNext = useAudioStore((state) => state.playNext);
  const addToQueue = useAudioStore((state) => state.addToQueue);

  const openArtistView = useUIStore((state) => state.openArtistView);
  const isLiked = useLibraryStore((state) => state.isLiked(track.id));
  const toggleLike = useLibraryStore((state) => state.toggleLike);
  const playlists = useLibraryStore((state) => state.playlists);
  const addTrackToPlaylist = useLibraryStore((state) => state.addTrackToPlaylist);
  const uploadTrackToCloud = useLibraryStore((state) => state.uploadTrackToCloud);

  const [showMenu, setShowMenu] = useState(false);
  const [showPlaylistSubmenu, setShowPlaylistSubmenu] = useState(false);

  const isCurrent = currentTrack?.id === track.id;

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCurrent) {
      togglePlay();
    } else {
      playTrack(track, playlistContext);
    }
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      onClick={handlePlayClick}
      className={`group relative flex items-center justify-between px-3 py-2 rounded-2xl cursor-pointer transition-all ${
        isCurrent
          ? 'bg-aura-cyan/15 border border-aura-cyan/30 text-white'
          : 'hover:bg-white/5 border border-transparent text-slate-300'
      }`}
    >
      {/* Left: Index / Play Icon + Artwork + Title/Artist */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-6 flex items-center justify-center text-xs font-mono text-aura-muted">
          {isCurrent && isPlaying ? (
            <div className="flex items-end gap-0.5 h-3.5">
              <span className="w-1 bg-aura-cyan h-full animate-pulse" />
              <span className="w-1 bg-aura-cyan h-2 animate-pulse delay-75" />
              <span className="w-1 bg-aura-cyan h-3 animate-pulse delay-150" />
            </div>
          ) : (
            <>
              <span className="group-hover:hidden">{index + 1}</span>
              <Play className="w-3.5 h-3.5 hidden group-hover:block fill-current text-aura-cyan" />
            </>
          )}
        </div>

        <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-aura-surface flex-shrink-0">
          <img src={track.artwork} alt={track.title} className="w-full h-full object-cover" />
        </div>

        <div className="flex flex-col min-w-0">
          <span
            className={`text-sm font-semibold truncate ${
              isCurrent ? 'text-aura-cyan' : 'group-hover:text-white'
            }`}
          >
            {track.title}
          </span>
          <span
            onClick={(e) => {
              e.stopPropagation();
              const artistToken =
                track.artistId ||
                `artist_${encodeURIComponent(track.artist)}__${encodeURIComponent(track.artist)}`;
              openArtistView(artistToken);
            }}
            className="text-xs text-aura-muted hover:text-aura-cyan hover:underline transition-colors truncate cursor-pointer z-10 self-start"
          >
            {track.artist}
          </span>
        </div>
      </div>

      {/* Center: Album & Genre Pill */}
      <div className="hidden md:flex items-center gap-3 flex-1 max-w-sm text-xs text-aura-muted">
        <span className="truncate flex-1">{track.album}</span>
        <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/5 text-[10px] uppercase font-mono">
          {track.genre}
        </span>
        {track.qualityTier === 'HI_RES_LOSSLESS' ? (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            HI-RES
          </span>
        ) : track.isLossless || track.qualityTier === 'LOSSLESS' ? (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-aura-cyan/15 text-aura-cyan border border-aura-cyan/30">
            LOSSLESS
          </span>
        ) : track.codec ? (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono text-slate-400 bg-white/5 border border-white/10">
            {track.codec}
          </span>
        ) : null}
      </div>

      {/* Right: Like + Duration + Context Menu */}
      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => toggleLike(track.id)}
          className={`p-2 rounded-xl transition-colors ${
            isLiked ? 'text-aura-crimson' : 'text-aura-muted hover:text-white'
          }`}
        >
          <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
        </button>

        <span className="text-xs font-mono text-aura-muted w-10 text-right">
          {formatDuration(track.duration)}
        </span>

        {/* More Actions Menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 rounded-xl text-aura-muted hover:text-white hover:bg-white/10 transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-8 z-30 w-48 bg-aura-card border border-aura-border rounded-2xl p-1.5 shadow-2xl flex flex-col gap-1 text-xs">
              <button
                onClick={() => {
                  const artistToken =
                    track.artistId ||
                    `artist_${encodeURIComponent(track.artist)}__${encodeURIComponent(track.artist)}`;
                  openArtistView(artistToken);
                  setShowMenu(false);
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/10 text-left text-slate-200"
              >
                <Users className="w-3.5 h-3.5 text-aura-cyan" />
                View Artist Profile
              </button>
              <button
                onClick={() => {
                  playNext(track);
                  setShowMenu(false);
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/10 text-left text-slate-200"
              >
                <Plus className="w-3.5 h-3.5 text-aura-cyan" />
                Play Next
              </button>
              <button
                onClick={() => {
                  addToQueue(track);
                  setShowMenu(false);
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/10 text-left text-slate-200"
              >
                <ListPlus className="w-3.5 h-3.5 text-aura-violet" />
                Add to Queue
              </button>

              {track.isLocal && (
                <button
                  onClick={async () => {
                    setShowMenu(false);
                    await uploadTrackToCloud(track.id);
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-aura-cyan/15 text-left text-aura-cyan font-medium"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  Sync to Cloud
                </button>
              )}

              {/* Add to Playlist trigger */}
              <button
                onClick={() => setShowPlaylistSubmenu(!showPlaylistSubmenu)}
                className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/10 text-left text-slate-200"
              >
                <span className="flex items-center gap-2">
                  <Music className="w-3.5 h-3.5 text-aura-amber" />
                  Add to Playlist
                </span>
              </button>

              {showPlaylistSubmenu && (
                <div className="pl-4 py-1 flex flex-col gap-1 border-t border-white/5">
                  {playlists.map((pl) => (
                    <button
                      key={pl.id}
                      onClick={() => {
                        addTrackToPlaylist(pl.id, track.id);
                        setShowMenu(false);
                        setShowPlaylistSubmenu(false);
                      }}
                      className="px-2 py-1 rounded-lg hover:bg-white/10 text-left text-aura-muted hover:text-white truncate"
                    >
                      {pl.title}
                    </button>
                  ))}
                </div>
              )}

              {onRemoveFromPlaylist && (
                <button
                  onClick={() => {
                    onRemoveFromPlaylist();
                    setShowMenu(false);
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-red-500/20 text-red-400 text-left border-t border-white/5 mt-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove from Playlist
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
