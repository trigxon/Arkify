import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Local-first persistence. AsyncStorage is backed by localStorage on web and
 * by the platform key-value store on native, so one adapter covers both.
 *
 * Writes are debounced and coalesced per key: the player position updates
 * several times a second and must never turn into a storage write storm.
 */

const PREFIX = 'arkify:v1:';
const key = (k: string) => PREFIX + k;

/**
 * Namespace used before the Arkify rename. Entries written under it are copied
 * into the Arkify namespace once and then removed, so an install that updates
 * in place keeps its liked songs, playlists, queue, history and playback
 * position. Arkify is canonical: nothing writes to the old namespace again.
 */
const LEGACY_PREFIX = 'audia:v1:';

/** Full key (namespace included) of the offline download index. */
export const DOWNLOADS_STORAGE_KEY = PREFIX + 'downloads';

let migration: Promise<void> | null = null;

/** Run the rename migration at most once per session. */
export function ensureMigrated(): Promise<void> {
  if (!migration) migration = migrateLegacyEntries();
  return migration;
}

async function migrateLegacyEntries(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const legacy = keys.filter((k) => k.startsWith(LEGACY_PREFIX));

    for (const legacyKey of legacy) {
      const target = PREFIX + legacyKey.slice(LEGACY_PREFIX.length);
      const raw = await AsyncStorage.getItem(legacyKey);
      // Never clobber a value Arkify already wrote -- that one is fresher.
      if (raw != null && (await AsyncStorage.getItem(target)) == null) {
        await AsyncStorage.setItem(target, raw);
      }
      await AsyncStorage.removeItem(legacyKey);
    }
  } catch {
    // Best-effort: the Arkify namespace stays canonical either way.
  }
}

const pending = new Map<string, unknown>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

export async function readJson<T>(k: string, fallback: T): Promise<T> {
  try {
    await ensureMigrated();

    // A debounced write that has not landed yet is still the freshest value.
    if (pending.has(k)) return pending.get(k) as T;

    const raw = await AsyncStorage.getItem(key(k));
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    // Corrupt or unreadable entry: fall back rather than break the app.
    return fallback;
  }
}

export async function writeJson(k: string, value: unknown): Promise<void> {
  try {
    await ensureMigrated();

    pending.delete(k);
    await AsyncStorage.setItem(key(k), JSON.stringify(value));
  } catch {
    // Storage full or unavailable -- persistence is best-effort by design.
  }
}

/** Coalescing write. Repeated calls within `delayMs` collapse into one. */
export function writeJsonDebounced(k: string, value: unknown, delayMs = 800): void {
  pending.set(k, value);

  const existing = timers.get(k);
  if (existing) clearTimeout(existing);

  timers.set(
    k,
    setTimeout(() => {
      timers.delete(k);
      const v = pending.get(k);
      if (pending.has(k)) void writeJson(k, v);
    }, delayMs)
  );
}

/** Force every debounced write to land now (used on backgrounding). */
export async function flushWrites(): Promise<void> {
  const entries = [...pending.entries()];
  for (const [k, t] of timers) clearTimeout(t);
  timers.clear();
  await Promise.all(entries.map(([k, v]) => writeJson(k, v)));
}

export async function removeKey(k: string): Promise<void> {
  pending.delete(k);
  const t = timers.get(k);
  if (t) {
    clearTimeout(t);
    timers.delete(k);
  }
  try {
    await AsyncStorage.removeItem(key(k));
  } catch {
    /* best effort */
  }
}

export const STORAGE_KEYS = {
  likedTracks: 'liked',
  playlists: 'playlists',
  queue: 'queue',
  recentlyPlayed: 'recents',
  playbackState: 'playback',
  settings: 'settings',
  searchHistory: 'search-history',
  cache: 'cache',
  history: 'history',
} as const;
