import React, { useCallback, useMemo, useState } from 'react';
import { Alert, SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SIZES, FONTS, TYPE } from '../constants/theme';
import { TrackRow } from '../components/lists/TrackRow';
import { AddToPlaylistSheet } from '../components/lists/AddToPlaylistSheet';
import { MiniPlayer } from '../components/player/MiniPlayer';
import { StatusBarScrim } from '../components/common/StatusBarScrim';
import { EmptyState } from '../components/common/UI';
import { History } from 'lucide-react-native';
import { Track } from '../core/types';
import { HistoryEntry } from '../services/LibraryService';
import { usePlayer } from '../hooks/usePlayer';
import { useLibrary } from '../hooks/useLibrary';
import { useNavigation } from '@react-navigation/native';

type Section = { title: string; data: HistoryEntry[] };

const DAY = 24 * 60 * 60 * 1000;

/** Start of the local day `entry` falls in, for stable day comparisons. */
const startOfDay = (ms: number): number => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/**
 * Group a flat, newest-first log into the buckets the UI shows.
 *
 * The log is already ordered, so one pass is enough and section order falls out
 * naturally -- no sorting per bucket.
 */
function groupByDay(entries: HistoryEntry[]): Section[] {
  const today = startOfDay(Date.now());
  const sections: Section[] = [];
  let current: Section | null = null;

  for (const entry of entries) {
    const day = startOfDay(entry.playedAt);
    const age = today - day;

    let title: string;
    if (age <= 0) title = 'Today';
    else if (age === DAY) title = 'Yesterday';
    else if (age < 7 * DAY) title = 'Earlier this week';
    else title = 'Older';

    if (!current || current.title !== title) {
      current = { title, data: [] };
      sections.push(current);
    }
    current.data.push(entry);
  }

  return sections;
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { playTrack, currentTrack, isPlaying, isLoading, togglePlayPause } = usePlayer();
  const { history, clearHistory } = useLibrary();

  /** Clearing is destructive, so it asks first. */
  const confirmClear = useCallback(() => {
    Alert.alert('Clear listening history?', 'This removes every entry. It cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => clearHistory() },
    ]);
  }, [clearHistory]);

  const sections = useMemo(() => groupByDay(history), [history]);

  /** Playing from history queues the rest of the log behind it. */
  const onPlay = useCallback(
    (track: Track) => {
      const tracks = history.map((e) => e.track);
      playTrack(track, { tracks, label: 'History' });
    },
    [history, playTrack]
  );

  const renderItem = useCallback(
    ({ item }: { item: HistoryEntry }) => (
      <TrackRow
        track={item.track}
        onPress={onPlay}
        onMorePress={setAddingTrack}
        isPlaying={currentTrack?.id === item.track.id && isPlaying}
      />
    ),
    [onPlay, currentTrack?.id, isPlaying]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: Section }) => (
      <Text style={styles.sectionTitle}>{section.title}</Text>
    ),
    []
  );

  /** Track whose "add to playlist" sheet is open. */
  const [addingTrack, setAddingTrack] = useState<Track | null>(null);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + SIZES.lg }]}>
        <Text style={styles.title}>History</Text>
        {history.length > 0 && (
          <TouchableOpacity
            onPress={confirmClear}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Clear listening history"
          >
            <Text style={styles.clear}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {history.length === 0 ? (
        <View style={styles.emptyWrap}>
          {/* The reference's premium empty state: elevated atmospheric card,
              accent ring icon, title + support line, outlined Explore action. */}
          <EmptyState
            Icon={History}
            title="No listening history yet"
            hint="Play something and it will show up here."
            actionLabel="Explore Music"
            onAction={() => navigation.navigate('HomeTab' as never)}
            accentAction
          />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={{ paddingBottom: SIZES.bottomInset }}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          initialNumToRender={12}
          windowSize={9}
          removeClippedSubviews
        />
      )}

      <StatusBarScrim />

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: SIZES.gutter,
    // Leave room for the floating settings button pinned top-right.
    paddingRight: SIZES.xxl + SIZES.lg,
    paddingBottom: SIZES.md,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: TYPE.title1.fontSize,
    lineHeight: TYPE.title1.lineHeight,
    color: COLORS.text.primary,
  },
  clear: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.text.secondary,
  },
  sectionTitle: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.footnote.fontSize,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: COLORS.text.muted,
    paddingHorizontal: SIZES.gutter,
    paddingTop: SIZES.lg,
    paddingBottom: SIZES.sm,
  },
  emptyWrap: {
    paddingHorizontal: SIZES.gutter,
    flex: 1,
    justifyContent: 'center',
  },
});
