import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ListPlus,
  ListStart,
  ListEnd,
  Radio,
  Heart,
  User,
  Share,
  Disc3,
  Timer,
  Trash2,
  Check,
  Download,
  Image as ImageIcon,
} from 'lucide-react-native';
import { COLORS, SIZES, FONTS, TYPE } from '../../constants/theme';
import { BottomSheet } from '../common/BottomSheet';
import { ShareSheet, ShareRequest } from '../share/ShareSheet';
import { Track } from '../../core/types';
import { useLibrary } from '../../hooks/useLibrary';
import { DownloadService } from '../../services/DownloadService';
import { SleepTimer } from '../../services/SleepTimerService';

type Props = {
  /** The track the actions apply to. Null closes the sheet. */
  track: Track | null;
  onClose: () => void;
  /** Queues the track directly after whatever is playing. */
  onPlayNext?: (track: Track) => void;
  /** Appends the track to the end of the queue. */
  onAddToQueue?: (track: Track) => void;
  /** Builds and starts a taste-ranked station around the track. */
  onGoToRadio?: (track: Track) => void;
  /** Navigates to the artist's songs via a real search. */
  onGoToArtist?: (track: Track) => void;
  /** Opens the album's page via a real search. */
  onViewAlbum?: (track: Track) => void;
  /**
   * Starts the sleep timer; null cancels it. The parent owns the actual
   * pause callback (its own togglePlayPause) — the sheet only decides when.
   */
  onSleepTimer?: (minutes: number | null) => void;
  /** Opens straight into the sleep-timer picker (player's timer shortcut). */
  initial?: 'actions' | 'sleep';
};

const SLEEP_OPTIONS = [15, 30, 45, 60] as const;

/**
 * The track action sheet, per the reference: elevated dark surface, grabber,
 * aligned icon rows, one destructive action at the bottom.
 *
 * Every row maps to real functionality — no decorative entries.
 */
