import { AppState } from 'react-native';

/**
 * Sleep timer for the player's action sheet.
 *
 * Uses a wall-clock deadline rather than a bare setTimeout so a device deep
 * sleep or background throttling can silently drop the pause: on each app
 * resume the deadline is re-checked and the pause fires immediately if it has
 * already passed.
 */
class SleepTimerServiceImpl {
  /** Epoch ms when the timer fires, or null when idle. */
  private deadline: number | null = null;
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<() => void>();
  private fireCallback: (() => void) | null = null;

  /**
   * @param fire Called when the timer elapses. Audia passes its own
   *             togglePlayPause so the pause goes through the app's normal
   *             pause path.
   */
  start(minutes: number, fire: () => void): void {
    this.cancel();
    this.fireCallback = fire;
    this.deadline = Date.now() + minutes * 60 * 1000;
    this.schedule();

    AppState.addEventListener('change', this.onAppStateChange);
  }

  cancel(): void {
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = null;
    this.deadline = null;
    this.fireCallback = null;
    this.emit();
  }

  get remainingMs(): number | null {
    return this.deadline === null ? null : Math.max(0, this.deadline - Date.now());
  }

  get isRunning(): boolean {
    return this.deadline !== null;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private onAppStateChange = (state: string) => {
    if (state !== 'active') return;
    if (this.deadline === null) return;

    const remaining = this.deadline - Date.now();
    if (remaining <= 0) {
      // Timer elapsed while backgrounded: fire now.
      this.fire();
    } else {
      this.schedule();
    }
  };

  private schedule(): void {
    if (this.timeout) clearTimeout(this.timeout);
    if (this.deadline === null) return;

    const remaining = this.deadline - Date.now();
    if (remaining <= 0) {
      this.fire();
      return;
    }

    this.timeout = setTimeout(() => this.fire(), remaining);
  }

  private fire(): void {
    const cb = this.fireCallback;
    this.cancel();
    cb?.();
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }
}

export const SleepTimer = new SleepTimerServiceImpl();
