import React, { useState, useEffect, useRef } from 'react';
import { useAudioStore } from '../../stores/useAudioStore';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { useUIStore } from '../../stores/useUIStore';
import { apiClient } from '../../services/apiClient';
import { shareContent } from '../../platform';
import { Track } from '../../types/audio';
import { WaveformBar } from './WaveformBar';
import { VolumeControl } from './VolumeControl';
import { VisualizerCanvas } from '../visualizer/VisualizerCanvas';
import { VisualizerControls } from '../visualizer/VisualizerControls';
import { LyricsView } from '../lyrics/LyricsView';
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
  Activity,
  Check,
  Zap,
  ListPlus,
  Compass,
  Radio,
} from 'lucide-react';

export const FullscreenPlayer: React.FC = () => {
  const isFullscreenPlayerOpen = useUIStore((state) => state.isFullscreenPlayerOpen);
  const setFullscreenPlayerOpen = useUIStore((state) => state.setFullscreenPlayerOpen);
  const setAudioLabOpen = useUIStore((state) => state.setAudioLabOpen);
  const setSleepTimerOpen = useUIStore((state) => state.setSleepTimerOpen);
  const setQueueDrawerOpen = useUIStore((state) => state.setQueueDrawerOpen);
  const setAICompanionOpen = useUIStore((state) => state.setAICompanionOpen);
  const setQualityPanelOpen = useUIStore((state) => state.setQualityPanelOpen);

  const currentTrack = useAudioStore((state) => state.currentTrack);
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const actualDeliveredQuality = useAudioStore((state) => state.actualDeliveredQuality);
  const togglePlay = useAudioStore((state) => state.togglePlay);
  const nextTrack = useAudioStore((state) => state.nextTrack);
  const prevTrack = useAudioStore((state) => state.prevTrack);
  const playTrack = useAudioStore((state) => state.playTrack);
  const addToQueue = useAudioStore((state) => state.addToQueue);
  const playNext = useAudioStore((state) => state.playNext);
  const shuffle = useAudioStore((state) => state.shuffle);
  const toggleShuffle = useAudioStore((state) => state.toggleShuffle);
  const repeat = useAudioStore((state) => state.repeat);
  const cycleRepeat = useAudioStore((state) => state.cycleRepeat);
  const playbackRate = useAudioStore((state) => state.playbackRate);
  const setPlaybackRate = useAudioStore((state) => state.setPlaybackRate);

  const isLiked = useLibraryStore((state) => (currentTrack ? state.isLiked(currentTrack.id) : false));
  const toggleLike = useLibraryStore((state) => state.toggleLike);

  const [activeTab, setActiveTab] = useState<'art' | 'lyrics' | 'visualizer' | 'dj'>('art');
  const [copied, setCopied] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const touchStartY = useRef<number | null>(null);

  // Smart DJ & Similar tracks state
  const [similarTracks, setSimilarTracks] = useState<Track[]>([]);
  const [transitionData, setTransitionData] = useState<any>(null);
  const [isLoadingDJ, setIsLoadingDJ] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!currentTrack) return;
    let isCancelled = false;

    const fetchDJInfo = async () => {
      setIsLoadingDJ(true);
      try {
        const [sim, trans] = await Promise.all([
          apiClient.getSimilarTracks(currentTrack.id, 5),
          apiClient.getTransitionMetadata(currentTrack.id),
        ]);
        if (!isCancelled) {
          setSimilarTracks(sim);
          setTransitionData(trans);
        }
      } catch {
        // Fallback gracefully
      } finally {
        if (!isCancelled) setIsLoadingDJ(false);
      }
    };

    fetchDJInfo();
    return () => {
      isCancelled = true;
    };
  }, [currentTrack?.id]);

  if (!isFullscreenPlayerOpen || !currentTrack) return null;

  const accentColor = currentTrack.accentColor || '#00f2fe';

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

  const notifyAction = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 2000);
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
          setFullscreenPlayerOpen(false);
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

      {/* Floating Action Feedback Pill */}
      {actionFeedback && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-aura-cyan text-aura-void font-bold text-xs shadow-glow-cyan animate-in fade-in slide-in-from-top-2 duration-200">
          {actionFeedback}
        </div>
      )}

      {/* Top Bar Navigation */}
      <div className="relative z-10 flex flex-col pt-safe px-4 pt-2 pb-2 sm:p-6 max-w-6xl w-full mx-auto">
        {/* Mobile Drag Down Pill Indicator */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-2 md:hidden" />

        <div className="flex items-center justify-between w-full">
          <button
            onClick={() => setFullscreenPlayerOpen(false)}
            className="flex items-center gap-2 p-2 sm:p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-aura-muted hover:text-white transition-colors"
          >
            <ChevronDown className="w-5 h-5" />
            <span className="text-xs font-semibold uppercase tracking-wider hidden sm:inline">Minimize</span>
          </button>

          {/* View Mode Switcher: Artwork | Lyrics | Visualizer | Smart DJ */}
          <div className="flex items-center gap-1 sm:gap-1.5 p-1 bg-aura-card/60 backdrop-blur-md rounded-2xl border border-aura-border overflow-x-auto">
            <button
              onClick={() => setActiveTab('art')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'art'
                  ? 'bg-aura-cyan text-aura-void font-bold shadow-glow-cyan/30'
                  : 'text-aura-muted hover:text-white'
              }`}
            >
              Artwork
            </button>
            <button
              onClick={() => setActiveTab('lyrics')}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'lyrics'
                  ? 'bg-aura-cyan text-aura-void font-bold shadow-glow-cyan/30'
                  : 'text-aura-muted hover:text-white'
              }`}
            >
              <Mic2 className="w-3.5 h-3.5" />
              Lyrics
            </button>
            <button
              onClick={() => setActiveTab('visualizer')}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'visualizer'
                  ? 'bg-aura-cyan text-aura-void font-bold shadow-glow-cyan/30'
                  : 'text-aura-muted hover:text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Visualizer</span>
            </button>
            <button
              onClick={() => setActiveTab('dj')}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'dj'
                  ? 'bg-gradient-to-r from-aura-cyan to-aura-violet text-aura-void font-bold shadow-glow-cyan/30'
                  : 'text-aura-muted hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Smart </span>DJ
            </button>
          </div>

          {/* Right utility actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
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

      {/* Main Center Area */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 max-w-4xl w-full mx-auto overflow-hidden">
        {activeTab === 'art' && (
          <div className="flex flex-col items-center justify-center gap-4 sm:gap-6 w-full animate-in zoom-in-95 duration-300">
            {/* Dynamic Artwork Box with Ambient Glow */}
            <div className="relative group">
              <div
                className="absolute -inset-4 rounded-3xl opacity-60 blur-2xl transition-all duration-700"
                style={{ backgroundColor: accentColor }}
              />
              <div className="relative w-52 h-52 sm:w-80 sm:h-80 md:w-96 md:h-96 rounded-3xl overflow-hidden shadow-2xl border border-white/10">
                <img
                  src={currentTrack.artwork}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover select-none group-hover:scale-105 transition-transform duration-700"
                />
              </div>
            </div>

            {/* Embedded Ambient Canvas Wave Beneath */}
            <div className="w-full max-w-md h-16 pointer-events-none opacity-80">
              <VisualizerCanvas className="w-full h-full" />
            </div>
          </div>
        )}

        {activeTab === 'lyrics' && (
          <div className="w-full h-full max-h-[55vh] animate-in fade-in duration-300">
            <LyricsView isEmbedded />
          </div>
        )}

        {activeTab === 'visualizer' && (
          <div className="w-full h-full max-h-[60vh] flex flex-col items-center justify-center gap-4 animate-in zoom-in-95 duration-300">
            <div className="relative w-full flex-1 rounded-3xl bg-aura-void/60 border border-aura-border overflow-hidden">
              <VisualizerCanvas className="w-full h-full" />
              <div className="absolute top-3 right-3 z-20">
                <VisualizerControls compact />
              </div>
            </div>
            <div className="w-full max-w-lg">
              <VisualizerControls />
            </div>
          </div>
        )}

        {activeTab === 'dj' && (
          <div className="w-full h-full max-h-[60vh] flex flex-col gap-4 overflow-y-auto pr-1 animate-in zoom-in-95 duration-300">
            {/* DJ Acoustic Telemetry Card */}
            <div className="p-5 rounded-3xl bg-gradient-to-br from-aura-card/90 to-aura-base/90 border border-aura-border shadow-xl backdrop-blur-xl">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-aura-cyan" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Acoustic Telemetry & Key</h3>
                </div>
                <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-aura-cyan/20 text-aura-cyan font-bold border border-aura-cyan/30">
                  {transitionData?.targetKey || 'Harmonic Sync Active'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 text-center">
                <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
                  <span className="text-[10px] text-aura-muted uppercase font-mono block">Tempo</span>
                  <span className="text-lg font-black text-white">{currentTrack.bpm || 124} <span className="text-xs text-aura-cyan font-normal">BPM</span></span>
                </div>
                <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
                  <span className="text-[10px] text-aura-muted uppercase font-mono block">Energy Matrix</span>
                  <span className="text-lg font-black text-aura-emerald">
                    {transitionData?.energy ? `${Math.round(transitionData.energy * 100)}%` : '88%'}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
                  <span className="text-[10px] text-aura-muted uppercase font-mono block">Intro Cue</span>
                  <span className="text-lg font-black text-white font-mono">
                    {transitionData?.introOffsetSec ? `${transitionData.introOffsetSec}s` : '0.0s'}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
                  <span className="text-[10px] text-aura-muted uppercase font-mono block">Crossfade Out</span>
                  <span className="text-lg font-black text-aura-violet font-mono">
                    {transitionData?.outroOffsetSec ? `${transitionData.outroOffsetSec}s` : '182s'}
                  </span>
                </div>
              </div>
            </div>

            {/* Smart Mix Next Best Tracks */}
            <div className="flex-1 flex flex-col gap-2 p-5 rounded-3xl bg-aura-card/60 border border-aura-border backdrop-blur-xl">
              <div className="flex items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-aura-cyan" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Harmonically Compatible Next Mixes</h4>
                </div>
                {isLoadingDJ && <span className="text-[10px] text-aura-cyan animate-pulse">Analyzing audio...</span>}
              </div>

              <div className="flex flex-col gap-2 overflow-y-auto max-h-48 pr-1">
                {similarTracks.length > 0 ? (
                  similarTracks.map((track) => (
                    <div
                      key={track.id}
                      className="group flex items-center justify-between p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-transparent hover:border-aura-cyan/30 transition-all"
                    >
                      <div
                        onClick={() => playTrack(track)}
                        className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
                      >
                        <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-aura-void">
                          <img src={track.artwork} alt={track.title} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-white truncate group-hover:text-aura-cyan transition-colors">
                            {track.title}
                          </p>
                          <p className="text-[11px] text-aura-muted truncate">
                            {track.artist} • {track.genre || 'Electronic'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                        <button
                          onClick={() => {
                            playNext(track);
                            notifyAction(`Queued "${track.title}" to play next`);
                          }}
                          title="Play Next"
                          className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-aura-cyan hover:text-aura-void text-xs font-semibold text-aura-muted transition-colors flex items-center gap-1"
                        >
                          <ListPlus className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline text-[10px]">Play Next</span>
                        </button>
                        <button
                          onClick={() => {
                            addToQueue(track);
                            notifyAction(`Added "${track.title}" to queue`);
                          }}
                          title="Add to Queue"
                          className="p-1.5 rounded-xl bg-white/5 hover:bg-white/20 text-aura-muted hover:text-white transition-colors"
                        >
                          <ListMusic className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => playTrack(track)}
                          title="Mix In Now"
                          className="p-1.5 rounded-xl bg-aura-cyan text-aura-void hover:scale-105 active:scale-95 transition-transform"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-xs text-aura-muted">
                    No harmonic neighbor tracks found. Load more songs into your library to expand mixing possibilities!
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls Area */}
      <div className="relative z-10 px-4 sm:px-6 pt-2 sm:pt-4 pb-6 sm:pb-8 pb-safe max-w-3xl w-full mx-auto flex flex-col gap-3 sm:gap-5">
        {/* Track Title, Artist, & Like */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight truncate">
              {currentTrack.title}
            </h1>
            <p className="text-sm sm:text-base text-aura-muted font-medium truncate">
              {currentTrack.artist} • {currentTrack.album} {currentTrack.year ? `(${currentTrack.year})` : ''}
            </p>

            {/* Live Audio Fidelity & Lossless Badge */}
            <div className="flex items-center gap-2 mt-1.5">
              {actualDeliveredQuality ? (
                <button
                  onClick={() => setQualityPanelOpen(true)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold border transition-all hover:scale-105 active:scale-95 ${
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
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold border border-aura-cyan/30 bg-aura-cyan/10 text-aura-cyan hover:bg-aura-cyan/20 transition-all"
                >
                  <Radio className="w-3 h-3" />
                  <span>{currentTrack.qualityTier === 'HI_RES_LOSSLESS' ? 'HI-RES LOSSLESS' : currentTrack.qualityTier}</span>
                </button>
              ) : (
                <button
                  onClick={() => setQualityPanelOpen(true)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono text-aura-muted hover:text-white border border-white/10 hover:bg-white/5 transition-all"
                >
                  <Radio className="w-3 h-3" />
                  <span>Audio Quality</span>
                </button>
              )}
            </div>
          </div>
          <button
            onClick={() => toggleLike(currentTrack.id)}
            className={`p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-transform active:scale-125 ${
              isLiked ? 'text-aura-crimson' : 'text-aura-muted hover:text-white'
            }`}
          >
            <Heart className={`w-6 h-6 ${isLiked ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Timeline Scrub Bar */}
        <WaveformBar />

        {/* Main Playback Buttons */}
        <div className="flex items-center justify-between">
          {/* Speed Selector */}
          <div className="relative">
            <button
              onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono text-aura-muted hover:text-white transition-colors"
            >
              <Gauge className="w-3.5 h-3.5" />
              {playbackRate}x
            </button>
            {showSpeedMenu && (
              <div className="absolute bottom-10 left-0 bg-aura-card border border-aura-border rounded-xl p-1 shadow-2xl flex flex-col gap-1 z-30 min-w-[80px]">
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

          {/* Core Controls */}
          <div className="flex items-center gap-4 sm:gap-6">
            <button
              onClick={toggleShuffle}
              className={`p-2 rounded-xl transition-colors ${
                shuffle ? 'text-aura-cyan' : 'text-aura-muted hover:text-white'
              }`}
            >
              <Shuffle className="w-5 h-5" />
            </button>

            <button
              onClick={prevTrack}
              className="p-3 rounded-2xl text-aura-muted hover:text-white hover:bg-white/10 transition-colors"
            >
              <SkipBack className="w-6 h-6 fill-current" />
            </button>

            <button
              onClick={togglePlay}
              className="w-14 h-14 rounded-full bg-gradient-to-r from-aura-cyan to-aura-violet text-aura-void flex items-center justify-center shadow-glow-cyan hover:scale-105 active:scale-95 transition-transform"
            >
              {isPlaying ? (
                <Pause className="w-7 h-7 fill-current text-aura-void" />
              ) : (
                <Play className="w-7 h-7 fill-current text-aura-void ml-1" />
              )}
            </button>

            <button
              onClick={nextTrack}
              className="p-3 rounded-2xl text-aura-muted hover:text-white hover:bg-white/10 transition-colors"
            >
              <SkipForward className="w-6 h-6 fill-current" />
            </button>

            <button
              onClick={cycleRepeat}
              className={`p-2 rounded-xl transition-colors ${
                repeat !== 'off' ? 'text-aura-cyan' : 'text-aura-muted hover:text-white'
              }`}
            >
              {repeat === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
            </button>
          </div>

          {/* Quick Tools: EQ, Audio Quality, Sleep, Queue */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setAudioLabOpen(true)}
              title="Acoustic Lab (10-Band EQ)"
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-aura-muted hover:text-aura-cyan transition-colors"
            >
              <Sliders className="w-4 h-4" />
            </button>
            <button
              onClick={() => setQualityPanelOpen(true)}
              title="Audio Quality & Bit-Perfect Engine"
              className={`p-2.5 rounded-xl border transition-colors ${
                actualDeliveredQuality?.isLossless
                  ? 'bg-aura-cyan/15 text-aura-cyan border-aura-cyan/40'
                  : 'bg-white/5 text-aura-muted hover:text-aura-cyan border-transparent hover:bg-white/10'
              }`}
            >
              <Radio className="w-4 h-4" />
            </button>
            <button
              onClick={() => setSleepTimerOpen(true)}
              title="Sleep Timer"
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-aura-muted hover:text-aura-violet transition-colors"
            >
              <Moon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setQueueDrawerOpen(true)}
              title="Queue"
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-aura-muted hover:text-white transition-colors"
            >
              <ListMusic className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Bottom Centered Volume */}
        <div className="flex items-center justify-center pt-2 border-t border-white/5">
          <VolumeControl />
        </div>
      </div>
    </div>
  );
};
