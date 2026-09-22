const http = require('http');
const { handleStreamRequest } = require('./streamProxy');
const { handleLyricsRequest } = require('./lyricsProxy');

let cachedConfig = {
  clientVersion: '1.20260915.14.00',
  apiKey: 'AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30',
  visitorData: '',
  fetchedAt: 0,
};

async function getFreshConfig() {
  if (Date.now() - cachedConfig.fetchedAt < 3600_000) {
    return cachedConfig;
  }
  try {
    const res = await fetch('https://music.youtube.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const html = await res.text();
      const matchVer = html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/);
      const matchKey = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
      const matchVis = html.match(/"VISITOR_DATA":"([^"]+)"/);
      if (matchVer) cachedConfig.clientVersion = matchVer[1];
      if (matchKey) cachedConfig.apiKey = matchKey[1];
      if (matchVis) cachedConfig.visitorData = matchVis[1];
      cachedConfig.fetchedAt = Date.now();
    }
  } catch (err) {
    console.warn('[apiProxy] Failed to refresh InnerTube config, using fallback:', err.message);
  }
  return cachedConfig;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleApiRequest(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-YouTube-Client-Name, X-YouTube-Client-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true;
  }

  const parsedUrl = new URL(req.url, 'http://localhost:3000');
  const pathname = parsedUrl.pathname;

  if (pathname.startsWith('/api/stream/')) {
    const handled = await handleStreamRequest(req, res, pathname, parsedUrl);
    if (handled) return true;
  }

  if (pathname === '/api/lyrics') {
    const handled = await handleLyricsRequest(req, res, parsedUrl);
    if (handled) return true;
  }

  if (pathname === '/api/innertube/config') {
    const cfg = await getFreshConfig();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(cfg));
    return true;
  }

  if (pathname.startsWith('/api/innertube/')) {
    const endpoint = pathname.replace('/api/innertube/', '');
    const query = parsedUrl.search;
    const bodyText = await readBody(req);

    const cfg = await getFreshConfig();
    const primaryUrl = `https://music.youtube.com/youtubei/v1/${endpoint}${query || `?key=${cfg.apiKey}`}`;
    const fallbackUrl = `https://www.youtube.com/youtubei/v1/${endpoint}${query || `?key=${cfg.apiKey}`}`;

    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Origin': 'https://music.youtube.com',
      'Referer': 'https://music.youtube.com/',
      'X-YouTube-Client-Name': '67',
      'X-YouTube-Client-Version': cfg.clientVersion,
    };
    if (cfg.visitorData) {
      headers['X-Goog-Visitor-Id'] = cfg.visitorData;
    }

    try {
      let upstreamRes = await fetch(primaryUrl, {
        method: req.method || 'POST',
        headers,
        body: bodyText || undefined,
        signal: AbortSignal.timeout(12000),
      });

      if (!upstreamRes.ok && upstreamRes.status !== 404) {
        // Try fallback on plain YouTube host
        headers['Origin'] = 'https://www.youtube.com';
        headers['Referer'] = 'https://www.youtube.com/';
        try {
          const fallbackRes = await fetch(fallbackUrl, {
            method: req.method || 'POST',
            headers,
            body: bodyText || undefined,
            signal: AbortSignal.timeout(12000),
          });
          if (fallbackRes.ok) {
            upstreamRes = fallbackRes;
          }
        } catch {}
      }

      const data = await upstreamRes.text();
      res.writeHead(upstreamRes.status, {
        'Content-Type': upstreamRes.headers.get('content-type') || 'application/json',
      });
      res.end(data);
      return true;
    } catch (err) {
      console.error('[apiProxy] Error proxying InnerTube request:', err);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to proxy request', message: err.message }));
      return true;
    }
  }

  return false;
}

module.exports = { handleApiRequest };
