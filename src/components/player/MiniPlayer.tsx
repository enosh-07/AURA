import React, { useRef } from 'react';
import { useAudioStore } from '../../stores/useAudioStore';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { useUIStore } from '../../stores/useUIStore';
import { VolumeControl } from './VolumeControl';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Heart,
  Sliders,
  Mic2,
  ListMusic,
  Maximize2,
  Moon,
  Sparkles,
  Radio,
} from 'lucide-react';

export const MiniPlayer: React.FC = () => {
  const currentTrack = useAudioStore((state) => state.currentTrack);
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const togglePlay = useAudioStore((state) => state.togglePlay);
  const nextTrack = useAudioStore((state) => state.nextTrack);
  const prevTrack = useAudioStore((state) => state.prevTrack);
  const shuffle = useAudioStore((state) => state.shuffle);
  const toggleShuffle = useAudioStore((state) => state.toggleShuffle);
  const repeat = useAudioStore((state) => state.repeat);
  const cycleRepeat = useAudioStore((state) => state.cycleRepeat);
  const currentTime = useAudioStore((state) => state.currentTime);
  const duration = useAudioStore((state) => state.duration);
  const seek = useAudioStore((state) => state.seek);
  const sleepTimerRemaining = useAudioStore((state) => state.sleepTimerRemaining);
  const actualQuality = useAudioStore((state) => state.actualDeliveredQuality);

  const isLiked = useLibraryStore((state) => (currentTrack ? state.isLiked(currentTrack.id) : false));
  const toggleLike = useLibraryStore((state) => state.toggleLike);

  const setFullscreenPlayerOpen = useUIStore((state) => state.setFullscreenPlayerOpen);
  const setAudioLabOpen = useUIStore((state) => state.setAudioLabOpen);
  const setLyricsOpen = useUIStore((state) => state.setLyricsOpen);
  const isLyricsOpen = useUIStore((state) => state.isLyricsOpen);
  const setQueueDrawerOpen = useUIStore((state) => state.setQueueDrawerOpen);
  const isQueueDrawerOpen = useUIStore((state) => state.isQueueDrawerOpen);
  const setSleepTimerOpen = useUIStore((state) => state.setSleepTimerOpen);
  const setQualityPanelOpen = useUIStore((state) => state.setQualityPanelOpen);
  const isQualityPanelOpen = useUIStore((state) => state.isQualityPanelOpen);
  const openArtistView = useUIStore((state) => state.openArtistView);

  const scrubBarRef = useRef<HTMLDivElement | null>(null);
  const touchStartY = useRef<number | null>(null);

  if (!currentTrack) return null;

  const formatTime = (secs: number) => {
    if (Number.isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const percent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrubBarRef.current || duration <= 0) return;
    const rect = scrubBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seek(pos * duration);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    touchStartY.current = null;
    // Swipe up on mobile opens full player
    if (deltaY < -35) {
      setFullscreenPlayerOpen(true);
    }
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={(e) => {
        // On mobile, tapping anywhere outside interactive controls expands to fullscreen
        if (window.innerWidth < 768) {
          const target = e.target as HTMLElement;
          if (!target.closest('button') && !target.closest('input')) {
            setFullscreenPlayerOpen(true);
          }
        }
      }}
      className="fixed bottom-[calc(3.75rem+env(safe-area-inset-bottom,0px))] md:bottom-0 left-2 right-2 md:left-0 md:right-0 z-30 md:z-40 rounded-2xl md:rounded-none bg-[#12100e]/95 md:bg-[#0e0d0c]/98 backdrop-blur-2xl border border-white/10 md:border-t md:border-x-0 md:border-b-0 md:border-white/[0.08] px-3 sm:px-6 py-2.5 sm:py-3 select-none transition-all shadow-2xl md:shadow-none overflow-hidden"
    >
      {/* Mobile Subtle Progress Bar at Top of Floating Card */}
      <div className="md:hidden absolute top-0 left-0 right-0 h-[2.5px] bg-white/10">
        <div
          className="h-full bg-[#f3c5a6] transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="max-w-[1700px] mx-auto flex items-center justify-between gap-3 sm:gap-6">
        
        {/* Left: Track Information */}
        <div className="flex items-center gap-3 min-w-0 flex-1 md:flex-initial md:w-[280px] shrink-0">
          <div
            onClick={(e) => {
              e.stopPropagation();
              setFullscreenPlayerOpen(true);
            }}
            className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-lg overflow-hidden cursor-pointer group shrink-0 bg-[#161514] border border-white/10 shadow-md"
          >
            <img
              src={currentTrack.artwork}
              alt={currentTrack.title}
              className={`w-full h-full object-cover transition-transform duration-500 ${
                isPlaying ? 'scale-105' : 'group-hover:scale-105'
              }`}
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Maximize2 className="w-3.5 h-3.5 text-white" />
            </div>
          </div>

          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setFullscreenPlayerOpen(true);
                }}
                className="text-sm font-semibold sm:font-medium text-[#fbf6f1] hover:text-[#f3c5a6] transition-colors truncate cursor-pointer"
              >
                {currentTrack.title}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLike(currentTrack.id);
                }}
                className={`p-0.5 transition-transform active:scale-125 shrink-0 ${
                  isLiked ? 'text-[#f3c5a6]' : 'text-[#8f867e] hover:text-[#fbf6f1]'
                }`}
                title={isLiked ? 'Remove from Liked' : 'Like Song'}
              >
                <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
              </button>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  const artistToken =
                    currentTrack.artistId ||
                    `artist_${encodeURIComponent(currentTrack.artist)}__${encodeURIComponent(currentTrack.artist)}`;
                  openArtistView(artistToken);
                }}
                className="text-xs text-[#8f867e] hover:text-[#f3c5a6] hover:underline transition-colors truncate cursor-pointer self-start"
              >
                {currentTrack.artist}
              </span>
              <span className="hidden sm:inline text-[#8f867e]/40 text-[9px]">•</span>
              {/* Actual Quality Badge (hidden on smallest screens to preserve title space) */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setQualityPanelOpen(true);
                }}
                title="View Audio Quality & Bit-Perfect Diagnostics"
                className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#241d19] hover:bg-[#342a23] border border-[#f3c5a6]/30 text-[#f3c5a6] text-[9px] font-mono tracking-wider transition-all hover:scale-105 shrink-0"
              >
                <Sparkles className="w-2.5 h-2.5" />
                <span>
                  {actualQuality?.qualityTier === 'HI_RES_LOSSLESS'
                    ? `HI-RES • ${actualQuality.codec} ${actualQuality.bitDepth}/${Math.round(actualQuality.sampleRate / 1000)}k`
                    : actualQuality?.qualityTier === 'LOSSLESS'
                    ? `LOSSLESS • ${actualQuality.codec} ${actualQuality.bitDepth}/${Math.round(actualQuality.sampleRate / 1000)}k`
                    : actualQuality?.qualityTier === 'HIGH'
                    ? `HIGH • ${actualQuality.codec} ${actualQuality.bitrate}k`
                    : `STANDARD`}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Center: Playback Controls */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleShuffle();
            }}
            title={shuffle ? 'Shuffle On' : 'Shuffle Off'}
            className={`hidden md:flex p-2 rounded-full transition-colors ${
              shuffle ? 'text-[#f3c5a6]' : 'text-[#8f867e] hover:text-[#fbf6f1]'
            }`}
          >
            <Shuffle className="w-4 h-4" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              prevTrack();
            }}
            title="Previous"
            className="hidden sm:flex p-2 rounded-full text-[#8f867e] hover:text-[#fbf6f1] hover:bg-white/[0.05] transition-colors"
          >
            <SkipBack className="w-4 h-4 fill-current" />
          </button>

          {/* Large circular peach Play/Pause button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            title={isPlaying ? 'Pause' : 'Play'}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#f3c5a6] text-[#141210] flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-transform"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
            ) : (
              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              nextTrack();
            }}
            title="Next"
            className="p-2 rounded-full text-[#8f867e] hover:text-[#fbf6f1] hover:bg-white/[0.05] transition-colors"
          >
            <SkipForward className="w-4 h-4 fill-current" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              cycleRepeat();
            }}
            title={`Repeat: ${repeat}`}
            className={`hidden md:flex p-2 rounded-full transition-colors ${
              repeat !== 'off' ? 'text-[#f3c5a6]' : 'text-[#8f867e] hover:text-[#fbf6f1]'
            }`}
          >
            {repeat === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
          </button>
        </div>

        {/* Right: Inline Scrubber, Volume & Quick Actions (Desktop only) */}
        <div className="hidden md:flex items-center gap-3 sm:gap-4 flex-1 justify-end max-w-[650px]">
          {/* Scrubber Bar */}
          <div className="flex items-center gap-2.5 flex-1 max-w-[320px]">
            <span className="text-[11px] font-mono text-[#8f867e] w-8 text-right shrink-0">
              {formatTime(currentTime)}
            </span>
            <div
              ref={scrubBarRef}
              onClick={handleScrub}
              className="relative h-1 hover:h-1.5 w-full bg-white/10 rounded-full cursor-pointer group flex items-center transition-all"
            >
              <div
                className="h-full bg-[#f3c5a6] rounded-full transition-all relative"
                style={{ width: `${percent}%` }}
              />
              <div
                className="absolute w-2.5 h-2.5 bg-[#fbf6f1] rounded-full shadow-sm scale-0 group-hover:scale-100 transition-transform -translate-x-1/2 pointer-events-none"
                style={{ left: `${percent}%` }}
              />
            </div>
            <span className="text-[11px] font-mono text-[#8f867e] w-8 shrink-0">
              {formatTime(duration)}
            </span>
          </div>

          {/* Volume Control */}
          <div className="hidden lg:flex items-center">
            <VolumeControl compact />
          </div>

          {/* Extended Controls: Audio Quality, Audio Lab, Lyrics, Sleep Timer, Queue */}
          <div className="flex items-center gap-1 text-[#8f867e]">
            {/* Audio Quality / Lossless Diagnostics */}
            <button
              onClick={() => setQualityPanelOpen(!isQualityPanelOpen)}
              title="Audio Quality & Lossless Diagnostics"
              className={`p-1.5 rounded-lg transition-colors ${
                isQualityPanelOpen ? 'text-[#f3c5a6] bg-[#f3c5a6]/15' : 'hover:text-[#fbf6f1] hover:bg-white/[0.05]'
              }`}
            >
              <Radio className="w-4 h-4" />
            </button>

            <button
              onClick={() => setAudioLabOpen(true)}
              title="Acoustic Lab (10-Band EQ)"
              className="hidden xl:flex p-1.5 rounded-lg hover:text-[#fbf6f1] hover:bg-white/[0.05] transition-colors"
            >
              <Sliders className="w-4 h-4" />
            </button>

            <button
              onClick={() => setLyricsOpen(!isLyricsOpen)}
              title="Lyrics"
              className={`hidden sm:flex p-1.5 rounded-lg transition-colors ${
                isLyricsOpen ? 'text-[#f3c5a6] bg-[#f3c5a6]/15' : 'hover:text-[#fbf6f1] hover:bg-white/[0.05]'
              }`}
            >
              <Mic2 className="w-4 h-4" />
            </button>

            <button
              onClick={() => setSleepTimerOpen(true)}
              title="Sleep Timer"
              className={`hidden sm:flex p-1.5 rounded-lg transition-colors ${
                sleepTimerRemaining !== null ? 'text-[#f3c5a6] bg-[#f3c5a6]/15' : 'hover:text-[#fbf6f1] hover:bg-white/[0.05]'
              }`}
            >
              <Moon className="w-4 h-4" />
            </button>

            <button
              onClick={() => setQueueDrawerOpen(!isQueueDrawerOpen)}
              title="Queue"
              className={`p-1.5 rounded-lg transition-colors ${
                isQueueDrawerOpen ? 'text-[#f3c5a6] bg-[#f3c5a6]/15' : 'hover:text-[#fbf6f1] hover:bg-white/[0.05]'
              }`}
            >
              <ListMusic className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
