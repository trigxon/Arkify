import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useLibrary } from './useLibrary';
import {
  GlassIntensity,
  MotionPref,
  isSystemMotionReduced,
  subscribeSystemMotion,
  tunedGlass,
  TunedGlass,
} from '../constants/appearance';

export { GlassIntensity, MotionPref } from '../constants/appearance';

type AppearanceContextType = {
  /** Raw preference as stored ('system' honours the OS). */
  motionPref: MotionPref;
  /** Effective verdict: true when animations should be suppressed. */
  motionReduced: boolean;
  glassIntensity: GlassIntensity;
  /** GLASS tokens rescaled for the current intensity (identity at standard). */
  glass: TunedGlass;
  setMotionPref: (pref: MotionPref) => void;
  setGlassIntensity: (intensity: GlassIntensity) => void;
};

const AppearanceContext = createContext<AppearanceContextType | undefined>(undefined);

/**
 * Display preferences as live React state, backed by the library settings so
 * persistence is owned by exactly one service.
 *
 * The context value only changes when a display preference actually changes —
 * library churn (likes, plays, playlists) re-renders this provider but every
 * consumer bails out because the memoised value is identical.
 */
export const AppearanceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { settings, updateSettings } = useLibrary();

  const motionPref = settings.reduceMotion ?? 'system';
  const glassIntensity = settings.glassIntensity ?? 'standard';

  // 'system' follows the OS. The web verdict is read synchronously at module
  // load; native arrives via AccessibilityInfo, so both paths can update after
  // mount without the first paint blocking on it.
  const [systemReduced, setSystemReduced] = useState(isSystemMotionReduced());

  useEffect(() => {
    const offMedia = subscribeSystemMotion(() => setSystemReduced(isSystemMotionReduced()));

    let active = true;
    let nativeSub: { remove: () => void } | null = null;
    if (AccessibilityInfo?.isReduceMotionEnabled) {
      AccessibilityInfo.isReduceMotionEnabled()
        .then((v) => {
          if (active) setSystemReduced(Boolean(v));
        })
        .catch(() => undefined);
      try {
        const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) =>
          setSystemReduced(Boolean(v))
        );
        nativeSub = sub as unknown as { remove: () => void };
      } catch {
        /* older RN — the initial read still applies */
      }
    }

    return () => {
      active = false;
      offMedia();
      nativeSub?.remove();
    };
  }, []);

  const motionReduced = motionPref === 'on' || (motionPref === 'system' && systemReduced);

  const value = useMemo<AppearanceContextType>(
    () => ({
      motionPref,
      motionReduced,
      glassIntensity,
      glass: tunedGlass(glassIntensity),
      setMotionPref: (pref) => updateSettings({ reduceMotion: pref }),
      setGlassIntensity: (intensity) => updateSettings({ glassIntensity: intensity }),
    }),
    [motionPref, motionReduced, glassIntensity, updateSettings]
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
};

/** Display preferences + tuned glass materials. Must sit inside LibraryProvider. */
export const useAppearance = (): AppearanceContextType => {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error('useAppearance must be used within an AppearanceProvider');
  return ctx;
};
