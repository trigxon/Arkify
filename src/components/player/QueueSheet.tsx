import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { GripVertical, Play, X } from 'lucide-react-native';
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
};

/** Height of one reorderable row — must match the rendered row height. */
const ROW_HEIGHT = 60;

/**
 * The queue sheet, per the Queue reference: "Now Playing" pinned at top, an
 * "Up Next" list with drag handles, tactile drag-to-reorder, per-row remove
 * and a Clear action.
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
}) => {
  // ---- drag-to-reorder (upcoming section) --------------------------------

  /** Index (into upcoming) of the row being dragged. */
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  /** Index the row is currently hovering over. */
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const dragY = useRef(new Animated.Value(0)).current;
  const rowYs = useRef<number[]>([]);
  const startIndex = useRef(0);
  const active = useRef(false);

  // Refs mirror state for the long-lived PanResponder (created once).
  const dragIndexRef = useRef<number | null>(null);
  const hoverIndexRef = useRef<number | null>(null);
  dragIndexRef.current = dragIndex;
  hoverIndexRef.current = hoverIndex;

  const endDrag = () => {
    active.current = false;
    setDragIndex(null);
    setHoverIndex(null);
    dragY.setValue(0);
  };

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

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Queue" subtitle={context || undefined}>
      {/* Now Playing — pinned, clearly separated from Up Next. */}
      {currentTrack && (
        <View style={styles.nowPlayingBlock}>
          <Text style={styles.sectionLabel}>NOW PLAYING</Text>
          <View style={styles.nowRow}>
            <Artwork uri={currentTrack.albumImageUrl} size={44} radius={8} />
            <View style={styles.nowInfo}>
              <Text style={[styles.rowTitle, { color: COLORS.accent.primary }]} numberOfLines={1}>
                {currentTrack.title}
              </Text>
              <Text style={styles.rowArtist} numberOfLines={1}>
                {currentTrack.artist.name}
              </Text>
            </View>
            <View style={styles.nowBadge}>
              <Play color={COLORS.accent.primary} size={10} fill={COLORS.accent.primary} />
            </View>
          </View>
        </View>
      )}

      <View style={styles.upNextHeader}>
        <Text style={styles.sectionLabel}>UP NEXT · {upcoming.length}</Text>
        {upcoming.length > 0 && (
          <TouchableOpacity
            onPress={clear}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Clear queue"
          >
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

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
                onLayout={(e) => {
                  rowYs.current[i] = e.nativeEvent.layout.y;
                }}
                style={[
                  styles.queueRow,
                  isHovered && styles.queueRowHover,
                  isDragging && styles.queueRowDragging,
                ]}
              >
                <Animated.View
                  style={{ transform: [{ translateY: isDragging ? dragY : 0 }], flex: 1, flexDirection: 'row', alignItems: 'center' }}
                  {...(isDragging ? panResponder.panHandlers : {})}
                >
                  <TouchableOpacity
                    style={styles.grip}
                    onPressIn={() => beginDrag(i)}
                    accessibilityRole="button"
                    accessibilityLabel={`Reorder ${track.title}`}
                  >
                    <GripVertical color={COLORS.text.muted} size={SIZES.icon.sm} />
                  </TouchableOpacity>

                  <Artwork uri={track.albumImageUrl} size={40} radius={8} />

                  <TouchableOpacity
                    style={styles.rowMain}
                    onPress={() => {
                      onJumpTo(track.id);
                      onClose();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Play ${track.title} by ${track.artist.name}`}
                  >
                    <Text style={styles.rowTitle} numberOfLines={1}>{track.title}</Text>
                    <Text style={styles.rowArtist} numberOfLines={1}>{track.artist.name}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => onRemove(track.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${track.title} from queue`}
                  >
                    <X color={COLORS.text.muted} size={SIZES.icon.sm} />
                  </TouchableOpacity>
                </Animated.View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  nowPlayingBlock: {
    marginBottom: SIZES.md,
  },
  sectionLabel: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.overline.fontSize,
    letterSpacing: 2,
    color: COLORS.text.muted,
    marginBottom: SIZES.sm,
  },
  nowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.md,
    backgroundColor: COLORS.accent.soft,
    borderWidth: 1,
    borderColor: 'rgba(61, 214, 195, 0.20)',
    borderRadius: SIZES.radius.md,
    padding: SIZES.sm + 2,
  },
  nowInfo: {
    flex: 1,
  },
  nowBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceElevated,
  },
  upNextHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SIZES.xs,
  },
  clearText: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.text.secondary,
  },
  list: {
    maxHeight: 320,
  },
  queueRow: {
    height: ROW_HEIGHT,
    borderRadius: SIZES.radius.md,
    marginBottom: SIZES.xs,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  queueRowHover: {
    backgroundColor: COLORS.surfaceElevated,
    borderColor: COLORS.hairline,
  },
  queueRowDragging: {
    backgroundColor: COLORS.surfacePressed,
    borderColor: 'rgba(61, 214, 195, 0.30)',
    zIndex: 10,
    elevation: 8,
  },
  grip: {
    width: 32,
    height: ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMain: {
    flex: 1,
    marginHorizontal: SIZES.sm,
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
  removeBtn: {
    width: 36,
    height: ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.text.muted,
    paddingVertical: SIZES.lg,
    textAlign: 'center',
  },
});
