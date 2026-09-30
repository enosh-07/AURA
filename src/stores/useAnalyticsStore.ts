import { create } from 'zustand';
import { Track } from '../types/audio';
import { idbService } from '../services/idbStorage';
import { apiClient } from '../services/apiClient';

interface AnalyticsState {
  totalMinutes: number;
  playCounts: Record<string, number>;
  genreCounts: Record<string, number>;
  dailyMinutes: Record<string, number>; // YYYY-MM-DD -> minutes

  recordPlay: (track: Track, listenedSeconds: number) => void;
  loadHistory: () => Promise<void>;
}

export const useAnalyticsStore = create<AnalyticsState>((set, get) => ({
  totalMinutes: 142, // seeded with baseline listening
  playCounts: {
    'track-1': 14,
    'track-2': 19,
    'track-3': 8,
    'track-4': 11,
  },
  genreCounts: {
    'Lo-Fi': 19,
    'Synthwave': 14,
    'Electronic': 11,
    'Ambient': 8,
  },
  dailyMinutes: {
    '2026-09-14': 24,
    '2026-09-15': 35,
    '2026-09-16': 18,
    '2026-09-17': 42,
    '2026-09-18': 50,
    '2026-09-19': 38,
    '2026-09-20': 15,
  },

  loadHistory: async () => {
    try {
      const insights = await apiClient.getInsights();
      if (insights) {
        const dMinutes: Record<string, number> = { ...get().dailyMinutes };
        insights.dailyActivity?.forEach((da: any) => {
          dMinutes[da.date] = da.minutes;
        });

        const pCounts: Record<string, number> = { ...get().playCounts };
        insights.topTracks?.forEach((tt: any) => {
          pCounts[tt.trackId] = tt.playCount;
        });

        const gCounts: Record<string, number> = { ...get().genreCounts };
        insights.topGenres?.forEach((tg: any) => {
          gCounts[tg.genre] = tg.playCount;
        });

        set({
          totalMinutes: insights.totalMinutes || get().totalMinutes,
          playCounts: pCounts,
          genreCounts: gCounts,
          dailyMinutes: dMinutes,
        });
        return;
      }

      const sessions = await idbService.getListeningHistory();
      if (sessions && sessions.length > 0) {
        let minutes = 0;
        const pCounts: Record<string, number> = {};
        const dMinutes: Record<string, number> = { ...get().dailyMinutes };

        sessions.forEach((s) => {
          const m = Math.round(s.durationListened / 60);
          minutes += m;
          pCounts[s.trackId] = (pCounts[s.trackId] || 0) + 1;
          const dateStr = new Date(s.timestamp).toISOString().slice(0, 10);
          dMinutes[dateStr] = (dMinutes[dateStr] || 0) + m;
        });

        set((state) => ({
          totalMinutes: state.totalMinutes + minutes,
          playCounts: { ...state.playCounts, ...pCounts },
          dailyMinutes: dMinutes,
        }));
      }
    } catch {
      // Safe fallback
    }
  },

  recordPlay: (track: Track, listenedSeconds: number) => {
    if (listenedSeconds < 5) return;
    const minutes = Math.max(1, Math.round(listenedSeconds / 60));
    const today = new Date().toISOString().slice(0, 10);

    set((state) => {
      const newPlayCounts = {
        ...state.playCounts,
        [track.id]: (state.playCounts[track.id] || 0) + 1,
      };
      const newGenreCounts = {
        ...state.genreCounts,
        [track.genre]: (state.genreCounts[track.genre] || 0) + 1,
      };
      const newDaily = {
        ...state.dailyMinutes,
        [today]: (state.dailyMinutes[today] || 0) + minutes,
      };

      return {
        totalMinutes: state.totalMinutes + minutes,
        playCounts: newPlayCounts,
        genreCounts: newGenreCounts,
        dailyMinutes: newDaily,
      };
    });

    apiClient.logPlayback(track.id, listenedSeconds, listenedSeconds >= track.duration * 0.8);

    idbService.logListeningSession({
      trackId: track.id,
      timestamp: Date.now(),
      durationListened: listenedSeconds,
      completed: listenedSeconds >= track.duration * 0.8,
    });
  },
}));
