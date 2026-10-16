import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  Search,
  Play,
  Heart,
  Compass,
  Moon,
  Target,
  User,
  Flame,
  Sparkles,
  Dumbbell,
  Headphones,
  PartyPopper,
  Sunrise,
  CloudRain,
  Car,
  Radio,
  SlidersHorizontal,
  ChevronRight,
  Repeat2,
  Bot,
  Podcast,
} from 'lucide-react-native';
import { COLORS, SIZES, FONTS, TYPE, SHADOWS, MOOD_PALETTE, MoodId } from '../constants/theme';
import { Artwork } from '../components/common/Artwork';
import { SectionHeader, SkeletonList, ErrorState } from '../components/common/UI';
import { ScreenHeader, MenuButton } from '../components/common/ScreenHeader';
import { TrackRow } from '../components/lists/TrackRow';
import { TrackActionsHost } from '../components/lists/TrackActionsHost';
import { GlassView, SpringPressable, FadeInUp, PulsingGlow } from '../components/common/Glass';
import { Track } from '../core/types';
import { usePlayer } from '../hooks/usePlayer';
import { useLibrary } from '../hooks/useLibrary';
import { useEngagement } from '../hooks/useEngagement';
import { MusicService } from '../services/MusicService';
import { recommendationEngine } from '../ai/RecommendationEngine';
import { tasteProfile } from '../ai/TasteProfile';
import { MOODS } from '../ai/moods';
import { MiniPlayer } from '../components/player/MiniPlayer';
import { StatusBarScrim } from '../components/common/StatusBarScrim';
import { AmbientGlow } from '../components/common/AmbientGlow';

/** Home filter chips, per the reference: Music default-selected. */
const CHIP_DEFS = [
  { id: 'music', label: 'Music' },
  { id: 'podcasts', label: 'Podcasts' },
  { id: 'radio', label: 'Radio' },
] as const;

const MOOD_ICONS: Record<MoodId, typeof Dumbbell> = {
  workout: Dumbbell,
  focus: Target,
  chill: Moon,
  latenight: Sunrise,
  party: PartyPopper,
  emotional: CloudRain,
  commute: Car,
  romance: Heart,
};

