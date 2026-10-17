import React, { useRef, useState } from 'react';
import { useAudioStore } from '../../stores/useAudioStore';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { useUIStore } from '../../stores/useUIStore';
import { shareContent } from '../../platform';
import { WaveformBar } from './WaveformBar';
import { VolumeControl } from './VolumeControl';
import { LyricsView } from '../lyrics/LyricsView';
import { TrackArtwork } from '../common/TrackArtwork';
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
  ChevronDown,
  Moon,
  Share2,
  Sparkles,
  Gauge,
  Check,
  Radio,
} from 'lucide-react';

export const FullscreenPlayer: React.FC = () => {
  const isFullscreenPlayerOpen = useUIStore((state) => state.isFullscreenPlayerOpen);
  const setFullscreenPlayerOpen = useUIStore((state) => state.setFullscreenPlayerOpen);
  const setPlayerPresentationMode = useAudioStore((state) => state.setPlayerPresentationMode);
  const fullPlayerTab = useAudioStore((state) => state.fullPlayerTab);
  const setFullPlayerTab = useAudioStore((state) => state.setFullPlayerTab);

  const setAudioLabOpen = useUIStore((state) => state.setAudioLabOpen);
  const setSleepTimerOpen = useUIStore((state) => state.setSleepTimerOpen);
  const setQueueDrawerOpen = useUIStore((state) => state.setQueueDrawerOpen);
  const setAICompanionOpen = useUIStore((state) => state.setAICompanionOpen);
  const setQualityPanelOpen = useUIStore((state) => state.setQualityPanelOpen);

  const currentTrack = useAudioStore((state) => state.currentTrack);
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const actualDeliveredQuality = useAudioStore((state) => state.actualDeliveredQuality);
  const qualityReport = useAudioStore((state) => state.audioQualityReport);
  const togglePlay = useAudioStore((state) => state.togglePlay);
  const nextTrack = useAudioStore((state) => state.nextTrack);
  const prevTrack = useAudioStore((state) => state.prevTrack);
  const shuffle = useAudioStore((state) => state.shuffle);
  const toggleShuffle = useAudioStore((state) => state.toggleShuffle);
  const repeat = useAudioStore((state) => state.repeat);
  const cycleRepeat = useAudioStore((state) => state.cycleRepeat);
  const playbackRate = useAudioStore((state) => state.playbackRate);
  const setPlaybackRate = useAudioStore((state) => state.setPlaybackRate);

  const isLiked = useLibraryStore((state) => (currentTrack ? state.isLiked(currentTrack.id) : false));
  const toggleLike = useLibraryStore((state) => state.toggleLike);

  const [copied, setCopied] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const touchStartY = useRef<number | null>(null);

  if (!isFullscreenPlayerOpen || !currentTrack) return null;

  const accentColor = currentTrack.accentColor || '#00f2fe';

  const handleMinimize = () => {
    setPlayerPresentationMode('mini');
    setFullscreenPlayerOpen(false);
  };

  const handleShare = async () => {
    const success = await shareContent({
      title: currentTrack.title,
      text: `Listening to "${currentTrack.title}" by ${currentTrack.artist} on AURA`,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    });
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const speedOptions = [0.75, 1.0, 1.25, 1.5, 2.0];

  return (
    <div
      onTouchStart={(e) => {
        touchStartY.current = e.touches[0].clientY;
      }}
      onTouchEnd={(e) => {
        if (touchStartY.current === null) return;
        const deltaY = e.changedTouches[0].clientY - touchStartY.current;
        touchStartY.current = null;
        if (deltaY > 50) {
          handleMinimize();
        }
      }}
      className="fixed inset-0 z-50 bg-aura-void flex flex-col overflow-hidden animate-in fade-in duration-300"
    >
      {/* Dynamic Background Ambient Light from Album Artwork */}
      <div
        className="absolute inset-0 opacity-40 blur-[130px] pointer-events-none transition-all duration-1000 scale-125"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 40%, ${accentColor} 0%, #0a0b10 80%)`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-aura-void via-aura-void/70 to-transparent pointer-events-none" />

      {/* Top Bar Navigation - Consistent horizontal width */}
      <div className="relative z-10 flex flex-col pt-safe px-4 pt-2 pb-1 sm:pt-4 sm:pb-2 max-w-xl w-full mx-auto shrink-0">
        {/* Mobile Drag Down Pill Indicator */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-2 md:hidden" />

        <div className="flex items-center justify-between w-full">
          <button
            onClick={handleMinimize}
            className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 rounded-2xl bg-white/5 hover:bg-white/10 text-aura-muted hover:text-white transition-colors"
            title="Minimize to mini-player"
          >
            <ChevronDown className="w-5 h-5" />
            <span className="text-xs font-semibold uppercase tracking-wider hidden sm:inline">Minimize</span>
          </button>

          {/* View Mode Switcher: Artwork | Live Lyrics strictly */}
          <div className="flex items-center gap-1 p-1 bg-aura-card/60 backdrop-blur-md rounded-2xl border border-aura-border">
            <button
              onClick={() => setFullPlayerTab('artwork')}
              className={`px-3 sm:px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                fullPlayerTab === 'artwork'
                  ? 'bg-aura-cyan text-aura-void font-bold shadow-glow-cyan/30'
                  : 'text-aura-muted hover:text-white'
              }`}
            >
              Artwork
            </button>
            <button
              onClick={() => setFullPlayerTab('live-lyrics')}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                fullPlayerTab === 'live-lyrics'
                  ? 'bg-aura-cyan text-aura-void font-bold shadow-glow-cyan/30'
                  : 'text-aura-muted hover:text-white'
              }`}
            >
              <Mic2 className="w-3.5 h-3.5" />
              <span>Live Lyrics</span>
            </button>
          </div>

          {/* Right utility actions */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            <button
              onClick={handleShare}
              title="Share Track"
              className="p-2 sm:p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-aura-muted hover:text-white transition-colors relative"
            >
              {copied ? <Check className="w-4 h-4 text-aura-emerald" /> : <Share2 className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setAICompanionOpen(true)}
              title="AURA AI Assistant"
              className="p-2 sm:p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-aura-cyan transition-colors"
            >
              <Sparkles className="w-4 h-4 animate-pulse" />
            </button>
          </div>
        </div>
      </div>

      {/* Single Parent Player Container: Shared Center Axis & Consistent Content Width */}
      <div className="relative z-10 flex-1 flex flex-col justify-between items-center w-full max-w-xl mx-auto px-4 sm:px-6 pt-1 pb-4 sm:pb-6 pb-safe min-h-0 overflow-hidden">
        
        {/* Upper Visual Area (Artwork | Live Lyrics) */}
        <div className="w-full flex-1 min-h-0 flex flex-col items-center justify-center my-auto overflow-hidden py-1 sm:py-2">
          {fullPlayerTab === 'artwork' && (
            <div className="flex flex-col items-center justify-center w-full h-full animate-in zoom-in-95 duration-300">
              <div className="relative group flex items-center justify-center my-auto">
                <div
                  className="absolute -inset-3 sm:-inset-4 rounded-3xl opacity-50 blur-2xl transition-all duration-700 pointer-events-none"
                  style={{ backgroundColor: accentColor }}
                />
                <div className="relative w-56 h-56 sm:w-72 sm:h-72 md:w-80 md:h-80 max-h-[38vh] aspect-square rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl border border-white/10 shrink-0">
                  <TrackArtwork
                    artworkUrl={currentTrack.artwork}
                    title={currentTrack.title}
                    artist={currentTrack.artist}
                    accentColor={currentTrack.accentColor}
                    className="w-full h-full object-cover select-none group-hover:scale-105 transition-transform duration-700"
                  />
                </div>
              </div>
            </div>
          )}

          {fullPlayerTab === 'live-lyrics' && (
            <div className="w-full h-full min-h-0 flex flex-col items-center justify-center animate-in fade-in duration-300 overflow-hidden">
              <LyricsView isEmbedded />
            </div>
          )}
        </div>

        {/* Lower Controls Stack: Unified Width, Shared Axis, Predictable Footprint */}
        <div className="w-full flex flex-col gap-2.5 sm:gap-3 shrink-0 pt-1">
          {/* Track Info Row: Grouped Title, Artist, Album, Quality Badge & Like */}
          <div className="w-full flex items-center justify-between gap-3 min-h-[64px] sm:min-h-[72px]">
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <h2
                className="text-lg sm:text-2xl font-bold text-white tracking-tight truncate"
                title={currentTrack.title}
              >
                {currentTrack.title}
              </h2>
              <p
                className="text-xs sm:text-sm text-aura-muted font-medium truncate mt-0.5"
                title={`${currentTrack.artist} • ${currentTrack.album || ''}`}
              >
                {currentTrack.artist}
                {currentTrack.album && (
                  <>
                    <span className="mx-1.5 opacity-50">•</span>
                    {currentTrack.album}
                  </>
                )}
                {currentTrack.year ? ` (${currentTrack.year})` : ''}
              </p>

              {/* Live Audio Fidelity & Lossless Badge */}
              <div className="flex items-center gap-2 mt-1.5">
                {actualDeliveredQuality ? (
                  <button
                    onClick={() => setQualityPanelOpen(true)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-mono font-semibold border transition-all hover:scale-105 active:scale-95 ${
                      actualDeliveredQuality.qualityTier === 'HI_RES_LOSSLESS'
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25'
                        : actualDeliveredQuality.isLossless
                        ? 'bg-aura-cyan/15 text-aura-cyan border-aura-cyan/40 hover:bg-aura-cyan/25'
                        : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                    }`}
                    title="View Audio Quality & Bit-Perfect Engine"
                  >
                    <Radio className="w-3 h-3 text-current animate-pulse" />
                    <span>
                      {actualDeliveredQuality.qualityTier === 'HI_RES_LOSSLESS'
                        ? 'HI-RES'
                        : actualDeliveredQuality.qualityTier === 'LOSSLESS'
                        ? 'LOSSLESS'
                        : 'HIGH'}
                    </span>
                    <span className="opacity-50">•</span>
                    <span>{actualDeliveredQuality.codec}</span>
                    {actualDeliveredQuality.bitDepth && (
                      <>
                        <span className="opacity-50">•</span>
                        <span>{actualDeliveredQuality.bitDepth}-bit</span>
                      </>
                    )}
                    {actualDeliveredQuality.sampleRate && (
                      <>
                        <span className="opacity-50">•</span>
                        <span>{Math.round(actualDeliveredQuality.sampleRate / 1000)} kHz</span>
                      </>
                    )}
                  </button>
                ) : currentTrack.qualityTier ? (
                  <button
                    onClick={() => setQualityPanelOpen(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-mono font-semibold border border-aura-cyan/30 bg-aura-cyan/10 text-aura-cyan hover:bg-aura-cyan/20 transition-all"
                  >
                    <Radio className="w-3 h-3" />
                    <span>{currentTrack.qualityTier === 'HI_RES_LOSSLESS' ? 'HI-RES LOSSLESS' : currentTrack.qualityTier}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setQualityPanelOpen(true)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-mono text-aura-muted hover:text-white border border-white/10 hover:bg-white/5 transition-all"
                  >
                    <Radio className="w-3 h-3" />
                    <span>AUDIO</span>
                  </button>
                )}

                {/* Verified Atmos Badge - Displayed ONLY if Atmos is genuinely verified */}
                {qualityReport?.dolbyAtmos?.badgeVisible && (
                  <button
                    onClick={() => setQualityPanelOpen(true)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-mono font-bold bg-aura-cyan/20 border border-aura-cyan/40 text-aura-cyan shadow-glow-cyan/20"
                    title="Dolby Atmos Verified Master"
                  >
                    <span>ATMOS</span>
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={() => toggleLike(currentTrack.id)}
              className={`p-2.5 sm:p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-transform active:scale-125 shrink-0 ${
                isLiked ? 'text-[#f3c5a6]' : 'text-aura-muted hover:text-white'
              }`}
              title={isLiked ? 'Remove from Liked' : 'Like Song'}
            >
              <Heart className={`w-5 h-5 sm:w-6 sm:h-6 ${isLiked ? 'fill-current text-[#f3c5a6]' : ''}`} />
            </button>
          </div>

          {/* Progress Timeline Scrubber */}
          <WaveformBar />

          {/* Primary Transport Controls - Centered as a Group */}
          <div className="flex items-center justify-center gap-3 sm:gap-6 py-0.5">
            <button
              onClick={toggleShuffle}
              className={`p-2.5 rounded-full hover:bg-white/10 transition-colors ${
                shuffle ? 'text-aura-cyan' : 'text-aura-muted hover:text-white'
              }`}
              title={shuffle ? 'Shuffle On' : 'Shuffle Off'}
            >
              <Shuffle className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            <button
              onClick={prevTrack}
              className="p-2.5 sm:p-3 rounded-full text-aura-muted hover:text-white hover:bg-white/10 transition-colors"
              title="Previous Track"
            >
              <SkipBack className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
            </button>

            <button
              onClick={togglePlay}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-r from-aura-cyan to-aura-violet text-aura-void flex items-center justify-center shadow-glow-cyan hover:scale-105 active:scale-95 transition-transform shrink-0"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 sm:w-7 sm:h-7 fill-current text-aura-void" />
              ) : (
                <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-current text-aura-void ml-1" />
              )}
            </button>

            <button
              onClick={nextTrack}
              className="p-2.5 sm:p-3 rounded-full text-aura-muted hover:text-white hover:bg-white/10 transition-colors"
              title="Next Track"
            >
              <SkipForward className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
            </button>

            <button
              onClick={cycleRepeat}
              className={`p-2.5 rounded-full hover:bg-white/10 transition-colors ${
                repeat !== 'off' ? 'text-aura-cyan' : 'text-aura-muted hover:text-white'
              }`}
              title={`Repeat: ${repeat}`}
            >
              {repeat === 'one' ? <Repeat1 className="w-4 h-4 sm:w-5 sm:h-5" /> : <Repeat className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>
          </div>

          {/* Secondary Controls Bar - Subordinate and Balanced */}
          <div className="w-full flex items-center justify-between px-1 text-xs text-aura-muted">
            {/* Speed Selector */}
            <div className="relative">
              <button
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono text-aura-muted hover:text-white transition-colors"
              >
                <Gauge className="w-3.5 h-3.5" />
                <span>{playbackRate}x</span>
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-9 left-0 bg-aura-card border border-aura-border rounded-xl p-1 shadow-2xl flex flex-col gap-1 z-30 min-w-[80px]">
                  {speedOptions.map((rate) => (
                    <button
                      key={rate}
                      onClick={() => {
                        setPlaybackRate(rate);
                        setShowSpeedMenu(false);
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-mono text-left transition-colors ${
                        playbackRate === rate
                          ? 'bg-aura-cyan text-aura-void font-bold'
                          : 'text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Tools */}
            <div className="flex items-center gap-1 sm:gap-1.5">
              <button
                onClick={() => setAudioLabOpen(true)}
                title="Acoustic Lab (10-Band EQ)"
                className="p-1.5 sm:p-2 rounded-xl bg-white/5 hover:bg-white/10 text-aura-muted hover:text-aura-cyan transition-colors"
              >
                <Sliders className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
              <button
                onClick={() => setQualityPanelOpen(true)}
                title="Audio Quality & Bit-Perfect Engine"
                className={`p-1.5 sm:p-2 rounded-xl border transition-colors ${
                  actualDeliveredQuality?.isLossless
                    ? 'bg-aura-cyan/15 text-aura-cyan border-aura-cyan/40'
                    : 'bg-white/5 text-aura-muted hover:text-aura-cyan border-transparent hover:bg-white/10'
                }`}
              >
                <Radio className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
              <button
                onClick={() => setSleepTimerOpen(true)}
                title="Sleep Timer"
                className="p-1.5 sm:p-2 rounded-xl bg-white/5 hover:bg-white/10 text-aura-muted hover:text-aura-violet transition-colors"
              >
                <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
              <button
                onClick={() => setQueueDrawerOpen(true)}
                title="Queue"
                className="p-1.5 sm:p-2 rounded-xl bg-white/5 hover:bg-white/10 text-aura-muted hover:text-white transition-colors"
              >
                <ListMusic className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>

          {/* Volume Slider - Spans Consistent Content Width */}
          <div className="w-full pt-0.5">
            <VolumeControl fullWidth />
          </div>
        </div>
      </div>
    </div>
  );
};
