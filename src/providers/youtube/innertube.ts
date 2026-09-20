import { fetchJson } from '../../core/http';
import { AppError, toAppError } from '../../core/errors';

/**
 * Minimal InnerTube client for YouTube Music.
 *
 * This is the same public, unauthenticated web endpoint the music.youtube.com
 * page itself calls. No API key, no account, no OAuth, no backend of our own.
 */

const BASE = 'https://music.youtube.com/youtubei/v1';

const CLIENT = {
  clientName: 'WEB_REMIX',
  // Pin to a recent WEB_REMIX version; a stale version triggers 400s.
  clientVersion: '1.20250616.01.00',
  hl: 'en',
  gl: 'US',
  experimentsToken: '',
};

const HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'X-Goog-Visitor-Id': '',
  'X-YouTube-Client-Name': '67',
  'X-YouTube-Client-Version': CLIENT.clientVersion,
  Origin: 'https://music.youtube.com',
  Referer: 'https://music.youtube.com/',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};

/** Search filter params, as used by the music.youtube.com front end. */
export const SEARCH_PARAMS = {
  songs: 'EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D',
  videos: 'EgWKAQIQAWoKEAkQChAFEAMQBA%3D%3D',
  albums: 'EgWKAQIYAWoKEAkQChAFEAMQBA%3D%3D',
  artists: 'EgWKAQIgAWoKEAkQChAFEAMQBA%3D%3D',
  playlists: 'EgWKAQIoAWoKEAkQChAFEAMQBA%3D%3D',
} as const;

type Body = Record<string, unknown>;

// Fallback 2: the plain WEB host tolerates older headers differently; try it before giving up.
const FALLBACK_HOSTS = [
  { base: BASE, headers: HEADERS },
  {
    base: 'https://www.youtube.com/youtubei/v1',
    headers: {
      ...HEADERS,
      Origin: 'https://www.youtube.com',
      Referer: 'https://www.youtube.com/',
    } satisfies Record<string, string>,
  },
];

async function call<T>(
  endpoint: string,
  body: Body,
  signal?: AbortSignal,
  kindOnFail: 'search_failed' | 'invalid_playlist' | 'track_unavailable' = 'search_failed'
): Promise<T> {
  let lastError: unknown;
  for (let h = 0; h < FALLBACK_HOSTS.length; h++) {
    const host = FALLBACK_HOSTS[h];
    try {
      return await fetchJson<T>(`${host.base}/${endpoint}?prettyPrint=false`, {
        method: 'POST',
        headers: host.headers,
        body: { context: { client: CLIENT }, ...body },
        timeoutMs: 12_000,
        retries: h === 0 ? 1 : 0,
        signal,
      });
    } catch (e) {
      lastError = e;
      // Network blocks/timeouts on the primary should still try the fallback host once.
      const err = toAppError(e as Error, kindOnFail);
      const retryHost = err.kind === 'network' || err.kind === 'timeout';
      if (!retryHost || h === FALLBACK_HOSTS.length - 1) break;
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
    return fetchJson<any>(
      `${BASE}/search?prettyPrint=false&continuation=${encodeURIComponent(continuation)}`,
      {
        method: 'POST',
        headers: HEADERS,
        body: { context: { client: CLIENT } },
        timeoutMs: 12_000,
        retries: 1,
        signal,
      }
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
