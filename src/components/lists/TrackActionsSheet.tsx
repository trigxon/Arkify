import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ListPlus,
  Heart,
  User,
  Share2,
  Disc3,
  Timer,
  Trash2,
  Check,
  Download,
} from 'lucide-react-native';
import { COLORS, SIZES, FONTS, TYPE } from '../../constants/theme';
import { BottomSheet } from '../common/BottomSheet';
import { Track } from '../../core/types';
import { useLibrary } from '../../hooks/useLibrary';
import { DownloadService } from '../../services/DownloadService';
import { SleepTimer } from '../../services/SleepTimerService';

type Props = {
  /** The track the actions apply to. Null closes the sheet. */
  track: Track | null;
  onClose: () => void;
  /** Navigates to the artist's songs via a real search. */
  onGoToArtist?: (track: Track) => void;
  /** Opens the album's page via a real search. */
  onViewAlbum?: (track: Track) => void;
  /**
   * Starts the sleep timer; null cancels it. The parent owns the actual
   * pause callback (its own togglePlayPause) — the sheet only decides when.
   */
  onSleepTimer?: (minutes: number | null) => void;
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
  onGoToArtist,
  onViewAlbum,
  onSleepTimer,
}) => {
  const { playlists, addToPlaylist, removeFromPlaylist, createPlaylist, isLiked, toggleLike } =
    useLibrary();

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [sleepPickerOpen, setSleepPickerOpen] = useState(false);
  /** Ticks the "active timer" row's label while a timer runs. */
  const [remainingMs, setRemainingMs] = useState<number | null>(SleepTimer.remainingMs);

  useEffect(() => SleepTimer.subscribe(() => setRemainingMs(SleepTimer.remainingMs)), []);

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

  if (!track) return null;

  const sleepActive = remainingMs !== null;

  return (
    <BottomSheet visible={track !== null} onClose={close} title="Actions" subtitle={track.title}>
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
              <DownloadRow track={track} onDone={close} />
              <SheetRow
                Icon={Share2}
                label="Share"
                onPress={() => {
                  void DownloadService.shareTrack(track);
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

      {/* Destructive zone — kept last and separated, per the reference. */}
      {!creating && !sleepPickerOpen && (
        <View style={styles.destructiveZone}>
          <SheetRow
            Icon={Trash2}
            label={liked ? 'Remove from Liked Songs' : 'Remove from library'}
            destructive
            onPress={() => {
              // Real removal: unlike, and drop the track from every local
              // playlist it appears in.
              if (liked) toggleLike(track);
              for (const p of playlists) {
                if (p.tracks.some((t) => t.id === track.id)) {
                  removeFromPlaylist(p.id, track.id);
                }
              }
              close();
            }}
          />
        </View>
      )}
    </BottomSheet>
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
            await DownloadService.remove(track.id);
            setDownloaded(false);
            return;
          }
          setDownloading(true);
          setError(null);
          try {
            await DownloadService.download(track, setProgress);
            setDownloaded(true);
            onDone();
          } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Download failed');
          } finally {
            setDownloading(false);
          }
        }}
        accessibilityRole="button"
        accessibilityLabel={downloaded ? 'Remove download' : 'Download for offline playback'}
      >
        <View style={styles.rowIcon}>
          <Download
            color={downloaded ? COLORS.accent.primary : COLORS.text.primary}
            size={SIZES.icon.sm + 2}
            strokeWidth={2}
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
        size={SIZES.icon.sm + 2}
        strokeWidth={2}
      />
    </View>
    <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>{label}</Text>
    {trailing}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.md,
    paddingVertical: SIZES.sm + 4,
    minHeight: SIZES.touchTarget + 2,
  },
  subRow: {
    paddingLeft: SIZES.lg,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceElevated,
  },
  rowIconDestructive: {
    backgroundColor: COLORS.status.errorGlow,
  },
  rowIconBare: {
    backgroundColor: COLORS.surfaceElevated,
  },
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
  destructiveZone: {
    marginTop: SIZES.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    paddingTop: SIZES.sm,
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
    color: '#04211D',
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
    marginLeft: SIZES.xl + SIZES.sm,
  },
});
