import React, { useState } from 'react';
import { useAudioStore } from '../../stores/useAudioStore';
import { useUIStore } from '../../stores/useUIStore';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { apiClient } from '../../services/apiClient';
import {
  ListMusic,
  X,
  Trash2,
  ListPlus,
  Play,
  ArrowUp,
  ArrowDown,
  Music,
  Sparkles,
  Shuffle,
} from 'lucide-react';

export const QueueDrawer: React.FC = () => {
  const isQueueDrawerOpen = useUIStore((state) => state.isQueueDrawerOpen);
  const setQueueDrawerOpen = useUIStore((state) => state.setQueueDrawerOpen);

  const queue = useAudioStore((state) => state.queue);
  const queueIndex = useAudioStore((state) => state.queueIndex);
  const currentTrack = useAudioStore((state) => state.currentTrack);
  const playTrack = useAudioStore((state) => state.playTrack);
  const addToQueue = useAudioStore((state) => state.addToQueue);
  const removeFromQueue = useAudioStore((state) => state.removeFromQueue);
  const reorderQueue = useAudioStore((state) => state.reorderQueue);
  const clearQueue = useAudioStore((state) => state.clearQueue);

  const createPlaylist = useLibraryStore((state) => state.createPlaylist);
  const setActiveView = useUIStore((state) => state.setActiveView);

  const [isAddingSimilar, setIsAddingSimilar] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!isQueueDrawerOpen) return null;

  const handleSaveAsPlaylist = async () => {
    if (queue.length === 0) return;
    const pl = await createPlaylist(
      `Queue Snapshot - ${new Date().toLocaleDateString()}`,
      'Saved from current playing queue',
      queue.map((t) => t.id)
    );
    setActiveView('playlist', pl.id);
    setQueueDrawerOpen(false);
  };

  const handleAddSimilar = async () => {
    if (!currentTrack || isAddingSimilar) return;
    setIsAddingSimilar(true);
    try {
      const recs = await apiClient.getSimilarTracks(currentTrack.id, 4);
      const existingIds = new Set(queue.map((t) => t.id));
      const toAdd = recs.filter((t) => !existingIds.has(t.id));

      if (toAdd.length > 0) {
        toAdd.forEach((t) => addToQueue(t));
        setFeedback(`Added ${toAdd.length} acoustic matches`);
      } else {
        setFeedback('No new acoustic matches');
      }
      setTimeout(() => setFeedback(null), 2500);
    } catch {
      // Fallback
    } finally {
      setIsAddingSimilar(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md h-full bg-aura-card border-l border-aura-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-aura-base">
          <div className="flex items-center gap-3">
            <ListMusic className="w-5 h-5 text-aura-cyan" />
            <div>
              <h2 className="text-base font-bold text-white">Playback Queue</h2>
              <p className="text-xs text-aura-muted">{queue.length} tracks queued</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddSimilar}
              disabled={!currentTrack || isAddingSimilar}
              title="Add Harmonically Similar Tracks"
              className="p-2 rounded-xl bg-white/5 hover:bg-aura-cyan/20 text-aura-cyan hover:text-aura-cyan transition-colors disabled:opacity-40"
            >
              <Sparkles className={`w-4 h-4 ${isAddingSimilar ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleSaveAsPlaylist}
              title="Save Queue as Playlist"
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-aura-muted hover:text-white transition-colors"
            >
              <ListPlus className="w-4 h-4" />
            </button>
            <button
              onClick={clearQueue}
              title="Clear Queue"
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-aura-muted hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setQueueDrawerOpen(false)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-aura-muted hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div className="mx-4 mt-3 px-3 py-1.5 rounded-xl bg-aura-cyan/20 border border-aura-cyan/40 text-aura-cyan text-xs font-semibold text-center animate-in fade-in duration-200">
            {feedback}
          </div>
        )}

        {/* Queue Items */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
          {queue.length > 0 ? (
            queue.map((track, idx) => {
              const isCurrent = idx === queueIndex;

              return (
                <div
                  key={`${track.id}-${idx}`}
                  className={`flex items-center justify-between p-2.5 rounded-2xl transition-all ${
                    isCurrent
                      ? 'bg-aura-cyan/15 border border-aura-cyan/40 shadow-glow-cyan/20'
                      : 'hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div
                    onClick={() => playTrack(track, queue)}
                    className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                  >
                    <div className="relative w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-aura-surface">
                      <img
                        src={track.artwork}
                        alt={track.title}
                        className="w-full h-full object-cover"
                      />
                      {isCurrent && (
                        <div className="absolute inset-0 bg-aura-cyan/30 flex items-center justify-center">
                          <Music className="w-4 h-4 text-white animate-pulse" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-semibold truncate ${
                          isCurrent ? 'text-aura-cyan' : 'text-white'
                        }`}
                      >
                        {track.title}
                      </p>
                      <p className="text-xs text-aura-muted truncate">{track.artist}</p>
                    </div>
                  </div>

                  {/* Reorder and Remove controls */}
                  <div className="flex items-center gap-1">
                    {idx > 0 && (
                      <button
                        onClick={() => reorderQueue(idx, idx - 1)}
                        title="Move Up"
                        className="p-1.5 rounded-lg text-aura-muted hover:text-white hover:bg-white/10 transition-colors"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {idx < queue.length - 1 && (
                      <button
                        onClick={() => reorderQueue(idx, idx + 1)}
                        title="Move Down"
                        className="p-1.5 rounded-lg text-aura-muted hover:text-white hover:bg-white/10 transition-colors"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => removeFromQueue(idx)}
                      title="Remove"
                      className="p-1.5 rounded-lg text-aura-muted hover:text-red-400 hover:bg-white/10 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-aura-muted gap-2">
              <ListMusic className="w-10 h-10 opacity-30 text-aura-cyan" />
              <p className="text-sm">Queue is empty</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
