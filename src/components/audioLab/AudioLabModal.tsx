import React, { useState, useEffect } from 'react';
import { useAudioLabStore, EQ_PRESETS } from '../../stores/useAudioLabStore';
import { useUIStore } from '../../stores/useUIStore';
import { EQ_FREQUENCIES } from '../../audio/AudioEngine';
import {
  Sliders,
  X,
  RotateCcw,
  Power,
  Volume2,
  Sparkles,
  MoveHorizontal,
  BookmarkPlus,
  Trash2,
  Check,
  Cloud,
} from 'lucide-react';
import { VisualizerCanvas } from '../visualizer/VisualizerCanvas';

export const AudioLabModal: React.FC = () => {
  const isAudioLabOpen = useUIStore((state) => state.isAudioLabOpen);
  const setAudioLabOpen = useUIStore((state) => state.setAudioLabOpen);

  const settings = useAudioLabStore((state) => state.settings);
  const customPresets = useAudioLabStore((state) => state.customPresets);
  const setBandGain = useAudioLabStore((state) => state.setBandGain);
  const setBassBoost = useAudioLabStore((state) => state.setBassBoost);
  const setTreble = useAudioLabStore((state) => state.setTreble);
  const setStereoPan = useAudioLabStore((state) => state.setStereoPan);
  const setReverbLevel = useAudioLabStore((state) => state.setReverbLevel);
  const toggleBypass = useAudioLabStore((state) => state.toggleBypass);
  const applyPreset = useAudioLabStore((state) => state.applyPreset);
  const resetToFlat = useAudioLabStore((state) => state.resetToFlat);
  const loadCloudPresets = useAudioLabStore((state) => state.loadCloudPresets);
  const saveCustomPreset = useAudioLabStore((state) => state.saveCustomPreset);
  const deleteCustomPreset = useAudioLabStore((state) => state.deleteCustomPreset);

  const [isSaving, setIsSaving] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    if (isAudioLabOpen) {
      loadCloudPresets();
    }
  }, [isAudioLabOpen, loadCloudPresets]);

  if (!isAudioLabOpen) return null;

  const handleSavePreset = async () => {
    if (!newPresetName.trim()) return;
    const ok = await saveCustomPreset(newPresetName.trim());
    if (ok) {
      setSaveStatus(`Saved "${newPresetName.trim()}"`);
      setNewPresetName('');
      setIsSaving(false);
      setTimeout(() => setSaveStatus(null), 2500);
    }
  };

  const allPresets = [...EQ_PRESETS, ...customPresets];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-aura-card border border-aura-border rounded-3xl p-6 shadow-2xl flex flex-col gap-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-aura-cyan/20 to-aura-violet/20 border border-aura-cyan/30 flex items-center justify-center text-aura-cyan">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                AURA Acoustic Laboratory
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-aura-cyan/20 text-aura-cyan border border-aura-cyan/30">
                  Web Audio 10-Band
                </span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-white/5 text-aura-muted flex items-center gap-1">
                  <Cloud className="w-3 h-3 text-aura-cyan" /> Cloud Synced
                </span>
              </h2>
              <p className="text-xs text-aura-muted">
                Hardware-accelerated DSP equalization, harmonic enhancement & spatial dynamics
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Bypass Toggle */}
            <button
              onClick={toggleBypass}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                !settings.isBypassed
                  ? 'bg-aura-cyan/15 text-aura-cyan border-aura-cyan/40 shadow-glow-cyan/20'
                  : 'bg-red-500/10 text-red-400 border-red-500/30'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              {settings.isBypassed ? 'DSP BYPASS' : 'DSP ACTIVE'}
            </button>

            {/* Reset */}
            <button
              onClick={resetToFlat}
              title="Reset to Flat"
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-aura-muted hover:text-white transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Close */}
            <button
              onClick={() => setAudioLabOpen(false)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-aura-muted hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Mini Spectrum Screen */}
        <div className="relative h-24 bg-aura-void/80 rounded-2xl border border-aura-border overflow-hidden flex flex-col justify-end p-2">
          <div className="absolute top-2 left-3 z-10 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-aura-cyan animate-ping" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-aura-cyan">
              Live Frequency Response Analysis
            </span>
          </div>
          <VisualizerCanvas className="w-full h-full opacity-80" />
        </div>

        {/* Presets Chips & Save Custom */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-aura-muted">
              Equalizer Presets
            </label>
            <div className="flex items-center gap-2">
              {saveStatus && (
                <span className="text-xs text-aura-cyan font-semibold animate-pulse">{saveStatus}</span>
              )}
              {!isSaving ? (
                <button
                  onClick={() => setIsSaving(true)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-aura-cyan border border-white/5 transition-colors"
                >
                  <BookmarkPlus className="w-3.5 h-3.5" />
                  Save Curve
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    placeholder="Preset Name"
                    className="bg-aura-surface border border-aura-cyan/40 rounded-xl px-2.5 py-1 text-xs text-white outline-none"
                    autoFocus
                  />
                  <button
                    onClick={handleSavePreset}
                    className="p-1 rounded-lg bg-aura-cyan text-aura-void"
                    title="Confirm Save"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setIsSaving(false)}
                    className="p-1 rounded-lg bg-white/10 text-white"
                    title="Cancel"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {allPresets.map((p) => {
              const isSelected = settings.preset === p.name;
              return (
                <div key={p.name} className="flex items-center group relative flex-shrink-0">
                  <button
                    onClick={() => applyPreset(p.name)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all border flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-aura-cyan text-aura-void font-bold border-aura-cyan shadow-glow-cyan/30'
                        : 'bg-white/5 hover:bg-white/10 text-slate-300 border-transparent'
                    }`}
                  >
                    {p.isCustom && <span className="w-1.5 h-1.5 rounded-full bg-aura-violet" />}
                    {p.name}
                  </button>
                  {p.isCustom && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteCustomPreset(p.id, p.name);
                      }}
                      title="Delete Preset"
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:text-red-400 text-aura-muted transition-opacity ml-1"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 10-Band EQ Sliders */}
        <div className="bg-aura-void/50 p-5 rounded-2xl border border-white/5">
          <div className="flex items-center justify-between text-xs text-aura-muted mb-4 font-mono">
            <span>+12 dB</span>
            <span className="text-white font-semibold">10-BAND PARAMETRIC GRAPH</span>
            <span>-12 dB</span>
          </div>

          <div className="grid grid-cols-10 gap-2 items-end justify-items-center h-48 py-2">
            {EQ_FREQUENCIES.map((freq, idx) => {
              const gain = settings.bands[idx] || 0;
              const formattedFreq = freq >= 1000 ? `${freq / 1000}k` : `${freq}Hz`;

              return (
                <div key={freq} className="flex flex-col items-center h-full w-full">
                  <span className="text-[10px] font-mono text-aura-cyan font-bold mb-2">
                    {gain > 0 ? `+${gain.toFixed(1)}` : gain.toFixed(1)}
                  </span>
                  <div className="relative flex-1 flex items-center justify-center w-full">
                    <input
                      type="range"
                      min={-12}
                      max={12}
                      step={0.5}
                      value={gain}
                      onChange={(e) => setBandGain(idx, parseFloat(e.target.value))}
                      className="aura-slider-vertical h-32 w-1.5 appearance-none bg-white/10 rounded-full outline-none cursor-pointer"
                      style={{
                        WebkitAppearance: 'slider-vertical',
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-aura-muted mt-2">{formattedFreq}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* DSP Audio Modifiers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Bass Boost */}
          <div className="p-4 bg-aura-void/40 rounded-2xl border border-white/5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-aura-cyan" /> Bass Boost
              </span>
              <span className="text-xs font-mono text-aura-cyan font-bold">
                +{settings.bassBoost.toFixed(1)} dB
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={12}
              step={0.5}
              value={settings.bassBoost}
              onChange={(e) => setBassBoost(parseFloat(e.target.value))}
              className="w-full accent-aura-cyan cursor-pointer"
            />
          </div>

          {/* Treble Enhancement */}
          <div className="p-4 bg-aura-void/40 rounded-2xl border border-white/5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-aura-violet" /> Treble Air
              </span>
              <span className="text-xs font-mono text-aura-violet font-bold">
                {settings.treble > 0 ? `+${settings.treble.toFixed(1)}` : settings.treble.toFixed(1)} dB
              </span>
            </div>
            <input
              type="range"
              min={-12}
              max={12}
              step={0.5}
              value={settings.treble}
              onChange={(e) => setTreble(parseFloat(e.target.value))}
              className="w-full accent-aura-violet cursor-pointer"
            />
          </div>

          {/* Stereo Panning */}
          <div className="p-4 bg-aura-void/40 rounded-2xl border border-white/5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <MoveHorizontal className="w-3.5 h-3.5 text-aura-emerald" /> Stereo Pan
              </span>
              <span className="text-xs font-mono text-aura-emerald font-bold">
                {settings.stereoPan === 0
                  ? 'Center'
                  : settings.stereoPan < 0
                  ? `L ${Math.abs(settings.stereoPan * 100).toFixed(0)}%`
                  : `R ${(settings.stereoPan * 100).toFixed(0)}%`}
              </span>
            </div>
            <input
              type="range"
              min={-1}
              max={1}
              step={0.1}
              value={settings.stereoPan}
              onChange={(e) => setStereoPan(parseFloat(e.target.value))}
              className="w-full accent-aura-emerald cursor-pointer"
            />
          </div>

          {/* Reverb Emulation */}
          <div className="p-4 bg-aura-void/40 rounded-2xl border border-white/5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Power className="w-3.5 h-3.5 text-aura-amber" /> Acoustic Space
              </span>
              <span className="text-xs font-mono text-aura-amber font-bold">
                {Math.round(settings.reverbLevel * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.reverbLevel}
              onChange={(e) => setReverbLevel(parseFloat(e.target.value))}
              className="w-full accent-aura-amber cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
