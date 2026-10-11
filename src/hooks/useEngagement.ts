import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BADGES,
  Badge,
  badgeTierMeta,
  engagement,
  levelForXp,
  levelTitle,
} from '../engagement/Streaks';

/**
 * useEngagement — the UI read-model for streaks, XP, level and badges.
 * Re-renders whenever the engagement state is written (listens, likes,
 * badge unlocks).
 */
export function useEngagement() {
  const [version, setVersion] = useState(0);
  // Skip no-op renders: the 5s poll only bumps when the visible numbers move.
  const lastSig = useRef<string>('');

  useEffect(() => {
    // Nudge once after mount so the first read sees loaded state.
    void engagement.load().then(() => setVersion((v) => v + 1));

    const unsub = LibrarySubscribeBridge(() => {
      const s = engagement.getState();
      const sig = `${s.xp}|${s.streak}|${s.badges.length}|${Math.round(s.totalSeconds / 10)}`;
      if (sig === lastSig.current) return; // nothing visible changed
      lastSig.current = sig;
      setVersion((v) => v + 1);
    });
    return unsub;
  }, []);

  const state = engagement.getState();
  const level = levelForXp(state.xp);
  const week = engagement.weekSeconds();
  const unlocks = engagement.drainUnlocks();

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  return {
    version,
    state,
    level: level.level,
    levelProgress: level.progress,
    levelInto: level.into,
    levelSpan: level.span,
    levelName: levelTitle(level.level),
    streak: state.streak,
    streakActive: engagement.isStreakActive(),
    minutesToday: engagement.minutesToday(),
    totalHours: Math.round(state.totalSeconds / 3600),
    week,
    badges: state.badges,
    badgeDefinitions: BADGES,
    earnedBadges: BADGES.filter((b) => state.badges.includes(b.id)),
    nextBadges: BADGES.filter((b) => !state.badges.includes(b.id)).slice(0, 3),
    unlocks,
    refresh,
  };
}

/** Tiny bridge: engagement persists debounced, so poll lightly. */
function LibrarySubscribeBridge(onChange: () => void): () => void {
  const timer = setInterval(onChange, 5000);
  return () => clearInterval(timer);
}

export type { Badge };
export { badgeTierMeta };
