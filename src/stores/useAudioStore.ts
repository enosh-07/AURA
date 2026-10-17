import { create } from 'zustand';
import {
  Track,
  RepeatMode,
  QualityTier,
  QualityPreference,
  PlayerPresentationMode,
  FullPlayerTab,
  LyricsState,
  AudioQualityReport,
} from '../types/audio';
import { audioEngine } from '../audio/AudioEngine';
import { apiClient, API_BASE_URL } from '../services/apiClient';
import { useLibraryStore } from './useLibraryStore';
import { useUIStore } from './useUIStore';
import { mediaControls } from '../platform/mediaControls';
import {
  activateBackgroundPlayback,
  registerAppLifecycleListeners,
} from '../platform/backgroundPlayback';
import { registerDeepLinkListeners, addDeepLinkHandler } from '../platform/deepLinks';

export interface DeliveredQuality {
  codec: string;
  container: string;
  bitDepth: number | null;
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
  audioQualityReport: AudioQualityReport | null;

  // Presentation & Live Lyrics
  playerPresentationMode: PlayerPresentationMode;
  fullPlayerTab: FullPlayerTab;
  lyricsState: LyricsState;

  // Actions
  playTrack: (track: Track, newQueue?: Track[], options?: { autoOpenPlayer?: boolean }) => Promise<void> | void;
  setPlayerPresentationMode: (mode: PlayerPresentationMode) => void;
  setFullPlayerTab: (tab: FullPlayerTab) => void;
  fetchLyricsForTrack: (track: Track) => Promise<void>;
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
  setStreamingQualityPreference: (pref: QualityPreference) => Promise<void> | void;
  setBitPerfectMode: (enabled: boolean) => void;
  setActualDeliveredQuality: (quality: DeliveredQuality | null) => void;
  fetchQualityInfo: (trackId: string) => Promise<void>;
  fetchQualityReport: (trackId: string, requestedTier?: QualityPreference) => Promise<void>;
  switchToLosslessAlternative: (altTrackId: string) => Promise<void>;
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
  currentTrack: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  isMuted: false,
  playbackRate: 1.0,
  queue: [],
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
  actualDeliveredQuality: null,
  audioQualityReport: null,

  // Presentation & Live Lyrics
  playerPresentationMode: 'mini',
  fullPlayerTab: 'artwork',
  lyricsState: {
    trackId: null,
    status: 'idle',
    source: 'none',
    hasSync: false,
    isInstrumental: false,
    lines: [],
  },

  setPlayerPresentationMode: (mode) => {
    set({ playerPresentationMode: mode });
    useUIStore.getState().setFullscreenPlayerOpen(mode === 'full');
  },

  setFullPlayerTab: (tab) => {
    set({ fullPlayerTab: tab });
    useUIStore.getState().setFullPlayerTab(tab);
  },

  fetchLyricsForTrack: async (track: Track) => {
    // 1. Reset state immediately so previous track's lyrics never appear
    set({
      lyricsState: {
        trackId: track.id,
        status: 'loading',
        source: 'none',
        hasSync: false,
        isInstrumental: false,
        lines: [],
        plainLyrics: undefined,
      },
    });

    // 2. Check embedded lyrics if present on track object
    if (track.lyrics && Array.isArray(track.lyrics) && track.lyrics.length > 0) {
      set({
        lyricsState: {
          trackId: track.id,
          status: 'loaded',
          source: 'embedded',
          hasSync: true,
          isInstrumental: false,
          lines: track.lyrics,
          plainLyrics: track.plainLyrics,
        },
      });
      return;
    }

    // 3. Query backend / LRCLIB provider
    try {
      const res = await apiClient.getLyrics(track.id, {
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
      });

      // Guard against race conditions if track changed while fetching
      if (get().currentTrack?.id !== track.id) return;

      if (!res) {
        set({
          lyricsState: {
            trackId: track.id,
            status: 'not_found',
            source: 'none',
            hasSync: false,
            isInstrumental: false,
            lines: [],
            plainLyrics: track.plainLyrics,
          },
        });
        return;
      }

      if (res.isInstrumental) {
        set({
          lyricsState: {
            trackId: track.id,
            status: 'instrumental',
            source: res.source || 'lrclib',
            hasSync: false,
            isInstrumental: true,
            lines: [],
          },
        });
        return;
      }

      if (res.hasSync && Array.isArray(res.lines) && res.lines.length > 0) {
        set({
          lyricsState: {
            trackId: track.id,
            status: 'loaded',
            source: res.source || 'lrclib',
            hasSync: true,
            isInstrumental: false,
            lines: res.lines,
            plainLyrics: res.plainLyrics || track.plainLyrics,
          },
        });
      } else if (res.plainLyrics || track.plainLyrics) {
        set({
          lyricsState: {
            trackId: track.id,
            status: 'loaded',
            source: res.source || 'lrclib',
            hasSync: false,
            isInstrumental: false,
            lines: [],
            plainLyrics: res.plainLyrics || track.plainLyrics,
          },
        });
      } else {
        set({
          lyricsState: {
            trackId: track.id,
            status: 'not_found',
            source: 'none',
            hasSync: false,
            isInstrumental: false,
            lines: [],
          },
        });
      }
    } catch (err: any) {
      if (get().currentTrack?.id !== track.id) return;
      set({
        lyricsState: {
          trackId: track.id,
          status: 'error',
          source: 'none',
          hasSync: false,
          isInstrumental: false,
          lines: [],
          error: err?.message || 'Failed to load lyrics',
        },
      });
    }
  },

