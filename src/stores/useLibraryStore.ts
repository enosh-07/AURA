import { create } from 'zustand';
import { Track, Playlist } from '../types/audio';
import { idbService } from '../services/idbStorage';
import { parseAudioFile } from '../services/metadataParser';
import { apiClient } from '../services/apiClient';
import { realtimeSync } from '../services/realtimeSync';
import { useAuthStore } from './useAuthStore';

interface LibraryStoreState {
  allTracks: Track[];
  localTracks: Track[];
  onlineTracks: Track[];
  likedSongIds: string[];
  playlists: Playlist[];
  isLoading: boolean;
  isSaving: boolean;

  // Actions
  loadInitialData: () => Promise<void>;
  fetchOnlineTrending: (genre?: string) => Promise<Track[]>;
  importLocalFiles: (files: FileList | File[]) => Promise<void>;
  removeLocalTrack: (trackId: string) => Promise<void>;
  toggleLike: (trackId: string) => Promise<void>;
  isLiked: (trackId: string) => boolean;
  createPlaylist: (title: string, description?: string, trackIds?: string[], coverUrl?: string) => Promise<Playlist>;
  deletePlaylist: (id: string) => Promise<void>;
  updatePlaylist: (id: string, updates: { title?: string; description?: string }) => Promise<void>;
  addTrackToPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  uploadTrackToCloud: (trackId: string) => Promise<Track | null>;
  syncUserData: () => Promise<void>;
  resetToGuestLibrary: () => Promise<void>;
  migrateGuestDataToServer: () => Promise<{
    migratedLikes: number;
    migratedPlaylists: number;
    success: boolean;
  }>;
}

