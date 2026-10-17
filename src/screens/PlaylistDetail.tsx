import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Play,
  Shuffle,
  ListPlus,
  ListMusic,
  MoreVertical,
  Pencil,
  Trash2,
  Search,
  X,
  ArrowDownUp,
  Check,
  AlignLeft,
  User,
  Clock,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { COLORS, SIZES, FONTS, TYPE, SHADOWS } from '../constants/theme';
import { TrackRow } from '../components/lists/TrackRow';
import { TrackActionsHost } from '../components/lists/TrackActionsHost';
import { BottomSheet } from '../components/common/BottomSheet';
import { confirmAlert } from '../components/common/ConfirmDialog';
import { MiniPlayer } from '../components/player/MiniPlayer';
import { BackButton, FadeInUp } from '../components/common/Glass';
import { Artwork } from '../components/common/Artwork';
import { AmbientGlow } from '../components/common/AmbientGlow';
import { EmptyState } from '../components/common/UI';
import { Track } from '../core/types';
import { usePlayer } from '../hooks/usePlayer';
import { useLibrary } from '../hooks/useLibrary';

type PlaylistRouteParams = { playlistId: string };
type PlaylistRoute = RouteProp<{ Playlist: PlaylistRouteParams }, 'Playlist'>;

type PlaylistSort = 'custom' | 'title' | 'artist' | 'duration';

const SORT_LABELS: Record<PlaylistSort, string> = {
  custom: 'Custom order',
  title: 'Title',
  artist: 'Artist',
  duration: 'Duration',
};

