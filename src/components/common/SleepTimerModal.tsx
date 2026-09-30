import React from 'react';
import { useAudioStore } from '../../stores/useAudioStore';
import { useUIStore } from '../../stores/useUIStore';
import { Moon, X, Clock, CheckCircle2 } from 'lucide-react';

export const SleepTimerModal: React.FC = () => {
  const isSleepTimerOpen = useUIStore((state) => state.isSleepTimerOpen);
  const setSleepTimerOpen = useUIStore((state) => state.setSleepTimerOpen);

  const sleepTimerRemaining = useAudioStore((state) => state.sleepTimerRemaining);
  const sleepTimerAtEndOfSong = useAudioStore((state) => state.sleepTimerAtEndOfSong);
  const setSleepTimer = useAudioStore((state) => state.setSleepTimer);
  const cancelSleepTimer = useAudioStore((state) => state.cancelSleepTimer);

  if (!isSleepTimerOpen) return null;

  const timerOptions = [5, 10, 15, 30, 45, 60];

  const formatRemaining = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md bg-aura-card border border-aura-border rounded-3xl p-6 shadow-2xl flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-aura-violet/20 border border-aura-violet/30 flex items-center justify-center text-aura-violet">
              <Moon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Sleep Timer</h2>
              <p className="text-xs text-aura-muted">Gradual volume fade-out before standby</p>
            </div>
          </div>
          <button
            onClick={() => setSleepTimerOpen(false)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-aura-muted hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active Timer Indicator */}
        {(sleepTimerRemaining !== null || sleepTimerAtEndOfSong) && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-aura-violet/20 to-aura-cyan/20 border border-aura-violet/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-aura-cyan animate-pulse" />
              <div>
                <p className="text-xs font-semibold text-white">
                  {sleepTimerAtEndOfSong ? 'Stopping at end of track' : 'Timer Active'}
                </p>
                {sleepTimerRemaining !== null && (
                  <p className="text-xl font-mono font-bold text-aura-cyan">
                    {formatRemaining(sleepTimerRemaining)}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={cancelSleepTimer}
              className="text-xs px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Duration Options */}
        <div className="grid grid-cols-3 gap-2.5">
          {timerOptions.map((mins) => (
            <button
              key={mins}
              onClick={() => {
                setSleepTimer(mins);
                setSleepTimerOpen(false);
              }}
              className="py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-aura-violet/40 text-sm font-semibold text-slate-200 hover:text-white flex flex-col items-center gap-1 transition-all"
            >
              <span>{mins}</span>
              <span className="text-[10px] text-aura-muted font-normal">minutes</span>
            </button>
          ))}
        </div>

        {/* End of Current Track Option */}
        <button
          onClick={() => {
            setSleepTimer(null, true);
            setSleepTimerOpen(false);
          }}
          className={`w-full py-3.5 px-4 rounded-xl border transition-all flex items-center justify-between text-sm font-semibold ${
            sleepTimerAtEndOfSong
              ? 'bg-aura-violet/20 border-aura-violet/50 text-aura-violet'
              : 'bg-white/5 hover:bg-white/10 border-white/5 text-slate-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Moon className="w-4 h-4" />
            <span>End of current track</span>
          </div>
          {sleepTimerAtEndOfSong && <CheckCircle2 className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};
