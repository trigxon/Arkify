import React, { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ChevronRight, Menu, Shuffle } from 'lucide-react-native';
import { COLORS, SIZES, FONTS, TYPE } from '../../constants/theme';
import { BottomSheet } from '../common/BottomSheet';
import { Artwork } from '../common/Artwork';
import { Track } from '../../core/types';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** The full queue, current track first. */
  queue: Track[];
  /** The track playing right now. */
  currentTrack: Track | null;
  /** Queue context label, e.g. "Liked Songs". */
  context: string;
  upcoming: Track[];
  onJumpTo: (trackId: string) => void;
  onRemove: (trackId: string) => void;
  /** Upcoming-relative reorder: 0 = the next track to play. */
  onReorder: (from: number, to: number) => void;
  onClear: () => void;
  /** Shuffle state for the footer button. */
  shuffle: boolean;
  onShuffle: () => void;
};

/** Height of one reorderable row — must match the rendered row height. */
const ROW_HEIGHT = 60;

/**
 * The queue sheet, per the Queue reference: "Now Playing" pinned at the top,
 * an "Up Next" list with drag handles, tactile drag-to-reorder, and the
 * Shuffle / Clear pair pinned at the bottom.
 */
export const QueueSheet: React.FC<Props> = ({
  visible,
  onClose,
  queue,
  currentTrack,
  context,
  upcoming,
  onJumpTo,
  onRemove,
  onReorder,
  onClear,
  shuffle,
  onShuffle,
}) => {
  // ---- drag-to-reorder (upcoming section) --------------------------------

  /** Index (into upcoming) of the row being dragged. */
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  /** Index the row is currently hovering over. */
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const dragY = useRef(new Animated.Value(0)).current;
  const startIndex = useRef(0);
  const active = useRef(false);

  // Refs mirror state for the long-lived PanResponder (created once).
  const dragIndexRef = useRef<number | null>(null);
  const hoverIndexRef = useRef<number | null>(null);
  dragIndexRef.current = dragIndex;
  hoverIndexRef.current = hoverIndex;

  const endDrag = useCallback(() => {
    active.current = false;
    setDragIndex(null);
    setHoverIndex(null);
    dragY.setValue(0);
  }, [dragY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_e, g) => active.current && Math.abs(g.dy) > 6,
      onPanResponderMove: (_e, g) => {
        dragY.setValue(g.dy);

        const draggedY = startIndex.current * ROW_HEIGHT + g.dy;
        const over = Math.max(0, Math.min(upcoming.length - 1, Math.round(draggedY / ROW_HEIGHT)));
        if (over !== hoverIndexRef.current) setHoverIndex(over);
      },
      onPanResponderRelease: () => {
        if (active.current && hoverIndexRef.current !== null && dragIndexRef.current !== null) {
          if (hoverIndexRef.current !== dragIndexRef.current) {
            onReorder(dragIndexRef.current, hoverIndexRef.current);
          }
        }
        endDrag();
      },
      onPanResponderTerminate: endDrag,
    })
  ).current;

  const beginDrag = (index: number) => {
    startIndex.current = index;
    active.current = true;
    setDragIndex(index);
  };

  const clear = useCallback(() => {
    onClear();
  }, [onClear]);

  /**
   * The reference's rows carry only a drag handle, so removal lives on
   * long-press — the row stays clean, the action stays reachable.
   */
  const confirmRemove = useCallback(
    (track: Track) => {
      const title = `Remove “${track.title}” from the queue?`;

      // react-native-web has no Alert, so the preview asks through the browser.
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.confirm(title)) onRemove(track.id);
        return;
      }

      Alert.alert('Remove from queue?', title, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => onRemove(track.id) },
      ]);
    },
    [onRemove]
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Queue"
      titleAlign="center"
      showGrabber={false}
      tall
    >
      {/* Now Playing — pinned, clearly separated from Up Next. */}
      {currentTrack && (
        <View style={styles.nowPlayingBlock}>
          <Text style={styles.sectionLabel}>Now Playing</Text>
          <TouchableOpacity
            style={styles.nowRow}
            activeOpacity={0.75}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={`Close queue, now playing ${currentTrack.title}`}
          >
            <Artwork uri={currentTrack.albumImageUrl} size={48} radius={8} />
            <View style={styles.nowInfo}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {currentTrack.title}
              </Text>
              <Text style={styles.rowArtist} numberOfLines={1}>
                {currentTrack.artist.name}
              </Text>
            </View>
            <ChevronRight color={COLORS.text.secondary} size={SIZES.icon.sm} />
          </TouchableOpacity>
        </View>
      )}

      <Text style={[styles.sectionLabel, styles.upNextLabel]}>Up Next</Text>

      {upcoming.length === 0 ? (
        <Text style={styles.emptyText}>Nothing queued. Tracks you play next appear here.</Text>
      ) : (
        <ScrollView style={styles.list} nestedScrollEnabled showsVerticalScrollIndicator={false}>
          {upcoming.map((track, i) => {
            const isDragging = dragIndex === i;
            const isHovered = hoverIndex === i && !isDragging;

            return (
              <View
                key={track.id}
                style={[
                  styles.queueRow,
                  isHovered && styles.queueRowHover,
                  isDragging && styles.queueRowDragging,
                ]}
              >
                <Animated.View
                  style={[
                    styles.queueRowInner,
                    { transform: [{ translateY: isDragging ? dragY : 0 }] },
                  ]}
                  {...(isDragging ? panResponder.panHandlers : {})}
                >
                  <Artwork uri={track.albumImageUrl} size={44} radius={8} />

                  <TouchableOpacity
                    style={styles.rowMain}
                    onPress={() => {
                      onJumpTo(track.id);
                      onClose();
                    }}
                    onLongPress={() => confirmRemove(track)}
                    delayLongPress={350}
                    accessibilityRole="button"
                    accessibilityLabel={`Play ${track.title} by ${track.artist.name}`}
                    accessibilityHint="Long press to remove from the queue"
                  >
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {track.title}
                    </Text>
                    <Text style={styles.rowArtist} numberOfLines={1}>
                      {track.artist.name}
                    </Text>
                  </TouchableOpacity>

                  {/* Drag handle, per the reference: the grab affordance sits at
                      the row's trailing edge. */}
                  <TouchableOpacity
                    style={styles.grip}
                    onPressIn={() => beginDrag(i)}
                    accessibilityRole="button"
                    accessibilityLabel={`Reorder ${track.title}`}
                  >
                    <Menu color={COLORS.text.secondary} size={SIZES.icon.sm} />
                  </TouchableOpacity>
                </Animated.View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Footer pair, per the reference: Shuffle + Clear. */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.footerButton, shuffle && styles.footerButtonActive]}
          activeOpacity={0.8}
          onPress={onShuffle}
          accessibilityRole="button"
          accessibilityLabel={shuffle ? 'Shuffle on' : 'Shuffle queue'}
          accessibilityState={{ selected: shuffle }}
        >
          <Shuffle
            color={shuffle ? COLORS.accent.primary : COLORS.text.primary}
            size={SIZES.icon.sm}
          />
          <Text style={[styles.footerText, shuffle && styles.footerTextActive]}>Shuffle</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.footerButton}
          activeOpacity={0.8}
          onPress={clear}
          disabled={upcoming.length === 0}
          accessibilityRole="button"
          accessibilityLabel="Clear queue"
          accessibilityState={{ disabled: upcoming.length === 0 }}
        >
          <Text style={[styles.footerText, upcoming.length === 0 && styles.footerTextDisabled]}>
            Clear
          </Text>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  nowPlayingBlock: {
    marginBottom: SIZES.md,
  },
  sectionLabel: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.text.secondary,
    marginBottom: SIZES.sm,
  },
  upNextLabel: {
    marginTop: SIZES.sm,
  },
  nowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.md,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: SIZES.radius.md,
    padding: SIZES.sm,
  },
  nowInfo: {
    flex: 1,
  },
  /** Fills the tall sheet, so the list scrolls instead of the panel growing. */
  list: {
    flex: 1,
    minHeight: 0,
  },
  queueRow: {
    height: ROW_HEIGHT,
    borderRadius: SIZES.radius.md,
    marginBottom: SIZES.xs,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  queueRowInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  queueRowHover: {
    backgroundColor: COLORS.surfaceElevated,
    borderColor: COLORS.hairline,
  },
  queueRowDragging: {
    backgroundColor: COLORS.surfacePressed,
    borderColor: 'rgba(53, 214, 198, 0.30)',
    zIndex: 10,
    elevation: 8,
  },
  grip: {
    width: 34,
    height: ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMain: {
    flex: 1,
    marginHorizontal: SIZES.sm + 2,
    justifyContent: 'center',
  },
  rowTitle: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.text.primary,
  },
  rowArtist: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.text.secondary,
    marginTop: 1,
  },
  emptyText: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.text.muted,
    paddingVertical: SIZES.lg,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    gap: SIZES.md,
    marginTop: SIZES.lg,
  },
  footerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SIZES.sm,
    height: 52,
    borderRadius: SIZES.radius.pill,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    backgroundColor: COLORS.surfaceElevated,
  },
  footerButtonActive: {
    borderColor: 'rgba(53, 214, 198, 0.45)',
    backgroundColor: COLORS.accent.soft,
  },
  footerText: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.body.fontSize,
    color: COLORS.text.primary,
  },
  footerTextActive: {
    color: COLORS.accent.primary,
  },
  footerTextDisabled: {
    color: COLORS.text.muted,
  },
});
