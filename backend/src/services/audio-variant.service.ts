/**
 * AudioVariant Service
 * Manages audio quality variants per track.
 * Quality tiers: STANDARD | HIGH | LOSSLESS | HI_RES_LOSSLESS
 *
 * IMPORTANT:
 * Do NOT convert MP3, AAC, OGG, or other lossy audio into FLAC and label it "lossless".
 * Preserves actual source quality and provides variant selection.
 */

import { prisma } from './prisma.js';
import { QualityTier } from './audioValidation.service.js';

export type QualityPreference = 'AUTO' | 'STANDARD' | 'HIGH' | 'LOSSLESS' | 'HI_RES_LOSSLESS';

const TIER_PRIORITY: Record<QualityTier, number> = {
  STANDARD: 1,
  HIGH: 2,
  LOSSLESS: 3,
  HI_RES_LOSSLESS: 4,
};

const PREF_TO_TARGET_TIER: Record<QualityPreference, number> = {
  AUTO: 3, // Defaults to lossless if available without straining
  STANDARD: 1,
  HIGH: 2,
  LOSSLESS: 3,
  HI_RES_LOSSLESS: 4,
};

export class AudioVariantService {
  /**
   * Create or update an audio variant for a track.
   */
  async upsertVariant(data: {
    trackId: string;
    qualityTier: QualityTier;
    codec: string;
    container?: string;
    bitrate?: number;
    sampleRate?: number;
    bitDepth?: number;
    channels?: number;
    fileSize?: number;
    fileUrl: string;
    storageObjectId?: string;
    isLossless?: boolean;
    isGenuineLossless?: boolean;
    validationNotes?: string;
    mimeType: string;
    isDefault?: boolean;
  }) {
    // Check if variant for track + qualityTier exists
    const existing = await prisma.audioVariant.findFirst({
      where: {
        trackId: data.trackId,
        qualityTier: data.qualityTier,
      },
    });

    if (existing) {
      return prisma.audioVariant.update({
        where: { id: existing.id },
        data: {
          codec: data.codec,
          container: data.container,
          bitrate: data.bitrate,
          sampleRate: data.sampleRate,
          bitDepth: data.bitDepth,
          channels: data.channels ?? 2,
          fileSize: data.fileSize,
          fileUrl: data.fileUrl,
          storageObjectId: data.storageObjectId,
          isLossless: data.isLossless ?? false,
          isGenuineLossless: data.isGenuineLossless ?? false,
          validationNotes: data.validationNotes,
          mimeType: data.mimeType,
          isDefault: data.isDefault ?? false,
        },
      });
    }

    return prisma.audioVariant.create({
      data: {
        trackId: data.trackId,
        qualityTier: data.qualityTier,
        codec: data.codec,
        container: data.container,
        bitrate: data.bitrate,
        sampleRate: data.sampleRate,
        bitDepth: data.bitDepth,
        channels: data.channels ?? 2,
        fileSize: data.fileSize,
        fileUrl: data.fileUrl,
        storageObjectId: data.storageObjectId,
        isLossless: data.isLossless ?? false,
        isGenuineLossless: data.isGenuineLossless ?? false,
        validationNotes: data.validationNotes,
        mimeType: data.mimeType,
        isDefault: data.isDefault ?? false,
      },
    });
  }

  /**
   * Get all available variants for a track.
   */
  async getVariants(trackId: string) {
    return prisma.audioVariant.findMany({
      where: { trackId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Select the best variant for a given quality preference.
   * If user requests LOSSLESS:
   *   FLAC/WAV available?
   *   YES -> stream lossless
   *   NO -> use highest available legitimate quality (do not fake lossless)
   */
  async selectVariant(trackId: string, preference: QualityPreference = 'AUTO') {
    const variants = await this.getVariants(trackId);

    if (variants.length === 0) {
      return null;
    }

    const normalizedPref = (preference.toUpperCase() as QualityPreference) || 'AUTO';
    const targetPriority = PREF_TO_TARGET_TIER[normalizedPref] ?? 3;

    // Filter to variants matching or below the target priority
    // For LOSSLESS or HI_RES_LOSSLESS, we want the highest quality available <= requested
    const eligible = variants.filter((v) => {
      const tier = (v.qualityTier.toUpperCase() as QualityTier) || 'STANDARD';
      const tierPriority = TIER_PRIORITY[tier] || 1;
      return tierPriority <= targetPriority;
    });

    if (eligible.length > 0) {
      // Sort descending by priority to get highest eligible
      eligible.sort((a, b) => {
        const pA = TIER_PRIORITY[a.qualityTier.toUpperCase() as QualityTier] || 1;
        const pB = TIER_PRIORITY[b.qualityTier.toUpperCase() as QualityTier] || 1;
        return pB - pA;
      });
      return eligible[0];
    }

    // Fallback: return default or highest available variant
    const defaultVariant = variants.find((v) => v.isDefault);
    if (defaultVariant) return defaultVariant;

    return variants.sort((a, b) => {
      const pA = TIER_PRIORITY[a.qualityTier.toUpperCase() as QualityTier] || 1;
      const pB = TIER_PRIORITY[b.qualityTier.toUpperCase() as QualityTier] || 1;
      return pB - pA;
    })[0];
  }

  /**
   * Format variant for API responses.
   */
  formatVariant(v: any) {
    return {
      id: v.id,
      trackId: v.trackId,
      qualityTier: v.qualityTier.toUpperCase(),
      codec: v.codec,
      container: v.container,
      bitrate: v.bitrate,
      sampleRate: v.sampleRate,
      bitDepth: v.bitDepth,
      channels: v.channels,
      fileSize: v.fileSize,
      mimeType: v.mimeType,
      isLossless: v.isLossless,
      isGenuineLossless: v.isGenuineLossless,
      validationNotes: v.validationNotes,
      isDefault: v.isDefault,
      streamUrl: v.fileUrl.startsWith('http')
        ? v.fileUrl
        : `/api/v1/tracks/${v.trackId}/stream?tier=${v.qualityTier}`,
    };
  }
}

export const audioVariantService = new AudioVariantService();
