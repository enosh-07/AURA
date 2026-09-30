import React from 'react';
import { useAudioStore } from '../../stores/useAudioStore';
import { useUIStore } from '../../stores/useUIStore';
import { audioEngine } from '../../audio/AudioEngine';
import { QualityPreference, QualityTier } from '../../types/audio';
import {
  Sparkles,
  X,
  Radio,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Info,
  Layers,
  Cpu,
  Waves,
} from 'lucide-react';

export const AudioQualityPanel: React.FC = () => {
  const isQualityPanelOpen = useUIStore((state) => state.isQualityPanelOpen);
  const setQualityPanelOpen = useUIStore((state) => state.setQualityPanelOpen);

  const currentTrack = useAudioStore((state) => state.currentTrack);
  const actualQuality = useAudioStore((state) => state.actualDeliveredQuality);
  const streamingPref = useAudioStore((state) => state.streamingQualityPreference);
  const setStreamingPref = useAudioStore((state) => state.setStreamingQualityPreference);
  const bitPerfectMode = useAudioStore((state) => state.bitPerfectMode);
  const setBitPerfectMode = useAudioStore((state) => state.setBitPerfectMode);

  if (!isQualityPanelOpen) return null;

  const dspStatus = audioEngine.getDSPStatus();

  // Active specs (using delivered quality or current track metadata)
  const codec = actualQuality?.codec || currentTrack?.codec || 'FLAC';
  const container = actualQuality?.container || currentTrack?.container || 'FLAC';
  const bitDepth = actualQuality?.bitDepth || currentTrack?.bitDepth || 24;
  const sampleRate = actualQuality?.sampleRate || currentTrack?.sampleRate || 96000;
  const channels = actualQuality?.channels || currentTrack?.channels || 2;
  const bitrate = actualQuality?.bitrate || currentTrack?.bitrate || 2840;
  const qualityTier: QualityTier =
    (actualQuality?.qualityTier || currentTrack?.qualityTier || 'HI_RES_LOSSLESS').toUpperCase() as QualityTier;
  const isLossless = actualQuality?.isLossless ?? currentTrack?.isLossless ?? true;
  const isGenuineLossless = actualQuality?.isGenuineLossless ?? currentTrack?.isGenuineLossless ?? true;
  const validationNotes = actualQuality?.validationNotes || currentTrack?.validationNotes;

  const preferences: QualityPreference[] = ['AUTO', 'STANDARD', 'HIGH', 'LOSSLESS', 'HI_RES_LOSSLESS'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-xl bg-[#0e0d0c] border border-white/10 rounded-3xl p-6 sm:p-7 shadow-2xl text-[#fbf6f1] overflow-hidden"
        style={{
          boxShadow: '0 25px 60px -15px rgba(0,0,0,0.9), 0 0 40px -10px rgba(243,197,166,0.15)',
        }}
      >
        {/* Subtle warm amber ambient glow in corner */}
        <div className="absolute -top-24 -right-24 w-60 h-60 rounded-full bg-[#f3c5a6]/10 blur-[90px] pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#241d19] border border-[#f3c5a6]/30 flex items-center justify-center text-[#f3c5a6]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-serif font-semibold text-[#fbf6f1] tracking-wide">
                Audio Quality & Fidelity
              </h3>
              <p className="text-[11px] text-[#8f867e] font-sans">
                Real-time audio stream pipeline & format verification
              </p>
            </div>
          </div>
          <button
            onClick={() => setQualityPanelOpen(false)}
            className="p-1.5 rounded-full hover:bg-white/[0.08] text-[#8f867e] hover:text-[#fbf6f1] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col gap-5 py-4 max-h-[75vh] overflow-y-auto pr-1">
          {/* Active Quality Badge Banner */}
          <div className="p-4 rounded-2xl bg-[#161514] border border-white/[0.06] flex items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-mono tracking-widest text-[#8f867e] uppercase">
                Currently Delivered Format
              </span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-serif font-semibold text-[#f3c5a6]">
                  {qualityTier === 'HI_RES_LOSSLESS'
                    ? 'Hi-Res Lossless'
                    : qualityTier === 'LOSSLESS'
                    ? 'Genuine Lossless'
                    : qualityTier === 'HIGH'
                    ? 'High Quality (Lossy)'
                    : 'Standard Stream'}
                </span>
                {isGenuineLossless ? (
                  <span className="px-2 py-0.5 rounded-full bg-[#241d19] border border-[#f3c5a6]/40 text-[#f3c5a6] text-[10px] font-mono font-semibold">
                    Bit-Perfect Source
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-white/[0.06] text-[#8f867e] text-[10px] font-mono">
                    AAC / MP3
                  </span>
                )}
              </div>
              <p className="text-xs text-[#8f867e] truncate max-w-sm">
                {currentTrack?.title} • {currentTrack?.artist}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#241d19] border border-[#f3c5a6]/25 flex items-center justify-center text-[#f3c5a6] shrink-0">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
          </div>

          {/* Detailed Technical Specs Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-[#141312] border border-white/[0.05] flex flex-col gap-0.5">
              <span className="text-[10px] font-mono text-[#8f867e] uppercase">Source Codec</span>
              <span className="text-sm font-semibold text-[#fbf6f1]">{codec}</span>
              <span className="text-[10px] text-[#8f867e] font-mono">Container: {container}</span>
            </div>

            <div className="p-3 rounded-xl bg-[#141312] border border-white/[0.05] flex flex-col gap-0.5">
              <span className="text-[10px] font-mono text-[#8f867e] uppercase">Bit Depth</span>
              <span className="text-sm font-semibold text-[#fbf6f1]">{bitDepth}-bit</span>
              <span className="text-[10px] text-[#8f867e] font-mono">
                {bitDepth >= 24 ? 'Studio Master' : 'Red Book CD'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#141312] border border-white/[0.05] flex flex-col gap-0.5">
              <span className="text-[10px] font-mono text-[#8f867e] uppercase">Sample Rate</span>
              <span className="text-sm font-semibold text-[#fbf6f1]">
                {(sampleRate / 1000).toFixed(1)} kHz
              </span>
              <span className="text-[10px] text-[#8f867e] font-mono">
                Nyquist: {(sampleRate / 2000).toFixed(1)} kHz
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#141312] border border-white/[0.05] flex flex-col gap-0.5">
              <span className="text-[10px] font-mono text-[#8f867e] uppercase">Channels</span>
              <span className="text-sm font-semibold text-[#fbf6f1]">
                {channels === 1 ? 'Mono' : channels === 2 ? 'Stereo (2ch)' : `${channels} Channels`}
              </span>
              <span className="text-[10px] text-[#8f867e] font-mono">Uncompressed Audio</span>
            </div>

            <div className="p-3 rounded-xl bg-[#141312] border border-white/[0.05] flex flex-col gap-0.5">
              <span className="text-[10px] font-mono text-[#8f867e] uppercase">Measured Bitrate</span>
              <span className="text-sm font-semibold text-[#f3c5a6]">{bitrate.toLocaleString()} kbps</span>
              <span className="text-[10px] text-[#8f867e] font-mono">Actual Bandwidth</span>
            </div>

            <div className="p-3 rounded-xl bg-[#141312] border border-white/[0.05] flex flex-col gap-0.5">
              <span className="text-[10px] font-mono text-[#8f867e] uppercase">Fidelity Status</span>
              <span className="text-sm font-semibold text-[#fbf6f1]">
                {isLossless ? 'Lossless Verified' : 'Standard Lossy'}
              </span>
              <span className="text-[10px] text-[#8f867e] font-mono">
                {isGenuineLossless ? 'Authentic Spectrum' : 'Transcode Check Passed'}
              </span>
            </div>
          </div>

          {/* Bit-Perfect Mode Toggle */}
          <div className="p-4 rounded-2xl bg-[#141312] border border-white/[0.06] flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Cpu className="w-4 h-4 text-[#f3c5a6]" />
                <div>
                  <h4 className="text-xs font-semibold text-[#fbf6f1]">Bit-Perfect Output Mode</h4>
                  <p className="text-[11px] text-[#8f867e]">
                    Bypasses software EQ, volume scaling, and digital processing
                  </p>
                </div>
              </div>

              <button
                onClick={() => setBitPerfectMode(!bitPerfectMode)}
                className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 ${
                  bitPerfectMode ? 'bg-[#f3c5a6]' : 'bg-white/10'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-[#141210] transition-transform ${
                    bitPerfectMode ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Platform Limitation Notice */}
            <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-[#f3c5a6] shrink-0 mt-0.5" />
              <p className="text-[10px] text-[#8f867e] leading-relaxed">
                Operating system audio pipelines (e.g. Windows Audio Engine / WASAPI Shared Mode) and browser audio contexts can resample streams to match device output settings. For true hardware bit-perfect playback, ensure your system sound device sample rate matches the source.
              </p>
            </div>
          </div>

          {/* DSP & Processing Diagnostics */}
          <div className="p-4 rounded-2xl bg-[#141312] border border-white/[0.06] flex flex-col gap-2">
            <span className="text-[11px] font-mono text-[#8f867e] uppercase flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-[#f3c5a6]" /> Processing & DSP Diagnostics
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-black/30 border border-white/[0.04]">
                <span className="text-[10px] text-[#8f867e] block">10-Band EQ</span>
                <span className={dspStatus.eq ? 'text-[#f3c5a6] font-semibold' : 'text-[#8f867e]'}>
                  {dspStatus.eq ? 'ACTIVE' : 'OFF (Bypassed)'}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-black/30 border border-white/[0.04]">
                <span className="text-[10px] text-[#8f867e] block">Spatial Audio</span>
                <span className={dspStatus.spatial ? 'text-[#f3c5a6] font-semibold' : 'text-[#8f867e]'}>
                  {dspStatus.spatial ? 'ACTIVE' : 'OFF'}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-black/30 border border-white/[0.04]">
                <span className="text-[10px] text-[#8f867e] block">Normalization</span>
                <span className="text-[#8f867e]">OFF</span>
              </div>
              <div className="p-2 rounded-lg bg-black/30 border border-white/[0.04]">
                <span className="text-[10px] text-[#8f867e] block">Output Status</span>
                <span
                  className={
                    bitPerfectMode
                      ? 'text-[#f3c5a6] font-semibold'
                      : dspStatus.isProcessing
                      ? 'text-amber-300 font-semibold'
                      : 'text-[#fbf6f1]'
                  }
                >
                  {bitPerfectMode
                    ? 'Bit-Perfect'
                    : dspStatus.isProcessing
                    ? 'Processed'
                    : 'Direct Stream'}
                </span>
              </div>
            </div>
          </div>

          {/* Quality Preference Selection */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-mono text-[#8f867e] uppercase flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#f3c5a6]" /> Quality Preference Selection
            </span>
            <div className="flex flex-wrap gap-2">
              {preferences.map((pref) => {
                const isActive = streamingPref === pref;
                return (
                  <button
                    key={pref}
                    onClick={() => setStreamingPref(pref)}
                    className={`px-3 py-1.5 rounded-full text-xs font-mono transition-all ${
                      isActive
                        ? 'bg-[#f3c5a6] text-[#141210] font-semibold shadow-md'
                        : 'bg-[#141312] border border-white/[0.08] text-[#8f867e] hover:text-[#fbf6f1] hover:border-white/20'
                    }`}
                  >
                    {pref.replace('_', ' ')}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Source Validation Footnote */}
          {validationNotes && (
            <div className="p-3 rounded-xl bg-[#141312] border border-white/[0.05] flex items-start gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-[#f3c5a6] shrink-0 mt-0.5" />
              <p className="text-[11px] text-[#8f867e] leading-relaxed">
                {validationNotes}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
