import React from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { VisualizerMode } from '../../types/audio';
import { BarChart3, Disc, Activity, Sparkles, Droplet, Radio, Zap, Minus } from 'lucide-react';

const MODES: { id: VisualizerMode; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'bars', label: 'Spectrum Bars', icon: BarChart3 },
  { id: 'circular', label: 'Circular Pulse', icon: Disc },
  { id: 'waveform', label: 'Oscilloscope', icon: Activity },
  { id: 'particles', label: 'Stardust Field', icon: Sparkles },
  { id: 'fluid', label: 'Fluid Motion', icon: Droplet },
  { id: 'pulse', label: 'Sonar Pulse', icon: Radio },
  { id: 'neon', label: 'Neon Dual', icon: Zap },
  { id: 'minimal', label: 'Minimal Zen', icon: Minus },
];

export const VisualizerControls: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const visualizerMode = useUIStore((state) => state.visualizerMode);
  const setVisualizerMode = useUIStore((state) => state.setVisualizerMode);
  const isVisualizerEnabled = useUIStore((state) => state.isVisualizerEnabled);
  const toggleVisualizer = useUIStore((state) => state.toggleVisualizer);
  const visualizerIntensity = useUIStore((state) => state.visualizerIntensity);
  const setVisualizerIntensity = useUIStore((state) => state.setVisualizerIntensity);

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 p-1 bg-aura-card/60 backdrop-blur-md rounded-xl border border-aura-border">
        {MODES.slice(0, 4).map((m) => {
          const Icon = m.icon;
          const isActive = visualizerMode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setVisualizerMode(m.id)}
              title={m.label}
              className={`p-1.5 rounded-lg transition-all ${
                isActive
                  ? 'bg-aura-cyan/20 text-aura-cyan shadow-sm'
                  : 'text-aura-muted hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4 bg-aura-card/80 backdrop-blur-xl rounded-2xl border border-aura-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-aura-cyan" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">Visualizer Engine</span>
        </div>
        <button
          onClick={toggleVisualizer}
          className={`text-xs px-2.5 py-1 rounded-full border transition-all font-medium ${
            isVisualizerEnabled
              ? 'bg-aura-cyan/15 text-aura-cyan border-aura-cyan/30'
              : 'bg-white/5 text-aura-muted border-transparent hover:text-white'
          }`}
        >
          {isVisualizerEnabled ? 'Active' : 'Disabled'}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {MODES.map((m) => {
          const Icon = m.icon;
          const isActive = visualizerMode === m.id && isVisualizerEnabled;
          return (
            <button
              key={m.id}
              onClick={() => {
                if (!isVisualizerEnabled) toggleVisualizer();
                setVisualizerMode(m.id);
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-aura-cyan/20 to-aura-violet/20 text-white border border-aura-cyan/40 shadow-glow-cyan/20'
                  : 'bg-aura-surface/50 text-aura-muted hover:text-white hover:bg-aura-surface border border-transparent'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-aura-cyan' : 'text-aura-muted'}`} />
              <span className="truncate">{m.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs text-aura-muted">
        <span>Intensity Sensitivity</span>
        <div className="flex items-center gap-2">
          {[0.5, 1.0, 1.5, 2.0].map((val) => (
            <button
              key={val}
              onClick={() => setVisualizerIntensity(val)}
              className={`px-2 py-0.5 rounded-md text-[11px] font-mono transition-colors ${
                visualizerIntensity === val
                  ? 'bg-aura-cyan text-aura-void font-bold'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300'
              }`}
            >
              {val}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
