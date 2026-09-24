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
class RomanEnglishLyricsProvider implements LyricsProvider {
  readonly id = 'arkify-roman-lyrics';

  async fetch(track: Track, signal?: AbortSignal): Promise<Lyrics | null> {
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

