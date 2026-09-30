import { create } from 'zustand';
import { Track, Playlist } from '../types/audio';
import { SAMPLE_TRACKS } from '../audio/sampleTracks';
import { idbService } from '../services/idbStorage';
import { parseAudioFile } from '../services/metadataParser';
import { apiClient } from '../services/apiClient';

interface LibraryStoreState {
  allTracks: Track[];
  localTracks: Track[];
  onlineTracks: Track[];
  likedSongIds: string[];
  playlists: Playlist[];
  isLoading: boolean;

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
}

const DEFAULT_PLAYLISTS: Playlist[] = [
  {
    id: 'pl-synthwave',
    title: 'Neon Nights & Cyber City',
    description: 'Analog synthesizers, retro-futuristic basslines, and high-speed nocturnal highways.',
    coverUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=800&auto=format&fit=crop&q=80',
    trackIds: ['track-1', 'track-4'],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'pl-focus',
    title: 'Deep Quantum Equilibrium',
    description: 'Sub-bass ambient drones, organic lo-fi rhythms, and non-intrusive soundscapes for extreme focus.',
    coverUrl: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=800&auto=format&fit=crop&q=80',
    trackIds: ['track-2', 'track-3', 'track-5'],
    createdAt: new Date().toISOString(),
  }
];

export const useLibraryStore = create<LibraryStoreState>((set, get) => ({
  allTracks: [...SAMPLE_TRACKS],
  localTracks: [],
  onlineTracks: [],
  likedSongIds: ['track-1', 'track-3'],
  playlists: DEFAULT_PLAYLISTS,
  isLoading: false,

  syncUserData: async () => {
    try {
      const [apiPlaylists, serverLikes] = await Promise.all([
        apiClient.getPlaylists(),
        apiClient.getLikedTrackIds(),
      ]);

      set((state) => ({
        playlists: apiPlaylists && apiPlaylists.length > 0 ? apiPlaylists : state.playlists,
        likedSongIds: serverLikes !== undefined ? serverLikes : state.likedSongIds,
      }));
    } catch (err) {
      console.warn('Failed to sync user data from DB:', err);
    }
  },

  loadInitialData: async () => {
    set({ isLoading: true });
    try {
      const [savedLocal, savedLikes, savedPlaylists, apiTracks, apiPlaylists, onlineTrending, serverLikes] = await Promise.all([
        idbService.getLocalTracks(),
        idbService.getLikedSongIds(),
        idbService.getPlaylists(),
        apiClient.getTracks(),
        apiClient.getPlaylists(),
        apiClient.getOnlineTrending('All', 30),
        apiClient.getLikedTrackIds(),
      ]);

      const localList = savedLocal || [];
      const likesList = serverLikes && serverLikes.length > 0
        ? serverLikes
        : savedLikes.length > 0
        ? savedLikes
        : ['track-1', 'track-3'];
      
      const mergedPlaylists = [
        ...(apiPlaylists.length > 0 ? apiPlaylists : DEFAULT_PLAYLISTS),
        ...(savedPlaylists.filter((sp) => !apiPlaylists.some((ap) => ap.id === sp.id))),
      ];

      const baseTracks = apiTracks.length > 0 ? apiTracks : SAMPLE_TRACKS;
      const onlineList = onlineTrending && onlineTrending.length > 0 ? onlineTrending : [];

      set({
        localTracks: localList,
        onlineTracks: onlineList,
        likedSongIds: likesList,
        playlists: mergedPlaylists,
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
          (t) => !t.id.startsWith('audius_') && !t.id.startsWith('itunes_') && !t.isOnline
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

    const { localTracks } = get();
    const updatedLocal = [...parsedTracks, ...localTracks];
    set({
      localTracks: updatedLocal,
      allTracks: [...SAMPLE_TRACKS, ...updatedLocal],
      isLoading: false,
    });

    await idbService.saveLocalTracks(updatedLocal);
  },

  removeLocalTrack: async (trackId: string) => {
    const { localTracks } = get();
    const updated = localTracks.filter((t) => t.id !== trackId);
    set({
      localTracks: updated,
      allTracks: [...SAMPLE_TRACKS, ...updated],
    });
    await idbService.saveLocalTracks(updated);
  },

  toggleLike: async (trackId: string) => {
    const { likedSongIds } = get();
    const isAlreadyLiked = likedSongIds.includes(trackId);
    const updated = isAlreadyLiked
      ? likedSongIds.filter((id) => id !== trackId)
      : [...likedSongIds, trackId];

    set({ likedSongIds: updated });
    await idbService.saveLikedSongIds(updated);
    apiClient.toggleLike(trackId, !isAlreadyLiked).catch(() => {});
  },

  isLiked: (trackId: string) => {
    return get().likedSongIds.includes(trackId);
  },

  createPlaylist: async (title: string, description = '', trackIds = [], coverUrl = '') => {
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

    try {
      const serverPlaylist = await apiClient.createPlaylist({ title, description, trackIds });
      if (serverPlaylist && serverPlaylist.id) {
        newPlaylist = {
          ...newPlaylist,
          id: serverPlaylist.id,
        };
      }
    } catch {
      // Offline fallback
    }

    const { playlists } = get();
    const updated = [newPlaylist, ...playlists];
    set({ playlists: updated });
    await idbService.savePlaylists(updated);
    return newPlaylist;
  },

  deletePlaylist: async (id: string) => {
    const { playlists } = get();
    const updated = playlists.filter((p) => p.id !== id);
    set({ playlists: updated });
    await idbService.savePlaylists(updated);
    apiClient.deletePlaylist(id).catch(() => {});
  },

  updatePlaylist: async (id: string, updates: { title?: string; description?: string }) => {
    const { playlists } = get();
    const updated = playlists.map((p) => {
      if (p.id === id) {
        return { ...p, ...updates };
      }
      return p;
    });
    set({ playlists: updated });
    await idbService.savePlaylists(updated);
    apiClient.updatePlaylist(id, updates).catch(() => {});
  },

  addTrackToPlaylist: async (playlistId: string, trackId: string) => {
    const { playlists } = get();
    const updated = playlists.map((p) => {
      if (p.id === playlistId && !p.trackIds.includes(trackId)) {
        return { ...p, trackIds: [...p.trackIds, trackId] };
      }
      return p;
    });
    set({ playlists: updated });
    await idbService.savePlaylists(updated);
    apiClient.addTrackToPlaylist(playlistId, trackId).catch(() => {});
  },

  removeTrackFromPlaylist: async (playlistId: string, trackId: string) => {
    const { playlists } = get();
    const updated = playlists.map((p) => {
      if (p.id === playlistId) {
        return { ...p, trackIds: p.trackIds.filter((id) => id !== trackId) };
      }
      return p;
    });
    set({ playlists: updated });
    await idbService.savePlaylists(updated);
    apiClient.removeTrackFromPlaylist(playlistId, trackId).catch(() => {});
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
}));
