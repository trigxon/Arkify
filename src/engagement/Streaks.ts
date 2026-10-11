import { Track } from '../core/types';
import { readJson, writeJsonDebounced } from '../core/storage';
import { LibraryService } from '../services/LibraryService';
import { tasteProfile } from '../ai/TasteProfile';

/**
 * Engagement engine — streaks, XP, levels and badges.
 *
 * Subscribes to the LibraryService change stream, so every real listen flows
 * through here exactly once. All state is local. The design goal is the same
 * as any good game loop: short feedback (XP), medium goals (streaks), long
 * identity (badges + level).
 */

const ENGAGEMENT_KEY = 'engagement-state';

/** XP awarded per full minute actually listened. */
const XP_PER_MINUTE = 6;
/** Bonus XP for keeping a streak alive. */
const XP_STREAK_BONUS = 40;
/** Bonus XP for a like (taste signal is valuable). */
const XP_LIKE = 15;

export type EngagementState = {
  /** Day of the last listen, as `YYYY-MM-DD` (local). */
  lastListenDay: string | null;
  /** Consecutive days with at least one real listen. */
  streak: number;
  /** Best streak ever. */
  bestStreak: number;
  /** Total listening time across all days, seconds. */
  totalSeconds: number;
  /** Per-day listening seconds, keyed `YYYY-MM-DD`, kept 30 days. */
  dailySeconds: Record<string, number>;
  /** Lifetime XP. */
  xp: number;
  /** Badge ids earned. */
  badges: string[];
  /** Tracks liked via the engagement-aware toggle (for XP dedup). */
  likedCounted: number;
  updatedAt: number;
};

export const EMPTY_ENGAGEMENT: EngagementState = {
  lastListenDay: null,
  streak: 0,
  bestStreak: 0,
  totalSeconds: 0,
  dailySeconds: {},
  xp: 0,
  badges: [],
  likedCounted: 0,
  updatedAt: 0,
};

// ---- levels ---------------------------------------------------------------

/**
 * Level curve: each level costs ~35% more XP than the last, so early levels
 * pop quickly (hook the user) and later ones feel earned.
 */
export function levelForXp(xp: number): { level: number; into: number; span: number; progress: number } {
  let level = 1;
  let span = 220;
  let remaining = xp;

  while (remaining >= span) {
    remaining -= span;
    level += 1;
    span = Math.round(span * 1.35);
  }

  return { level, into: remaining, span, progress: span > 0 ? remaining / span : 0 };
}

export function levelTitle(level: number): string {
  if (level >= 30) return 'Legend';
  if (level >= 20) return 'Gold';
  if (level >= 12) return 'Silver';
  if (level >= 7) return 'Bronze';
  if (level >= 4) return 'Rising';
  return 'Newcomer';
}

// ---- badges ---------------------------------------------------------------

export type BadgeContext = {
  state: EngagementState;
  /** Distinct artists in the taste model. */
  distinctArtists: number;
  /** Liked songs count. */
  likedCount: number;
  /** Playlists owned. */
  playlistCount: number;
  /** Downloads on disk. */
  downloadsCount: number;
  /** Latest listen (for time-of-day badges). Null when none yet. */
  lastListenAt: number | null;
};

export type Badge = {
  id: string;
  name: string;
  description: string;
  /** lucide icon name resolved in the UI (kept as a string so this file stays logic-only). */
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'diamond';
  check: (ctx: BadgeContext) => boolean;
};

