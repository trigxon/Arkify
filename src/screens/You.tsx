import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  BarChart3,
  ChevronRight,
  Clock,
  Download,
  Flame,
  Heart,
  ListMusic,
  Settings as SettingsIcon,
  Sparkles,
  Trophy,
  User,
} from 'lucide-react-native';
import { COLORS, SIZES, FONTS, TYPE, GRADIENTS } from '../constants/theme';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { GlassView, SpringPressable, FadeInUp } from '../components/common/Glass';
import { MiniPlayer } from '../components/player/MiniPlayer';
import { StatusBarScrim } from '../components/common/StatusBarScrim';
import { AmbientGlow } from '../components/common/AmbientGlow';
import { useLibrary } from '../hooks/useLibrary';
import { usePlayer } from '../hooks/usePlayer';
import { useEngagement, badgeTierMeta } from '../hooks/useEngagement';
import { DownloadService } from '../services/DownloadService';

/**
 * You — the identity hub. Everything the listener earns and owns lives here:
 * level + streak, listening stats, Wrapped, badges, downloads and settings.
 * Built to be the screen people open to *see themselves*.
 */
export default function YouScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { profile, liked, playlists, history } = useLibrary();
  const { currentTrack, isPlaying, togglePlayPause, isLoading } = usePlayer();
  const eng = useEngagement();

  const [downloadCount, setDownloadCount] = useState(0);

  React.useEffect(() => {
    void DownloadService.getDownloaded().then((list) => setDownloadCount(list.length));
  }, []);

  const firstName = profile.name?.trim() || 'You';

  const openStats = useCallback(() => navigation.navigate('Stats' as never), [navigation]);
  const openWrapped = useCallback(() => navigation.navigate('Wrapped' as never), [navigation]);
  const openHistory = useCallback(() => navigation.navigate('History' as never), [navigation]);
  const openSettings = useCallback(() => navigation.navigate('Settings' as never), [navigation]);

  return (
    <View style={styles.container}>
      <AmbientGlow />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + SIZES.md, paddingBottom: SIZES.bottomInset },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          title="You"
          kicker="Your world of sound"
          right={
            <SpringPressable
              style={styles.settingsBtn}
              pressScale={0.9}
              onPress={openSettings}
              accessibilityRole="button"
              accessibilityLabel="Settings"
            >
              <SettingsIcon color={COLORS.text.primary} size={SIZES.icon.md} />
            </SpringPressable>
          }
        />

        {/* Identity card: avatar, level ring, streak */}
        <FadeInUp index={0}>
          <GlassView weight="thin" accent style={styles.identityCard}>
            <LinearGradient
              colors={GRADIENTS.aurora}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.identityAvatar}
            >
              <Text style={styles.identityInitial}>{firstName[0].toUpperCase()}</Text>
            </LinearGradient>

            <View style={styles.identityText}>
              <Text style={styles.identityName}>{firstName}</Text>
              <View style={styles.identityMetaRow}>
                <View style={styles.levelChip}>
                  <Sparkles color={COLORS.accent.primary} size={12} />
                  <Text style={styles.levelText}>
                    Lvl {eng.level} · {eng.levelName}
                  </Text>
                </View>
                {eng.streakActive && eng.streak > 0 ? (
                  <View style={[styles.levelChip, styles.streakChip]}>
                    <Flame color="#FF8A3D" size={12} fill="rgba(255,138,61,0.3)" />
                    <Text style={[styles.levelText, { color: '#FF8A3D' }]}>{eng.streak}d</Text>
                  </View>
                ) : null}
              </View>

              {/* Level progress */}
              <View style={styles.levelBarWrap}>
                <View style={styles.levelBar}>
                  <View style={[styles.levelFill, { width: `${Math.round(eng.levelProgress * 100)}%` }]} />
                </View>
                <Text style={styles.levelHint}>
                  {eng.levelInto}/{eng.levelSpan} XP to level {eng.level + 1}
                </Text>
              </View>
            </View>
          </GlassView>
        </FadeInUp>

        {/* Stat strip */}
        <FadeInUp index={1}>
          <View style={styles.statStrip}>
            <StatCell icon={<Clock color={COLORS.accent.primary} size={16} />} value={`${eng.totalHours}h`} label="listened" />
            <StatCell icon={<Heart color={COLORS.accent.primary} size={16} />} value={`${liked.length}`} label="liked" />
            <StatCell icon={<ListMusic color={COLORS.accent.primary} size={16} />} value={`${playlists.length}`} label="playlists" />
            <StatCell icon={<Download color={COLORS.accent.primary} size={16} />} value={`${downloadCount}`} label="saved" />
          </View>
        </FadeInUp>

        {/* Featured actions */}
        <FadeInUp index={2}>
          <ActionRow
            gradient={GRADIENTS.midnight}
            Icon={BarChart3}
            title="Monthly Wrapped"
            subtitle={eng.state.lastListenDay ? 'See your listening story' : 'Listen a little, then look'}
            onPress={openWrapped}
            badge={eng.totalHours > 0 ? 'NEW' : undefined}
          />
        </FadeInUp>

        <FadeInUp index={3}>
          <ActionRow
            gradient={GRADIENTS.sunset}
            Icon={Trophy}
            title="Stats & Badges"
            subtitle={`${eng.earnedBadges.length} badges earned · ${eng.minutesToday}m today`}
            onPress={openStats}
          />
        </FadeInUp>

        {/* Badge preview */}
        {eng.earnedBadges.length > 0 ? (
          <FadeInUp index={4}>
            <GlassView weight="thin" style={styles.badgePreview}>
              <View style={styles.badgePreviewHeader}>
                <Text style={styles.sectionTitle}>Latest badges</Text>
                <TouchableOpacity onPress={openStats} hitSlop={8}>
                  <Text style={styles.seeAll}>See all</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.badgeRow}>
                {eng.earnedBadges.slice(-4).map((badge) => {
                  const tier = badgeTierMeta(badge.tier);
                  return (
                    <View key={badge.id} style={styles.badgeCell}>
                      <View style={[styles.badgeDot, { borderColor: tier.color }]}>
                        <Trophy color={tier.color} size={15} />
                      </View>
                      <Text style={styles.badgeName} numberOfLines={1}>
                        {badge.name}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </GlassView>
          </FadeInUp>
        ) : null}

        {/* Library shortcuts */}
        <FadeInUp index={5}>
          <GlassView weight="thin" style={styles.listCard}>
            <ListAction
              Icon={Clock}
              label="Listening history"
              detail={`${history.length} plays logged`}
              onPress={openHistory}
            />
            <ListAction
              Icon={Download}
              label="Downloads & storage"
              detail={`${downloadCount} tracks offline`}
              onPress={() => navigation.navigate('Downloads' as never)}
            />
            <ListAction
              Icon={SettingsIcon}
              label="Settings"
              detail="AI, audio, playback"
              onPress={openSettings}
              last
            />
          </GlassView>
        </FadeInUp>
      </ScrollView>

      <StatusBarScrim />

      {currentTrack && (
        <MiniPlayer
          track={currentTrack}
          isPlaying={isPlaying}
          isLoading={isLoading}
          onPlayPause={togglePlayPause}
          onPress={() => navigation.navigate('NowPlaying' as never)}
        />
      )}
    </View>
  );
}

const StatCell: React.FC<{ icon: React.ReactNode; value: string; label: string }> = ({ icon, value, label }) => (
  <View style={styles.statCell}>
    {icon}
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const ActionRow: React.FC<{
  gradient: readonly [string, string];
  Icon: typeof BarChart3;
  title: string;
  subtitle: string;
  onPress: () => void;
  badge?: string;
}> = ({ gradient, Icon, title, subtitle, onPress, badge }) => (
  <SpringPressable style={styles.actionCard} pressScale={0.975} onPress={onPress}
    accessibilityRole="button" accessibilityLabel={title}>
    <LinearGradient
      colors={gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
    <LinearGradient
      colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.35)']}
      start={{ x: 0.5, y: 0.2 }}
      end={{ x: 0.5, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
    <View style={styles.actionIcon}>
      <Icon color="#FFFFFF" size={24} />
    </View>
    <View style={styles.actionText}>
      <View style={styles.actionTitleRow}>
        <Text style={styles.actionTitle}>{title}</Text>
        {badge ? (
          <View style={styles.badgeChip}>
            <Text style={styles.badgeChipText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.actionSubtitle} numberOfLines={1}>{subtitle}</Text>
    </View>
    <ChevronRight color="rgba(255,255,255,0.8)" size={20} />
  </SpringPressable>
);

const ListAction: React.FC<{
  Icon: typeof Clock;
  label: string;
  detail: string;
  onPress: () => void;
  last?: boolean;
}> = ({ Icon, label, detail, onPress, last }) => (
  <TouchableOpacity
    style={[styles.listAction, !last && styles.listActionBorder]}
    activeOpacity={0.7}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
  >
    <View style={styles.listActionIcon}>
      <Icon color={COLORS.text.secondary} size={SIZES.icon.md - 2} />
    </View>
    <Text style={styles.listActionLabel}>{label}</Text>
    <Text style={styles.listActionDetail} numberOfLines={1}>{detail}</Text>
    <ChevronRight color={COLORS.text.muted} size={16} />
  </TouchableOpacity>
);

/** Shared tokens (hoisted so styles can reference them). */
const GLASS_R = 20;
const SHADOW_AMBIENT = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.35,
  shadowRadius: 14,
  elevation: 6,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    paddingHorizontal: SIZES.gutter,
  },
  settingsBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Identity card
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.md,
    padding: SIZES.md + 2,
    marginTop: SIZES.lg,
    marginBottom: SIZES.md,
  },
  identityAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityInitial: {
    fontFamily: FONTS.bold,
    fontSize: TYPE.title2.fontSize,
    color: '#FFFFFF',
  },
  identityText: {
    flex: 1,
  },
  identityName: {
    fontFamily: FONTS.bold,
    fontSize: TYPE.title3.fontSize,
    color: COLORS.text.primary,
  },
  identityMetaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  levelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.accent.soft,
    borderWidth: 1,
    borderColor: COLORS.accent.border,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  streakChip: {
    backgroundColor: 'rgba(255,138,61,0.10)',
    borderColor: 'rgba(255,138,61,0.3)',
  },
  levelText: {
    fontFamily: FONTS.semibold,
    fontSize: TYPE.micro.fontSize,
    color: COLORS.accent.primary,
  },
  levelBarWrap: {
    marginTop: 10,
  },
  levelBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  levelFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: COLORS.accent.primary,
  },
  levelHint: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.micro.fontSize,
    color: COLORS.text.muted,
    marginTop: 4,
  },

  // Stat strip
  statStrip: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius.md,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    paddingVertical: SIZES.md,
    marginBottom: SIZES.md,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  statValue: {
    fontFamily: FONTS.bold,
    fontSize: TYPE.title3.fontSize,
    color: COLORS.text.primary,
  },
  statLabel: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.micro.fontSize,
    color: COLORS.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Action cards
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.md,
    borderRadius: GLASS_R,
    overflow: 'hidden',
    padding: SIZES.md + 2,
    marginBottom: SIZES.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    ...SHADOW_AMBIENT,
  },
  actionIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    flex: 1,
  },
  actionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionTitle: {
    fontFamily: FONTS.bold,
    fontSize: TYPE.headline.fontSize,
    color: '#FFFFFF',
  },
  badgeChip: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeChipText: {
    fontFamily: FONTS.bold,
    fontSize: 9,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  actionSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.footnote.fontSize,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },

  // Badge preview
  badgePreview: {
    padding: SIZES.md + 2,
    marginBottom: SIZES.md,
  },
  badgePreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.md,
  },
  sectionTitle: {
    fontFamily: FONTS.semibold,
    fontSize: TYPE.headline.fontSize,
    color: COLORS.text.primary,
  },
  seeAll: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.accent.primary,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  badgeCell: {
    alignItems: 'center',
    flex: 1,
  },
  badgeDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeName: {
    fontFamily: FONTS.medium,
    fontSize: 10,
    color: COLORS.text.secondary,
    marginTop: 6,
  },

  // List card
  listCard: {
    marginBottom: SIZES.md,
  },
  listAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.md,
    paddingVertical: 14,
    paddingHorizontal: SIZES.md + 2,
  },
  listActionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hairline,
  },
  listActionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listActionLabel: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.text.primary,
  },
  listActionDetail: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.text.muted,
  },
});
