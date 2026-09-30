import { create } from 'zustand';
import { AudioLabSettings } from '../types/audio';
import { audioEngine } from '../audio/AudioEngine';
import { apiClient } from '../services/apiClient';

export interface EQPreset {
  id?: string;
  name: string;
  description?: string;
  bands: number[]; // 10 values in dB (-12 to +12)
  bassBoost?: number;
  treble?: number;
  isCustom?: boolean;
}

export const EQ_PRESETS: EQPreset[] = [
  {
    name: 'Flat Studio',
    description: 'Neutral, transparent, uncolored studio response',
    bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    bassBoost: 0,
    treble: 0,
  },
  {
    name: 'AURA Signature',
    description: 'Punchy low-end, scooped mids, and shimmering highs',
    bands: [4.5, 3.5, 1.5, -1.0, -0.5, 1.0, 2.5, 3.0, 4.0, 4.5],
    bassBoost: 3.5,
    treble: 2.0,
  },
  {
    name: 'Bass Heavy',
    description: 'Sub-bass rumble and punch for electronic & hip-hop',
    bands: [7.0, 6.0, 4.5, 2.0, 0, -1.0, -1.0, 0, 1.0, 1.5],
    bassBoost: 6.0,
    treble: 0,
  },
  {
    name: 'Vocal Clarity',
    description: 'Forward vocal presence, speech intelligibility & warmth',
    bands: [-2.0, -1.5, 0, 2.0, 3.5, 4.0, 3.0, 1.5, 0, -1.0],
    bassBoost: 0,
    treble: 1.0,
  },
  {
    name: 'Electronic Rave',
    description: 'Tight kicks and hyper-detailed highs',
    bands: [5.5, 4.0, 1.0, -1.5, -2.0, 1.0, 3.5, 4.5, 5.0, 5.5],
    bassBoost: 4.0,
    treble: 3.0,
  },
  {
    name: 'Rock & Guitars',
    description: 'Crisp transients, driven guitars, and solid snare crack',
    bands: [4.0, 3.0, 1.5, 0, -1.5, 1.5, 3.0, 3.5, 3.0, 2.0],
    bassBoost: 2.0,
    treble: 1.5,
  },
  {
    name: 'Acoustic / Jazz',
    description: 'Warm natural wood body and delicate string air',
    bands: [2.0, 2.5, 1.5, 0, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5],
    bassBoost: 1.0,
    treble: 1.5,
  },
  {
    name: 'Night Listening',
    description: 'Reduced dynamic peaks and softer bass for late nights',
    bands: [-3.0, -2.0, -1.0, 0, 1.0, 1.0, 0.5, -1.0, -2.0, -3.5],
    bassBoost: 0,
    treble: -2.0,
  },
];

interface AudioLabStoreState {
  settings: AudioLabSettings;
  customPresets: EQPreset[];
  setBandGain: (index: number, gain: number) => void;
  setBassBoost: (boost: number) => void;
  setTreble: (treble: number) => void;
  setStereoPan: (pan: number) => void;
  setReverbLevel: (reverb: number) => void;
  toggleBypass: () => void;
  applyPreset: (presetName: string) => void;
  resetToFlat: () => void;
  applyLoadedPreferences: (prefs: Partial<AudioLabSettings>) => void;
  loadCloudPresets: () => Promise<void>;
  saveCustomPreset: (name: string) => Promise<boolean>;
  deleteCustomPreset: (id?: string, name?: string) => Promise<boolean>;
}

const defaultSettings: AudioLabSettings = {
  bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  bassBoost: 0,
  treble: 0,
  stereoPan: 0,
  reverbLevel: 0,
  isBypassed: false,
  preset: 'Flat Studio',
};

let eqSyncTimeout: any = null;
function syncAudioLabToDB() {
  if (eqSyncTimeout) clearTimeout(eqSyncTimeout);
  eqSyncTimeout = setTimeout(() => {
    const { settings } = useAudioLabStore.getState();
    apiClient.updatePreferences({
      eqBands: settings.bands,
      bassBoost: settings.bassBoost,
      treble: settings.treble,
      stereoPan: settings.stereoPan,
      reverbLevel: settings.reverbLevel,
      eqPreset: settings.preset,
      eqBypassed: settings.isBypassed,
    }).catch(() => {});
  }, 1000);
}

