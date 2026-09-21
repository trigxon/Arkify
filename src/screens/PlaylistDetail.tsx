import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Play, Shuffle, ListPlus, ListMusic } from 'lucide-react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { COLORS, SIZES, FONTS, TYPE, SHADOWS } from '../constants/theme';
import { TrackRow } from '../components/lists/TrackRow';
import { AddToPlaylistSheet } from '../components/lists/AddToPlaylistSheet';
import { MiniPlayer } from '../components/player/MiniPlayer';
import { Artwork } from '../components/common/Artwork';
import { EmptyState } from '../components/common/UI';
import { Track } from '../core/types';
import { usePlayer } from '../hooks/usePlayer';
import { useLibrary } from '../hooks/useLibrary';

type PlaylistRouteParams = { playlistId: string };
type PlaylistRoute = RouteProp<{ Playlist: PlaylistRouteParams }, 'Playlist'>;

/**
 * A playlist on its own page.
 *
 * Everything here operates strictly on this playlist's own tracks: pressing
 * Play queues exactly these, in this order, with this playlist as the context
 * label -- never the global recents list.
 */
export default function PlaylistDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<PlaylistRoute>();
  const { playlistId } = route.params;

  const { playlists, likedPlaylist } = useLibrary();
  const {
    playTrack,
    addToQueue,
    currentTrack,
    isPlaying,
    isLoading,
    togglePlayPause,
    shuffle,
    toggleShuffle,
  } = usePlayer();

  /** Track whose "add to playlist" sheet is open. */
  const [addingTrack, setAddingTrack] = useState<Track | null>(null);

  const playlist = useMemo(
    () => (playlistId === 'liked' ? likedPlaylist : playlists.find((p) => p.id === playlistId)),
    [playlistId, playlists, likedPlaylist]
  );

  const tracks = playlist?.tracks ?? [];

  const playFromStart = useCallback(() => {
    if (!tracks.length || !playlist) return;
    if (shuffle) toggleShuffle(); // Play means in order.
    playTrack(tracks[0], { tracks, label: playlist.name });
  }, [tracks, playlist, playTrack, shuffle, toggleShuffle]);

  const playShuffled = useCallback(() => {
    if (!tracks.length || !playlist) return;

    const start = tracks[Math.floor(Math.random() * tracks.length)];
    playTrack(start, { tracks, label: playlist.name });
    if (!shuffle) toggleShuffle();
  }, [tracks, playlist, playTrack, shuffle, toggleShuffle]);

  const queueAll = useCallback(() => {
    if (tracks.length) addToQueue(tracks);
  }, [tracks, addToQueue]);

  /** One stable callback for every row in this playlist. */
  const onTrackPress = useCallback(
    (track: Track) => {
      if (!playlist) return;
      playTrack(track, { tracks, label: playlist.name });
    },
    [playTrack, tracks, playlist]
  );

  const renderItem = useCallback(
    ({ item }: { item: Track }) => (
      <TrackRow
        track={item}
        onPress={onTrackPress}
        onMorePress={setAddingTrack}
        isPlaying={currentTrack?.id === item.id && isPlaying}
      />
    ),
    [onTrackPress, currentTrack?.id, isPlaying]
  );

  if (!playlist) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + SIZES.lg }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft color={COLORS.text.primary} size={SIZES.icon.xl} />
        </TouchableOpacity>
        <EmptyState title="This playlist is no longer available." style={styles.emptyCard} />
      </View>
    );
  }

  const header = (
    <View style={styles.headerBlock}>
      <View style={styles.artworkWrap}>
        <View style={[styles.artworkShadow, SHADOWS.artwork]}>
          <Artwork
            uri={playlist.coverImageUrl || undefined}
            size={184}
            radius={SIZES.radius.lg}
          />
        </View>
      </View>

      <Text style={styles.kicker}>{playlist.id === 'liked' ? 'PLAYLIST' : playlist.creator ? `BY ${playlist.creator.toUpperCase()}` : 'PLAYLIST'}</Text>
      <Text style={styles.title} numberOfLines={2}>{playlist.name}</Text>
      <Text style={styles.meta} numberOfLines={1}>
        {tracks.length} {tracks.length === 1 ? 'track' : 'tracks'}
      </Text>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.primaryAction, !tracks.length && styles.actionDisabled]}
          activeOpacity={0.85}
          onPress={playFromStart}
          disabled={!tracks.length}
          accessibilityRole="button"
          accessibilityLabel="Play playlist"
        >
          <Play color="#04211D" size={SIZES.icon.sm + 2} fill="#04211D" />
          <Text style={styles.primaryActionText}>Play</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryAction, !tracks.length && styles.actionDisabled]}
          activeOpacity={0.85}
          onPress={playShuffled}
          disabled={!tracks.length}
          accessibilityRole="button"
          accessibilityLabel="Shuffle playlist"
        >
          <Shuffle color={COLORS.text.primary} size={SIZES.icon.sm + 2} />
          <Text style={styles.secondaryActionText}>Shuffle</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.iconAction, !tracks.length && styles.actionDisabled]}
          activeOpacity={0.85}
          onPress={queueAll}
          disabled={!tracks.length}
          accessibilityRole="button"
          accessibilityLabel="Add all tracks to queue"
        >
          <ListPlus color={COLORS.text.primary} size={SIZES.icon.sm + 2} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={tracks}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EmptyState
            Icon={ListMusic}
            title={playlist.id === 'liked' ? 'Nothing saved yet' : 'This playlist is empty'}
            hint={
              playlist.id === 'liked'
                ? 'Tap the heart on a track to save it here.'
                : 'Add tracks from search or another playlist.'
            }
            style={styles.emptyCard}
          />
        }
        contentContainerStyle={{
          paddingTop: insets.top + SIZES.xxl,
          paddingBottom: SIZES.bottomInset,
        }}
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        windowSize={9}
        removeClippedSubviews
      />

      {/* Floating back control, above the list. */}
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={[styles.backButton, { top: insets.top + SIZES.sm }]}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <ChevronLeft color={COLORS.text.primary} size={SIZES.icon.xl} />
      </TouchableOpacity>

      <AddToPlaylistSheet track={addingTrack} onClose={() => setAddingTrack(null)} />

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  backButton: {
    position: 'absolute',
    left: SIZES.md,
    zIndex: 30,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceRaised,
    borderWidth: 1,
    borderColor: COLORS.hairline,
  },
  headerBlock: {
    paddingHorizontal: SIZES.gutter,
    paddingBottom: SIZES.lg,
  },
  artworkWrap: {
    alignItems: 'center',
    marginBottom: SIZES.lg,
  },
  artworkShadow: {
    borderRadius: SIZES.radius.lg,
  },
  kicker: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.overline.fontSize,
    letterSpacing: TYPE.overline.letterSpacing ?? 2.5,
    color: COLORS.accent.primary,
    marginBottom: SIZES.xs,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: TYPE.title1.fontSize,
    lineHeight: TYPE.title1.lineHeight,
    color: COLORS.text.primary,
    marginBottom: SIZES.xs,
  },
  meta: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.text.secondary,
    marginBottom: SIZES.lg,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
  },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
    backgroundColor: COLORS.accent.primary,
    paddingVertical: SIZES.sm + 4,
    paddingHorizontal: SIZES.lg,
    borderRadius: SIZES.radius.pill,
    minHeight: SIZES.touchTarget,
  },
  primaryActionText: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.callout.fontSize,
    color: '#04211D',
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    paddingVertical: SIZES.sm + 4,
    paddingHorizontal: SIZES.md,
    borderRadius: SIZES.radius.pill,
    minHeight: SIZES.touchTarget,
  },
  secondaryActionText: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.text.primary,
  },
  iconAction: {
    width: SIZES.touchTarget,
    height: SIZES.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SIZES.radius.pill,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.hairline,
  },
  actionDisabled: {
    opacity: 0.4,
  },
  emptyCard: {
    marginHorizontal: SIZES.md,
  },
});