export const BADGES: Badge[] = [
  { id: 'first-listen', name: 'First Light', description: 'Play your first song', icon: 'Play', tier: 'bronze', check: (c) => c.state.totalSeconds >= 60 },
  { id: 'streak-3', name: 'Warming Up', description: '3-day listening streak', icon: 'Flame', tier: 'bronze', check: (c) => c.state.bestStreak >= 3 },
  { id: 'streak-7', name: 'On Fire', description: '7-day listening streak', icon: 'Flame', tier: 'silver', check: (c) => c.state.bestStreak >= 7 },
  { id: 'streak-30', name: 'Unbreakable', description: '30-day listening streak', icon: 'Flame', tier: 'diamond', check: (c) => c.state.bestStreak >= 30 },
  { id: 'listener-60', name: 'Hour One', description: 'Listen for 60 minutes total', icon: 'Headphones', tier: 'bronze', check: (c) => c.state.totalSeconds >= 3600 },
  { id: 'listener-600', name: 'Ten Hour Club', description: 'Listen for 10 hours total', icon: 'Headphones', tier: 'silver', check: (c) => c.state.totalSeconds >= 36000 },
  { id: 'listener-3600', name: 'Marathoner', description: 'Listen for 100 hours total', icon: 'Trophy', tier: 'gold', check: (c) => c.state.totalSeconds >= 360000 },
  { id: 'day-120', name: 'In the Zone', description: '2 hours in a single day', icon: 'Timer', tier: 'silver', check: (c) => Object.values(c.state.dailySeconds).some((s) => s >= 7200) },
  { id: 'explorer-10', name: 'Explorer', description: 'Listen to 10 different artists', icon: 'Compass', tier: 'bronze', check: (c) => c.distinctArtists >= 10 },
  { id: 'explorer-25', name: 'Pathfinder', description: 'Listen to 25 different artists', icon: 'Compass', tier: 'silver', check: (c) => c.distinctArtists >= 25 },
  { id: 'explorer-50', name: 'Cartographer', description: 'Listen to 50 different artists', icon: 'Map', tier: 'gold', check: (c) => c.distinctArtists >= 50 },
  { id: 'collector-25', name: 'Collector', description: 'Like 25 songs', icon: 'Heart', tier: 'silver', check: (c) => c.likedCount >= 25 },
  { id: 'collector-100', name: 'The Vault', description: 'Like 100 songs', icon: 'Heart', tier: 'gold', check: (c) => c.likedCount >= 100 },
  { id: 'curator', name: 'Curator', description: 'Create 3 playlists', icon: 'ListMusic', tier: 'bronze', check: (c) => c.playlistCount >= 3 },
  { id: 'night-owl', name: 'Night Owl', description: 'Listen between midnight and 4am', icon: 'Moon', tier: 'bronze', check: (c) => {
      if (!c.lastListenAt) return false;
      const h = new Date(c.lastListenAt).getHours();
      return h >= 0 && h < 4;
    } },
  { id: 'early-bird', name: 'Early Bird', description: 'Listen before 6am', icon: 'Sunrise', tier: 'bronze', check: (c) => {
      if (!c.lastListenAt) return false;
      return new Date(c.lastListenAt).getHours() >= 4 && new Date(c.lastListenAt).getHours() < 6;
    } },
  { id: 'offline', name: 'Ready Anywhere', description: 'Keep 5 songs downloaded', icon: 'Download', tier: 'bronze', check: (c) => c.downloadsCount >= 5 },
  { id: 'level-5', name: 'Level 5', description: 'Reach level 5', icon: 'Sparkles', tier: 'silver', check: (c) => levelForXp(c.state.xp).level >= 5 },
  { id: 'level-10', name: 'Level 10', description: 'Reach level 10', icon: 'Sparkles', tier: 'gold', check: (c) => levelForXp(c.state.xp).level >= 10 },
  { id: 'ai-user', name: 'Sound Sommelier', description: 'Ask the AI for a mix', icon: 'Bot', tier: 'silver', check: (c) => c.state.badges.includes('ai-user') },
];

const TIER_META: Record<Badge['tier'], { label: string; color: string }> = {
  bronze: { label: 'Bronze', color: '#CD8F5A' },
  silver: { label: 'Silver', color: '#C0C9D6' },
  gold: { label: 'Gold', color: '#FFC24D' },
  diamond: { label: 'Diamond', color: '#57E8D6' },
};

export const badgeTierMeta = (tier: Badge['tier']) => TIER_META[tier];

// ---- engine ---------------------------------------------------------------

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

class EngagementEngine {
  private state: EngagementState = { ...EMPTY_ENGAGEMENT };
  private loaded = false;
  private subscribed = false;

  /** Badge ids newly earned by the most recent event — surfaced as toasts. */
  recentUnlocks: Badge[] = [];

  async load(): Promise<void> {
    if (this.loaded) return;
    this.state = await readJson<EngagementState>(ENGAGEMENT_KEY, EMPTY_ENGAGEMENT);
    if (!this.state.dailySeconds) this.state.dailySeconds = {};
    if (!this.state.badges) this.state.badges = [];
    this.loaded = true;
  }

  /**
   * Wire the engine to real listening. Called once at app start; playback
   * writes go through LibraryService.recordListen which fires the change
   * listeners this subscription reacts to.
   */
  attach(): void {
    if (this.subscribed) return;
    this.subscribed = true;

    void this.load().then(() => {
      LibraryService.subscribe(() => {
        const latest = LibraryService.getHistory()[0];
        if (!latest) return;
        this.onListen(latest.track, latest.playedAt);
      });
    });
  }

