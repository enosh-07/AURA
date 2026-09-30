import React, { useEffect, useRef, useState } from 'react';
import { useAudioStore } from '../../stores/useAudioStore';
import { useUIStore } from '../../stores/useUIStore';
import { apiClient } from '../../services/apiClient';
import { LyricsLine } from '../../types/audio';
import { Mic2, X, Music } from 'lucide-react';

export const LyricsView: React.FC<{ isEmbedded?: boolean }> = ({ isEmbedded = false }) => {
  const currentTrack = useAudioStore((state) => state.currentTrack);
  const currentTime = useAudioStore((state) => state.currentTime);
  const seek = useAudioStore((state) => state.seek);
  const isLyricsOpen = useUIStore((state) => state.isLyricsOpen);
  const setLyricsOpen = useUIStore((state) => state.setLyricsOpen);

  const activeLineRef = useRef<HTMLParagraphElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [dynamicLyrics, setDynamicLyrics] = useState<LyricsLine[]>([]);

  useEffect(() => {
    if (currentTrack) {
      if (currentTrack.lyrics && currentTrack.lyrics.length > 0) {
        setDynamicLyrics(currentTrack.lyrics);
      } else {
        apiClient
          .getLyrics(currentTrack.id)
          .then((res) => {
            if (res && Array.isArray(res.lines) && res.lines.length > 0) {
              setDynamicLyrics(res.lines);
            } else {
              setDynamicLyrics([]);
            }
          })
          .catch(() => setDynamicLyrics([]));
      }
    } else {
      setDynamicLyrics([]);
    }
  }, [currentTrack]);

  const lyrics = dynamicLyrics.length > 0 ? dynamicLyrics : currentTrack?.lyrics || [];

  // Find active line index based on current time
  let activeIndex = -1;
  for (let i = 0; i < lyrics.length; i++) {
    if (currentTime >= lyrics[i].time) {
      activeIndex = i;
    } else {
      break;
    }
  }

  // Smooth scroll active line into center
  useEffect(() => {
    if (activeLineRef.current && containerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeIndex]);

  if (!isEmbedded && !isLyricsOpen) return null;

  const content = (
    <div className="flex flex-col h-full w-full">
      {/* Header if not embedded */}
      {!isEmbedded && (
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-aura-cyan/20 border border-aura-cyan/30 flex items-center justify-center text-aura-cyan">
              <Mic2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Synchronized Lyric Telemetry</h2>
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

      {/* Lyrics Scroll Container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-6 py-12 flex flex-col items-center gap-6 scroll-smooth scrollbar-none"
      >
        {lyrics.length > 0 ? (
          lyrics.map((line, idx) => {
            const isActive = idx === activeIndex;
            const isPast = idx < activeIndex;

            return (
              <p
                key={idx}
                ref={isActive ? activeLineRef : null}
                onClick={() => seek(line.time)}
                className={`text-center font-bold transition-all duration-300 cursor-pointer max-w-2xl select-none px-4 py-2 rounded-2xl ${
                  isActive
                    ? 'text-2xl sm:text-3xl text-white scale-105 drop-shadow-[0_0_20px_rgba(0,242,254,0.7)] font-black tracking-tight'
                    : isPast
                    ? 'text-lg sm:text-xl text-slate-500 opacity-60 hover:opacity-100 hover:text-slate-300'
                    : 'text-lg sm:text-xl text-slate-600 opacity-40 hover:opacity-80 hover:text-slate-400'
                }`}
              >
                {line.text}
              </p>
            );
          })
        ) : currentTrack?.plainLyrics ? (
          <div className="max-w-xl text-center text-slate-300 whitespace-pre-line leading-relaxed text-lg">
            {currentTrack.plainLyrics}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-aura-muted my-auto">
            <Music className="w-12 h-12 opacity-30 text-aura-cyan" />
            <p className="text-sm font-medium">No synchronized lyrics available for this track</p>
            <p className="text-xs opacity-60">Enjoy the pure instrumental frequencies</p>
          </div>
        )}
      </div>
    </div>
  );

  if (isEmbedded) {
    return <div className="h-full w-full">{content}</div>;
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