export const useLibraryStore = create<LibraryStoreState>((set, get) => ({
  allTracks: [],
  localTracks: [],
  onlineTracks: [],
  likedSongIds: [],
  playlists: [],
  isLoading: false,
  isSaving: false,

  syncUserData: async () => {
    const isAuth = useAuthStore.getState().isAuthenticated;
    if (!isAuth) {
      await get().resetToGuestLibrary();
      return;
    }

    try {
      const [apiPlaylists, serverLikes] = await Promise.all([
        apiClient.getPlaylists(),
        apiClient.getLikedTrackIds(),
      ]);

      set((state) => ({
        playlists: apiPlaylists && Array.isArray(apiPlaylists) ? apiPlaylists : state.playlists,
        likedSongIds: serverLikes && Array.isArray(serverLikes) ? serverLikes : state.likedSongIds,
      }));
    } catch (err) {
      console.warn('Failed to sync user data from DB:', err);
    }
  },

  resetToGuestLibrary: async () => {
    try {
      const guestLikes = await idbService.getGuestLikedSongIds();
      const guestPlaylists = await idbService.getGuestPlaylists();
      set({
        likedSongIds: guestLikes || [],
        playlists: guestPlaylists || [],
      });
    } catch (err) {
      console.warn('Failed to reset to guest library:', err);
      set({ likedSongIds: [], playlists: [] });
    }
  },

  loadInitialData: async () => {
    set({ isLoading: true });
    try {
      const isAuth = useAuthStore.getState().isAuthenticated;
      const [savedLocal, guestLikes, guestPlaylists, apiTracks, onlineTrending] = await Promise.all([
        idbService.getLocalTracks(),
        idbService.getGuestLikedSongIds(),
        idbService.getGuestPlaylists(),
        apiClient.getTracks(),
        apiClient.getOnlineTrending('All', 30),
      ]);

      let userPlaylists = guestPlaylists || [];
      let userLikes = guestLikes || [];

      if (isAuth) {
        try {
          const [serverPlaylists, serverLikes] = await Promise.all([
            apiClient.getPlaylists(),
            apiClient.getLikedTrackIds(),
          ]);
          if (serverPlaylists && Array.isArray(serverPlaylists)) userPlaylists = serverPlaylists;
          if (serverLikes && Array.isArray(serverLikes)) userLikes = serverLikes;
        } catch (e) {
          console.warn('Could not load user data during initial load:', e);
        }
      }

      const localList = savedLocal || [];
      const baseTracks = apiTracks || [];
      const onlineList = onlineTrending && onlineTrending.length > 0 ? onlineTrending : [];

      set({
        localTracks: localList,
        onlineTracks: onlineList,
        likedSongIds: userLikes,
        playlists: userPlaylists,
        allTracks: [...baseTracks, ...onlineList, ...localList],
        isLoading: false,
      });
    } catch (err) {
      console.warn('Could not load library data from API/IndexedDB:', err);
      set({ isLoading: false });
    }
  },

  fetchOnlineTrending: async (languageOrGenre = 'All') => {
    try {
      const tracks = await apiClient.getOnlineTrending(languageOrGenre, 30);
      if (tracks && tracks.length > 0) {
        const { allTracks } = get();
        const nonOnline = allTracks.filter(
          (t) => !t.id.startsWith('audius_') && !t.id.startsWith('itunes_') && !t.id.startsWith('saavn_') && !t.isOnline
        );
        set({
          onlineTracks: tracks,
          allTracks: [...nonOnline, ...tracks],
        });
        return tracks;
      }
    } catch (err) {
      console.warn('Failed to fetch online trending for:', languageOrGenre, err);
    }
    return get().onlineTracks;
  },

  importLocalFiles: async (files: FileList | File[]) => {
    set({ isLoading: true });
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter((f) =>
      f.type.startsWith('audio/') || /\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(f.name)
    );

    const parsedTracks: Track[] = [];
    for (const file of validFiles) {
      try {
        const track = await parseAudioFile(file);
        parsedTracks.push(track);
      } catch (err) {
        console.warn('Failed to parse audio file:', file.name, err);
      }
    }

    const { localTracks, allTracks } = get();
    const updatedLocal = [...parsedTracks, ...localTracks];
    const nonLocalTracks = allTracks.filter((t) => !t.isLocal);
    set({
      localTracks: updatedLocal,
      allTracks: [...nonLocalTracks, ...updatedLocal],
      isLoading: false,
    });

    await idbService.saveLocalTracks(updatedLocal);
  },

  removeLocalTrack: async (trackId: string) => {
    const { localTracks, allTracks } = get();
    const updated = localTracks.filter((t) => t.id !== trackId);
    set({
      localTracks: updated,
      allTracks: allTracks.filter((t) => t.id !== trackId),
    });
    await idbService.saveLocalTracks(updated);
  },

  toggleLike: async (trackId: string) => {
    const { likedSongIds, allTracks } = get();
    const isAlreadyLiked = likedSongIds.includes(trackId);
    const updated = isAlreadyLiked
      ? likedSongIds.filter((id) => id !== trackId)
      : [...likedSongIds, trackId];

    // Optimistic UI update
    set({ likedSongIds: updated });

    const isAuth = useAuthStore.getState().isAuthenticated;
    if (isAuth) {
      set({ isSaving: true });
      const track = allTracks.find((t) => t.id === trackId);
      try {
        const ok = await apiClient.toggleLike(
          trackId,
          !isAlreadyLiked,
          track
            ? {
                title: track.title,
                artist: track.artist,
                artworkUrl: track.artworkUrl || track.artwork,
                streamUrl: track.streamUrl || track.audioUrl,
                duration: track.duration,
                genre: track.genre,
                isOnline: track.isOnline,
              }
            : undefined
        );
        if (!ok) {
          throw new Error('Server rejected like update');
        }
        // Broadcast across tabs/devices
        realtimeSync.broadcast('LIKE_MUTATION', { trackId, liked: !isAlreadyLiked });
      } catch (err) {
        console.warn('Failed to sync like with server, rolling back:', err);
        // Rollback optimistic update
        set({ likedSongIds });
      } finally {
        set({ isSaving: false });
      }
    } else {
      // Guest isolation in IndexedDB
      await idbService.saveGuestLikedSongIds(updated);
    }
  },

  isLiked: (trackId: string) => {
    return get().likedSongIds.includes(trackId);
  },

  createPlaylist: async (title: string, description = '', trackIds = [], coverUrl = '') => {
    const isAuth = useAuthStore.getState().isAuthenticated;
    let newPlaylist: Playlist = {
      id: `pl-${Date.now()}`,
      title,
      description,
      trackIds,
      createdAt: new Date().toISOString(),
      coverUrl:
        coverUrl ||
        'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80',
      isCustom: true,
    };

    if (isAuth) {
      try {
        set({ isSaving: true });
        const serverPlaylist = await apiClient.createPlaylist({ title, description, trackIds });
        if (serverPlaylist && serverPlaylist.id) {
          newPlaylist = {
            ...newPlaylist,
            id: serverPlaylist.id,
          };
        }
        realtimeSync.broadcast('PLAYLIST_MUTATION', { action: 'create', playlistId: newPlaylist.id });
      } catch (err) {
        console.warn('Failed to persist playlist to server:', err);
      } finally {
        set({ isSaving: false });
      }
    }

    const { playlists } = get();
    const updated = [newPlaylist, ...playlists];
    set({ playlists: updated });

    if (!isAuth) {
      await idbService.saveGuestPlaylists(updated);
    }
    return newPlaylist;
  },

  deletePlaylist: async (id: string) => {
    const { playlists } = get();
    const isAuth = useAuthStore.getState().isAuthenticated;
    const updated = playlists.filter((p) => p.id !== id);
    set({ playlists: updated });

    if (isAuth) {
      try {
        await apiClient.deletePlaylist(id);
        realtimeSync.broadcast('PLAYLIST_MUTATION', { action: 'delete', playlistId: id });
      } catch (err) {
        console.warn('Failed to delete playlist on server:', err);
      }
    } else {
      await idbService.saveGuestPlaylists(updated);
    }
  },

  updatePlaylist: async (id: string, updates: { title?: string; description?: string }) => {
    const { playlists } = get();
    const isAuth = useAuthStore.getState().isAuthenticated;
    const updated = playlists.map((p) => {
      if (p.id === id) {
        return { ...p, ...updates };
      }
      return p;
    });
    set({ playlists: updated });

    if (isAuth) {
      try {
        await apiClient.updatePlaylist(id, updates);
        realtimeSync.broadcast('PLAYLIST_MUTATION', { action: 'update', playlistId: id });
      } catch (err) {
        console.warn('Failed to update playlist on server:', err);
      }
    } else {
      await idbService.saveGuestPlaylists(updated);
    }
  },

  addTrackToPlaylist: async (playlistId: string, trackId: string) => {
    const { playlists, allTracks } = get();
    const isAuth = useAuthStore.getState().isAuthenticated;
    const updated = playlists.map((p) => {
      if (p.id === playlistId && !p.trackIds.includes(trackId)) {
        return { ...p, trackIds: [...p.trackIds, trackId] };
      }
      return p;
    });
    set({ playlists: updated });

    if (isAuth) {
      try {
        const track = allTracks.find((t) => t.id === trackId);
        await apiClient.addTrackToPlaylist(
          playlistId,
          trackId,
          track
            ? {
                title: track.title,
                artist: track.artist,
                artworkUrl: track.artworkUrl || track.artwork,
                streamUrl: track.streamUrl || track.audioUrl,
                duration: track.duration,
                genre: track.genre,
                isOnline: track.isOnline,
              }
            : undefined
        );
        realtimeSync.broadcast('PLAYLIST_MUTATION', { action: 'add_track', playlistId, trackId });
      } catch (err) {
        console.warn('Failed to add track to playlist on server:', err);
      }
    } else {
      await idbService.saveGuestPlaylists(updated);
    }
  },

  removeTrackFromPlaylist: async (playlistId: string, trackId: string) => {
    const { playlists } = get();
    const isAuth = useAuthStore.getState().isAuthenticated;
    const updated = playlists.map((p) => {
      if (p.id === playlistId) {
        return { ...p, trackIds: p.trackIds.filter((id) => id !== trackId) };
      }
      return p;
    });
    set({ playlists: updated });

    if (isAuth) {
      try {
        await apiClient.removeTrackFromPlaylist(playlistId, trackId);
        realtimeSync.broadcast('PLAYLIST_MUTATION', { action: 'remove_track', playlistId, trackId });
      } catch (err) {
        console.warn('Failed to remove track from playlist on server:', err);
      }
    } else {
      await idbService.saveGuestPlaylists(updated);
    }
  },

  uploadTrackToCloud: async (trackId: string) => {
    const { localTracks, allTracks } = get();
    const track = localTracks.find((t) => t.id === trackId);
    if (!track || !track.fileBlob) return null;

    const file =
      track.fileBlob instanceof File
        ? track.fileBlob
        : new File([track.fileBlob], `${track.title}.wav`, { type: track.fileBlob.type || 'audio/wav' });

    const uploaded = await apiClient.uploadTrack(file, {
      title: track.title,
      artist: track.artist,
      duration: track.duration,
      genre: track.genre,
    });

    if (uploaded) {
      set({
        allTracks: [uploaded, ...allTracks.filter((t) => t.id !== track.id)],
      });
      return uploaded;
    }
    return null;
  },

  migrateGuestDataToServer: async () => {
    const guestLikes = await idbService.getGuestLikedSongIds();
    const guestPlaylists = await idbService.getGuestPlaylists();
    const { likedSongIds, playlists, allTracks } = get();

    let migratedLikes = 0;
    let migratedPlaylists = 0;

    try {
      // 1. Deduplicate & migrate likes
      const likesToMigrate = guestLikes.filter((id: string) => !likedSongIds.includes(id));
      for (const trackId of likesToMigrate) {
        const track = allTracks.find((t) => t.id === trackId);
        const ok = await apiClient.toggleLike(
          trackId,
          true,
          track
            ? {
                title: track.title,
                artist: track.artist,
                artworkUrl: track.artworkUrl || track.artwork,
                streamUrl: track.streamUrl || track.audioUrl,
                duration: track.duration,
                genre: track.genre,
                isOnline: track.isOnline,
              }
            : undefined
        );
        if (ok) migratedLikes++;
      }

      // 2. Deduplicate & migrate playlists
      for (const pl of guestPlaylists) {
        const existing = playlists.find(
          (p) => p.title.toLowerCase().trim() === pl.title.toLowerCase().trim()
        );
        if (!existing) {
          const created = await apiClient.createPlaylist({
            title: pl.title,
            description: pl.description,
            trackIds: pl.trackIds,
          });
          if (created) migratedPlaylists++;
        }
      }

      // 3. Clear guest data ONLY after successful server migration
      await idbService.clearAllGuestData();

      // 4. Refresh authoritative library from server
      await get().syncUserData();

      return {
        migratedLikes,
        migratedPlaylists,
        success: true,
      };
    } catch (err) {
      console.error('Failed to migrate guest data to server:', err);
      // Attempt partial sync
      await get().syncUserData().catch(() => {});
      return {
        migratedLikes,
        migratedPlaylists,
        success: false,
      };
    }
  },
}));
