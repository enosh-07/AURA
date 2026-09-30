/**
 * AI Service — AURA Intelligence Layer
 *
 * Features:
 *  1. Music curation (prompt → track suggestions)
 *  2. AI DJ (session-aware, tracks user preferences)
 *  3. Natural language playlist generation
 *
 * All LLM calls go through AIProvider abstraction.
 * Provider API keys NEVER leave the backend.
 */

import { prisma } from './prisma.js';
import { aiProvider, extractJSON } from './ai.provider.js';
import { ENV } from '../config/env.js';

export class AIService {
  // ============================================================
  // MUSIC CURATION (existing endpoint, enhanced)
  // ============================================================

  async curateMusic(userId: string | undefined, prompt: string, currentTrackId?: string, userMood?: string) {
    const cleanPrompt = prompt.toLowerCase().trim();
    const tracks = await prisma.track.findMany({ take: 100 });

    // Build user context from DB history if authenticated
    let userContext = '';
    if (userId) {
      const history = await prisma.listeningHistory.findMany({
        where: { userId },
        include: { track: { select: { genre: true, mood: true } } },
        orderBy: { timestamp: 'desc' },
        take: 50,
      });
      const genreCounts: Record<string, number> = {};
      history.forEach((h) => {
        if (h.track.genre) genreCounts[h.track.genre] = (genreCounts[h.track.genre] || 0) + 1;
      });
      const topGenres = Object.entries(genreCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([g]) => g);
      userContext = topGenres.length > 0 ? `User's top genres: ${topGenres.join(', ')}.` : '';
    }

    // Try LLM first
    if (ENV.GEMINI_API_KEY || ENV.OPENAI_API_KEY || ENV.OLLAMA_BASE_URL) {
      try {
        return await this.callLLMCurate(prompt, tracks, userContext, currentTrackId);
      } catch (err) {
        console.warn('AI provider failed, falling back to heuristic:', err);
      }
    }

    return this.heuristicCurate(cleanPrompt, tracks, userMood);
  }

  private async callLLMCurate(prompt: string, tracks: any[], userContext: string, currentTrackId?: string) {
    const catalog = tracks
      .map((t) => `${t.id}: "${t.title}" by ${t.artist} (${t.genre}, BPM: ${t.bpm ?? '?'}, Mood: ${t.mood ?? '?'})`)
      .join('\n');

    const messages = [
      {
        role: 'system' as const,
        content: `You are AURA, a futuristic AI music companion. ${userContext}
Available catalog:
${catalog}

Respond ONLY with valid JSON in this exact format:
{
  "message": "2-sentence reply to user",
  "reasoning": "brief explanation",
  "suggestedTrackIds": ["id1", "id2", "id3"],
  "actionType": "PLAY_TRACK | CREATE_PLAYLIST | SET_MOOD"
}
Only use track IDs from the catalog above. Do not invent tracks.`,
      },
      { role: 'user' as const, content: prompt },
    ];

    const result = await aiProvider.complete(messages, 512);
    const parsed = extractJSON(result.text);
    if (!parsed) throw new Error('Unparseable LLM response');

    const suggested = tracks.filter((t) => parsed.suggestedTrackIds?.includes(t.id));
    const formatTrack = (t: any) => ({ ...t, audioUrl: `/api/v1/tracks/${t.id}/stream` });
    const chosen = (suggested.length > 0 ? suggested : tracks.slice(0, 2)).map(formatTrack);

    return {
      message: parsed.message || 'Here are some tracks for you.',
      reasoning: parsed.reasoning,
      suggestedTracks: chosen,
      provider: result.provider,
      action: {
        type: parsed.actionType || 'CREATE_PLAYLIST',
        label: chosen[0] ? `Play ${chosen[0].title}` : 'Play Mix',
        payload: chosen[0] || null,
      },
    };
  }

