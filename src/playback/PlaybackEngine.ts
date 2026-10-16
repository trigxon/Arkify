import { Platform } from 'react-native';
import {
  AudioPlayer,
  createAudioPlayer,
  setAudioModeAsync,
  setIsAudioActiveAsync,
} from 'expo-audio';
import { appError, toAppError } from '../core/errors';
import { ResolvedStream, Track } from '../core/types';
import { WebYouTubePlayer } from './WebYouTubePlayer';
import { AudioFX } from '../services/AudioFX';

export type PlaybackStatus = {
  isPlaying: boolean;
  isBuffering: boolean;
  isLoaded: boolean;
  /** Seconds. */
  position: number;
  /** Seconds; 0 until the source reports one. */
  duration: number;
  volume: number;
};

export const IDLE_STATUS: PlaybackStatus = {
  isPlaying: false,
  isBuffering: false,
  isLoaded: false,
  position: 0,
  duration: 0,
  volume: 1,
};

type EngineEvents = {
  onStatus: (status: PlaybackStatus) => void;
  /** The current track played through to its end. */
  onComplete: () => void;
  /** Playback failed for the loaded track. */
  onError: (error: unknown) => void;
};

/**
 * Wraps expo-audio (native) and WebYouTubePlayer (web) behind a small imperative interface.
 *
 * The engine is intentionally ignorant of queues, providers and the UI: it
 * plays one resolved stream at a time and reports what happened. Everything
 * about *which* track plays next lives in the controller above it.
 */
export class PlaybackEngine {
  private player: AudioPlayer | null = null;
  private webPlayer: WebYouTubePlayer | null = null;
  private isWebActive = false;
  private subscription: { remove: () => void } | null = null;
  private listeners: Partial<EngineEvents> = {};

  private status: PlaybackStatus = { ...IDLE_STATUS };
  private currentTrackId: string | null = null;
  private desiredVolume = 1;

  /** Guards against a stalled load leaving the UI spinning forever. */
  private loadTimer: ReturnType<typeof setTimeout> | null = null;
  /** Set while we are swapping sources, so stale status events are ignored. */
  private loadToken = 0;
  private completionFired = false;

  private configured = false;
  /** Whether the media session/notification is currently attached. */
  private lockScreenActive = false;
  /** Track the notification is currently showing. */
  private lockScreenTrack: Track | null = null;
  /** Whether metadata has been re-asserted since playback actually began. */
  private lockScreenSynced = false;

  /** Crossfade seconds (0 = off). Ramps volume at track edges. */
  private crossfadeSeconds = 0;
  /** Active fade direction: null | 'out' | 'in'. */
  private fade: { dir: 'out' | 'in'; timer: ReturnType<typeof setInterval>; startAt: number } | null = null;

  /** Web fallback state: if the IFrame player fails, retry once via HTML5 audio. */
  private webFallbackUsed = false;
  private lastWebTrack: Track | null = null;
  private lastWebStream: ResolvedStream | null = null;

  constructor() {
    if (Platform.OS === 'web') {
      this.webPlayer = new WebYouTubePlayer({
        onStatus: (s) => {
          if (this.isWebActive) {
            this.status = s;
            this.listeners.onStatus?.(s);
          }
        },
        onComplete: () => {
          if (this.isWebActive) {
            this.listeners.onComplete?.();
          }
        },
        onError: (err) => {
          if (this.isWebActive) {
            this.clearLoadTimer();
            // Reset the reported status first: a failed load must never leave
            // the UI (MiniPlayer / NowPlaying) advertising a playing state.
            this.isWebActive = false;
            this.status = { ...IDLE_STATUS, volume: this.desiredVolume };
            this.listeners.onStatus?.(this.status);
            // One-shot fallback: the IFrame player can be refused by YouTube
            // (embed restrictions, network-level blocks). If we hold a
            // resolved stream URL, retry the track through the HTML5 audio
            // element backed by the same-origin proxy before giving up.
            if (
              !this.webFallbackUsed &&
              this.lastWebTrack &&
              this.lastWebStream &&
              /^https?:\/\//.test(this.lastWebStream.url)
            ) {
              this.webFallbackUsed = true;
              void this.fallbackToAudio(this.lastWebTrack, this.lastWebStream).catch(() => {
                this.listeners.onError?.(err);
              });
              return;
            }
            this.listeners.onError?.(err);
          }
        },
      });
    }
  }

  on<K extends keyof EngineEvents>(event: K, handler: EngineEvents[K]): void {
    this.listeners[event] = handler;
  }

