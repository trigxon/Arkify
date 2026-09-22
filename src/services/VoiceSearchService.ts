import { Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';

/**
 * Voice search, using the device's own speech recogniser.
 *
 * Android exposes speech recognition as an activity, so Audia can hand the
 * user's words to the recogniser that already ships with the phone and read
 * the transcript back — no third-party service, no API key, no recording
 * stored by Audia, and no microphone permission required by our own manifest.
 *
 * Returns the recognised query, or null when the user cancelled, nothing was
 * heard, or the device has no recogniser installed.
 */
const RECOGNIZE_SPEECH = 'android.speech.action.RECOGNIZE_SPEECH';

export async function listenForQuery(): Promise<string | null> {
  if (Platform.OS !== 'android') return null;

  try {
    const result = await IntentLauncher.startActivityAsync(RECOGNIZE_SPEECH, {
      extra: {
        'android.speech.extra.LANGUAGE_MODEL': 'free_form',
        'android.speech.extra.PROMPT': 'Search Audia',
        'android.speech.extra.MAX_RESULTS': 1,
      },
    });

    const extra = (result?.extra ?? {}) as Record<string, unknown>;
    const results = extra['android.speech.extra.RESULTS'];

    if (Array.isArray(results)) {
      const first = results.find((r): r is string => typeof r === 'string' && r.trim().length > 0);
      if (first) return first.trim();
    }

    // Some recognisers return the transcript as a single string instead.
    const single = extra['android.speech.extra.RESULTS_RECOGNITION'];
    if (Array.isArray(single)) {
      const first = single.find((r): r is string => typeof r === 'string' && r.trim().length > 0);
      if (first) return first.trim();
    }
  } catch {
    // No recogniser, or the activity was dismissed: fall back to typing.
  }

  return null;
}