  private heuristicCurate(cleanPrompt: string, tracks: any[], userMood?: string) {
    const fmt = (t: any) => ({ ...t, audioUrl: `/api/v1/tracks/${t.id}/stream` });

    if (cleanPrompt.includes('study') || cleanPrompt.includes('calm') || cleanPrompt.includes('focus') || cleanPrompt.includes('code')) {
      const matching = tracks.filter((t) => t.genre === 'Lo-Fi' || t.genre === 'Ambient' || t.mood === 'Focus');
      const chosen = (matching.length > 0 ? matching : tracks.slice(0, 3)).map(fmt);
      return { message: "Deep focus session synthesized. Warm harmonic saturation, zero intrusive vocals.", reasoning: 'Filtered sub-90 BPM ambient tracks.', suggestedTracks: chosen, provider: 'heuristic', action: { type: 'CREATE_PLAYLIST', label: 'Start Focus Flow Mix', payload: { title: 'Deep Focus & Flow', tracks: chosen } } };
    }
    if (cleanPrompt.includes('workout') || cleanPrompt.includes('energy') || cleanPrompt.includes('gym')) {
      const matching = tracks.filter((t) => t.genre === 'Synthwave' || t.genre === 'Electronic' || (t.bpm && t.bpm >= 120));
      const chosen = (matching.length > 0 ? matching : tracks).map(fmt);
      return { message: 'High-tempo rhythm structures loaded. Optimal heart-rate zone engaged.', reasoning: 'Selected >120 BPM electronic tracks.', suggestedTracks: chosen, provider: 'heuristic', action: { type: 'PLAY_TRACK', label: `Play ${chosen[0]?.title || 'Mix'}`, payload: chosen[0] } };
    }
    if (cleanPrompt.includes('rain') || cleanPrompt.includes('night') || cleanPrompt.includes('relax')) {
      const matching = tracks.filter((t) => t.genre === 'Lo-Fi' || t.genre === 'Classical' || t.mood === 'Chill');
      const chosen = (matching.length > 0 ? matching : tracks.slice(0, 2)).map(fmt);
      return { message: 'Evening ambience initialized. Analog warmth and acoustic solace prepared.', reasoning: 'Atmospheric resonance with reduced high-frequency fatigue.', suggestedTracks: chosen, provider: 'heuristic', action: { type: 'CREATE_PLAYLIST', label: 'Play Rainy Evening Session', payload: { title: 'Rainy Night Sanctuary', tracks: chosen } } };
    }

    const pick = fmt(tracks[Math.floor(Math.random() * tracks.length)]);
    return { message: `Analyzing your prompt. I recommend "${pick?.title}" by ${pick?.artist}.`, reasoning: 'Matched via AURA discovery engine.', suggestedTracks: [pick], provider: 'heuristic', action: { type: 'PLAY_TRACK', label: `Play ${pick?.title}`, payload: pick } };
  }

  // ============================================================
  // AI DJ SESSION
  // ============================================================

  async createDJSession(userId: string, initialPrompt?: string) {
    const session = await prisma.aISession.create({
      data: {
        userId,
        sessionType: 'dj',
        contextJson: JSON.stringify({
          prompt: initialPrompt || 'Play a great mix',
          playedTrackIds: [],
          energy: 0.5,
          mood: null,
        }),
      },
    });
    return session;
  }

  async getDJNextTrack(userId: string, sessionId: string, context?: {
    currentTrackId?: string;
    requestedMood?: string;
    requestedEnergy?: number;
  }): Promise<any> {
    const session = await prisma.aISession.findFirst({ where: { id: sessionId, userId } });
    if (!session) throw new Error('DJ session not found.');

    let ctx: any = {};
    try { ctx = JSON.parse(session.contextJson || '{}'); } catch {}

    const playedIds: string[] = ctx.playedTrackIds || [];
    if (context?.currentTrackId) playedIds.push(context.currentTrackId);

    const allTracks = await prisma.track.findMany({
      where: { id: { notIn: playedIds } },
      take: 50,
    });

    if (allTracks.length === 0) {
      // Playlist cycled — reset
      ctx.playedTrackIds = [];
      await prisma.aISession.update({ where: { id: sessionId }, data: { contextJson: JSON.stringify(ctx) } });
      return this.getDJNextTrack(userId, sessionId, context);
    }

    // Try LLM selection
    let nextTrack: any = null;
    if (ENV.GEMINI_API_KEY || ENV.OPENAI_API_KEY) {
      try {
        nextTrack = await this.llmSelectNextTrack(allTracks, ctx, context);
      } catch {}
    }

    if (!nextTrack) {
      // Fallback: pick by energy/mood matching
      nextTrack = this.heuristicNextTrack(allTracks, context?.requestedEnergy ?? ctx.energy ?? 0.5, context?.requestedMood ?? ctx.mood);
    }

    // Update session context
    ctx.playedTrackIds = playedIds;
    if (context?.requestedEnergy !== undefined) ctx.energy = context.requestedEnergy;
    if (context?.requestedMood) ctx.mood = context.requestedMood;

    await prisma.aISession.update({ where: { id: sessionId }, data: { contextJson: JSON.stringify(ctx), updatedAt: new Date() } });

    await prisma.aIRequest.create({
      data: {
        sessionId,
        prompt: `DJ next track. Energy: ${ctx.energy}, Mood: ${ctx.mood}`,
        responseJson: JSON.stringify({ trackId: nextTrack.id }),
        provider: 'heuristic',
      },
    });

    return {
      ...nextTrack,
      audioUrl: `/api/v1/tracks/${nextTrack.id}/stream`,
    };
  }

