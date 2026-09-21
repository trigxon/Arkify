import { fetchJson } from '../../core/http';
import { AppError, toAppError } from '../../core/errors';

/**
 * Minimal InnerTube client for YouTube Music.
 *
 * This is the same public, unauthenticated web endpoint the music.youtube.com
 * page itself calls. No account, no OAuth, no backend of our own.
 */

const BASE = 'https://music.youtube.com/youtubei/v1';

/** Static browser-ish headers; the client-identity ones are added per call. */
const BASE_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};

const CLIENT_BASE = {
  clientName: 'WEB_REMIX',
  hl: 'en',
  gl: 'US',
  experimentsToken: '',
};

/**
 * Client identity.
 *
 * YouTube rejects InnerTube requests whose clientVersion has fallen too far
 * behind, which the UI shows as a vague "network problem". The homepage
 * publishes the current version, API key and visitor token, so they are
 * scraped once an hour and used for every call. The values below are only the
 * offline fallback (also verified working server-side).
 */
const CLIENT_FALLBACK: ClientConfig = {
  clientVersion: '1.20260915.14.00',
  apiKey: 'AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30',
  visitorData: '',
};

type ClientConfig = { clientVersion: string; apiKey: string; visitorData: string };

let clientConfig: ClientConfig = { ...CLIENT_FALLBACK };
let clientConfigAt = 0;
let clientConfigInflight: Promise<void> | null = null;
const CLIENT_CONFIG_TTL = 60 * 60 * 1000;

function scrape(html: string, key: string): string {
  const match = new RegExp(`"${key}":"([^"]+)"`).exec(html);
  return match ? match[1] : '';
}

async function refreshClientConfig(): Promise<void> {
  if (Date.now() - clientConfigAt < CLIENT_CONFIG_TTL) return;
  if (clientConfigInflight) return clientConfigInflight;

  clientConfigInflight = (async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8_000);
      const res = await fetch('https://music.youtube.com/', {
        headers: {
          'User-Agent': BASE_HEADERS['User-Agent'],
          'Accept-Language': BASE_HEADERS['Accept-Language'],
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
        if (__DEV__) console.log('[innertube] client config refreshed', clientConfig.clientVersion);
      }
    } catch {
      // Keep the previous values; discovery still works without a refresh.
    } finally {
      clientConfigInflight = null;
    }
  })();

  return clientConfigInflight;
}

/** Full request pieces for one InnerTube endpoint, using the current config. */
function innertubeRequest(endpoint: string, body: Record<string, unknown>) {
  const cfg = clientConfig;
  const client: Record<string, unknown> = { ...CLIENT_BASE, clientVersion: cfg.clientVersion };
  if (cfg.visitorData) client.visitorData = cfg.visitorData;

  return {
    url: `${BASE}/${endpoint}?key=${encodeURIComponent(cfg.apiKey)}&prettyPrint=false`,
    headers: {
      ...BASE_HEADERS,
      'X-YouTube-Client-Name': '67',
      'X-YouTube-Client-Version': cfg.clientVersion,
      'X-Goog-Visitor-Id': cfg.visitorData,
      Origin: 'https://music.youtube.com',
      Referer: 'https://music.youtube.com/',
    },
    body: { context: { client }, ...body },
  };
}

/** Fallback 2: the plain WEB host tolerates blocks on the music host differently. */
function fallbackRequest(endpoint: string, body: Record<string, unknown>) {
  const primary = innertubeRequest(endpoint, body);
  return {
    ...primary,
    url: `https://www.youtube.com/youtubei/v1/${endpoint}?key=${encodeURIComponent(
      clientConfig.apiKey
    )}&prettyPrint=false`,
    headers: {
      ...primary.headers,
      Origin: 'https://www.youtube.com',
      Referer: 'https://www.youtube.com/',
    },
  };
}

type Body = Record<string, unknown>;

async function call<T>(
  endpoint: string,
  body: Body,
  signal?: AbortSignal,
  kindOnFail: 'search_failed' | 'invalid_playlist' | 'track_unavailable' = 'search_failed'
): Promise<T> {
  await refreshClientConfig();

  const hosts = [innertubeRequest(endpoint, body), fallbackRequest(endpoint, body)];
  let lastError: unknown;

  for (let h = 0; h < hosts.length; h++) {
    const host = hosts[h];
    try {
      return await fetchJson<T>(host.url, {
        method: 'POST',
        headers: host.headers,
        body: host.body,
        timeoutMs: 12_000,
        retries: h === 0 ? 1 : 0,
        signal,
      });
    } catch (e) {
      lastError = e;
      // Network blocks/timeouts on the primary should still try the fallback host once.
      const err = toAppError(e as Error, kindOnFail);
      const retryHost = err.kind === 'network' || err.kind === 'timeout';
      if (!retryHost || h === hosts.length - 1) break;
    }
  }

  // Aggregate the host attempts, then surface the precise kind the caller expects.
  {
    // @ts-ignore lastError narrowed by the loop guard above
    const __err = toAppError(lastError as Error, kindOnFail);
    const __k = (__err as unknown as { kind?: string })?.kind;
    if (__k === 'rate_limited' || __k === 'network' || __k === 'timeout') throw __err;
    throw new AppError(kindOnFail, __err.message ?? String(lastError), {
      detail: (__err as unknown as { detail?: string })?.detail,
      cause: lastError,
    });
  }
}

export const innertube = {
  search(query: string, params?: string, signal?: AbortSignal) {
    const body: Body = { query };
    if (params) body.params = params;
    return call<any>('search', body, signal, 'search_failed');
  },

  /** Continuation token from a previous search, for lazy "load more". */
  searchContinuation(continuation: string, signal?: AbortSignal) {
    return call<any>(
      'search',
      { continuation },
      signal,
      'search_failed'
    );
  },

  browse(browseId: string, signal?: AbortSignal) {
    return call<any>('browse', { browseId }, signal, 'invalid_playlist');
  },

  /** Related/radio queue for a video -- used to auto-extend the queue. */
  next(videoId: string, playlistId?: string, signal?: AbortSignal) {
    const body: Body = { videoId, isAudioOnly: true };
    if (playlistId) body.playlistId = playlistId;
    return call<any>('next', body, signal, 'track_unavailable');
  },

  suggestions(input: string, signal?: AbortSignal) {
    return call<any>('music/get_search_suggestions', { input }, signal, 'search_failed');
  },
};

/** Search filter params, as used by the music.youtube.com front end. */
export const SEARCH_PARAMS = {
  songs: 'EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D',
  videos: 'EgWKAQIQAWoKEAkQChAFEAMQBA%3D%3D',
  albums: 'EgWKAQIYAWoKEAkQChAFEAMQBA%3D%3D',
  artists: 'EgWKAQIgAWoKEAkQChAFEAMQBA%3D%3D',
  playlists: 'EgWKAQIoAWoKEAkQChAFEAMQBA%3D%3D',
} as const;
