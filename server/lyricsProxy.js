const { toRomanEnglish, transliterateLine } = require('./romanizer');

const lyricsCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

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

/**
 * Convert raw synced LRC lyrics string into array of { time: number, text: string }
 */
function parseSyncedLyrics(syncedText) {
  const lines = [];
  const rawLines = syncedText.split('\n');
  for (const line of rawLines) {
    const match = line.match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)$/);
    if (match) {
      const mins = parseInt(match[1], 10);
      const secs = parseInt(match[2], 10);
      const ms = parseInt(match[3].padEnd(3, '0').slice(0, 3), 10);
      const time = mins * 60 + secs + ms / 1000;
      const rawText = match[4].trim();
      if (rawText) {
        const romanText = transliterateLine(rawText);
        if (romanText) {
          lines.push({ time, text: romanText });
        }
      }
    }
  }
  return lines;
}

/**
 * Convert plain lyrics string into timed array distributed across track duration
 */
function parsePlainLyrics(plainText, duration) {
  const rawLines = plainText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (rawLines.length === 0) return [];

  const dur = Math.max(30, duration || 180);
  const total = rawLines.length;
  const startOffset = Math.min(8, dur * 0.05);
  const effectiveDur = dur - startOffset - Math.min(10, dur * 0.08);
  const step = effectiveDur / Math.max(1, total);

  const lines = [];
  rawLines.forEach((text, idx) => {
    const roman = transliterateLine(text);
    if (roman) {
      lines.push({
        time: Math.round((startOffset + idx * step) * 10) / 10,
        text: roman,
      });
    }
  });

  return lines;
}

/**
 * Fetch from LRCLIB with multiple query strategies
 */
async function fetchFromLrclib(title, artist, duration) {
  const cleanedTitle = cleanSongTitle(title);
  const primaryArtist = cleanArtistName(artist);

  const queries = [
    `${cleanedTitle} ${primaryArtist}`.trim(),
    `${cleanedTitle} ${artist}`.trim(),
    `${title} ${primaryArtist}`.trim(),
    cleanedTitle,
    title,
  ].filter(Boolean);

  const seenQueries = new Set();

  for (const query of queries) {
    if (seenQueries.has(query.toLowerCase())) continue;
    seenQueries.add(query.toLowerCase());

    try {
      const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`, {
        signal: AbortSignal.timeout(3500),
        headers: { 'User-Agent': 'AudiaMusic/1.2.0 (contact@audiamusic.internal)' },
      });
      if (!res.ok) continue;

      const items = await res.json();
      if (!Array.isArray(items) || items.length === 0) continue;

      // Find best match in hits
      for (const hit of items) {
        if (hit.syncedLyrics) {
          const lines = parseSyncedLyrics(hit.syncedLyrics);
          if (lines.length > 0) {
            return {
              lines,
              synced: true,
              source: 'Roman English (Live Synced)',
            };
          }
        }
        if (hit.plainLyrics) {
          const lines = parsePlainLyrics(hit.plainLyrics, duration || hit.duration || 180);
          if (lines.length > 0) {
            return {
              lines,
              synced: true,
              source: 'Roman English (Timed)',
            };
          }
        }
      }
    } catch {
      // Continue to next query
    }
  }

  // Try direct LRCLIB get endpoint
  try {
    const directUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanedTitle)}&artist_name=${encodeURIComponent(primaryArtist)}`;
    const res = await fetch(directUrl, {
      signal: AbortSignal.timeout(3000),
      headers: { 'User-Agent': 'AudiaMusic/1.2.0' },
    });
    if (res.ok) {
      const hit = await res.json();
      if (hit && hit.syncedLyrics) {
        const lines = parseSyncedLyrics(hit.syncedLyrics);
        if (lines.length > 0) {
          return {
            lines,
            synced: true,
            source: 'Roman English (Live Synced)',
          };
        }
      }
      if (hit && hit.plainLyrics) {
        const lines = parsePlainLyrics(hit.plainLyrics, duration || hit.duration || 180);
        if (lines.length > 0) {
          return {
            lines,
            synced: true,
            source: 'Roman English (Timed)',
          };
        }
      }
    }
  } catch {
    // Non-fatal
  }

  return null;
}

/**
 * Fetch from Lyrics.ovh as secondary fallback
 */
async function fetchFromLyricsOvh(title, artist, duration) {
  const cleanedTitle = cleanSongTitle(title);
  const primaryArtist = cleanArtistName(artist);

  if (!primaryArtist || !cleanedTitle) return null;

  try {
    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(primaryArtist)}/${encodeURIComponent(cleanedTitle)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;

    const data = await res.json();
    if (data && data.lyrics && typeof data.lyrics === 'string') {
      const lines = parsePlainLyrics(data.lyrics, duration);
      if (lines.length > 0) {
        return {
          lines,
          synced: true,
          source: 'Roman English (Lyrics.ovh)',
        };
      }
    }
  } catch {
    // Non-fatal
  }
  return null;
}

/**
 * Generate rhythmic Roman English lyrics if unindexed in databases
 */
function generateRhythmicRomanLyrics(title, artist, duration) {
  const cleaned = cleanSongTitle(title) || title || 'Song';
  const cleanArt = cleanArtistName(artist) || artist || 'Artist';
  const dur = Math.max(45, duration || 180);

  const lines = [
    { time: 0, text: `♪ (Intro) ♪` },
    { time: Math.min(10, Math.round(dur * 0.05)), text: `${cleaned}` },
    { time: Math.min(18, Math.round(dur * 0.1)), text: `by ${cleanArt}` },
    { time: Math.round(dur * 0.18), text: `♪ (Verse 1) ♪` },
    { time: Math.round(dur * 0.32), text: `♪ (Hook / Chorus) ♪` },
    { time: Math.round(dur * 0.45), text: `${cleaned} · ${cleanArt}` },
    { time: Math.round(dur * 0.58), text: `♪ (Verse 2 / Solo) ♪` },
    { time: Math.round(dur * 0.72), text: `♪ (Chorus & Bridge) ♪` },
    { time: Math.round(dur * 0.85), text: `♪ (Outro) ♪` },
    { time: Math.max(dur - 8, Math.round(dur * 0.94)), text: `♪ ♪ ♪` },
  ];

  return {
    lines,
    synced: true,
    source: 'Roman English (Audio Rhythm)',
  };
}

/**
 * Handle incoming /api/lyrics requests
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
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ trackId, ...cached.data }));
    return true;
  }

  let lyricsData = null;

  // 1. Try LRCLIB with fuzzy matching
  lyricsData = await fetchFromLrclib(title, artist, duration);

  // 2. Try lyrics.ovh fallback
  if (!lyricsData) {
    lyricsData = await fetchFromLyricsOvh(title, artist, duration);
  }

  // 3. Fallback: Always generate structured Roman English rhythm so every single song has lyrics
  if (!lyricsData || !lyricsData.lines || lyricsData.lines.length === 0) {
    lyricsData = generateRhythmicRomanLyrics(title, artist, duration);
  }

  // Cache result
  lyricsCache.set(cacheKey, {
    timestamp: Date.now(),
    data: lyricsData,
  });

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      trackId,
      lines: lyricsData.lines,
      synced: lyricsData.synced ?? true,
      source: lyricsData.source || 'Roman English',
    })
  );
  return true;
}

module.exports = { handleLyricsRequest };
