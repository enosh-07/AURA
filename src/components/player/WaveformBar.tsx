import React, { useState, useRef } from 'react';
import { useAudioStore } from '../../stores/useAudioStore';

export const WaveformBar: React.FC<{ showTime?: boolean; className?: string }> = ({
  showTime = true,
  className = '',
}) => {
  const currentTime = useAudioStore((state) => state.currentTime);
  const duration = useAudioStore((state) => state.duration);
  const seek = useAudioStore((state) => state.seek);
  const currentTrack = useAudioStore((state) => state.currentTrack);
  const isBuffering = useAudioStore((state) => state.isBuffering);

  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number>(0);
  const barRef = useRef<HTMLDivElement | null>(null);

  const formatTime = (secs: number) => {
    if (Number.isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const percent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!barRef.current || duration <= 0) return;
    const rect = barRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverTime(pos * duration);
    setHoverX(e.clientX - rect.left);
  };

  const handleMouseLeave = () => {
    setHoverTime(null);
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!barRef.current || duration <= 0) return;
    const rect = barRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seek(pos * duration);
  };

  const accentColor = currentTrack?.accentColor && currentTrack.accentColor !== '#00f2fe' ? currentTrack.accentColor : '#f3c5a6';

  return (
    <div className={`flex flex-col gap-1.5 w-full select-none ${className}`}>
      {/* Progress Track */}
      <div
        ref={barRef}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative h-2.5 w-full bg-white/10 hover:h-3.5 transition-all rounded-full cursor-pointer group flex items-center"
      >
        {/* Hover Time Tooltip */}
        {hoverTime !== null && (
          <div
            className="absolute -top-7 transform -translate-x-1/2 px-2 py-0.5 rounded bg-aura-card border border-aura-border text-[10px] font-mono text-white pointer-events-none shadow-lg z-20"
            style={{ left: `${hoverX}px` }}
          >
            {formatTime(hoverTime)}
          </div>
        )}

        {/* Played Progress */}
        <div
          className="h-full rounded-full transition-all relative overflow-hidden"
          style={{
            width: `${percent}%`,
            background: `linear-gradient(90deg, ${accentColor}cc, ${accentColor})`,
            boxShadow: `0 0 12px ${accentColor}88`,
          }}
        >
          {isBuffering && (
            <div className="absolute inset-0 bg-white/30 animate-pulse" />
          )}
        </div>

        {/* Scrubber Thumb */}
        <div
          className="absolute w-3.5 h-3.5 bg-white rounded-full shadow-md scale-0 group-hover:scale-100 transition-transform transform -translate-x-1/2 pointer-events-none"
          style={{ left: `${percent}%` }}
        />
      </div>

      {/* Timestamp Indicators */}
      {showTime && (
        <div className="flex justify-between items-center text-[11px] font-mono text-aura-muted px-0.5">
          <span>{formatTime(currentTime)}</span>
          {isBuffering && (
            <span className="text-aura-cyan text-[10px] uppercase animate-pulse">Buffering...</span>
          )}
          <span>{formatTime(duration)}</span>
        </div>
      )}
    </div>
  );
};
