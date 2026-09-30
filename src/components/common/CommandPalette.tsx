import React, { useState, useEffect } from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { useAudioStore } from '../../stores/useAudioStore';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { useAudioLabStore } from '../../stores/useAudioLabStore';
import {
  Search,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Sliders,
  Sparkles,
  Moon,
  ListMusic,
  Activity,
  FolderOpen,
  PieChart,
  Volume2,
  X,
  Radio,
  Maximize2,
  Zap,
} from 'lucide-react';

export const CommandPalette: React.FC = () => {
  const isCommandPaletteOpen = useUIStore((state) => state.isCommandPaletteOpen);
  const setCommandPaletteOpen = useUIStore((state) => state.setCommandPaletteOpen);
  const setActiveView = useUIStore((state) => state.setActiveView);
  const setAudioLabOpen = useUIStore((state) => state.setAudioLabOpen);
  const setAICompanionOpen = useUIStore((state) => state.setAICompanionOpen);
  const setSleepTimerOpen = useUIStore((state) => state.setSleepTimerOpen);
  const setQueueDrawerOpen = useUIStore((state) => state.setQueueDrawerOpen);
  const setFullscreenPlayerOpen = useUIStore((state) => state.setFullscreenPlayerOpen);
  const toggleVisualizer = useUIStore((state) => state.toggleVisualizer);
  const setVisualizerMode = useUIStore((state) => state.setVisualizerMode);

  const isPlaying = useAudioStore((state) => state.isPlaying);
  const togglePlay = useAudioStore((state) => state.togglePlay);
  const nextTrack = useAudioStore((state) => state.nextTrack);
  const prevTrack = useAudioStore((state) => state.prevTrack);
  const playTrack = useAudioStore((state) => state.playTrack);
  const allTracks = useLibraryStore((state) => state.allTracks);
  const applyPreset = useAudioLabStore((state) => state.applyPreset);

  const [query, setQuery] = useState('');

  // Keyboard shortcut listener for Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!isCommandPaletteOpen);
      }
      if (e.key === 'Escape' && isCommandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, setCommandPaletteOpen]);

  if (!isCommandPaletteOpen) return null;

  const staticCommands = [
    {
      id: 'cmd-play-pause',
      title: isPlaying ? 'Pause Audio' : 'Play Audio',
      icon: isPlaying ? Pause : Play,
      category: 'Playback',
      action: () => togglePlay(),
    },
    {
      id: 'cmd-next',
      title: 'Next Track',
      icon: SkipForward,
      category: 'Playback',
      action: () => nextTrack(),
    },
    {
      id: 'cmd-prev',
      title: 'Previous Track',
      icon: SkipBack,
      category: 'Playback',
      action: () => prevTrack(),
    },
    {
      id: 'cmd-fullscreen',
      title: 'Open Fullscreen Cinematic Player',
      icon: Maximize2,
      category: 'Display',
      action: () => setFullscreenPlayerOpen(true),
    },
    {
      id: 'cmd-ai',
      title: 'Launch AURA AI Intelligence',
      icon: Sparkles,
      category: 'AI Companion',
      action: () => setAICompanionOpen(true),
    },
    {
      id: 'cmd-social',
      title: 'Enter Collaborative Social Room',
      icon: Radio,
      category: 'Navigation',
      action: () => setActiveView('social'),
    },
    {
      id: 'cmd-audiolab',
      title: 'Open 10-Band Equalizer & Audio Lab',
      icon: Sliders,
      category: 'Audio Controls',
      action: () => setAudioLabOpen(true),
    },
    {
      id: 'cmd-eq-aura',
      title: 'Equalizer: Apply AURA Signature Preset',
      icon: Sliders,
      category: 'Audio Controls',
      action: () => applyPreset('AURA Signature'),
    },
    {
      id: 'cmd-eq-bass',
      title: 'Equalizer: Apply Bass Heavy Preset',
      icon: Sliders,
      category: 'Audio Controls',
      action: () => applyPreset('Bass Heavy'),
    },
    {
      id: 'cmd-queue',
      title: 'View Playback Queue',
      icon: ListMusic,
      category: 'Navigation',
      action: () => setQueueDrawerOpen(true),
    },
    {
      id: 'cmd-insights',
      title: 'View Listening Analytics & Insights',
      icon: PieChart,
      category: 'Navigation',
      action: () => setActiveView('insights'),
    },
    {
      id: 'cmd-studio',
      title: 'Open Local Music Studio (Import Audio)',
      icon: FolderOpen,
      category: 'Library',
      action: () => setActiveView('studio'),
    },
    {
      id: 'cmd-sleep',
      title: 'Set Sleep Timer',
      icon: Moon,
      category: 'Utilities',
      action: () => setSleepTimerOpen(true),
    },
    {
      id: 'cmd-toggle-vis',
      title: 'Toggle Live Audio Visualizer',
      icon: Activity,
      category: 'Visualizer',
      action: () => toggleVisualizer(),
    },
    {
      id: 'cmd-vis-circular',
      title: 'Visualizer: Circular Pulse Mode',
      icon: Activity,
      category: 'Visualizer',
      action: () => setVisualizerMode('circular'),
    },
    {
      id: 'cmd-vis-particles',
      title: 'Visualizer: Stardust Particles Mode',
      icon: Activity,
      category: 'Visualizer',
      action: () => setVisualizerMode('particles'),
    },
  ];

  // Matching tracks
  const matchingTracks = query.trim()
    ? allTracks
        .filter(
          (t) =>
            t.title.toLowerCase().includes(query.toLowerCase()) ||
            t.artist.toLowerCase().includes(query.toLowerCase()) ||
            t.genre.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 5)
    : [];

  const filteredCommands = staticCommands.filter(
    (c) =>
      c.title.toLowerCase().includes(query.toLowerCase()) ||
      c.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/80 backdrop-blur-lg animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-2xl bg-aura-card border border-aura-border rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 bg-aura-base">
          <Search className="w-5 h-5 text-aura-cyan" />
          <input
            type="text"
            placeholder="Type a command, song title, artist, or action..."
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-white placeholder:text-aura-muted text-sm focus:outline-none"
          />
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono text-aura-muted bg-white/5 border border-white/10 rounded-md">
            ESC
          </kbd>
          <button
            onClick={() => setCommandPaletteOpen(false)}
            className="p-1 text-aura-muted hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-[60vh] overflow-y-auto p-3 flex flex-col gap-1">
          {/* Matching Tracks */}
          {matchingTracks.length > 0 && (
            <div className="mb-2">
              <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-aura-cyan px-3 py-1 block">
                Songs & Tracks
              </span>
              {matchingTracks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    playTrack(t);
                    setCommandPaletteOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-white/10 transition-colors text-left group"
                >
                  <img
                    src={t.artwork}
                    alt={t.title}
                    className="w-9 h-9 rounded-xl object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white group-hover:text-aura-cyan transition-colors truncate">
                      {t.title}
                    </p>
                    <p className="text-xs text-aura-muted truncate">{t.artist} • {t.genre}</p>
                  </div>
                  <Play className="w-4 h-4 text-aura-muted group-hover:text-aura-cyan transition-colors" />
                </button>
              ))}
            </div>
          )}

          {/* Commands */}
          <div>
            <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-aura-muted px-3 py-1 block">
              Commands & Controls
            </span>
            {filteredCommands.map((cmd) => {
              const Icon = cmd.icon;
              return (
                <button
                  key={cmd.id}
                  onClick={() => {
                    cmd.action();
                    setCommandPaletteOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl hover:bg-white/10 transition-colors text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white/5 group-hover:bg-aura-cyan/20 group-hover:text-aura-cyan text-aura-muted flex items-center justify-center transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium text-slate-200 group-hover:text-white">
                      {cmd.title}
                    </span>
                  </div>
                  <span className="text-[11px] text-aura-muted font-mono bg-white/5 px-2 py-0.5 rounded-lg">
                    {cmd.category}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
