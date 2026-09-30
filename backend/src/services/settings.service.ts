/**
 * Settings Service
 * Manages EQ presets, Visualizer presets, and user audio-lab settings.
 * Cross-device sync — all settings are stored in the database.
 *
 * IMPORTANT: Audio processing (EQ, reverb, spatial) happens client-side via Web Audio API.
 * This service only stores user preference data for synchronization.
 */

import { prisma } from './prisma.js';

// ============================================================
// SYSTEM EQ PRESETS (seeded at startup)
// ============================================================

export const SYSTEM_EQ_PRESETS = [
  { name: 'Flat', bands: [0,0,0,0,0,0,0,0,0,0], bassBoost: 0, treble: 0, stereoPan: 0, reverbLevel: 0 },
  { name: 'Bass Boost', bands: [6,5,4,2,0,-1,-1,0,0,0], bassBoost: 6, treble: 0, stereoPan: 0, reverbLevel: 0 },
  { name: 'Treble Boost', bands: [0,0,0,0,0,0,1,2,4,6], bassBoost: 0, treble: 6, stereoPan: 0, reverbLevel: 0 },
  { name: 'Vocal', bands: [-2,-1,0,2,4,4,2,1,0,-1], bassBoost: 0, treble: 2, stereoPan: 0, reverbLevel: 0 },
  { name: 'Classical', bands: [0,0,0,0,0,0,0,-2,-4,-4], bassBoost: 0, treble: -2, stereoPan: 0, reverbLevel: 0.2 },
  { name: 'Electronic', bands: [4,3,0,-2,-3,0,2,3,4,4], bassBoost: 4, treble: 3, stereoPan: 0, reverbLevel: 0 },
  { name: 'Rock', bands: [3,2,1,0,-2,0,1,2,3,3], bassBoost: 3, treble: 2, stereoPan: 0, reverbLevel: 0 },
  { name: 'Jazz', bands: [2,2,1,0,-2,-2,0,1,2,3], bassBoost: 2, treble: 1, stereoPan: 0, reverbLevel: 0.1 },
  { name: 'Lo-Fi', bands: [3,2,0,-2,-3,-3,-2,0,0,-2], bassBoost: 3, treble: -2, stereoPan: 0, reverbLevel: 0.3 },
  { name: 'Acoustic', bands: [2,1,0,1,2,2,1,1,2,2], bassBoost: 1, treble: 2, stereoPan: 0, reverbLevel: 0.1 },
];

// ============================================================
// SYSTEM VISUALIZER PRESETS
// ============================================================

export const SYSTEM_VISUALIZER_PRESETS = [
  { name: 'Spectrum', mode: 'spectrum', config: null },
  { name: 'Waveform', mode: 'waveform', config: null },
  { name: 'Circular', mode: 'circular', config: null },
  { name: 'Particles', mode: 'particles', config: null },
  { name: 'Ambient', mode: 'ambient', config: null },
  { name: 'Pulse', mode: 'pulse', config: null },
  { name: 'Reactive Artwork', mode: 'reactive', config: null },
];

export class SettingsService {
  // ============================================================
  // EQ PRESETS
  // ============================================================

  async getEQPresets(userId: string) {
    const [system, user] = await Promise.all([
      prisma.eQPreset.findMany({ where: { isSystem: true }, orderBy: { name: 'asc' } }),
      prisma.eQPreset.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    ]);
    return { system: system.map(this.formatPreset), user: user.map(this.formatPreset) };
  }

  async createEQPreset(
    userId: string,
    data: { name: string; bands: number[]; bassBoost?: number; treble?: number; stereoPan?: number; reverbLevel?: number }
  ) {
    if (data.bands.length !== 10) throw new Error('EQ must have exactly 10 bands.');
    return prisma.eQPreset.create({
      data: {
        userId,
        name: data.name,
        bands: JSON.stringify(data.bands),
        bassBoost: data.bassBoost ?? 0,
        treble: data.treble ?? 0,
        stereoPan: data.stereoPan ?? 0,
        reverbLevel: data.reverbLevel ?? 0,
        isSystem: false,
      },
    });
  }

  async updateEQPreset(userId: string, id: string, data: Partial<{ name: string; bands: number[]; bassBoost: number; treble: number; stereoPan: number; reverbLevel: number }>) {
    const preset = await prisma.eQPreset.findFirst({ where: { id, userId, isSystem: false } });
    if (!preset) throw new Error('Preset not found or not editable.');

    return prisma.eQPreset.update({
      where: { id },
      data: {
        ...data,
        bands: data.bands ? JSON.stringify(data.bands) : undefined,
      },
    });
  }

  async deleteEQPreset(userId: string, id: string) {
    const preset = await prisma.eQPreset.findFirst({ where: { id, userId, isSystem: false } });
    if (!preset) throw new Error('Preset not found or not deletable.');
    await prisma.eQPreset.delete({ where: { id } });
    return { success: true };
  }

  // ============================================================
  // VISUALIZER PRESETS
  // ============================================================

