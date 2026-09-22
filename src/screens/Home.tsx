import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, SlidersHorizontal, Play, Heart, Compass, Moon, Target, User, ChevronRight } from 'lucide-react-native';
import { COLORS, SIZES, FONTS, TYPE, SHADOWS } from '../constants/theme';
import { Artwork } from '../components/common/Artwork';
import { SectionHeader, SkeletonList, ErrorState, EmptyState } from '../components/common/UI';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { TrackRow } from '../components/lists/TrackRow';
import { AddToPlaylistSheet } from '../components/lists/AddToPlaylistSheet';
import { Track } from '../core/types';
import { FEATURED_QUERY, randomQueryFor } from '../data/catalog';
import { usePlayer } from '../hooks/usePlayer';
import { useLibrary } from '../hooks/useLibrary';
import { MusicService } from '../services/MusicService';
import { MiniPlayer } from '../components/player/MiniPlayer';
import { StatusBarScrim } from '../components/common/StatusBarScrim';
import { useNavigation } from '@react-navigation/native';

/**
 * Home categories are real browse shortcuts: each runs its query on the
 * Search screen instead of flipping local state that changes nothing.
 */
const CATEGORIES: { label: string; query: string }[] = [
  { label: 'Music', query: 'top music hits' },
  { label: 'Podcasts', query: 'podcast episodes' },
  { label: 'Radio', query: 'radio live mix' },
];

/** Each quick action maps to a real query, except Liked which uses the library. */
const ACTIONS = [
  { id: 'liked', label: 'Liked', Icon: Heart, query: null },
  { id: 'discover', label: 'Discover', Icon: Compass, query: 'discover new music' },
  { id: 'chill', label: 'Chill', Icon: Moon, query: 'chill relaxing songs' },
  { id: 'focus', label: 'Focus', Icon: Target, query: 'focus instrumental concentration' },
] as const;

