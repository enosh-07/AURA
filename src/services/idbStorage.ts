import { get, set, del } from 'idb-keyval';
import { Track, Playlist, ListeningSession } from '../types/audio';

const STORAGE_KEYS = {
  LOCAL_TRACKS: 'aura_local_tracks',
  GUEST_LIKED_SONGS: 'aura_guest_liked_songs',
  GUEST_PLAYLISTS: 'aura_guest_playlists',
  LEGACY_LIKED_SONGS: 'aura_liked_songs',
  LEGACY_PLAYLISTS: 'aura_playlists',
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

  /**
   * Retrieves guest liked song IDs (with fallback to legacy key if migrating)
   */
  async getLikedSongIds(): Promise<string[]> {
    try {
      const guestIds = await get<string[]>(STORAGE_KEYS.GUEST_LIKED_SONGS);
      if (guestIds && guestIds.length > 0) return guestIds;
      const legacyIds = await get<string[]>(STORAGE_KEYS.LEGACY_LIKED_SONGS);
      return legacyIds || [];
    } catch {
      return [];
    }
  },

  async saveLikedSongIds(ids: string[]): Promise<void> {
    await set(STORAGE_KEYS.GUEST_LIKED_SONGS, ids);
  },

  async getGuestLikedSongIds(): Promise<string[]> {
    return this.getLikedSongIds();
  },

  async saveGuestLikedSongIds(ids: string[]): Promise<void> {
    return this.saveLikedSongIds(ids);
  },

  async clearGuestLikedSongIds(): Promise<void> {
    await Promise.all([
      del(STORAGE_KEYS.GUEST_LIKED_SONGS),
      del(STORAGE_KEYS.LEGACY_LIKED_SONGS),
    ]);
  },

  /**
   * Retrieves guest playlists (with fallback to legacy key)
   */
  async getPlaylists(): Promise<Playlist[]> {
    try {
      const guestPlaylists = await get<Playlist[]>(STORAGE_KEYS.GUEST_PLAYLISTS);
      if (guestPlaylists && guestPlaylists.length > 0) return guestPlaylists;
      const legacyPlaylists = await get<Playlist[]>(STORAGE_KEYS.LEGACY_PLAYLISTS);
      return legacyPlaylists || [];
    } catch {
      return [];
    }
  },

  async savePlaylists(playlists: Playlist[]): Promise<void> {
    await set(STORAGE_KEYS.GUEST_PLAYLISTS, playlists);
  },

  async getGuestPlaylists(): Promise<Playlist[]> {
    return this.getPlaylists();
  },

  async saveGuestPlaylists(playlists: Playlist[]): Promise<void> {
    return this.savePlaylists(playlists);
  },

  async clearGuestPlaylists(): Promise<void> {
    await Promise.all([
      del(STORAGE_KEYS.GUEST_PLAYLISTS),
      del(STORAGE_KEYS.LEGACY_PLAYLISTS),
    ]);
  },

  /**
   * Checks if unauthenticated guest data exists that can be migrated
   */
  async hasGuestData(): Promise<boolean> {
    const [likes, playlists] = await Promise.all([
      this.getLikedSongIds(),
      this.getPlaylists(),
    ]);
    return (likes && likes.length > 0) || (playlists && playlists.length > 0);
  },

  async clearAllGuestData(): Promise<void> {
    await Promise.all([
      this.clearGuestLikedSongIds(),
      this.clearGuestPlaylists(),
    ]);
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
