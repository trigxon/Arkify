import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search as SearchIcon, X } from 'lucide-react-native';
import { COLORS, SIZES, FONTS } from '../constants/theme';
import { Pill } from '../components/common/Pill';
import { GlassCard } from '../components/common/GlassCard';
import { LinearGradient } from 'expo-linear-gradient';
import { TrackRow } from '../components/lists/TrackRow';
import { AddToPlaylistSheet } from '../components/lists/AddToPlaylistSheet';
import { MiniPlayer } from '../components/player/MiniPlayer';
import { StatusBarScrim } from '../components/common/StatusBarScrim';
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
      >
        <Text style={styles.headerTitle}>Search</Text>

        <View style={styles.searchContainer}>
          <SearchIcon color={COLORS.text.secondary} size={20} />
          <TextInput
            style={styles.searchInput}
            placeholder="Songs, artists, albums..."
            placeholderTextColor={COLORS.text.secondary}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => searchNow(query)}
            returnKeyType="search"
            autoCorrect={false}
          />
          {query ? (
            <TouchableOpacity onPress={clear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X color={COLORS.text.secondary} size={20} />
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
            <Text style={styles.sectionTitle}>Browse Audia</Text>

            <View style={styles.categoriesGrid}>
              {BROWSE_CATEGORIES.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={styles.categoryCardWrapper}
                  activeOpacity={0.8}
                  onPress={() => searchNow(category.query)}
                >
                  <LinearGradient
                    colors={[`${category.color}33`, 'rgba(9, 11, 11, 0.9)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.categoryCard}
                  >
                    <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
                    <Text style={styles.categoryName}>{category.name}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : (
          <>
            {error && (
              <TouchableOpacity activeOpacity={0.8} onPress={retry}>
                <GlassCard intensity={20} style={styles.stateCard}>
                  <Text style={styles.stateText}>{error}</Text>
                  <Text style={styles.stateHint}>Tap to try again</Text>
                </GlassCard>
              </TouchableOpacity>
            )}

            {isSearching && !hasResults && (
              <View style={styles.stateCenter}>
                <ActivityIndicator color={COLORS.text.secondary} />
              </View>
            )}

            {!isSearching && !error && !hasResults && (
              <GlassCard intensity={20} style={styles.stateCard}>
                <Text style={styles.stateText}>No results for "{query.trim()}"</Text>
                <Text style={styles.stateHint}>Try a different spelling or filter</Text>
              </GlassCard>
            )}

            {results.tracks.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Songs</Text>
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
                <Text style={styles.sectionTitle}>Artists</Text>
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
                <Text style={styles.sectionTitle}>Albums</Text>
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
                <Text style={styles.sectionTitle}>Playlists</Text>
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
    paddingHorizontal: SIZES.md,
  },
  headerTitle: {
    fontFamily: FONTS.medium,
    fontSize: 28,
    color: COLORS.text.primary,
    marginBottom: SIZES.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: SIZES.radius.md,
    paddingHorizontal: SIZES.md,
    height: 56,
    marginBottom: SIZES.lg,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: COLORS.text.primary,
    marginLeft: SIZES.sm,
  },
  filtersContainer: {
    marginBottom: SIZES.xl,
  },
  sectionTitle: {
    fontFamily: FONTS.medium,
    fontSize: 18,
    color: COLORS.text.primary,
    marginBottom: SIZES.md,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryCardWrapper: {
    width: '48%',
    marginBottom: SIZES.md,
  },
  categoryCard: {
    height: 100,
    padding: SIZES.md,
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    overflow: 'hidden',
    borderRadius: SIZES.radius.md,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  categoryDot: {
    position: 'absolute',
    top: SIZES.md,
    left: SIZES.md,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  categoryName: {
    fontFamily: FONTS.medium,
    fontSize: 16,
    color: COLORS.text.primary,
  },
  resultsList: {
    marginBottom: SIZES.lg,
  },
  stateCard: {
    padding: SIZES.md,
    marginBottom: SIZES.lg,
  },
  stateText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.text.primary,
  },
  stateHint: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.text.secondary,
    marginTop: 4,
  },
  stateCenter: {
    paddingVertical: SIZES.xl,
    alignItems: 'center',
  },
});
