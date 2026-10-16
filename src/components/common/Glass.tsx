import React, { useMemo, useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  StyleProp,
  TouchableOpacity,
  TouchableOpacityProps,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';
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
import * as Haptics from 'expo-haptics';
import { COLORS, GLASS, SPRINGS, ENTRANCE, TYPE, FONTS, SIZES } from '../../constants/theme';
import { useAppearance } from '../../hooks/useAppearance';

// ---------------------------------------------------------------------------
// GlassView — the material everything translucent is made of
//
// Layers (bottom → top):
//   1. optional platform blur (native only — web keeps the translucent fill)
//   2. a translucent fill so contrast is guaranteed on any backdrop
//   3. a vertical sheen: brighter along the top edge, like light from above
//   4. a depth falloff: the lower glass thickens and darkens like a real
//      lens, so panels read as volumetric slabs instead of flat overlays
//   5. a hairline border; `luminous` variants read as a wet glass rim
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
  // Real translucent material on native (iOS UIBlurEffect / Android blur);
  // web keeps the layered translucent fill, which reads nearly identically.
  blur = Platform.OS !== 'web',
  pill = false,
  style,
  children,
  pointerEvents,
}) => {
  const radius = pill ? 999 : GLASS.radius.card;
  // Materials respond to the user's Glass-intensity setting. Identity at
  // 'standard', so the default install does zero extra work here.
  const { glass } = useAppearance();

  return (
    <View
      pointerEvents={pointerEvents ?? 'auto'}
      style={[
        styles.base,
        {
          borderRadius: radius,
          backgroundColor: glass.fill[weight],
          borderWidth: 1,
          borderColor: accent ? glass.border.accent : glass.border.hairline,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {blur && Platform.OS !== 'web' ? (
        <BlurView
          intensity={weight === 'thick' ? glass.blur.thick : weight === 'thin' ? glass.blur.thin : glass.blur.regular}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      {specular ? (
        <>
          <LinearGradient
            colors={[glass.highlight.strong, glass.highlight.faint, 'rgba(255,255,255,0)']}
            locations={[0, 0.16, 0.44]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
          />
          {/* Lens depth: the lower half thickens, grounding the material. */}
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.05)', 'rgba(0,0,0,0.26)']}
            locations={[0.5, 0.76, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
          />
        </>
      ) : null}

      {accent ? (
        <LinearGradient
          colors={[glass.tint.accentSoft, 'rgba(59, 240, 223, 0)']}
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
  // Reduced motion: presses answer through opacity, not transform.
  const { motionReduced } = useAppearance();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: motionReduced ? 1 : scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <TouchableOpacity
      activeOpacity={motionReduced ? 0.7 : 1}
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
  const { motionReduced } = useAppearance();
  const entering = useMemo(
    () =>
      motionReduced
        ? undefined
        : ReFadeInUp.delay(Math.min(index, 8) * 55)
            .duration(cfg.duration)
            .easing(Easing.out(Easing.cubic)),
    [index, cfg.duration, motionReduced]
  );

  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
};

// ---------------------------------------------------------------------------
// Segmented — iOS-style segmented control for small exclusive choices
// (motion preference, glass intensity). Sliding selection, spring settle.
// ---------------------------------------------------------------------------

export const Segmented: React.FC<{
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}> = ({ options, value, onChange, accessibilityLabel, style }) => {
  const { motionReduced } = useAppearance();
  const [width, setWidth] = useState(0);
  const slot = width > 0 ? (width - 4) / options.length : 0;
  const activeIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const x = useSharedValue(0);
  const laidOut = useRef(false);

  React.useEffect(() => {
    const target = activeIndex * slot;
    if (!laidOut.current) {
      laidOut.current = true;
      x.value = target; // first measure snaps, no fly-in
      return;
    }
    x.value = motionReduced ? target : withSpring(target, SPRINGS.release);
  }, [activeIndex, slot, x, motionReduced]);

  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
    width: slot,
  }));

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.segmentWrap, style]}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {slot > 0 ? (
        <Animated.View style={[styles.segmentThumb, thumb]} />
      ) : null}
      {options.map((option) => {
        const active = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            style={styles.segmentOption}
            activeOpacity={0.7}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// ---------------------------------------------------------------------------
// IOSToggle — the iOS switch. Knob slides on a spring, track colour crossfades,
// a selection haptic ticks on change. Drop-in for every settings row.
// ---------------------------------------------------------------------------

export const IOSToggle: React.FC<{
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}> = ({ value, onValueChange, disabled = false, accessibilityLabel, style }) => {
  const knob = useSharedValue(value ? 1 : 0);
  const { motionReduced } = useAppearance();

  React.useEffect(() => {
    if (motionReduced) {
      knob.value = value ? 1 : 0;
      return;
    }
    knob.value = withSpring(value ? 1 : 0,
      value ? SPRINGS.release : SPRINGS.gentle);
  }, [value, knob, motionReduced]);

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: knob.value * 20 }],
  }));
  const onOpacity = useAnimatedStyle(() => ({ opacity: knob.value }));

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      disabled={disabled}
      onPress={() => {
        if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => undefined);
        onValueChange(!value);
      }}
      accessibilityRole="switch"
      accessibilityState={{ selected: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      style={[styles.toggleWrap, style]}
    >
      <View style={[styles.toggleTrack, { backgroundColor: 'rgba(120, 120, 128, 0.32)' }, value && styles.toggleTrackOn]}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.toggleTrackOnLayer, onOpacity]} />
        <Animated.View style={[styles.toggleKnob, knobStyle]} />
      </View>
    </TouchableOpacity>
  );
};

// ---------------------------------------------------------------------------
// BackButton — one circular glass back button for every stack screen.
// Spring press, haptic, iOS-style pop.
// ---------------------------------------------------------------------------

export const BackButton: React.FC<{
  onPress?: () => void;
  label?: string;
  style?: StyleProp<ViewStyle>;
}> = ({ onPress, label = 'Back', style }) => {
  const navigation = useNavigation();
  return (
    <SpringPressable
      style={[styles.backBtn, style]}
      pressScale={0.88}
      onPress={
        onPress ??
        (() => {
          if (navigation.canGoBack()) navigation.goBack();
        })
      }
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <ArrowLeft color={COLORS.text.primary} size={SIZES.icon.md} strokeWidth={2.2} />
    </SpringPressable>
  );
};

// ---------------------------------------------------------------------------
// usePressScale — shared press-physics hook for custom animated controls
// (transport buttons, thumbs). Returns { pressed, scale, handlers }.
// ---------------------------------------------------------------------------

export const usePressScale = (pressScale = 0.9) => {
  const pressed = useSharedValue(0);
  const { motionReduced } = useAppearance();
  const scale = useAnimatedStyle(() => ({
    transform: [
      {
        scale: motionReduced
          ? 1
          : withSpring(pressed.value ? pressScale : 1,
              pressed.value ? SPRINGS.press : SPRINGS.release),
      },
    ],
  }));

  return {
    scale,
    handlers: {
      onPressIn: () => {
        pressed.value = 1;
      },
      onPressOut: () => {
        pressed.value = 0;
      },
    },
  };
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
}> = ({ size, color = 'rgba(59, 240, 223, 0.30)', period = 3200, style }) => {
  const opacity = useSharedValue(0.5);
  const { motionReduced } = useAppearance();

  React.useEffect(() => {
    // Reduced motion: a still halo keeps the depth cue without the pulse.
    if (motionReduced) {
      cancelAnimation(opacity);
      opacity.value = 0.5;
      return;
    }
    opacity.value = withRepeat(
      withTiming(1, { duration: period / 2, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
    return () => cancelAnimation(opacity);
  }, [opacity, period, motionReduced]);

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
  const { motionReduced } = useAppearance();

  React.useEffect(() => {
    if (motionReduced) {
      cancelAnimation(progress);
      progress.value = 0.5; // streak parked mid-bar
      return;
    }
    progress.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
      -1,
      false
    );
    return () => cancelAnimation(progress);
  }, [progress, motionReduced]);

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
  segmentWrap: {
    flexDirection: 'row',
    backgroundColor: 'rgba(120, 120, 128, 0.22)',
    borderRadius: 12,
    padding: 2,
    minHeight: 36,
  },
  segmentThumb: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    left: 2,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  segmentOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
    paddingHorizontal: 6,
  },
  segmentText: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.text.secondary,
  },
  segmentTextActive: {
    color: COLORS.text.primary,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleWrap: {
    padding: 4,
  },
  toggleTrack: {
    width: 51,
    height: 31,
    borderRadius: 15.5,
    padding: 2,
  } as ViewStyle,
  toggleTrackOnLayer: {
    borderRadius: 15.5,
    backgroundColor: COLORS.status.success,
  },
  toggleTrackOn: {},
  toggleKnob: {
    width: 27,
    height: 27,
    borderRadius: 13.5,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  glowRing: {
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(59, 240, 223, 0.55)',
    shadowColor: '#3BF0DF',
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
