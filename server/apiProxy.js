/**
 * server/apiProxy — same-origin companion API for the published web build.
 *
 * The web client cannot talk to YouTube Music directly (CORS), so this server
 * stands in as a thin, stateless proxy:
 *
 *   GET  /api/health                 → liveness probe
 *   GET  /api/innertube/config       → scraped InnerTube client identity
 *   *    /api/innertube/:endpoint    → proxied YouTube Music InnerTube call
 *   GET  /api/lyrics                 → synced lyrics (lrclib + fallbacks)
 *   GET  /api/stream/resolve?id=     → resolve a YouTube audio stream URL
 *   GET  /api/stream/audio?id=       → proxy the audio bytes (HTTP Range)
 *   GET  /api/artwork?url=           → CORS-safe image proxy (palette engine)
 *
 * Everything is best-effort: a failed upstream call returns a JSON error and
 * the client keeps working with cached data or its fallback paths (the web
 * player, for example, plays through the YouTube IFrame API directly).
 */
const { Readable } = require('stream');
const { handleLyricsRequest } = require('./lyricsProxy');

// ---------------------------------------------------------------------------
// InnerTube client identity (shared by discovery proxy + stream resolver)
// ---------------------------------------------------------------------------

const MUSIC_HOME = 'https://music.youtube.com/';
const INNERTUBE_BASE = 'https://music.youtube.com/youtubei/v1';

/** Verified-working offline fallback, identical to the client's own fallback. */
const FALLBACK_CONFIG = {
  clientVersion: '1.20260915.14.00',
  apiKey: 'AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30',
  visitorData: '',
};

let clientConfig = { ...FALLBACK_CONFIG };
let clientConfigAt = 0;
let clientConfigInflight = null;
const CONFIG_TTL = 60 * 60 * 1000;

function scrape(html, key) {
  const match = new RegExp(`"${key}":"([^"]+)"`).exec(html);
  return match ? match[1] : '';
}

function getClientConfig() {
  if (Date.now() - clientConfigAt < CONFIG_TTL) return Promise.resolve(clientConfig);
  if (clientConfigInflight) return clientConfigInflight;

  clientConfigInflight = (async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8_000);
      const res = await fetch(MUSIC_HOME, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const html = await res.text();
        clientConfig = {
          clientVersion: scrape(html, 'INNERTUBE_CLIENT_VERSION') || clientConfig.clientVersion,
          apiKey: scrape(html, 'INNERTUBE_API_KEY') || clientConfig.apiKey,
          visitorData: scrape(html, 'VISITOR_DATA') || clientConfig.visitorData,
        };
        clientConfigAt = Date.now();
        console.log('[apiProxy] client config refreshed:', clientConfig.clientVersion);
      }
    } catch (e) {
      // Keep previous values; discovery still works with the fallback.
    } finally {
      clientConfigInflight = null;
    }
    return clientConfig;
  })();

  return clientConfigInflight;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
  return true;
}