  playTrack: async (track: Track, newQueue?: Track[], options?: { autoOpenPlayer?: boolean }) => {
    const { queue } = get();
    const updatedQueue = newQueue || (queue.length > 0 ? queue : [track]);
    const trackIndex = updatedQueue.findIndex((t) => t.id === track.id);
    const newIndex = trackIndex !== -1 ? trackIndex : 0;
    const shouldOpen = options?.autoOpenPlayer ?? true;

    // Set playback state and optionally open Full Player
    set((state) => ({
      currentTrack: track,
      isPlaying: true,
      playerPresentationMode: shouldOpen ? 'full' : state.playerPresentationMode,
      queue: updatedQueue,
      queueIndex: newIndex,
      currentTime: 0,
      duration: track.duration,
      history: state.currentTrack ? [state.currentTrack, ...state.history.slice(0, 49)] : state.history,
    }));

    if (shouldOpen) {
      useUIStore.getState().setFullscreenPlayerOpen(true);
      useUIStore.getState().setPlayerPresentationMode('full');
    }

    // Trigger instant lyrics fetch for new track
    get().fetchLyricsForTrack(track);

    // Determine network-aware quality tier
    const pref = get().streamingQualityPreference;
    const effectiveTier = pref === 'AUTO' ? audioEngine.getOptimalQualityForNetwork() : pref;

    // Secure token exchange for protected streams if not local file blob
    let signedUrl: string | undefined;
    const isOnlineTrack = !!(track.isOnline || track.id.startsWith('saavn_') || track.id.startsWith('itunes_') || track.audioUrl.includes('/online/'));
    if (!track.fileBlob && !track.audioUrl.startsWith('blob:') && !isOnlineTrack) {
      try {
        const tokenRes = await apiClient.getStreamToken(track.id, effectiveTier);
        if (tokenRes?.streamUrl) {
          signedUrl = tokenRes.streamUrl;
        }
      } catch (err) {
        console.warn('[useAudioStore] Could not obtain signed stream token, falling back to direct stream:', err);
      }
    }

    audioEngine.playTrack(track, { signedUrl, qualityTier: effectiveTier }).catch(console.error);
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
      playTrack(next, undefined, { autoOpenPlayer: get().playerPresentationMode === 'full' });
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
      playTrack(prev, undefined, { autoOpenPlayer: get().playerPresentationMode === 'full' });
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

  setStreamingQualityPreference: async (pref: QualityPreference) => {
    set({ streamingQualityPreference: pref });
    const { currentTrack, currentTime } = get();
    if (currentTrack) {
      const effectiveTier = pref === 'AUTO' ? audioEngine.getOptimalQualityForNetwork() : pref;
      let signedUrl: string | undefined;
      const isOnlineTrack = !!(currentTrack.isOnline || currentTrack.id.startsWith('saavn_') || currentTrack.id.startsWith('itunes_') || currentTrack.audioUrl.includes('/online/'));
      if (!currentTrack.fileBlob && !currentTrack.audioUrl.startsWith('blob:') && !isOnlineTrack) {
        try {
          const tokenRes = await apiClient.getStreamToken(currentTrack.id, effectiveTier);
          if (tokenRes?.streamUrl) {
            signedUrl = tokenRes.streamUrl;
          }
        } catch (err) {
          console.warn('[useAudioStore] Failed to acquire stream token for new quality:', err);
        }
      }
      audioEngine
        .playTrack(currentTrack, { resumeTime: currentTime, signedUrl, qualityTier: effectiveTier })
        .catch(console.error);
      get().fetchQualityInfo(currentTrack.id);
      get().fetchQualityReport(currentTrack.id, pref);
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
    // Fetch both telemetry info and the comprehensive typed quality report
    get().fetchQualityReport(trackId);
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

  fetchQualityReport: async (trackId: string, requestedTier?: QualityPreference) => {
    try {
      const { streamingQualityPreference, currentTrack } = get();
      const tier = requestedTier || streamingQualityPreference || 'AUTO';
      const params = new URLSearchParams({ tier });
      if (currentTrack?.title) params.append('title', currentTrack.title);
      if (currentTrack?.artist) params.append('artist', currentTrack.artist);

      const res = await fetch(`${API_BASE_URL}/tracks/${trackId}/quality-report?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const report: AudioQualityReport = json.data;
          // Inject real client browser audio metrics
          report.playback.outputSampleRate = audioEngine.getOutputDeviceSampleRate();
          report.playback.bitPerfectBypass = audioEngine.getBitPerfectMode();
          report.playback.dspActive = audioEngine.getDSPStatus().isProcessing;

          set({
            audioQualityReport: report,
            actualDeliveredQuality: {
              codec: report.source.codec,
              container: report.source.container,
              bitDepth: report.source.bitDepth,
              sampleRate: report.source.sampleRate || 44100,
              channels: report.source.channels,
              bitrate: report.source.bitrate || 320,
              qualityTier: report.deliveredTier,
              isLossless: report.source.isLossless,
              isGenuineLossless: report.source.isLossless,
              validationNotes: report.verification.notes,
            },
          });
        }
      }
    } catch (err) {
      console.warn('[useAudioStore] Failed to fetch quality report:', err);
    }
  },

  switchToLosslessAlternative: async (altTrackId: string) => {
    const { currentTime, isPlaying } = get();
    try {
      const res = await fetch(`${API_BASE_URL}/tracks/${altTrackId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const altTrack: Track = json.data;
          // Seamless switch preserving timestamp without resetting play state
          await get().playTrack(altTrack, undefined, { autoOpenPlayer: false });
          audioEngine.seek(currentTime);
          set({ currentTime });
          if (!isPlaying) {
            audioEngine.pause();
            set({ isPlaying: false });
          }
        }
      }
    } catch (err) {
      console.warn('[useAudioStore] Failed to switch to lossless alternative:', err);
    }
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
  const codec = (headers['x-audio-codec'] || '').toUpperCase();
  if (!codec) return;

  const tier = ((headers['x-audio-quality-tier'] || 'HIGH').toUpperCase()) as QualityTier;
  const bitDepthRaw = headers['x-audio-bit-depth'];
  const isLossless = headers['x-audio-lossless'] === 'true';
  const bitDepth =
    bitDepthRaw && bitDepthRaw !== 'null' && bitDepthRaw !== '0'
      ? parseInt(bitDepthRaw, 10)
      : isLossless
      ? 16
      : null;
  const sampleRate = parseInt(headers['x-audio-sample-rate'] || '44100', 10);
  const channels = parseInt(headers['x-audio-channels'] || '2', 10);
  const bitrate = parseInt(headers['x-audio-bitrate'] || (isLossless ? '1411' : '320'), 10);

  useAudioStore.getState().setActualDeliveredQuality({
    codec,
    container: (headers['x-audio-container'] || (isLossless ? 'FLAC' : 'M4A')).toUpperCase(),
    bitDepth,
    sampleRate,
    channels,
    bitrate,
    qualityTier: tier,
    isLossless,
    isGenuineLossless: isLossless,
    validationNotes: isLossless
      ? `GENUINE ${tier}: Verified ${codec} ${bitDepth ? `${bitDepth}-bit / ` : ''}${(sampleRate / 1000).toFixed(1)} kHz`
      : `Authentic source: ${codec} ${bitrate} kbps (${(sampleRate / 1000).toFixed(1)} kHz)`,
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
