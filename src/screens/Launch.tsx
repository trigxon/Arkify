import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import {
  Orbitron_800ExtraBold,
  Orbitron_700Bold,
} from '@expo-google-fonts/orbitron';
import {
  ChakraPetch_400Regular,
  ChakraPetch_400Regular_Italic,
  ChakraPetch_500Medium,
} from '@expo-google-fonts/chakra-petch';
import { Infinity as InfinityIcon, Moon, SquarePen, Zap } from 'lucide-react-native';
import { COLORS, SIZES, TYPE } from '../constants/theme';

/**
 * Arkify launch experience.
 *
 * Mirrors the native splash (same background, centered logo) so the handoff
 * from the system splash is seamless, then reveals the brand composition:
 * logo, futuristic wordmark, "More Than Music", the cyan rule, the four
 * values as icon circles, a TAP TO CONTINUE hint, and the engineer credit.
 *
 * Typography is the brand voice: Orbitron 800 for the wordmark (sci-fi
 * geometric display), Chakra Petch for everything else (tech family with a
 * true italic so the tagline stays elegant). Fonts bundle locally via the
 * @expo-google-fonts packages (OFL) — no runtime fetch, no FOUT.
 *
 * Animation is deliberately shallow — fades and one gentle scale, all
 * interruptible. The reveal lands in ~2.5s, then the composition rests with
 * a breathing TAP TO CONTINUE hint until the user proceeds (any tap skips
 * or advances — the brand moment never traps the user).
 */

/** The four brand values: icon-first, label beneath, per the reference. */
const VALUES = [
  { label: 'Minimal', Icon: SquarePen },
  { label: 'Fast', Icon: Zap },
  { label: 'Beautiful', Icon: Moon },
  { label: 'Yours', Icon: InfinityIcon },
] as const;

/** Brand font faces (loaded below; system fallback until ready). */
export const BRAND_FONTS = {
  display: 'Orbitron_800ExtraBold',
  displayAlt: 'Orbitron_700Bold',
  tagline: 'ChakraPetch_400Regular_Italic',
  body: 'ChakraPetch_400Regular',
  credit: 'ChakraPetch_500Medium',
} as const;

const PHASES = [0, 250, 450, 650, 950, 1150] as const;

