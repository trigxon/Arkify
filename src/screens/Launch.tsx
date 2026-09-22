import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';
import { Layers, Zap, Sparkles, Infinity as InfinityIcon } from 'lucide-react-native';
import { COLORS, FONTS, SIZES, TYPE } from '../constants/theme';

/**
 * Audia launch experience matching reference image 10.
 */
const VALUE_ITEMS = [
  { label: 'Minimal', Icon: Layers },
  { label: 'Fast', Icon: Zap },
  { label: 'Beautiful', Icon: Sparkles },
  { label: 'Yours', Icon: InfinityIcon },
] as const;

const PHASES = [0, 250, 450, 650, 950, 1150] as const;

export default function LaunchScreen({ onDone }: { onDone: () => void }) {
  const { width, height } = Dimensions.get('window');
  const logoSize = Math.min(150, width * 0.36);

  // One value per animated element: logo scale, logo/wordmark/tagline/rules
  // share fades, the four pills each get their own.
  const logoScale = useRef(new Animated.Value(0.92)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const ruleOpacity = useRef(new Animated.Value(0)).current;
  const pillFades = useRef(
    VALUE_ITEMS.map(() => new Animated.Value(0))
  ).current;
  const finishRef = useRef(false);

  const finish = useCallback(() => {
    if (finishRef.current) return;
    finishRef.current = true;
    onDone();
  }, [onDone]);

  useEffect(() => {
    // Native splash hides the instant the brand composition is ready to draw.
    SplashScreen.hideAsync().catch(() => undefined);

    const seq = Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          speed: 22,
          bounciness: 5,
          useNativeDriver: true,
          delay: 100,
        }),
      ]),
      Animated.timing(wordmarkOpacity, {
        toValue: 1,
        delay: PHASES[1],
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(taglineOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(ruleOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
      ]),
      Animated.stagger(
        110,
        pillFades.map((v) =>
          Animated.timing(v, { toValue: 1, duration: 360, useNativeDriver: true })
        )
      ),
    ]);

    seq.start(({ finished }) => {
      if (finished) finish();
    });

    // Safety: never trap the user if an animation stalls (low-end devices,
    // dev-mode stalls). ~4s ceiling.
    const safety = setTimeout(finish, 4000);

    return () => {
      clearTimeout(safety);
      seq.stop();
    };
  }, [finish, logoOpacity, logoScale, wordmarkOpacity, taglineOpacity, ruleOpacity, pillFades]);

  return (
    <View style={styles.container}>
      {/* Cinematic teal atmosphere: a bloom upper-left + deep falloff, matching
          the reference's dark ambient lighting. */}
      <LinearGradient
        colors={['rgba(61, 214, 195, 0.16)', 'rgba(61, 214, 195, 0.045)', 'rgba(6, 8, 8, 0)']}
        locations={[0, 0.4, 0.75]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 0.7 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(61, 214, 195, 0.05)', 'transparent']}
        start={{ x: 0.8, y: 0.9 }}
        end={{ x: 0.3, y: 0.4 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Tap anywhere to skip — the brand moment must never trap the user. */}
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={finish} accessibilityLabel="Skip" />

      <View style={styles.center}>
        {/* Logo — the real asset, gently scaled into place. */}
        <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
          <View style={[styles.logoGlow, { width: logoSize + 60, height: logoSize + 60, borderRadius: (logoSize + 60) / 2 }]}>
            <Animated.Image
              source={require('../../assets/icon.png')}
              style={{ width: logoSize, height: logoSize, opacity: logoOpacity }}
              resizeMode="contain"
            />
          </View>
        </Animated.View>

        {/* Wordmark */}
        <Animated.Text style={[styles.wordmark, { opacity: wordmarkOpacity }]}>Audia</Animated.Text>

        {/* Tagline */}
        <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
          More Than Music
        </Animated.Text>

        {/* Cyan rule */}
        <Animated.View style={[styles.rule, { opacity: ruleOpacity }]} />

        {/* Value pills */}
        <View style={styles.pillRow}>
          {VALUE_ITEMS.map((item, i) => {
            const Icon = item.Icon;
            return (
              <Animated.View key={item.label} style={[styles.pillItemWrap, { opacity: pillFades[i] }]}>
                <View style={styles.pillCircle}>
                  <Icon color={COLORS.accent.primary} size={22} strokeWidth={2} />
                </View>
                <Text style={styles.pillLabel}>{item.label}</Text>
              </Animated.View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: '12%',
    // Keep the brand composition clear of the skip layer's edges.
    zIndex: 1,
  },
  logoGlow: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(24, 229, 213, 0.08)',
  },
  wordmark: {
    fontFamily: FONTS.semibold,
    fontSize: 42,
    fontWeight: '700',
    lineHeight: 50,
    letterSpacing: 1,
    color: COLORS.text.primary,
    marginTop: SIZES.md,
  },
  tagline: {
    fontFamily: FONTS.medium,
    fontStyle: 'italic',
    fontSize: TYPE.callout.fontSize + 1,
    letterSpacing: 3,
    color: COLORS.accent.primary,
    marginTop: SIZES.sm,
  },
  rule: {
    width: 52,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: COLORS.accent.primary,
    marginTop: SIZES.md + 2,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: SIZES.xxl,
  },
  pillItemWrap: {
    alignItems: 'center',
    width: 66,
  },
  pillCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: 'rgba(24, 229, 213, 0.45)',
    backgroundColor: 'rgba(15, 26, 29, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: COLORS.accent.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  pillLabel: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    letterSpacing: 0.2,
    color: COLORS.text.secondary,
  },
});
