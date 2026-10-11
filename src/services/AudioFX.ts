import { Platform } from 'react-native';
import {
  getAudioFxInfo,
  setBassBoost,
  setEqualizerEnabled,
  setEqualizerLevels,
  AudioFxInfo,
} from '../../modules/arkify-native';
import { readJson, writeJsonDebounced } from '../core/storage';

/**
 * AudioFX — one service for the whole sound-shaping surface:
 *
 *   • device equalizer (via the native module's global output-session effects)
 *   • bass boost
 *   • crossfade preference (applied by the PlaybackEngine at track edges)
 *
 * Presets map to the device's real band count and milli-Bel range, so the UI
 * sliders drive hardware effects, not fake DSP.
 */

const FX_KEY = 'audio-fx-state';

export type EqualizerPreset = {
  id: string;
  name: string;
  /** Multipliers 0..1 across bands, mapped onto the device range. */
  shape: number[];
};

/**
 * Shape values are normalised 0..1 where 0.5 is flat. They scale to the
 * device's real dB range at apply-time, so presets are device-agnostic.
 */
export const EQ_PRESETS: EqualizerPreset[] = [
  { id: 'flat', name: 'Flat', shape: [0.5, 0.5, 0.5, 0.5, 0.5] },
  { id: 'bass', name: 'Bass Boost', shape: [0.95, 0.8, 0.5, 0.42, 0.5] },
  { id: 'vocal', name: 'Vocal', shape: [0.32, 0.45, 0.72, 0.78, 0.55] },
  { id: 'treble', name: 'Treble', shape: [0.35, 0.45, 0.5, 0.75, 0.92] },
  { id: 'electronic', name: 'Electronic', shape: [0.85, 0.65, 0.45, 0.7, 0.88] },
  { id: 'rock', name: 'Rock', shape: [0.8, 0.6, 0.5, 0.68, 0.82] },
  { id: 'acoustic', name: 'Acoustic', shape: [0.72, 0.62, 0.55, 0.66, 0.6] },
  { id: 'night', name: 'Late Night', shape: [0.42, 0.52, 0.6, 0.52, 0.4] },
];

export type AudioFxState = {
  enabled: boolean;
  presetId: string;
  /** Normalised 0..1 per-band values (custom shape when user tweaks). */
  bands: number[];
  /** 0..1000. */
  bass: number;
  /** Crossfade seconds, 0 = off. */
  crossfade: number;
  /** Prefer highest available audio bitrate when resolving streams. */
  highQuality: boolean;
};

export const DEFAULT_FX: AudioFxState = {
  enabled: false,
  presetId: 'flat',
  bands: [0.5, 0.5, 0.5, 0.5, 0.5],
  bass: 0,
  crossfade: 0,
  highQuality: true,
};

class AudioFxServiceImpl {
  private state: AudioFxState = { ...DEFAULT_FX };
  private info: AudioFxInfo = { supported: false };
  private loaded = false;
  private listeners = new Set<() => void>();

  async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;

    this.state = {
      ...DEFAULT_FX,
      ...(await readJson<Partial<AudioFxState>>(FX_KEY, {})),
    };

    if (Platform.OS === 'android') {
      this.info = getAudioFxInfo();
    }

    // Re-apply persisted state (effects do not survive process death).
    if (this.info.supported) {
      this.applyToHardware();
    }
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }

  get isSupported(): boolean {
    return this.info.supported;
  }

  get deviceInfo(): AudioFxInfo {
    return this.info;
  }

  getState(): AudioFxState {
    return { ...this.state };
  }

  /** Map a normalised band shape onto the device's milli-Bel range. */
  private levelsFor(bands: number[]): number[] {
    const min = this.info.minLevel ?? -1500;
    const max = this.info.maxLevel ?? 1500;
    const count = this.info.bandCount ?? bands.length;
    return Array.from({ length: count }, (_, i) => {
      const norm = bands[i] ?? 0.5;
      // 0.5 = centre (0 dB). Amplify the swing a touch for a satisfying range.
      const swing = norm - 0.5;
      return Math.round(swing * 2 * (max - min) * 0.5 + (min + max) / 2);
    });
  }

  private applyToHardware(): void {
    if (!this.info.supported) return;

    if (this.state.enabled) {
      setEqualizerLevels(this.levelsFor(this.state.bands));
      setEqualizerEnabled(true);
    } else {
      setEqualizerEnabled(false);
    }
    setBassBoost(this.state.bass);
  }

  private persist(): void {
    writeJsonDebounced(FX_KEY, this.state, 400);
  }

  // ---- setters -----------------------------------------------------------

  setEnabled(enabled: boolean): void {
    this.state.enabled = enabled;
    this.applyToHardware();
    this.persist();
    this.notify();
  }

  setPreset(presetId: string): void {
    const preset = EQ_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    this.state.presetId = presetId;
    // Stretch/trim the preset shape to the device band count.
    const count = this.info.bandCount ?? preset.shape.length;
    this.state.bands = Array.from({ length: count }, (_, i) => {
      const t = count === 1 ? 0 : (i / (count - 1)) * (preset.shape.length - 1);
      const lo = Math.floor(t);
      const hi = Math.min(preset.shape.length - 1, lo + 1);
      return preset.shape[lo] + (preset.shape[hi] - preset.shape[lo]) * (t - lo);
    });

    if (!this.state.enabled) this.state.enabled = true;
    this.applyToHardware();
    this.persist();
    this.notify();
  }

  setBand(index: number, norm: number): void {
    const bands = [...this.state.bands];
    bands[index] = Math.max(0, Math.min(1, norm));
    this.state.bands = bands;
    this.state.presetId = 'custom';
    if (!this.state.enabled) this.state.enabled = true;
    this.applyToHardware();
    this.persist();
    this.notify();
  }

  setBass(strength: number): void {
    this.state.bass = Math.max(0, Math.min(1000, Math.round(strength)));
    this.applyToHardware();
    this.persist();
    this.notify();
  }

  setCrossfade(seconds: number): void {
    this.state.crossfade = Math.max(0, Math.min(12, Math.round(seconds)));
    this.persist();
    this.notify();
  }

  setHighQuality(high: boolean): void {
    this.state.highQuality = high;
    this.persist();
    this.notify();
  }
}

export const AudioFX = new AudioFxServiceImpl();
