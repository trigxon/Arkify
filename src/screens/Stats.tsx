import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  ArrowLeft,
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
import { Animated } from 'react-native';
import { COLORS, SIZES, FONTS, TYPE, SHADOWS } from '../constants/theme';
import { GlassView, SpringPressable, FadeInUp } from '../components/common/Glass';
import { useEngagement, badgeTierMeta } from '../hooks/useEngagement';
import { BADGES, Badge } from '../engagement/Streaks';
import { tasteProfile } from '../ai/TasteProfile';

const BADGE_ICONS: Record<string, typeof Trophy> = {
  Play, Flame, Headphones, Timer, Compass, Map, Heart, ListMusic,
  Moon, Sunrise, Download, Sparkles, Trophy, Bot,
};

/**
 * Stats — the listener's trophy room. Level ring, streak flame, the weekly
 * listening bar chart and every badge (earned + next up).
 */
export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const eng = useEngagement();

  const [artistCount, setArtistCount] = React.useState(0);
  React.useEffect(() => {
    void tasteProfile.load().then(() => {
      setArtistCount(tasteProfile.snapshot().distinctArtists);
    });
  }, [eng.version]);

  const maxWeek = useMemo(
    () => Math.max(...eng.week.map((d) => d.seconds), 60),
    [eng.week]
  );

  const ringSize = 92;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SIZES.sm }]}>
        <SpringPressable
          style={styles.backBtn}
          pressScale={0.9}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft color={COLORS.text.primary} size={SIZES.icon.md} />
        </SpringPressable>
        <Text style={styles.headerTitle}>Stats & Badges</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: SIZES.bottomInset }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Level + streak hero */}
        <FadeInUp index={0}>
          <GlassView weight="thin" accent style={styles.hero}>
            {/* Level ring */}
            <View style={styles.ringWrap}>
              <Animated.View>
                <View style={[styles.ring, { width: ringSize, height: ringSize }]}>
                  <View style={[styles.ringInner, { width: ringSize - 10, height: ringSize - 10 }]}>
                    <Text style={styles.ringLevel}>{eng.level}</Text>
                    <Text style={styles.ringLabel}>LEVEL</Text>
                  </View>
                </View>
              </Animated.View>
              <Text style={styles.heroName}>{eng.levelName}</Text>
              <Text style={styles.heroXP}>{eng.levelInto}/{eng.levelSpan} XP</Text>
            </View>

            <View style={styles.heroRight}>
              <View style={styles.streakCard}>
                <Flame color="#FF8A3D" size={22} fill={eng.streakActive ? 'rgba(255,138,61,0.35)' : 'transparent'} />
                <Text style={styles.streakNum}>{eng.streak}</Text>
                <Text style={styles.streakLabel}>day streak</Text>
                {eng.streakActive ? null : (
                  <Text style={styles.streakHint}>Listen today to keep it</Text>
                )}
              </View>
              <View style={styles.todayCard}>
                <Timer color={COLORS.accent.primary} size={18} />
                <Text style={styles.todayNum}>{eng.minutesToday}m</Text>
                <Text style={styles.streakLabel}>today</Text>
              </View>
            </View>
          </GlassView>
        </FadeInUp>

        {/* Weekly chart */}
        <FadeInUp index={1}>
          <GlassView weight="thin" style={styles.chartCard}>
            <Text style={styles.cardTitle}>This week</Text>
            <View style={styles.chartRow}>
              {eng.week.map((day, i) => {
                const height = Math.max(6, Math.round((day.seconds / maxWeek) * 84));
                const isToday = i === eng.week.length - 1;
                return (
                  <View key={day.day} style={styles.chartCol}>
                    <View style={styles.chartBarTrack}>
                      <View
                        style={[
                          styles.chartBar,
                          { height },
                          isToday && styles.chartBarToday,
                        ]}
                      />
                    </View>
                    <Text style={[styles.chartDay, isToday && styles.chartDayToday]}>
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'][new Date(day.day).getDay()]}
                    </Text>
                  </View>
                );
              })}
            </View>
            <Text style={styles.chartHint}>
              {eng.totalHours}h all-time · {artistCount} artists explored
            </Text>
          </GlassView>
        </FadeInUp>

        {/* Badges */}
        <Text style={styles.badgesTitle}>
          Badges — {eng.earnedBadges.length}/{BADGES.length}
        </Text>
        <View style={styles.badgeGrid}>
          {BADGES.map((badge, i) => (
            <BadgeCell key={badge.id} badge={badge} earned={eng.badges.includes(badge.id)} index={i} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const BadgeCell: React.FC<{ badge: Badge; earned: boolean; index: number }> = ({ badge, earned, index }) => {
  const tier = badgeTierMeta(badge.tier);
  const Icon = BADGE_ICONS[badge.icon] ?? Trophy;

  return (
    <FadeInUp index={Math.min(index, 8)} preset="fast" style={styles.badgeCellWrap}>
      <GlassView
        weight="thin"
        accent={earned}
        style={[styles.badgeCell, !earned && styles.badgeLocked]}
      >
        <View
          style={[
            styles.badgeIcon,
            earned && { borderColor: tier.color, backgroundColor: `${tier.color}22` },
          ]}
        >
          <Icon color={earned ? tier.color : COLORS.text.muted} size={20} />
        </View>
        <Text style={[styles.badgeTitle, !earned && styles.badgeTitleLocked]} numberOfLines={1}>
          {badge.name}
        </Text>
        <Text style={styles.badgeDesc} numberOfLines={2}>
          {badge.description}
        </Text>
      </GlassView>
    </FadeInUp>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.gutter,
    paddingBottom: SIZES.sm,
    backgroundColor: COLORS.background,
    zIndex: 10,
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
  headerTitle: {
    fontFamily: FONTS.bold,
    fontSize: TYPE.title3.fontSize,
    color: COLORS.text.primary,
  },
  scroll: {
    paddingHorizontal: SIZES.gutter,
    paddingTop: SIZES.md,
  },

  // Hero
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SIZES.lg,
    marginBottom: SIZES.md,
  },
  ringWrap: {
    alignItems: 'center',
  },
  ring: {
    borderRadius: 999,
    borderWidth: 5,
    borderColor: COLORS.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.accent.primary,
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  ringInner: {
    borderRadius: 999,
    backgroundColor: 'rgba(53,214,198,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringLevel: {
    fontFamily: FONTS.bold,
    fontSize: 26,
    color: COLORS.text.primary,
  },
  ringLabel: {
    fontFamily: FONTS.bold,
    fontSize: 9,
    letterSpacing: 2,
    color: COLORS.text.muted,
  },
  heroName: {
    fontFamily: FONTS.semibold,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.accent.primary,
    marginTop: 8,
  },
  heroXP: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.micro.fontSize,
    color: COLORS.text.muted,
  },
  heroRight: {
    flex: 1,
    marginLeft: SIZES.lg,
    gap: SIZES.sm,
  },
  streakCard: {
    backgroundColor: 'rgba(255,138,61,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,138,61,0.3)',
    borderRadius: SIZES.radius.md,
    padding: SIZES.md,
    alignItems: 'center',
  },
  streakNum: {
    fontFamily: FONTS.bold,
    fontSize: TYPE.title1.fontSize,
    color: '#FF8A3D',
    lineHeight: 30,
  },
  streakLabel: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.micro.fontSize,
    color: COLORS.text.secondary,
  },
  streakHint: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: COLORS.text.muted,
    marginTop: 2,
  },
  todayCard: {
    backgroundColor: COLORS.accent.soft,
    borderWidth: 1,
    borderColor: COLORS.accent.border,
    borderRadius: SIZES.radius.md,
    padding: SIZES.sm + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  todayNum: {
    fontFamily: FONTS.bold,
    fontSize: TYPE.headline.fontSize,
    color: COLORS.text.primary,
  },

  // Weekly chart
  chartCard: {
    padding: SIZES.lg,
    marginBottom: SIZES.xl,
  },
  cardTitle: {
    fontFamily: FONTS.semibold,
    fontSize: TYPE.headline.fontSize,
    color: COLORS.text.primary,
    marginBottom: SIZES.md,
  },
  chartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chartCol: {
    alignItems: 'center',
    flex: 1,
  },
  chartBarTrack: {
    height: 84,
    width: '60%',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  chartBar: {
    width: '100%',
    borderRadius: 6,
    backgroundColor: 'rgba(53,214,198,0.55)',
  },
  chartBarToday: {
    backgroundColor: COLORS.accent.primary,
  },
  chartDay: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.micro.fontSize,
    color: COLORS.text.muted,
    marginTop: 6,
  },
  chartDayToday: {
    color: COLORS.accent.primary,
  },
  chartHint: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.text.muted,
    marginTop: SIZES.md,
    textAlign: 'center',
  },

  // Badge grid
  badgesTitle: {
    fontFamily: FONTS.semibold,
    fontSize: TYPE.headline.fontSize,
    color: COLORS.text.primary,
    marginBottom: SIZES.md,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SIZES.sm,
  },
  badgeCellWrap: {
    width: '31.5%',
    flexGrow: 1,
  },
  badgeCell: {
    borderRadius: SIZES.radius.md,
    padding: SIZES.sm + 2,
    alignItems: 'center',
    minHeight: 118,
  },
  badgeLocked: {
    opacity: 0.55,
  },
  badgeIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: COLORS.hairline,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  badgeTitle: {
    fontFamily: FONTS.semibold,
    fontSize: 11,
    color: COLORS.text.primary,
    textAlign: 'center',
  },
  badgeTitleLocked: {
    color: COLORS.text.secondary,
  },
  badgeDesc: {
    fontFamily: FONTS.regular,
    fontSize: 9,
    lineHeight: 12,
    color: COLORS.text.muted,
    textAlign: 'center',
    marginTop: 2,
  },
});
