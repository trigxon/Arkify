import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, Play, Heart, Compass, Moon, Target, User } from 'lucide-react-native';
import { COLORS, SIZES, FONTS, TYPE } from '../constants/theme';
import { Artwork } from '../components/common/Artwork';
import { SectionHeader, SkeletonList, ErrorState, EmptyState } from '../components/common/UI';
import { QuickActionTile } from '../components/common/Cards';
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
  hour < 12 ? 'Good morning.' : hour < 18 ? 'Good afternoon.' : 'Good evening.';

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
    playTrack(featured[0], { tracks: featured, label: 'A calmer you' });
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

  return (
    <View style={styles.container}>
      {/* Pinned: greeting + search stay put while the rest of the page scrolls. */}
      <View style={[styles.stickyHeader, { paddingTop: insets.top + SIZES.lg }]}>
        <ScreenHeader
          title={profile.name?.trim() ? profile.name : 'Audia'}
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
                <User color={COLORS.text.secondary} size={SIZES.icon.lg - 2} />
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
          <Text style={styles.searchText}>Songs, artists, albums</Text>
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
        {/* Browse shortcuts — real queries on the Search screen. */}
        <View style={styles.pillsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.label}
                style={styles.chip}
                activeOpacity={0.75}
                onPress={() => {
                  (navigation.navigate as (name: string, params?: object) => void)('SearchTab', {
                    browseQuery: cat.query,
                  });
                }}
                accessibilityRole="button"
                accessibilityLabel={`Browse ${cat.label}`}
              >
                <Text style={styles.chipText}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Featured: the first track of the calm pick, artwork as the star. */}
        {featuredLoading ? (
          <View style={[styles.featuredCard, styles.featuredSkeleton]}>
            <SkeletonList rows={1} />
          </View>
        ) : featuredTrack ? (
          <TouchableOpacity
            style={styles.featuredCard}
            activeOpacity={0.85}
            onPress={playFeatured}
            accessibilityRole="button"
            accessibilityLabel={`Play featured: ${featuredTrack.title} by ${featuredTrack.artist.name}`}
          >
            <Artwork uri={featuredTrack.albumImageUrl} size={72} radius={12} />
            <View style={styles.featuredText}>
              <Text style={styles.featuredKicker}>MADE FOR YOU</Text>
              <Text style={styles.featuredTitle} numberOfLines={1}>
                {featuredTrack.title}
              </Text>
              <Text style={styles.featuredSub} numberOfLines={1}>
                {featuredTrack.artist.name}
              </Text>
            </View>
            <View style={styles.featuredPlayBtn}>
              <Play color="#04211D" size={SIZES.icon.md} fill="#04211D" />
            </View>
          </TouchableOpacity>
        ) : starterError ? (
          <ErrorState
            message="Couldn't load suggestions."
            retryLabel="Pull down to retry"
            style={styles.featuredError}
          />
        ) : null}

        {/* Quick actions */}
        <View style={styles.actionsRow}>
          {ACTIONS.map((action) => (
            <QuickActionTile
              key={action.id}
              Icon={action.Icon}
              label={action.label}
              loading={pendingAction === action.id}
              onPress={() => runAction(action)}
            />
          ))}
        </View>

        <SectionHeader
          title={hasRecents ? 'Recently played' : 'Start listening'}
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
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.accent.soft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(61, 214, 195, 0.30)',
  },
  avatarInitial: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.headline.fontSize,
    color: COLORS.accent.primary,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: SIZES.radius.md,
    paddingHorizontal: SIZES.md,
    height: 48,
    marginTop: SIZES.md,
    marginBottom: SIZES.sm,
  },
  searchText: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.text.muted,
    marginLeft: SIZES.sm,
  },
  pillsContainer: {
    marginBottom: SIZES.lg,
  },
  chip: {
    paddingHorizontal: SIZES.md,
    paddingVertical: 8,
    borderRadius: SIZES.radius.pill,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    marginRight: SIZES.sm,
    minHeight: SIZES.touchTarget - 8,
    justifyContent: 'center',
  },
  chipText: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.subheadline.fontSize,
    color: COLORS.text.primary,
  },

  featuredCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius.lg,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    padding: SIZES.md,
    marginBottom: SIZES.lg,
  },
  featuredSkeleton: {
    minHeight: 104,
    justifyContent: 'center',
  },
  featuredError: {
    marginBottom: SIZES.lg,
  },
  featuredText: {
    flex: 1,
    marginHorizontal: SIZES.md,
  },
  featuredKicker: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.overline.fontSize,
    letterSpacing: TYPE.overline.letterSpacing ?? 2.5,
    color: COLORS.accent.primary,
  },
  featuredTitle: {
    fontFamily: FONTS.semibold,
    fontSize: TYPE.headline.fontSize,
    color: COLORS.text.primary,
    marginTop: 4,
  },
  featuredSub: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.subheadline.fontSize,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  featuredPlayBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.accent.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SIZES.xl,
  },
});
