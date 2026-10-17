import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { usePalette } from '../../hooks/usePalette';
import { useAppearance } from '../../hooks/useAppearance';

/**
 * AmbientGlow — artwork-reactive ambient colour field (gradient depth §3.4,
 * artwork-reactive colour §3.5).
 *
 * Two soft multi-stop washes — the palette's secondary hue leaning in from
 * the top-left, the primary hue rising from the bottom-right — sit behind
 * scrolling content so the canvas reads as a lit room rather than a flat
 * swatch. When the track (and therefore the palette) changes, the new field
 * crossfades in over a short opacity blend; nothing animates continuously.
 *
 * Clear-glass contract: the canvas stays DARK. Washes render at the palette
 * tokens' own low alphas (≤ 0.16) scaled by the glass-intensity setting, so
 * glass materials above keep transmitting a readable backdrop instead of a
 * coloured fog. When no palette exists (nothing playing, extraction failed,
 * dynamic colours off) a barely-there aqua whisper preserves the depth.
 */

/** Fallback washes — the Abyss aqua identity, quieter than any palette. */
const FALLBACK: Wash = {
  top: 'rgba(59, 240, 223, 0.09)',
  bottom: 'rgba(34, 150, 156, 0.06)',
};

/** Perceived-strength multiplier per glass-intensity setting. */
const INTENSITY_SCALE: Record<string, number> = {
  subtle: 0.55,
  standard: 1,
  intense: 1.3,
};

/** Crossfade duration — long enough to read as light changing, never a flash. */
const FADE_MS = 420;

type Wash = { top: string; bottom: string };

/** Rewrite the alpha of an `rgba(r, g, b, a)` string, keeping its hue. */
function realpha(color: string, alpha: number): string {
  const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/);
  if (!m) return color;
  return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${alpha})`;
}

/** Read the alpha out of an `rgba(r, g, b, a)` string (defaults to 1). */
function alphaOf(color: string): number {
  const m = color.match(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*([\d.]+)\s*)?\)/);
  return m && m[1] !== undefined ? parseFloat(m[1]) : 1;
}

/**
 * One gradient field: two opposing diagonal washes with hue-matched fades.
 * The gradient stops scale the WASH TOKEN's own alpha (never above it), so
 * the field can only ever be as strong as the palette intends — the clear-
 * glass contract holds even at `intense` (opacity is applied per layer on
 * top of these stops, and `INTENSITY_SCALE.intense` stays below the point
 * where a 0.16-alpha token could read as fog).
 */
const GlowLayer: React.FC<{ wash: Wash }> = ({ wash }) => {
  const aTop = alphaOf(wash.top);
  const aBottom = alphaOf(wash.bottom);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Secondary hue — leans in from the top-left corner. */}
      <LinearGradient
        colors={[wash.top, realpha(wash.top, aTop * 0.35), realpha(wash.top, 0)]}
        locations={[0, 0.42, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.78, y: 0.62 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Primary hue — rises from the bottom-right corner. */}
      <LinearGradient
        colors={[realpha(wash.bottom, 0), realpha(wash.bottom, aBottom * 0.4), wash.bottom]}
        locations={[0, 0.55, 1]}
        start={{ x: 0.18, y: 0.32 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
};

export const AmbientGlow: React.FC = () => {
  const { palette } = usePalette();
  const { motionReduced, glassIntensity } = useAppearance();

  const wash: Wash = palette
    ? { top: palette.ambientAlt, bottom: palette.ambient }
    : FALLBACK;

  // Two stacked fields: `back` holds the outgoing wash during a crossfade,
  // `front` the incoming one. When no fade is running `back` is null.
  const [front, setFront] = useState<Wash>(wash);
  const [back, setBack] = useState<Wash | null>(null);
  const fade = useSharedValue(1);
  const frontRef = useRef(front);

  useEffect(() => {
    const prev = frontRef.current;
    if (prev.top === wash.top && prev.bottom === wash.bottom) return;

    if (motionReduced) {
      // Reduced motion: swap in place. The washes are subtle enough that an
      // instant change reads as a recolour, not a flash.
      frontRef.current = wash;
      setBack(null);
      setFront(wash);
      fade.value = 1;
      return;
    }

    frontRef.current = wash;
    setBack(prev);
    setFront(wash);
    fade.value = 0;
    fade.value = withTiming(
      1,
      { duration: FADE_MS, easing: Easing.out(Easing.quad) },
      (finished) => {
        if (finished) runOnJS(setBack)(null);
      }
    );
  }, [wash.top, wash.bottom, motionReduced, fade]);

  const scale = INTENSITY_SCALE[glassIntensity] ?? 1;

  const frontStyle = useAnimatedStyle(
    () => ({ opacity: fade.value * scale }),
    [scale]
  );
  const backStyle = useAnimatedStyle(
    () => ({ opacity: (1 - fade.value) * scale }),
    [scale]
  );

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {back ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, backStyle]}>
          <GlowLayer wash={back} />
        </Animated.View>
      ) : null}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, frontStyle]}>
        <GlowLayer wash={front} />
      </Animated.View>
    </View>
  );
};
