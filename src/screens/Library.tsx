import React, { useCallback, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, X, Trash2, Download, Share2, ChevronRight, ListMusic, DownloadCloud, Heart, Music2, Play } from 'lucide-react-native';
import { COLORS, SIZES, FONTS, TYPE, SHADOWS } from '../constants/theme';
import { Pill } from '../components/common/Pill';
import { TrackRow } from '../components/lists/TrackRow';
import { MiniPlayer } from '../components/player/MiniPlayer';
import { StatusBarScrim } from '../components/common/StatusBarScrim';
import { Artwork } from '../components/common/Artwork';
import { EmptyState } from '../components/common/UI';
import { Playlist, Track } from '../core/types';
import { usePlayer } from '../hooks/usePlayer';
import { useLibrary } from '../hooks/useLibrary';
import { DownloadService } from '../services/DownloadService';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type LibraryStackParams = {
  Playlist: { playlistId: string };
  NowPlaying: undefined;
};

const FILTERS = ['Playlists', 'Artists', 'Albums', 'Downloaded'];

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<LibraryStackParams>>();
  const [activeFilter, setActiveFilter] = useState('Playlists');
  const { playTrack, currentTrack, isPlaying, togglePlayPause, isLoading } = usePlayer();
  const {
    playlists,
    likedPlaylist,
    liked,
    recentlyPlayed,
    importPlaylist,
    importing,
    importError,
    clearImportError,
    deletePlaylist,
    touchPlaylist,
    createPlaylist,
  } = useLibrary();

  const [showImport, setShowImport] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [downloadedTracks, setDownloadedTracks] = useState<Track[]>([]);
  /** Playlists have their own page, so a tap navigates rather than expanding. */
  const openPlaylist = useCallback(
    (playlist: Playlist) => {
      touchPlaylist(playlist.id);
      navigation.navigate('Playlist', { playlistId: playlist.id });
    },
    [navigation, touchPlaylist]
  );

  // "Liked Songs" always leads, then the user's own and imported playlists.
  const allPlaylists = useMemo<Playlist[]>(
    () => [
      likedPlaylist,
      // Most recently opened or changed first, so recents read as playlists.
      ...[...playlists].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)),
    ],
    [likedPlaylist, playlists]
  );

  /** Artists and albums are derived from what is actually in the library. */
  const derived = useMemo(() => {
    const tracks = [...liked, ...playlists.flatMap((p) => p.tracks), ...recentlyPlayed];

    const artists = new Map<string, { name: string; image: string; count: number }>();
    const albums = new Map<string, { name: string; artist: string; image: string; count: number }>();

    for (const t of tracks) {
      const a = artists.get(t.artist.name);
      if (a) a.count++;
      else artists.set(t.artist.name, { name: t.artist.name, image: t.albumImageUrl, count: 1 });

      if (t.album) {
        const al = albums.get(t.album);
        if (al) al.count++;
        else
          albums.set(t.album, {
            name: t.album,
            artist: t.artist.name,
            image: t.albumImageUrl,
            count: 1,
          });
      }
    }

    return {
      artists: [...artists.values()].sort((x, y) => y.count - x.count),
      albums: [...albums.values()].sort((x, y) => y.count - x.count),
    };
  }, [liked, playlists, recentlyPlayed]);

  const onPlayPlaylist = (playlist: Playlist) => {
    if (!playlist.tracks.length) return;
    playTrack(playlist.tracks[0], { tracks: playlist.tracks, label: playlist.name });
  };

  // Keep Downloaded tab live.
  React.useEffect(() => {
    if (activeFilter !== 'Downloaded') return;
    let cancelled = false;
    (async () => {
      const list = await DownloadService.getDownloadedTracks();
      if (!cancelled) setDownloadedTracks(list);
    })();
    return () => { cancelled = true; };
  }, [activeFilter]);

  const refreshDownloads = React.useCallback(async () => {
    const list = await DownloadService.getDownloadedTracks();
    setDownloadedTracks(list);
  }, []);

  /** Create an empty playlist, then open its page so it can be filled. */
  const onCreatePlaylist = () => {
    const name = newPlaylistName.trim();
    if (!name) return;

    const playlist = createPlaylist(name);
    setNewPlaylistName('');
    setShowImport(false);
    Keyboard.dismiss();
    navigation.navigate('Playlist', { playlistId: playlist.id });
  };

  const onImport = async () => {
    const url = importUrl.trim();
    if (!url) return;

    try {
      await importPlaylist(url);
      setImportUrl('');
      setShowImport(false);
    } catch {
      // importError is rendered inline below.
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + SIZES.lg, paddingBottom: SIZES.bottomInset }
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Your Library</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              setShowImport((v) => !v);
              clearImportError();
            }}
            accessibilityRole="button"
            accessibilityLabel={showImport ? 'Close create panel' : 'Create or import a playlist'}
            accessibilityState={{ expanded: showImport }}
          >
            <View style={[styles.addButtonCircle, showImport && styles.addButtonCircleActive]}>
              {showImport ? (
                <X color={COLORS.text.primary} size={SIZES.icon.md} />
              ) : (
                <Plus color="#04211D" size={SIZES.icon.md} strokeWidth={2.4} />
              )}
            </View>
          </TouchableOpacity>
        </View>

        {showImport && (
          <View style={styles.importCard}>
            <Text style={styles.importTitle}>New playlist</Text>
            <View style={styles.importRow}>
              <TextInput
                style={styles.importInput}
                placeholder="Playlist name"
                placeholderTextColor={COLORS.text.muted}
                value={newPlaylistName}
                onChangeText={setNewPlaylistName}
                onSubmitEditing={onCreatePlaylist}
                returnKeyType="done"
                maxLength={60}
                accessibilityLabel="Playlist name"
              />
              <TouchableOpacity
                style={[styles.importButton, !newPlaylistName.trim() && styles.importButtonDisabled]}
                onPress={onCreatePlaylist}
                disabled={!newPlaylistName.trim()}
                accessibilityRole="button"
                accessibilityLabel="Create playlist"
              >
                <Text style={styles.importButtonText}>Create</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.panelDivider} />

            <Text style={styles.importTitle}>Import a public playlist</Text>
            <View style={styles.importRow}>
              <TextInput
                style={styles.importInput}
                placeholder="Paste a playlist or album link"
                placeholderTextColor={COLORS.text.muted}
                value={importUrl}
                onChangeText={setImportUrl}
                onSubmitEditing={onImport}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                accessibilityLabel="Playlist link"
              />
              <TouchableOpacity
                style={styles.importButton}
                onPress={onImport}
                disabled={importing}
                accessibilityRole="button"
                accessibilityLabel="Import playlist"
              >
                {importing ? (
                  <ActivityIndicator size="small" color="#04211D" />
                ) : (
                  <Text style={styles.importButtonText}>Add</Text>
                )}
              </TouchableOpacity>
            </View>
            {importError && <Text style={styles.importError}>{importError}</Text>}
          </View>
        )}

        <View style={styles.filtersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {FILTERS.map((filter) => (
              <Pill
                key={filter}
                label={filter}
                isActive={activeFilter === filter}
                onPress={() => setActiveFilter(filter)}
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles.listContainer}>
          {activeFilter === 'Playlists' &&
            (allPlaylists.length ? (
              allPlaylists.map((playlist) =>
                // Liked Songs leads with the teal card treatment from the
                // reference; user playlists keep the standard artwork row.
                playlist.id === 'liked' ? (
                  <TouchableOpacity
                    key={playlist.id}
                    style={[styles.row, styles.likedCard]}
                    activeOpacity={0.7}
                    onPress={() => openPlaylist(playlist)}
                    accessibilityRole="button"
                    accessibilityLabel={`Open playlist ${playlist.name}, ${playlist.tracks.length} tracks`}
                  >
                    <View style={styles.likedArtworkBadge}>
                      <Heart color={COLORS.accent.primary} size={22} fill={COLORS.accent.primary} />
                    </View>
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{playlist.name}</Text>
                      <Text style={styles.rowSubtitle} numberOfLines={1}>
                        {playlist.tracks.length}{' '}
                        {playlist.tracks.length === 1 ? 'song' : 'songs'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.likedPlayCircle}
                      onPress={(e) => {
                        e.stopPropagation();
                        onPlayPlaylist(playlist);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Play Liked Songs"
                    >
                      <Play color={COLORS.accent.primary} size={15} fill={COLORS.accent.primary} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ) : (
                  <View key={playlist.id} style={styles.row}>
                    <TouchableOpacity
                      style={styles.rowMain}
                      activeOpacity={0.7}
                      onPress={() => openPlaylist(playlist)}
                      onLongPress={() => onPlayPlaylist(playlist)}
                      accessibilityRole="button"
                      accessibilityLabel={`Open playlist ${playlist.name}, ${playlist.tracks.length} tracks`}
                    >
                      {playlist.coverImageUrl && playlist.coverImageUrl !== 'liked_songs_gradient' ? (
                        <Artwork uri={playlist.coverImageUrl} size={56} radius={12} />
                      ) : (
                        <View style={[styles.rowArtwork, styles.rowArtworkTinted]}>
                          <ListMusic color={COLORS.accent.primary} size={SIZES.icon.sm + 2} />
                        </View>
                      )}
                      <View style={styles.rowInfo}>
                        <Text style={styles.rowTitle} numberOfLines={1}>{playlist.name}</Text>
                        <Text style={styles.rowSubtitle} numberOfLines={1}>
                          Playlist • {playlist.creator} • {playlist.tracks.length}
                        </Text>
                      </View>
                      <ChevronRight color={COLORS.text.muted} size={SIZES.icon.sm} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rowAction}
                      onPress={() => deletePlaylist(playlist.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete playlist ${playlist.name}`}
                    >
                      <Trash2 color={COLORS.text.muted} size={SIZES.icon.sm} />
                    </TouchableOpacity>
                  </View>
                )
              )
            ) : (
              <View style={styles.createEmptyWrap}>
                {/* The reference's create-first-playlist composition: stacked
                    glass cards with a floating note glyph, headline, support
                    line, outlined accent Create button. */}
                <View style={styles.stackWrap}>
                  <View style={[styles.stackCard, styles.stackCardBack]} />
                  <View style={[styles.stackCard, styles.stackCardFront]}>
                    <Music2 color={COLORS.accent.primary} size={26} strokeWidth={2} />
                  </View>
                </View>
                <Text style={styles.createTitle}>Your library is empty</Text>
                <Text style={styles.createHint}>
                  Create playlists and save songs to build your personal collection.
                </Text>
                <TouchableOpacity
                  style={styles.createButton}
                  activeOpacity={0.8}
                  onPress={() => {
                    setShowImport(true);
                    clearImportError();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Create Playlist"
                >
                  <Plus color={COLORS.accent.primary} size={SIZES.icon.sm + 2} strokeWidth={2.4} />
                  <Text style={styles.createButtonText}>Create Playlist</Text>
                </TouchableOpacity>
              </View>
            ))}

          {activeFilter === 'Artists' &&
            (derived.artists.length ? (
              derived.artists.map((artist) => (
                <TouchableOpacity
                  key={artist.name}
                  style={styles.row}
                  activeOpacity={0.7}
                  onPress={() => {
                    // Real action: search this artist so their songs come up.
                    navigation.navigate('SearchTab' as never);
                    (navigation.navigate as (name: string, params?: object) => void)('SearchTab', {
                      browseQuery: artist.name,
                    });
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Search artist ${artist.name}`}
                >
                  <Artwork uri={artist.image} size={56} round />
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{artist.name}</Text>
                    <Text style={styles.rowSubtitle} numberOfLines={1}>
                      Artist • {artist.count} {artist.count === 1 ? 'song' : 'songs'}
                    </Text>
                  </View>
                  <ChevronRight color={COLORS.text.muted} size={SIZES.icon.sm} />
                </TouchableOpacity>
              ))
            ) : (
              <EmptyState
                title="No artists yet"
                hint="Artists appear here as you save music."
              />
            ))}

          {activeFilter === 'Albums' &&
            (derived.albums.length ? (
              derived.albums.map((album) => (
                <TouchableOpacity
                  key={album.name}
                  style={styles.row}
                  activeOpacity={0.7}
                  onPress={() => {
                    navigation.navigate('SearchTab' as never);
                    (navigation.navigate as (name: string, params?: object) => void)('SearchTab', {
                      browseQuery: `${album.name} ${album.artist}`,
                    });
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Search album ${album.name}`}
                >
                  <Artwork uri={album.image} size={56} radius={12} />
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{album.name}</Text>
                    <Text style={styles.rowSubtitle} numberOfLines={1}>
                      Album • {album.artist}
                    </Text>
                  </View>
                  <ChevronRight color={COLORS.text.muted} size={SIZES.icon.sm} />
                </TouchableOpacity>
              ))
            ) : (
              <EmptyState
                title="No albums yet"
                hint="Albums appear here as you save music."
              />
            ))}

          {activeFilter === 'Downloaded' && (
            downloadedTracks.length ? (
              <View>
                {downloadedTracks.map((track) => (
                  <View key={track.id} style={styles.downloadedRow}>
                    <View style={{ flex: 1 }}>
                      <TrackRow
                        track={track}
                        onPress={(t) => playTrack(t, { tracks: downloadedTracks, label: 'Downloaded' })}
                        isPlaying={currentTrack?.id === track.id && isPlaying}
                      />
                    </View>
                    <TouchableOpacity
                      style={styles.rowAction}
                      onPress={async () => { await DownloadService.remove(track.id); await refreshDownloads(); }}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove download ${track.title}`}
                    >
                      <Trash2 color={COLORS.text.muted} size={SIZES.icon.sm} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rowAction}
                      onPress={() => DownloadService.shareTrack(track)}
                      accessibilityRole="button"
                      accessibilityLabel={`Share ${track.title}`}
                    >
                      <Share2 color={COLORS.text.muted} size={SIZES.icon.sm} />
                    </TouchableOpacity>
                  </View>
                ))}
                <Text style={styles.downloadedHint}>
                  Tap a track to play offline — zero network latency. Downloads survive app restarts.
                </Text>
              </View>
            ) : (
              <EmptyState
                Icon={DownloadCloud}
                title="No downloads yet"
                hint="Open any track's ••• menu → Download to save it for offline, instant playback."
              />
            )
          )}
        </View>
      </ScrollView>

      <StatusBarScrim />

      {currentTrack && (
        <MiniPlayer
          track={currentTrack}
          isPlaying={isPlaying}
          isLoading={isLoading}
          onPlayPause={togglePlayPause}
          onPress={() => navigation.navigate('NowPlaying')}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.md,
  },
  headerTitle: {
    fontFamily: FONTS.bold,
    fontSize: TYPE.title1.fontSize,
    lineHeight: TYPE.title1.lineHeight,
    color: COLORS.text.primary,
  },
  addButton: {
    width: SIZES.touchTarget,
    height: SIZES.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent.primary,
  },
  addButtonCircleActive: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.hairline,
  },
  importCard: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius.lg,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    padding: SIZES.md,
    marginBottom: SIZES.md,
  },
  importTitle: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.subheadline.fontSize,
    color: COLORS.text.primary,
    marginBottom: SIZES.sm,
  },
  importRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  importInput: {
    flex: 1,
    height: 44,
    fontFamily: FONTS.regular,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.text.primary,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: SIZES.radius.sm,
    paddingHorizontal: SIZES.sm,
  },
  importButton: {
    marginLeft: SIZES.sm,
    height: 44,
    minWidth: 72,
    paddingHorizontal: SIZES.md,
    borderRadius: SIZES.radius.sm,
    backgroundColor: COLORS.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importButtonDisabled: {
    opacity: 0.4,
  },
  importButtonText: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.callout.fontSize,
    color: '#04211D',
  },
  importError: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.status.error,
    marginTop: SIZES.sm,
  },
  panelDivider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginVertical: SIZES.md,
  },
  filtersContainer: {
    marginBottom: SIZES.lg,
  },
  listContainer: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SIZES.sm + 2,
    minHeight: SIZES.touchTarget + 24,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowArtwork: {
    width: 56,
    height: 56,
    borderRadius: SIZES.radius.sm,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowArtworkTinted: {
    backgroundColor: COLORS.accent.soft,
    borderWidth: 1,
    borderColor: 'rgba(61, 214, 195, 0.22)',
  },
  likedArtworkBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(24, 229, 213, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(24, 229, 213, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  likedPlayCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: COLORS.accent.primary,
    backgroundColor: '#071518',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.accent.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  likedCard: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(24, 229, 213, 0.16)',
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm + 2,
    marginBottom: SIZES.md,
  },
  createEmptyWrap: {
    alignItems: 'center',
    paddingVertical: SIZES.xxl,
    paddingHorizontal: SIZES.md,
  },
  stackWrap: {
    width: 120,
    height: 130,
    marginBottom: SIZES.lg,
  },
  stackCard: {
    position: 'absolute',
    width: 84,
    height: 110,
    borderRadius: SIZES.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackCardBack: {
    left: 4,
    top: 12,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    transform: [{ rotate: '-9deg' }],
  },
  stackCardFront: {
    right: 4,
    top: 0,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(61, 214, 195, 0.30)',
    transform: [{ rotate: '7deg' }],
    ...SHADOWS.ambient,
  },
  createTitle: {
    fontFamily: FONTS.semibold,
    fontSize: TYPE.title3.fontSize,
    color: COLORS.text.primary,
    textAlign: 'center',
  },
  createHint: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.callout.fontSize,
    lineHeight: 20,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginTop: SIZES.xs,
    marginBottom: SIZES.lg,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
    minHeight: SIZES.touchTarget + 2,
    paddingHorizontal: SIZES.xl,
    borderRadius: SIZES.radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(61, 214, 195, 0.45)',
  },
  createButtonText: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.accent.primary,
  },
  rowInfo: {
    flex: 1,
    marginLeft: SIZES.md,
    justifyContent: 'center',
  },
  rowTitle: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.headline.fontSize,
    color: COLORS.text.primary,
    marginBottom: 2,
  },
  rowSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.text.secondary,
  },
  rowAction: {
    padding: SIZES.sm,
    marginLeft: SIZES.xs,
  },
  downloadedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  downloadedHint: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.text.muted,
    marginTop: SIZES.md,
    paddingHorizontal: SIZES.sm,
    lineHeight: 18,
  },
});
