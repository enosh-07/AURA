/**
 * AURA Provider Capability System
 * ===============================
 * Authoritative registry defining upstream provider capabilities, supported codecs,
 * audio quality tiers, licensing status, authentication requirements, and Atmos availability.
 *
 * Prevents simulated quality, false lossless claims, and unverified spatial badges.
 */

import { QualityTier } from './music-provider.interface.js';

export type AuthRequirement = 'NONE' | 'USER_UPLOAD' | 'API_KEY' | 'OAUTH' | 'UNOFFICIAL_PROXY';

export interface ProviderCapability {
  id: string;
  displayName: string;
  sourceType: 'LOCAL_STORAGE' | 'USER_UPLOAD' | 'COMMERCIAL_CDN' | 'OPEN_ARCHIVE' | 'UNKNOWN';
  supportedCodecs: string[];
  supportedContainers: string[];
  supportedTiers: QualityTier[];
  maxBitrateKbps: number;
  maxSampleRateHz: number;
  maxBitDepth: number | null; // null for lossy
  isLosslessSupported: boolean;
  isHiResSupported: boolean;
  isDolbyAtmosSupplied: boolean;
  authRequirement: AuthRequirement;
  licensingTerms: string;
  notes: string;
}

export const PROVIDER_CAPABILITIES: Record<string, ProviderCapability> = {
  local: {
    id: 'local',
    displayName: 'AURA High-Fidelity Local Vault',
    sourceType: 'LOCAL_STORAGE',
    supportedCodecs: ['FLAC', 'ALAC', 'PCM', 'WAV', 'AIFF', 'AAC', 'MP3'],
    supportedContainers: ['FLAC', 'M4A', 'WAVE', 'AIFF', 'MPEG'],
    supportedTiers: ['STANDARD', 'HIGH', 'LOSSLESS', 'HI_RES_LOSSLESS'],
    maxBitrateKbps: 9216, // 24-bit 192kHz Stereo PCM
    maxSampleRateHz: 192000,
    maxBitDepth: 24,
    isLosslessSupported: true,
    isHiResSupported: true,
    isDolbyAtmosSupplied: false, // Local files default to stereo unless verified multi-channel/ADM BWF
    authRequirement: 'USER_UPLOAD',
    licensingTerms: 'User-owned and local storage files. Permitted for private personal playback.',
    notes: 'Direct bit-perfect streaming from local storage. Master FLAC/WAV files preserved without re-encoding.',
  },

  jiosaavn: {
    id: 'jiosaavn',
    displayName: 'JioSaavn Music Stream',
    sourceType: 'COMMERCIAL_CDN',
    supportedCodecs: ['AAC', 'MP3'],
    supportedContainers: ['M4A', 'MP4', 'MPEG'],
    supportedTiers: ['STANDARD', 'HIGH'],
    maxBitrateKbps: 320,
    maxSampleRateHz: 44100,
    maxBitDepth: null, // Perceptual MDCT lossy encoding has no discrete bit depth
    isLosslessSupported: false,
    isHiResSupported: false,
    isDolbyAtmosSupplied: false,
    authRequirement: 'UNOFFICIAL_PROXY',
    licensingTerms: 'JioSaavn public catalog streams. Upstream delivers 320 kbps AAC via Akamai Edge. Terms do not permit commercial redistribution.',
    notes: 'Authentic 320 kbps AAC stream. Upstream provider does not support lossless FLAC, Hi-Res masters, or Dolby Atmos.',
  },

  audius: {
    id: 'audius',
    displayName: 'Audius Decentralized Network',
    sourceType: 'OPEN_ARCHIVE',
    supportedCodecs: ['MP3'],
    supportedContainers: ['MPEG'],
    supportedTiers: ['STANDARD', 'HIGH'],
    maxBitrateKbps: 320,
    maxSampleRateHz: 44100,
    maxBitDepth: null,
    isLosslessSupported: false,
    isHiResSupported: false,
    isDolbyAtmosSupplied: false,
    authRequirement: 'NONE',
    licensingTerms: 'Audius open API terms for verified client applications.',
    notes: 'Community-uploaded MP3 audio up to 320 kbps CBR/VBR. No lossless streams available.',
  },

  open_archive: {
    id: 'open_archive',
    displayName: 'Open Audio Archive & Free Music Archive',
    sourceType: 'OPEN_ARCHIVE',
    supportedCodecs: ['FLAC', 'MP3', 'OGG'],
    supportedContainers: ['FLAC', 'MPEG', 'OGG'],
    supportedTiers: ['STANDARD', 'HIGH', 'LOSSLESS'],
    maxBitrateKbps: 1411,
    maxSampleRateHz: 44100,
    maxBitDepth: 16,
    isLosslessSupported: true,
    isHiResSupported: false,
    isDolbyAtmosSupplied: false,
    authRequirement: 'NONE',
    licensingTerms: 'Creative Commons / Public Domain archival audio.',
    notes: 'Legitimate open-access FLAC masters preserved for non-commercial streaming.',
  },

  qobuz: {
    id: 'qobuz',
    displayName: 'Qobuz Hi-Res Master Streaming',
    sourceType: 'COMMERCIAL_CDN',
    supportedCodecs: ['FLAC'],
    supportedContainers: ['FLAC'],
    supportedTiers: ['STANDARD', 'HIGH', 'LOSSLESS', 'HI_RES_LOSSLESS'],
    maxBitrateKbps: 9216,
    maxSampleRateHz: 192000,
    maxBitDepth: 24,
    isLosslessSupported: true,
    isHiResSupported: true,
    isDolbyAtmosSupplied: false,
    authRequirement: 'OAUTH',
    licensingTerms: 'Official Qobuz API Partner Agreement required. Requires active Studio/Sublime subscriber credentials and signed application secrets.',
    notes: 'Official authorized high-resolution FLAC streaming up to 24-bit 192kHz. Unofficial scraping without API credentials violates terms of service.',
  },

  tidal: {
    id: 'tidal',
    displayName: 'TIDAL HiFi & Max Catalog',
    sourceType: 'COMMERCIAL_CDN',
    supportedCodecs: ['FLAC', 'AAC'],
    supportedContainers: ['FLAC', 'M4A'],
    supportedTiers: ['STANDARD', 'HIGH', 'LOSSLESS', 'HI_RES_LOSSLESS'],
    maxBitrateKbps: 9216,
    maxSampleRateHz: 192000,
    maxBitDepth: 24,
    isLosslessSupported: true,
    isHiResSupported: true,
    isDolbyAtmosSupplied: true, // Multi-channel E-AC-3 JOC Dolby Atmos stream available with licensed decoders
    authRequirement: 'OAUTH',
    licensingTerms: 'TIDAL Developer Platform API License. Streaming requires Widevine / FairPlay Encrypted Media Extensions (EME) DRM playback engine.',
    notes: 'Supports authentic 24-bit/192kHz Hi-Res FLAC and discrete Dolby Atmos object mixes. Restricted by DRM pipeline in standard web browsers.',
  },
};