  private async llmSelectNextTrack(tracks: any[], ctx: any, context?: any) {
    const catalog = tracks.map((t) => `${t.id}: "${t.title}" (BPM: ${t.bpm ?? '?'}, Mood: ${t.mood ?? '?'}, Genre: ${t.genre})`).join('\n');
    const messages = [
      { role: 'system' as const, content: `You are an AI DJ. Select the best next track for a seamless mix. Current energy: ${ctx.energy}, mood: ${ctx.mood || 'any'}.\nAvailable:\n${catalog}\nRespond with JSON: { "trackId": "..." }` },
      { role: 'user' as const, content: context?.requestedMood ? `Play something ${context.requestedMood}` : 'Pick the next track' },
    ];
    const result = await aiProvider.complete(messages, 64);
    const parsed = extractJSON(result.text);
    if (!parsed?.trackId) throw new Error('No trackId');
    return tracks.find((t) => t.id === parsed.trackId) || null;
  }

  private heuristicNextTrack(tracks: any[], energy: number, mood?: string | null) {
    let candidates = tracks;
    if (mood) candidates = tracks.filter((t) => t.mood === mood) || tracks;
    if (candidates.length === 0) candidates = tracks;

    // Pick track with closest energy
    if (energy !== undefined) {
      candidates.sort((a, b) => {
        const da = Math.abs((a.energy ?? 0.5) - energy);
        const db = Math.abs((b.energy ?? 0.5) - energy);
        return da - db;
      });
    }
    return candidates[0];
  }

  async recordDJFeedback(userId: string, sessionId: string, trackId: string, feedback: 'like' | 'skip' | 'love') {
    const session = await prisma.aISession.findFirst({ where: { id: sessionId, userId } });
    if (!session) throw new Error('DJ session not found.');

    // Adjust energy based on feedback
    let ctx: any = {};
    try { ctx = JSON.parse(session.contextJson || '{}'); } catch {}

    if (feedback === 'love') ctx.energy = Math.min(1, (ctx.energy || 0.5) + 0.05);
    if (feedback === 'skip') ctx.energy = Math.max(0, (ctx.energy || 0.5) - 0.1);

    await prisma.aISession.update({ where: { id: sessionId }, data: { contextJson: JSON.stringify(ctx) } });

    return { success: true, adjustedEnergy: ctx.energy };
  }

  // ============================================================
  // NATURAL LANGUAGE PLAYLIST GENERATION
  // ============================================================

  async generatePlaylist(userId: string, prompt: string, options?: { maxTracks?: number; createPlaylist?: boolean }) {
    const maxTracks = Math.min(50, options?.maxTracks || 20);
    const tracks = await prisma.track.findMany({ take: 200 });

    let result: any = null;

    if (ENV.GEMINI_API_KEY || ENV.OPENAI_API_KEY) {
      try {
        result = await this.llmGeneratePlaylist(prompt, tracks, maxTracks);
      } catch (err) {
        console.warn('LLM playlist generation failed, using heuristic:', err);
      }
    }

    if (!result) {
      result = this.heuristicGeneratePlaylist(prompt, tracks, maxTracks);
    }

    // Optionally save as playlist
    if (options?.createPlaylist && userId) {
      const playlist = await prisma.playlist.create({
        data: {
          title: result.title,
          description: result.description,
          ownerId: userId,
          isPublic: false,
          isAIGenerated: true,
          tracks: {
            create: result.tracks.map((t: any, idx: number) => ({
              trackId: t.id,
              position: idx,
              addedById: userId,
            })),
          },
        },
      });
      result.playlistId = playlist.id;
    }

    await prisma.aIRequest.create({
      data: {
        sessionId: `${userId}-pl-gen`,
        prompt,
        responseJson: JSON.stringify({ trackCount: result.tracks.length }),
        provider: result.provider || 'heuristic',
      },
    }).catch(() => {}); // non-blocking

    return result;
  }

