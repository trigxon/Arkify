import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, Play, Heart, Compass, Moon, Target, User } from 'lucide-react-native';
import { COLORS, SIZES, FONTS } from '../constants/theme';
import { Pill } from '../components/common/Pill';
import { GlassCard } from '../components/common/GlassCard';
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

  return (
    <View style={styles.container}>
      {/* Pinned: greeting + search stay put while the rest of the page scrolls. */}
      <View style={[styles.stickyHeader, { paddingTop: insets.top + SIZES.lg }]}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greetingFor(new Date().getHours())}</Text>
            {!!profile.name && <Text style={styles.name}>{profile.name}.</Text>}
            <Text style={styles.madeBy}>MADE BY ARK DURRANI (PATHAN) · TRIGXON</Text>
          </View>
          <TouchableOpacity
            style={styles.avatar}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Settings' as never)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {profile.name?.trim() ? (
              <Text style={styles.avatarInitial}>{profile.name.trim()[0].toUpperCase()}</Text>
            ) : (
              <User color={COLORS.text.secondary} size={26} />
            )
            }
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.searchBar}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('SearchTab' as never)}
        >
          <Search color={COLORS.text.secondary} size={20} />
          <Text style={styles.searchText}>Search for songs, artists, or more...</Text>
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
            colors={[COLORS.accent.green]}
          />
        }
      >
        <View style={styles.pillsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {CATEGORIES.map(cat => (
              <Pill
                key={cat.label}
                label={cat.label}
                onPress={() => {
                  // Real browse shortcut: jumps to Search and runs the query.
                  (navigation.navigate as (name: string, params?: object) => void)('SearchTab', {
                    browseQuery: cat.query,
                  });
                }}
              />
            ))}
          </ScrollView>
        </View>

        <GlassCard style={styles.featuredCard}>
          <View style={styles.featuredContent}>
            <Text style={styles.featuredText}>Made for you</Text>
            <Text style={styles.featuredSub}>A calmer you, a softer tomorrow.</Text>
          </View>
          <TouchableOpacity style={styles.featuredPlayBtn} onPress={playFeatured} activeOpacity={0.85}>
            <Play color="#04211D" size={24} fill="#04211D" />
          </TouchableOpacity>
        </GlassCard>

        {/* Quick action buttons row (Liked, Discover, Chill, Focus) */}
        <View style={styles.actionsRow}>
          {ACTIONS.map(action => (
            <TouchableOpacity
              key={action.id}
              style={styles.actionTouchable}
              activeOpacity={0.8}
              onPress={() => runAction(action)}
            >
              <GlassCard style={styles.actionCard} intensity={20}>
                <View style={styles.actionIconPlaceholder}>
                  {pendingAction === action.id ? (
                    <ActivityIndicator size="small" color={COLORS.text.secondary} />
                  ) : (
                    <action.Icon color={COLORS.text.secondary} size={18} />
                  )}
                </View>
                <Text style={styles.actionText}>{action.label}</Text>
              </GlassCard>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {hasRecents ? 'Recently Played' : 'Start Listening'}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('LibraryTab' as never)}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.listContainer}>
          {listTracks.length > 0 ? (
            listTracks.map(track => (
              <TrackRow
                key={track.id}
                track={track}
                onPress={handleTrackPress}
                onMorePress={setAddingTrack}
                isPlaying={currentTrack?.id === track.id && isPlaying}
              />
            ))
          ) : (
            <GlassCard intensity={20} style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                {starterError ? "Couldn't load suggestions." : 'Finding something for you...'}
              </Text>
              <Text style={styles.emptyHint}>
                {starterError
                  ? 'Check your connection and pull to retry.'
                  : 'Search for anything to get started.'}
              </Text>
            </GlassCard>
          )}
        </View>

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
    paddingHorizontal: SIZES.md,
  },
  stickyHeader: {
    paddingHorizontal: SIZES.md,
    paddingBottom: SIZES.sm,
    backgroundColor: COLORS.background,
    zIndex: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SIZES.lg,
  },
  madeBy: {
    fontFamily: FONTS.medium,
    fontSize: 9,
    letterSpacing: 2.5,
    color: COLORS.accent.primary,
    opacity: 0.75,
    marginTop: SIZES.xs,
  },
  greeting: {
    fontFamily: FONTS.regular,
    fontSize: 20,
    color: COLORS.text.secondary,
  },
  name: {
    fontFamily: FONTS.medium,
    fontSize: 28,
    color: COLORS.text.primary,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.accent.glow,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(61, 214, 195, 0.35)',
  },
  avatarInitial: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: COLORS.accent.primary,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: SIZES.radius.md,
    padding: SIZES.md,
    marginBottom: SIZES.md,
  },
  searchText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.text.secondary,
    marginLeft: SIZES.sm,
  },
  pillsContainer: {
    marginBottom: SIZES.lg,
  },
  featuredCard: {
    padding: SIZES.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.md,
  },
  featuredContent: {
    justifyContent: 'center',
  },
  featuredText: {
    fontFamily: FONTS.medium,
    fontSize: 18,
    color: COLORS.text.primary,
  },
  featuredSub: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.text.secondary,
    marginTop: 4,
  },
  featuredPlayBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.accent.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SIZES.xl,
  },
  actionTouchable: {
    flex: 1,
  },
  actionCard: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: SIZES.md,
    alignItems: 'center',
  },
  actionIconPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: COLORS.text.secondary,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.sm,
    paddingHorizontal: SIZES.xs,
  },
  sectionTitle: {
    fontFamily: FONTS.medium,
    fontSize: 18,
    color: COLORS.text.primary,
  },
  seeAll: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.text.secondary,
  },
  listContainer: {
    marginBottom: SIZES.xl,
  },
  emptyCard: {
    padding: SIZES.md,
  },
  emptyText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.text.primary,
  },
  emptyHint: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.text.secondary,
    marginTop: 4,
  },
});