  getStatus(): PlaybackStatus {
    return this.status;
  }

  /**
   * Configure the global audio session: keep playing when the device is
   * silenced or the app is backgrounded.
   */
  async configure(): Promise<void> {
    if (this.configured) return;
    this.configured = true;

    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'doNotMix',
      });

      // release() deactivates the audio session, and setting the mode does not
      // bring it back. Re-activating explicitly is what lets the engine play
      // again after a teardown.
      await setIsAudioActiveAsync(true);
    } catch {
      // Audio mode is a best-effort optimisation, never a reason to fail.
    }
  }

  private ensurePlayer(): AudioPlayer {
    if (this.player) return this.player;

    // 250ms keeps the progress bar smooth without flooding React with updates.
    const player = createAudioPlayer(null, { updateInterval: 250 });
    player.volume = this.desiredVolume;

    this.subscription = player.addListener('playbackStatusUpdate', (s) => {
      if (!this.isWebActive) {
        this.handleStatus(s);
      }
    });

    this.player = player;
    return player;
  }

  private handleStatus(s: any): void {
    const duration = Number.isFinite(s?.duration) && s.duration > 0 ? s.duration : 0;
    const position = Number.isFinite(s?.currentTime) ? Math.max(0, s.currentTime) : 0;

    // A source that has started reporting time is no longer "loading".
    if (s?.isLoaded && this.loadTimer) {
      clearTimeout(this.loadTimer);
      this.loadTimer = null;
    }

    if (s?.error) {
      this.clearLoadTimer();
      this.listeners.onError?.(appError('playback_failed', String(s.error)));
      return;
    }

    this.status = {
      isPlaying: Boolean(s?.playing),
      isBuffering: Boolean(s?.isBuffering),
      isLoaded: Boolean(s?.isLoaded),
      position,
      duration,
      volume: Number.isFinite(s?.volume) ? s.volume : this.desiredVolume,
    };

    this.listeners.onStatus?.(this.status);

    // Once the source is genuinely playing, the service is bound and the
    // notification will accept metadata.
    if (s?.isLoaded && s?.playing) this.syncLockScreenOnce();

    this.tickCrossfade(position, duration);

    // `didJustFinish` can repeat across updates; fire completion only once.
    if (s?.didJustFinish && !this.completionFired) {
      this.completionFired = true;
      this.listeners.onComplete?.();
    }
  }

  private clearLoadTimer(): void {
    if (this.loadTimer) {
      clearTimeout(this.loadTimer);
      this.loadTimer = null;
    }
  }

  // ---- crossfade ---------------------------------------------------------

  /** Configure edge fades. Called from the audio settings surface. */
  setCrossfade(seconds: number): void {
    this.crossfadeSeconds = Math.max(0, Math.min(12, seconds));
  }

  /** Seconds of fade the engine applies at track edges right now. */
  get crossfade(): number {
    return this.crossfadeSeconds;
  }

  /**
   * Start a fade ramp. The ramp multiplies the user's chosen volume, so a
   * fade never permanently alters the listening level.
   */
  private startFade(dir: 'out' | 'in'): void {
    this.cancelFade();
    if (this.crossfadeSeconds <= 0) return;

    const totalMs = this.crossfadeSeconds * 1000;
    const started = Date.now();
    const step = 60; // ~16 fps ramp — inaudible granularity for a volume glide

    const timer = setInterval(() => {
      const t = Math.min(1, (Date.now() - started) / totalMs);
      const shaped = t * t * (3 - 2 * t); // smoothstep — no audible kinks
      const factor = dir === 'out' ? 1 - shaped : shaped;

      try {
        if (!this.isWebActive && this.player) {
          this.player.volume = this.desiredVolume * factor;
        } else if (this.webPlayer) {
          this.webPlayer.setVolume(this.desiredVolume * factor);
        }
      } catch {
        /* player went away mid-fade */
      }

      if (t >= 1) this.cancelFade();
    }, step);

    this.fade = { dir, timer, startAt: started };
  }

  private cancelFade(): void {
    if (!this.fade) return;
    clearInterval(this.fade.timer);
    this.fade = null;

    // Restore the exact user volume once a ramp finishes.
    try {
      if (!this.isWebActive && this.player) {
        this.player.volume = this.desiredVolume;
      } else if (this.webPlayer) {
        this.webPlayer.setVolume(this.desiredVolume);
      }
    } catch {
      /* best effort */
    }
  }

  /**
   * Watch the position stream and kick the fade-out when the track is about
   * to end. Runs on every status tick (~4Hz); starts at most once per track.
   */
  private tickCrossfade(position: number, duration: number): void {
    if (this.crossfadeSeconds <= 0 || this.fade || duration <= 0) return;
    const remaining = duration - position;
    if (remaining > this.crossfadeSeconds) return;
    if (remaining <= 0) return;

    this.startFade('out');
  }

  /** Load a resolved stream and begin playing it. */
  async load(
    track: Track,
    stream: ResolvedStream,
    options: { autoPlay?: boolean; startPosition?: number } = {}
  ): Promise<void> {
    const { autoPlay = true, startPosition = 0 } = options;
    const token = ++this.loadToken;

    // Remember the resolved stream so the web error fallback can retry via
    // the audio element if the IFrame player is refused.
    this.lastWebTrack = track;
    this.lastWebStream = stream;
    this.webFallbackUsed = false;

    try {
      this.currentTrackId = track.id;
      this.completionFired = false;

      // On Web with YouTube tracks, use the WebYouTubePlayer first; the
      // constructor's onError handles the HTML5-audio fallback if YouTube
      // refuses the embed.
      if (Platform.OS === 'web' && this.webPlayer && (track.provider === 'youtube' || track.sourceId)) {
        this.isWebActive = true;
        try {
          this.player?.pause();
        } catch {}

        try {
          this.webPlayer.setVolume(this.desiredVolume);
          await this.webPlayer.load(track, { autoPlay, startPosition });
          return;
        } catch (webErr) {
          // Synchronous IFrame failure (API refused to load, etc.) — fall
          // back to the audio element exactly once.
          if (
            !this.webFallbackUsed &&
            /^https?:\/\//.test(stream.url)
          ) {
            this.webFallbackUsed = true;
            await this.fallbackToAudio(track, stream, { autoPlay, startPosition });
            return;
          }
          throw webErr;
        }
      }

      await this.loadIntoAudioPlayer(track, stream, token, { autoPlay, startPosition });
    } catch (e) {
      this.clearLoadTimer();
      throw toAppError(e, 'playback_failed');
    }
  }

  /**
   * Web-only rescue path: replay the current track through the HTML5 audio
   * element (expo-audio web) using the already-resolved stream URL.
   */
  private async fallbackToAudio(
    track: Track,
    stream: ResolvedStream,
    options: { autoPlay?: boolean; startPosition?: number } = {}
  ): Promise<void> {
    const token = ++this.loadToken;
    try {
      try {
        this.webPlayer?.stop();
      } catch {}
      this.isWebActive = false;
      await this.loadIntoAudioPlayer(track, stream, token, options);
    } catch (e) {
      this.clearLoadTimer();
      throw toAppError(e, 'playback_failed');
    }
  }

  /** Load a resolved stream into the (HTML5) audio player and start it. */
  private async loadIntoAudioPlayer(
    track: Track,
    stream: ResolvedStream,
    token: number,
    options: { autoPlay?: boolean; startPosition?: number } = {}
  ): Promise<void> {
    const { autoPlay = true, startPosition = 0 } = options;

    this.isWebActive = false;
    try {
      this.webPlayer?.stop();
    } catch {}

    const player = this.ensurePlayer();
    await this.configure();

    this.status = { ...IDLE_STATUS, isBuffering: true, volume: this.desiredVolume };
    this.listeners.onStatus?.(this.status);

    // Headers matter: a googlevideo URL fetched with a different User-Agent
    // than the one that extracted it comes back 403.
    player.replace({ uri: stream.url, headers: stream.headers });
    player.volume = this.desiredVolume;

    // If the source never loads, surface a real error instead of hanging.
    this.clearLoadTimer();
    this.loadTimer = setTimeout(() => {
      if (token !== this.loadToken) return;
      if (this.status.isLoaded) return;
      this.status = { ...IDLE_STATUS, volume: this.desiredVolume };
      this.listeners.onStatus?.(this.status);
      this.listeners.onError?.(appError('playback_failed', 'Stream did not start'));
    }, 20_000);

    try {
      if (startPosition > 0) {
        try {
          await player.seekTo(startPosition);
        } catch {
          // Seeking before the source is ready is not fatal.
        }
      }

      if (autoPlay) player.play();

      // Fade-in at the start of the track when crossfade is on.
      if (this.crossfadeSeconds > 0 && autoPlay) {
        try {
          player.volume = 0;
        } catch {}
        this.startFade('in');
      }

      this.setLockScreenMetadata(track);
    } catch (e) {
      this.clearLoadTimer();
      throw toAppError(e, 'playback_failed');
    }
  }

  play(): void {
    try {
      if (this.isWebActive && this.webPlayer) {
        this.webPlayer.play();
      } else {
        this.player?.play();
      }
    } catch (e) {
      this.listeners.onError?.(toAppError(e, 'playback_failed'));
    }
  }

  pause(): void {
    try {
      if (this.isWebActive && this.webPlayer) {
        this.webPlayer.pause();
      } else {
        this.player?.pause();
      }
    } catch {
      /* pausing a released player is harmless */
    }
  }

  async seekTo(seconds: number): Promise<void> {
    if (!Number.isFinite(seconds)) return;

    if (this.isWebActive && this.webPlayer) {
      this.webPlayer.seekTo(seconds);
      return;
    }

    if (!this.player) return;

    const duration = this.status.duration;
    const target = Math.max(0, duration > 0 ? Math.min(seconds, duration) : seconds);

    try {
      this.completionFired = false;
      await this.player.seekTo(target);
      this.status = { ...this.status, position: target };
      this.listeners.onStatus?.(this.status);
    } catch (e) {
      this.listeners.onError?.(toAppError(e, 'playback_failed'));
    }
  }

  setVolume(volume: number): void {
    this.desiredVolume = Math.max(0, Math.min(1, volume));
    // A user volume change overrides any active fade.
    this.cancelFade();
    if (this.webPlayer) this.webPlayer.setVolume(this.desiredVolume);
    if (this.player) this.player.volume = this.desiredVolume;

    this.status = { ...this.status, volume: this.desiredVolume };
    this.listeners.onStatus?.(this.status);
  }

  getVolume(): number {
    return this.desiredVolume;
  }

  /** Stop and unload, returning the engine to idle. */
  stop(): void {
    this.clearLoadTimer();
    this.cancelFade();
    this.loadToken++;
    this.currentTrackId = null;
    this.completionFired = false;

    if (this.webPlayer) {
      this.webPlayer.stop();
    }

    try {
      this.player?.pause();
      this.player?.replace(null);
    } catch {
      /* already torn down */
    }

    this.clearLockScreen();

    this.status = { ...IDLE_STATUS, volume: this.desiredVolume };
    this.listeners.onStatus?.(this.status);
  }

  /**
   * Native lock-screen / notification controls.
   */
  private setLockScreenMetadata(track: Track): void {
    if (Platform.OS === 'web') return;

    this.lockScreenTrack = track;
    this.lockScreenSynced = false;

    const metadata = this.metadataFor(track);

    try {
      if (this.lockScreenActive) {
        this.player?.updateLockScreenMetadata(metadata);
        return;
      }

      this.player?.setActiveForLockScreen(true, metadata, {
        showSeekForward: true,
        showSeekBackward: true,
      });
      this.lockScreenActive = true;
    } catch {
      // Lock screen controls are optional
    }
  }

  private metadataFor(track: Track) {
    return {
      title: track.title,
      artist: track.artist.name,
      albumTitle: track.album,
      artworkUrl: track.albumImageUrl || undefined,
    };
  }

  private syncLockScreenOnce(): void {
    if (Platform.OS === 'web') return;
    if (this.lockScreenSynced || !this.lockScreenActive) return;

    const track = this.lockScreenTrack;
    if (!track) return;

    this.lockScreenSynced = true;
    try {
      this.player?.updateLockScreenMetadata(this.metadataFor(track));
    } catch {
      /* best effort */
    }
  }

  private clearLockScreen(): void {
    if (Platform.OS === 'web' || !this.lockScreenActive) return;

    try {
      this.player?.clearLockScreenControls();
    } catch {
      /* best effort */
    }
    this.lockScreenActive = false;
    this.lockScreenTrack = null;
    this.lockScreenSynced = false;
  }

  get trackId(): string | null {
    return this.currentTrackId;
  }

  async release(): Promise<void> {
    this.clearLoadTimer();
    this.clearLockScreen();

    this.configured = false;
    this.subscription?.remove();
    this.subscription = null;

    if (this.webPlayer) {
      this.webPlayer.release();
      this.webPlayer = null;
    }

    try {
      this.player?.remove();
    } catch {
      /* best effort */
    }
    this.player = null;

    try {
      await setIsAudioActiveAsync(false);
    } catch {
      /* best effort */
    }
  }
}

export const playbackEngine = new PlaybackEngine();

