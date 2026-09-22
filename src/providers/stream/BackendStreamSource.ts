import { Platform } from 'react-native';
import { appError, toAppError } from '../../core/errors';
import { ResolvedStream, Track } from '../../core/types';
import { StreamSource } from './StreamResolver';

/**
 * Resolves and streams audio via the application's backend server proxy.
 *
 * This provides reliable, zero-configuration playback on Web and devices
 * connected to the server. YouTube stream URLs are resolved server-side
 * and proxied with HTTP Range support for instant seeking and scrubbing.
 */
export class BackendStreamSource implements StreamSource {
  readonly id = 'backend-proxy';

  canHandle(track: Track): boolean {
    return track.provider === 'youtube' && !!track.sourceId;
  }

  async resolve(track: Track, signal?: AbortSignal): Promise<ResolvedStream> {
    if (signal?.aborted) throw appError('timeout');

    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : '';

    const id = encodeURIComponent(track.sourceId);
    const audioUrl = `${origin}/api/stream/audio?id=${id}`;
    const resolveUrl = `${origin}/api/stream/resolve?id=${id}`;

    // On Web, audio playback is directly handled by WebYouTubePlayer in PlaybackEngine
    if (Platform.OS === 'web') {
      return {
        url: audioUrl,
        mimeType: 'audio/webm',
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        resolvedBy: this.id,
      };
    }

    try {
      const res = await fetch(resolveUrl, { signal });
      if (res.ok) {
        const data = await res.json();
        return {
          url: data.url ? (data.url.startsWith('http') ? data.url : `${origin}${data.url}`) : audioUrl,
          mimeType: data.mimeType || 'audio/webm',
          expiresAt: data.expiresAt || Date.now() + 2 * 60 * 60 * 1000,
          resolvedBy: this.id,
        };
      }
      return {
        url: audioUrl,
        mimeType: 'audio/webm',
        expiresAt: Date.now() + 2 * 60 * 60 * 1000,
        resolvedBy: this.id,
      };
    } catch (e) {
      if (signal?.aborted) throw appError('timeout');
      return {
        url: audioUrl,
        mimeType: 'audio/webm',
        expiresAt: Date.now() + 2 * 60 * 60 * 1000,
        resolvedBy: this.id,
      };
    }
  }
}