function readBody(req, limit = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Route: /api/innertube/:endpoint  (search / next / browse / suggestions)
// ---------------------------------------------------------------------------

async function handleInnertube(req, res, endpoint, parsedUrl) {
  const cfg = await getClientConfig();
  const apiKey = parsedUrl.searchParams.get('key') || cfg.apiKey;
  const upstreamUrl =
    `${INNERTUBE_BASE}/${endpoint}?key=${encodeURIComponent(apiKey)}&prettyPrint=false`;

  const raw = req.method === 'POST' ? await readBody(req) : '';
  let body;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return sendJson(res, 400, { error: 'Invalid JSON body' });
  }

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent': BROWSER_UA,
    'X-YouTube-Client-Name': '67',
    'X-YouTube-Client-Version': cfg.clientVersion,
    Origin: 'https://music.youtube.com',
    Referer: 'https://music.youtube.com/',
  };
  if (cfg.visitorData) headers['X-Goog-Visitor-Id'] = cfg.visitorData;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const upstream = await fetch(upstreamUrl, {
      method: req.method === 'POST' ? 'POST' : 'GET',
      headers,
      body: req.method === 'POST' ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await upstream.text();
    res.writeHead(upstream.status, {
      'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(text);
  } catch (e) {
    return sendJson(res, 502, { error: 'Upstream InnerTube call failed', detail: String(e && e.message || e) });
  } finally {
    clearTimeout(timer);
  }
  return true;
}

// ---------------------------------------------------------------------------
// Route: /api/stream/resolve + /api/stream/audio
// ---------------------------------------------------------------------------

/**
 * Resolve a video id to a direct audio-only googlevideo URL.
 *
 * Strategy 1: the ANDROID InnerTube `player` client (plain URLs, no
 * deciphering needed). Strategy 2: youtubei.js, which handles ciphered
 * responses. Both best-effort; null when both fail (the web client falls
 * back to the IFrame player, so playback still works).
 */
const ANDROID_KEY = 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w';

async function resolveViaAndroidPlayer(videoId) {
  const res = await fetch(
    `https://www.youtube.com/youtubei/v1/player?key=${ANDROID_KEY}&prettyPrint=false`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'com.google.android.youtube/19.44.38 (Linux; U; Android 11) gzip',
        'X-YouTube-Client-Name': '3',
        'X-YouTube-Client-Version': '19.44.38',
      },
      body: JSON.stringify({
        videoId,
        contentCheckOk: true,
        racyCheckOk: true,
        context: {
          client: {
            clientName: 'ANDROID',
            clientVersion: '19.44.38',
            androidSdkVersion: 30,
            hl: 'en',
            gl: 'US',
          },
        },
      }),
      signal: AbortSignal.timeout(12_000),
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (data?.playabilityStatus?.status !== 'OK') return null;

  const formats = data?.streamingData?.adaptiveFormats || [];
  const audio = formats
    .filter((f) => typeof f.url === 'string' && String(f.mimeType || '').startsWith('audio/'))
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
  if (!audio) return null;
  return { url: audio.url, mimeType: String(audio.mimeType).split(';')[0] };
}

let ytClientPromise = null;
async function resolveViaYoutubei(videoId) {
  try {
    const { Innertube } = require('youtubei.js');
    if (!ytClientPromise) ytClientPromise = Innertube.create().catch(() => null);
    const yt = await ytClientPromise;
    if (!yt) return null;
    const info = await yt.getInfo(videoId);
    let fmt = null;
    try { fmt = info.chooseSource({ type: 'audio', quality: 'best' }); } catch {}
    if (!fmt) { try { fmt = info.select({ type: 'audio', quality: 'best' }); } catch {} }
    const url = fmt?.url;
    if (!url) return null;
    return { url, mimeType: fmt.mime_type || 'audio/mp4' };
  } catch {
    return null;
  }
}

const streamCache = new Map(); // videoId -> { url, mimeType, at }
const STREAM_TTL = 20 * 60 * 1000;

async function resolveAudio(videoId) {
  const hit = streamCache.get(videoId);
  if (hit && Date.now() - hit.at < STREAM_TTL) return hit;

  let resolved = null;
  try { resolved = await resolveViaAndroidPlayer(videoId); } catch {}
  if (!resolved) resolved = await resolveViaYoutubei(videoId);
  if (!resolved) return null;

  const entry = { ...resolved, at: Date.now() };
  streamCache.set(videoId, entry);
  return entry;
}

function isSafeUpstream(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname.endsWith('.googlevideo.com');
  } catch {
    return false;
  }
}

// Artwork hosts the client may legitimately need pixel access to. Closed
// allowlist: this endpoint must never become an open relay.
const ARTWORK_HOSTS = [
  /(^|\.)ytimg\.com$/,
  /(^|\.)ggpht\.com$/,
  /(^|\.)googleusercontent\.com$/,
  /(^|\.)youtube\.com$/,
];

function isSafeArtwork(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    return ARTWORK_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

const BROWSER_UA_IMAGE =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/**
 * GET /api/artwork?url=<https image url>
 * Streams a remote image same-origin so the browser's canvas can read pixels
 * without tainting. Only allowlisted image hosts, only images, hard size cap.
 */
async function handleArtwork(req, res, parsedUrl) {
  const url = parsedUrl.searchParams.get('url');
  if (!url) return sendJson(res, 400, { error: 'Missing url' });
  if (!isSafeArtwork(url)) return sendJson(res, 403, { error: 'Host not allowed' });

  try {
    const upstream = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA_IMAGE, Accept: 'image/*' },
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
    });

    const type = upstream.headers.get('content-type') || '';
    if (!upstream.ok || !type.startsWith('image/')) {
      return sendJson(res, 502, { error: 'Not an image' });
    }
    const len = Number(upstream.headers.get('content-length') || 0);
    if (len > 3 * 1024 * 1024) {
      return sendJson(res, 502, { error: 'Image too large' });
    }

    res.writeHead(200, {
      'Content-Type': type,
      // Artwork URLs are content-addressed by video id; a day of caching is
      // safe and keeps palette extraction nearly free on repeat plays.
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*',
    });
    if (!upstream.body) {
      res.end();
      return true;
    }
    Readable.fromWeb(upstream.body).on('error', () => res.end()).pipe(res);
  } catch (e) {
    if (!res.headersSent) {
      return sendJson(res, 502, { error: 'Artwork fetch failed', detail: String((e && e.message) || e) });
    }
    res.end();
  }
  return true;
}

