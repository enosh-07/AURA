import React, { useState, useEffect } from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { useAudioStore } from '../../stores/useAudioStore';
import { apiClient } from '../../services/apiClient';
import { Album, Track } from '../../types/audio';
import { TrackRow } from '../common/TrackRow';
import {
  Play,
  Shuffle,
  Disc,
  Clock,
  ArrowLeft,
  Calendar,
  Music,
  Radio,
  Share2,
} from 'lucide-react';

export const AlbumView: React.FC = () => {
  const selectedAlbumId = useUIStore((state) => state.selectedAlbumId);
  const setActiveView = useUIStore((state) => state.setActiveView);
  const openArtistView = useUIStore((state) => state.openArtistView);
  const playTrack = useAudioStore((state) => state.playTrack);

  const [album, setAlbum] = useState<Album | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!selectedAlbumId) return;

    setIsLoading(true);
    apiClient
      .getOnlineAlbum(selectedAlbumId)
      .then((res) => {
        if (res) {
          setAlbum(res);
        }
      })
      .catch((err) => console.error('Album fetch error:', err))
      .finally(() => setIsLoading(false));
  }, [selectedAlbumId]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="relative w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-aura-violet/30 animate-ping" />
          <Disc className="w-8 h-8 text-aura-violet animate-spin" />
        </div>
        <p className="text-sm font-semibold text-slate-300">Loading Album Tracklist & Metadata...</p>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p className="text-base text-aura-muted">Album not found.</p>
        <button
          onClick={() => setActiveView('search')}
          className="px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Search
        </button>
      </div>
    );
  }

  const tracks = album.tracks || [];
  const totalSeconds = tracks.reduce((acc, t) => acc + (t.duration || 180), 0);
  const totalMinutes = Math.floor(totalSeconds / 60);

  const handlePlayAll = () => {
    if (tracks.length > 0) {
      playTrack(tracks[0], tracks);
    }
  };

  const handleShuffle = () => {
    if (tracks.length > 0) {
      const shuffled = [...tracks].sort(() => Math.random() - 0.5);
      playTrack(shuffled[0], shuffled);
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-32 animate-in fade-in duration-300">
      {/* Back button */}
      <div>
        <button
          onClick={() => setActiveView('search')}
          className="flex items-center gap-2 text-xs font-semibold text-aura-muted hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Search
        </button>
      </div>

      {/* Album Hero Header */}
      <div className="relative rounded-3xl overflow-hidden aura-glass-elevated border border-white/10 p-6 sm:p-10 flex flex-col md:flex-row items-center md:items-end justify-between gap-8 group">
        <div className="absolute -left-20 -top-20 w-96 h-96 rounded-full bg-aura-violet/20 blur-[120px] pointer-events-none" />
        <div className="absolute right-0 bottom-0 w-80 h-80 rounded-full bg-aura-cyan/20 blur-[100px] pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-end gap-6 text-center sm:text-left">
          {/* Big Album Art */}
          <div className="relative w-48 h-48 sm:w-56 sm:h-56 rounded-3xl overflow-hidden shadow-2xl ring-2 ring-white/15 bg-aura-void flex-shrink-0 group-hover:scale-102 transition-transform duration-500">
            <img src={album.artwork} alt={album.title} className="w-full h-full object-cover" />
          </div>

          <div className="flex flex-col gap-2 max-w-lg">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <span className="px-3 py-1 rounded-full bg-aura-violet/20 text-aura-violet text-[11px] font-bold uppercase tracking-wider border border-aura-violet/30 flex items-center gap-1.5">
                <Disc className="w-3.5 h-3.5" /> Official Album
              </span>
              <span className="text-xs font-medium text-slate-400">{album.genre}</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              {album.title}
            </h1>

            {/* Clickable Artist Name */}
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <button
                onClick={() => {
                  const artistToken =
                    album.artistId ||
                    `artist_${encodeURIComponent(album.artist)}__${encodeURIComponent(album.artist)}`;
                  openArtistView(artistToken);
                }}
                className="text-sm sm:text-base font-bold text-aura-cyan hover:underline transition-all"
              >
                {album.artist}
              </button>
            </div>

            <div className="flex items-center justify-center sm:justify-start gap-4 text-xs font-mono text-aura-muted mt-1">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> {album.year}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Music className="w-3.5 h-3.5" /> {album.trackCount} tracks
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> {totalMinutes} min
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="relative z-10 flex items-center gap-3">
          <button
            onClick={handlePlayAll}
            className="flex items-center gap-2.5 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-aura-cyan to-aura-violet text-aura-void font-extrabold text-sm shadow-glow-cyan hover:scale-105 active:scale-95 transition-all"
          >
            <Play className="w-5 h-5 fill-current" />
            Play Album
          </button>
          <button
            onClick={handleShuffle}
            className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-aura-cyan/40 transition-colors"
            title="Shuffle Album"
          >
            <Shuffle className="w-5 h-5 text-aura-cyan" />
          </button>
        </div>
      </div>

      {/* Album Tracklist Table */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Music className="w-4 h-4 text-aura-cyan animate-pulse" /> Tracklist
          </h2>
          <span className="text-xs font-mono text-aura-muted">{tracks.length} tracks</span>
        </div>

        <div className="flex flex-col gap-1 bg-aura-card/40 rounded-3xl p-3 border border-aura-border">
          {tracks.map((track, idx) => (
            <TrackRow key={track.id} track={track} index={idx} playlistContext={tracks} />
          ))}
        </div>
      </div>
    </div>
  );
};