/**
 * Retrieve capabilities for a given provider
 */
export function getProviderCapability(providerName?: string): ProviderCapability {
  if (!providerName) return PROVIDER_CAPABILITIES.local;
  const normalized = providerName.toLowerCase().trim();
  return PROVIDER_CAPABILITIES[normalized] || {
    id: normalized,
    displayName: `${providerName} (Third-Party Source)`,
    sourceType: 'UNKNOWN',
    supportedCodecs: ['UNKNOWN'],
    supportedContainers: ['UNKNOWN'],
    supportedTiers: ['STANDARD', 'HIGH'],
    maxBitrateKbps: 320,
    maxSampleRateHz: 44100,
    maxBitDepth: null,
    isLosslessSupported: false,
    isHiResSupported: false,
    isDolbyAtmosSupplied: false,
    authRequirement: 'NONE',
    licensingTerms: 'Unverified provider terms.',
    notes: 'Provider capabilities could not be authoritatively validated.',
  };
}

/**
 * Checks whether a provider genuinely supports a requested quality tier
 */
export function canProviderDeliverTier(providerName: string, requestedTier: string): boolean {
  const cap = getProviderCapability(providerName);
  const normalized = requestedTier.toUpperCase() as QualityTier;
  return cap.supportedTiers.includes(normalized);
}

/**
 * Generates an authoritative, honest explanation for quality mismatches
 */
export function explainQualityMismatch(
  providerName: string,
  requestedTier: string,
  deliveredTier: string,
  deliveredCodec: string
): string {
  const cap = getProviderCapability(providerName);

  if (requestedTier === 'HI_RES_LOSSLESS' && deliveredTier === 'LOSSLESS') {
    return `Studio Master (24-bit/96kHz) is unavailable for this recording. Playing authentic Red Book CD-quality Lossless (${deliveredCodec}).`;
  }

  if ((requestedTier === 'LOSSLESS' || requestedTier === 'HI_RES_LOSSLESS') && !cap.isLosslessSupported) {
    return `${cap.displayName} supplies native ${cap.maxBitrateKbps} kbps ${deliveredCodec} audio only. Upstream provider does not support lossless FLAC masters. AURA preserves the native stream without artificial transcoding.`;
  }

  if (deliveredTier === 'STANDARD' && requestedTier !== 'STANDARD') {
    return `Stream bandwidth or provider limits delivered audio to Standard Quality (${deliveredCodec}).`;
  }

  return `Delivering ${deliveredTier} audio via ${cap.displayName}.`;
}
