import { appError } from '../core/errors';
import { Track } from '../core/types';
import { IDLE_STATUS, PlaybackStatus } from './PlaybackEngine';

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export class WebYouTubePlayer {
  private player: any = null;
  private isApiLoaded = false;
  private isPlayerReady = false;
  private containerId = 'audia-yt-player-container';
  private frameId = 'audia-yt-frame';

  private currentTrack: Track | null = null;
  private desiredVolume = 1;
  private statusInterval: any = null;
  private isDestroyed = false;

  private onStatusCallback: ((status: PlaybackStatus) => void) | null = null;
  private onCompleteCallback: (() => void) | null = null;
  private onErrorCallback: ((error: unknown) => void) | null = null;

  private currentStatus: PlaybackStatus = { ...IDLE_STATUS };
  private completionFired = false;

  constructor(callbacks: {
    onStatus: (status: PlaybackStatus) => void;
    onComplete: () => void;
    onError: (error: unknown) => void;
  }) {
    this.onStatusCallback = callbacks.onStatus;
    this.onCompleteCallback = callbacks.onComplete;
    this.onErrorCallback = callbacks.onError;
  }

  private async ensureApiLoaded(): Promise<void> {
    if (typeof window === 'undefined') return;
    if (this.isApiLoaded && window.YT?.Player) return;

    if (window.YT?.Player) {
      this.isApiLoaded = true;
      return;
    }

    return new Promise<void>((resolve) => {
      const existing = document.getElementById('youtube-iframe-api-script');
      if (!existing) {
        const tag = document.createElement('script');
        tag.id = 'youtube-iframe-api-script';
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScript = document.getElementsByTagName('script')[0];
        if (firstScript && firstScript.parentNode) {
          firstScript.parentNode.insertBefore(tag, firstScript);
        } else {
          document.head.appendChild(tag);
        }
      }

      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevCallback) prevCallback();
        this.isApiLoaded = true;
        resolve();
      };

      const checkInterval = setInterval(() => {
        if (window.YT?.Player) {
          clearInterval(checkInterval);
          this.isApiLoaded = true;
          resolve();
        }
      }, 100);
    });
  }

  private ensureContainer(): HTMLElement | null {
    if (typeof document === 'undefined') return null;
    let container = document.getElementById(this.containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = this.containerId;
      container.style.position = 'fixed';
      container.style.bottom = '0';
      container.style.right = '0';
      container.style.width = '200px';
      container.style.height = '200px';
      container.style.opacity = '0.001';
      container.style.pointerEvents = 'none';
      container.style.zIndex = '-99999';
      document.body.appendChild(container);
    }

    let frame = document.getElementById(this.frameId);
    if (!frame) {
      frame = document.createElement('div');
      frame.id = this.frameId;
      container.appendChild(frame);
    }

    return container;
  }

  async load(
    track: Track,
    options: { autoPlay?: boolean; startPosition?: number } = {}
  ): Promise<void> {
    const { autoPlay = true, startPosition = 0 } = options;
    this.currentTrack = track;
    this.completionFired = false;

    this.currentStatus = {
      ...IDLE_STATUS,
      isBuffering: true,
      volume: this.desiredVolume,
    };
    this.onStatusCallback?.(this.currentStatus);

    await this.ensureApiLoaded();
    this.ensureContainer();

    const videoId = track.sourceId;

    if (!this.player) {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(appError('playback_failed', 'YouTube Player initialization timed out'));
        }, 12_000);

        try {
          this.player = new window.YT.Player(this.frameId, {
            height: '200',
            width: '200',
            videoId,
            playerVars: {
              autoplay: autoPlay ? 1 : 0,
              controls: 0,
              disablekb: 1,
              enablejsapi: 1,
              fs: 0,
              modestbranding: 1,
              playsinline: 1,
              rel: 0,
              start: Math.floor(startPosition),
              origin: typeof window !== 'undefined' ? window.location.origin : '',
            },
            events: {
              onReady: (event: any) => {
                clearTimeout(timeout);
                this.isPlayerReady = true;
                try {
                  event.target.setVolume(Math.round(this.desiredVolume * 100));
                  if (startPosition > 0) {
                    event.target.seekTo(startPosition, true);
                  }
                  if (autoPlay) {
                    event.target.playVideo();
                  }
                } catch {}
                this.startPolling();
                resolve();
              },
              onStateChange: (event: any) => {
                this.handleStateChange(event.data);
              },
              onError: (event: any) => {
                clearTimeout(timeout);
                console.warn('[WebYouTubePlayer] error event:', event.data);
                this.onErrorCallback?.(
                  appError('playback_failed', `YouTube playback error code: ${event.data}`)
                );
              },
            },
          });
        } catch (e) {
          clearTimeout(timeout);
          reject(e);
        }
      });
    } else {
      try {
        if (autoPlay) {
          this.player.loadVideoById({
            videoId,
            startSeconds: Math.floor(startPosition),
          });
        } else {
          this.player.cueVideoById({
            videoId,
            startSeconds: Math.floor(startPosition),
          });
        }
        this.player.setVolume(Math.round(this.desiredVolume * 100));
        this.startPolling();
      } catch (e) {
        console.warn('[WebYouTubePlayer] loadVideoById error:', e);
      }
    }
  }

  private handleStateChange(state: number): void {
    // YT.PlayerState:
    // -1 = UNSTARTED, 0 = ENDED, 1 = PLAYING, 2 = PAUSED, 3 = BUFFERING, 5 = CUED
    if (state === 0 && !this.completionFired) {
      this.completionFired = true;
      this.currentStatus = {
        ...this.currentStatus,
        isPlaying: false,
        isBuffering: false,
        position: this.currentStatus.duration,
      };
      this.onStatusCallback?.(this.currentStatus);
      this.onCompleteCallback?.();
    } else if (state === 1) {
      this.updateStatus();
    } else if (state === 2) {
      this.updateStatus();
    } else if (state === 3) {
      this.currentStatus = { ...this.currentStatus, isBuffering: true };
      this.onStatusCallback?.(this.currentStatus);
    }
  }

  private startPolling(): void {
    if (this.statusInterval) clearInterval(this.statusInterval);
    this.statusInterval = setInterval(() => {
      this.updateStatus();
    }, 250);
  }

  private updateStatus(): void {
    if (!this.player || !this.isPlayerReady) return;

    try {
      const state = this.player.getPlayerState?.();
      const currentTime = this.player.getCurrentTime?.() || 0;
      const duration = this.player.getDuration?.() || 0;
      const vol = (this.player.getVolume?.() || 100) / 100;

      const isPlaying = state === 1;
      const isBuffering = state === 3;
      const isLoaded = state !== -1 && state !== 5 && duration > 0;

      this.currentStatus = {
        isPlaying,
        isBuffering,
        isLoaded,
        position: Math.max(0, currentTime),
        duration: Math.max(0, duration),
        volume: Number.isFinite(vol) ? vol : this.desiredVolume,
      };

      this.onStatusCallback?.(this.currentStatus);
    } catch {
      // player might be transitioning
    }
  }

  play(): void {
    try {
      this.player?.playVideo?.();
    } catch (e) {
      console.warn('[WebYouTubePlayer] play error:', e);
    }
  }

  pause(): void {
    try {
      this.player?.pauseVideo?.();
    } catch (e) {
      console.warn('[WebYouTubePlayer] pause error:', e);
    }
  }

  seekTo(seconds: number): void {
    try {
      this.completionFired = false;
      this.player?.seekTo?.(seconds, true);
      this.currentStatus = { ...this.currentStatus, position: seconds };
      this.onStatusCallback?.(this.currentStatus);
    } catch (e) {
      console.warn('[WebYouTubePlayer] seekTo error:', e);
    }
  }

  setVolume(volume: number): void {
    this.desiredVolume = Math.max(0, Math.min(1, volume));
    try {
      this.player?.setVolume?.(Math.round(this.desiredVolume * 100));
    } catch {}
    this.currentStatus = { ...this.currentStatus, volume: this.desiredVolume };
    this.onStatusCallback?.(this.currentStatus);
  }

  getVolume(): number {
    return this.desiredVolume;
  }

  getStatus(): PlaybackStatus {
    return this.currentStatus;
  }

  stop(): void {
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
      this.statusInterval = null;
    }
    this.currentTrack = null;
    this.completionFired = false;
    try {
      this.player?.stopVideo?.();
    } catch {}
    this.currentStatus = { ...IDLE_STATUS, volume: this.desiredVolume };
    this.onStatusCallback?.(this.currentStatus);
  }

  release(): void {
    this.isDestroyed = true;
    this.stop();
    try {
      this.player?.destroy?.();
    } catch {}
    this.player = null;
    this.isPlayerReady = false;

    if (typeof document !== 'undefined') {
      const container = document.getElementById(this.containerId);
      container?.remove();
    }
  }
}
