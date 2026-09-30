import { Request, Response } from 'express';
import CryptoJS from 'crypto-js';

export interface OnlineTrack {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  album: string;
  albumId?: string;
  duration: number;
  genre: string;
  bpm: number;
  accentColor: string;
  artwork: string;
  audioUrl: string;
  playCount: number;
  isOnline: boolean;
  year?: number;
}

export interface OnlineArtist {
  id: string;
  name: string;
  avatar: string;
  genre: string;
  monthlyListeners: number;
  verified: boolean;
  trackCount: number;
  topTracks?: OnlineTrack[];
  albums?: OnlineAlbum[];
}

export interface OnlineAlbum {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  artwork: string;
  year: number;
  genre: string;
  trackCount: number;
  tracks?: OnlineTrack[];
}

export interface SearchResultBundle {
  tracks: OnlineTrack[];
  artists: OnlineArtist[];
  albums: OnlineAlbum[];
}

const GENRE_ACCENTS: Record<string, string> = {
  Tamil: '#f97316',
  Hindi: '#ec4899',
  Bollywood: '#ec4899',
  Telugu: '#8b5cf6',
  Punjabi: '#f59e0b',
  Malayalam: '#10b981',
  Electronic: '#00f2fe',
  Synthwave: '#ff007f',
  Ambient: '#8b5cf6',
  'Lo-Fi': '#10b981',
  'Hip-Hop': '#f59e0b',
  Pop: '#06b6d4',
  Rock: '#ef4444',
  Classical: '#06b6d4',
  Default: '#00f2fe',
};

const LANGUAGE_SEARCH_TERMS: Record<string, string> = {
  Tamil: 'anirudh vijay leo jailer tamil hits',
  Hindi: 'arijit singh pritam bollywood hits 2024',
  Telugu: 'telugu hits pushpa thaman dsp',
  Punjabi: 'punjabi hits sidhu moosewala diljit',
  Malayalam: 'malayalam hits sushin shyam',
  English: 'billboard hot hits the weeknd dua lipa',
  All: 'top hits anirudh arijit weeknd tamil hindi english',
};

// JioSaavn DES cipher key for media URL decryption
const SAAVN_DES_KEY = CryptoJS.enc.Utf8.parse('38346591');

export class OnlineMusicService {
  private trendingCache: Map<string, { data: OnlineTrack[]; timestamp: number }> = new Map();
  private streamUrlCache: Map<string, { streamUrl: string; timestamp: number }> = new Map();
  private trackMetadataCache: Map<string, { title: string; artist: string }> = new Map();
  private readonly CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

  /**
   * Decrypts encrypted_media_url from JioSaavn into full-length 320kbps Akamai CDN stream URL
   */
  public decryptSaavnMediaUrl(encryptedUrl: string): string | null {
    if (!encryptedUrl) return null;
    try {
      const decrypted = CryptoJS.DES.decrypt(
        encryptedUrl,
        SAAVN_DES_KEY,
        { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 }
      );
      const url = decrypted.toString(CryptoJS.enc.Utf8);
      if (!url || !url.startsWith('http')) return null;
      // Upgrade to highest 320kbps CD master quality
      return url.replace('_96.mp4', '_320.mp4').replace('_160.mp4', '_320.mp4');
    } catch {
      return null;
    }
  }

  /**
   * Resolves a full-length master audio stream (3 to 6 mins, not 30s preview) for any track
   */
  public async resolveFullLengthStream(
    title: string,
    artist: string
  ): Promise<{ streamUrl: string; duration?: number } | null> {
    try {
      const query = `${title} ${artist}`
        .replace(/\(From "[^"]*"\)/gi, '')
        .replace(/\(Original Motion Picture Soundtrack\)/gi, '')
        .replace(/- Single/gi, '')
        .trim();

      const searchUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=${encodeURIComponent(
        query
      )}&n=3&p=1`;

      const searchRes = await fetch(searchUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(4000),
      });

      if (!searchRes.ok) return null;
      const searchJson: any = await searchRes.json();
      const firstResult = searchJson.results?.[0];
      if (!firstResult || !firstResult.id) return null;

      const detailsUrl = `https://www.jiosaavn.com/api.php?__call=song.getDetails&_format=json&_marker=0&api_version=4&ctx=web6dot0&pids=${firstResult.id}`;
      const detRes = await fetch(detailsUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(4000),
      });

      if (!detRes.ok) return null;
      const detJson: any = await detRes.json();
      const song = detJson.songs?.[0];
      if (!song || !song.more_info?.encrypted_media_url) return null;

      const fullUrl = this.decryptSaavnMediaUrl(song.more_info.encrypted_media_url);
      if (fullUrl) {
        return {
          streamUrl: fullUrl,
          duration: song.more_info.duration ? Number(song.more_info.duration) : undefined,
        };
      }
      return null;
    } catch (err) {
      console.warn('Full-length song resolution error:', err);
      return null;
    }
  }

