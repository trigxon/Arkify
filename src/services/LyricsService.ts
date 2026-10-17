import { Platform } from 'react-native';
import { metadataCache } from '../core/cache';
import { Track } from '../core/types';
import {
  activeLineIndexFor,
  normalizeForMatch,
  parseLrclibPayload,
  sanitizeCompanionPayload,
  scoreLrclibHit,
  Lyrics,
  LyricLine,
  LrcLibHit,
} from './lyricsCore';

export type { Lyrics, LyricLine };

export interface LyricsProvider {
  readonly id: string;
  fetch(track: Track, signal?: AbortSignal): Promise<Lyrics | null>;
}

const TTL = 24 * 60 * 60 * 1000;

/**
 * Lyrics provider.
 *
 * Web rides the same-origin companion server (`/api/lyrics`: verified LRCLIB
 * matching + the romanizer engine + fallbacks). Native has no CORS limits and
 * no companion, so it talks to LRCLIB directly — a relative `/api/lyrics`
 * path cannot resolve in the shipped app bundle. The two paths are honest
 * about what they deliver: native never claims Roman English (it has no
 * transliteration capability and preserves the provider's original script),
 * and both paths only accept VERIFIED matches for the requested track.
 */
class ArkifyLyricsProvider implements LyricsProvider {
  readonly id = 'arkify-lyrics';

  async fetch(track: Track, signal?: AbortSignal): Promise<Lyrics | null> {
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
      const clean = sanitizeCompanionPayload(data);
      if (!clean) {
        // Explicit empty result from the server (no verified lyrics) or a
        // malformed payload — surface the unavailable state, never a guess.
        return null;
      }

      return {
        trackId: track.id,
        lines: clean.lines,
        synced: clean.synced,
        source: clean.source || 'Lyrics',
        romanized: clean.romanized,
      };
    } catch {
      return null;
    }
  }

  /** Native path: LRCLIB directly (exact lookup first, then VERIFIED search). */
  private async fetchDirect(track: Track, signal?: AbortSignal): Promise<Lyrics | null> {
    const title = (track.title || '').trim();
    const artist = (track.artist?.name || '').trim();
    if (!title) return null;

    const headers = { Accept: 'application/json' };
    const duration = Math.round(track.duration || 0);
    const reqTitleNorm = normalizeForMatch(title);
    const reqArtistNorm = normalizeForMatch(artist);

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
            source: 'LRCLIB',
          };
        }
      }
    } catch {
      // Fall through to search.
    }

    // 2) Fuzzy search — but only VERIFIED matches are accepted. The old code
    // took the first synced hit, which could belong to a different artist or
    // version entirely; now title identity is mandatory and artist/duration
    // agreement adjusts the score.
    try {
      const qs = new URLSearchParams({ q: `${title} ${artist}`.trim() });
      const res = await fetch(`https://lrclib.net/api/search?${qs.toString()}`, { signal, headers });
      if (res.ok) {
        const results: LrcLibHit[] = await res.json();
        if (Array.isArray(results) && results.length > 0) {
          let bestHit: LrcLibHit | null = null;
          let bestScore = -Infinity;
          for (const hit of results) {
            if (!hit?.syncedLyrics && !hit?.plainLyrics) continue;
            const score = scoreLrclibHit(hit, reqTitleNorm, reqArtistNorm, duration);
            if (score === null || score < 3) continue; // identity bar
            if (score > bestScore) {
              bestScore = score;
              bestHit = hit;
            }
          }
          const parsed = bestHit ? parseLrclibPayload(bestHit) : null;
          if (parsed) {
            return {
              trackId: track.id,
              lines: parsed.lines,
              synced: parsed.synced,
              source: 'LRCLIB',
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
  private provider: LyricsProvider = new ArkifyLyricsProvider();

  use(provider: LyricsProvider | null): void {
    this.provider = provider || new ArkifyLyricsProvider();
  }

  get isConfigured(): boolean {
    return true;
  }

  get providerName(): string | null {
    return this.provider?.id ?? 'arkify-lyrics';
  }

  /**
   * Whether the active path can genuinely transliterate to Roman English.
   * Only the web companion ships the romanizer engine; native preserves the
   * provider's original script and never describes it as Roman English.
   */
  get romanizationAvailable(): boolean {
    return Platform.OS === 'web';
  }

  /** Returns lyrics for the given track, or null when none are available. */
  async get(track: Track, signal?: AbortSignal): Promise<Lyrics | null> {
    if (!this.provider) return null;

    // v2 namespace: entries persisted under the old key belonged to a
    // provider generation that fabricated placeholder lyrics — they must
    // never surface again.
    const key = `lyrics:v2:${this.provider.id}:${track.id}`;
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
    return activeLineIndexFor(lyrics, position);
  }
}

export const LyricsService = new LyricsServiceImpl();