  async getVisualizerPresets(userId: string) {
    const [system, user] = await Promise.all([
      prisma.visualizerPreset.findMany({ where: { isSystem: true }, orderBy: { name: 'asc' } }),
      prisma.visualizerPreset.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    ]);
    return { system, user };
  }

  async createVisualizerPreset(userId: string, data: { name: string; mode: string; config?: object }) {
    return prisma.visualizerPreset.create({
      data: {
        userId,
        name: data.name,
        mode: data.mode,
        config: data.config ? JSON.stringify(data.config) : null,
        isSystem: false,
      },
    });
  }

  async updateVisualizerPreset(userId: string, id: string, data: { name?: string; mode?: string; config?: object }) {
    const preset = await prisma.visualizerPreset.findFirst({ where: { id, userId, isSystem: false } });
    if (!preset) throw new Error('Visualizer preset not found or not editable.');
    return prisma.visualizerPreset.update({
      where: { id },
      data: {
        ...data,
        config: data.config ? JSON.stringify(data.config) : undefined,
      },
    });
  }

  async deleteVisualizerPreset(userId: string, id: string) {
    const preset = await prisma.visualizerPreset.findFirst({ where: { id, userId, isSystem: false } });
    if (!preset) throw new Error('Preset not found or not deletable.');
    await prisma.visualizerPreset.delete({ where: { id } });
    return { success: true };
  }

  // ============================================================
  // AUDIO LAB SETTINGS (cross-device sync)
  // ============================================================

  async getAudioLabSettings(userId: string) {
    const prefs = await prisma.userPreference.findUnique({ where: { userId } });
    if (!prefs) throw new Error('User preferences not found.');

    let bands: number[] = [0,0,0,0,0,0,0,0,0,0];
    try {
      bands = JSON.parse(prefs.eqBands);
    } catch {}

    return {
      bands,
      bassBoost: prefs.bassBoost,
      treble: prefs.treble,
      stereoPan: prefs.stereoPan,
      reverbLevel: prefs.reverbLevel,
      isBypassed: prefs.eqBypassed,
      preset: prefs.eqPreset,
      streamingQuality: prefs.streamingQuality,
      spatialAudioEnabled: prefs.spatialAudioEnabled,
      crossfadeDuration: prefs.crossfadeDuration,
      smartTransitions: prefs.smartTransitions,
    };
  }

  async updateAudioLabSettings(userId: string, data: Partial<{
    bands: number[];
    bassBoost: number;
    treble: number;
    stereoPan: number;
    reverbLevel: number;
    isBypassed: boolean;
    preset: string;
    streamingQuality: string;
    spatialAudioEnabled: boolean;
    crossfadeDuration: number;
    smartTransitions: boolean;
  }>) {
    const updateData: Record<string, unknown> = {};
    if (data.bands !== undefined) updateData.eqBands = JSON.stringify(data.bands);
    if (data.bassBoost !== undefined) updateData.bassBoost = data.bassBoost;
    if (data.treble !== undefined) updateData.treble = data.treble;
    if (data.stereoPan !== undefined) updateData.stereoPan = data.stereoPan;
    if (data.reverbLevel !== undefined) updateData.reverbLevel = data.reverbLevel;
    if (data.isBypassed !== undefined) updateData.eqBypassed = data.isBypassed;
    if (data.preset !== undefined) updateData.eqPreset = data.preset;
    if (data.streamingQuality !== undefined) updateData.streamingQuality = data.streamingQuality;
    if (data.spatialAudioEnabled !== undefined) updateData.spatialAudioEnabled = data.spatialAudioEnabled;
    if (data.crossfadeDuration !== undefined) updateData.crossfadeDuration = data.crossfadeDuration;
    if (data.smartTransitions !== undefined) updateData.smartTransitions = data.smartTransitions;

    await prisma.userPreference.upsert({
      where: { userId },
      update: updateData,
      create: { userId, ...(updateData as any) },
    });

    return { success: true };
  }

  // ============================================================
  // SEED SYSTEM PRESETS (called once at server startup)
  // ============================================================

  async seedSystemPresets() {
    // EQ
    for (const p of SYSTEM_EQ_PRESETS) {
      await prisma.eQPreset.upsert({
        where: { id: `sys-eq-${p.name.toLowerCase().replace(/\s/g, '-')}` },
        update: {},
        create: {
          id: `sys-eq-${p.name.toLowerCase().replace(/\s/g, '-')}`,
          name: p.name,
          bands: JSON.stringify(p.bands),
          bassBoost: p.bassBoost,
          treble: p.treble,
          stereoPan: p.stereoPan,
          reverbLevel: p.reverbLevel,
          isSystem: true,
        },
      });
    }
    // Visualizer
    for (const v of SYSTEM_VISUALIZER_PRESETS) {
      await prisma.visualizerPreset.upsert({
        where: { id: `sys-viz-${v.mode}` },
        update: {},
        create: {
          id: `sys-viz-${v.mode}`,
          name: v.name,
          mode: v.mode,
          isSystem: true,
        },
      });
    }
  }

  private formatPreset(p: any) {
    let bands: number[] = [];
    try { bands = JSON.parse(p.bands); } catch {}
    return { ...p, bands };
  }
}

export const settingsService = new SettingsService();
