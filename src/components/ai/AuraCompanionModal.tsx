import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { useAudioStore } from '../../stores/useAudioStore';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { aiCompanionService, AIResponse } from '../../services/aiCompanion';
import { apiClient } from '../../services/apiClient';
import {
  Sparkles,
  X,
  Send,
  Play,
  ListPlus,
  Key,
  ChevronRight,
  Bot,
  Zap,
  ListMusic,
  Disc,
} from 'lucide-react';
import { Track } from '../../types/audio';

interface Message {
  sender: 'user' | 'aura';
  text: string;
  response?: AIResponse;
}

export const AuraCompanionModal: React.FC = () => {
  const isAICompanionOpen = useUIStore((state) => state.isAICompanionOpen);
  const setAICompanionOpen = useUIStore((state) => state.setAICompanionOpen);
  const setActiveView = useUIStore((state) => state.setActiveView);

  const currentTrack = useAudioStore((state) => state.currentTrack);
  const playTrack = useAudioStore((state) => state.playTrack);
  const addToQueue = useAudioStore((state) => state.addToQueue);
  const allTracks = useLibraryStore((state) => state.allTracks);
  const createPlaylist = useLibraryStore((state) => state.createPlaylist);
  const loadInitialData = useLibraryStore((state) => state.loadInitialData);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'aura',
      text: "Greetings. I am AURA, your neural audio companion. What sonic atmosphere would you like to manifest right now?",
    },
  ]);
  const [showConfig, setShowConfig] = useState(false);
  const [customKey, setCustomKey] = useState(localStorage.getItem('aura_ai_key') || '');
  const [provider, setProvider] = useState(localStorage.getItem('aura_ai_provider') || 'gemini');

  if (!isAICompanionOpen) return null;

  const quickPrompts = [
    'Play something calm for studying',
    'Build a 30-minute workout mix',
    'Create a playlist for a rainy evening',
    'Find songs similar to this track',
    'Late night cyberpunk synthwave cruise',
  ];

  const handleSend = async (promptText: string) => {
    const text = promptText.trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { sender: 'user', text }]);
    setInput('');
    setLoading(true);

    try {
      const response = await aiCompanionService.processPrompt(text, allTracks, currentTrack);
      setMessages((prev) => [...prev, { sender: 'aura', text: response.message, response }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'aura',
          text: 'Signal interference encountered. Switched to fallback local acoustic engine.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (resp: AIResponse) => {
    if (!resp.action) return;

    if (resp.action.type === 'PLAY_TRACK' && resp.action.payload) {
      playTrack(resp.action.payload as Track);
      setAICompanionOpen(false);
    } else if (resp.action.type === 'CREATE_PLAYLIST' && resp.action.payload) {
      const payload = resp.action.payload as { title: string; tracks: Track[] };
      const pl = await createPlaylist(
        payload.title,
        `Curated by AURA AI. ${resp.reasoning || ''}`,
        payload.tracks.map((t) => t.id)
      );
      if (payload.tracks.length > 0) {
        playTrack(payload.tracks[0], payload.tracks);
      }
      setActiveView('playlist', pl.id);
      setAICompanionOpen(false);
    } else if (resp.action.type === 'OPEN_VIEW') {
      setActiveView('insights');
      setAICompanionOpen(false);
    }
  };

  const handleStartAIDJ = async () => {
    setLoading(true);
    try {
      const sessionId = await apiClient.createDJSession(input || 'Continuous Sonic Flow');
      if (sessionId) {
        const next = await apiClient.getDJNextTrack(sessionId, currentTrack?.id);
        if (next) {
          playTrack(next);
          setMessages((prev) => [
            ...prev,
            {
              sender: 'aura',
              text: `AI DJ Session initialized [Session: ${sessionId.slice(0, 8)}]. Now mixing "${next.title}" seamlessly.`,
            },
          ]);
        }
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAIPlaylist = async () => {
    const prompt = input.trim() || 'Cosmic Harmonic Odyssey';
    setLoading(true);
    setInput('');
    try {
      const res = await apiClient.generateAIPlaylist(prompt, 6, true);
      if (res && res.playlist) {
        await loadInitialData();
        setMessages((prev) => [
          ...prev,
          {
            sender: 'aura',
            text: `Generated AI playlist "${res.playlist.title}" with ${res.tracks?.length || 0} tracks. ${res.rationale || ''}`,
            response: {
              message: res.rationale || 'Synthesized based on neural prompt analysis.',
              suggestedTracks: res.tracks,
              action: {
                type: 'CREATE_PLAYLIST',
                payload: { title: res.playlist.title, tracks: res.tracks || [] },
                label: `Listen to "${res.playlist.title}"`,
              },
            },
          },
        ]);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  const handleSaveApiKey = () => {
    localStorage.setItem('aura_ai_key', customKey.trim());
    localStorage.setItem('aura_ai_provider', provider);
    setShowConfig(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl h-[85vh] bg-aura-card border border-aura-border rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-aura-base">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-aura-cyan/20 to-aura-violet/30 border border-aura-cyan/40 flex items-center justify-center text-aura-cyan shadow-glow-cyan/20">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                AURA Intelligence
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-aura-cyan/20 text-aura-cyan border border-aura-cyan/30">
                  Neural Core
                </span>
              </h2>
              <p className="text-xs text-aura-muted">Context-aware music curation & discovery</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowConfig(!showConfig)}
              title="Configure Custom LLM Key (Gemini/OpenAI)"
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-aura-muted hover:text-white transition-colors"
            >
              <Key className="w-4 h-4" />
            </button>
            <button
              onClick={() => setAICompanionOpen(false)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-aura-muted hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Optional Custom API Key Drawer */}
        {showConfig && (
          <div className="p-4 bg-aura-surface/90 border-b border-white/10 flex flex-col gap-3">
            <span className="text-xs font-semibold text-white">Custom LLM Provider (Optional)</span>
            <div className="flex gap-2">
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="bg-aura-card border border-white/10 text-xs text-white rounded-xl px-3 py-2"
              >
                <option value="gemini">Google Gemini API</option>
                <option value="openai">OpenAI Compatible API</option>
              </select>
              <input
                type="password"
                placeholder="Enter custom API Key (leave empty for built-in intelligence)"
                value={customKey}
                onChange={(e) => setCustomKey(e.target.value)}
                className="flex-1 bg-aura-card border border-white/10 text-xs text-white px-3 py-2 rounded-xl"
              />
              <button
                onClick={handleSaveApiKey}
                className="px-4 py-2 bg-aura-cyan text-aura-void font-bold text-xs rounded-xl"
              >
                Save
              </button>
            </div>
          </div>
        )}

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-aura-cyan/20 border border-aura-cyan/30 text-white'
                    : 'bg-aura-surface/80 border border-aura-border text-slate-200'
                }`}
              >
                {msg.sender === 'aura' && (
                  <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-aura-cyan font-mono">
                    <Bot className="w-3.5 h-3.5" /> AURA CORE
                  </div>
                )}
                <p>{msg.text}</p>

                {/* Suggested Tracks cards if available */}
                {msg.response?.suggestedTracks && msg.response.suggestedTracks.length > 0 && (
                  <div className="mt-3 flex flex-col gap-2">
                    {msg.response.suggestedTracks.slice(0, 3).map((track) => (
                      <div
                        key={track.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-black/30 border border-white/5"
                      >
                        <div
                          className="flex items-center gap-2.5 min-w-0 cursor-pointer flex-1"
                          onClick={() => playTrack(track)}
                        >
                          <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-aura-void">
                            <img src={track.artwork} alt={track.title} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white truncate">{track.title}</p>
                            <p className="text-[10px] text-aura-muted truncate">{track.artist}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => addToQueue(track)}
                            title="Add to Queue"
                            className="p-1 rounded-lg hover:bg-white/10 text-aura-muted hover:text-white"
                          >
                            <ListMusic className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => playTrack(track)}
                            title="Play"
                            className="p-1 rounded-lg bg-aura-cyan text-aura-void"
                          >
                            <Play className="w-3 h-3 fill-current" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* AI Reasoning & Action Button */}
                {msg.response?.action && (
                  <div className="mt-3 pt-3 border-t border-white/10 flex flex-col gap-2">
                    {msg.response.reasoning && (
                      <p className="text-[11px] text-aura-muted italic">
                        {msg.response.reasoning}
                      </p>
                    )}
                    <button
                      onClick={() => handleAction(msg.response!)}
                      className="inline-flex items-center gap-2 self-start px-4 py-2 rounded-xl bg-gradient-to-r from-aura-cyan to-aura-violet text-white font-semibold text-xs shadow-glow-cyan/20 hover:opacity-90 transition-opacity"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      {msg.response.action.label}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-aura-cyan font-mono p-2">
              <Sparkles className="w-4 h-4 animate-spin" />
              AURA is analyzing harmonic waveforms...
            </div>
          )}
        </div>

        {/* Quick Suggestions & Power Actions */}
        <div className="p-3 bg-aura-surface/40 border-t border-white/5 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-aura-muted">Curated Neural Invocations</span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleStartAIDJ}
                disabled={loading}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-aura-violet/20 hover:bg-aura-violet/30 text-aura-violet border border-aura-violet/30 text-[10px] font-bold transition-colors disabled:opacity-40"
              >
                <Zap className="w-3 h-3" /> Start AI DJ
              </button>
              <button
                onClick={handleGenerateAIPlaylist}
                disabled={loading}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-aura-cyan/20 hover:bg-aura-cyan/30 text-aura-cyan border border-aura-cyan/30 text-[10px] font-bold transition-colors disabled:opacity-40"
              >
                <ListPlus className="w-3 h-3" /> Synthesize Playlist
              </button>
            </div>
          </div>

          <div className="overflow-x-auto flex items-center gap-2 scrollbar-none pb-1">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleSend(prompt)}
                className="px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5 transition-all"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="p-4 bg-aura-base border-t border-white/10 flex items-center gap-2"
        >
          <input
            type="text"
            placeholder="Ask AURA to shape a session, find songs, or match your mood..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 bg-aura-card border border-white/10 text-sm text-white placeholder:text-aura-muted px-4 py-3 rounded-2xl focus:outline-none focus:border-aura-cyan/50"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-3 rounded-2xl bg-aura-cyan text-aura-void font-bold hover:opacity-90 disabled:opacity-40 transition-all"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};
