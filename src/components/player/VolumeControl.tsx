import React from 'react';
import { useAudioStore } from '../../stores/useAudioStore';
import { Volume2, Volume1, VolumeX } from 'lucide-react';

export const VolumeControl: React.FC<{ compact?: boolean; fullWidth?: boolean; className?: string }> = ({
  compact = false,
  fullWidth = false,
  className = '',
}) => {
  const volume = useAudioStore((state) => state.volume);
  const isMuted = useAudioStore((state) => state.isMuted);
  const setVolume = useAudioStore((state) => state.setVolume);
  const toggleMute = useAudioStore((state) => state.toggleMute);

  const effectiveVol = isMuted ? 0 : volume;

  const Icon = effectiveVol === 0 ? VolumeX : effectiveVol < 0.5 ? Volume1 : Volume2;

  return (
    <div className={`flex items-center gap-2.5 group ${fullWidth ? 'w-full' : ''} ${className}`}>
      <button
        onClick={toggleMute}
        title={isMuted ? 'Unmute' : 'Mute'}
        className="p-1.5 rounded-lg text-aura-muted hover:text-white hover:bg-white/10 transition-colors shrink-0"
      >
        <Icon className="w-4 h-4" />
      </button>

      <div className={`flex items-center ${fullWidth ? 'flex-1' : compact ? 'w-20' : 'w-24'}`}>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={effectiveVol}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-white/15 rounded-lg appearance-none cursor-pointer accent-[#f3c5a6]"
        />
      </div>
      <span className="text-[10px] font-mono text-[#8f867e] w-8 text-right shrink-0">
        {Math.round(effectiveVol * 100)}%
      </span>
    </div>
  );
};
