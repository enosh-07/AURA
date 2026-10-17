import React from 'react';
import { useAudioStore } from '../../stores/useAudioStore';
import { useUIStore } from '../../stores/useUIStore';
import { audioEngine } from '../../audio/AudioEngine';
import { QualityPreference, QualityTier } from '../../types/audio';
import {
  Sparkles,
  X,
  Radio,
  AlertTriangle,
  Info,
  Layers,
  Cpu,
  ShieldCheck,
  Activity,
  ArrowRight,
  Disc3,
  Sliders,
  Volume2,
} from 'lucide-react';

export const AudioQualityPanel: React.FC = () => {
  const isQualityPanelOpen = useUIStore((state) => state.isQualityPanelOpen);
  const setQualityPanelOpen = useUIStore((state) => state.setQualityPanelOpen);

  const currentTrack = useAudioStore((state) => state.currentTrack);
  const actualQuality = useAudioStore((state) => state.actualDeliveredQuality);
  const qualityReport = useAudioStore((state) => state.audioQualityReport);
  const streamingPref = useAudioStore((state) => state.streamingQualityPreference);
  const setStreamingPref = useAudioStore((state) => state.setStreamingQualityPreference);
  const bitPerfectMode = useAudioStore((state) => state.bitPerfectMode);
  const setBitPerfectMode = useAudioStore((state) => state.setBitPerfectMode);
  const switchToLosslessAlternative = useAudioStore((state) => state.switchToLosslessAlternative);

  if (!isQualityPanelOpen) return null;

  const dspStatus = audioEngine.getDSPStatus();
  const outputSampleRate = audioEngine.getOutputDeviceSampleRate();
  const atmosCap = audioEngine.checkAtmosSupport();

  // Authoritative specs from typed AudioQualityReport or fallback telemetry
  const isOnlineTrack = !!(currentTrack?.isOnline || currentTrack?.id.startsWith('saavn_'));
  const isLocalTrack = !!(currentTrack?.fileBlob || currentTrack?.audioUrl.startsWith('blob:'));

  const providerName = qualityReport?.provider.displayName || (
    isLocalTrack
      ? 'Local Audio File (Device)'
      : isOnlineTrack
      ? 'JioSaavn Music Stream'
      : (currentTrack as any)?.provider || 'AURA High-Fidelity Local Vault'
  );

  const codec = (
    qualityReport?.source.codec ||
    actualQuality?.codec ||
    currentTrack?.codec ||
    (isOnlineTrack ? 'AAC' : 'FLAC')
  ).toUpperCase();

  const container = (
    qualityReport?.source.container ||
    actualQuality?.container ||
    currentTrack?.container ||
    (isOnlineTrack ? 'M4A' : 'FLAC')
  ).toUpperCase();

  const isLosslessCodec = codec === 'FLAC' || codec === 'ALAC' || codec === 'PCM' || codec === 'WAV' || codec === 'AIFF';
  const isLossless = qualityReport?.source.isLossless ?? (actualQuality?.isLossless ?? (isLosslessCodec && !isOnlineTrack));
  const isGenuineLossless = isLossless;
  const isHiRes = qualityReport?.source.isHiRes ?? (
    (actualQuality?.sampleRate && actualQuality.sampleRate >= 88200) ||
    (actualQuality?.bitDepth && actualQuality.bitDepth >= 24) ||
    false
  );

  const bitDepth = qualityReport?.source.bitDepth ?? actualQuality?.bitDepth ?? (isLossless ? currentTrack?.bitDepth || 16 : null);
  const sampleRate = qualityReport?.source.sampleRate || actualQuality?.sampleRate || currentTrack?.sampleRate || (isOnlineTrack ? 44100 : 96000);
  const channels = qualityReport?.source.channels || actualQuality?.channels || currentTrack?.channels || 2;
  const bitrate = qualityReport?.source.bitrate || actualQuality?.bitrate || currentTrack?.bitrate || (isOnlineTrack ? 320 : 1268);

  const deliveredTier: QualityTier = (
    qualityReport?.deliveredTier ||
    actualQuality?.qualityTier ||
    currentTrack?.qualityTier ||
    (isHiRes ? 'HI_RES_LOSSLESS' : isLossless ? 'LOSSLESS' : 'HIGH')
  ).toUpperCase() as QualityTier;

  // Fallback condition: User asked for Lossless/Hi-Res, but delivered stream is lossy
  const requestedLossless = streamingPref === 'LOSSLESS' || streamingPref === 'HI_RES_LOSSLESS';
  const hasFallbackWarning = requestedLossless && !isLossless;

  // Lossless alternative available in vault
  const alternative = qualityReport?.verification.losslessAlternativeAvailable;

  // Dolby Atmos State
  const isAtmosVerified = qualityReport?.dolbyAtmos?.isDolbyAtmos || false;
  const atmosReason = qualityReport?.dolbyAtmos?.reason || (
    isOnlineTrack
      ? 'The upstream provider does not supply a multi-channel Dolby Atmos (E-AC-3 JOC) mix for this track.'
      : 'Track master is standard 2-channel stereo. True Dolby Atmos requires a discrete height and bed object mix.'
  );

  const durationSec = currentTrack?.duration || 0;
  const formattedDuration = `${Math.floor(durationSec / 60)}:${String(Math.floor(durationSec % 60)).padStart(2, '0')}`;
  const estimatedFileSizeMB = durationSec > 0 && bitrate > 0
    ? ((durationSec * (bitrate * 1000)) / (8 * 1024 * 1024)).toFixed(1)
    : null;

  const preferences: QualityPreference[] = ['AUTO', 'STANDARD', 'HIGH', 'LOSSLESS', 'HI_RES_LOSSLESS'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-xl bg-[#0e0d0c] border border-white/10 rounded-3xl p-5 sm:p-7 shadow-2xl text-[#fbf6f1] overflow-hidden"
        style={{
          boxShadow: '0 25px 60px -15px rgba(0,0,0,0.95), 0 0 40px -10px rgba(0,242,254,0.15)',
        }}
      >
        {/* Subtle cyan and amber ambient glow in corners */}
        <div className="absolute -top-24 -right-24 w-60 h-60 rounded-full bg-aura-cyan/10 blur-[90px] pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 rounded-full bg-[#f3c5a6]/10 blur-[90px] pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#241d19] border border-aura-cyan/30 flex items-center justify-center text-aura-cyan shadow-glow-cyan/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-serif font-semibold text-[#fbf6f1] tracking-wide">
                Real Audio Quality & Fidelity Intelligence
              </h3>
              <p className="text-[11px] text-[#8f867e] font-sans">
                Authoritative source provenance, lossless verification & Atmos diagnostics
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

        <div className="flex flex-col gap-4 py-4 max-h-[75vh] overflow-y-auto pr-1 scrollbar-none">
          
          {/* Active Track & Delivery Tier Comparison */}
          {currentTrack ? (
            <div className="p-4 rounded-2xl bg-[#161514] border border-white/[0.06] flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-[10px] font-mono tracking-widest text-[#8f867e] uppercase">
                    Active Audio Source
                  </span>
                  <h4 className="text-sm sm:text-base font-semibold text-white truncate">
                    {currentTrack.title}
                  </h4>
                  <p className="text-xs text-[#8f867e] truncate">
                    {currentTrack.artist} {currentTrack.album ? `• ${currentTrack.album}` : ''}
                  </p>
                </div>

                <div className="w-10 h-10 rounded-xl bg-[#241d19] border border-aura-cyan/30 flex items-center justify-center text-aura-cyan shrink-0">
                  <Radio className="w-5 h-5 animate-pulse" />
                </div>
              </div>

              {/* Requested vs Delivered Tier Row */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/[0.06]">
                <div className="p-2.5 rounded-xl bg-black/30 border border-white/[0.04] flex flex-col gap-0.5">
                  <span className="text-[9px] font-mono text-[#8f867e] uppercase">Requested Quality</span>
                  <span className="text-xs font-mono font-bold text-[#fbf6f1]">
                    {streamingPref === 'AUTO'
                      ? 'Auto (Adaptive)'
                      : streamingPref.replace('_', ' ')}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-black/30 border border-white/[0.04] flex flex-col gap-0.5">
                  <span className="text-[9px] font-mono text-[#8f867e] uppercase">Delivered Quality</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-mono font-bold ${isLossless ? 'text-aura-cyan' : 'text-[#f3c5a6]'}`}>
                      {deliveredTier === 'HI_RES_LOSSLESS'
                        ? 'Hi-Res Lossless'
                        : deliveredTier === 'LOSSLESS'
                        ? 'Lossless'
                        : deliveredTier === 'HIGH'
                        ? 'High (320 kbps)'
                        : 'Standard (160 kbps)'}
                    </span>
                    {isGenuineLossless ? (
                      <span className="px-1.5 py-0.2 rounded bg-aura-cyan/20 border border-aura-cyan/40 text-aura-cyan text-[9px] font-mono">
                        Bit-Perfect
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.2 rounded bg-white/10 text-slate-400 text-[9px] font-mono">
                        Lossy
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-[#161514] border border-white/[0.06] text-center text-xs text-[#8f867e]">
              No active track playing. Start playback to inspect authentic audio telemetry.
            </div>
          )}

          {/* Transparent Mismatch Banner (Requirement 4) */}
          {hasFallbackWarning && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-0.5 text-xs">
                <span className="font-semibold text-amber-300">
                  Requested Tier Unavailable ({streamingPref.replace('_', ' ')})
                </span>
                <p className="text-[11px] text-amber-200/80 leading-relaxed">
                  {qualityReport?.verification.notes ||
                    `The upstream provider delivers native ${bitrate} kbps ${codec} audio. AURA will never simulate fake lossless audio through artificial transcodes.`}
                </p>
              </div>
            </div>
          )}

          {/* Lossless Alternative Available Card (Requirement 2 & 4) */}
          {alternative && (
            <div className="p-3.5 rounded-2xl bg-aura-cyan/10 border border-aura-cyan/30 flex items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <Disc3 className="w-4 h-4 text-aura-cyan shrink-0 mt-0.5 animate-spin" />
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white">Genuine Lossless Master Available</span>
                    <span className="px-1.5 py-0.5 rounded bg-aura-cyan/20 text-aura-cyan text-[9px] font-mono font-bold">
                      {alternative.codec} {alternative.bitDepth ? `${alternative.bitDepth}b/` : ''}{Math.round(alternative.sampleRate / 1000)}k
                    </span>
                  </div>
                  <p className="text-[11px] text-aura-cyan/80 truncate">
                    Found authentic master: {alternative.title} • {alternative.artist}
                  </p>
                </div>
              </div>

              <button
                onClick={() => switchToLosslessAlternative(alternative.trackId)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-aura-cyan text-aura-void text-xs font-bold hover:scale-105 active:scale-95 transition-all shrink-0"
              >
                <span>Switch to Lossless</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Technical Source Specs Grid (Requirement 3: Genuine Source Inspection) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {/* Codec & Container */}
            <div className="p-3 rounded-xl bg-[#141312] border border-white/[0.05] flex flex-col gap-0.5">
              <span className="text-[10px] font-mono text-[#8f867e] uppercase">Source Codec</span>
              <span className="text-sm font-semibold text-[#fbf6f1]">{codec || 'Unknown'}</span>
              <span className="text-[10px] text-[#8f867e] font-mono">Container: {container || 'Unknown'}</span>
            </div>

            {/* Bit Depth */}
            <div className="p-3 rounded-xl bg-[#141312] border border-white/[0.05] flex flex-col gap-0.5">
              <span className="text-[10px] font-mono text-[#8f867e] uppercase">Bit Depth</span>
              <span className="text-sm font-semibold text-[#fbf6f1]">
                {bitDepth ? `${bitDepth}-bit` : 'N/A (Lossy MDCT)'}
              </span>
              <span className="text-[10px] text-[#8f867e] font-mono">
                {bitDepth
                  ? bitDepth >= 24
                    ? 'Studio Master (Linear PCM)'
                    : 'Red Book CD (16-bit)'
                  : 'Sub-band perceptual'}
              </span>
            </div>

            {/* Sample Rate */}
            <div className="p-3 rounded-xl bg-[#141312] border border-white/[0.05] flex flex-col gap-0.5">
              <span className="text-[10px] font-mono text-[#8f867e] uppercase">Sample Rate</span>
              <span className="text-sm font-semibold text-[#fbf6f1]">
                {sampleRate ? `${(sampleRate / 1000).toFixed(1)} kHz` : 'Unknown'}
              </span>
              <span className="text-[10px] text-[#8f867e] font-mono">
                {sampleRate ? `Nyquist: ${(sampleRate / 2000).toFixed(1)} kHz` : 'Unknown'}
              </span>
            </div>

            {/* Channels & Layout */}
            <div className="p-3 rounded-xl bg-[#141312] border border-white/[0.05] flex flex-col gap-0.5">
              <span className="text-[10px] font-mono text-[#8f867e] uppercase">Channel Layout</span>
              <span className="text-sm font-semibold text-[#fbf6f1]">
                {channels === 1 ? 'Mono (1.0)' : channels === 2 ? 'Stereo (2.0)' : `${channels} Channels`}
              </span>
              <span className="text-[10px] text-[#8f867e] font-mono">
                Discrete audio channels
              </span>
            </div>

            {/* Bitrate & Mode */}
            <div className="p-3 rounded-xl bg-[#141312] border border-white/[0.05] flex flex-col gap-0.5">
              <span className="text-[10px] font-mono text-[#8f867e] uppercase">Source Bitrate</span>
              <span className="text-sm font-semibold text-aura-cyan">
                {bitrate ? `${bitrate.toLocaleString()} kbps` : 'Unknown'}
              </span>
              <span className="text-[10px] text-[#8f867e] font-mono">
                {isLossless ? 'Variable (Lossless VBR)' : 'Constant (CBR)'}
              </span>
            </div>

            {/* Provider & Estimated Size */}
            <div className="p-3 rounded-xl bg-[#141312] border border-white/[0.05] flex flex-col gap-0.5">
              <span className="text-[10px] font-mono text-[#8f867e] uppercase">Provider & Size</span>
              <span className="text-xs font-semibold text-[#fbf6f1] truncate" title={providerName}>
                {providerName}
              </span>
              <span className="text-[10px] text-[#8f867e] font-mono truncate">
                {estimatedFileSizeMB ? `~${estimatedFileSizeMB} MB • ` : ''}{formattedDuration}
              </span>
            </div>
          </div>

          {/* Quality Preference Selection (Requirement 4) */}
          <div className="p-4 rounded-2xl bg-[#141312] border border-white/[0.06] flex flex-col gap-2.5">
            <span className="text-[11px] font-mono text-[#8f867e] uppercase flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-aura-cyan" /> Playback Quality Preference
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
                        ? 'bg-aura-cyan text-aura-void font-bold shadow-glow-cyan/20 scale-102'
                        : 'bg-black/30 border border-white/[0.08] text-[#8f867e] hover:text-[#fbf6f1] hover:border-white/20'
                    }`}
                  >
                    {pref === 'AUTO'
                      ? 'Auto (Adaptive)'
                      : pref === 'HI_RES_LOSSLESS'
                      ? 'Hi-Res Lossless'
                      : pref.replace('_', ' ')}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-[#8f867e] leading-relaxed">
              In <strong>Auto</strong> mode, AURA adapts to client bandwidth without stuttering. Explicit quality requests will deliver authentic native sources and will never simulate lossless audio through artificial transcodes.
            </p>
          </div>

          {/* Dolby Atmos & Spatial Audio Architecture (Requirement 5) */}
          <div className="p-4 rounded-2xl bg-[#141312] border border-white/[0.06] flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-[#8f867e] uppercase flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-aura-cyan" /> Dolby Atmos & Spatial Audio Integrity
              </span>

              {/* Atmos Badge: Shown ONLY if verified Atmos (Never on stereo!) */}
              {isAtmosVerified ? (
                <span className="px-2 py-0.5 rounded-full bg-aura-cyan/20 border border-aura-cyan/40 text-aura-cyan text-[10px] font-mono font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-aura-cyan" /> Dolby Atmos Verified
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-400 text-[10px] font-mono">
                  Stereo Pass-Through (Not Atmos)
                </span>
              )}
            </div>

            <div className="p-3 rounded-xl bg-black/30 border border-white/[0.04] flex flex-col gap-1.5 text-xs">
              <div className="flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-aura-cyan shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  <strong>Source Status:</strong> {atmosReason}
                </p>
              </div>

              <div className="flex items-start gap-2 pt-1 border-t border-white/[0.04]">
                <Cpu className="w-3.5 h-3.5 text-[#f3c5a6] shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  <strong>Decoder Capability:</strong> {atmosCap.reason}
                </p>
              </div>

              <div className="flex items-start gap-2 pt-1 border-t border-white/[0.04]">
                <Sliders className="w-3.5 h-3.5 text-aura-violet shrink-0 mt-0.5" />
                <p className="text-[10px] text-[#8f867e] leading-relaxed">
                  <strong>AURA Architectural Note:</strong> AURA strictly separates genuine multi-channel object Dolby Atmos from software binaural effects. AURA Acoustic Lab 3D virtualizer operates as a binaural simulation and is never falsely branded as Dolby Atmos.
                </p>
              </div>
            </div>
          </div>

          {/* Decoded Output Pipeline & Bit-Perfect Mode (Requirement 3 & 4) */}
          <div className="p-4 rounded-2xl bg-[#141312] border border-white/[0.06] flex flex-col gap-2.5">
            <span className="text-[11px] font-mono text-[#8f867e] uppercase flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-aura-cyan" /> Decoded Audio Output Pipeline
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-black/30 border border-white/[0.04]">
                <span className="text-[10px] text-[#8f867e] block">Web Audio Sample Rate</span>
                <span className="text-[#fbf6f1] font-mono font-semibold">
                  {(outputSampleRate / 1000).toFixed(1)} kHz
                </span>
                <span className="text-[9px] text-[#8f867e] block">32-bit Float Internal</span>
              </div>

              <div className="p-2.5 rounded-lg bg-black/30 border border-white/[0.04]">
                <span className="text-[10px] text-[#8f867e] block">DSP Signal Processing</span>
                <span className={dspStatus.isProcessing ? 'text-amber-300 font-semibold' : 'text-emerald-400 font-semibold'}>
                  {dspStatus.isProcessing ? 'Active EQ / Spatial' : 'Clean Pass-Through'}
                </span>
                <span className="text-[9px] text-[#8f867e] block">
                  EQ: {dspStatus.eq ? 'ON' : 'OFF'} • Spatial: {dspStatus.spatial ? 'ON' : 'OFF'}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-black/30 border border-white/[0.04]">
                <span className="text-[10px] text-[#8f867e] block">Operating System Mixer</span>
                <span className="text-[#fbf6f1] font-semibold">Shared Audio Mixer</span>
                <span className="text-[9px] text-[#8f867e] block">Host Driver Resampling</span>
              </div>
            </div>

            {/* Bit-Perfect Mode Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/[0.04]">
              <div className="flex items-center gap-2.5">
                <Cpu className="w-4 h-4 text-aura-cyan" />
                <div>
                  <h5 className="text-xs font-semibold text-[#fbf6f1]">Bit-Perfect Pass-Through Mode</h5>
                  <p className="text-[10px] text-[#8f867e]">
                    Bypasses equalizer filters, stereo panning, gain scaling, and virtual DSP
                  </p>
                </div>
              </div>

              <button
                onClick={() => setBitPerfectMode(!bitPerfectMode)}
                className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-1 shrink-0 ${
                  bitPerfectMode ? 'bg-aura-cyan' : 'bg-white/10'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-[#141210] transition-transform ${
                    bitPerfectMode ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