async function handleStreamAudio(req, res, parsedUrl) {
  const id = parsedUrl.searchParams.get('id');
  if (!id) return sendJson(res, 400, { error: 'Missing id' });

  const resolved = await resolveAudio(id);
  if (!resolved || !isSafeUpstream(resolved.url)) {
    return sendJson(res, 502, { error: 'Stream resolution failed for this track' });
  }

  const headers = { 'User-Agent': BROWSER_UA };
  if (req.headers.range) headers.Range = req.headers.range;

  try {
    const upstream = await fetch(resolved.url, {
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(30_000),
    });

    const out = {
      'Content-Type': upstream.headers.get('content-type') || resolved.mimeType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    };
    for (const h of ['content-range', 'content-length']) {
      const v = upstream.headers.get(h);
      if (v) out[h] = v;
    }

    res.writeHead(upstream.status, out);
    if (!upstream.body) {
      res.end();
      return true;
    }
    Readable.fromWeb(upstream.body).on('error', () => res.end()).pipe(res);
  } catch (e) {
    if (!res.headersSent) {
      return sendJson(res, 502, { error: 'Audio fetch failed', detail: String(e && e.message || e) });
    }
    res.end();
  }
  return true;
}

async function handleStreamResolve(req, res, parsedUrl) {
  const id = parsedUrl.searchParams.get('id');
  if (!id) return sendJson(res, 400, { error: 'Missing id' });

  const resolved = await resolveAudio(id);
  if (!resolved) {
    return sendJson(res, 502, { error: 'Stream resolution failed for this track' });
  }

  return sendJson(res, 200, {
    url: `/api/stream/audio?id=${encodeURIComponent(id)}`,
    mimeType: resolved.mimeType,
    expiresAt: Date.now() + STREAM_TTL,
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

async function handleApiRequest(req, res) {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = parsedUrl.pathname;
  if (!path.startsWith('/api/')) return false;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Accept,X-YouTube-Client-Name,X-YouTube-Client-Version',
    });
    res.end();
    return true;
  }

  try {
    if (path === '/api/health') {
      return sendJson(res, 200, { ok: true, service: 'arkify', ts: Date.now() });
    }
    if (path === '/api/innertube/config') {
      const cfg = await getClientConfig();
      return sendJson(res, 200, cfg);
    }
    if (path.startsWith('/api/innertube/')) {
      const endpoint = path.slice('/api/innertube/'.length).replace(/\/+$/, '');
      if (!endpoint) return sendJson(res, 404, { error: 'Unknown endpoint' });
      return await handleInnertube(req, res, endpoint, parsedUrl);
    }
    if (path === '/api/lyrics' || path.startsWith('/api/lyrics/')) {
      return await handleLyricsRequest(req, res, parsedUrl);
    }
    if (path === '/api/stream/resolve') {
      return await handleStreamResolve(req, res, parsedUrl);
    }
    if (path === '/api/stream/audio') {
      return await handleStreamAudio(req, res, parsedUrl);
    }
    if (path === '/api/artwork') {
      return await handleArtwork(req, res, parsedUrl);
    }
    return sendJson(res, 404, { error: 'Unknown API route' });
  } catch (err) {
    console.error('[apiProxy] error:', err);
    if (!res.headersSent) {
      return sendJson(res, 500, { error: 'Internal server error' });
    }
    res.end();
    return true;
  }
}

module.exports = { handleApiRequest };