export default function LaunchScreen({ onDone }: { onDone: () => void }) {
  const { width } = Dimensions.get('window');
  // The mark canvas carries breathing room around the glyph, so this renders
  // the "A" at roughly the reference's size ratio.
  const logoSize = Math.min(200, width * 0.46);

  // Brand fonts gate the reveal: first paint keeps the native splash while
  // the (bundled, local) faces decode, so the wordmark never flashes system.
  const [fontsLoaded, fontsError] = useFonts({
    Orbitron_800ExtraBold,
    Orbitron_700Bold,
    ChakraPetch_400Regular,
    ChakraPetch_400Regular_Italic,
    ChakraPetch_500Medium,
  });

  // One value per animated element: logo scale, logo/wordmark/tagline/rules
  // share fades, the four value pills each get their own.
  const logoScale = useRef(new Animated.Value(0.92)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const ruleOpacity = useRef(new Animated.Value(0)).current;
  const hintOpacity = useRef(new Animated.Value(0)).current;
  const creditOpacity = useRef(new Animated.Value(0)).current;
  const pillFades = useRef(VALUES.map(() => new Animated.Value(0))).current;
  const finishRef = useRef(false);
  const [hintVisible, setHintVisible] = useState(false);

  const finish = useCallback(() => {
    if (finishRef.current) return;
    finishRef.current = true;
    onDone();
  }, [onDone]);

  useEffect(() => {
    // Never trap the user: a font decode failure falls back to system faces
    // and the intro plays exactly the same.
    if (!fontsLoaded && !fontsError) return;

    SplashScreen.hideAsync().catch(() => undefined);
    setHintVisible(true);

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
      // Hint + engineer credit land last — the quiet footnotes of the intro.
      Animated.parallel([
        Animated.timing(hintOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.timing(creditOpacity, { toValue: 1, duration: 420, useNativeDriver: true }),
      ]),
    ]);

    // The tap hint breathes (~1.6s cycle) — started only after the intro
    // sequence lands so the two animations never fight over the value.
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(hintOpacity, {
          toValue: 0.35,
          duration: 800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(hintOpacity, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    seq.start(({ finished }) => {
      // Reveal lands → the composition RESTS with the breathing hint and
      // credit visible, and waits for the user's tap. No auto-advance: the
      // brand moment belongs to the user (generous safety net below).
      if (finished) breathe.start();
    });

    // Safety: never trap the user if they walk away mid-intro. Generous —
    // the tap hint is the affordance, this only fires if nobody taps.
    const safety = setTimeout(finish, 9000);

    return () => {
      clearTimeout(safety);
      breathe.stop();
      seq.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontsLoaded, fontsError, finish]);

  return (
    <View style={styles.container}>
      {/* Cinematic teal atmosphere: a bloom upper-left + deep falloff, matching
          the reference's dark ambient lighting. */}
      <LinearGradient
        colors={['rgba(59, 240, 223, 0.16)', 'rgba(59, 240, 223, 0.045)', 'rgba(4, 10, 11, 0)']}
        locations={[0, 0.4, 0.75]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 0.7 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(59, 240, 223, 0.05)', 'transparent']}
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

        {/* Wordmark — Orbitron 800, open tracking, sci-fi title-card energy. */}
        <Animated.Text style={[styles.wordmark, { opacity: wordmarkOpacity }]}>
          Arkify
        </Animated.Text>

        {/* Tagline — Chakra Petch true italic, the brand's one elegant voice. */}
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

      {/* Tap hint — breathing, functional, never blocking the composition. */}
      {hintVisible ? (
        <Animated.Text style={[styles.tapHint, { opacity: hintOpacity }]}>
          TAP TO CONTINUE
        </Animated.Text>
      ) : null}

      {/* Engineer credit — the signature line, styled per the reference. */}
      <Animated.View style={[styles.creditWrap, { opacity: creditOpacity }]} pointerEvents="none">
        <View style={styles.creditRule} />
        <Animated.Text style={styles.credit} numberOfLines={1}>
          ENGINEERED BY ARK DURRANI
        </Animated.Text>
        <View style={styles.creditRule} />
      </Animated.View>
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
    backgroundColor: 'rgba(59, 240, 223, 0.035)',
  },
  logoHaloInner: {
    position: 'absolute',
    backgroundColor: 'rgba(59, 240, 223, 0.05)',
  },
  wordmark: {
    // Orbitron 800 at 50px: +6% tracking keeps the circular glyphs airy —
    // futuristic title-card spacing instead of a squeezed block.
    fontFamily: BRAND_FONTS.display,
    fontSize: 50,
    lineHeight: 60,
    letterSpacing: 3,
    color: COLORS.text.primary,
    marginTop: SIZES.lg,
    textShadowColor: 'rgba(59, 240, 223, 0.35)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  tagline: {
    fontFamily: BRAND_FONTS.tagline,
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
    alignSelf: 'center',
    maxWidth: '100%',
  },
  pillItem: {
    alignItems: 'center',
    width: 72,
    // Compress instead of clipping the fourth value on 320dp screens.
    flexShrink: 1,
  },
  /** Value rings: brighter and larger than a first pass, per the reference. */
  pill: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.2,
    borderColor: 'rgba(59, 240, 223, 0.55)',
    backgroundColor: 'rgba(59, 240, 223, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillLabel: {
    fontFamily: BRAND_FONTS.body,
    fontSize: TYPE.footnote.fontSize,
    letterSpacing: 0.8,
    color: COLORS.text.soft,
    marginTop: SIZES.sm + 2,
  },
  tapHint: {
    position: 'absolute',
    bottom: 86,
    alignSelf: 'center',
    fontFamily: BRAND_FONTS.body,
    fontSize: TYPE.micro.fontSize + 1,
    letterSpacing: 3.4,
    color: 'rgba(184, 196, 195, 0.9)',
  },
  creditWrap: {
    position: 'absolute',
    bottom: 52,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  creditRule: {
    width: 26,
    height: 1,
    backgroundColor: 'rgba(59, 240, 223, 0.45)',
  },
  credit: {
    fontFamily: BRAND_FONTS.credit,
    fontSize: TYPE.footnote.fontSize,
    letterSpacing: 3.2,
    color: 'rgba(174, 192, 191, 0.95)',
    textShadowColor: 'rgba(59, 240, 223, 0.35)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
});