  /** Fold one real listen into the state. Idempotent per (day, playedAt). */
  onListen(track: Track, at: number): void {
    if (!this.loaded) {
      void this.load().then(() => this.onListen(track, at));
      return;
    }

    const when = new Date(at);
    const key = dayKey(when);
    const seconds = track.duration > 0 ? Math.min(track.duration, 60 * 12) : 210;

    // Streak bookkeeping.
    if (this.state.lastListenDay !== key) {
      const yesterday = dayKey(new Date(at - 86_400_000));
      this.state.streak =
        this.state.lastListenDay === yesterday ? this.state.streak + 1 : 1;
      this.state.bestStreak = Math.max(this.state.bestStreak, this.state.streak);
      this.state.lastListenDay = key;
      this.state.xp += XP_STREAK_BONUS;
    }

    // Minutes + XP.
    this.state.totalSeconds += seconds;
    this.state.dailySeconds[key] = (this.state.dailySeconds[key] ?? 0) + seconds;
    this.state.xp += Math.round((seconds / 60) * XP_PER_MINUTE);

    // Trim the daily map to 30 days.
    const keys = Object.keys(this.state.dailySeconds).sort();
    while (keys.length > 30) {
      const oldest = keys.shift();
      if (oldest) delete this.state.dailySeconds[oldest];
    }

    this.state.updatedAt = at;
    this.recomputeBadges({
      lastListenAt: at,
      likedCount: LibraryService.getLiked().length,
      playlistCount: LibraryService.getPlaylists().length,
    });
    this.persist();
  }

  /** Called by the library hook when the user likes a track. */
  onLike(): void {
    if (!this.loaded) return;
    this.state.likedCounted += 1;
    this.state.xp += XP_LIKE;
    this.recomputeBadges({
      likedCount: LibraryService.getLiked().length,
      playlistCount: LibraryService.getPlaylists().length,
    });
    this.persist();
  }

  /** AI mix used — one-off badge hook. */
  markAIUsed(): void {
    if (!this.loaded || this.state.badges.includes('ai-user')) return;
    this.state.badges.push('ai-user');
    this.state.xp += 30;
    this.recomputeBadges({});
    this.persist();
  }

  /** Re-evaluate every badge against the current context. */
  private recomputeBadges(extra: Partial<BadgeContext>): void {
    void tasteProfile.load().then(() => {
      const ctx: BadgeContext = {
        state: this.state,
        distinctArtists: tasteProfile.snapshot().distinctArtists,
        likedCount: extra.likedCount ?? LibraryService.getLiked().length,
        playlistCount: extra.playlistCount ?? LibraryService.getPlaylists().length,
        downloadsCount: extra.downloadsCount ?? 0,
        lastListenAt: extra.lastListenAt ?? (this.state.lastListenDay ? Date.now() : null),
      };

      for (const badge of BADGES) {
        if (this.state.badges.includes(badge.id)) continue;
        if (badge.check(ctx)) {
          this.state.badges.push(badge.id);
          this.recentUnlocks.push(badge);
          this.state.xp += 50;
        }
      }
      this.persist();
    });
  }

  // ---- reads -------------------------------------------------------------

  getState(): EngagementState {
    return { ...this.state };
  }

  /** Last 7 days of listening, oldest → newest, seconds. */
  weekSeconds(): { day: string; seconds: number }[] {
    const out: { day: string; seconds: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000);
      const key = dayKey(d);
      out.push({ day: key, seconds: this.state.dailySeconds[key] ?? 0 });
    }
    return out;
  }

  /** Minutes listened today. */
  minutesToday(): number {
    return Math.round((this.state.dailySeconds[dayKey(new Date())] ?? 0) / 60);
  }

  /** Streak safe-guard: a streak only "survives" until end of the next day. */
  isStreakActive(): boolean {
    if (!this.state.lastListenDay) return false;
    const today = dayKey(new Date());
    const yesterday = dayKey(new Date(Date.now() - 86_400_000));
    return this.state.lastListenDay === today || this.state.lastListenDay === yesterday;
  }

  /** Drain the unlock queue (the UI shows each as a toast). */
  drainUnlocks(): Badge[] {
    const out = this.recentUnlocks;
    this.recentUnlocks = [];
    return out;
  }

  async reset(): Promise<void> {
    this.state = { ...EMPTY_ENGAGEMENT };
    await writeJsonDebounced(ENGAGEMENT_KEY, this.state, 0);
  }

  private persist(): void {
    writeJsonDebounced(ENGAGEMENT_KEY, this.state, 1200);
  }
}

export const engagement = new EngagementEngine();