const greetingFor = (hour: number) =>
  hour < 12 ? 'Good morning,' : hour < 18 ? 'Good afternoon,' : 'Good evening,';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { playTrack, currentTrack, isPlaying, togglePlayPause, isLoading } = usePlayer();
  const { recentlyPlayed, liked, profile } = useLibrary();

  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [featured, setFeatured] = useState<Track[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);

  /** Shown before anything has been played: a live pick, not mock data. */
  const [starter, setStarter] = useState<Track[]>([]);
  const [starterError, setStarterError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const hasRecents = recentlyPlayed.length > 0;

  /**
   * Load (or reload) the home feeds: featured card + starter rows.
   *
   * Used by the mount effect and by pull-to-refresh, so a failed first load
   * has a real recovery path instead of a "pull to retry" hint nothing wired
   * up.
   */
  const loadHome = useCallback(async (): Promise<void> => {
    try {
      const results = await MusicService.search(FEATURED_QUERY, { limit: 10 });
      setFeatured(results.tracks);
      setStarter(results.tracks.slice(0, 3));
      setStarterError(false);
    } catch {
      setStarterError(true);
    } finally {
      setFeaturedLoading(false);
    }
  }, []);

  // Prefetch a small starter set in the background so a fresh install is not
  // an empty screen. Cached, so this costs nothing on later launches.
  useEffect(() => {
    void loadHome();
  }, [loadHome]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadHome();
    setRefreshing(false);
  }, [loadHome]);

  const runAction = useCallback(
    async (action: (typeof ACTIONS)[number]) => {
      // A fresh query each tap, so Discover/Chill/Focus do not replay the
      // same results every time.
      const query = randomQueryFor(action.id) ?? action.query;

      if (query === null) {
        // Liked: play straight from the local library, no network needed.
        if (liked.length) playTrack(liked[0], { tracks: liked, label: 'Liked Songs' });
        return;
      }

      setPendingAction(action.id);
      try {
        const results = await MusicService.search(query, { limit: 25 });
        if (results.tracks.length) {
          // Shuffle so even a repeated query starts somewhere else.
          const shuffled = [...results.tracks];
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }
          playTrack(shuffled[0], { tracks: shuffled, label: action.label });
        }
      } catch {
        // Silent: the tile simply stops spinning.
      } finally {
        setPendingAction(null);
      }
    },
    [liked, playTrack]
  );

  const playFeatured = useCallback(() => {
    if (!featured.length) return;
    playTrack(featured[0], { tracks: featured, label: 'Made for you' });
  }, [featured, playTrack]);

  const listTracks = useMemo(
    () => (hasRecents ? recentlyPlayed.slice(0, 3) : starter),
    [hasRecents, recentlyPlayed, starter]
  );

  // One stable callback for the whole list instead of a closure per row.
  const handleTrackPress = useCallback(
    (track: Track) => {
      playTrack(track, {
        tracks: listTracks,
        label: hasRecents ? 'Recently Played' : 'Start Listening',
      });
    },
    [playTrack, listTracks, hasRecents]
  );

  /** Track whose "add to playlist" sheet is open. */
  const [addingTrack, setAddingTrack] = useState<Track | null>(null);

  const featuredTrack = featured[0];
  const firstName = profile.name?.trim() || 'Audia';

  return (
    <View style={styles.container}>
      {/* Pinned: greeting + search stay put while the rest of the page scrolls. */}
      <View style={[styles.stickyHeader, { paddingTop: insets.top + SIZES.md }]}>
        <ScreenHeader
          title={firstName}
          kicker={greetingFor(new Date().getHours())}
          right={
            <TouchableOpacity
              style={styles.avatar}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Settings' as never)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Open settings"
            >
              {profile.name?.trim() ? (
                <Text style={styles.avatarInitial}>{profile.name.trim()[0].toUpperCase()}</Text>
              ) : (
                <User color={COLORS.accent.primary} size={SIZES.icon.lg - 2} />
              )}
            </TouchableOpacity>
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
          <Text style={styles.searchText}>Songs, artists, albums...</Text>
          <View style={styles.searchDivider} />
          <SlidersHorizontal color={COLORS.text.muted} size={SIZES.icon.sm} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: SIZES.bottomInset }
        ]}
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
        {/* Browse shortcuts — real queries on the Search screen. First chip
            (Music) reads active, per the reference. */}
        <View style={styles.pillsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {CATEGORIES.map((cat, i) => (
              <TouchableOpacity
                key={cat.label}
                style={[styles.chip, i === 0 && styles.chipActive]}
                activeOpacity={0.75}
                onPress={() => {
                  (navigation.navigate as (name: string, params?: object) => void)('SearchTab', {
                    browseQuery: cat.query,
                  });
                }}
                accessibilityRole="button"
                accessibilityLabel={`Browse ${cat.label}`}
                accessibilityState={{ selected: i === 0 }}
              >
                <Text style={[styles.chipText, i === 0 && styles.chipTextActive]}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Featured: cinematic artwork-led card. The track's art colours the
            room; text sits on a dark gradient; one teal play FAB. */}
        {featuredLoading ? (
          <View style={[styles.featuredCard, styles.featuredSkeleton]}>
            <SkeletonList rows={1} />
          </View>
        ) : featuredTrack ? (
          <TouchableOpacity
            style={[styles.featuredCard, SHADOWS.ambient]}
            activeOpacity={0.85}
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
              colors={['rgba(6, 10, 10, 0.30)', 'rgba(6, 10, 10, 0.82)', 'rgba(4, 8, 8, 0.95)']}
              locations={[0, 0.55, 1]}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={['rgba(61, 214, 195, 0.14)', 'rgba(61, 214, 195, 0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />

            <View style={styles.featuredOverlay}>
              <View style={styles.featuredText}>
                <Text style={styles.featuredTitle}>Let the music{'\n'}find you</Text>
                <Text style={styles.featuredSub}>Discover · Listen · Feel</Text>
              </View>
              <View style={styles.featuredPlayBtn}>
                <Play color="#04211D" size={SIZES.icon.md} fill="#04211D" />
              </View>
            </View>
          </TouchableOpacity>
        ) : starterError ? (
          <ErrorState
            message="Couldn't load suggestions."
            retryLabel="Pull down to retry"
            style={styles.featuredError}
          />
        ) : null}

        {/* Quick access */}
        <SectionHeader title="Quick access" />
        <View style={styles.actionsRow}>
          {ACTIONS.map((action) => (
            <QuickAccessTile
              key={action.id}
              Icon={action.Icon}
              label={action.label}
              accent={action.id === 'liked'}
              loading={pendingAction === action.id}
              onPress={() => runAction(action)}
            />
          ))}
        </View>

        <SectionHeader
          title="Continue listening"
          actionLabel="Your library"
          onAction={() => navigation.navigate('LibraryTab' as never)}
        />

        {listTracks.length > 0 ? (
          listTracks.map((track) => (
            <TrackRow
              key={track.id}
              track={track}
              onPress={handleTrackPress}
              onMorePress={setAddingTrack}
              isPlaying={currentTrack?.id === track.id && isPlaying}
            />
          ))
        ) : starterError ? (
          <EmptyState
            title="Nothing here yet"
            hint="Check your connection and pull down to retry."
          />
        ) : (
          <SkeletonList rows={3} />
        )}

        {/* The reference's welcoming empty state, shown while there is no
            listening history and the starter rows have not loaded. */}
        {!hasRecents && starter.length === 0 && !featuredLoading && !starterError && (
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
      </ScrollView>

      <StatusBarScrim />

      <AddToPlaylistSheet track={addingTrack} onClose={() => setAddingTrack(null)} />

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

/**
 * Quick-access tile: icon + label on a dark tile. Liked gets the accent
 * treatment (teal heart), matching the reference's emphasis.
 */
const QuickAccessTile: React.FC<{
  Icon: typeof Heart;
  label: string;
  accent?: boolean;
  loading?: boolean;
  onPress: () => void;
}> = ({ Icon, label, accent = false, loading = false, onPress }) => (
  <TouchableOpacity
    style={styles.actionTile}
    activeOpacity={0.75}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ busy: loading }}
  >
    <View style={styles.actionTileIcon}>
      {loading ? (
        <ActivityIndicator size="small" color={COLORS.accent.primary} />
      ) : (
        <Icon
          color={accent ? COLORS.accent.primary : COLORS.text.primary}
          size={SIZES.icon.md - 2}
          strokeWidth={2}
          fill={accent ? COLORS.accent.primary : 'transparent'}
        />
      )}
    </View>
    <Text style={styles.actionTileLabel} numberOfLines={1}>
      {label}
    </Text>
  </TouchableOpacity>
);

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
  /** Thin accent ring on a near-transparent fill, per the reference. */
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(61, 214, 195, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(61, 214, 195, 0.55)',
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
  searchDivider: {
    width: 1,
    height: 20,
    backgroundColor: COLORS.hairline,
    marginRight: SIZES.sm,
  },
  pillsContainer: {
    marginBottom: SIZES.md,
  },
  chip: {
    paddingHorizontal: SIZES.md + 2,
    paddingVertical: 8,
    borderRadius: SIZES.radius.pill,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    marginRight: SIZES.sm,
    minHeight: SIZES.touchTarget - 8,
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: COLORS.accent.primary,
    borderColor: COLORS.accent.primary,
  },
  chipText: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.subheadline.fontSize,
    color: COLORS.text.primary,
  },
  chipTextActive: {
    color: '#04211D',
    fontFamily: FONTS.semibold,
  },

  featuredCard: {
    height: 164,
    borderRadius: SIZES.radius.lg,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    marginBottom: SIZES.lg,
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
    backgroundColor: COLORS.accent.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.ambient,
  },

  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SIZES.xl,
  },
  actionTile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: SIZES.radius.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    marginHorizontal: 4,
  },
  actionTileIcon: {
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SIZES.sm + 2,
  },
  actionTileLabel: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.text.primary,
  },

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
