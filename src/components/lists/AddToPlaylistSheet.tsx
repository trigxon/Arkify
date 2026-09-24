import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Check, Heart, ListMusic, Plus, Download, Trash2, Share } from 'lucide-react-native';
import { COLORS, SIZES, FONTS, TYPE } from '../../constants/theme';
import { BottomSheet } from '../common/BottomSheet';
import { Track } from '../../core/types';
import { useLibrary } from '../../hooks/useLibrary';
import { DownloadService } from '../../services/DownloadService';

type Props = {
  /** The track being filed. Null closes the sheet. */
  track: Track | null;
  onClose: () => void;
};

/**
 * "Add to playlist" for a single track.
 *
 * Deliberately a plain Modal rather than a new navigation route: it is opened
 * from track rows on several screens, and a route would force each of them to
 * know about it.
 */
export const AddToPlaylistSheet: React.FC<Props> = ({ track, onClose }) => {
  const {
    playlists,
    addToPlaylist,
    removeFromPlaylist,
    createPlaylist,
    toggleLike,
    isLiked,
  } = useLibrary();

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  /** 0..1 — shown as a percentage on the download row while in flight. */
  const [downloadProgress, setDownloadProgress] = useState(0);

  /**
   * Keyboard height, applied as bottom inset on the sheet.
   *
   * KeyboardAvoidingView is unreliable inside a Modal on Android, so the sheet
   * is lifted explicitly by however much the keyboard actually covers.
   */
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) =>
      setKeyboardHeight(e.endCoordinates.height)
    );
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const liked = track ? isLiked(track.id) : false;

  useEffect(() => {
    if (!track) return;
    setDownloaded(DownloadService.isDownloaded(track.id));
    setDownloadError(null);
    setDownloading(false);
    setDownloadProgress(0);
  }, [track?.id]);

  /** Newest-first, matching how Library orders them. */
  const ordered = useMemo(
    () => [...playlists].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)),
    [playlists]
  );

  const close = useCallback(() => {
    Keyboard.dismiss();
    setCreating(false);
    setNewName('');
    onClose();
  }, [onClose]);

  /** Tapping a playlist toggles membership: add if absent, remove if present. */
  const toggleIn = useCallback(
    (playlistId: string, alreadyIn: boolean) => {
      if (!track) return;
      if (alreadyIn) removeFromPlaylist(playlistId, track.id);
      else addToPlaylist(playlistId, track);
    },
    [track, addToPlaylist, removeFromPlaylist]
  );

  const createAndAdd = useCallback(() => {
    const name = newName.trim();
    if (!name || !track) return;

    // Create it already containing the track, so this is one step not two.
    createPlaylist(name, [track]);
    Keyboard.dismiss();
    setNewName('');
    setCreating(false);
    close();
  }, [newName, track, createPlaylist, close]);

  return (
    <BottomSheet
      visible={track !== null}
      onClose={close}
      title="Add to playlist"
      subtitle={track?.title}
      keyboardHeight={keyboardHeight}
    >
      {creating ? (
        <View style={styles.createRow}>
          <TextInput
            style={styles.input}
            value={newName}
            onChangeText={setNewName}
            placeholder="Playlist name"
            placeholderTextColor={COLORS.text.muted}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={createAndAdd}
            maxLength={60}
            accessibilityLabel="New playlist name"
          />
          <TouchableOpacity
            style={[styles.createButton, !newName.trim() && styles.disabled]}
            onPress={createAndAdd}
            disabled={!newName.trim()}
            accessibilityRole="button"
            accessibilityLabel="Create playlist"
          >
            <Text style={styles.createButtonText}>Create</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.7}
          onPress={() => setCreating(true)}
          accessibilityRole="button"
          accessibilityLabel="New playlist"
        >
          <View style={styles.rowIcon}>
            <Plus color={COLORS.accent.primary} size={SIZES.icon.sm + 2} />
          </View>
          <Text style={styles.rowLabel}>New playlist</Text>
        </TouchableOpacity>
      )}

      <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
        {/* Quick actions: Download / Share */}
        {!!track && (
          <>
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.7}
              disabled={downloading}
              onPress={async () => {
                if (!track) return;
                if (downloaded) {
                  await DownloadService.remove(track.id);
                  setDownloaded(false);
                  setDownloadProgress(0);
                } else {
                  setDownloading(true);
                  setDownloadError(null);
                  setDownloadProgress(0);
                  try {
                    await DownloadService.download(track, (p) =>
                      setDownloadProgress(p)
                    );
                    setDownloaded(true);
                  } catch (e: unknown) {
                    const msg =
                      e instanceof Error ? e.message : 'Download failed';
                    setDownloadError(msg);
                  } finally {
                    setDownloading(false);
                  }
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={
                downloaded ? 'Remove download' : 'Download for offline playback'
              }
            >
              <View style={styles.rowIcon}>
                {downloaded ? (
                  <Trash2 color={COLORS.accent.primary} size={SIZES.icon.sm + 2} />
                ) : (
                  <Download color={COLORS.text.primary} size={SIZES.icon.sm + 2} />
                )}
              </View>
              <View style={styles.rowTextWrap}>
                <Text style={styles.rowLabel}>
                  {downloading
                    ? `Downloading… ${Math.round(downloadProgress * 100)}%`
                    : downloaded
                      ? 'Remove download'
                      : 'Download'}
                </Text>
                <Text style={styles.rowMeta}>
                  {downloaded ? 'Available offline' : 'Save for offline playback'}
                </Text>
                {downloading && (
                  <View style={styles.progressBar}>
                    <View
                      style={[styles.progressFill, { width: `${Math.max(4, downloadProgress * 100)}%` }]}
                    />
                  </View>
                )}
              </View>
              {downloaded && <Check color={COLORS.accent.primary} size={SIZES.icon.xs + 4} />}
            </TouchableOpacity>
            {downloadError && <Text style={styles.errorText}>{downloadError}</Text>}
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.7}
              onPress={() => track && DownloadService.shareTrack(track)}
              accessibilityRole="button"
              accessibilityLabel="Share track"
            >
              <View style={styles.rowIcon}>
                <Share color={COLORS.text.primary} size={SIZES.icon.sm + 2} />
              </View>
              <Text style={styles.rowLabel}>Share</Text>
            </TouchableOpacity>
            <View style={styles.separator} />
          </>
        )}
        {/* Liked Songs is synthetic, so it toggles the like instead. */}
        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.7}
          onPress={() => track && toggleLike(track)}
          accessibilityRole="button"
          accessibilityLabel={liked ? 'Remove from liked songs' : 'Add to liked songs'}
        >
          <View style={styles.rowIcon}>
            <Heart
              color={liked ? COLORS.accent.primary : COLORS.text.primary}
              fill={liked ? COLORS.accent.primary : 'transparent'}
              size={SIZES.icon.sm + 2}
            />
          </View>
          <Text style={styles.rowLabel}>Liked Songs</Text>
          {liked && <Check color={COLORS.accent.primary} size={SIZES.icon.xs + 4} />}
        </TouchableOpacity>

        {ordered.map((playlist) => {
          const alreadyIn = playlist.tracks.some((t) => t.id === track?.id);

          return (
            <TouchableOpacity
              key={playlist.id}
              style={styles.row}
              activeOpacity={0.7}
              onPress={() => toggleIn(playlist.id, alreadyIn)}
              accessibilityRole="button"
              accessibilityLabel={`${alreadyIn ? 'Remove from' : 'Add to'} ${playlist.name}`}
            >
              <View style={styles.rowIcon}>
                <ListMusic color={COLORS.text.primary} size={SIZES.icon.sm + 2} />
              </View>
              <View style={styles.rowTextWrap}>
                <Text style={styles.rowLabel} numberOfLines={1}>
                  {playlist.name}
                </Text>
                <Text style={styles.rowMeta}>
                  {playlist.tracks.length}{' '}
                  {playlist.tracks.length === 1 ? 'track' : 'tracks'}
                </Text>
              </View>
              {alreadyIn && <Check color={COLORS.accent.primary} size={SIZES.icon.xs + 4} />}
            </TouchableOpacity>
          );
        })}

        {ordered.length === 0 && !creating && (
          <Text style={styles.empty}>
            No playlists yet. Create one above.
          </Text>
        )}
      </ScrollView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  list: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SIZES.sm + 4,
    gap: SIZES.md,
    minHeight: SIZES.touchTarget,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceElevated,
  },
  rowTextWrap: {
    flex: 1,
  },
  rowLabel: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: TYPE.body.fontSize,
    color: COLORS.text.primary,
  },
  rowMeta: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
    marginBottom: SIZES.sm,
  },
  input: {
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
  createButton: {
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm + 4,
    borderRadius: SIZES.radius.sm,
    backgroundColor: COLORS.accent.primary,
    minHeight: SIZES.touchTarget - 4,
    justifyContent: 'center',
  },
  createButtonText: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.callout.fontSize,
    color: 'COLORS.text.dark',
  },
  disabled: {
    opacity: 0.4,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginVertical: SIZES.sm,
  },
  errorText: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.status.error,
    marginTop: 2,
    marginLeft: SIZES.md,
  },
  progressBar: {
    height: 3,
    borderRadius: 2,
    backgroundColor: COLORS.glassBorder,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.accent.primary,
  },
  empty: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.text.secondary,
    paddingVertical: SIZES.lg,
  },
});