/**
 * Home — the daily front door.
 *
 * Above the fold: greeting with the streak flame, the cinematic featured
 * card, and "Made for you" — the AI's three flagship surfaces (Discovery
 * Mix, On Repeat, Ask AI). Below: mood radios and continue listening.
 */
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { playTrack, currentTrack, isPlaying, togglePlayPause, isLoading } = usePlayer();
  const { recentlyPlayed, liked, profile } = useLibrary();
  const { streak, streakActive } = useEngagement();

  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [featured, setFeatured] = useState<Track[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Made-for-you state.
  const [discover, setDiscover] = useState<Track[]>([]);
  const [onRepeat, setOnRepeat] = useState<Track[]>([]);
  const [mixLoading, setMixLoading] = useState(true);
  const [repeatLoading, setRepeatLoading] = useState(true);
  const [suggestedMood, setSuggestedMood] = useState<{ id: MoodId; reason: string } | null>(null);
  const [coldStart, setColdStart] = useState(true);

  const hasRecents = recentlyPlayed.length > 0;

  // Outlive async work: never touch state after the screen is gone.
  const alive = React.useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    []
  );

  const loadHome = useCallback(async (): Promise<void> => {
    try {
      // Featured card + made-for-you load together; each is independently
      // replaceable so one failure never blanks the page.
      const [featuredRes, discoverRes, mood] = await Promise.all([
        MusicService.search('calm ambient evening', { limit: 10 }).catch(() => null),
        recommendationEngine.generateDiscoveryMix().catch(() => []),
        recommendationEngine.suggestedMood().catch(() => null),
      ]);

      if (!alive.current) return;
      if (featuredRes) setFeatured(featuredRes.tracks);
      setDiscover(discoverRes);
      setSuggestedMood(mood);
      setLoadError(!featuredRes);
    } catch {
      if (alive.current) setLoadError(true);
    } finally {
      if (alive.current) {
        setFeaturedLoading(false);
        setMixLoading(false);
      }
    }
  }, []);

  // On Repeat is derived from history; refresh it whenever the screen mounts.
  useEffect(() => {
    void loadHome();
    void tasteProfile
      .load()
      .catch(() => undefined)
      .then(() => {
        if (!alive.current) return;
        setColdStart(tasteProfile.isColdStart);
        return recommendationEngine
          .generateRepeatFavorites()
          .then((rows) => {
            if (alive.current) setOnRepeat(rows);
          })
          .catch(() => undefined)
          .finally(() => {
            if (alive.current) setRepeatLoading(false);
          });
      });
  }, [loadHome]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadHome();
      // "On Repeat" is derived from history — pull it too so pull-to-refresh
      // actually refreshes the whole page.
      const rows = await recommendationEngine.generateRepeatFavorites();
      if (alive.current) setOnRepeat(rows);
    } catch {
      // loadHome already routes its own failure state.
    } finally {
      if (alive.current) setRefreshing(false);
    }
  }, [loadHome]);

  const runAction = useCallback(
    async (id: string, label: string, pool: Track[] | null, query: string | null) => {
      if (pool) {
        if (pool.length) playTrack(pool[0], { tracks: pool, label });
        return;
      }
      if (!query) return;

      setPendingAction(id);
      try {
        const results = await MusicService.search(query, { limit: 25 });
        if (results.tracks.length) playTrack(results.tracks[0], { tracks: results.tracks, label });
      } catch {
        // Silent: the tile simply stops spinning.
      } finally {
        setPendingAction(null);
      }
    },
    [playTrack]
  );

  const playFeatured = useCallback(() => {
    if (!featured.length) return;
    playTrack(featured[0], { tracks: featured, label: 'Made for you' });
  }, [featured, playTrack]);

  const openMoodRadio = useCallback(
    (moodId: MoodId) => {
      (navigation.navigate as (name: string, params?: object) => void)('MoodRadios', { moodId });
    },
    [navigation]
  );

  const recentTracks = recentlyPlayed.slice(0, 3);
  const [addingTrack, setAddingTrack] = useState<Track | null>(null);

  // Filter chips (Music / Podcasts / Radio). Radio scrolls to the mood
  // radios; Podcasts shows an honest "on the way" card; Music is the feed.
  const [activeChip, setActiveChip] = useState<'music' | 'podcasts' | 'radio'>('music');
  /** Y of the mood-radios section within the scroll content (layout-driven). */
  const moodYRef = useRef(0);
  const scrollRef = useRef<ScrollView>(null);

  const pressChip = useCallback(
    (id: 'music' | 'podcasts' | 'radio') => {
      setActiveChip(id);
      if (id === 'music') scrollRef.current?.scrollTo({ y: 0, animated: true });
      if (id === 'radio') {
        // The section may have just remounted (Podcasts unmounts the feed),
        // so wait one layout pass before reading its measured Y.
        requestAnimationFrame(() =>
          requestAnimationFrame(() =>
            scrollRef.current?.scrollTo({ y: Math.max(0, moodYRef.current - 12), animated: true })
          )
        );
      }
    },
    []
  );

  const playLiked = useCallback(() => {
    if (liked.length) playTrack(liked[0], { tracks: liked, label: 'Liked Songs' });
    else (navigation.navigate as (name: string, params?: object) => void)('LibraryTab');
  }, [liked, playTrack, navigation]);

  const featuredTrack = featured[0];
  const firstName = profile.name?.trim() || 'there';
  const greeting = greetingFor(new Date().getHours());

  return (
    <View style={styles.container}>
      <AmbientGlow />

      {/* Pinned: greeting + search */}
      <View style={[styles.stickyHeader, { paddingTop: insets.top + SIZES.md }]}>
        <ScreenHeader
          kicker={greeting}
          title={firstName}
          left={<MenuButton />}
          right={
            <View style={styles.headerRight}>
              {streakActive && streak > 0 ? (
                <FadeInUp index={0}>
                  <SpringPressable
                    style={styles.streakChip}
                    pressScale={0.94}
                    onPress={() => navigation.navigate('Stats' as never)}
                    accessibilityRole="button"
                    accessibilityLabel={`${streak} day streak`}
                  >
                    <Flame color={COLORS.warm.primary} size={15} fill={COLORS.warm.soft} />
                    <Text style={styles.streakCount}>{streak}</Text>
                  </SpringPressable>
                </FadeInUp>
              ) : null}
              <SpringPressable
                style={styles.avatar}
                pressScale={0.9}
                onPress={() => navigation.navigate('Settings' as never)}
                accessibilityRole="button"
                accessibilityLabel="Open settings"
              >
                {profile.name?.trim() ? (
                  <Text style={styles.avatarInitial}>{profile.name.trim()[0].toUpperCase()}</Text>
                ) : (
                  <User color={COLORS.accent.primary} size={SIZES.icon.lg - 2} />
                )}
              </SpringPressable>
            </View>
          }
        />

        <TouchableOpacity
          style={styles.searchBar}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('SearchTab' as never)}
          accessibilityRole="button"
          accessibilityLabel="Search songs, artists and albums"
        >
          <Search color={COLORS.text.secondary} size={SIZES.icon.md - 2} strokeWidth={2.2} />
          <Text style={styles.searchText}>Songs, artists, moods, vibes...</Text>
          <SlidersHorizontal
            color={COLORS.accent.primary}
            size={SIZES.icon.sm}
            strokeWidth={2.1}
            style={{ marginLeft: 'auto' }}
          />
        </TouchableOpacity>

        {/* Filter chips — Music selected by default, per the reference. */}
        <View style={styles.chipRow}>
          {CHIP_DEFS.map((chip) => {
            const active = activeChip === chip.id;
            return (
              <SpringPressable
                key={chip.id}
                style={[styles.chip, active && styles.chipActive]}
                pressScale={0.94}
                onPress={() => pressChip(chip.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${chip.label} filter`}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {chip.label}
                </Text>
              </SpringPressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: SIZES.bottomInset }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.text.secondary}
            colors={[COLORS.accent.primary]}
          />
        }
      >
        {activeChip === 'podcasts' ? (
          /* Podcasts chip: an honest empty state — Arkify has no podcast
             catalogue yet, so the chip says so instead of faking content. */
          <FadeInUp index={1}>
            <View style={styles.podcastsCard}>
              <View style={styles.podcastsIconWrap}>
                <Podcast color={COLORS.accent.primary} size={24} strokeWidth={1.9} />
              </View>
              <Text style={styles.podcastsTitle}>Podcasts are on the way</Text>
              <Text style={styles.podcastsHint}>
                Arkify is tuned for music right now. Arkify AI can soundtrack
                anything in the meantime.
              </Text>
              <SpringPressable
                style={styles.podcastsCta}
                pressScale={0.95}
                onPress={() =>
                  (navigation.navigate as (name: string, params?: object) => void)('AIPlaylist')
                }
                accessibilityRole="button"
                accessibilityLabel="Try Arkify AI"
              >
                <Text style={styles.podcastsCtaText}>Try Arkify AI</Text>
              </SpringPressable>
            </View>
          </FadeInUp>
        ) : (
          <>
        {/* Featured — cinematic, liquid-glowing */}
        {featuredLoading ? (
          <View style={[styles.featuredCard, styles.featuredSkeleton]}>
            <SkeletonList rows={1} />
          </View>
        ) : featuredTrack ? (
          <FadeInUp index={1}>
            <SpringPressable
              style={[styles.featuredCard, SHADOWS.ambient]}
              pressScale={0.985}
              onPress={playFeatured}
              accessibilityRole="button"
              accessibilityLabel={`Play featured: ${featuredTrack.title} by ${featuredTrack.artist.name}`}
            >
              {featuredTrack.albumImageUrl ? (
                <Image
                  source={{ uri: featuredTrack.albumImageUrl }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                />
              ) : null}
              <LinearGradient
                colors={['rgba(4, 10, 11, 0.42)', 'rgba(4, 10, 11, 0.84)', 'rgba(3, 9, 10, 0.95)']}
                locations={[0, 0.55, 1]}
                style={StyleSheet.absoluteFill}
              />
              <LinearGradient
                colors={['rgba(59, 240, 223, 0.16)', 'rgba(59, 240, 223, 0)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />

              <View style={styles.featuredOverlay}>
                <View style={styles.featuredText}>
                  <View style={styles.featuredKicker}>
                    <Sparkles color={COLORS.accent.primary} size={12} />
                    <Text style={styles.featuredKickerText}>FEATURED</Text>
                  </View>
                  <Text style={styles.featuredTitle}>Let the music{'\n'}find you</Text>
                  <Text style={styles.featuredSub}>Discover · Listen · Feel</Text>
                </View>
                <View style={styles.featuredPlayBtn}>
                  <Play color={COLORS.accent.primary} size={SIZES.icon.md} fill={COLORS.accent.primary} />
                </View>
              </View>
            </SpringPressable>
          </FadeInUp>
        ) : loadError ? (
          <ErrorState
            message="Couldn't load suggestions."
            retryLabel="Pull down to retry"
            style={styles.featuredError}
          />
        ) : null}

        {/* ---------------- Quick access ---------------- */}
        <SectionHeader title="Quick access" />
        <View style={styles.quickRow}>
          <FadeInUp index={1} style={styles.quickCell}>
            <SpringPressable
              style={styles.quickTile}
              pressScale={0.93}
              onPress={playLiked}
              accessibilityRole="button"
              accessibilityLabel="Play your liked songs"
            >
              <View style={styles.quickIconWrap}>
                <Heart color={COLORS.accent.primary} size={20} strokeWidth={2} />
              </View>
              <Text style={styles.quickLabel}>Liked</Text>
            </SpringPressable>
          </FadeInUp>

          <FadeInUp index={2} style={styles.quickCell}>
            <SpringPressable
              style={styles.quickTile}
              pressScale={0.93}
              onPress={() => runAction('discover', 'Discovery Mix', discover, null)}
              accessibilityRole="button"
              accessibilityLabel="Play your discovery mix"
            >
              <View style={styles.quickIconWrap}>
                {pendingAction === 'discover' ? (
                  <ActivityIndicator color={COLORS.accent.primary} size="small" />
                ) : (
                  <Compass color={COLORS.accent.primary} size={20} strokeWidth={2} />
                )}
              </View>
              <Text style={styles.quickLabel}>Discover</Text>
            </SpringPressable>
          </FadeInUp>

          <FadeInUp index={3} style={styles.quickCell}>
            <SpringPressable
              style={styles.quickTile}
              pressScale={0.93}
              onPress={() => openMoodRadio('chill')}
              accessibilityRole="button"
              accessibilityLabel="Start Chill radio"
            >
              <View style={styles.quickIconWrap}>
                <Moon color={COLORS.accent.primary} size={20} strokeWidth={2} />
              </View>
              <Text style={styles.quickLabel}>Chill</Text>
            </SpringPressable>
          </FadeInUp>

          <FadeInUp index={4} style={styles.quickCell}>
            <SpringPressable
              style={styles.quickTile}
              pressScale={0.93}
              onPress={() => openMoodRadio('focus')}
              accessibilityRole="button"
              accessibilityLabel="Start Focus radio"
            >
              <View style={styles.quickIconWrap}>
                <Target color={COLORS.accent.primary} size={20} strokeWidth={2} />
              </View>
              <Text style={styles.quickLabel}>Focus</Text>
            </SpringPressable>
          </FadeInUp>
        </View>

        {/* ---------------- Made for you (AI) ---------------- */}
        <SectionHeader
          title="Made for you"
          actionLabel="Arkify AI"
          onAction={() => navigation.navigate('AIPlaylist' as never)}
        />

        <View style={styles.mixRow}>
          <FadeInUp index={2} style={styles.mixCardWrap}>
            <MixCard
              title="Discovery Mix"
              subtitle={coldStart ? 'Trending picks to start' : 'Fresh music, your taste'}
              gradient={['#3BF0DF', '#5B8DEF']}
              Icon={Compass}
              loading={mixLoading && !discover.length}
              tracks={discover}
              onPress={() =>
                runAction('discover', 'Discovery Mix', discover, null)
              }
            />
          </FadeInUp>

          <FadeInUp index={3} style={styles.mixCardWrap}>
            <MixCard
              title="On Repeat"
              subtitle={coldStart ? 'Plays will land here' : 'The songs you loop'}
              gradient={['#FF8A5C', '#FF4E8E']}
              Icon={Repeat2}
              loading={repeatLoading && !onRepeat.length}
              tracks={onRepeat.length ? onRepeat : recentlyPlayed.slice(0, 20)}
              onPress={() =>
                runAction('repeat', 'On Repeat', onRepeat.length ? onRepeat : recentlyPlayed.slice(0, 20), null)
              }
            />
          </FadeInUp>
        </View>

        {/* Ask AI card */}
        <FadeInUp index={4}>
          <SpringPressable
            style={styles.askAICard}
            pressScale={0.98}
            glow
            onPress={() => navigation.navigate('AIPlaylist' as never)}
            accessibilityRole="button"
            accessibilityLabel="Ask Arkify AI for a playlist"
          >
            <PulsingGlow size={130} color="rgba(59, 240, 223, 0.16)" style={styles.askAIGlow} />
            <View style={styles.askAIIcon}>
              <Bot color={COLORS.accent.primary} size={26} />
            </View>
            <View style={styles.askAIText}>
              <Text style={styles.askAITitle}>Ask Arkify AI anything</Text>
              <Text style={styles.askAISub} numberOfLines={1}>
                "gym energy" · "3am heartbreak" · "study flow"
              </Text>
            </View>
            <ChevronRight color={COLORS.text.muted} size={SIZES.icon.md} />
          </SpringPressable>
        </FadeInUp>

        {/* ---------------- Mood radios ---------------- */}
        <View
          onLayout={(e) => {
            moodYRef.current = e.nativeEvent.layout.y;
          }}
        >
        <SectionHeader
          title="Made for this moment"
          actionLabel={suggestedMood ? undefined : 'All radios'}
          onAction={suggestedMood ? undefined : () => navigation.navigate('MoodRadios' as never)}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.moodScroll}
        >
          {MOODS.slice(0, 6).map((mood, i) => {
            const palette = MOOD_PALETTE[mood.id];
            const Icon = MOOD_ICONS[mood.id];
            const isSuggested = suggestedMood?.id === mood.id;

            return (
              <FadeInUp key={mood.id} index={5 + i}>
                <SpringPressable
                  style={[styles.moodCard, { width: isSuggested ? 172 : 148 }]}
                  pressScale={0.95}
                  onPress={() => openMoodRadio(mood.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Start ${mood.name} radio`}
                >
                  <LinearGradient
                    colors={palette.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <LinearGradient
                    colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.45)']}
                    start={{ x: 0.5, y: 0.2 }}
                    end={{ x: 0.5, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  {isSuggested ? (
                    <View style={styles.moodNowChip}>
                      <Text style={styles.moodNowText}>NOW</Text>
                    </View>
                  ) : null}
                  <View style={styles.moodCardTop}>
                    <Icon color="#FFFFFF" size={22} />
                  </View>
                  <View>
                    <Text style={styles.moodCardName}>{mood.name}</Text>
                    <Text style={styles.moodCardTag} numberOfLines={1}>
                      {isSuggested ? suggestedMood!.reason : mood.tagline}
                    </Text>
                  </View>
                </SpringPressable>
              </FadeInUp>
            );
          })}

          {/* See-all card */}
          <FadeInUp index={11}>
            <SpringPressable
              style={[styles.moodCard, styles.moodMoreCard]}
              pressScale={0.95}
              onPress={() => navigation.navigate('MoodRadios' as never)}
              accessibilityRole="button"
              accessibilityLabel="All mood radios"
            >
              <Headphones color={COLORS.text.secondary} size={20} />
              <Text style={styles.moodMoreText}>All{'\n'}radios</Text>
            </SpringPressable>
          </FadeInUp>
        </ScrollView>
        </View>

        {/* ---------------- Continue listening ---------------- */}
        <SectionHeader
          title="Continue listening"
          actionLabel="Your library"
          onAction={() => navigation.navigate('LibraryTab' as never)}
        />

        {hasRecents ? (
          recentTracks.map((track, i) => (
            <FadeInUp key={track.id} index={12 + i} preset="fast">
              <TrackRow
                track={track}
                onPress={(t) => playTrack(t, { tracks: recentTracks, label: 'Recently Played' })}
                onMorePress={setAddingTrack}
                isPlaying={currentTrack?.id === track.id && isPlaying}
              />
            </FadeInUp>
          ))
        ) : (
          <View style={styles.emptyRow}>
            <View style={styles.emptyIconWrap}>
              <User color={COLORS.text.secondary} size={SIZES.icon.md} />
            </View>
            <View style={styles.emptyText}>
              <Text style={styles.emptyTitle}>No recent audio yet</Text>
              <Text style={styles.emptyHint}>Play something and it will appear here.</Text>
            </View>
          </View>
        )}
          </>
        )}
      </ScrollView>

      <StatusBarScrim />

      <TrackActionsHost track={addingTrack} onClose={() => setAddingTrack(null)} />

      {currentTrack && (
        <MiniPlayer
          track={currentTrack}
          isPlaying={isPlaying}
          isLoading={isLoading}
          onPlayPause={togglePlayPause}
          onPress={() => {
            navigation.navigate('NowPlaying' as never);
          }}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------

/** Compact "mix" card — Discovery / On Repeat. */
const MixCard: React.FC<{
  title: string;
  subtitle: string;
  gradient: readonly [string, string];
  Icon: typeof Compass;
  loading: boolean;
  tracks: Track[];
  onPress: () => void;
}> = ({ title, subtitle, gradient, Icon, loading, tracks, onPress }) => (
  <SpringPressable style={styles.mixCard} pressScale={0.96} onPress={onPress}
    accessibilityRole="button" accessibilityLabel={`${title}: play`}>
    <LinearGradient
      colors={gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
    <LinearGradient
      colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.5)']}
      start={{ x: 0.5, y: 0.25 }}
      end={{ x: 0.5, y: 1 }}
      style={StyleSheet.absoluteFill}
    />

    {loading ? (
      <ActivityIndicator color="#FFFFFF" size="small" style={styles.mixIcon} />
    ) : (
      <View style={styles.mixIcon}>
        <Icon color="#FFFFFF" size={20} />
      </View>
    )}

    {/* Artwork strip from the mix */}
    {tracks.length ? (
      <View style={styles.mixArtRow}>
        {tracks.slice(0, 3).map((t) => (
          <Artwork key={t.id} uri={t.albumImageUrl} size={26} radius={6} style={styles.mixArt} />
        ))}
      </View>
    ) : null}

    <View style={styles.mixFooter}>
      <Text style={styles.mixTitle}>{title}</Text>
      <Text style={styles.mixSub} numberOfLines={1}>{subtitle}</Text>
    </View>
  </SpringPressable>
);

/** Shared tokens for this screen (hoisted so styles can reference them). */
const GLASS_RADIUS = 20;
const GLASS_BG = 'rgba(18, 24, 24, 0.55)';

const greetingFor = (hour: number) =>
  hour < 12 ? 'Good morning,' : hour < 18 ? 'Good afternoon,' : 'Good evening,';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: SIZES.gutter,
    paddingTop: SIZES.md,
  },
  stickyHeader: {
    paddingHorizontal: SIZES.gutter,
    paddingBottom: SIZES.sm,
    backgroundColor: COLORS.background,
    zIndex: 20,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 138, 61, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 61, 0.35)',
  },
  streakCount: {
    fontFamily: FONTS.bold,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.warm.primary,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(59, 240, 223, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(59, 240, 223, 0.55)',
  },
  avatarInitial: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.title3.fontSize,
    color: COLORS.accent.primary,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: SIZES.radius.pill,
    paddingHorizontal: SIZES.md,
    height: 48,
    marginTop: SIZES.md,
    marginBottom: SIZES.sm,
  },
  searchText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.text.muted,
    marginLeft: SIZES.sm,
  },

  // Filter chips (Music / Podcasts / Radio) — the reference's pill row.
  chipRow: {
    flexDirection: 'row',
    gap: SIZES.sm + 2,
    marginTop: SIZES.xs + 2,
    marginBottom: SIZES.xs,
  },
  chip: {
    height: 38,
    paddingHorizontal: 18,
    borderRadius: SIZES.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.hairline,
  },
  /** Selected chip: solid aqua fill with dark ink, exactly per the reference. */
  chipActive: {
    backgroundColor: COLORS.accent.primary,
    borderColor: COLORS.accent.primary,
  },
  chipText: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.text.soft,
  },
  chipTextActive: {
    fontFamily: FONTS.semibold,
    color: COLORS.text.dark,
  },

  // Quick access — four glass tiles under the featured card.
  quickRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: SIZES.xl,
  },
  quickCell: {
    flex: 1,
  },
  quickTile: {
    height: 92,
    borderRadius: SIZES.radius.md + 2,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  quickIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.accent.soft,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.text.soft,
  },

  // Podcasts chip — honest "on the way" card.
  podcastsCard: {
    borderRadius: SIZES.radius.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    padding: SIZES.xl,
    alignItems: 'center',
    marginTop: SIZES.xs,
  },
  podcastsIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: 'rgba(59, 240, 223, 0.40)',
    backgroundColor: 'rgba(59, 240, 223, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SIZES.md,
  },
  podcastsTitle: {
    fontFamily: FONTS.semibold,
    fontSize: TYPE.title3.fontSize,
    fontWeight: '700',
    color: COLORS.text.primary,
    textAlign: 'center',
  },
  podcastsHint: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.subheadline.fontSize,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginTop: SIZES.sm,
    lineHeight: 19,
  },
  podcastsCta: {
    marginTop: SIZES.lg,
    height: 44,
    paddingHorizontal: 28,
    borderRadius: SIZES.radius.pill,
    backgroundColor: COLORS.accent.soft,
    borderWidth: 1,
    borderColor: COLORS.accent.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  podcastsCtaText: {
    fontFamily: FONTS.semibold,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.accent.primary,
  },

  // Featured
  featuredCard: {
    height: 168,
    borderRadius: SIZES.radius.lg,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    marginBottom: SIZES.xl,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
  },
  featuredSkeleton: {
    minHeight: 190,
    justifyContent: 'center',
  },
  featuredError: {
    marginBottom: SIZES.lg,
  },
  featuredOverlay: {
    flex: 1,
    padding: SIZES.lg,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  featuredText: {
    flex: 1,
    paddingRight: SIZES.md,
  },
  featuredKicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  featuredKickerText: {
    fontFamily: FONTS.bold,
    fontSize: TYPE.micro.fontSize,
    color: COLORS.accent.primary,
    letterSpacing: 2.5,
  },
  featuredTitle: {
    fontFamily: FONTS.bold,
    fontSize: TYPE.title2.fontSize,
    lineHeight: TYPE.title2.lineHeight + 2,
    color: COLORS.text.primary,
  },
  featuredSub: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.subheadline.fontSize,
    color: COLORS.text.secondary,
    marginTop: SIZES.sm,
  },
  featuredPlayBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: COLORS.accent.ring,
    backgroundColor: COLORS.accent.soft,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.accent.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 6,
  },

  // Made for you
  mixRow: {
    flexDirection: 'row',
    gap: SIZES.md,
    marginBottom: SIZES.md,
  },
  mixCardWrap: {
    flex: 1,
  },
  mixCard: {
    height: 148,
    borderRadius: GLASS_RADIUS,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
    padding: SIZES.md,
    justifyContent: 'space-between',
    ...SHADOWS.ambient,
  },
  mixIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mixArtRow: {
    flexDirection: 'row',
    gap: 4,
  },
  mixArt: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  mixFooter: {},
  mixTitle: {
    fontFamily: FONTS.bold,
    fontSize: TYPE.headline.fontSize,
    color: '#FFFFFF',
  },
  mixSub: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.footnote.fontSize,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 1,
  },

  // Ask AI
  askAICard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.md,
    borderRadius: GLASS_RADIUS,
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    padding: SIZES.md,
    marginBottom: SIZES.xl,
    overflow: 'hidden',
  },
  askAIGlow: {
    position: 'absolute',
    left: -20,
    top: -30,
  },
  askAIIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.accent.soft,
    borderWidth: 1,
    borderColor: COLORS.accent.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  askAIText: {
    flex: 1,
  },
  askAITitle: {
    fontFamily: FONTS.semibold,
    fontSize: TYPE.headline.fontSize,
    color: COLORS.text.primary,
  },
  askAISub: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.text.secondary,
    marginTop: 2,
  },

  // Mood radios
  moodScroll: {
    paddingRight: SIZES.gutter,
    marginBottom: SIZES.xl,
    marginLeft: -SIZES.gutter,
    paddingLeft: SIZES.gutter,
  },
  moodCard: {
    height: 132,
    borderRadius: GLASS_RADIUS,
    overflow: 'hidden',
    marginRight: SIZES.md,
    padding: SIZES.md + 2,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    ...SHADOWS.ambient,
  },
  moodNowChip: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  moodNowText: {
    fontFamily: FONTS.bold,
    fontSize: 9,
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  moodCardTop: {
    alignItems: 'flex-start',
  },
  moodCardName: {
    fontFamily: FONTS.bold,
    fontSize: TYPE.headline.fontSize,
    color: '#FFFFFF',
  },
  moodCardTag: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.micro.fontSize,
    color: 'rgba(255,255,255,0.78)',
    marginTop: 1,
  },
  moodMoreCard: {
    backgroundColor: COLORS.surface,
    alignItems: 'flex-start',
  },
  moodMoreText: {
    fontFamily: FONTS.semibold,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.text.primary,
    lineHeight: 19,
  },

  // Empty continue row
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius.md,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    padding: SIZES.md,
  },
  emptyIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    flex: 1,
    marginLeft: SIZES.md,
  },
  emptyTitle: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.text.primary,
  },
  emptyHint: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
});
