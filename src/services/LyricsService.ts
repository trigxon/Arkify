import { Platform } from 'react-native';
import { metadataCache } from '../core/cache';
import { Track } from '../core/types';

export type LyricLine = {
  /** Seconds into the track. Undefined for unsynced lyrics. */
  time?: number;
  text: string;
};

export type Lyrics = {
  trackId: string;
  lines: LyricLine[];
  synced: boolean;
  source: string;
};

export interface LyricsProvider {
  readonly id: string;
  fetch(track: Track, signal?: AbortSignal): Promise<Lyrics | null>;
}

const TTL = 24 * 60 * 60 * 1000;

/**
 * Built-in Roman English Lyrics Provider powered by Arkify AI & synced databases.
 * Automatically romanizes any song (Punjabi, Hindi, Urdu, K-Pop, Japanese, Spanish, etc.)
 * into clear Roman English phonetic script.
 */
/**
 * Parse an lrclib payload into Lyrics. Prefers synced LRC; falls back to plain.
 */
function parseLrclibPayload(data: any): { lines: LyricLine[]; synced: boolean } | null {
  if (!data) return null;

  if (typeof data.syncedLyrics === 'string' && data.syncedLyrics.trim()) {
    const lines: LyricLine[] = [];
    for (const raw of data.syncedLyrics.split('\n')) {
      const m = /^\s*\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]\s*(.*)$/.exec(raw);
      if (!m) continue;
      const min = parseInt(m[1], 10);
      const sec = parseInt(m[2], 10);
      const frac = m[3] ? parseFloat(`0.${m[3]}`) : 0;
      const text = m[4].trim();
      lines.push({ time: min * 60 + sec + frac, text });
    }
    // A synced payload with no usable timestamps is not synced lyrics.
    if (lines.length > 0) return { lines, synced: true };
  }

  if (typeof data.plainLyrics === 'string' && data.plainLyrics.trim()) {
    const lines = data.plainLyrics
      .split('\n')
      .map((t: string) => t.trim())
      .filter(Boolean)
      .slice(0, 240)
      .map((text: string) => ({ text }));
    if (lines.length > 0) return { lines, synced: false };
  }

  return null;
}

class RomanEnglishLyricsProvider implements LyricsProvider {
  readonly id = 'arkify-roman-lyrics';

  async fetch(track: Track, signal?: AbortSignal): Promise<Lyrics | null> {
    // Web rides the same-origin companion server (lrclib + fallbacks + the
    // romanizer engine). Native has no CORS limits, so it talks to LRCLIB
    // directly — a relative `/api/lyrics` path cannot resolve in the shipped
    // app bundle.
    if (Platform.OS === 'web') {
      return this.fetchViaCompanion(track, signal);
    }
    return this.fetchDirect(track, signal);
  }

  /** Web path: the Arkify companion server (same-origin `/api/lyrics`). */
  private async fetchViaCompanion(track: Track, signal?: AbortSignal): Promise<Lyrics | null> {
    try {
      const params = new URLSearchParams({
        title: track.title || '',
        artist: track.artist?.name || '',
        duration: String(track.duration || 0),
        id: track.id || '',
      });

      const res = await fetch(`/api/lyrics?${params.toString()}`, {
        method: 'GET',
        signal,
        headers: {
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        return null;
      }

      const data = await res.json();
      if (!data || !Array.isArray(data.lines) || data.lines.length === 0) {
        return null;
      }

      return {
        trackId: track.id,
        lines: data.lines,
        synced: data.synced ?? true,
        source: data.source || 'Roman English (Arkify AI)',
      };
    } catch {
      return null;
    }
  }

  /** Native path: LRCLIB directly (exact match first, then fuzzy search). */
  private async fetchDirect(track: Track, signal?: AbortSignal): Promise<Lyrics | null> {
    const title = (track.title || '').trim();
    const artist = (track.artist?.name || '').trim();
    if (!title) return null;

    const headers = { Accept: 'application/json' };
    const duration = Math.round(track.duration || 0);

    // 1) Exact lookup with the strongest keys we have.
    try {
      const qs = new URLSearchParams({ track_name: title, artist_name: artist });
      if (duration > 0) qs.set('duration', String(duration));
      const res = await fetch(`https://lrclib.net/api/get?${qs.toString()}`, { signal, headers });
      if (res.ok) {
        const parsed = parseLrclibPayload(await res.json());
        if (parsed) {
          return {
            trackId: track.id,
            lines: parsed.lines,
            synced: parsed.synced,
            source: parsed.synced ? 'Synced (LRCLIB)' : 'Lyrics (LRCLIB)',
          };
        }
      }
    } catch {
      // Fall through to search.
    }

    // 2) Fuzzy search; prefer synced results, then closest duration.
    try {
      const qs = new URLSearchParams({ q: `${title} ${artist}`.trim() });
      const res = await fetch(`https://lrclib.net/api/search?${qs.toString()}`, { signal, headers });
      if (res.ok) {
        const results: any[] = await res.json();
        if (Array.isArray(results) && results.length > 0) {
          const withLyrics = results.filter((r) => r?.syncedLyrics || r?.plainLyrics);
          withLyrics.sort((a, b) => {
            const aSynced = a.syncedLyrics ? 1 : 0;
            const bSynced = b.syncedLyrics ? 1 : 0;
            if (aSynced !== bSynced) return bSynced - aSynced;
            if (duration > 0 && a.duration && b.duration) {
              return Math.abs(a.duration - duration) - Math.abs(b.duration - duration);
            }
            return 0;
          });
          const parsed = parseLrclibPayload(withLyrics[0]);
          if (parsed) {
            return {
              trackId: track.id,
              lines: parsed.lines,
              synced: parsed.synced,
              source: parsed.synced ? 'Synced (LRCLIB)' : 'Lyrics (LRCLIB)',
            };
          }
        }
      }
    } catch {
      return null;
    }

    return null;
  }
}

class LyricsServiceImpl {
  private provider: LyricsProvider = new RomanEnglishLyricsProvider();

  use(provider: LyricsProvider | null): void {
    this.provider = provider || new RomanEnglishLyricsProvider();
  }

  get isConfigured(): boolean {
    return true;
  }

  get providerName(): string | null {
    return this.provider?.id ?? 'arkify-roman-lyrics';
  }

  /** Returns Roman English lyrics for any given track. */
  async get(track: Track, signal?: AbortSignal): Promise<Lyrics | null> {
    if (!this.provider) return null;

    const key = `lyrics:${this.provider.id}:${track.id}`;
    const cached = metadataCache.get<Lyrics | null>(key);
    if (cached !== undefined) return cached;

    try {
      const lyrics = await this.provider.fetch(track, signal);
      if (lyrics) {
        metadataCache.set(key, lyrics, TTL);
      }
      return lyrics;
    } catch {
      return null;
    }
  }

  /** The line that should be highlighted at `position` seconds. */
  activeLineIndex(lyrics: Lyrics | null, position: number): number {
    if (!lyrics?.synced || !lyrics.lines.length) return -1;

    let index = -1;
    for (let i = 0; i < lyrics.lines.length; i++) {
      const t = lyrics.lines[i].time;
      if (t === undefined || t > position) break;
      index = i;
    }
    return index;
  }
}

export const LyricsService = new LyricsServiceImpl();

