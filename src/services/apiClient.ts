import { Track, Playlist, Artist, Album } from '../types/audio';
import { SAMPLE_TRACKS } from '../audio/sampleTracks';

/**
 * API base URL — configure via VITE_API_BASE_URL environment variable.
 *
 * Development:  http://localhost:4000/api/v1  (default)
 * Production:   https://api.aura.example.com/api/v1
 * Mobile:       Must be an HTTPS endpoint (not localhost)
 *
 * Set VITE_API_BASE_URL in .env or platform-specific .env files.
 */
const getDefaultApiBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('aura_api_base_url');
    if (custom) return custom;
    const hostname = window.location.hostname;
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1' && !hostname.includes('tauri')) {
      return `http://${hostname}:4000/api/v1`;
    }
  }
  return (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:4000/api/v1';
};

export const API_BASE_URL: string = getDefaultApiBaseUrl();
export const API_HOST: string = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

export class ApiClient {
  private token: string | null = null;
  private isOnline = false;

  constructor() {
    this.token = localStorage.getItem('aura_auth_token');
    this.checkHealth();
  }

  public async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE_URL}/health`, { signal: AbortSignal.timeout(1500) });
      this.isOnline = res.ok;
      return res.ok;
    } catch {
      this.isOnline = false;
      return false;
    }
  }

  public setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('aura_auth_token', token);
    } else {
      localStorage.removeItem('aura_auth_token');
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  // Tracks
  public async getTracks(params?: { q?: string; genre?: string; mood?: string }): Promise<Track[]> {
    try {
      const query = new URLSearchParams();
      if (params?.q) query.set('q', params.q);
      if (params?.genre) query.set('genre', params.genre);
      if (params?.mood) query.set('mood', params.mood);

      const res = await fetch(`${API_BASE_URL}/tracks?${query.toString()}`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(2500),
      });

      if (!res.ok) throw new Error('API request failed');
      const json = await res.json();

      if (json.success && Array.isArray(json.data)) {
        return json.data.map((t: any) => ({
          ...t,
          audioUrl: t.audioUrl?.startsWith('http') ? t.audioUrl : `${API_HOST}${t.audioUrl}`,
          artwork: t.artworkUrl || t.artwork,
        }));
      }
      return SAMPLE_TRACKS;
    } catch {
      // Fallback seamlessly to sample tracks
      return SAMPLE_TRACKS;
    }
  }

  public async getLyrics(trackId: string): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/tracks/${trackId}/lyrics`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) throw new Error('Lyrics fetch failed');
      const json = await res.json();
      return json.data;
    } catch {
      return null;
    }
  }

  public async toggleLike(trackId: string, like: boolean): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE_URL}/tracks/${trackId}/like`, {
        method: like ? 'POST' : 'DELETE',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(2000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // Playlists
  public async getPlaylists(): Promise<Playlist[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/playlists`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) throw new Error('Playlists fetch failed');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        return json.data.map((p: any) => ({
          id: p.id,
          title: p.title,
          description: p.description || '',
          coverUrl: p.coverUrl,
          trackIds: p.tracks?.map((t: any) => t.id) || [],
          createdAt: p.createdAt,
          isCustom: !p.isPublic,
        }));
      }
      return [];
    } catch {
      return [];
    }
  }

  public async createPlaylist(data: { title: string; description?: string; trackIds?: string[] }): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/playlists`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const json = await res.json();
        return json.data;
      }
    } catch {
      // Ignore
    }
    return null;
  }

  public async updatePlaylist(id: string, data: { title?: string; description?: string; isPublic?: boolean }): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/playlists/${id}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const json = await res.json();
        return json.data;
      }
    } catch {
      // Ignore
    }
    return null;
  }

  public async deletePlaylist(id: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE_URL}/playlists/${id}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async addTrackToPlaylist(playlistId: string, trackId: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE_URL}/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ trackId }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE_URL}/playlists/${playlistId}/tracks/${trackId}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // Analytics
  public async logPlayback(trackId: string, durationListened: number, completed = false): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/analytics/listen`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ trackId, durationListened, completed }),
        signal: AbortSignal.timeout(2000),
      });
    } catch {
      // Ignore
    }
  }

  public async getInsights(): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/analytics/insights`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) throw new Error('Insights fetch failed');
      const json = await res.json();
      return json.data;
    } catch {
      return null;
    }
  }

  // AI Curation
  public async curateAI(prompt: string, currentTrackId?: string, userMood?: string): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/ai/curate`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ prompt, currentTrackId, userMood }),
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const json = await res.json();
        return json.data;
      }
    } catch {
      // Handled by client-side fallback
    }
    return null;
  }

  // Auth & Identity
  public async login(email: string, password: string): Promise<{ user: any; accessToken: string }> {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || 'Login failed');
    }
    this.setToken(json.data.accessToken);
    return json.data;
  }

  public async register(name: string, email: string, password: string): Promise<{ user: any; accessToken: string }> {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || 'Registration failed');
    }
    this.setToken(json.data.accessToken);
    return json.data;
  }

  public async googleLogin(payload: {
    credential?: string;
    idToken?: string;
    accessToken?: string;
    googleId?: string;
    email?: string;
    name?: string;
    avatarUrl?: string;
  }): Promise<{ user: any; accessToken: string }> {
    const res = await fetch(`${API_BASE_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || 'Google authentication failed');
    }
    this.setToken(json.data.accessToken);
    return json.data;
  }

  public async getLikedTrackIds(): Promise<string[]> {
    if (!this.token) return [];
    try {
      const res = await fetch(`${API_BASE_URL}/tracks/me/likes`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return [];
      const json = await res.json();
      return json.success && Array.isArray(json.data) ? json.data : [];
    } catch {
      return [];
    }
  }

  public async getPlaybackState(): Promise<any> {
    if (!this.token) return null;
    try {
      const res = await fetch(`${API_BASE_URL}/devices/state`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.success ? json.data : null;
    } catch {
      return null;
    }
  }

  public async updatePlaybackState(state: {
    currentTrackId?: string | null;
    positionSec?: number;
    isPlaying?: boolean;
    volume?: number;
    queue?: string[];
    playbackMode?: string;
    losslessTier?: string;
    bitPerfectMode?: boolean;
    deviceId?: string;
  }): Promise<any> {
    if (!this.token) return null;
    try {
      const res = await fetch(`${API_BASE_URL}/devices/state`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(state),
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.success ? json.data : null;
    } catch {
      return null;
    }
  }

  public async getMe(): Promise<any> {
    if (!this.token) return null;
    try {
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) {
        if (res.status === 401) {
          this.setToken(null);
        }
        return null;
      }
      const json = await res.json();
      return json.data;
    } catch {
      return null;
    }
  }

  public async updatePreferences(preferences: Record<string, any>): Promise<any> {
    if (!this.token) return null;
    try {
      const res = await fetch(`${API_BASE_URL}/auth/preferences`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(preferences),
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.data;
    } catch {
      return null;
    }
  }

  // EQ Presets
  public async getEQPresets(): Promise<{ system: any[]; user: any[] }> {
    try {
      const res = await fetch(`${API_BASE_URL}/settings/eq-presets`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) return { system: [], user: [] };
      const json = await res.json();
      return json.data || { system: [], user: [] };
    } catch {
      return { system: [], user: [] };
    }
  }

  public async saveEQPreset(preset: {
    name: string;
    bands: number[];
    bassBoost?: number;
    treble?: number;
    stereoPan?: number;
    reverbLevel?: number;
  }): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/settings/eq-presets`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(preset),
      });
      if (res.ok) {
        const json = await res.json();
        return json.data;
      }
    } catch {
      // Ignore
    }
    return null;
  }

  public async deleteEQPreset(id: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE_URL}/settings/eq-presets/${id}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // Social Rooms
  public async getRooms(): Promise<any[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/rooms`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) return [];
      const json = await res.json();
      return json.success && Array.isArray(json.data) ? json.data : [];
    } catch {
      return [];
    }
  }

  public async getRoom(roomId: string): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/rooms/${roomId}`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.success ? json.data : null;
    } catch {
      return null;
    }
  }

  public async createRoom(name: string, isPrivate = false): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/rooms`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ name, isPrivate }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.success ? json.data : null;
    } catch {
      return null;
    }
  }

  // Unified Search
  public async searchAll(query: string): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/tracks/search/all?q=${encodeURIComponent(query)}`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.data;
    } catch {
      return null;
    }
  }

  // Audio Upload
  public async uploadTrack(
    file: File,
    metadata: { title: string; artist: string; duration: number; genre?: string }
  ): Promise<Track | null> {
    try {
      const formData = new FormData();
      formData.append('audio', file);
      formData.append('title', metadata.title);
      formData.append('artist', metadata.artist);
      formData.append('duration', String(Math.round(metadata.duration)));
      if (metadata.genre) formData.append('genre', metadata.genre);

      const headers: Record<string, string> = {};
      if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

      const res = await fetch(`${API_BASE_URL}/tracks/upload`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');
      const json = await res.json();
      if (json.success && json.data) {
        const t = json.data;
        return {
          ...t,
          audioUrl: t.audioUrl?.startsWith('http') ? t.audioUrl : `${API_HOST}${t.audioUrl}`,
          artwork: t.artworkUrl || t.artwork,
        };
      }
      return null;
    } catch (err) {
      console.error('Track upload error:', err);
      return null;
    }
  }

  // Recommendations & Daily Mixes
  public async getDailyMixes(regenerate = false): Promise<any[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/recommendations/daily?regenerate=${regenerate}`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return [];
      const json = await res.json();
      return json.success ? json.data : [];
    } catch {
      return [];
    }
  }

  public async getDiscoverMix(): Promise<Track[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/recommendations/discover`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return [];
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        return json.data.map((t: any) => ({
          ...t,
          audioUrl: t.audioUrl?.startsWith('http') ? t.audioUrl : `${API_HOST}${t.audioUrl}`,
          artwork: t.artworkUrl || t.artwork,
        }));
      }
      return [];
    } catch {
      return [];
    }
  }

  public async getSimilarTracks(trackId: string, limit = 6): Promise<Track[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/recommendations/similar/${trackId}?limit=${limit}`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return [];
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        return json.data.map((t: any) => ({
          ...t,
          audioUrl: t.audioUrl?.startsWith('http') ? t.audioUrl : `${API_HOST}${t.audioUrl}`,
          artwork: t.artworkUrl || t.artwork,
        }));
      }
      return [];
    } catch {
      return [];
    }
  }

  public async getTransitionMetadata(trackId: string): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/recommendations/transition/${trackId}`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.success ? json.data : null;
    } catch {
      return null;
    }
  }

  // AI DJ & Playlist Generation
  public async createDJSession(prompt?: string): Promise<string | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/ai/dj/session`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.success ? json.data.sessionId : null;
    } catch {
      return null;
    }
  }

  public async getDJNextTrack(sessionId: string, currentTrackId?: string): Promise<Track | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/ai/dj/next`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ sessionId, currentTrackId }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      if (json.success && json.data) {
        const t = json.data;
        return {
          ...t,
          audioUrl: t.audioUrl?.startsWith('http') ? t.audioUrl : `${API_HOST}${t.audioUrl}`,
          artwork: t.artworkUrl || t.artwork,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  public async generateAIPlaylist(prompt: string, maxTracks = 6, createPlaylist = true): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/ai/playlists/generate`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ prompt, maxTracks, createPlaylist }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.success ? json.data : null;
    } catch {
      return null;
    }
  }

  // Online Multi-Language Streaming & Catalog (iTunes Indian & Global Network)
  public async getOnlineTrending(languageOrGenre = 'All', limit = 30): Promise<Track[]> {
    try {
      const url = `${API_BASE_URL}/tracks/online/trending?limit=${limit}&language=${encodeURIComponent(
        languageOrGenre
      )}`;
      const res = await fetch(url, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) return [];
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        return json.data.map((t: any) => ({
          ...t,
          audioUrl: t.audioUrl?.startsWith('http') ? t.audioUrl : `${API_HOST}${t.audioUrl}`,
          artwork: t.artworkUrl || t.artwork,
        }));
      }
      return [];
    } catch {
      return [];
    }
  }

  public async searchOnlineCatalog(
    query: string,
    language?: string,
    limit = 20
  ): Promise<{ tracks: Track[]; artists: Artist[]; albums: Album[] }> {
    try {
      const url = `${API_BASE_URL}/tracks/online/search?q=${encodeURIComponent(query)}&limit=${limit}${
        language && language !== 'All' ? `&language=${encodeURIComponent(language)}` : ''
      }`;
      const res = await fetch(url, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) return { tracks: [], artists: [], albums: [] };
      const json = await res.json();
      const bundle = json.bundle || { tracks: json.data || [], artists: [], albums: [] };

      const tracks: Track[] = (bundle.tracks || []).map((t: any) => ({
        ...t,
        audioUrl: t.audioUrl?.startsWith('http') ? t.audioUrl : `${API_HOST}${t.audioUrl}`,
        artwork: t.artworkUrl || t.artwork,
      }));

      const artists: Artist[] = (bundle.artists || []).map((a: any) => ({
        id: a.id,
        name: a.name,
        avatar: a.avatar,
        genre: a.genre,
        monthlyListeners: a.monthlyListeners,
        verified: a.verified,
        trackIds: [],
      }));

      const albums: Album[] = (bundle.albums || []).map((alb: any) => ({
        id: alb.id,
        title: alb.title,
        artist: alb.artist,
        artistId: alb.artistId,
        artwork: alb.artwork,
        year: alb.year,
        genre: alb.genre,
        trackCount: alb.trackCount,
        trackIds: [],
      }));

      return { tracks, artists, albums };
    } catch {
      return { tracks: [], artists: [], albums: [] };
    }
  }

  public async searchOnline(query: string, limit = 20): Promise<Track[]> {
    const res = await this.searchOnlineCatalog(query, undefined, limit);
    return res.tracks;
  }

  public async getOnlineArtist(artistId: string): Promise<Artist | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/tracks/online/artist/${encodeURIComponent(artistId)}`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) return null;
      const json = await res.json();
      if (json.success && json.data) {
        const art = json.data;
        const topTracks: Track[] = (art.topTracks || []).map((t: any) => ({
          ...t,
          audioUrl: t.audioUrl?.startsWith('http') ? t.audioUrl : `${API_HOST}${t.audioUrl}`,
          artwork: t.artworkUrl || t.artwork,
        }));
        const albums: Album[] = (art.albums || []).map((alb: any) => ({
          id: alb.id,
          title: alb.title,
          artist: alb.artist,
          artistId: alb.artistId,
          artwork: alb.artwork,
          year: alb.year,
          genre: alb.genre,
          trackCount: alb.trackCount,
          trackIds: [],
        }));

        return {
          id: art.id,
          name: art.name,
          avatar: art.avatar,
          genre: art.genre,
          monthlyListeners: art.monthlyListeners,
          verified: art.verified,
          trackIds: topTracks.map((t) => t.id),
          topTracks,
          albums,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  public async getOnlineAlbum(albumId: string): Promise<Album | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/tracks/online/album/${encodeURIComponent(albumId)}`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) return null;
      const json = await res.json();
      if (json.success && json.data) {
        const alb = json.data;
        const tracks: Track[] = (alb.tracks || []).map((t: any) => ({
          ...t,
          audioUrl: t.audioUrl?.startsWith('http') ? t.audioUrl : `${API_HOST}${t.audioUrl}`,
          artwork: t.artworkUrl || t.artwork,
        }));

        return {
          id: alb.id,
          title: alb.title,
          artist: alb.artist,
          artistId: alb.artistId,
          artwork: alb.artwork,
          year: alb.year,
          genre: alb.genre,
          trackCount: alb.trackCount || tracks.length,
          trackIds: tracks.map((t) => t.id),
          tracks,
        };
      }
      return null;
    } catch {
      return null;
    }
  }
}

export const apiClient = new ApiClient();