const SORT_OPTIONS: PlaylistSort[] = ['custom', 'title', 'artist', 'duration'];

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
  const playlistId = route.params?.playlistId ?? '';

  const { playlists, likedPlaylist, renamePlaylist, setPlaylistDescription, deletePlaylist, reorderPlaylist } =
    useLibrary();
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
  const [actionsTrack, setActionsTrack] = useState<Track | null>(null);
  /** Playlist ••• menu: rename / edit description / delete. */
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuMode, setMenuMode] = useState<'root' | 'rename' | 'description'>('root');
  const [renameText, setRenameText] = useState('');
  const [descText, setDescText] = useState('');

  // ---- search within playlist + sort --------------------------------------

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<PlaylistSort>('custom');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  const playlist = useMemo(
    () => (playlistId === 'liked' ? likedPlaylist : playlists.find((p) => p.id === playlistId)),
    [playlistId, playlists, likedPlaylist]
  );

  const tracks = playlist?.tracks ?? [];

  const visibleTracks = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? tracks.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            (t.artist?.name ?? '').toLowerCase().includes(q)
        )
      : tracks;

    switch (sort) {
      case 'title':
        return [...base].sort((a, b) => a.title.localeCompare(b.title));
      case 'artist':
        return [...base].sort((a, b) =>
          (a.artist?.name ?? '').localeCompare(b.artist?.name ?? '')
        );
      case 'duration':
        return [...base].sort((a, b) => (b.duration ?? 0) - (a.duration ?? 0));
      default:
        return base; // custom = the playlist's own stored order
    }
  }, [tracks, query, sort]);

  // ---- playlist menu (rename / description / delete) ---------------------

  const openMenu = useCallback(() => {
    setRenameText(playlist?.name ?? '');
    setDescText(playlist?.description ?? '');
    setMenuMode('root');
    setMenuOpen(true);
  }, [playlist?.name, playlist?.description]);

  const commitRename = useCallback(() => {
    const name = renameText.trim();
    if (name && playlist && playlist.id !== 'liked') renamePlaylist(playlist.id, name);
    setMenuOpen(false);
  }, [renameText, playlist, renamePlaylist]);

  const commitDescription = useCallback(() => {
    if (playlist && playlist.id !== 'liked') {
      setPlaylistDescription(playlist.id, descText.trim());
    }
    setMenuOpen(false);
  }, [descText, playlist, setPlaylistDescription]);

  const confirmDelete = useCallback(() => {
    if (!playlist || playlist.id === 'liked') return;
    const message = `“${playlist.name}” will be removed. Your liked songs and downloads stay.`;

    confirmAlert('Delete playlist?', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deletePlaylist(playlist.id);
          navigation.goBack();
        },
      },
    ]);
  }, [playlist, deletePlaylist, navigation]);

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

  // ---- drag-to-reorder (custom order only) --------------------------------

  /**
   * Reordering is only meaningful in the playlist's own stored order — it is
   * disabled while a sort is applied or a search filters the list, because
   * then the visible positions no longer map to the stored array.
   */
  const canReorder =
    !!playlist && playlist.id !== 'liked' && sort === 'custom' && !query.trim() && tracks.length > 1;

  const commitReorder = useCallback(
    (from: number, to: number) => {
      if (playlist) reorderPlaylist(playlist.id, from, to);
    },
    [playlist, reorderPlaylist]
  );

  /** Index (into visibleTracks) of the row being dragged. */
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  /** Index the row is currently hovering over. */
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const dragY = useRef(new Animated.Value(0)).current;
  const startIndex = useRef(0);
  const active = useRef(false);

  // Refs mirror the freshest values for the long-lived PanResponder: the
  // responder is created once, so every closure must read from refs, never
  // from render-scope state.
  const dragIndexRef = useRef<number | null>(null);
  const hoverIndexRef = useRef<number | null>(null);
  const listRef = useRef<Track[]>(visibleTracks);
  const reorderRef = useRef(commitReorder);
  const lastOverRef = useRef<number | null>(null);
  dragIndexRef.current = dragIndex;
  hoverIndexRef.current = hoverIndex;
  listRef.current = visibleTracks;
  reorderRef.current = commitReorder;

  /** Measured height of one row — rows are uniform, so one measure suffices. */
  const rowHRef = useRef(64);

  /** Viewport Y where the drag started (for the floating ghost row). */
  const ghostStartY = useRef(0);
  const ghostTop = useRef(new Animated.Value(0)).current;
  const [ghostTrack, setGhostTrack] = useState<Track | null>(null);
  // BUG FIX: pageY is a WINDOW coordinate; on desktop web the app frame sits
  // centered in the viewport, so the ghost rendered ~90px below the finger.
  // Capture the screen root's window Y so pageY converts to frame-local.
  const rootRef = useRef<View>(null);
  const rootWindowY = useRef(0);
  const measureRoot = useCallback(() => {
    rootRef.current?.measureInWindow((_x, y) => {
      rootWindowY.current = y;
    });
  }, []);

  /** Per-row displacement springs so neighbours glide out of the way. */
  const rowOffsets = useRef<Map<string, Animated.Value>>(new Map());
  const getOffset = useCallback((id: string): Animated.Value => {
    let v = rowOffsets.current.get(id);
    if (!v) {
      v = new Animated.Value(0);
      rowOffsets.current.set(id, v);
    }
    return v;
  }, []);

  const settleRows = useCallback(() => {
    rowOffsets.current.forEach((v) => v.setValue(0));
  }, []);

  // Evict displacement values for rows that left the list, so the map can't
  // grow unbounded across a long editing session.
  useEffect(() => {
    const live = new Set(visibleTracks.map((t) => t.id));
    rowOffsets.current.forEach((_v, id) => {
      if (!live.has(id)) rowOffsets.current.delete(id);
    });
  }, [visibleTracks]);

  /** Animate neighbours when the hover slot changes (not every frame). */
  const displaceRows = useCallback(
    (from: number, over: number) => {
      listRef.current.forEach((track, i) => {
        if (i === from) return;
        let target = 0;
        if (from < over && i > from && i <= over) target = -rowHRef.current;
        else if (from > over && i < from && i >= over) target = rowHRef.current;
        Animated.spring(getOffset(track.id), {
          toValue: target,
          stiffness: 500,
          damping: 34,
          mass: 0.7,
          useNativeDriver: Platform.OS !== 'web',
        }).start();
      });
    },
    [getOffset]
  );

  const endDrag = useCallback(() => {
    active.current = false;
    lastOverRef.current = null;
    setDragIndex(null);
    setHoverIndex(null);
    setGhostTrack(null);
    dragY.setValue(0);
    settleRows();
  }, [dragY, settleRows]);

  const hapticTick = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => undefined);
    }
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, g) => active.current && Math.abs(g.dy) > 6,
        onPanResponderMove: (_e, g) => {
          dragY.setValue(g.dy);
          ghostTop.setValue(ghostStartY.current + g.dy - rowHRef.current / 2);

          const count = listRef.current.length;
          const draggedY = startIndex.current * rowHRef.current + g.dy;
          const over = Math.max(0, Math.min(count - 1, Math.round(draggedY / rowHRef.current)));
          if (over !== hoverIndexRef.current) {
            setHoverIndex(over);
            hapticTick();
            const from = dragIndexRef.current;
            if (from !== null) displaceRows(from, over);
          }
        },
        onPanResponderRelease: () => {
          if (active.current && hoverIndexRef.current !== null && dragIndexRef.current !== null) {
            if (hoverIndexRef.current !== dragIndexRef.current) {
              reorderRef.current(dragIndexRef.current, hoverIndexRef.current);
            }
          }
          endDrag();
        },
        onPanResponderTerminate: endDrag,
      }),
    [dragY, ghostTop, endDrag, displaceRows, hapticTick]
  );

  /** Long-press on a row arms the drag and lifts a floating ghost copy. */
  const beginDrag = useCallback(
    (index: number, pageY: number) => {
      if (!canReorder || active.current) return;
      startIndex.current = index;
      lastOverRef.current = index;
      active.current = true;
      const localY = pageY - rootWindowY.current;
      ghostStartY.current = localY;
      setGhostTrack(listRef.current[index] ?? null);
      ghostTop.setValue(localY - rowHRef.current / 2);
      setDragIndex(index);
      setHoverIndex(index);
      hapticTick();
    },
    [canReorder, ghostTop, hapticTick]
  );

  /** One stable callback for every row in this playlist. */
  const onTrackPress = useCallback(
    (track: Track) => {
      if (!playlist) return;
      playTrack(track, { tracks, label: playlist.name });
    },
    [playTrack, tracks, playlist]
  );

  const measureRow = useCallback((e: { nativeEvent: { layout: { height: number } } }) => {
    const h = e.nativeEvent.layout.height;
    if (h > 20 && Math.abs(rowHRef.current - h) > 1) rowHRef.current = h;
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: Track; index: number }) => {
      const isDragging = index === dragIndex;
      return (
        <Animated.View
          style={[
            { transform: [{ translateY: isDragging ? dragY : getOffset(item.id) }] },
            isDragging && styles.rowDragging,
          ]}
        >
          <View onLayout={index === 0 ? measureRow : undefined}>
            <TrackRow
              track={item}
              onPress={onTrackPress}
              onMorePress={setActionsTrack}
              onLongPress={
                canReorder
                  ? (t, e) => beginDrag(index, e?.nativeEvent?.pageY ?? 0)
                  : undefined
              }
              isPlaying={currentTrack?.id === item.id && isPlaying}
            />
          </View>
        </Animated.View>
      );
    },
    [
      onTrackPress,
      currentTrack?.id,
      isPlaying,
      canReorder,
      beginDrag,
      dragY,
      dragIndex,
      getOffset,
      measureRow,
    ]
  );

  if (!playlist) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + SIZES.lg }]}>
        <BackButton style={styles.backButton} />
        <EmptyState title="This playlist is no longer available." style={styles.emptyCard} />
      </View>
    );
  }

  const header = (
    <FadeInUp preset="slow">
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
        {query.trim()
          ? `${visibleTracks.length} of ${tracks.length} ${tracks.length === 1 ? 'track' : 'tracks'}`
          : `${tracks.length} ${tracks.length === 1 ? 'track' : 'tracks'} · ${SORT_LABELS[sort]}`}
      </Text>

      {playlist.description ? (
        <Text style={styles.description} numberOfLines={3}>
          {playlist.description}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.primaryAction, !tracks.length && styles.actionDisabled]}
          activeOpacity={0.85}
          onPress={playFromStart}
          disabled={!tracks.length}
          accessibilityRole="button"
          accessibilityLabel="Play playlist"
        >
          <Play color={COLORS.text.dark} size={SIZES.icon.sm + 2} fill={COLORS.text.dark} />
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

        {/* Spotify-style playlist menu: rename / delete. Liked Songs is
            synthetic — it has no name to change and cannot be deleted. */}
        {playlist.id !== 'liked' && (
          <TouchableOpacity
            style={styles.iconAction}
            activeOpacity={0.85}
            onPress={openMenu}
            accessibilityRole="button"
            accessibilityLabel="Playlist options"
          >
            <MoreVertical color={COLORS.text.primary} size={SIZES.icon.sm + 2} />
          </TouchableOpacity>
        )}
      </View>

      {/* Spotify-style playlist toolbar: search-within + sort. Always real,
          always visible — search filters the list in place; sort reorders the
          view (Custom is the playlist's own stored order). */}
      <View style={styles.toolbar}>
        <View style={styles.searchField}>
          <Search color={COLORS.text.muted} size={SIZES.icon.sm + 1} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search in playlist"
            placeholderTextColor={COLORS.text.muted}
            returnKeyType="search"
            accessibilityLabel="Search within playlist"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => setQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Clear playlist search"
            >
              <X color={COLORS.text.muted} size={SIZES.icon.sm} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={styles.sortButton}
          activeOpacity={0.8}
          onPress={() => setSortMenuOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Sort playlist, current: ${SORT_LABELS[sort]}`}
        >
          <ArrowDownUp color={sort === 'custom' ? COLORS.text.primary : COLORS.accent.primary} size={SIZES.icon.sm + 1} />
        </TouchableOpacity>
      </View>
    </View>
    </FadeInUp>
  );

  return (
    <View
      ref={rootRef}
      style={styles.container}
      onLayout={measureRoot}
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <AmbientGlow />
      </View>

      <View style={styles.listArea} {...panResponder.panHandlers}>
      <FlatList
        data={visibleTracks}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        extraData={`${dragIndex}-${hoverIndex}-${canReorder}`}
        ListHeaderComponent={header}
        ListEmptyComponent={
          query.trim() ? (
            <EmptyState
              Icon={Search}
              title="No matches in this playlist"
              hint={`Nothing here matches “${query.trim()}”.`}
              style={styles.emptyCard}
            />
          ) : (
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
          )
        }
        contentContainerStyle={{
          paddingTop: insets.top + SIZES.xxl,
          paddingBottom: SIZES.bottomInset,
        }}
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        windowSize={9}
        removeClippedSubviews={Platform.OS !== 'web'}
      />
      </View>

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

      {/* Floating drag ghost — rendered outside the list so it always reads
          as lifted above the rows it passes over. */}
      {ghostTrack && (
        <Animated.View
          pointerEvents="none"
          style={[styles.ghost, styles.ghostCard, { top: ghostTop }]}
        >
          <TrackRow track={ghostTrack} onPress={() => undefined} />
        </Animated.View>
      )}

      {/* Playlist ••• menu: rename / description / delete, glass sheet. */}
      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)}>
        {menuMode === 'rename' ? (
          <>
            <Text style={pdStyles.menuHint}>Rename playlist</Text>
            <View style={pdStyles.renameRow}>
              <TextInput
                style={pdStyles.renameInput}
                value={renameText}
                onChangeText={setRenameText}
                placeholder="Playlist name"
                placeholderTextColor={COLORS.text.muted}
                autoFocus
                returnKeyType="done"
                maxLength={60}
                accessibilityLabel="Playlist name"
                onSubmitEditing={commitRename}
              />
              <TouchableOpacity
                style={[pdStyles.renameBtn, !renameText.trim() && pdStyles.disabled]}
                disabled={!renameText.trim()}
                onPress={commitRename}
                accessibilityRole="button"
                accessibilityLabel="Save playlist name"
              >
                <Text style={pdStyles.renameBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
            <MenuRow Icon={Pencil} label="Back" onPress={() => setMenuMode('root')} />
          </>
        ) : menuMode === 'description' ? (
          <>
            <Text style={pdStyles.menuHint}>Edit description</Text>
            <View style={pdStyles.renameRow}>
              <TextInput
                style={pdStyles.renameInput}
                value={descText}
                onChangeText={setDescText}
                placeholder="Describe this playlist (optional)"
                placeholderTextColor={COLORS.text.muted}
                autoFocus
                returnKeyType="done"
                maxLength={200}
                multiline
                accessibilityLabel="Playlist description"
                onSubmitEditing={commitDescription}
              />
              <TouchableOpacity
                style={pdStyles.renameBtn}
                onPress={commitDescription}
                accessibilityRole="button"
                accessibilityLabel="Save playlist description"
              >
                <Text style={pdStyles.renameBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
            <MenuRow Icon={AlignLeft} label="Back" onPress={() => setMenuMode('root')} />
          </>
        ) : (
          <>
            <MenuRow Icon={Pencil} label="Rename playlist" onPress={() => setMenuMode('rename')} />
            <MenuRow
              Icon={AlignLeft}
              label="Edit description"
              onPress={() => setMenuMode('description')}
            />
            <MenuRow Icon={Trash2} label="Delete playlist" destructive onPress={confirmDelete} />
          </>
        )}
      </BottomSheet>

      {/* Sort menu: reorders the view. Custom order is the stored order and
          enables drag-to-reorder; the others are honest view-level sorts. */}
      <BottomSheet visible={sortMenuOpen} onClose={() => setSortMenuOpen(false)}>
        <Text style={pdStyles.menuHint}>Sort by</Text>
        {SORT_OPTIONS.map((option) => (
          <MenuRow
            key={option}
            Icon={
              option === 'custom'
                ? ListMusic
                : option === 'title'
                ? AlignLeft
                : option === 'artist'
                ? User
                : Clock
            }
            label={SORT_LABELS[option]}
            active={sort === option}
            onPress={() => {
              setSort(option);
              setSortMenuOpen(false);
            }}
          />
        ))}
        <Text style={pdStyles.sortFootnote}>
          {sort === 'custom'
            ? canReorder
              ? 'Long-press a track and drag to rearrange.'
              : 'Add more tracks to rearrange by hand.'
            : 'Switch back to Custom order to drag tracks by hand.'}
        </Text>
      </BottomSheet>

      <TrackActionsHost
        track={actionsTrack}
        onClose={() => setActionsTrack(null)}
        contextPlaylistId={playlist.id !== 'liked' ? playlist.id : undefined}
      />

      {currentTrack && (
        <MiniPlayer
          track={currentTrack}
          isPlaying={isPlaying}
          isLoading={isLoading}
          onPlayPause={togglePlayPause}
          onPress={() => navigation.navigate('NowPlaying' as never)}
          tabBarHeight={0}
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
    marginBottom: SIZES.sm,
  },
  description: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.subheadline.fontSize,
    lineHeight: TYPE.subheadline.lineHeight,
    color: COLORS.text.secondary,
    marginBottom: SIZES.md,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
    marginBottom: SIZES.md,
  },
  searchField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: SIZES.radius.pill,
    paddingHorizontal: SIZES.md,
    minHeight: SIZES.touchTarget - 4,
  },
  searchInput: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: TYPE.subheadline.fontSize,
    color: COLORS.text.primary,
    paddingVertical: 0,
  },
  sortButton: {
    width: SIZES.touchTarget - 8,
    height: SIZES.touchTarget - 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SIZES.radius.pill,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.hairline,
  },
  listArea: {
    flex: 1,
  },
  rowDragging: {
    opacity: 0.32,
  },
  ghost: {
    position: 'absolute',
    left: SIZES.gutter,
    right: SIZES.gutter,
    zIndex: 50,
    elevation: 12,
  },
  ghostCard: {
    backgroundColor: COLORS.surfaceRaised,
    borderRadius: SIZES.radius.md,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    ...SHADOWS.artwork,
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
    color: COLORS.text.dark,
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
    // Aligns with the header/toolbar gutter directly above (was 16).
    marginHorizontal: SIZES.gutter,
  },
});

// ---------------------------------------------------------------------------
// Playlist ••• menu pieces
// ---------------------------------------------------------------------------

const MenuRow: React.FC<{
  Icon: typeof Pencil;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  active?: boolean;
}> = ({ Icon, label, onPress, destructive = false, active = false }) => (
  <TouchableOpacity
    style={pdStyles.menuRow}
    activeOpacity={0.7}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ selected: active }}
    aria-pressed={active}
  >
    <View style={pdStyles.menuIcon}>
      <Icon
        color={destructive ? COLORS.status.error : COLORS.text.primary}
        size={SIZES.icon.md - 2}
        strokeWidth={1.9}
      />
    </View>
    <Text
      style={[
        pdStyles.menuLabel,
        destructive && { color: COLORS.status.error },
        active && { color: COLORS.accent.primary },
      ]}
    >
      {label}
    </Text>
    {active && <Check color={COLORS.accent.primary} size={SIZES.icon.sm + 2} />}
  </TouchableOpacity>
);

const pdStyles = StyleSheet.create({
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.lg,
    paddingVertical: SIZES.sm + 4,
    minHeight: SIZES.touchTarget + 8,
  },
  menuIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: TYPE.body.fontSize,
    color: COLORS.text.primary,
  },
  menuHint: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.subheadline.fontSize,
    color: COLORS.text.secondary,
    marginBottom: SIZES.md,
  },
  renameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
    marginBottom: SIZES.md,
  },
  renameInput: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: TYPE.body.fontSize,
    color: COLORS.text.primary,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: SIZES.radius.sm,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm + 4,
  },
  renameBtn: {
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm + 4,
    borderRadius: SIZES.radius.sm,
    backgroundColor: COLORS.accent.primary,
    minHeight: SIZES.touchTarget - 4,
    justifyContent: 'center',
  },
  renameBtnText: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.text.dark,
  },
  disabled: {
    opacity: 0.4,
  },
  sortFootnote: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.text.muted,
    paddingTop: SIZES.sm,
    paddingBottom: SIZES.xs,
  },
});
