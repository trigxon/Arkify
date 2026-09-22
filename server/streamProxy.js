const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');

// Cache resolved stream URLs: videoId -> { url: string, expiresAt: number }
const streamCache = new Map();
// De-duplicate concurrent resolution for the same videoId
const inFlightResolves = new Map();

function getYtDlpPath() {
  const localBin = path.join(__dirname, '..', 'bin', 'yt-dlp');
  if (fs.existsSync(localBin)) {
    return localBin;
  }
  if (fs.existsSync('/tmp/yt-dlp')) {
    return '/tmp/yt-dlp';
  }
  return 'yt-dlp';
}

/**
 * 1. Directly query YouTube's InnerTube Player API using Android / iOS / TV clients.
 * These clients return direct CDN audio URLs with NO cipher signatures.
 */
async function resolveWithInnerTubePlayerApi(videoId) {
  const clients = [
    {
      name: 'ANDROID',
      body: {
        videoId,
        context: {
          client: {
            clientName: 'ANDROID',
            clientVersion: '19.29.37',
            androidSdkVersion: 30,
            hl: 'en',
            gl: 'US',
          },
        },
      },
    },
    {
      name: 'IOS',
      body: {
        videoId,
        context: {
          client: {
            clientName: 'IOS',
            clientVersion: '19.29.1',
            deviceModel: 'iPhone16,2',
            hl: 'en',
            gl: 'US',
          },
        },
      },
    },
    {
      name: 'TVHTML5',
      body: {
        videoId,
        context: {
          client: {
            clientName: 'TVHTML5',
            clientVersion: '7.20260915.11.00',
            hl: 'en',
            gl: 'US',
          },
        },
      },
    },
    {
      name: 'WEB_EMBEDDED',
      body: {
        videoId,
        context: {
          client: {
            clientName: 'WEB_EMBEDDED_PLAYER',
            clientVersion: '1.20260915.01.00',
            hl: 'en',
            gl: 'US',
          },
          thirdParty: {
            embedUrl: 'https://www.youtube.com',
          },
        },
      },
    },
  ];

  for (const client of clients) {
    try {
      const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent':
            client.name === 'IOS'
              ? 'com.google.ios.youtube/19.29.1 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X; en_US)'
              : client.name === 'ANDROID'
              ? 'com.google.android.youtube/19.29.37 (Linux; U; Android 11) gzip'
              : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'X-YouTube-Client-Name': client.name === 'ANDROID' ? '3' : client.name === 'IOS' ? '5' : '1',
          'X-YouTube-Client-Version': client.body.context.client.clientVersion,
          Origin: 'https://www.youtube.com',
        },
        body: JSON.stringify(client.body),
        signal: AbortSignal.timeout(6000),
      });

      if (res.ok) {
        const data = await res.json();
        const playabilityStatus = data?.playabilityStatus?.status;
        if (playabilityStatus === 'OK' && data?.streamingData) {
          const formats = [
            ...(data.streamingData.adaptiveFormats || []),
            ...(data.streamingData.formats || []),
          ];
          const audioOnly = formats
            .filter((f) => f?.url && (f.mimeType?.includes('audio') || !f.mimeType?.includes('video')))
            .sort((a, b) => (b.bitrate || b.averageBitrate || 0) - (a.bitrate || a.averageBitrate || 0));

          if (audioOnly.length > 0 && audioOnly[0].url) {
            return audioOnly[0].url;
          }

          // Any format with direct url
          const anyDirect = formats.find((f) => f?.url);
          if (anyDirect?.url) {
            return anyDirect.url;
          }
        }
      }
    } catch (e) {
      // try next client
    }
  }

  throw new Error('InnerTube player API returned no direct playable URLs');
}

/**
 * 2. Public Invidious and Piped mirrors.
 */
const PUBLIC_MIRRORS = [
  { type: 'invidious', url: 'https://inv.nadeko.net' },
  { type: 'invidious', url: 'https://invidious.nerdvpn.de' },
  { type: 'invidious', url: 'https://invidious.jing.rocks' },
  { type: 'invidious', url: 'https://invidious.privacydev.net' },
  { type: 'piped', url: 'https://pipedapi.kavin.rocks' },
  { type: 'piped', url: 'https://api.piped.privacydev.net' },
  { type: 'piped', url: 'https://pipedapi.drgns.space' },
];