  private async llmGeneratePlaylist(prompt: string, tracks: any[], maxTracks: number) {
    const catalog = tracks
      .map((t) => `${t.id}: "${t.title}" by ${t.artist} (${t.genre}, ${t.bpm ?? '?'}BPM, Mood: ${t.mood ?? '?'}, ${t.duration}s)`)
      .join('\n');

    const messages = [
      {
        role: 'system' as const,
        content: `You are AURA, an AI music curator. Generate a playlist from the catalog below.
Catalog:
${catalog}

Respond ONLY with valid JSON:
{
  "title": "playlist title",
  "description": "1-2 sentence description",
  "reasoning": "selection criteria",
  "mood": "overall mood",
  "energyProfile": "low | medium | high | progressive",
  "trackIds": ["id1", "id2", ...]
}
Only use IDs from the catalog. Select up to ${maxTracks} tracks. Do NOT invent tracks.`,
      },
      { role: 'user' as const, content: prompt },
    ];

    const result = await aiProvider.complete(messages, 1024);
    const parsed = extractJSON(result.text);
    if (!parsed?.trackIds) throw new Error('Invalid LLM response');

    const selected = tracks.filter((t) => parsed.trackIds.includes(t.id)).slice(0, maxTracks);
    const totalDuration = selected.reduce((s: number, t: any) => s + t.duration, 0);

    return {
      title: parsed.title || 'AI Mix',
      description: parsed.description || '',
      reasoning: parsed.reasoning || '',
      mood: parsed.mood || '',
      energyProfile: parsed.energyProfile || 'medium',
      tracks: selected.map((t) => ({ ...t, audioUrl: `/api/v1/tracks/${t.id}/stream` })),
      estimatedDuration: totalDuration,
      provider: result.provider,
    };
  }

  private heuristicGeneratePlaylist(prompt: string, tracks: any[], maxTracks: number) {
    const p = prompt.toLowerCase();
    let filtered = tracks;
    let title = 'AURA Mix';
    let description = 'A curated collection';
    let mood = 'Mixed';
    let energyProfile = 'medium';

    if (p.includes('study') || p.includes('focus') || p.includes('work')) {
      filtered = tracks.filter((t) => ['Lo-Fi', 'Ambient', 'Classical'].includes(t.genre) || t.mood === 'Focus');
      title = 'Focus & Flow';
      description = 'Instrumental tracks for deep concentration.';
      mood = 'Focus';
      energyProfile = 'low';
    } else if (p.includes('workout') || p.includes('gym') || p.includes('energy')) {
      filtered = tracks.filter((t) => (t.bpm ?? 0) >= 120 || ['Electronic', 'Synthwave'].includes(t.genre));
      title = 'Workout Power Mix';
      description = 'High-energy tracks to push your limits.';
      mood = 'Energy';
      energyProfile = 'high';
    } else if (p.includes('chill') || p.includes('relax') || p.includes('evening')) {
      filtered = tracks.filter((t) => t.mood === 'Chill' || ['Lo-Fi', 'Ambient'].includes(t.genre));
      title = 'Chill Vibes';
      description = 'Calm, relaxing soundscapes for unwinding.';
      mood = 'Chill';
      energyProfile = 'low';
    } else if (p.includes('night') || p.includes('dark') || p.includes('late')) {
      filtered = tracks.filter((t) => ['Synthwave', 'Electronic', 'Darkwave'].includes(t.genre));
      title = 'Late Night Drive';
      description = 'Atmospheric tracks for the nocturnal journey.';
      mood = 'Night';
      energyProfile = 'medium';
    }

    if (filtered.length < 3) filtered = tracks;
    const selected = filtered.slice(0, maxTracks);
    const totalDuration = selected.reduce((s: number, t: any) => s + t.duration, 0);

    return {
      title,
      description,
      reasoning: 'Matched by mood, genre, and energy keywords.',
      mood,
      energyProfile,
      tracks: selected.map((t) => ({ ...t, audioUrl: `/api/v1/tracks/${t.id}/stream` })),
      estimatedDuration: totalDuration,
      provider: 'heuristic',
    };
  }
}

export const aiService = new AIService();
