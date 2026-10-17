import React, { useEffect, useRef } from 'react';
import { useAudioStore } from '../../stores/useAudioStore';
import { useUIStore } from '../../stores/useUIStore';
import { Mic2, X, Music, Sparkles, AlertCircle } from 'lucide-react';

export const LyricsView: React.FC<{ isEmbedded?: boolean }> = ({ isEmbedded = false }) => {
  const currentTrack = useAudioStore((state) => state.currentTrack);
  const currentTime = useAudioStore((state) => state.currentTime);
  const seek = useAudioStore((state) => state.seek);
  const lyricsState = useAudioStore((state) => state.lyricsState);
  const isLyricsOpen = useUIStore((state) => state.isLyricsOpen);
  const setLyricsOpen = useUIStore((state) => state.setLyricsOpen);

  const activeLineRef = useRef<HTMLParagraphElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const lines = lyricsState.lines || [];
  const hasSync = lyricsState.hasSync && lines.length > 0;

  // Determine active line index based on current playback time
  let activeIndex = -1;
  if (hasSync) {
    for (let i = 0; i < lines.length; i++) {
      if (currentTime >= lines[i].time) {
        activeIndex = i;
      } else {
        break;
      }
    }
  }

  // Smooth scroll active line into center
  useEffect(() => {
    if (activeLineRef.current && containerRef.current && activeIndex >= 0) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeIndex]);

  if (!isEmbedded && !isLyricsOpen) return null;

  const renderLyricsBody = () => {
    // 1. Loading State
    if (lyricsState.status === 'loading') {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4 my-auto">
          <div className="w-12 h-12 rounded-2xl bg-aura-cyan/15 border border-aura-cyan/30 flex items-center justify-center text-aura-cyan shadow-glow-cyan animate-pulse">
            <Sparkles className="w-6 h-6 animate-spin" />
          </div>
          <div>
            <p className="text-sm font-bold text-white tracking-wide">Synchronizing Live Lyrics</p>
            <p className="text-xs text-aura-muted mt-1">Retrieving accurate vocal timestamps...</p>
          </div>
        </div>
      );
    }

    // 2. Instrumental State
    if (lyricsState.isInstrumental || lyricsState.status === 'instrumental') {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4 my-auto">
          <div className="w-12 h-12 rounded-2xl bg-aura-cyan/15 border border-aura-cyan/30 flex items-center justify-center text-aura-cyan">
            <Music className="w-6 h-6 opacity-80" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Instrumental Track</p>
            <p className="text-xs text-aura-muted mt-0.5">Enjoy the pure instrumental frequencies</p>
          </div>
        </div>
      );
    }

    // 3. Real Live Synchronized Lyrics
    if (hasSync) {
      return (
        <div className="w-full flex flex-col items-center gap-3 sm:gap-4 py-4">
          {lines.map((line, idx) => {
            const isActive = idx === activeIndex;
            const isPast = idx < activeIndex;

            return (
              <p
                key={idx}
                ref={isActive ? activeLineRef : null}
                onClick={() => seek(line.time)}
                title={`Seek to ${Math.floor(line.time / 60)}:${Math.floor(line.time % 60).toString().padStart(2, '0')}`}
                className={`text-center transition-all duration-300 cursor-pointer max-w-2xl select-none px-4 py-1.5 rounded-2xl ${
                  isActive
                    ? 'text-aura-cyan scale-105 font-black text-xl sm:text-2xl drop-shadow-[0_0_25px_rgba(0,242,254,0.85)] tracking-tight'
                    : isPast
                    ? 'text-slate-400 font-medium text-sm sm:text-base opacity-60 hover:opacity-100 hover:text-slate-200'
                    : 'text-slate-500 font-medium text-sm sm:text-base opacity-40 hover:opacity-80 hover:text-slate-300'
                }`}
              >
                {line.text || '♪'}
              </p>
            );
          })}
        </div>
      );
    }

    // 4. Plain (Non-Synchronized) Lyrics
    const plainText = lyricsState.plainLyrics || currentTrack?.plainLyrics;
    if (plainText) {
      return (
        <div className="flex flex-col items-center gap-3 py-4 max-w-xl text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] sm:text-xs font-mono text-aura-muted">
            <AlertCircle className="w-3 h-3 text-aura-amber" />
            <span>Synchronized timestamps unavailable • Plain lyrics</span>
          </span>
          <div className="text-slate-200 whitespace-pre-line leading-relaxed text-sm sm:text-base font-medium px-4">
            {plainText}
          </div>
        </div>
      );
    }

    // 5. Missing / Not Found State
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2.5 text-aura-muted my-auto text-center px-4 py-6">
        <Music className="w-10 h-10 opacity-30 text-aura-cyan" />
        <p className="text-sm font-medium text-white/80">No synchronized lyrics available for this track</p>
        <p className="text-xs text-aura-muted">Enjoy the pure audio stream</p>
      </div>
    );
  };

  const content = (
    <div className="flex flex-col h-full w-full">
      {/* Header if not embedded */}
      {!isEmbedded && (
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-aura-cyan/20 border border-aura-cyan/30 flex items-center justify-center text-aura-cyan shadow-glow-cyan/20">
              <Mic2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Live Lyrics</h2>
              <p className="text-xs text-aura-muted">
                {currentTrack ? `${currentTrack.title} — ${currentTrack.artist}` : 'No track playing'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setLyricsOpen(false)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-aura-muted hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Lyrics Scrollable Container with Top/Bottom Ambient Fade */}
      <div
        ref={containerRef}
        className="flex-1 w-full overflow-y-auto px-4 py-20 sm:py-28 flex flex-col items-center scroll-smooth scrollbar-none [mask-image:linear-gradient(to_bottom,transparent_0%,black_15%,black_85%,transparent_100%)]"
      >
        {renderLyricsBody()}
      </div>
    </div>
  );

  if (isEmbedded) {
    return <div className="h-full w-full flex flex-col">{content}</div>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-3xl h-[85vh] bg-aura-card border border-aura-border rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </div>
    </div>
  );
};