async function resolveWithPublicMirrors(videoId) {
  for (const mirror of PUBLIC_MIRRORS) {
    try {
      if (mirror.type === 'invidious') {
        const res = await fetch(`${mirror.url}/api/v1/videos/${encodeURIComponent(videoId)}`, {
          signal: AbortSignal.timeout(5000),
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        });
        if (res.ok) {
          const data = await res.json();
          const formats = data.adaptiveFormats || [];
          const audio = formats
            .filter((f) => f.url && /audio/i.test(f.type || f.mimeType || ''))
            .sort((a, b) => (Number(b.bitrate) || 0) - (Number(a.bitrate) || 0))[0];
          if (audio?.url) return audio.url;
        }
      } else if (mirror.type === 'piped') {
        const res = await fetch(`${mirror.url}/streams/${encodeURIComponent(videoId)}`, {
          signal: AbortSignal.timeout(5000),
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        });
        if (res.ok) {
          const data = await res.json();
          const audioStreams = data.audioStreams || [];
          const audio = audioStreams
            .filter((s) => s.url)
            .sort((a, b) => (Number(b.bitrate) || 0) - (Number(a.bitrate) || 0))[0];
          if (audio?.url) return audio.url;
        }
      }
    } catch {
      // try next
    }
  }
  throw new Error('All public mirrors failed');
}

/**
 * 3. yt-dlp resolver with Android / iOS player clients.
 */
function resolveWithYtDlp(videoId) {
  return new Promise((resolve, reject) => {
    const ytDlpPath = getYtDlpPath();
    const args = [
      '--no-warnings',
      '--extractor-args',
      'youtube:player_client=android,ios,web_creator,mweb',
      '-f',
      'ba/b',
      '-g',
      `https://www.youtube.com/watch?v=${videoId}`,
    ];

    let stdout = '';
    let stderr = '';

    const proc = spawn(ytDlpPath, args);

    const timeout = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`Timeout resolving stream with yt-dlp for ${videoId}`));
    }, 12_000);

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    proc.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0 && stdout.trim()) {
        const lines = stdout.trim().split('\n');
        const resolvedUrl = lines[lines.length - 1].trim();
        if (resolvedUrl.startsWith('http')) {
          resolve(resolvedUrl);
          return;
        }
      }
      const msg = stderr.trim() || `yt-dlp exited with code ${code}`;
      reject(new Error(msg));
    });
  });
}

/**
 * 4. youtubei.js (Innertube)
 */
let innertubeInstance = null;
async function getInnertube() {
  if (!innertubeInstance) {
    try {
      const { Innertube, UniversalCache } = require('youtubei.js');
      innertubeInstance = await Innertube.create({
        cache: new UniversalCache(false),
        generate_session_locally: true,
      });
    } catch (e) {
      console.warn('[streamProxy] Could not initialize youtubei.js:', e.message);
    }
  }
  return innertubeInstance;
}

async function resolveWithInnertube(videoId) {
  const yt = await getInnertube();
  if (!yt) throw new Error('Innertube not initialized');

  const info = await yt.getInfo(videoId);
  const format =
    info.chooseFormat({ type: 'audio', quality: 'best' }) ||
    info.chooseFormat({ type: 'video+audio', quality: 'best' });
  if (!format) throw new Error('No audio format found in Innertube');

  let directUrl = format.decipher ? format.decipher(yt.session.player) : format.url;
  if (!directUrl && format.url) {
    directUrl = format.url;
  }
  if (directUrl && typeof directUrl === 'string' && directUrl.startsWith('http')) {
    return directUrl;
  }
  throw new Error('Could not obtain deciphered stream URL from Innertube');
}

/**
 * Top-level multi-engine resolver.
 */
async function resolveStreamUrl(videoId) {
  if (!videoId || typeof videoId !== 'string') {
    return Promise.reject(new Error('Invalid video ID'));
  }

  // Check cache
  const cached = streamCache.get(videoId);
  if (cached && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.url);
  }

  // Check in-flight
  if (inFlightResolves.has(videoId)) {
    return inFlightResolves.get(videoId);
  }

  const promise = (async () => {
    // 1. YouTube Direct Player API (Fastest & direct Android/iOS URLs)
    try {
      const url = await resolveWithInnerTubePlayerApi(videoId);
      streamCache.set(videoId, { url, expiresAt: Date.now() + 2 * 60 * 60 * 1000 });
      return url;
    } catch (err1) {
      console.warn(`[streamProxy] InnerTube Player API attempt failed for ${videoId}:`, err1.message);
    }

    // 2. yt-dlp with mobile extractor args
    try {
      const url = await resolveWithYtDlp(videoId);
      streamCache.set(videoId, { url, expiresAt: Date.now() + 2 * 60 * 60 * 1000 });
      return url;
    } catch (err2) {
      console.warn(`[streamProxy] yt-dlp attempt failed for ${videoId}:`, err2.message);
    }

    // 3. Innertube / youtubei.js
    try {
      const url = await resolveWithInnertube(videoId);
      streamCache.set(videoId, { url, expiresAt: Date.now() + 2 * 60 * 60 * 1000 });
      return url;
    } catch (err3) {
      console.warn(`[streamProxy] Innertube attempt failed for ${videoId}:`, err3.message);
    }

    // 4. Invidious / Piped public mirrors
    try {
      const url = await resolveWithPublicMirrors(videoId);
      streamCache.set(videoId, { url, expiresAt: Date.now() + 2 * 60 * 60 * 1000 });
      return url;
    } catch (err4) {
      console.warn(`[streamProxy] Public mirrors attempt failed for ${videoId}:`, err4.message);
    }

    throw new Error(`Failed to resolve stream for ${videoId} across all engines`);
  })().finally(() => {
    inFlightResolves.delete(videoId);
  });

  inFlightResolves.set(videoId, promise);
  return promise;
}

