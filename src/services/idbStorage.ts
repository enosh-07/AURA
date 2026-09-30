import { get, set, del } from 'idb-keyval';
import { Track, Playlist, ListeningSession } from '../types/audio';

const STORAGE_KEYS = {
  LOCAL_TRACKS: 'aura_local_tracks',
  LIKED_SONGS: 'aura_liked_songs',
  PLAYLISTS: 'aura_playlists',
  HISTORY: 'aura_listening_history',
  PREFERENCES: 'aura_user_preferences',
};

export const idbService = {
  async getLocalTracks(): Promise<Track[]> {
    try {
      const tracks = await get<Track[]>(STORAGE_KEYS.LOCAL_TRACKS);
      return tracks || [];
    } catch {
      return [];
    }
  },

  async saveLocalTracks(tracks: Track[]): Promise<void> {
    await set(STORAGE_KEYS.LOCAL_TRACKS, tracks);
  },

  async getLikedSongIds(): Promise<string[]> {
    try {
      const ids = await get<string[]>(STORAGE_KEYS.LIKED_SONGS);
      return ids || [];
    } catch {
      return [];
    }
  },

  async saveLikedSongIds(ids: string[]): Promise<void> {
    await set(STORAGE_KEYS.LIKED_SONGS, ids);
  },

  async getPlaylists(): Promise<Playlist[]> {
    try {
      const playlists = await get<Playlist[]>(STORAGE_KEYS.PLAYLISTS);
      return playlists || [];
    } catch {
      return [];
    }
  },

  async savePlaylists(playlists: Playlist[]): Promise<void> {
    await set(STORAGE_KEYS.PLAYLISTS, playlists);
  },

  async getListeningHistory(): Promise<ListeningSession[]> {
    try {
      const history = await get<ListeningSession[]>(STORAGE_KEYS.HISTORY);
      return history || [];
    } catch {
      return [];
    }
  },

  async logListeningSession(session: ListeningSession): Promise<void> {
    try {
      const history = (await get<ListeningSession[]>(STORAGE_KEYS.HISTORY)) || [];
      const updated = [session, ...history].slice(0, 500); // Keep last 500 sessions
      await set(STORAGE_KEYS.HISTORY, updated);
    } catch (err) {
      console.warn('Failed to log listening session to IndexedDB:', err);
    }
  },
};
