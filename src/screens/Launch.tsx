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
import { Infinity as InfinityIcon, Moon, SquarePen, Zap } from 'lucide-react-native';
import { COLORS, FONTS, SIZES, TYPE } from '../constants/theme';

/**
 * Arkify launch experience.
 *
 * Mirrors the native splash (same background, centered logo) so the handoff
 * from the system splash is seamless, then reveals the brand composition:
 * logo, wordmark, "More Than Music", the cyan rule, and the four values as
 * icon circles with their labels beneath.
 *
 * Animation is deliberately shallow — fades and one gentle scale, all
 * interruptible, total in-run time ~2.5s so it never delays the app.
 */

/** The four brand values: icon-first, label beneath, per the reference. */
const VALUES = [
  { label: 'Minimal', Icon: SquarePen },
  { label: 'Fast', Icon: Zap },
  { label: 'Beautiful', Icon: Moon },
  { label: 'Yours', Icon: InfinityIcon },
] as const;

const PHASES = [0, 250, 450, 650, 950, 1150] as const;

export default function LaunchScreen({ onDone }: { onDone: () => void }) {
  const { width } = Dimensions.get('window');
  // The mark canvas carries breathing room around the glyph, so this renders
  // the "A" at roughly the reference's size ratio.
  const logoSize = Math.min(200, width * 0.46);

  // One value per animated element: logo scale, logo/wordmark/tagline/rules
  // share fades, the four value pills each get their own.
  const logoScale = useRef(new Animated.Value(0.92)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const ruleOpacity = useRef(new Animated.Value(0)).current;
  const pillFades = useRef(VALUES.map(() => new Animated.Value(0))).current;
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
        colors={['rgba(53, 214, 198, 0.16)', 'rgba(53, 214, 198, 0.045)', 'rgba(12, 15, 15, 0)']}
        locations={[0, 0.4, 0.75]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 0.7 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(53, 214, 198, 0.05)', 'transparent']}
        start={{ x: 0.8, y: 0.9 }}
        end={{ x: 0.3, y: 0.4 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Tap anywhere to skip — the brand moment must never trap the user. */}
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={finish}
        accessibilityRole="button"
        accessibilityLabel="Skip intro"
      />

      <View style={styles.center}>
        {/* Logo — the real asset, gently scaled into place. */}
        <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
          <View style={styles.logoGlowWrap}>
            {/* Ambient halo rather than a disc, per the reference's soft light. */}
            <View
              style={[
                styles.logoHaloOuter,
                {
                  width: logoSize + 170,
                  height: logoSize + 170,
                  borderRadius: (logoSize + 170) / 2,
                },
              ]}
            />
            <View
              style={[
                styles.logoHaloInner,
                {
                  width: logoSize + 80,
                  height: logoSize + 80,
                  borderRadius: (logoSize + 80) / 2,
                },
              ]}
            />
            {/* The transparent, accent-inked mark — never the square icon art. */}
            <Animated.Image
              source={require('../../assets/brand-mark.png')}
              style={{ width: logoSize, height: logoSize }}
              resizeMode="contain"
            />
          </View>
        </Animated.View>

        {/* Wordmark */}
        <Animated.Text style={[styles.wordmark, { opacity: wordmarkOpacity }]}>Arkify</Animated.Text>

        {/* Tagline */}
        <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
          More Than Music
        </Animated.Text>

        {/* Cyan rule */}
        <Animated.View style={[styles.rule, { opacity: ruleOpacity }]} />

        {/* Values: accent-ringed icon circles with their labels beneath. */}
        <View style={styles.pillRow}>
          {VALUES.map((v, i) => (
            <Animated.View key={v.label} style={[styles.pillItem, { opacity: pillFades[i] }]}>
              <View style={styles.pill}>
                <v.Icon color={COLORS.accent.primary} size={SIZES.icon.lg} strokeWidth={1.9} />
              </View>
              <Text style={styles.pillLabel}>{v.label}</Text>
            </Animated.View>
          ))}
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
    paddingBottom: '10%',
    // Keep the brand composition clear of the skip layer's edges.
    zIndex: 1,
  },
  logoGlowWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoHaloOuter: {
    position: 'absolute',
    backgroundColor: 'rgba(53, 214, 198, 0.035)',
  },
  logoHaloInner: {
    position: 'absolute',
    backgroundColor: 'rgba(53, 214, 198, 0.05)',
  },
  wordmark: {
    fontFamily: FONTS.bold,
    fontSize: 52,
    lineHeight: 60,
    letterSpacing: 0.5,
    color: COLORS.text.primary,
    marginTop: SIZES.lg,
  },
  tagline: {
    fontFamily: FONTS.medium,
    fontStyle: 'italic',
    fontSize: TYPE.headline.fontSize + 1,
    letterSpacing: 4,
    color: COLORS.accent.primary,
    marginTop: SIZES.md,
  },
  rule: {
    width: 56,
    height: 3,
    borderRadius: 2,
    backgroundColor: COLORS.accent.primary,
    marginTop: SIZES.md,
  },
  pillRow: {
    flexDirection: 'row',
    gap: SIZES.md + 2,
    marginTop: SIZES.xxl,
  },
  pillItem: {
    alignItems: 'center',
    width: 72,
  },
  /** Value rings: brighter and larger than a first pass, per the reference. */
  pill: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.2,
    borderColor: 'rgba(53, 214, 198, 0.55)',
    backgroundColor: 'rgba(53, 214, 198, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillLabel: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.text.soft,
    marginTop: SIZES.sm + 2,
  },
});
