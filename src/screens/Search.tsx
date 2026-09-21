import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search as SearchIcon, X, SearchX, WifiOff } from 'lucide-react-native';
import { COLORS, SIZES, FONTS, TYPE } from '../constants/theme';
import { Pill } from '../components/common/Pill';
import { TrackRow } from '../components/lists/TrackRow';
import { AddToPlaylistSheet } from '../components/lists/AddToPlaylistSheet';
import { MiniPlayer } from '../components/player/MiniPlayer';
import { StatusBarScrim } from '../components/common/StatusBarScrim';
import { CategoryTile } from '../components/common/Cards';
import { SectionHeader, EmptyState, ErrorState, SkeletonList } from '../components/common/UI';
import { BROWSE_CATEGORIES } from '../data/catalog';
import { SearchFilter, Track } from '../core/types';
import { useSearch } from '../hooks/useSearch';
import { usePlayer } from '../hooks/usePlayer';
import { MusicService } from '../services/MusicService';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';

const FILTERS: SearchFilter[] = ['All', 'Songs', 'Artists', 'Albums', 'Playlists'];

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  /** Set when Home's category pills (or another screen) jump in with a query. */
  const route = useRoute<RouteProp<Record<string, { browseQuery?: string } | undefined>, string>>();
  const {
    query,
    setQuery,
    filter,
    setFilter,
    results,
    isSearching,
    error,
    searchNow,
    retry,
    clear,
    hasResults,
  } = useSearch();

  const { playTrack, currentTrack, isPlaying, togglePlayPause } = usePlayer();
  const [expandingId, setExpandingId] = useState<string | null>(null);
  const [fieldFocused, setFieldFocused] = useState(false);

  const isBrowsing = query.trim().length === 0;

  /** Playing a search result queues the whole result list behind it. */
  const onPlayTrack = useCallback(
    (track: Track) => {
      // The result has been chosen; the user is done typing.
      Keyboard.dismiss();
      playTrack(track, {
        tracks: results.tracks,
        label: `Search • ${results.query}`,
      });
    },
    [playTrack, results.tracks, results.query]
  );

  /** Tapping an album/playlist expands it and plays it as a queue. */
  const onOpenCollection = useCallback(
    async (
      id: string,
      browseId: string,
      name: string,
      kind: 'album' | 'playlist'
    ) => {
      Keyboard.dismiss();
      setExpandingId(id);
    try {
      const page =
        kind === 'album'
          ? await MusicService.getAlbum(browseId)
          : await MusicService.getPlaylist(browseId);

      if (page.tracks.length) {
        playTrack(page.tracks[0], { tracks: page.tracks, label: name });
      }
    } catch {
      // The inline error row below already covers failed lookups.
      } finally {
        setExpandingId(null);
      }
    },
    [playTrack]
  );

  const onOpenArtist = useCallback(
    async (id: string, browseId: string, name: string) => {
      Keyboard.dismiss();
      setExpandingId(id);
    try {
      const tracks = await MusicService.getArtistTracks(browseId);
      if (tracks.length) playTrack(tracks[0], { tracks, label: name });
      } catch {
        /* handled by the error row */
      } finally {
        setExpandingId(null);
      }
    },
    [playTrack]
  );

  // Synthetic Track objects for non-track results. Memoized because a new
  // object literal per render would defeat TrackRow’s memoization.
  const artistRows = useMemo(
    () =>
      results.artists.map((artist) => ({
        id: artist.id,
        title: artist.name,
        artist: { id: artist.id, name: artist.subtitle ?? 'Artist' },
        albumImageUrl: artist.imageUrl,
        duration: 0,
        provider: artist.provider,
        sourceId: artist.browseId,
      })),
    [results.artists]
  );

  const albumRows = useMemo(
    () =>
      results.albums.map((album) => ({
        id: album.id,
        title: album.title,
        artist: {
          id: album.id,
          name: album.year ? `${album.artist} • ${album.year}` : album.artist,
        },
        albumImageUrl: album.coverImageUrl,
        duration: 0,
        provider: album.provider,
        sourceId: album.browseId,
      })),
    [results.albums]
  );

  const playlistRows = useMemo(
    () =>
      results.playlists.map((playlist) => ({
        id: playlist.id,
        title: playlist.name,
        artist: { id: playlist.id, name: playlist.creator },
        albumImageUrl: playlist.coverImageUrl,
        duration: 0,
        provider: playlist.provider,
        sourceId: playlist.browseId,
      })),
    [results.playlists]
  );

  const openArtistRow = useCallback(
    (track: Track) => onOpenArtist(track.id, track.sourceId, track.title),
    [onOpenArtist]
  );
  const openAlbumRow = useCallback(
    (track: Track) => onOpenCollection(track.id, track.sourceId, track.title, 'album'),
    [onOpenCollection]
  );
  const openPlaylistRow = useCallback(
    (track: Track) => onOpenCollection(track.id, track.sourceId, track.title, 'playlist'),
    [onOpenCollection]
  );

  /** Track whose "add to playlist" sheet is open. */
  const [addingTrack, setAddingTrack] = useState<Track | null>(null);

  // A category tap on Home lands here with a query to run immediately.
  useEffect(() => {
    const incoming = route.params?.browseQuery;
    if (incoming && incoming.trim()) {
      searchNow(incoming.trim());
      navigation.setParams({ browseQuery: undefined } as never);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.browseQuery]);

  return (
    <View style={styles.container}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + SIZES.lg, paddingBottom: SIZES.bottomInset },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.headerTitle}>Search</Text>

        <View
          style={[styles.searchContainer, fieldFocused && styles.searchContainerFocused]}
        >
          <SearchIcon
            color={fieldFocused ? COLORS.accent.primary : COLORS.text.secondary}
            size={SIZES.icon.md - 2}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Songs, artists, albums..."
            placeholderTextColor={COLORS.text.muted}
            value={query}
            onChangeText={setQuery}
            onFocus={() => setFieldFocused(true)}
            onBlur={() => setFieldFocused(false)}
            onSubmitEditing={() => searchNow(query)}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Search query"
          />
          {query ? (
            <TouchableOpacity
              onPress={clear}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <X color={COLORS.text.secondary} size={SIZES.icon.md - 2} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.filtersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {FILTERS.map((f) => (
              <Pill
                key={f}
                label={f}
                isActive={filter === f}
                onPress={() => setFilter(f)}
              />
            ))}
          </ScrollView>
        </View>

        {isBrowsing ? (
          <>
            <SectionHeader title="Browse Audia" />
            <View style={styles.categoriesGrid}>
              {BROWSE_CATEGORIES.map((category) => (
                <CategoryTile
                  key={category.id}
                  label={category.name}
                  onPress={() => searchNow(category.query)}
                  style={styles.categoryCardWrapper}
                />
              ))}
            </View>
          </>
        ) : (
          <>
            {error && (
              <ErrorState
                message={error}
                onRetry={retry}
                style={styles.stateCard}
                Icon={WifiOff}
              />
            )}

            {isSearching && !hasResults && (
              <SkeletonList rows={5} />
            )}

            {!isSearching && !error && !hasResults && (
              <EmptyState
                Icon={SearchX}
                title={`No results for "${query.trim()}"`}
                hint="Try a different spelling or filter."
                style={styles.stateCard}
              />
            )}

            {results.tracks.length > 0 && (
              <>
                <SectionHeader title="Songs" />
                <View style={styles.resultsList}>
                  {results.tracks.map((track) => (
                    <TrackRow
                      key={track.id}
                      track={track}
                      onPress={onPlayTrack}
                      onMorePress={setAddingTrack}
                      isPlaying={currentTrack?.id === track.id && isPlaying}
                    />
                  ))}
                </View>
              </>
            )}

            {results.artists.length > 0 && (
              <>
                <SectionHeader title="Artists" />
                <View style={styles.resultsList}>
                  {artistRows.map((row) => (
                    <TrackRow
                      key={row.id}
                      track={row}
                      onPress={openArtistRow}
                      isLoading={expandingId === row.id}
                    />
                  ))}
                </View>
              </>
            )}

            {results.albums.length > 0 && (
              <>
                <SectionHeader title="Albums" />
                <View style={styles.resultsList}>
                  {albumRows.map((row) => (
                    <TrackRow
                      key={row.id}
                      track={row}
                      onPress={openAlbumRow}
                      isLoading={expandingId === row.id}
                    />
                  ))}
                </View>
              </>
            )}

            {results.playlists.length > 0 && (
              <>
                <SectionHeader title="Playlists" />
                <View style={styles.resultsList}>
                  {playlistRows.map((row) => (
                    <TrackRow
                      key={row.id}
                      track={row}
                      onPress={openPlaylistRow}
                      isLoading={expandingId === row.id}
                    />
                  ))}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>

      <StatusBarScrim />

      <AddToPlaylistSheet track={addingTrack} onClose={() => setAddingTrack(null)} />

      {currentTrack && (
        <MiniPlayer
          track={currentTrack}
          isPlaying={isPlaying}
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
  scrollContent: {
    paddingHorizontal: SIZES.gutter,
  },
  headerTitle: {
    fontFamily: FONTS.bold,
    fontSize: TYPE.title1.fontSize,
    lineHeight: TYPE.title1.lineHeight,
    color: COLORS.text.primary,
    marginBottom: SIZES.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: SIZES.radius.md,
    paddingHorizontal: SIZES.md,
    height: 52,
    marginBottom: SIZES.md,
  },
  searchContainerFocused: {
    borderColor: COLORS.accent.primary,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontFamily: FONTS.regular,
    fontSize: TYPE.body.fontSize,
    color: COLORS.text.primary,
    marginLeft: SIZES.sm,
  },
  filtersContainer: {
    marginBottom: SIZES.lg,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryCardWrapper: {
    width: '48.5%',
    marginBottom: SIZES.sm,
    marginRight: 0,
  },
  resultsList: {
    marginBottom: SIZES.lg,
  },
  stateCard: {
    marginBottom: SIZES.lg,
  },
});
