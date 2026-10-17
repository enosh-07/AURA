import { prisma } from './prisma.js';

export interface LyricLine {
  time: number; // in seconds
  text: string;
}

export interface LyricsResponse {
  trackId: string;
  hasSync: boolean;
  isInstrumental: boolean;
  format: 'lrc' | 'plain' | 'instrumental' | 'none';
  lines: LyricLine[];
  plainLyrics?: string;
  source: 'database' | 'lrclib' | 'none';
}

export interface LyricsQueryOptions {
  title?: string;
  artist?: string;
  album?: string;
  duration?: number;
}

export class LyricsService {
  private cache = new Map<string, { data: LyricsResponse; timestamp: number }>();
  private readonly CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
  private readonly LRCLIB_BASE_URL = process.env.LRCLIB_INSTANCE_URL || 'https://lrclib.net';

  /**
   * Parse standard LRC format string into timestamped lyric lines
   */
  public parseLRC(lrcText: string): LyricLine[] {
    if (!lrcText) return [];
    const lines: LyricLine[] = [];
    const rawLines = lrcText.split('\n');

    for (const raw of rawLines) {
      const trimmed = raw.trim();
      if (!trimmed) continue;

      // Match [mm:ss.xx] or [mm:ss.xxx]
      const match = trimmed.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
      if (match) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const millis = parseInt(match[3].padEnd(3, '0').slice(0, 3), 10);
        const totalSeconds = minutes * 60 + seconds + millis / 1000;
        const text = match[4].trim();

        // Keep non-empty text, or blank lines if used for spacing
        lines.push({
          time: Math.round(totalSeconds * 100) / 100,
          text: text,
        });
      }
    }

