const { transliterateLine } = require('./romanizer');

const lyricsCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const MISS_TTL = 15 * 60 * 1000; // "no lyrics found" is cached briefly so an
// unavailable song doesn't re-hit the providers on every open, but a provider
// that gains the lyrics later is picked up within minutes.

/**
 * Clean up title string (remove "Official Video", "(Official Audio)", "ft.", etc.)
 */
function cleanSongTitle(title) {
  if (!title) return '';
  return title
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\([^)]*(?:official|video|audio|lyrics|music|remastered|version|hd|4k|visualizer|extended|original)[^)]*\)/gi, '')
    .replace(/\|\s*.*$/g, '')
    .replace(/-\s*official.*$/gi, '')
    .replace(/ft\.?.*$/i, '')
    .replace(/feat\.?.*$/i, '')
    .replace(/[#@][\w]+/g, '')
    .trim();
}

/**
 * Clean artist name
 */
function cleanArtistName(artist) {
  if (!artist) return '';
  return artist
    .replace(/-\s*Topic$/i, '')
    .replace(/VEVO$/i, '')
    .replace(/Official$/i, '')
    .split(/[,&/|]/)[0]
    .trim();
}

/** Normalise text for match verification: lowercase, strip punctuation/feats. */
function normalizeForMatch(s) {
  return (s || '')
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(/\b(official|video|audio|lyrics|music|video|remastered|hd|4k)\b/g, ' ')
    .replace(/\b(ft|feat|featuring)\b.*$/g, ' ')
    .replace(/\b(topic|vevo)\b/g, ' ')
    .replace(/[^a-z0-9\u00c0-\u024f\u0400-\u04ff\u0600-\u06ff\u0900-\u097f\u0a00-\u0a7f\u3040-\u30ff\uac00-\ud7a3]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Whole-token containment: every token of `needle` must appear as an EXACT
 * token of `haystack` — "night" must not match inside "Midnight".
 */
function tokensContained(needle, haystack) {
  const needleTokens = needle.split(' ').filter(Boolean);
  if (needleTokens.length === 0) return false;
  const haystackTokens = new Set(haystack.split(' ').filter(Boolean));
  return needleTokens.every((t) => haystackTokens.has(t));
}

/**
 * Verify + score one LRCLIB hit against the requested track.
 *
 * The old implementation took the FIRST hit with any synced lyrics — queries
 * degrade to a bare title, so lyrics from a different artist/version could be
 * served for one track. Every candidate now has to plausibly BE the requested
 * song: its normalised title must match, and artist/duration agreement adds
 * score. Returns null for hits that are not the requested song.
 */
function scoreLrclibHit(hit, reqTitleNorm, reqArtistNorm, duration) {
  if (!hit) return null;
  const hitTitle = normalizeForMatch(hit.trackName);
  const hitArtist = normalizeForMatch(hit.artistName);
  if (!hitTitle) return null;

  // Title must match: exact normalised equality, or the requested title is
  // fully contained in the hit title (or vice versa) — covers "(Live)" style
  // variants. A hit whose title shares no full token with the request is a
  // different song and is rejected outright.
  let score = 0;
  if (hitTitle === reqTitleNorm) score += 4;
  else if (reqTitleNorm && tokensContained(reqTitleNorm, hitTitle)) score += 3;
  else if (hitTitle && tokensContained(hitTitle, reqTitleNorm)) score += 2;
  else return null;

  // Artist agreement strengthens the match; disagreement is suspicious but
  // not fatal on its own (compilations, featured credits) — it just cannot
  // rescue a weak title match.
  // Artist identity is mandatory when the request names one: the same title
  // recorded by a different artist is exactly the "lyrics for another
  // version" failure this module exists to prevent.
  let artistAgrees = false;
  if (reqArtistNorm && hitArtist) {
    if (hitArtist === reqArtistNorm) { score += 3; artistAgrees = true; }
    else if (tokensContained(reqArtistNorm, hitArtist) || tokensContained(hitArtist, reqArtistNorm)) {
      score += 2; artistAgrees = true;
    }
  }
  if (reqArtistNorm && hitArtist && !artistAgrees) return null;

  // Duration proximity (LRCLIB reports seconds; tolerate one reconnect boundary).
  if (duration > 0 && typeof hit.duration === 'number' && hit.duration > 0) {
    const delta = Math.abs(hit.duration - duration);
    if (delta <= 5) score += 2;
    else if (delta <= 12) score += 1;
    else score -= 1;
  }

  // Synced availability is a tiebreaker only, never a substitute for identity.
  if (hit.syncedLyrics) score += 1;

  return score;
}

/**
 * Convert raw synced LRC lyrics into lines.
 *
 * Genuine timestamps are kept; the provider's original text is always
 * preserved (`original` is set only when romanization actually changed the
 * line). Plain text is NEVER given invented timestamps here.
 */
function parseSyncedLyrics(syncedText) {
  const lines = [];
  let anyRomanized = false;
  const rawLines = syncedText.split('\n');
  for (const line of rawLines) {
    const match = line.match(/^\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\](.*)$/);
    if (!match) continue;
    const mins = parseInt(match[1], 10);
    const secs = parseInt(match[2], 10);
    const ms = match[3] ? parseInt(match[3].padEnd(3, '0').slice(0, 3), 10) : 0;
    const time = mins * 60 + secs + ms / 1000;
    const rawText = match[4].trim();
    if (!rawText) continue;

    const t = transliterateLine(rawText);
    if (t.romanized) anyRomanized = true;
    if (!t.text) continue;
    const entry = { time, text: t.text };
    if (t.romanized) entry.original = rawText;
    lines.push(entry);
  }
  return { lines, anyRomanized };
}

/**
 * Convert plain lyrics into UNsynced lines — no timestamps are invented.
 * (The previous implementation distributed plain lines evenly across the
 * duration and returned synced:true, which faked live synchronization.)
 */
function parsePlainLyrics(plainText) {
  const rawLines = (plainText || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 300);

  let anyRomanized = false;
  const lines = [];
  for (const raw of rawLines) {
    const t = transliterateLine(raw);
    if (t.romanized) anyRomanized = true;
    if (!t.text) continue;
    const entry = { text: t.text };
    if (t.romanized) entry.original = raw;
    lines.push(entry);
  }
  return { lines, anyRomanized };
}

/**
 * Fetch from LRCLIB with several query strategies, accepting only VERIFIED
 * matches. Returns { lines, synced, source, romanized } or null.
 */
async function fetchFromLrclib(title, artist, duration) {
  const cleanedTitle = cleanSongTitle(title);
  const primaryArtist = cleanArtistName(artist);
  const reqTitleNorm = normalizeForMatch(cleanedTitle || title);
  const reqArtistNorm = normalizeForMatch(primaryArtist || artist);

  const queries = [
    `${cleanedTitle} ${primaryArtist}`.trim(),
    `${cleanedTitle} ${artist}`.trim(),
    `${title} ${primaryArtist}`.trim(),
    cleanedTitle,
  ].filter(Boolean);

  const seenQueries = new Set();
  // Best verified candidate across ALL queries — not the first hit.
  let best = null; // { score, lines, synced, source, romanized }

  const consider = (hit) => {
    const score = scoreLrclibHit(hit, reqTitleNorm, reqArtistNorm, duration);
    if (score === null || score < 3) return; // identity bar: title must match
    if (best && score <= best.score) return;

    if (hit.syncedLyrics) {
      const parsed = parseSyncedLyrics(hit.syncedLyrics);
      if (parsed.lines.length >= 3) {
        best = {
          score,
          lines: parsed.lines,
          synced: true,
          romanized: parsed.anyRomanized,
          source: 'LRCLIB',
        };
      }
      return;
    }
    if (hit.plainLyrics) {
      const parsed = parsePlainLyrics(hit.plainLyrics);
      if (parsed.lines.length >= 3) {
        best = {
          score,
          lines: parsed.lines,
          synced: false,
          romanized: parsed.anyRomanized,
          source: 'LRCLIB',
        };
      }
    }
  };

  for (const query of queries) {
    const key = query.toLowerCase();
    if (seenQueries.has(key)) continue;
    seenQueries.add(key);

    try {
      const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`, {
        signal: AbortSignal.timeout(3500),
        headers: { 'User-Agent': 'ArkifyMusic/1.2.0 (contact@arkifymusic.internal)' },
      });
      if (!res.ok) continue;

      const items = await res.json();
      if (!Array.isArray(items)) continue;
      for (const hit of items) consider(hit);
    } catch {
      // Continue to next query
    }
  }

  if (best) return { lines: best.lines, synced: best.synced, source: best.source, romanized: best.romanized };

  // Direct get endpoint — same verification, last chance for exact metadata.
  try {
    const directUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanedTitle)}&artist_name=${encodeURIComponent(primaryArtist)}`;
    const res = await fetch(directUrl, {
      signal: AbortSignal.timeout(3000),
      headers: { 'User-Agent': 'ArkifyMusic/1.2.0 (contact@arkifymusic.internal)' },
    });
    if (res.ok) {
      const hit = await res.json();
      const score = scoreLrclibHit(hit, reqTitleNorm, reqArtistNorm, duration);
      if (score !== null && score >= 3) {
        if (hit.syncedLyrics) {
          const parsed = parseSyncedLyrics(hit.syncedLyrics);
          if (parsed.lines.length >= 3) {
            return { lines: parsed.lines, synced: true, source: 'LRCLIB', romanized: parsed.anyRomanized };
          }
        }
        if (hit.plainLyrics) {
          const parsed = parsePlainLyrics(hit.plainLyrics);
          if (parsed.lines.length >= 3) {
            return { lines: parsed.lines, synced: false, source: 'LRCLIB', romanized: parsed.anyRomanized };
          }
        }
      }
    }
  } catch {
    // Non-fatal
  }

  return null;
}

/**
 * Fetch from Lyrics.ovh as secondary fallback (plain text only — it is
 * presented unsynced, with no invented timestamps).
 */
async function fetchFromLyricsOvh(title, artist) {
  const cleanedTitle = cleanSongTitle(title);
  const primaryArtist = cleanArtistName(artist);

  if (!primaryArtist || !cleanedTitle) return null;

  try {
    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(primaryArtist)}/${encodeURIComponent(cleanedTitle)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;

    const data = await res.json();
    if (data && data.lyrics && typeof data.lyrics === 'string') {
      const parsed = parsePlainLyrics(data.lyrics);
      if (parsed.lines.length >= 3) {
        return {
          lines: parsed.lines,
          synced: false,
          source: 'Lyrics.ovh',
          romanized: parsed.anyRomanized,
        };
      }
    }
  } catch {
    // Non-fatal
  }
  return null;
}

/**
 * Handle incoming /api/lyrics requests.
 *
 * Honesty contract (this is the API the shipped app relies on):
 *   - only VERIFIED matches are returned (title identity is mandatory),
 *   - `synced: true` means genuine per-line timestamps from an LRC payload,
 *   - plain lyrics are returned unsynced — never with invented timestamps,
 *   - when nothing matches, `lines: []` is returned and the app shows its
 *     explicit unavailable state; lyrics are never generated or invented.
 */
async function handleLyricsRequest(req, res, parsedUrl) {
  const query = parsedUrl.searchParams;
  const title = query.get('title') || '';
  const artist = query.get('artist') || '';
  const duration = parseFloat(query.get('duration') || '0');
  const trackId = query.get('id') || `${title}_${artist}`;

  if (!title) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing title parameter' }));
    return true;
  }

  const cacheKey = `${title.toLowerCase().trim()}___${artist.toLowerCase().trim()}`;
  const cached = lyricsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ trackId, ...cached.data }));
    return true;
  }

  // 1. LRCLIB with verified matching
  let lyricsData = await fetchFromLrclib(title, artist, duration);

  // 2. Lyrics.ovh fallback (plain, unsynced)
  if (!lyricsData) {
    lyricsData = await fetchFromLyricsOvh(title, artist);
  }

  let payload;
  let ttl = CACHE_TTL;

  if (lyricsData && lyricsData.lines && lyricsData.lines.length > 0) {
    payload = {
      lines: lyricsData.lines,
      synced: lyricsData.synced === true,
      source: lyricsData.source || 'LRCLIB',
      romanized: lyricsData.romanized === true,
    };
  } else {
    // No verified lyrics found anywhere. Return an explicit empty result —
    // the app renders its unavailable state. NEVER generate placeholder or
    // "(Verse 1)"-style filler lyrics.
    payload = { lines: [], synced: false, source: null, romanized: false };
    ttl = MISS_TTL;
  }

  lyricsCache.set(cacheKey, { timestamp: Date.now(), ttl, data: payload });

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ trackId, ...payload }));
  return true;
}

module.exports = { handleLyricsRequest, scoreLrclibHit, normalizeForMatch };