export const TrackActionsSheet: React.FC<Props> = ({
  track,
  onClose,
  onPlayNext,
  onAddToQueue,
  onGoToRadio,
  onGoToArtist,
  onViewAlbum,
  onSleepTimer,
  initial = 'actions',
}) => {
  const { playlists, addToPlaylist, removeFromPlaylist, createPlaylist, isLiked, toggleLike } =
    useLibrary();

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [sleepPickerOpen, setSleepPickerOpen] = useState(false);
  /** Self-contained share-card sheet — works from any screen that mounts this. */
  const [shareCard, setShareCard] = useState<ShareRequest | null>(null);
  /** Ticks the "active timer" row's label while a timer runs. */
  const [remainingMs, setRemainingMs] = useState<number | null>(SleepTimer.remainingMs);

  useEffect(() => SleepTimer.subscribe(() => setRemainingMs(SleepTimer.remainingMs)), []);

  // Each open honours where it was opened from (player timer vs ••• menu).
  useEffect(() => {
    setSleepPickerOpen(initial === 'sleep');
    setCreating(false);
  }, [track?.id, initial]);

  const liked = track ? isLiked(track.id) : false;

  const close = () => {
    setCreating(false);
    setSleepPickerOpen(false);
    onClose();
  };

  const startTimer = (minutes: number) => {
    onSleepTimer?.(minutes);
    close();
  };

  const cancelTimer = () => {
    onSleepTimer?.(null);
    close();
  };

  /**
   * Destructive removal asks first, matching History/Downloads patterns.
   * Unlike + drop the track from every local playlist it appears in.
   */
  const removeFromLibrary = (t: Track) => {
    if (isLiked(t.id)) toggleLike(t);
    for (const p of playlists) {
      if (p.tracks.some((x) => x.id === t.id)) {
        removeFromPlaylist(p.id, t.id);
      }
    }
    close();
  };

  const confirmRemoveFromLibrary = (t: Track) => {
    const message = isLiked(t.id)
      ? `Remove “${t.title}” from Liked Songs?`
      : `Remove “${t.title}” from your library and every playlist?`;

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(message)) removeFromLibrary(t);
      return;
    }
    Alert.alert('Remove from library?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeFromLibrary(t) },
    ]);
  };

  const sleepActive = remainingMs !== null;

  return (
    <>
    {/* No title bar: the reference's action sheet opens straight into its rows.
        The sheet stays mounted when track becomes null, so the slide-out
        animation plays instead of the sheet vanishing. */}
    <BottomSheet visible={track !== null} onClose={close}>
      {track ? (
      <>
      {sleepPickerOpen ? (
        <>
          <Text style={styles.pickerHint}>Pause playback after</Text>
          <View style={styles.pickerRow}>
            {SLEEP_OPTIONS.map((m) => (
              <TouchableOpacity
                key={m}
                style={styles.pickerChip}
                activeOpacity={0.8}
                onPress={() => startTimer(m)}
                accessibilityRole="button"
                accessibilityLabel={`Sleep timer ${m} minutes`}
              >
                <Text style={styles.pickerChipText}>{m} min</Text>
              </TouchableOpacity>
            ))}
          </View>
          {sleepActive && (
            <TouchableOpacity
              style={styles.backRow}
              onPress={cancelTimer}
              accessibilityRole="button"
              accessibilityLabel="Cancel sleep timer"
            >
              <Text style={[styles.backText, { color: COLORS.status.error }]}>
                Cancel active timer
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.backRow}
            onPress={() => setSleepPickerOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Back to actions"
          >
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        </>
      ) : creating ? (
        <>
          <Text style={styles.pickerHint}>Name your new playlist</Text>
          <View style={styles.createRow}>
            <TextInput
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
              onSubmitEditing={() => {
                const name = newName.trim();
                if (!name || !track) return;
                createPlaylist(name, [track]);
                close();
              }}
              placeholder="Playlist name"
              placeholderTextColor={COLORS.text.muted}
              autoFocus
              returnKeyType="done"
              maxLength={60}
              accessibilityLabel="New playlist name"
            />
            <TouchableOpacity
              style={[styles.createBtn, !newName.trim() && styles.disabled]}
              disabled={!newName.trim()}
              onPress={() => {
                const name = newName.trim();
                if (!name || !track) return;
                createPlaylist(name, [track]);
                close();
              }}
              accessibilityRole="button"
              accessibilityLabel="Create playlist"
            >
              <Text style={styles.createBtnText}>Create</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          {/* Add to playlist expands inline (create-new) and toggles existing
              playlists right here, so only one sheet is ever mounted. */}
          <SheetRow
            Icon={ListPlus}
            label={creating ? 'New playlist' : 'Add to playlist'}
            onPress={() => setCreating(true)}
          />

          {!creating &&
            playlists.map((playlist) => {
              const alreadyIn = playlist.tracks.some((t) => t.id === track.id);
              return (
                <TouchableOpacity
                  key={playlist.id}
                  style={[styles.row, styles.subRow]}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (alreadyIn) removeFromPlaylist(playlist.id, track.id);
                    else addToPlaylist(playlist.id, track);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${alreadyIn ? 'Remove from' : 'Add to'} ${playlist.name}`}
                >
                  <View style={[styles.rowIcon, styles.rowIconBare]}>
                    <Text style={styles.playlistCount}>{playlist.tracks.length}</Text>
                  </View>
                  <Text style={styles.rowLabel} numberOfLines={1}>
                    {playlist.name}
                  </Text>
                  {alreadyIn && <Check color={COLORS.accent.primary} size={16} />}
                </TouchableOpacity>
              );
            })}

          {!creating && (
            <>
              <SheetRow
                Icon={Heart}
                label={liked ? 'Liked' : 'Like'}
                accent={liked}
                onPress={() => toggleLike(track)}
                trailing={liked ? <Check color={COLORS.accent.primary} size={16} /> : undefined}
              />
              {/* The Spotify signature trio: queue control + station. */}
              {onPlayNext && (
                <SheetRow
                  Icon={ListStart}
                  label="Play next"
                  onPress={() => {
                    onPlayNext(track);
                    close();
                  }}
                />
              )}
              {onAddToQueue && (
                <SheetRow
                  Icon={ListEnd}
                  label="Add to queue"
                  onPress={() => {
                    onAddToQueue(track);
                    close();
                  }}
                />
              )}
              {onGoToRadio && (
                <SheetRow
                  Icon={Radio}
                  label="Go to song radio"
                  accent
                  onPress={() => {
                    onGoToRadio(track);
                    close();
                  }}
                />
              )}
              {onGoToArtist && (
                <SheetRow
                  Icon={User}
                  label="Go to artist"
                  onPress={() => {
                    onGoToArtist(track);
                    close();
                  }}
                />
              )}
              <SheetRow
                Icon={Share}
                label="Share"
                onPress={() => {
                  void DownloadService.shareTrack(track);
                  close();
                }}
              />
              <SheetRow
                Icon={ImageIcon}
                label="Share as card"
                accent
                onPress={() => {
                  setShareCard({
                    kind: 'track',
                    title: track.title,
                    artist: track.artist.name,
                    artworkUri: track.albumImageUrl,
                    contextLabel: 'Shared from Arkify',
                    message: `${track.title} — ${track.artist.name}`,
                  });
                  close();
                }}
              />
              {onViewAlbum && track.album && (
                <SheetRow
                  Icon={Disc3}
                  label="View album"
                  onPress={() => {
                    onViewAlbum(track);
                    close();
                  }}
                />
              )}
              {/* Kept from the previous release: offline downloads are a real
                  feature and this sheet is their only entry point. */}
              <DownloadRow track={track} onDone={close} />
              {onSleepTimer && (
                <SheetRow
                  Icon={Timer}
                  label={
                    sleepActive
                      ? `Sleep timer · ${Math.ceil(remainingMs / 60000)} min left`
                      : 'Sleep timer'
                  }
                  onPress={() => setSleepPickerOpen(true)}
                />
              )}
            </>
          )}
        </>
      )}

      {/* Destructive action stays last, per the reference. */}
      {!creating && !sleepPickerOpen && (
        <SheetRow
          Icon={Trash2}
          label={liked ? 'Remove from Liked Songs' : 'Remove from library'}
          destructive
          onPress={() => confirmRemoveFromLibrary(track)}
        />
      )}
      </>
      ) : null}
    </BottomSheet>

    {/* Rendered outside the action sheet so both can animate independently. */}
    <ShareSheet request={shareCard} onClose={() => setShareCard(null)} />
    </>
  );
};

/**
 * Download / remove-download row with live progress. Kept as its own
 * component so its state survives the sheet staying mounted while other
 * rows are tapped.
 */
const DownloadRow: React.FC<{ track: Track; onDone: () => void }> = ({ track, onDone }) => {
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(DownloadService.isDownloaded(track.id));
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Progress callbacks must not poke state after the sheet is gone.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    setDownloaded(DownloadService.isDownloaded(track.id));
    setProgress(0);
    setError(null);
  }, [track.id]);

  return (
    <View>
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.7}
        disabled={downloading}
        onPress={async () => {
          if (downloaded) {
            await DownloadService.remove(track.id).catch(() => undefined);
            setDownloaded(false);
            return;
          }
          setDownloading(true);
          setError(null);
          try {
            await DownloadService.download(track, (p) => {
              if (alive.current) setProgress(p);
            });
            if (!alive.current) return;
            setDownloaded(true);
            onDone();
          } catch (e: unknown) {
            if (alive.current) setError(e instanceof Error ? e.message : 'Download failed');
          } finally {
            if (alive.current) setDownloading(false);
          }
        }}
        accessibilityRole="button"
        accessibilityLabel={downloaded ? 'Remove download' : 'Download for offline playback'}
      >
        <View style={styles.rowIcon}>
          <Download
            color={downloaded ? COLORS.accent.primary : COLORS.text.primary}
            size={SIZES.icon.md - 2}
            strokeWidth={1.9}
          />
        </View>
        <View style={styles.downloadTextWrap}>
          <Text style={styles.rowLabel}>
            {downloading
              ? `Downloading… ${Math.round(progress * 100)}%`
              : downloaded
                ? 'Remove download'
                : 'Download'}
          </Text>
          <Text style={styles.downloadMeta}>
            {downloaded ? 'Available offline' : 'Save for offline playback'}
          </Text>
          {downloading && (
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${Math.max(4, progress * 100)}%` }]} />
            </View>
          )}
        </View>
        {downloaded && <Check color={COLORS.accent.primary} size={16} />}
      </TouchableOpacity>
      {error ? <Text style={styles.downloadError}>{error}</Text> : null}
    </View>
  );
};

const SheetRow: React.FC<{
  Icon: typeof Heart;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  accent?: boolean;
  trailing?: React.ReactNode;
}> = ({ Icon, label, onPress, destructive = false, accent = false, trailing }) => (
  <TouchableOpacity
    style={styles.row}
    activeOpacity={0.7}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
  >
    <View style={[styles.rowIcon, destructive && styles.rowIconDestructive]}>
      <Icon
        color={
          destructive
            ? COLORS.status.error
            : accent
              ? COLORS.accent.primary
              : COLORS.text.primary
        }
        size={SIZES.icon.md - 2}
        strokeWidth={1.9}
      />
    </View>
    <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>{label}</Text>
    {trailing}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  /* Rows are bare, per the reference: aligned outline icons on the sheet's own
     surface — no icon chips, no extra chrome. */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.lg,
    paddingVertical: SIZES.sm + 4,
    minHeight: SIZES.touchTarget + 8,
  },
  subRow: {
    paddingLeft: SIZES.xxl,
  },
  rowIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconDestructive: {},
  rowIconBare: {},
  playlistCount: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.text.secondary,
  },
  rowLabel: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: TYPE.body.fontSize,
    color: COLORS.text.primary,
  },
  rowLabelDestructive: {
    color: COLORS.status.error,
  },
  destructiveBottom: {
    marginBottom: SIZES.sm,
  },
  pickerHint: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.subheadline.fontSize,
    color: COLORS.text.secondary,
    marginBottom: SIZES.md,
  },
  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SIZES.sm,
    marginBottom: SIZES.md,
  },
  pickerChip: {
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    borderRadius: SIZES.radius.pill,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    minHeight: SIZES.touchTarget - 8,
    justifyContent: 'center',
  },
  pickerChipText: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.text.primary,
  },
  backRow: {
    alignItems: 'center',
    paddingVertical: SIZES.sm,
    minHeight: SIZES.touchTarget - 8,
    justifyContent: 'center',
  },
  backText: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.text.secondary,
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
    marginBottom: SIZES.md,
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
  createBtn: {
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm + 4,
    borderRadius: SIZES.radius.sm,
    backgroundColor: COLORS.accent.primary,
    minHeight: SIZES.touchTarget - 4,
    justifyContent: 'center',
  },
  createBtnText: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.text.dark,
  },
  disabled: {
    opacity: 0.4,
  },
  downloadTextWrap: {
    flex: 1,
  },
  downloadMeta: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.text.secondary,
    marginTop: 2,
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
  downloadError: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.status.error,
    marginTop: 2,
    marginLeft: SIZES.xxl,
  },
});
