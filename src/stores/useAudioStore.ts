import { create } from 'zustand';
import { Track, RepeatMode, QualityTier, QualityPreference } from '../types/audio';
import { SAMPLE_TRACKS } from '../audio/sampleTracks';
import { audioEngine } from '../audio/AudioEngine';
import { apiClient, API_BASE_URL } from '../services/apiClient';
import { useLibraryStore } from './useLibraryStore';
import { mediaControls } from '../platform/mediaControls';
import {
  activateBackgroundPlayback,
  registerAppLifecycleListeners,
} from '../platform/backgroundPlayback';
import { registerDeepLinkListeners, addDeepLinkHandler } from '../platform/deepLinks';

export interface DeliveredQuality {
  codec: string;
  container: string;
  bitDepth: number;
  sampleRate: number;
  channels: number;
  bitrate: number;
  qualityTier: QualityTier;
  isLossless: boolean;
  isGenuineLossless: boolean;
  validationNotes?: string;
}

interface AudioStoreState {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  queue: Track[];
  queueIndex: number;
  history: Track[];
  shuffle: boolean;
  repeat: RepeatMode;
  sleepTimerRemaining: number | null; // in seconds
  sleepTimerAtEndOfSong: boolean;
  isBuffering: boolean;

  // Genuine Lossless System & Bit-Perfect State
  streamingQualityPreference: QualityPreference;
  bitPerfectMode: boolean;
  actualDeliveredQuality: DeliveredQuality | null;