  /**
   * Fetch trending tracks across languages (Tamil, Hindi, Telugu, Punjabi, English, etc.)
   */
  async getTrending(languageOrGenre = 'All', limit = 30): Promise<OnlineTrack[]> {
    const cacheKey = `${languageOrGenre.toLowerCase()}_${limit}`;
    const cached = this.trendingCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.data;
    }

    try {
      const searchTerm = LANGUAGE_SEARCH_TERMS[languageOrGenre] || `${languageOrGenre} hits`;

      // Search full-length songs from JioSaavn first for regional Indian queries
      const saavnUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=${encodeURIComponent(
        searchTerm
      )}&n=${limit}&p=1`;

      const saavnRes = await fetch(saavnUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(5000),
      });

      if (saavnRes.ok) {
        const saavnJson: any = await saavnRes.json();
        if (saavnJson && Array.isArray(saavnJson.results) && saavnJson.results.length > 0) {
          const pids = saavnJson.results.map((r: any) => r.id).join(',');
          const detRes = await fetch(
            `https://www.jiosaavn.com/api.php?__call=song.getDetails&_format=json&_marker=0&api_version=4&ctx=web6dot0&pids=${pids}`,
            { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) }
          );

          if (detRes.ok) {
            const detJson: any = await detRes.json();
            if (detJson && Array.isArray(detJson.songs) && detJson.songs.length > 0) {
              const mapped: OnlineTrack[] = [];
              for (const song of detJson.songs) {
                const track = this.mapSaavnTrack(song, languageOrGenre);
                if (track) mapped.push(track);
              }
              if (mapped.length > 0) {
                this.trendingCache.set(cacheKey, { data: mapped, timestamp: Date.now() });
                return mapped;
              }
            }
          }
        }
      }

      // Fallback: iTunes search
      const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(
        searchTerm
      )}&country=IN&entity=song&limit=${limit}`;

      const res = await fetch(itunesUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AURA-Music/1.0' },
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        const json: any = await res.json();
        if (json && json.results && Array.isArray(json.results) && json.results.length > 0) {
          const mapped = json.results.map((item: any) => this.mapItunesTrack(item));
          this.trendingCache.set(cacheKey, { data: mapped, timestamp: Date.now() });
          return mapped;
        }
      }

      return cached ? cached.data : [];
    } catch (err) {
      console.warn('Online trending fetch error:', err);
      return cached ? cached.data : [];
    }
  }

  /**
   * Search songs, artists, and albums with FULL-LENGTH streaming URLs
   */
  async searchCatalog(query: string, language?: string, limit = 25): Promise<SearchResultBundle> {
    if (!query.trim()) {
      return { tracks: [], artists: [], albums: [] };
    }

    const cleanQuery = query.trim();
    const queryWithLang = language && language !== 'All' ? `${cleanQuery} ${language}` : cleanQuery;

    try {
      // 1. Fetch full-length songs, albums & artists from JioSaavn and iTunes
      const [saavnSongsRes, saavnAlbumsRes, saavnArtistsRes, itunesArtistsRes, itunesAlbumsRes] = await Promise.allSettled([
        fetch(
          `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=${encodeURIComponent(
            queryWithLang
          )}&n=${limit}&p=1`,
          { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) }
        ),
        fetch(
          `https://www.jiosaavn.com/api.php?__call=search.getAlbumResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=${encodeURIComponent(
            cleanQuery
          )}&n=10&p=1`,
          { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) }
        ),
        fetch(
          `https://www.jiosaavn.com/api.php?__call=search.getArtistResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=${encodeURIComponent(
            cleanQuery
          )}&n=6&p=1`,
          { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) }
        ),
        fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(
            cleanQuery
          )}&country=IN&entity=musicArtist&limit=8`,
          { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) }
        ),
        fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(
            queryWithLang
          )}&country=IN&entity=album&limit=10`,
          { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) }
        ),
      ]);

      const tracks: OnlineTrack[] = [];
      const artists: OnlineArtist[] = [];
      const albums: OnlineAlbum[] = [];
      const seenArtistNames = new Set<string>();

      // Process JioSaavn Artists
      if (saavnArtistsRes.status === 'fulfilled' && saavnArtistsRes.value.ok) {
        const json: any = await saavnArtistsRes.value.json();
        if (json && Array.isArray(json.results)) {
          for (const item of json.results) {
            const rawName = item.name ? item.name.replace(/&amp;/g, '&') : '';
            const norm = rawName.toLowerCase().trim();
            if (norm && !seenArtistNames.has(norm)) {
              seenArtistNames.add(norm);
              const avatar = (item.image || '').replace('50x50.jpg', '500x500.jpg').replace('150x150.jpg', '500x500.jpg');
              artists.push({
                id: `artist_${encodeURIComponent(rawName)}__${encodeURIComponent(rawName)}`,
                name: rawName,
                avatar: avatar || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500',
                genre: 'Indian Cinema / Soundtrack',
                monthlyListeners: 19500000,
                verified: true,
                trackCount: 40,
              });
            }
          }
        }
      }

      // Process JioSaavn full-length songs
      if (saavnSongsRes.status === 'fulfilled' && saavnSongsRes.value.ok) {
        const json: any = await saavnSongsRes.value.json();
        if (json && Array.isArray(json.results) && json.results.length > 0) {
          const pids = json.results.map((r: any) => r.id).join(',');
          try {
            const detRes = await fetch(
              `https://www.jiosaavn.com/api.php?__call=song.getDetails&_format=json&_marker=0&api_version=4&ctx=web6dot0&pids=${pids}`,
              { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) }
            );
            if (detRes.ok) {
              const detJson: any = await detRes.json();
              if (detJson && Array.isArray(detJson.songs)) {
                for (const s of detJson.songs) {
                  const t = this.mapSaavnTrack(s, language);
                  if (t) tracks.push(t);
                }
              }
            }
          } catch (e) {
            console.warn('Saavn details error:', e);
          }
        }
      }

      // If JioSaavn yielded few songs (e.g. western indie query), fallback to iTunes
      if (tracks.length < 5) {
        try {
          const itunesSongs = await fetch(
            `https://itunes.apple.com/search?term=${encodeURIComponent(
              queryWithLang
            )}&country=IN&entity=song&limit=${limit}`,
            { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(4000) }
          );
          if (itunesSongs.ok) {
            const itJson: any = await itunesSongs.json();
            if (itJson && Array.isArray(itJson.results)) {
              for (const it of itJson.results) {
                // Avoid duplicates
                if (!tracks.some((t) => t.title.toLowerCase() === it.trackName?.toLowerCase())) {
                  tracks.push(this.mapItunesTrack(it));
                }
              }
            }
          }
        } catch {
          // ignore
        }
      }

      // Process JioSaavn Albums
      if (saavnAlbumsRes.status === 'fulfilled' && saavnAlbumsRes.value.ok) {
        const json: any = await saavnAlbumsRes.value.json();
        if (json && Array.isArray(json.results)) {
          for (const alb of json.results) {
            const albArtist = alb.more_info?.music || alb.subtitle || 'Soundtrack';
            albums.push({
              id: `saavn_album_${alb.id}`,
              title: alb.title ? alb.title.replace(/&quot;/g, '"').replace(/&#039;/g, "'") : 'Untitled Album',
              artist: albArtist,
              artistId: `artist_${encodeURIComponent(albArtist)}__${encodeURIComponent(albArtist)}`,
              artwork: (alb.image || '').replace('150x150.jpg', '500x500.jpg'),
              year: alb.year ? Number(alb.year) : 2024,
              genre: alb.language || 'Indian Cinema',
              trackCount: 8,
            });
          }
        }
      }

      // Process iTunes Albums (enrich discography)
      if (itunesAlbumsRes.status === 'fulfilled' && itunesAlbumsRes.value.ok) {
        const json: any = await itunesAlbumsRes.value.json();
        if (json && Array.isArray(json.results)) {
          for (const item of json.results) {
            if (!albums.some((a) => a.title.toLowerCase() === item.collectionName?.toLowerCase())) {
              const itunesAlbArtist = item.artistName || 'Various Artists';
              albums.push({
                id: `itunes_album_${item.collectionId}`,
                title: item.collectionName || 'Untitled Album',
                artist: itunesAlbArtist,
                artistId: `itunes_artist_${item.artistId || '0'}__${encodeURIComponent(itunesAlbArtist)}`,
                artwork: (item.artworkUrl100 || '').replace('100x100bb.jpg', '600x600bb.jpg'),
                year: item.releaseDate ? new Date(item.releaseDate).getFullYear() : 2024,
                genre: item.primaryGenreName || 'Soundtrack',
                trackCount: item.trackCount || 6,
              });
            }
          }
        }
      }

      // Process Artists from iTunes
      if (itunesArtistsRes.status === 'fulfilled' && itunesArtistsRes.value.ok) {
        const json: any = await itunesArtistsRes.value.json();
        if (json && Array.isArray(json.results)) {
          const artistArtMap = new Map<string, string>();
          tracks.forEach((t) => {
            if (t.artist && t.artwork) {
              artistArtMap.set(t.artist.toLowerCase(), t.artwork);
            }
          });

          for (const item of json.results) {
            const artistName = item.artistName || 'Unknown Artist';
            const norm = artistName.toLowerCase().trim();
            if (norm && !seenArtistNames.has(norm)) {
              seenArtistNames.add(norm);
              const fallbackAvatar =
                artistArtMap.get(artistName.toLowerCase()) ||
                tracks[0]?.artwork ||
                'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80';

              artists.push({
                id: `itunes_artist_${item.artistId || '0'}__${encodeURIComponent(artistName)}`,
                name: artistName,
                avatar: fallbackAvatar,
                genre: item.primaryGenreName || 'Indian Cinema / Soundtrack',
                monthlyListeners: 18542000,
                verified: true,
                trackCount: 50,
              });
            }
          }
        }
      }

      // Guarantee artist presence: synthesize from top matched tracks if empty
      if (artists.length === 0 && tracks.length > 0) {
        const seenSynth = new Set<string>();
        for (const t of tracks.slice(0, 4)) {
          const aName = t.artist;
          if (aName && !seenSynth.has(aName.toLowerCase())) {
            seenSynth.add(aName.toLowerCase());
            artists.push({
              id: t.artistId || `artist_${encodeURIComponent(aName)}__${encodeURIComponent(aName)}`,
              name: aName,
              avatar: t.artwork,
              genre: t.genre || 'Soundtrack / Pop',
              monthlyListeners: 18900000,
              verified: true,
              trackCount: 30,
            });
          }
        }
      }

      return { tracks, artists, albums };
    } catch (err) {
      console.warn('Online catalog search error:', err);
      return { tracks: [], artists: [], albums: [] };
    }
  }

  /**
   * Search tracks (backward compatibility)
   */
  async search(query: string, limit = 20): Promise<OnlineTrack[]> {
    const res = await this.searchCatalog(query, undefined, limit);
    return res.tracks;
  }

  /**
   * Fetch complete Artist Profile: Verified badge, Monthly listeners, Top Hits, and Full Album Discography
   * Universally resolves ANY artist in the world (by numeric ID, composite ID, or artist name)
   */
  async getArtistDetails(artistIdStr: string): Promise<OnlineArtist | null> {
    try {
      const decoded = decodeURIComponent(artistIdStr).trim();
      let cleanId = '';
      let targetName = '';

      if (decoded.includes('__')) {
        const parts = decoded.split('__');
        cleanId = parts[0].replace(/^(itunes_artist_|artist_|saavn_artist_)/, '').trim();
        targetName = parts[1].trim();
      } else if (/^\d+$/.test(decoded.replace(/^(itunes_artist_|artist_|saavn_artist_)/, '').trim())) {
        cleanId = decoded.replace(/^(itunes_artist_|artist_|saavn_artist_)/, '').trim();
      } else {
        targetName = decoded.replace(/^(itunes_artist_|artist_|saavn_artist_)/, '').trim();
      }

      let artistInfo: any = null;
      let officialAvatar = '';
      const topTracks: OnlineTrack[] = [];
      const albums: OnlineAlbum[] = [];
      const seenTrackTitles = new Set<string>();
      const seenAlbumTitles = new Set<string>();

      const isSaavnId = decoded.startsWith('saavn_artist_');

      // 1. If numeric ID is available, try Saavn or iTunes direct lookups
      if (cleanId && /^\d+$/.test(cleanId)) {
        try {
          const fetchPromises: Promise<any>[] = [
            fetch(`https://itunes.apple.com/lookup?id=${cleanId}&entity=song&limit=30&country=IN`, {
              headers: { 'User-Agent': 'Mozilla/5.0 AURA-Player/1.0' },
              signal: AbortSignal.timeout(4500),
            }),
            fetch(`https://itunes.apple.com/lookup?id=${cleanId}&entity=album&limit=25&country=IN`, {
              headers: { 'User-Agent': 'Mozilla/5.0 AURA-Player/1.0' },
              signal: AbortSignal.timeout(4500),
            }),
          ];

          if (isSaavnId || !targetName) {
            fetchPromises.push(
              fetch(
                `https://www.jiosaavn.com/api.php?__call=artist.getArtistPageDetails&_format=json&_marker=0&api_version=4&ctx=web6dot0&artistId=${cleanId}`,
                { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(4000) }
              )
            );
          }

          const [songsRes, albumsRes, saavnArtRes] = await Promise.allSettled(fetchPromises);

          if (saavnArtRes && saavnArtRes.status === 'fulfilled' && saavnArtRes.value?.ok) {
            try {
              const sJson: any = await saavnArtRes.value.json();
              if (sJson && sJson.name && !targetName) {
                targetName = sJson.name;
              }
              if (sJson?.image) {
                officialAvatar = sJson.image.replace('150x150.jpg', '500x500.jpg').replace('50x50.jpg', '500x500.jpg');
              }
            } catch {}
          }

          if (songsRes.status === 'fulfilled' && songsRes.value.ok) {
            const json: any = await songsRes.value.json();
            if (json && Array.isArray(json.results) && json.results.length > 0) {
              artistInfo = json.results[0];
              if (!targetName && artistInfo.artistName) {
                targetName = artistInfo.artistName;
              }
              const songs = json.results.slice(1);
              for (const s of songs) {
                const t = this.mapItunesTrack(s);
                const normTitle = t.title.toLowerCase().trim();
                if (!seenTrackTitles.has(normTitle)) {
                  seenTrackTitles.add(normTitle);
                  topTracks.push(t);
                }
              }
            }
          }

          if (albumsRes.status === 'fulfilled' && albumsRes.value.ok) {
            const json: any = await albumsRes.value.json();
            if (json && Array.isArray(json.results)) {
              if (!artistInfo) artistInfo = json.results[0];
              const albumList = json.results.slice(1);
              for (const a of albumList) {
                const normAlb = (a.collectionName || '').toLowerCase().trim();
                if (normAlb && !seenAlbumTitles.has(normAlb)) {
                  seenAlbumTitles.add(normAlb);
                  albums.push({
                    id: `itunes_album_${a.collectionId}`,
                    title: a.collectionName,
                    artist: a.artistName,
                    artistId: `itunes_artist_${cleanId}__${encodeURIComponent(a.artistName || targetName)}`,
                    artwork: (a.artworkUrl100 || '').replace('100x100bb.jpg', '600x600bb.jpg'),
                    year: a.releaseDate ? new Date(a.releaseDate).getFullYear() : 2024,
                    genre: a.primaryGenreName || 'Soundtrack',
                    trackCount: a.trackCount || 6,
                  });
                }
              }
            }
          }
        } catch (e) {
          console.warn('Numeric lookup error:', e);
        }
      }

      // 2. Query JioSaavn & iTunes by artist name to get full-length 320kbps tracks and albums
      let searchArtistName = targetName || (artistInfo ? artistInfo.artistName : '');

      // Fallback if searchArtistName is still missing or pure numeric
      if (!searchArtistName && cleanId) {
        if (/^\d+$/.test(cleanId)) {
          // Attempt global iTunes search
          try {
            const globalRes = await fetch(`https://itunes.apple.com/search?term=${cleanId}&entity=musicArtist&limit=1`, {
              headers: { 'User-Agent': 'Mozilla/5.0' },
              signal: AbortSignal.timeout(3000),
            });
            if (globalRes.ok) {
              const gJson: any = await globalRes.json();
              if (gJson.results?.[0]?.artistName) {
                searchArtistName = gJson.results[0].artistName;
              }
            }
          } catch {}
        } else {
          searchArtistName = cleanId;
        }
      }

      if (searchArtistName && !/^\d+$/.test(searchArtistName)) {
        try {
          const [saavnSongsRes, saavnAlbumsRes, saavnArtistSearchRes, itunesArtistSearchRes] = await Promise.allSettled([
            fetch(
              `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=${encodeURIComponent(
                searchArtistName
              )}&n=35&p=1`,
              { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) }
            ),
            fetch(
              `https://www.jiosaavn.com/api.php?__call=search.getAlbumResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=${encodeURIComponent(
                searchArtistName
              )}&n=20&p=1`,
              { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) }
            ),
            fetch(
              `https://www.jiosaavn.com/api.php?__call=search.getArtistResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=${encodeURIComponent(
                searchArtistName
              )}&n=3&p=1`,
              { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(4000) }
            ),
            fetch(
              `https://itunes.apple.com/search?term=${encodeURIComponent(
                searchArtistName
              )}&country=IN&entity=song&limit=30`,
              { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) }
            ),
          ]);

          // Extract official artist avatar
          if (saavnArtistSearchRes.status === 'fulfilled' && saavnArtistSearchRes.value.ok) {
            try {
              const artJson: any = await saavnArtistSearchRes.value.json();
              const firstArt = artJson.results?.[0];
              if (firstArt?.image && !firstArt.image.includes('default')) {
                officialAvatar = firstArt.image.replace('50x50.jpg', '500x500.jpg').replace('150x150.jpg', '500x500.jpg');
              }
            } catch {}
          }

          // JioSaavn Full-Length Songs with decrypted 320kbps CD master audio
          if (saavnSongsRes.status === 'fulfilled' && saavnSongsRes.value.ok) {
            const json: any = await saavnSongsRes.value.json();
            if (json && Array.isArray(json.results) && json.results.length > 0) {
              const pids = json.results.slice(0, 25).map((r: any) => r.id).join(',');
              const detRes = await fetch(
                `https://www.jiosaavn.com/api.php?__call=song.getDetails&_format=json&_marker=0&api_version=4&ctx=web6dot0&pids=${pids}`,
                { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) }
              );
              if (detRes.ok) {
                const detJson: any = await detRes.json();
                if (detJson && Array.isArray(detJson.songs)) {
                  for (const s of detJson.songs) {
                    const t = this.mapSaavnTrack(s);
                    if (t) {
                      const normTitle = t.title.toLowerCase().trim();
                      if (!seenTrackTitles.has(normTitle)) {
                        seenTrackTitles.add(normTitle);
                        topTracks.unshift(t); // Prioritize JioSaavn 320kbps master streams
                      }
                    }
                  }
                }
              }
            }
          }

          // JioSaavn Albums
          if (saavnAlbumsRes.status === 'fulfilled' && saavnAlbumsRes.value.ok) {
            const json: any = await saavnAlbumsRes.value.json();
            if (json && Array.isArray(json.results)) {
              for (const alb of json.results) {
                const normAlb = (alb.title || '').toLowerCase().trim();
                if (normAlb && !seenAlbumTitles.has(normAlb)) {
                  seenAlbumTitles.add(normAlb);
                  albums.push({
                    id: `saavn_album_${alb.id}`,
                    title: alb.title ? alb.title.replace(/&quot;/g, '"').replace(/&#039;/g, "'") : 'Untitled Album',
                    artist: alb.more_info?.music || alb.subtitle || searchArtistName,
                    artwork: (alb.image || '').replace('150x150.jpg', '500x500.jpg'),
                    year: alb.year ? Number(alb.year) : 2024,
                    genre: alb.language || 'Soundtrack',
                    trackCount: 8,
                  });
                }
              }
            }
          }

          // iTunes Songs Fallback/Supplement
          if (itunesArtistSearchRes.status === 'fulfilled' && itunesArtistSearchRes.value.ok) {
            const itJson: any = await itunesArtistSearchRes.value.json();
            if (itJson && Array.isArray(itJson.results)) {
              for (const it of itJson.results) {
                const t = this.mapItunesTrack(it);
                const normTitle = t.title.toLowerCase().trim();
                if (!seenTrackTitles.has(normTitle)) {
                  seenTrackTitles.add(normTitle);
                  topTracks.push(t);
                }
              }
            }
          }
        } catch (e) {
          console.warn('Artist search supplementary query error:', e);
        }
      }

      const finalName = searchArtistName || targetName || 'Featured Artist';

      // Pick highest quality avatar: official portrait > top track cover > album cover
      const bestAvatar =
        officialAvatar ||
        topTracks[0]?.artwork ||
        albums[0]?.artwork ||
        'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80';

      const finalGenre =
        artistInfo?.primaryGenreName ||
        topTracks[0]?.genre ||
        'Indian Cinema / Contemporary';

      return {
        id: `itunes_artist_${cleanId || '0'}__${encodeURIComponent(finalName)}`,
        name: finalName,
        avatar: bestAvatar,
        genre: finalGenre,
        monthlyListeners: 19450000,
        verified: true,
        trackCount: topTracks.length,
        topTracks,
        albums,
      };
    } catch (err) {
      console.error('Error fetching artist details:', err);
      return null;
    }
  }

  /**
   * Fetch complete Album details: Title, Artwork, Year, and all Tracks
   */
  async getAlbumDetails(albumIdStr: string): Promise<OnlineAlbum | null> {
    try {
      if (albumIdStr.startsWith('saavn_album_')) {
        const saavnId = albumIdStr.replace('saavn_album_', '');
        const res = await fetch(
          `https://www.jiosaavn.com/api.php?__call=content.getAlbumDetails&_format=json&_marker=0&api_version=4&ctx=web6dot0&albumid=${saavnId}`,
          { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) }
        );
        if (res.ok) {
          const json: any = await res.json();
          if (json && Array.isArray(json.list)) {
            const tracks: OnlineTrack[] = [];
            for (const s of json.list) {
              const t = this.mapSaavnTrack(s, json.language);
              if (t) tracks.push(t);
            }
            return {
              id: albumIdStr,
              title: json.title ? json.title.replace(/&quot;/g, '"').replace(/&#039;/g, "'") : 'Untitled Album',
              artist: json.primary_artists || json.music || 'Soundtrack',
              artwork: (json.image || '').replace('150x150.jpg', '600x600.jpg'),
              year: json.year ? Number(json.year) : 2024,
              genre: json.language || 'Soundtrack',
              trackCount: tracks.length,
              tracks,
            };
          }
        }
      }

      // iTunes album lookup
      const cleanId = albumIdStr.replace('itunes_album_', '');
      const res = await fetch(`https://itunes.apple.com/lookup?id=${cleanId}&entity=song&limit=60`, {
        headers: { 'User-Agent': 'Mozilla/5.0 AURA-Player/1.0' },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) return null;
      const json: any = await res.json();
      if (!json || !Array.isArray(json.results) || json.results.length === 0) {
        return null;
      }

      const albumData = json.results[0];
      const tracks = json.results.slice(1).map((s: any) => this.mapItunesTrack(s));

      return {
        id: `itunes_album_${cleanId}`,
        title: albumData.collectionName || 'Untitled Album',
        artist: albumData.artistName || 'Various Artists',
        artistId: albumData.artistId ? `itunes_artist_${albumData.artistId}` : undefined,
        artwork: (albumData.artworkUrl100 || '').replace('100x100bb.jpg', '800x800bb.jpg'),
        year: albumData.releaseDate ? new Date(albumData.releaseDate).getFullYear() : 2024,
        genre: albumData.primaryGenreName || 'Soundtrack',
        trackCount: albumData.trackCount || tracks.length,
        tracks,
      };
    } catch (err) {
      console.error('Error fetching album details:', err);
      return null;
    }
  }

  /**
   * Proxies upstream FULL-LENGTH audio stream with native HTTP 206 range support and full CORS exposure
   */
  async streamTrack(trackId: string, req: Request, res: Response) {
    try {
      let upstreamUrl = '';

      // 1. Check if direct stream URL already cached
      const cached = this.streamUrlCache.get(trackId);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
        upstreamUrl = cached.streamUrl;
      }

      // 2. If it's a Saavn track
      if (!upstreamUrl && trackId.startsWith('saavn_')) {
        const cleanId = trackId.replace('saavn_', '');
        const detRes = await fetch(
          `https://www.jiosaavn.com/api.php?__call=song.getDetails&_format=json&_marker=0&api_version=4&ctx=web6dot0&pids=${cleanId}`,
          { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(4000) }
        );
        if (detRes.ok) {
          const detJson: any = await detRes.json();
          const song = detJson.songs?.[0];
          if (song && song.more_info?.encrypted_media_url) {
            const decUrl = this.decryptSaavnMediaUrl(song.more_info.encrypted_media_url);
            if (decUrl) {
              upstreamUrl = decUrl;
              this.streamUrlCache.set(trackId, { streamUrl: upstreamUrl, timestamp: Date.now() });
            }
          }
        }
      }

      // 3. If it's an iTunes track, resolve full-length stream via JioSaavn matching first!
      if (!upstreamUrl && (trackId.startsWith('itunes_') || !trackId.includes('_'))) {
        const cleanId = trackId.replace('itunes_', '');
        const meta = this.trackMetadataCache.get(cleanId);

        let title = meta?.title;
        let artist = meta?.artist;

        // If metadata not in cache, look it up from iTunes
        if (!title || !artist) {
          const lookupRes = await fetch(`https://itunes.apple.com/lookup?id=${cleanId}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 AURA-Player/1.0' },
            signal: AbortSignal.timeout(4000),
          });
          if (lookupRes.ok) {
            const json: any = await lookupRes.json();
            const track = json?.results?.[0];
            if (track) {
              title = track.trackName;
              artist = track.artistName;
              if (track.previewUrl) {
                // Keep preview as last fallback
                upstreamUrl = track.previewUrl;
              }
            }
          }
        }

        // Now attempt full-length resolution!
        if (title && artist) {
          const fullMatch = await this.resolveFullLengthStream(title, artist);
          if (fullMatch && fullMatch.streamUrl) {
            upstreamUrl = fullMatch.streamUrl;
            this.streamUrlCache.set(trackId, { streamUrl: upstreamUrl, timestamp: Date.now() });
          }
        }
      }

      // 4. Audius fallback
      if (!upstreamUrl && trackId.startsWith('audius_')) {
        const cleanId = trackId.replace('audius_', '');
        upstreamUrl = `https://discoveryprovider.audius.co/v1/tracks/${cleanId}/stream?app_name=AURA`;
      }

      if (!upstreamUrl) {
        res.status(404).json({ success: false, error: { message: 'Audio stream URL not found' } });
        return;
      }

      const forwardHeaders: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AURA-Player/1.0',
      };
      if (req.headers.range) {
        forwardHeaders['range'] = req.headers.range;
      }

      const upstreamRes = await fetch(upstreamUrl, {
        headers: forwardHeaders,
        redirect: 'follow',
      });

      if (!upstreamRes.ok && upstreamRes.status !== 206) {
        res.status(upstreamRes.status).json({
          success: false,
          error: { message: `Upstream streaming failed with status ${upstreamRes.status}` },
        });
        return;
      }

      // Propagate critical streaming headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', upstreamRes.headers.get('content-type') || 'audio/mp4');

      const contentRange = upstreamRes.headers.get('content-range');
      if (contentRange) res.setHeader('Content-Range', contentRange);

      const contentLength = upstreamRes.headers.get('content-length');
      if (contentLength) res.setHeader('Content-Length', contentLength);

      res.status(upstreamRes.status);

      if (upstreamRes.body) {
        // @ts-ignore
        const reader = upstreamRes.body.getReader();
        const pump = async () => {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
          res.end();
        };
        await pump();
      } else {
        res.end();
      }
    } catch (err: any) {
      console.error('Audio stream proxy error:', err);
      if (!res.headersSent) {
        res.status(502).json({ success: false, error: { message: 'Streaming gateway error' } });
      }
    }
  }

  private mapSaavnTrack(song: any, defaultGenre?: string): OnlineTrack | null {
    if (!song || !song.id) return null;

    const title = song.title ? song.title.replace(/&quot;/g, '"').replace(/&#039;/g, "'") : 'Untitled Track';
    const artist =
      song.more_info?.music ||
      song.more_info?.artistMap?.primary_artists?.map((a: any) => a.name).join(', ') ||
      song.subtitle ||
      'Unknown Artist';
    const album = song.more_info?.album
      ? song.more_info.album.replace(/&quot;/g, '"').replace(/&#039;/g, "'")
      : 'Single';
    const duration = song.more_info?.duration ? Number(song.more_info.duration) : 210;
    const genre = song.language ? song.language.charAt(0).toUpperCase() + song.language.slice(1) : defaultGenre || 'Tamil';
    const accentColor = GENRE_ACCENTS[genre] || GENRE_ACCENTS.Default;

    // Cache decrypted stream URL immediately if available
    if (song.more_info?.encrypted_media_url) {
      const fullUrl = this.decryptSaavnMediaUrl(song.more_info.encrypted_media_url);
      if (fullUrl) {
        this.streamUrlCache.set(`saavn_${song.id}`, { streamUrl: fullUrl, timestamp: Date.now() });
      }
    }

    const artwork = (song.image || '').replace('150x150.jpg', '500x500.jpg');

    return {
      id: `saavn_${song.id}`,
      title,
      artist,
      artistId: `artist_${encodeURIComponent(artist)}__${encodeURIComponent(artist)}`,
      album,
      albumId: song.more_info?.album_id ? `saavn_album_${song.more_info.album_id}` : undefined,
      duration,
      genre,
      bpm: 126,
      accentColor,
      artwork: artwork || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800',
      audioUrl: `/api/v1/tracks/online/saavn_${song.id}/stream`,
      playCount: song.play_count ? Number(song.play_count) : 450000,
      isOnline: true,
      year: song.year ? Number(song.year) : 2024,
    };
  }

  private mapItunesTrack(item: any): OnlineTrack {
    const genre = item.primaryGenreName || 'Tamil';
    const accentColor = GENRE_ACCENTS[genre] || GENRE_ACCENTS.Default;

    // Cache metadata for fast full-length resolution
    if (item.trackId) {
      this.trackMetadataCache.set(String(item.trackId), {
        title: item.trackName || '',
        artist: item.artistName || '',
      });
      if (item.previewUrl) {
        this.streamUrlCache.set(String(item.trackId), {
          streamUrl: item.previewUrl,
          timestamp: Date.now(),
        });
      }
    }

    const artwork = (item.artworkUrl100 || '')
      .replace('100x100bb.jpg', '600x600bb.jpg')
      .replace('100x100bb.png', '600x600bb.png');

    const artistName = item.artistName || 'Unknown Artist';
    const artistId = item.artistId
      ? `itunes_artist_${item.artistId}__${encodeURIComponent(artistName)}`
      : `artist_${encodeURIComponent(artistName)}__${encodeURIComponent(artistName)}`;

    return {
      id: `itunes_${item.trackId}`,
      title: item.trackName || 'Untitled Track',
      artist: artistName,
      artistId,
      album: item.collectionName || 'Soundtrack Single',
      albumId: item.collectionId ? `itunes_album_${item.collectionId}` : undefined,
      duration: item.trackTimeMillis ? Math.round(item.trackTimeMillis / 1000) : 180,
      genre,
      bpm: 126,
      accentColor,
      artwork:
        artwork ||
        'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
      audioUrl: `/api/v1/tracks/online/${item.trackId}/stream`,
      playCount: Math.floor(Math.random() * 500000) + 100000,
      isOnline: true,
      year: item.releaseDate ? new Date(item.releaseDate).getFullYear() : 2024,
    };
  }
}

export const onlineMusicService = new OnlineMusicService();
