/**
 * AURA Audio Profile Service
 * Manages database persistence, retrieval, and updates for Track AudioProfiles.
 * Synchronizes key features (BPM, musicalKey, mood, energy) back to the Track entity
 * to power recommendations, AI DJ transitions, and visualizers.
 */

import path from 'path';
import fs from 'fs';
import { prisma } from '../prisma.js';
import { audioPipelineService } from './audio-pipeline.service.js';
import { AudioProfileOutput } from './audio-intelligence.types.js';

export class AudioProfileService {
  /**
   * Retrieves an audio profile by trackId
   */
  public async getProfileByTrackId(trackId: string): Promise<AudioProfileOutput | null> {
    const profile = await (prisma as any).audioProfile.findUnique({
      where: { trackId },
    });
    if (!profile) return null;

    return {
      ...profile,
      spectralFeatures: profile.spectralFeatures,
    } as AudioProfileOutput;
  }

  /**
   * Upserts an audio profile in the database and updates track metadata
   */
  public async saveProfile(profile: AudioProfileOutput): Promise<AudioProfileOutput> {
    const saved = await (prisma as any).audioProfile.upsert({
      where: { trackId: profile.trackId },
      create: {
        trackId: profile.trackId,
        bpm: profile.bpm,
        bpmConfidence: profile.bpmConfidence,
        danceability: profile.danceability,
        musicalKey: profile.musicalKey,
        keyConfidence: profile.keyConfidence,
        camelotKey: profile.camelotKey,
        scale: profile.scale,
        integratedLoudness: profile.integratedLoudness,
        loudnessRange: profile.loudnessRange,
        truePeak: profile.truePeak,
        dynamicRange: profile.dynamicRange,
        energy: profile.energy,
        valence: profile.valence,
        acousticness: profile.acousticness,
        instrumentalness: profile.instrumentalness,
        speechRatio: profile.speechRatio,
        spectralCentroid: profile.spectralCentroid,
        spectralRolloff: profile.spectralRolloff,
        spectralFlatness: profile.spectralFlatness,
        spectralSpread: profile.spectralSpread,
        spectralFeatures: profile.spectralFeatures,
        primaryMood: profile.primaryMood,
        secondaryMood: profile.secondaryMood,
        detectedGenre: profile.detectedGenre,
        genreConfidence: profile.genreConfidence,
        fingerprint: profile.fingerprint,
        fingerprintRaw: profile.fingerprintRaw,
        durationMs: profile.durationMs,
        analyzedAt: profile.analyzedAt,
        analyzerVersion: profile.analyzerVersion,
        analysisSource: profile.analysisSource,
        isComplete: profile.isComplete,
      },
      update: {
        bpm: profile.bpm,
        bpmConfidence: profile.bpmConfidence,
        danceability: profile.danceability,
        musicalKey: profile.musicalKey,
        keyConfidence: profile.keyConfidence,
        camelotKey: profile.camelotKey,
        scale: profile.scale,
        integratedLoudness: profile.integratedLoudness,
        loudnessRange: profile.loudnessRange,
        truePeak: profile.truePeak,
        dynamicRange: profile.dynamicRange,
        energy: profile.energy,
        valence: profile.valence,
        acousticness: profile.acousticness,
        instrumentalness: profile.instrumentalness,
        speechRatio: profile.speechRatio,
        spectralCentroid: profile.spectralCentroid,
        spectralRolloff: profile.spectralRolloff,
        spectralFlatness: profile.spectralFlatness,
        spectralSpread: profile.spectralSpread,
        spectralFeatures: profile.spectralFeatures,
        primaryMood: profile.primaryMood,
        secondaryMood: profile.secondaryMood,
        detectedGenre: profile.detectedGenre,
        genreConfidence: profile.genreConfidence,
        fingerprint: profile.fingerprint,
        fingerprintRaw: profile.fingerprintRaw,
        durationMs: profile.durationMs,
        analyzedAt: profile.analyzedAt,
        analyzerVersion: profile.analyzerVersion,
        analysisSource: profile.analysisSource,
        isComplete: profile.isComplete,
      },
    });

    // Synchronize detected features to Track entity
    try {
      await prisma.track.update({
        where: { id: profile.trackId },
        data: {
          bpm: profile.bpm ? Math.round(profile.bpm) : undefined,
          musicalKey: profile.musicalKey || undefined,
          mood: profile.primaryMood || undefined,
          energy: profile.energy ?? undefined,
          genre: profile.detectedGenre || undefined,
        },
      });
    } catch (err) {
      console.warn('[AudioProfileService] Could not sync back to Track record:', err);
    }

    return saved as AudioProfileOutput;
  }

  /**
   * Executes analysis pipeline for a track and saves the resulting profile
   */
  public async analyzeAndSaveTrack(
    trackId: string,
    explicitFilePath?: string
  ): Promise<AudioProfileOutput | null> {
    const track = await prisma.track.findUnique({
      where: { id: trackId },
    });

    if (!track) {
      throw new Error(`Track ${trackId} not found`);
    }

    let filePath = explicitFilePath;
    if (!filePath) {
      // Resolve path in uploads directory
      const uploadsDir = path.resolve(process.cwd(), 'uploads');
      const candidatePath = path.join(uploadsDir, track.audioFileUrl);
      if (fs.existsSync(candidatePath)) {
        filePath = candidatePath;
      }
    }

    if (!filePath || !fs.existsSync(filePath)) {
      console.warn(`[AudioProfileService] Local audio file not available on disk for track ${trackId}`);
      return null;
    }

    const { profile } = await audioPipelineService.analyzeAudio({
      filePath,
      trackId: track.id,
      originalFilename: track.title,
      sourceType: track.sourceType || 'USER_UPLOAD',
      metadataHints: {
        title: track.title,
        artist: track.artist,
        album: track.album,
        genre: track.genre,
        bpm: track.bpm || undefined,
        key: track.musicalKey || undefined,
      },
    });

    return this.saveProfile(profile);
  }
}

export const audioProfileService = new AudioProfileService();