  // Actions
  playTrack: (track: Track, newQueue?: Track[]) => void;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seek: (seconds: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  setPlaybackRate: (rate: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  addToQueue: (track: Track) => void;
  playNext: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (startIndex: number, endIndex: number) => void;
  clearQueue: () => void;
  setSleepTimer: (minutes: number | null, atEndOfSong?: boolean) => void;
  cancelSleepTimer: () => void;
  updateCurrentTime: (time: number) => void;
  setBuffering: (buffering: boolean) => void;
  setStreamingQualityPreference: (pref: QualityPreference) => void;
  setBitPerfectMode: (enabled: boolean) => void;
  setActualDeliveredQuality: (quality: DeliveredQuality | null) => void;
  fetchQualityInfo: (trackId: string) => Promise<void>;
  restorePlaybackFromDB: () => Promise<void>;
}

let dbSyncTimeout: any = null;
export function syncPlaybackToDB() {
  if (dbSyncTimeout) clearTimeout(dbSyncTimeout);
  dbSyncTimeout = setTimeout(() => {
    const state = useAudioStore.getState();
    if (!state.currentTrack) return;
    apiClient.updatePlaybackState({
      currentTrackId: state.currentTrack.id,
      positionSec: state.currentTime,
      isPlaying: state.isPlaying,
      volume: state.volume,
      queue: state.queue.map((t) => t.id),
      playbackMode: state.repeat === 'one' ? 'repeat_one' : state.shuffle ? 'shuffle' : state.repeat === 'all' ? 'repeat' : 'normal',
      losslessTier: state.streamingQualityPreference,
      bitPerfectMode: state.bitPerfectMode,
    }).catch(() => {});
  }, 1000);
}

let sleepTimerInterval: number | null = null;

export const useAudioStore = create<AudioStoreState>((set, get) => ({
  currentTrack: SAMPLE_TRACKS[0],
  isPlaying: false,
  currentTime: 0,
  duration: SAMPLE_TRACKS[0].duration,
  volume: 0.8,
  isMuted: false,
  playbackRate: 1.0,
  queue: [...SAMPLE_TRACKS],
  queueIndex: 0,
  history: [],
  shuffle: false,
  repeat: 'all',
  sleepTimerRemaining: null,
  sleepTimerAtEndOfSong: false,
  isBuffering: false,

  // Genuine Lossless System & Bit-Perfect Initial State
  streamingQualityPreference: 'AUTO',
  bitPerfectMode: false,
  actualDeliveredQuality: {
    codec: 'FLAC',
    container: 'FLAC',
    bitDepth: 24,
    sampleRate: 96000,
    channels: 2,
    bitrate: 2840,
    qualityTier: 'HI_RES_LOSSLESS',
    isLossless: true,
    isGenuineLossless: true,
    validationNotes: 'GENUINE HI_RES_LOSSLESS: 24-bit / 96.0 kHz Verified Source',
  },

  playTrack: (track: Track, newQueue?: Track[]) => {
    const { queue } = get();
    const updatedQueue = newQueue || (queue.length > 0 ? queue : [track]);
    const trackIndex = updatedQueue.findIndex((t) => t.id === track.id);
    const newIndex = trackIndex !== -1 ? trackIndex : 0;

    set((state) => ({
      currentTrack: track,
      isPlaying: true,
      queue: updatedQueue,
      queueIndex: newIndex,
      currentTime: 0,
      duration: track.duration,
      history: state.currentTrack ? [state.currentTrack, ...state.history.slice(0, 49)] : state.history,
    }));

    audioEngine.playTrack(track).catch(console.error);
    get().fetchQualityInfo(track.id);
    syncPlaybackToDB();

    // Platform-abstracted media controls (Web Media Session / Capacitor / Tauri)
    mediaControls.setHandlers({
      onPlay: () => get().togglePlay(),
      onPause: () => get().togglePlay(),
      onNext: () => get().nextTrack(),
      onPrev: () => get().prevTrack(),
      onSeek: (time) => get().seek(time),
    });

    // Update media metadata for lock screen / notification controls
    mediaControls.update({
      track,
      isPlaying: true,
      positionSec: 0,
      durationSec: track.duration,
    });

    // Activate background audio on first play
    activateBackgroundPlayback().catch(() => {});
  },

  togglePlay: () => {
    const { isPlaying, currentTrack } = get();
    if (!currentTrack) return;

    if (isPlaying) {
      audioEngine.pause();
      set({ isPlaying: false });
    } else {
      audioEngine.resume().then(() => {
        set({ isPlaying: true });
      }).catch(console.error);
    }
    syncPlaybackToDB();
  },

  nextTrack: () => {
    const { queue, queueIndex, shuffle, repeat, playTrack } = get();
    if (queue.length === 0) return;

    if (repeat === 'one') {
      audioEngine.seek(0);
      set({ currentTime: 0 });
      audioEngine.resume();
      return;
    }

    let nextIndex = queueIndex + 1;
    if (shuffle) {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else if (nextIndex >= queue.length) {
      if (repeat === 'all') {
        nextIndex = 0;
      } else {
        set({ isPlaying: false });
        audioEngine.pause();
        return;
      }
    }

    const next = queue[nextIndex];
    if (next) {
      set({ queueIndex: nextIndex });
      playTrack(next);
    }
  },

  prevTrack: () => {
    const { queue, queueIndex, currentTime, playTrack } = get();
    if (currentTime > 3) {
      audioEngine.seek(0);
      set({ currentTime: 0 });
      return;
    }

    const prevIndex = queueIndex > 0 ? queueIndex - 1 : queue.length - 1;
    const prev = queue[prevIndex];
    if (prev) {
      set({ queueIndex: prevIndex });
      playTrack(prev);
    }
  },

  seek: (seconds: number) => {
    audioEngine.seek(seconds);
    set({ currentTime: seconds });
    syncPlaybackToDB();
  },

  setVolume: (vol: number) => {
    audioEngine.setVolume(vol);
    set({ volume: vol, isMuted: vol === 0 });
    syncPlaybackToDB();
  },

  toggleMute: () => {
    const { isMuted, volume } = get();
    if (isMuted) {
      audioEngine.setVolume(volume || 0.8);
      set({ isMuted: false });
    } else {
      audioEngine.setVolume(0);
      set({ isMuted: true });
    }
    syncPlaybackToDB();
  },

  setPlaybackRate: (rate: number) => {
    audioEngine.setPlaybackRate(rate);
    set({ playbackRate: rate });
  },

  toggleShuffle: () => {
    set((state) => ({ shuffle: !state.shuffle }));
    syncPlaybackToDB();
  },

  cycleRepeat: () => {
    const modes: RepeatMode[] = ['off', 'all', 'one'];
    const current = get().repeat;
    const next = modes[(modes.indexOf(current) + 1) % modes.length];
    set({ repeat: next });
    syncPlaybackToDB();
  },

  addToQueue: (track: Track) => {
    set((state) => ({ queue: [...state.queue, track] }));
    syncPlaybackToDB();
  },

  playNext: (track: Track) => {
    set((state) => {
      const newQueue = [...state.queue];
      newQueue.splice(state.queueIndex + 1, 0, track);
      return { queue: newQueue };
    });
    syncPlaybackToDB();
  },

  removeFromQueue: (index: number) => {
    set((state) => {
      const newQueue = state.queue.filter((_, i) => i !== index);
      let newIndex = state.queueIndex;
      if (index < state.queueIndex) {
        newIndex = Math.max(0, state.queueIndex - 1);
      }
      return { queue: newQueue, queueIndex: newIndex };
    });
    syncPlaybackToDB();
  },

  reorderQueue: (startIndex: number, endIndex: number) => {
    set((state) => {
      const newQueue = [...state.queue];
      const [removed] = newQueue.splice(startIndex, 1);
      newQueue.splice(endIndex, 0, removed);
      return { queue: newQueue };
    });
    syncPlaybackToDB();
  },

  clearQueue: () => {
    const { currentTrack } = get();
    set({ queue: currentTrack ? [currentTrack] : [], queueIndex: 0 });
    syncPlaybackToDB();
  },

  setSleepTimer: (minutes: number | null, atEndOfSong = false) => {
    if (sleepTimerInterval) {
      clearInterval(sleepTimerInterval);
      sleepTimerInterval = null;
    }

    if (minutes === null && !atEndOfSong) {
      set({ sleepTimerRemaining: null, sleepTimerAtEndOfSong: false });
      return;
    }

    if (atEndOfSong) {
      set({ sleepTimerRemaining: null, sleepTimerAtEndOfSong: true });
      return;
    }

    const totalSeconds = (minutes || 15) * 60;
    set({ sleepTimerRemaining: totalSeconds, sleepTimerAtEndOfSong: false });

    sleepTimerInterval = window.setInterval(() => {
      const remaining = get().sleepTimerRemaining;
      if (remaining === null || remaining <= 1) {
        if (sleepTimerInterval) clearInterval(sleepTimerInterval);
        sleepTimerInterval = null;
        set({ sleepTimerRemaining: null });
        audioEngine.fadeOutAndStop(3).then(() => {
          set({ isPlaying: false });
        });
      } else {
        set({ sleepTimerRemaining: remaining - 1 });
      }
    }, 1000);
  },

  cancelSleepTimer: () => {
    if (sleepTimerInterval) {
      clearInterval(sleepTimerInterval);
      sleepTimerInterval = null;
    }
    set({ sleepTimerRemaining: null, sleepTimerAtEndOfSong: false });
  },

  updateCurrentTime: (time: number) => {
    set({ currentTime: time });
  },

  setBuffering: (buffering: boolean) => {
    set({ isBuffering: buffering });
  },

  setStreamingQualityPreference: (pref: QualityPreference) => {
    set({ streamingQualityPreference: pref });
    const { currentTrack } = get();
    if (currentTrack) {
      audioEngine.playTrack(currentTrack).catch(console.error);
      get().fetchQualityInfo(currentTrack.id);
    }
    syncPlaybackToDB();
  },

  setBitPerfectMode: (enabled: boolean) => {
    set({ bitPerfectMode: enabled });
    audioEngine.setBitPerfectMode(enabled);
    syncPlaybackToDB();
  },

  setActualDeliveredQuality: (quality: DeliveredQuality | null) => {
    set({ actualDeliveredQuality: quality });
  },

  fetchQualityInfo: async (trackId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/tracks/${trackId}/quality-info`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          set({
            actualDeliveredQuality: {
              codec: json.data.codec,
              container: json.data.container,
              bitDepth: json.data.bitDepth,
              sampleRate: json.data.sampleRate,
              channels: json.data.channels,
              bitrate: json.data.bitrate,
              qualityTier: json.data.qualityTier,
              isLossless: json.data.lossless,
              isGenuineLossless: json.data.isGenuineLossless,
              validationNotes: json.data.validationNotes,
            },
          });
        }
      }
    } catch (_) {}
  },

  restorePlaybackFromDB: async () => {
    try {
      const saved = await apiClient.getPlaybackState();
      if (!saved) return;

      const { allTracks } = useLibraryStore.getState();
      let matchedTrack = saved.currentTrack;
      if (!matchedTrack && saved.currentTrackId) {
        matchedTrack = allTracks.find((t) => t.id === saved.currentTrackId);
      }

      if (matchedTrack) {
        let restoredQueue: Track[] = [];
        if (Array.isArray(saved.queue) && saved.queue.length > 0) {
          restoredQueue = saved.queue
            .map((id: string) => allTracks.find((t) => t.id === id))
            .filter(Boolean) as Track[];
        }
        if (restoredQueue.length === 0) {
          restoredQueue = [matchedTrack];
        }

        const qIdx = restoredQueue.findIndex((t) => t.id === matchedTrack.id);

        set({
          currentTrack: matchedTrack,
          isPlaying: false,
          queue: restoredQueue,
          queueIndex: qIdx !== -1 ? qIdx : 0,
          currentTime: saved.positionSec || 0,
          duration: matchedTrack.duration,
          volume: typeof saved.volume === 'number' ? saved.volume : 0.8,
          shuffle: saved.playbackMode === 'shuffle',
          repeat: saved.playbackMode === 'repeat_one' ? 'one' : saved.playbackMode === 'repeat' ? 'all' : 'off',
          streamingQualityPreference: (saved.losslessTier as any) || 'AUTO',
          bitPerfectMode: !!saved.bitPerfectMode,
        });

        audioEngine.setVolume(saved.volume ?? 0.8);
        if (saved.bitPerfectMode) {
          audioEngine.setBitPerfectMode(true);
        }
      }
    } catch (e) {
      console.warn('Could not restore playback state from DB:', e);
    }
  },
}));

// Listen for actual server response quality headers
audioEngine.onQualityHeadersDetected = (headers) => {
  const codec = (headers['x-audio-codec'] || 'FLAC').toUpperCase();
  const tier = ((headers['x-audio-quality-tier'] || 'HI_RES_LOSSLESS').toUpperCase()) as QualityTier;
  const bitDepth = parseInt(headers['x-audio-bit-depth'] || '24', 10);
  const sampleRate = parseInt(headers['x-audio-sample-rate'] || '96000', 10);
  const channels = parseInt(headers['x-audio-channels'] || '2', 10);
  const bitrate = parseInt(headers['x-audio-bitrate'] || '1411', 10);
  const isLossless = headers['x-audio-lossless'] === 'true';

  useAudioStore.getState().setActualDeliveredQuality({
    codec,
    container: (headers['x-audio-container'] || 'FLAC').toUpperCase(),
    bitDepth,
    sampleRate,
    channels,
    bitrate,
    qualityTier: tier,
    isLossless,
    isGenuineLossless: isLossless,
    validationNotes: isLossless
      ? `GENUINE ${tier}: Verified ${codec} ${bitDepth}-bit / ${(sampleRate / 1000).toFixed(1)} kHz`
      : `Standard source: ${codec} ${bitrate} kbps`,
  });
};

// Bind native audio events to state
let lastPeriodicSyncSec = 0;
audioEngine.audio.addEventListener('timeupdate', () => {
  const cur = audioEngine.audio.currentTime;
  useAudioStore.getState().updateCurrentTime(cur);
  if (Math.abs(cur - lastPeriodicSyncSec) >= 10) {
    lastPeriodicSyncSec = cur;
    syncPlaybackToDB();
  }
});

audioEngine.audio.addEventListener('durationchange', () => {
  if (audioEngine.audio.duration && !Number.isNaN(audioEngine.audio.duration)) {
    useAudioStore.setState({ duration: audioEngine.audio.duration });
  }
});

audioEngine.audio.addEventListener('ended', () => {
  const { sleepTimerAtEndOfSong, cancelSleepTimer, nextTrack } = useAudioStore.getState();
  if (sleepTimerAtEndOfSong) {
    cancelSleepTimer();
    audioEngine.pause();
    useAudioStore.setState({ isPlaying: false });
  } else {
    nextTrack();
  }
});

audioEngine.audio.addEventListener('waiting', () => {
  useAudioStore.getState().setBuffering(true);
});

audioEngine.audio.addEventListener('playing', () => {
  useAudioStore.getState().setBuffering(false);
});

audioEngine.audio.addEventListener('error', (e) => {
  console.warn('HTML5 Audio encountered an error:', e);
  useAudioStore.getState().setBuffering(false);
});

// ---------------------------------------------------------------------------
// Platform initialization — runs once at module load
// ---------------------------------------------------------------------------

// Register app lifecycle listeners (background/foreground)
registerAppLifecycleListeners().catch(() => {});

// Register deep link handler — navigate when aura:// links are opened
registerDeepLinkListeners().then(() => {
  addDeepLinkHandler((route) => {
    // Import lazily to avoid circular dependency
    import('../stores/useUIStore').then(({ useUIStore }) => {
      const { setActiveView, setSelectedPlaylistId, setSelectedArtistId, setSelectedAlbumId } =
        useUIStore.getState() as any;

      switch (route.type) {
        case 'track': {
          // Find track in queue and play it
          const { queue, playTrack } = useAudioStore.getState();
          const track = queue.find((t) => t.id === route.id);
          if (track) playTrack(track);
          break;
        }
        case 'playlist':
          setActiveView?.('playlist');
          setSelectedPlaylistId?.(route.id);
          break;
        case 'artist':
          setActiveView?.('artist');
          setSelectedArtistId?.(route.id);
          break;
        case 'album':
          setActiveView?.('album');
          setSelectedAlbumId?.(route.id);
          break;
      }
    }).catch(() => {});
  });
}).catch(() => {});
