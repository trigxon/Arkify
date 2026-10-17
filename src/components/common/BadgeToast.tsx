import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  Bot,
  Compass,
  Download,
  Flame,
  Headphones,
  Heart,
  ListMusic,
  Map,
  Moon,
  Play,
  Sparkles,
  Sunrise,
  Timer,
  Trophy,
} from 'lucide-react-native';
import { COLORS, FONTS, TYPE, SIZES, GLASS, SPRINGS } from '../../constants/theme';
import { engagement, badgeTierMeta } from '../../engagement/Streaks';
import type { Badge } from '../../engagement/Streaks';

// ---------------------------------------------------------------------------
// BadgeToastHost — the celebration layer.
//
// Every badge unlock flows through here exactly once: an iOS-style glass
// capsule springs down from the top edge, breathes for a few seconds, then
// floats away — even while the user is mid-scroll elsewhere. Unlocks earned
// back-to-back queue up and play in order.
// ---------------------------------------------------------------------------

const ICONS: Record<string, typeof Play> = {
  Play,
  Flame,
  Headphones,
  Trophy,
  Timer,
  Compass,
  Map,
  Heart,
  ListMusic,
  Moon,
  Sunrise,
  Download,
  Sparkles,
  Bot,
};

const SHOW_MS = 3600;
const EXIT_MS = 260;

export const BadgeToastHost: React.FC = () => {
  const [current, setCurrent] = useState<Badge | null>(null);
  const queue = useRef<Badge[]>([]);
  const showing = useRef(false);
  const alive = useRef(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const drop = useSharedValue(-140);
  const opacity = useSharedValue(0);

  useEffect(
    () => () => {
      alive.current = false;
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    []
  );

  const pump = useCallback(() => {
    if (!alive.current || showing.current) return;
    const next = queue.current.shift();
    if (!next) return;

    showing.current = true;
    setCurrent(next);

    // Enter: spring down from above the notch.
    drop.value = -140;
    opacity.value = 0;
    drop.value = withSpring(0, SPRINGS.lively);
    opacity.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) });

    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!alive.current) return;
      // Exit: float back up, then hand the stage to the next badge.
      drop.value = withTiming(-120, { duration: EXIT_MS, easing: Easing.in(Easing.quad) });
      opacity.value = withTiming(0, { duration: EXIT_MS, easing: Easing.in(Easing.quad) });
      setTimeout(() => {
        if (!alive.current) return;
        showing.current = false;
        setCurrent(null);
        pump();
      }, EXIT_MS + 30);
    }, SHOW_MS);
  }, [drop, opacity]);

  useEffect(() => {
    const unsub = engagement.onUnlock((badge) => {
      if (!alive.current) return;
      // Dedupe: never show the same badge twice in one session queue.
      if (current?.id === badge.id || queue.current.some((b) => b.id === badge.id)) return;
      queue.current.push(badge);
      pump();
    });
    return unsub;
    // current is read for dedupe only; the ref-based pump keeps timing sane.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, pump]);

  const toastStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: drop.value }],
    opacity: opacity.value,
  }));

  if (!current) return null;

  const tier = badgeTierMeta(current.tier);
  const Icon = ICONS[current.icon] ?? Sparkles;

  return (
    <View pointerEvents="box-none" style={[styles.host, { paddingTop: insets.top + 8 }]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.toast, toastStyle, { borderColor: `${tier.color}55` }]}
        accessibilityLiveRegion="polite"
        accessibilityLabel={`Badge unlocked: ${current.name}`}
      >
        {/* Tier glow behind the icon chip */}
        <View style={[styles.iconHalo, { backgroundColor: `${tier.color}22` }]} />
        <View style={[styles.iconChip, { borderColor: `${tier.color}66` }]}>
          <Icon color={tier.color} size={21} strokeWidth={2.1} />
        </View>

        <View style={styles.textCol}>
          <View style={styles.eyebrowRow}>
            <Text style={[styles.eyebrow, { color: tier.color }]}>BADGE UNLOCKED</Text>
            <Text style={styles.xp}>+50 XP</Text>
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {current.name}
          </Text>
          <Text style={styles.description} numberOfLines={1}>
            {current.description}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
};

const FILL: ViewStyle = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };

const styles = StyleSheet.create({
  host: {
    ...FILL,
    zIndex: 300,
    elevation: 300,
    alignItems: 'center',
    pointerEvents: 'none',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '92%',
    maxWidth: 360,
    backgroundColor: GLASS.fill.thick,
    borderWidth: 1,
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 22,
    elevation: 14,
    overflow: 'hidden',
  },
  iconHalo: {
    ...FILL,
  },
  iconChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    fontFamily: FONTS.bold,
    fontSize: TYPE.micro.fontSize,
    letterSpacing: 1.6,
  },
  xp: {
    fontFamily: FONTS.bold,
    fontSize: TYPE.micro.fontSize,
    color: COLORS.accent.primary,
  },
  name: {
    fontFamily: FONTS.semibold,
    fontSize: TYPE.headline.fontSize,
    color: COLORS.text.primary,
    marginTop: 2,
  },
  description: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.text.secondary,
    marginTop: 1,
  },
});
