/**
 * lyricsCore — pure lyric-matching and parsing logic, shared by the native
 * (direct LRCLIB) and web (companion `/api/lyrics`) paths.
 *
 * Deliberately dependency-free (no react-native, no storage): the same rules
 * run inside the app bundle AND under `node --test` in test/lyricsCore.test.ts.
 *
 * Honesty contract enforced here:
 *   - a candidate must verifiably BE the requested song (title identity is
 *     mandatory; artist/duration agreement only adjusts the score),
 *   - `synced: true` requires genuine per-line timestamps,
 *   - plain lyrics are never given invented timestamps,
 *   - provider text is preserved; nothing is ever generated.
 */

export type LyricLine = {
  /** Seconds into the track. Undefined for unsynced lyrics. */
  time?: number;
  /** Text as displayed: the original script, or the romanized form when a
   *  reliable transliteration was actually applied to this line. */
  text: string;
  /** The provider's original text, present only when `text` is a romanized
   *  form of it (the original lyrics/script are always preserved). */
  original?: string;
};

export type Lyrics = {
  trackId: string;
  lines: LyricLine[];
  synced: boolean;
  source: string;
  /** True only when at least one line was genuinely transliterated to Roman
   *  English. English lyrics must never be described as transliterated. */
  romanized?: boolean;
};

export type LrcLibHit = {
  trackName?: string;
  artistName?: string;
  duration?: number;
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
};

const MAX_LINES = 300;

/** Normalise text for identity checks: lowercase, punctuation-free, no noise words. */
export function normalizeForMatch(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(/\b(official|video|audio|lyrics|remastered|hd|4k)\b/g, ' ')
    .replace(/\b(ft|feat|featuring)\b.*$/g, ' ')
    .replace(/\b(topic|vevo)\b/g, ' ')
    .replace(/[^a-z0-9\u00c0-\u024f\u0400-\u04ff\u0600-\u06ff\u0900-\u097f\u0a00-\u0a7f\u3040-\u30ff\uac00-\ud7a3]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Whole-token containment: every whitespace-separated token of `needle` must
 * appear as an EXACT token of `haystack`. Substring matching is not enough —
 * "night" must not match inside "Midnight".
 */
function tokensContained(needle: string, haystack: string): boolean {
  const needleTokens = needle.split(' ').filter(Boolean);
  if (needleTokens.length === 0) return false;
  const haystackTokens = new Set(haystack.split(' ').filter(Boolean));
  return needleTokens.every((t) => haystackTokens.has(t));
}

/**
 * Verify + score one LRCLIB hit against the requested track.
 * Returns null when the hit is a different song; otherwise a score >= 0.
 * The same rules are mirrored in server/lyricsProxy.js — keep them in sync.
 */
export function scoreLrclibHit(
  hit: LrcLibHit | null | undefined,
  reqTitleNorm: string,
  reqArtistNorm: string,
  duration: number
): number | null {
  if (!hit) return null;
  const hitTitle = normalizeForMatch(hit.trackName || '');
  const hitArtist = normalizeForMatch(hit.artistName || '');
  if (!hitTitle) return null;

  let score = 0;
  if (hitTitle === reqTitleNorm) score += 4;
  else if (reqTitleNorm && tokensContained(reqTitleNorm, hitTitle)) score += 3;
  else if (hitTitle && tokensContained(hitTitle, reqTitleNorm)) score += 2;
  else return null; // a different song entirely

  // Artist identity is mandatory when the request names one: the same title
  // recorded by a different artist is exactly the "lyrics for another
  // version" failure this module exists to prevent.
  let artistAgrees = false;
  if (reqArtistNorm && hitArtist) {
    if (hitArtist === reqArtistNorm) {
      score += 3;
      artistAgrees = true;
    } else if (tokensContained(reqArtistNorm, hitArtist) || tokensContained(hitArtist, reqArtistNorm)) {
      score += 2;
      artistAgrees = true;
    }
  }
  if (reqArtistNorm && hitArtist && !artistAgrees) return null;

  if (duration > 0 && typeof hit.duration === 'number' && hit.duration > 0) {
    const delta = Math.abs(hit.duration - duration);
    if (delta <= 5) score += 2;
    else if (delta <= 12) score += 1;
    else score -= 1;
  }

  if (hit.syncedLyrics) score += 1;
  return score;
}

/** Parse one LRC timestamp line: "[mm:ss.xx] text" -> (time, text) or null. */
function parseLrcTimestampLine(raw: string): { time: number; text: string } | null {
  const m = /^\s*\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]\s*(.*)$/.exec(raw);
  if (!m) return null;
  const min = parseInt(m[1], 10);
  const sec = parseInt(m[2], 10);
  const frac = m[3] ? parseFloat(`0.${m[3]}`) : 0;
  return { time: min * 60 + sec + frac, text: m[4].trim() };
}

/**
 * Parse an LRCLIB payload (native path). Prefers genuine synced LRC; falls
 * back to plain text marked unsynced. The client does not transliterate —
 * provider text (including its script) is preserved verbatim.
 */
export function parseLrclibPayload(data: unknown): { lines: LyricLine[]; synced: boolean } | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;

  if (typeof d.syncedLyrics === 'string' && d.syncedLyrics.trim()) {
    const lines: LyricLine[] = [];
    for (const raw of d.syncedLyrics.split('\n')) {
      const parsed = parseLrcTimestampLine(raw);
      if (!parsed || !parsed.text) continue;
      lines.push({ time: parsed.time, text: parsed.text });
    }
    // A synced payload with no usable timestamps is not synced lyrics.
    if (lines.length > 0) return { lines, synced: true };
  }

  if (typeof d.plainLyrics === 'string' && d.plainLyrics.trim()) {
    const lines: LyricLine[] = d
      .plainLyrics.split('\n')
      .map((t: string) => t.trim())
      .filter(Boolean)
      .slice(0, MAX_LINES)
      .map((text: string) => ({ text }));
    if (lines.length > 0) return { lines, synced: false };
  }

  return null;
}