export const useAudioLabStore = create<AudioLabStoreState>((set, get) => ({
  settings: defaultSettings,
  customPresets: [],

  setBandGain: (index: number, gain: number) => {
    const { settings } = get();
    const newBands = [...settings.bands];
    newBands[index] = Math.max(-12, Math.min(12, gain));
    const newSettings = { ...settings, bands: newBands, preset: 'Custom' };
    set({ settings: newSettings });
    audioEngine.applyAudioLabSettings(newSettings);
    syncAudioLabToDB();
  },

  setBassBoost: (boost: number) => {
    const { settings } = get();
    const newSettings = { ...settings, bassBoost: Math.max(0, Math.min(12, boost)), preset: 'Custom' };
    set({ settings: newSettings });
    audioEngine.applyAudioLabSettings(newSettings);
    syncAudioLabToDB();
  },

  setTreble: (treble: number) => {
    const { settings } = get();
    const newSettings = { ...settings, treble: Math.max(-12, Math.min(12, treble)), preset: 'Custom' };
    set({ settings: newSettings });
    audioEngine.applyAudioLabSettings(newSettings);
    syncAudioLabToDB();
  },

  setStereoPan: (pan: number) => {
    const { settings } = get();
    const newSettings = { ...settings, stereoPan: Math.max(-1, Math.min(1, pan)) };
    set({ settings: newSettings });
    audioEngine.applyAudioLabSettings(newSettings);
    syncAudioLabToDB();
  },

  setReverbLevel: (reverb: number) => {
    const { settings } = get();
    const newSettings = { ...settings, reverbLevel: Math.max(0, Math.min(1, reverb)) };
    set({ settings: newSettings });
    audioEngine.applyAudioLabSettings(newSettings);
    syncAudioLabToDB();
  },

  toggleBypass: () => {
    const { settings } = get();
    const newSettings = { ...settings, isBypassed: !settings.isBypassed };
    set({ settings: newSettings });
    audioEngine.applyAudioLabSettings(newSettings);
    syncAudioLabToDB();
  },

  applyPreset: (presetName: string) => {
    const all = [...EQ_PRESETS, ...get().customPresets];
    const preset = all.find((p) => p.name === presetName);
    if (!preset) return;
    const { settings } = get();
    const newSettings: AudioLabSettings = {
      ...settings,
      bands: [...preset.bands],
      bassBoost: preset.bassBoost ?? 0,
      treble: preset.treble ?? 0,
      preset: preset.name,
    };
    set({ settings: newSettings });
    audioEngine.applyAudioLabSettings(newSettings);
    syncAudioLabToDB();
  },

  resetToFlat: () => {
    const newSettings: AudioLabSettings = {
      ...defaultSettings,
    };
    set({ settings: newSettings });
    audioEngine.applyAudioLabSettings(newSettings);
    syncAudioLabToDB();
  },

  applyLoadedPreferences: (prefs: Partial<AudioLabSettings>) => {
    const { settings } = get();
    const merged: AudioLabSettings = {
      ...settings,
      ...prefs,
      bands: Array.isArray(prefs.bands) ? prefs.bands : settings.bands,
    };
    set({ settings: merged });
    audioEngine.applyAudioLabSettings(merged);
  },

  loadCloudPresets: async () => {
    try {
      const data = await apiClient.getEQPresets();
      if (data && Array.isArray(data.user) && data.user.length > 0) {
        const mapped: EQPreset[] = data.user.map((p: any) => ({
          id: p.id,
          name: p.name,
          description: 'Cloud Synced Custom EQ',
          bands: Array.isArray(p.bands)
            ? p.bands
            : typeof p.bands === 'string'
            ? JSON.parse(p.bands)
            : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          bassBoost: p.bassBoost || 0,
          treble: p.treble || 0,
          isCustom: true,
        }));
        set({ customPresets: mapped });
      }
    } catch {
      // Ignore
    }
  },

  saveCustomPreset: async (name: string) => {
    const { settings, customPresets } = get();
    const trimmed = name.trim();
    if (!trimmed) return false;

    const newPreset: EQPreset = {
      name: trimmed,
      description: 'User Custom Acoustic Profile',
      bands: [...settings.bands],
      bassBoost: settings.bassBoost,
      treble: settings.treble,
      isCustom: true,
    };

    try {
      const saved = await apiClient.saveEQPreset({
        name: trimmed,
        bands: settings.bands,
        bassBoost: settings.bassBoost,
        treble: settings.treble,
        stereoPan: settings.stereoPan,
        reverbLevel: settings.reverbLevel,
      });

      if (saved && saved.id) {
        newPreset.id = saved.id;
      }
    } catch {
      // Local fallback
    }

    set({
      customPresets: [newPreset, ...customPresets.filter((p) => p.name !== trimmed)],
      settings: { ...settings, preset: trimmed },
    });
    return true;
  },

  deleteCustomPreset: async (id?: string, name?: string) => {
    const { customPresets, settings } = get();
    set({
      customPresets: customPresets.filter((p) => (id ? p.id !== id : p.name !== name)),
    });
    if (id) {
      apiClient.deleteEQPreset(id).catch(() => {});
    }
    if (settings.preset === name) {
      set({ settings: { ...settings, preset: 'Flat Studio' } });
    }
    return true;
  },
}));
