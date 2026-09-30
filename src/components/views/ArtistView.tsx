import React, { useState, useEffect } from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { useAudioStore } from '../../stores/useAudioStore';
import { apiClient } from '../../services/apiClient';
import { Artist } from '../../types/audio';
import { TrackRow } from '../common/TrackRow';
import {
  Play,
  Shuffle,
  BadgeCheck,
  Disc,
  Users,
  Radio,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';

export const ArtistView: React.FC = () => {
  const selectedArtistId = useUIStore((state) => state.selectedArtistId);
  const setActiveView = useUIStore((state) => state.setActiveView);
  const openAlbumView = useUIStore((state) => state.openAlbumView);
  const playTrack = useAudioStore((state) => state.playTrack);

  const [artist, setArtist] = useState<Artist | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!selectedArtistId) return;

    setArtist(null);
    setIsLoading(true);
    apiClient
      .getOnlineArtist(selectedArtistId)
      .then((res) => {
        if (res) {
          setArtist(res);
        }
      })
      .catch((err) => console.error('Artist fetch error:', err))
      .finally(() => setIsLoading(false));
  }, [selectedArtistId]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="relative w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-[#f3c5a6]/30 animate-ping" />
          <Radio className="w-8 h-8 text-[#f3c5a6] animate-pulse" />
        </div>
        <p className="text-sm font-medium text-[#8f867e]">Loading Artist Profile & Discography...</p>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p className="text-base text-[#8f867e]">Artist profile not found.</p>
        <button
          onClick={() => setActiveView('search')}
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Search
        </button>
      </div>
    );
  }

  const topTracks = artist.topTracks || [];
  const albums = artist.albums || [];

  const handlePlayAll = () => {
    if (topTracks.length > 0) {
      playTrack(topTracks[0], topTracks);
    }
  };

  const handleShuffle = () => {
    if (topTracks.length > 0) {
      const shuffled = [...topTracks].sort(() => Math.random() - 0.5);
      playTrack(shuffled[0], shuffled);
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-32 animate-in fade-in duration-300">
      {/* Back button */}
      <div>
        <button
          onClick={() => setActiveView('search')}
          className="flex items-center gap-2 text-xs font-medium text-[#8f867e] hover:text-[#fbf6f1] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Search
        </button>
      </div>

      {/* Hero Header Banner */}
      <div className="relative rounded-3xl overflow-hidden bg-[#141312] border border-white/[0.08] p-6 sm:p-10 flex flex-col md:flex-row items-center md:items-end justify-between gap-8 group shadow-2xl">
        {/* Subtle warm ambient lighting */}
        <div className="absolute -left-20 -top-20 w-96 h-96 rounded-full bg-[#f3c5a6]/10 blur-[120px] pointer-events-none" />
        <div className="absolute right-0 bottom-0 w-80 h-80 rounded-full bg-[#241d19]/40 blur-[100px] pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-end gap-6 text-center sm:text-left">
          {/* Artist Photo */}
          <div className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-full overflow-hidden shadow-2xl ring-2 ring-[#f3c5a6]/30 bg-[#0d0c0b] flex-shrink-0 group-hover:scale-102 transition-transform duration-500">
            <img src={artist.avatar} alt={artist.name} className="w-full h-full object-cover" />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#241d19] text-[#f3c5a6] text-[11px] font-semibold uppercase tracking-wider border border-[#f3c5a6]/20">
                <BadgeCheck className="w-3.5 h-3.5 text-[#f3c5a6] fill-[#f3c5a6]/20" /> Verified Artist
              </span>
              <span className="text-xs font-medium text-[#8f867e]">{artist.genre}</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-serif text-[#fbf6f1] tracking-tight">
              {artist.name}
            </h1>

            <p className="text-xs sm:text-sm text-[#8f867e] flex items-center justify-center sm:justify-start gap-2">
              <Users className="w-3.5 h-3.5 text-[#f3c5a6]" />
              <span>{(artist.monthlyListeners || 18500000).toLocaleString()} monthly listeners</span>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="relative z-10 flex items-center gap-3">
          <button
            onClick={handlePlayAll}
            className="flex items-center gap-2.5 px-7 py-3 rounded-full bg-[#f3c5a6] text-[#141210] font-semibold text-sm shadow-md hover:scale-105 active:scale-95 transition-all"
          >
            <Play className="w-4 h-4 fill-current ml-0.5" />
            Play Artist
          </button>
          <button
            onClick={handleShuffle}
            className="p-3 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-[#8f867e] hover:text-[#fbf6f1] border border-white/[0.08] transition-colors"
            title="Shuffle Discography"
          >
            <Shuffle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Top Hit Songs Produced by Artist */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-serif text-[#fbf6f1] tracking-tight flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#f3c5a6]" /> Popular Tracks
          </h2>
          <span className="text-xs text-[#8f867e]">{topTracks.length} hit tracks</span>
        </div>

        <div className="flex flex-col gap-1 bg-[#141312] rounded-2xl p-3 border border-white/[0.06]">
          {topTracks.length === 0 ? (
            <div className="py-8 text-center text-sm text-[#8f867e]">No hit tracks listed yet for this artist.</div>
          ) : (
            topTracks.slice(0, 25).map((track, idx) => (
              <TrackRow key={track.id} track={track} index={idx} playlistContext={topTracks} />
            ))
          )}
        </div>
      </div>

      {/* Discography / Albums Section */}
      {albums.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-serif text-[#fbf6f1] tracking-tight flex items-center gap-2">
              <Disc className="w-4 h-4 text-[#f3c5a6]" /> Discography & Albums
            </h2>
            <span className="text-xs text-[#8f867e]">{albums.length} releases</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {albums.map((alb) => (
              <div
                key={alb.id}
                onClick={() => openAlbumView(alb.id)}
                className="group p-3 rounded-2xl bg-[#141312] border border-white/[0.06] hover:border-[#f3c5a6]/30 cursor-pointer flex flex-col gap-2.5 relative shadow-md transition-all"
              >
                <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-[#0d0c0b]">
                  <img
                    src={alb.artwork}
                    alt={alb.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <div className="w-10 h-10 rounded-full bg-[#f3c5a6] text-[#141210] flex items-center justify-center shadow-lg">
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col min-w-0">
                  <h4 className="text-xs font-medium text-[#fbf6f1] truncate group-hover:text-[#f3c5a6] transition-colors">
                    {alb.title}
                  </h4>
                  <div className="flex items-center justify-between mt-1 text-[11px] text-[#8f867e]">
                    <span>{alb.year}</span>
                    <span>{alb.trackCount} tracks</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