    // Sort chronologically
    return lines.sort((a, b) => a.time - b.time);
  }

  /**
   * Normalize search string to improve LRCLIB hit rates
   */
  public cleanSearchTerm(term: string): string {
    if (!term) return '';
    return term
      .replace(/\s*[\(\[](From\s+.*?|feat\..*?|ft\..*?|Official.*?|Lyric.*?|Audio.*?|Video.*?|Remix.*?)[\)\]]/gi, '')
      .replace(/&quot;/g, '')
      .replace(/[—–-]\s*(From|Remix|Official).*/gi, '')
      .replace(/[^\w\s\u0B80-\u0BFF\u0900-\u097F]/g, ' ') // Preserve Tamil, Devanagari, Alphanumeric
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extract primary artist name
   */
  public getPrimaryArtist(artist: string): string {
    if (!artist) return '';
    return artist
      .split(/[,/;&]|feat\.|ft\./i)[0]
      .trim();
  }

  /**
   * Fetch with automatic retry for 503 / rate-limit server errors
   */
  private async fetchWithRetry(url: string, retries = 2, delayMs = 400): Promise<Response | null> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'AURA-Music-Player/2.0 (https://github.com/enosh-07/AURA)',
          },
          signal: AbortSignal.timeout(5000),
        });

        if (response.status === 503 && attempt < retries) {
          await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
          continue;
        }

        return response;
      } catch (err) {
        if (attempt >= retries) throw err;
        await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
      }
    }
    return null;
  }

  /**
   * Main resolver for synchronized track lyrics
   */
  public async getLyrics(
    trackId: string,
    options?: LyricsQueryOptions
  ): Promise<LyricsResponse> {
    const cacheKey = `${trackId}:${options?.title || ''}:${options?.artist || ''}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.data;
    }

    // 1. Check local database first if valid track ID
    try {
      const dbTrack = await prisma.track.findUnique({
        where: { id: trackId },
        select: { id: true, lyricsLrc: true, plainLyrics: true, title: true, artist: true, album: true, duration: true },
      });

      if (dbTrack) {
        if (dbTrack.lyricsLrc) {
          const lines = this.parseLRC(dbTrack.lyricsLrc);
          if (lines.length > 0) {
            const res: LyricsResponse = {
              trackId: dbTrack.id,
              hasSync: true,
              isInstrumental: false,
              format: 'lrc',
              lines,
              plainLyrics: dbTrack.plainLyrics || undefined,
              source: 'database',
            };
            this.cache.set(cacheKey, { data: res, timestamp: Date.now() });
            return res;
          }
        }

        // If options not provided, use track metadata from DB for LRCLIB fallback
        if (!options?.title) {
          options = {
            title: dbTrack.title,
            artist: dbTrack.artist,
            album: dbTrack.album || undefined,
            duration: dbTrack.duration || undefined,
          };
        }
      }
    } catch {
      // Ignore database error and proceed to external provider
    }

    // 2. Query LRCLIB synchronized lyrics provider
    const title = options?.title || '';
    const artist = options?.artist || '';
    const album = options?.album || '';
    const duration = options?.duration;

    if (title) {
      try {
        const cleanedTitle = this.cleanSearchTerm(title);
        const primaryArtist = this.getPrimaryArtist(artist);
        const cleanedArtist = this.cleanSearchTerm(primaryArtist);

        // Helper to convert item into response
        const processItem = (item: any): LyricsResponse | null => {
          if (!item) return null;
          if (item.instrumental) {
            return {
              trackId,
              hasSync: false,
              isInstrumental: true,
              format: 'instrumental',
              lines: [],
              source: 'lrclib',
            };
          }
          if (item.syncedLyrics) {
            const lines = this.parseLRC(item.syncedLyrics);
            if (lines.length > 0) {
              return {
                trackId,
                hasSync: true,
                isInstrumental: false,
                format: 'lrc',
                lines,
                plainLyrics: item.plainLyrics || undefined,
                source: 'lrclib',
              };
            }
          }
          if (item.plainLyrics) {
            return {
              trackId,
              hasSync: false,
              isInstrumental: false,
              format: 'plain',
              lines: [],
              plainLyrics: item.plainLyrics,
              source: 'lrclib',
            };
          }
          return null;
        };

        // 2a. First attempt direct GET by track_name & artist_name (fastest & most accurate)
        if (cleanedTitle && cleanedArtist) {
          try {
            const getParams = new URLSearchParams({
              track_name: cleanedTitle,
              artist_name: cleanedArtist,
            });
            if (album) getParams.append('album_name', this.cleanSearchTerm(album));
            if (duration) getParams.append('duration', Math.round(duration).toString());

            const getRes = await this.fetchWithRetry(`${this.LRCLIB_BASE_URL}/api/get?${getParams.toString()}`);
            if (getRes && getRes.ok) {
              const data = await getRes.json();
              const result = processItem(data);
              if (result) {
                this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
                return result;
              }
            }
          } catch {
            // Direct GET failed, fall through to search
          }

          // Try without album/duration if direct GET with them failed
          if (album || duration) {
            try {
              const simpleGetParams = new URLSearchParams({
                track_name: cleanedTitle,
                artist_name: cleanedArtist,
              });
              const getRes = await this.fetchWithRetry(`${this.LRCLIB_BASE_URL}/api/get?${simpleGetParams.toString()}`);
              if (getRes && getRes.ok) {
                const data = await getRes.json();
                const result = processItem(data);
                if (result) {
                  this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
                  return result;
                }
              }
            } catch {
              // Fall through to search
            }
          }
        }

        // 2b. Fallback to /api/search
        const searchQueries = [
          `${cleanedTitle} ${cleanedArtist}`.trim(),
          cleanedTitle,
        ].filter(Boolean);

        for (const query of searchQueries) {
          const url = `${this.LRCLIB_BASE_URL}/api/search?q=${encodeURIComponent(query)}`;
          const response = await this.fetchWithRetry(url);

          if (!response || !response.ok) continue;
          const results = (await response.json()) as any[];
          if (!Array.isArray(results) || results.length === 0) continue;

          // Score candidate matches
          let bestMatch: any = null;
          let bestScore = -1;

          for (const item of results) {
            let score = 0;
            if (item.syncedLyrics) score += 50;
            if (item.plainLyrics) score += 10;
            if (item.instrumental) score += 20;

            // Check duration proximity
            if (duration && item.duration) {
              const diff = Math.abs(duration - item.duration);
              if (diff <= 3) score += 30;
              else if (diff <= 8) score += 15;
            }

            // Check artist similarity
            if (cleanedArtist && item.artistName && item.artistName.toLowerCase().includes(cleanedArtist.toLowerCase())) {
              score += 25;
            }

            if (score > bestScore) {
              bestScore = score;
              bestMatch = item;
            }
          }

          const result = processItem(bestMatch);
          if (result) {
            this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
            return result;
          }
        }
      } catch (err) {
        console.warn('[LyricsService] LRCLIB fetch failed or timed out:', err);
      }
    }

    // 3. Fallback when no lyrics are found (cache briefly for 15s to allow recovery)
    const emptyRes: LyricsResponse = {
      trackId,
      hasSync: false,
      isInstrumental: false,
      format: 'none',
      lines: [],
      source: 'none',
    };
    this.cache.set(cacheKey, { data: emptyRes, timestamp: Date.now() - this.CACHE_TTL_MS + 15000 });
    return emptyRes;
  }
}

export const lyricsService = new LyricsService();
