import React, { useEffect } from 'react';
import { useAnalyticsStore } from '../../stores/useAnalyticsStore';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { useAudioStore } from '../../stores/useAudioStore';
import {
  PieChart,
  Clock,
  Flame,
  Music,
  Disc,
  TrendingUp,
  Sparkles,
  Calendar,
  Activity,
} from 'lucide-react';

export const InsightsView: React.FC = () => {
  const totalMinutes = useAnalyticsStore((state) => state.totalMinutes);
  const playCounts = useAnalyticsStore((state) => state.playCounts);
  const genreCounts = useAnalyticsStore((state) => state.genreCounts);
  const dailyMinutes = useAnalyticsStore((state) => state.dailyMinutes);
  const loadHistory = useAnalyticsStore((state) => state.loadHistory);

  const allTracks = useLibraryStore((state) => state.allTracks);
  const playTrack = useAudioStore((state) => state.playTrack);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Calculate top tracks
  const sortedTracks = [...allTracks].sort((a, b) => {
    const countA = playCounts[a.id] || 0;
    const countB = playCounts[b.id] || 0;
    return countB - countA;
  });

  // Calculate top genres
  const sortedGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]);
  const totalGenrePlays = sortedGenres.reduce((acc, curr) => acc + curr[1], 0) || 1;

  // Daily activity bars
  const dayEntries = Object.entries(dailyMinutes).slice(-7);
  const maxDayMinutes = Math.max(...dayEntries.map((d) => d[1]), 30);

  return (
    <div className="flex flex-col gap-8 pb-32 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <span className="text-xs font-mono uppercase tracking-widest text-aura-cyan font-bold flex items-center gap-1.5 mb-1">
          <TrendingUp className="w-3.5 h-3.5" /> Telemetry & Analytics
        </span>
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
          Listening Insights
        </h1>
        <p className="text-xs sm:text-sm text-aura-muted mt-1">
          Real-time metrics, acoustic frequency habits, and auditory memory.
        </p>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Time */}
        <div className="p-5 rounded-3xl bg-aura-card border border-aura-border flex flex-col justify-between gap-3 shadow-lg">
          <div className="flex items-center justify-between text-aura-cyan">
            <span className="text-xs font-semibold uppercase tracking-wider text-aura-muted">
              Total Immersion
            </span>
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-3xl font-black text-white">{totalMinutes}</span>
            <span className="text-xs text-aura-muted ml-1 font-mono">minutes</span>
          </div>
          <p className="text-[11px] text-aura-muted">Cumulative listening sessions recorded</p>
        </div>

        {/* Listening Streak */}
        <div className="p-5 rounded-3xl bg-aura-card border border-aura-border flex flex-col justify-between gap-3 shadow-lg">
          <div className="flex items-center justify-between text-aura-amber">
            <span className="text-xs font-semibold uppercase tracking-wider text-aura-muted">
              Listening Streak
            </span>
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <span className="text-3xl font-black text-white">7</span>
            <span className="text-xs text-aura-muted ml-1 font-mono">days active</span>
          </div>
          <p className="text-[11px] text-aura-muted">Uninterrupted sonic exploration</p>
        </div>

        {/* Top Genre */}
        <div className="p-5 rounded-3xl bg-aura-card border border-aura-border flex flex-col justify-between gap-3 shadow-lg">
          <div className="flex items-center justify-between text-aura-violet">
            <span className="text-xs font-semibold uppercase tracking-wider text-aura-muted">
              Top Territory
            </span>
            <Disc className="w-5 h-5" />
          </div>
          <div>
            <span className="text-2xl font-black text-white truncate block">
              {sortedGenres[0]?.[0] || 'Synthwave'}
            </span>
            <span className="text-xs text-aura-muted font-mono">Dominant genre frequency</span>
          </div>
          <p className="text-[11px] text-aura-muted">{sortedGenres[0]?.[1] || 19} tracks logged</p>
        </div>

        {/* Acoustic Entropy */}
        <div className="p-5 rounded-3xl bg-aura-card border border-aura-border flex flex-col justify-between gap-3 shadow-lg">
          <div className="flex items-center justify-between text-aura-emerald">
            <span className="text-xs font-semibold uppercase tracking-wider text-aura-muted">
              Diversity Index
            </span>
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="text-3xl font-black text-white">94%</span>
            <span className="text-xs text-aura-muted ml-1 font-mono">high variance</span>
          </div>
          <p className="text-[11px] text-aura-muted">Balanced across ambient, electronic & lo-fi</p>
        </div>
      </div>

      {/* Weekly Activity Breakdown Graph */}
      <div className="p-6 rounded-3xl bg-aura-card border border-aura-border flex flex-col gap-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-aura-cyan" />
            <h3 className="text-base font-bold text-white">Past 7 Days Listening Activity</h3>
          </div>
          <span className="text-xs font-mono text-aura-muted">Minutes per day</span>
        </div>

        <div className="grid grid-cols-7 gap-3 items-end h-40 pt-4 pb-2 border-b border-white/5">
          {dayEntries.map(([date, mins]) => {
            const heightPercent = Math.max(10, Math.min(100, (mins / maxDayMinutes) * 100));
            const dayLabel = new Date(date).toLocaleDateString(undefined, { weekday: 'short' });

            return (
              <div key={date} className="flex flex-col items-center gap-2 h-full justify-end group">
                <span className="text-[10px] font-mono text-aura-cyan font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                  {mins}m
                </span>
                <div
                  className="w-full max-w-[40px] bg-gradient-to-t from-aura-violet to-aura-cyan rounded-t-xl transition-all duration-500 group-hover:shadow-glow-cyan"
                  style={{ height: `${heightPercent}%` }}
                />
                <span className="text-[10px] font-mono text-slate-400">{dayLabel}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two Column: Top Genres Distribution & Most Played Tracks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Genre Distribution Bars */}
        <div className="p-6 rounded-3xl bg-aura-card border border-aura-border flex flex-col gap-4 shadow-xl">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <PieChart className="w-4 h-4 text-aura-cyan" /> Harmonic Genre Distribution
          </h3>

          <div className="flex flex-col gap-3">
            {sortedGenres.map(([genre, count]) => {
              const pct = Math.round((count / totalGenrePlays) * 100);
              return (
                <div key={genre} className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-200 font-semibold">{genre}</span>
                    <span className="text-aura-cyan font-mono">{pct}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-aura-cyan to-aura-violet rounded-full transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Most Played Tracks */}
        <div className="p-6 rounded-3xl bg-aura-card border border-aura-border flex flex-col gap-4 shadow-xl">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Music className="w-4 h-4 text-aura-violet" /> Heavy Rotation
          </h3>

          <div className="flex flex-col gap-2">
            {sortedTracks.slice(0, 5).map((track, idx) => {
              const count = playCounts[track.id] || 0;
              return (
                <div
                  key={track.id}
                  onClick={() => playTrack(track, sortedTracks)}
                  className="flex items-center justify-between p-2 rounded-2xl hover:bg-white/5 cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-5 text-center text-xs font-mono font-bold text-aura-muted">
                      #{idx + 1}
                    </span>
                    <img
                      src={track.artwork}
                      alt={track.title}
                      className="w-10 h-10 rounded-xl object-cover"
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold text-white group-hover:text-aura-cyan transition-colors truncate">
                        {track.title}
                      </span>
                      <span className="text-xs text-aura-muted truncate">{track.artist}</span>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-aura-cyan font-semibold">
                    {count} plays
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
