import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// ---------------------------------------------------------------------------
// Central haptics gate.
//
// Every haptic in the app goes through here so that:
//   · web never vibrates (there is nothing to vibrate with),
//   · the user's Settings > "Haptic feedback" toggle is honoured live,
//   · failures never reject into UI code.
//
// The flag is flipped by AppearanceProvider, which already observes the
// persisted settings; nothing else needs to know about the setting.
// ---------------------------------------------------------------------------

let enabled = true;

export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

function supportsHaptics(): boolean {
  return enabled && Platform.OS !== 'web' && Haptics != null;
}

function safe(fn: () => Promise<void>): void {
  if (!supportsHaptics()) return;
  fn().catch(() => undefined);
}

/** Light tick — selection changes, slider stops, candidate changes. */
export function hapticSelection(): void {
  safe(() => Haptics.selectionAsync());
}

/** Soft impact — commits, activations. */
export function hapticLight(): void {
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** Medium impact — entering a gesture mode (hold-and-slide activation). */
export function hapticMedium(): void {
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

/** Success pattern — rare, earned moments (badge unlock, download done). */
export function hapticSuccess(): void {
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}
