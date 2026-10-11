import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Download, Trash2, Wifi } from 'lucide-react-native';
import { COLORS, SIZES, FONTS, TYPE } from '../constants/theme';
import { IOSToggle } from '../components/common/Glass';
import { BackButton } from '../components/common/Glass';
import { MiniPlayer } from '../components/player/MiniPlayer';
import { StatusBarScrim } from '../components/common/StatusBarScrim';
import { usePlayer } from '../hooks/usePlayer';
import { GlassView, SpringPressable, FadeInUp } from '../components/common/Glass';
import { ErrorState } from '../components/common/UI';
import { TrackRow } from '../components/lists/TrackRow';
import { useLibrary } from '../hooks/useLibrary';
import { DownloadService } from '../services/DownloadService';
import { Track } from '../core/types';

const fmtBytes = (bytes: number) => {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
};

/**
 * Downloads — offline library + storage manager + smart auto-download.
 */
export default function DownloadsScreen() {
  const insets = useSafeAreaInsets();
  const { currentTrack, isPlaying, togglePlayPause, isLoading } = usePlayer();
  const navigation = useNavigation();
  const { playTrack } = usePlayer();
  const { settings, updateSettings } = useLibrary();

  const [tracks, setTracks] = useState<Track[]>([]);
  const [summary, setSummary] = useState<{ usedBytes: number; freeBytes: number | null; count: number }>({
    usedBytes: 0,
    freeBytes: null,
    count: 0,
  });

  const [loadError, setLoadError] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [list, s] = await Promise.all([
        DownloadService.getDownloadedTracks(),
        DownloadService.storageSummary(),
      ]);
      setTracks(list);
      setSummary(s);
      setLoadError(false);
    } catch {
      // Storage can be flaky (permission/IO); show a real error, not a fake
      // "nothing saved yet" empty state.
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const confirmClearAll = useCallback(() => {
    if (!summary.count) return;
    Alert.alert(
      'Remove all downloads',
      `${summary.count} tracks will be deleted from this device. Your likes and playlists stay.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => void DownloadService.removeAll().then(reload),
        },
      ]
    );
  }, [summary.count, reload]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + SIZES.sm }]}>
        <BackButton />
        <Text style={styles.headerTitle}>Downloads</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: SIZES.bottomInset }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Storage summary */}
        <FadeInUp index={0}>
          <GlassView weight="thin" accent style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryCell}>
                <Download color={COLORS.accent.primary} size={20} />
                <Text style={styles.summaryValue}>{summary.count}</Text>
                <Text style={styles.summaryLabel}>tracks offline</Text>
              </View>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryValue}>{fmtBytes(summary.usedBytes)}</Text>
                <Text style={styles.summaryLabel}>on disk</Text>
              </View>
              {summary.freeBytes != null ? (
                <View style={styles.summaryCell}>
                  <Text style={styles.summaryValue}>{fmtBytes(summary.freeBytes)}</Text>
                  <Text style={styles.summaryLabel}>free</Text>
                </View>
              ) : null}
            </View>
          </GlassView>
        </FadeInUp>

        {/* Smart auto-download toggle */}
        <FadeInUp index={1}>
          <GlassView weight="thin" style={styles.settingRow}>
            <View style={styles.settingIcon}>
              <Wifi color={COLORS.text.secondary} size={17} />
            </View>
            <View style={styles.settingText}>
              <Text style={styles.settingTitle}>Smart offline</Text>
              <Text style={styles.settingBody}>Auto-save recent likes while on Wi-Fi</Text>
            </View>
            <IOSToggle
              value={settings.autoDownload}
              onValueChange={(v) => {
                updateSettings({ autoDownload: v });
                // Take effect immediately — the switch should feel alive,
                // not wait for the next cold launch.
                if (v) void DownloadService.smartAutoDownload().catch(() => undefined);
              }}
              accessibilityLabel="Smart offline"
            />
          </GlassView>
        </FadeInUp>

        {/* Clear all */}
        {summary.count > 0 ? (
          <FadeInUp index={2}>
            <SpringPressable
              style={styles.clearBtn}
              pressScale={0.97}
              onPress={confirmClearAll}
              accessibilityRole="button"
              accessibilityLabel="Remove all downloads"
            >
              <Trash2 color={COLORS.status.error} size={17} />
              <Text style={styles.clearText}>Remove all downloads</Text>
            </SpringPressable>
          </FadeInUp>
        ) : null}

        {/* Track list */}
        {loadError ? (
          <ErrorState
            message="Couldn't read the offline library"
            onRetry={() => void reload()}
            Icon={Download}
          />
        ) : tracks.length ? (
          <>
            <Text style={styles.listTitle}>On this device</Text>
            {tracks.map((track, i) => (
              <FadeInUp key={track.id} index={Math.min(i, 6)} preset="fast">
                <TrackRow
                  track={track}
                  onPress={(t) => playTrack(t, { tracks, label: 'Downloads' })}
                />
              </FadeInUp>
            ))}
          </>
        ) : (
          <GlassView weight="thin" style={styles.emptyCard}>
            <Download color={COLORS.text.muted} size={26} />
            <Text style={styles.emptyTitle}>Nothing saved yet</Text>
            <Text style={styles.emptyBody}>
              Download tracks from any song's action menu, or turn on Smart offline above.
            </Text>
          </GlassView>
        )}
      </ScrollView>

      <StatusBarScrim />

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.gutter,
    paddingBottom: SIZES.sm,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FONTS.bold,
    fontSize: TYPE.title3.fontSize,
    color: COLORS.text.primary,
  },
  scroll: {
    paddingHorizontal: SIZES.gutter,
    paddingTop: SIZES.md,
  },

  summaryCard: {
    padding: SIZES.lg,
    marginBottom: SIZES.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryCell: {
    alignItems: 'center',
    gap: 3,
  },
  summaryValue: {
    fontFamily: FONTS.bold,
    fontSize: TYPE.title3.fontSize,
    color: COLORS.text.primary,
  },
  summaryLabel: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.micro.fontSize,
    color: COLORS.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.md,
    padding: SIZES.md + 2,
    marginBottom: SIZES.md,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.text.primary,
  },
  settingBody: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.text.muted,
    marginTop: 1,
  },

  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.status.errorGlow,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
    marginBottom: SIZES.lg,
  },
  clearText: {
    fontFamily: FONTS.semibold,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.status.error,
  },

  listTitle: {
    fontFamily: FONTS.semibold,
    fontSize: TYPE.headline.fontSize,
    color: COLORS.text.primary,
    marginBottom: SIZES.sm + 2,
  },

  emptyCard: {
    padding: SIZES.xl,
    alignItems: 'center',
    gap: SIZES.sm,
  },
  emptyTitle: {
    fontFamily: FONTS.semibold,
    fontSize: TYPE.headline.fontSize,
    color: COLORS.text.primary,
  },
  emptyBody: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.text.secondary,
    textAlign: 'center',
    lineHeight: 19,
  },
});