/**
 * Validate + normalise a companion `/api/lyrics` payload (web path).
 *
 * Defence in depth for the synced flag: the client never trusts
 * `synced: true` unless at least one line actually carries a finite
 * timestamp, so plain lyrics can never drive the karaoke view.
 */
export function sanitizeCompanionPayload(
  data: unknown
): { lines: LyricLine[]; synced: boolean; romanized: boolean; source: string | null } | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const rawLines = d.lines;
  if (!Array.isArray(rawLines)) return null;

  const lines: LyricLine[] = [];
  for (const raw of rawLines) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const text = typeof r.text === 'string' ? r.text.trim() : '';
    if (!text) continue;
    const line: LyricLine = { text };
    if (typeof r.time === 'number' && isFinite(r.time) && r.time >= 0) {
      line.time = r.time;
    }
    if (typeof r.original === 'string' && r.original.trim() && r.original.trim() !== text) {
      line.original = r.original.trim();
    }
    lines.push(line);
    if (lines.length >= MAX_LINES) break;
  }

  if (lines.length === 0) return null;

  const hasGenuineTimestamps = lines.some(
    (l) => typeof l.time === 'number' && isFinite(l.time)
  );
  const synced = d.synced === true && hasGenuineTimestamps;

  return {
    lines,
    synced,
    romanized: d.romanized === true,
    source: typeof d.source === 'string' && d.source.trim() ? d.source.trim() : null,
  };
}

/**
 * The line index that should be highlighted at `position` seconds.
 * Tolerant of unsorted or partially timestamped lines: only genuine
 * timestamps participate, and the latest one at-or-before the position wins.
 */
export function activeLineIndexFor(lyrics: { lines: LyricLine[]; synced: boolean } | null, position: number): number {
  if (!lyrics?.synced || !lyrics.lines.length) return -1;

  let index = -1;
  let bestTime = -Infinity;
  for (let i = 0; i < lyrics.lines.length; i++) {
    const t = lyrics.lines[i].time;
    if (t === undefined || !isFinite(t)) continue;
    if (t <= position && t >= bestTime) {
      bestTime = t;
      index = i;
    }
  }
  return index;
}