async function pipeYtDlpDirect(videoId, req, res) {
  const ytDlpPath = getYtDlpPath();
  const args = [
    '--no-warnings',
    '--extractor-args',
    'youtube:player_client=android,ios,web_creator,mweb',
    '-f',
    'ba/b',
    '-o',
    '-',
    `https://www.youtube.com/watch?v=${videoId}`,
  ];

  const proc = spawn(ytDlpPath, args);

  res.writeHead(200, {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'audio/webm',
    'Cache-Control': 'no-cache',
  });

  proc.stdout.pipe(res);

  req.on('close', () => {
    try {
      proc.kill('SIGKILL');
    } catch {}
  });

  return new Promise((resolve) => {
    proc.on('close', () => resolve(true));
    proc.on('error', () => resolve(false));
  });
}

async function handleStreamRequest(req, res, pathname, parsedUrl) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type, Accept, Authorization',
      'Access-Control-Max-Age': '86400',
    });
    res.end();
    return true;
  }

  const id = parsedUrl.searchParams.get('id');
  if (!id) {
    res.writeHead(400, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify({ error: 'Missing ?id parameter' }));
    return true;
  }

  if (pathname === '/api/stream/resolve') {
    try {
      const streamUrl = await resolveStreamUrl(id);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(
        JSON.stringify({
          url: `/api/stream/audio?id=${encodeURIComponent(id)}`,
          streamUrl,
          mimeType: 'audio/webm',
          expiresAt: Date.now() + 2 * 60 * 60 * 1000,
          resolvedBy: 'backend-stream-proxy',
        })
      );
    } catch (err) {
      console.error('[streamProxy] /api/stream/resolve error:', err.message);
      res.writeHead(502, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify({ error: 'Failed to resolve stream', message: err.message }));
    }
    return true;
  }

  if (pathname === '/api/stream/audio') {
    try {
      let streamUrl = null;
      try {
        streamUrl = await resolveStreamUrl(id);
      } catch (err) {
        console.warn(`[streamProxy] URL resolve failed for ${id}, trying direct pipe:`, err.message);
      }

      if (streamUrl) {
        const upstreamHeaders = {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        };

        if (req.headers.range) {
          upstreamHeaders['Range'] = req.headers.range;
        }

        const controller = new AbortController();
        req.on('close', () => {
          controller.abort();
        });

        const upstreamRes = await fetch(streamUrl, {
          headers: upstreamHeaders,
          signal: controller.signal,
        });

        if (upstreamRes.ok || upstreamRes.status === 206) {
          const responseHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Range, Content-Type, Accept',
            'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
            'Accept-Ranges': 'bytes',
            'Content-Type': upstreamRes.headers.get('content-type') || 'audio/webm',
            'Cache-Control': 'private, max-age=7200',
          };

          if (upstreamRes.headers.has('content-range')) {
            responseHeaders['Content-Range'] = upstreamRes.headers.get('content-range');
          }
          if (upstreamRes.headers.has('content-length')) {
            responseHeaders['Content-Length'] = upstreamRes.headers.get('content-length');
          }

          res.writeHead(upstreamRes.status, responseHeaders);

          if (req.method === 'HEAD') {
            res.end();
            return true;
          }

          if (upstreamRes.body) {
            const stream = Readable.fromWeb(upstreamRes.body);
            stream.pipe(res);
            stream.on('error', () => {
              if (!res.headersSent) {
                res.writeHead(500);
                res.end();
              }
            });
            return true;
          }
        } else {
          console.warn(`[streamProxy] Upstream returned status ${upstreamRes.status} for ${streamUrl}`);
          streamCache.delete(id);
        }
      }

      // Fallback: pipe directly from yt-dlp or Innertube
      if (!res.headersSent) {
        try {
          const yt = await getInnertube();
          if (yt) {
            const downloadStream = await yt.download(id, { type: 'audio', quality: 'best' });
            if (downloadStream) {
              res.writeHead(200, {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'audio/webm',
              });
              const nodeStream = Readable.fromWeb(downloadStream);
              nodeStream.pipe(res);
              return true;
            }
          }
        } catch (innerErr) {
          console.warn('[streamProxy] Innertube download stream failed:', innerErr.message);
        }

        await pipeYtDlpDirect(id, req, res);
      }
    } catch (err) {
      if (err.name === 'AbortError') return true;
      console.error('[streamProxy] /api/stream/audio error:', err.message);
      if (!res.headersSent) {
        res.writeHead(502, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(JSON.stringify({ error: 'Failed to stream audio', message: err.message }));
      }
    }
    return true;
  }

  return false;
}

module.exports = {
  resolveStreamUrl,
  handleStreamRequest,
};
