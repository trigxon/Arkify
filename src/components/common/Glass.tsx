import React, { useMemo } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  ViewStyle,
  StyleProp,
  TouchableOpacity,
  TouchableOpacityProps,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  cancelAnimation,
  FadeInUp as ReFadeInUp,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { GLASS, SPRINGS, ENTRANCE } from '../../constants/theme';

// ---------------------------------------------------------------------------
// GlassView — the material everything translucent is made of
//
// Layers (bottom → top):
//   1. optional platform blur (native only — web keeps the translucent fill)
//   2. a translucent fill so contrast is guaranteed on any backdrop
//   3. a vertical sheen: brighter along the top edge, like light from above
//   4. a hairline border; `luminous` variants read as a wet glass rim
// ---------------------------------------------------------------------------

export type GlassWeight = 'ultraThin' | 'thin' | 'regular' | 'thick';

type GlassViewProps = {
  weight?: GlassWeight;
  /** Draws the top-edge specular streak. On by default. */
  specular?: boolean;
  /** Adds a soft inner accent tint (AI surfaces, active states). */
  accent?: boolean;
  /** Blurs whatever is behind the panel (native). Off on web. */
  blur?: boolean;
  /** Rounded pill (full radius). */
  pill?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  pointerEvents?: 'auto' | 'none' | 'box-none';
};

export const GlassView: React.FC<GlassViewProps> = ({
  weight = 'regular',
  specular = true,
  accent = false,
  blur = false,
  pill = false,
  style,
  children,
  pointerEvents,
}) => {
  const radius = pill ? 999 : GLASS.radius.card;

  return (
    <View
      pointerEvents={pointerEvents ?? 'auto'}
      style={[
        styles.base,
        {
          borderRadius: radius,
          backgroundColor: GLASS.fill[weight],
          borderWidth: 1,
          borderColor: accent ? GLASS.border.accent : GLASS.border.hairline,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {blur && Platform.OS !== 'web' ? (
        <BlurView
          intensity={weight === 'thick' ? GLASS.blur.thick : weight === 'thin' ? GLASS.blur.thin : GLASS.blur.regular}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      {specular ? (
        <LinearGradient
          colors={[GLASS.highlight.soft, GLASS.highlight.faint, 'rgba(255,255,255,0)']}
          locations={[0, 0.14, 0.4]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      {accent ? (
        <LinearGradient
          colors={[GLASS.tint.accentSoft, 'rgba(53,214,198,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      {children}
    </View>
  );
};

// ---------------------------------------------------------------------------
// SpringPressable — the liquid touch. Every tappable glass surface uses this
// so presses share one physical feel: scale down fast, spring back lively.
// ---------------------------------------------------------------------------

type SpringPressableProps = TouchableOpacityProps & {
  /** Scale at full press. Defaults to 0.96 — enough to feel, not enough to smear text. */
  pressScale?: number;
  /** Glows while pressed (accent ring). */
  glow?: boolean;
  style?: StyleProp<ViewStyle>;
};

export const SpringPressable: React.FC<SpringPressableProps> = ({
  pressScale = 0.96,
  glow = false,
  style,
  children,
  ...touchProps
}) => {
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={() => {
        scale.value = withSpring(pressScale, SPRINGS.press);
        if (glow) glowOpacity.value = withTiming(1, { duration: 90 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, SPRINGS.release);
        if (glow) glowOpacity.value = withTiming(0, { duration: 220 });
      }}
      {...touchProps}
    >
      <Animated.View style={[style, animatedStyle]}>
        {children}
        {glow ? (
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              styles.glowRing,
              glowStyle,
            ]}
          />
        ) : null}
      </Animated.View>
    </TouchableOpacity>
  );
};

// ---------------------------------------------------------------------------
// FadeInUp — staggered section entrance. Wrap rows/cards in order.
// ---------------------------------------------------------------------------

export const FadeInUp: React.FC<{
  index?: number;
  preset?: keyof typeof ENTRANCE;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}> = ({ index = 0, preset = 'base', style, children }) => {
  const cfg = ENTRANCE[preset];
  const entering = useMemo(
    () =>
      ReFadeInUp.delay(Math.min(index, 8) * 55)
        .duration(cfg.duration)
        .easing(Easing.out(Easing.cubic)),
    [index, cfg.duration]
  );

  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
};

// ---------------------------------------------------------------------------
// PulsingGlow — a breathing halo used behind AI / Now Playing artwork.
// Purely decorative, pointer-transparent.
// ---------------------------------------------------------------------------

export const PulsingGlow: React.FC<{
  size: number;
  color?: string;
  /** Seconds per breath. */
  period?: number;
  style?: StyleProp<ViewStyle>;
}> = ({ size, color = 'rgba(53, 214, 198, 0.30)', period = 3200, style }) => {
  const opacity = useSharedValue(0.5);

  React.useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: period / 2, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
    return () => cancelAnimation(opacity);
  }, [opacity, period]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        styles.glowBlur,
        animated,
        style,
      ]}
    />
  );
};

// ---------------------------------------------------------------------------
// ShimmerBar — skeleton that actually shimmers, for loading glass panels.
// ---------------------------------------------------------------------------

export const ShimmerBar: React.FC<{ width: number | `${number}%`; height?: number; radius?: number; style?: StyleProp<ViewStyle> }> = ({
  width,
  height = 12,
  radius = 6,
  style,
}) => {
  const progress = useSharedValue(0);

  React.useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
      -1,
      false
    );
    return () => cancelAnimation(progress);
  }, [progress]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateX: -80 + progress.value * 240 }],
  }));

  return (
    <View
      style={[
        {
          width: width as number,
          height,
          borderRadius: radius,
          backgroundColor: GLASS.fill.thin,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.shimmerStreak,
          animated,
        ]}
      >
        <LinearGradient
          colors={['rgba(255,255,255,0)', GLASS.highlight.soft, 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {},
  glowRing: {
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(53, 214, 198, 0.55)',
    shadowColor: '#35D6C6',
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  glowBlur: Platform.select({
    // Blur via stacked alpha rings on Android (shadow blur is unreliable there)
    android: {
      shadowColor: 'rgba(0,0,0,0)',
      opacity: 1,
    },
    default: {},
  }),
  shimmerStreak: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 120,
  },
});
