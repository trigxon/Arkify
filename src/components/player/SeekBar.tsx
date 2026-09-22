import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, StyleSheet, Text, View } from 'react-native';
import { COLORS, SIZES, FONTS } from '../../constants/theme';
import { useProgress } from '../../hooks/usePlayer';

/** Seconds -> m:ss, for the progress labels. */
const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

/**
 * How long the bar takes to reach a newly reported position. The engine ticks
 * about four times a second, so a slightly longer tween makes the fill and the
 * thumb glide continuously instead of stepping in 250ms jumps — without ever
 * lagging more than a hair behind the audio.
 */
const TICK_MS = 300;

type SeekBarProps = {
  /** Commits a final position, in seconds. */
  onSeek: (seconds: number) => void;
};

/**
 * Scrubber with three distinct notions of position.
 *
 *   actual      - what the engine reports (useProgress, ~4x a second)
 *   display     - what is drawn
 *   isSeeking   - whether the finger owns `display`
 *
 * Between ticks the drawn position is an animated value tweening towards the
 * reported one; while the finger is down, engine updates are ignored entirely
 * so a position tick can never yank the thumb out from under the user. Exactly
 * one native seek is issued, on release: seeking on every move made the bar
 * fight the gesture.
 *
 * This component is also the only thing in the player subscribed to position,
 * so the rest of Now Playing no longer re-renders on every tick.
 */
export const SeekBar: React.FC<SeekBarProps> = ({ onSeek }) => {
  const { position, duration } = useProgress();

  const [barWidth, setBarWidth] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [displayPosition, setDisplayPosition] = useState(0);

  /** Animated fraction of the track (0..1) — drives both fill and thumb. */
  const fraction = useRef(new Animated.Value(0)).current;

  // Refs mirror state for use inside PanResponder, which is created once and
  // would otherwise close over stale values.
  const barWidthRef = useRef(0);
  const durationRef = useRef(0);
  const displayRef = useRef(0);
  const seekingRef = useRef(false);

  barWidthRef.current = barWidth;
  durationRef.current = Number.isFinite(duration) && duration > 0 ? duration : 0;
  seekingRef.current = isSeeking;

  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const safePosition = Number.isFinite(position) && position > 0 ? position : 0;
  const ratio = safeDuration > 0 ? Math.min(1, Math.max(0, safePosition / safeDuration)) : 0;

  /**
   * Glide towards whatever the engine last reported. Skipped while the user
   * owns the bar, so their finger is never overruled.
   */
  useEffect(() => {
    if (seekingRef.current) return;
    Animated.timing(fraction, {
      toValue: ratio,
      duration: TICK_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [ratio, fraction]);

  /** Map an x offset within the bar to a safe position in seconds. */
  const positionForX = useCallback((x: number): number => {
    const width = barWidthRef.current;
    const total = durationRef.current;

    if (!width || !total) return 0;
    if (!Number.isFinite(x)) return 0;

    const r = Math.min(1, Math.max(0, x / width));
    const seconds = r * total;

    // Guard against NaN/Infinity reaching the engine.
    if (!Number.isFinite(seconds)) return 0;
    return Math.min(total, Math.max(0, seconds));
  }, []);

  /** Move the drawn bar without animating, so it tracks the finger exactly. */
  const setDragged = useCallback(
    (seconds: number) => {
      displayRef.current = seconds;
      setDisplayPosition(seconds);
      const total = durationRef.current;
      const r = total > 0 ? Math.min(1, Math.max(0, seconds / total)) : 0;
      fraction.stopAnimation();
      fraction.setValue(r);
    },
    [fraction]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // Claim the gesture so the parent ScrollView cannot steal the drag.
        onPanResponderTerminationRequest: () => false,

        onPanResponderGrant: (e) => {
          // A track with no known duration cannot be scrubbed.
          if (!durationRef.current) return;
          setDragged(positionForX(e.nativeEvent.locationX));
          setIsSeeking(true);
        },

        onPanResponderMove: (e) => {
          if (!durationRef.current) return;
          // locationX is measured against this view, so it already accounts for
          // how far the finger has travelled. positionForX clamps it, which is
          // what keeps dragging past either end (and fast flicks that overshoot)
          // pinned to 0 / duration rather than producing an out-of-range seek.
          setDragged(positionForX(e.nativeEvent.locationX));
        },

        onPanResponderRelease: () => {
          if (!durationRef.current) {
            setIsSeeking(false);
            return;
          }
          // One seek, at the end of the gesture.
          onSeek(displayRef.current);
          setIsSeeking(false);
        },

        onPanResponderTerminate: () => {
          // Gesture stolen or cancelled: drop back to engine position.
          setIsSeeking(false);
        },
      }),
    [onSeek, positionForX, setDragged]
  );

  const shown = isSeeking ? displayPosition : safePosition;

  // Pixel geometry, recomputed only when the bar is measured: both the fill and
  // the thumb ride the same animated fraction, so they can never disagree.
  const trackSpan = useMemo(
    () => ({
      width: fraction.interpolate({ inputRange: [0, 1], outputRange: [0, barWidth] }),
      left: fraction.interpolate({ inputRange: [0, 1], outputRange: [0, barWidth] }),
    }),
    [fraction, barWidth]
  );

  return (
    <View style={styles.container}>
      <View
        style={styles.barBg}
        hitSlop={{ top: 20, bottom: 20, left: 0, right: 0 }}
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
        {...panResponder.panHandlers}
      >
        <Animated.View style={[styles.barFill, { width: trackSpan.width }]} />
        <Animated.View
          style={[styles.dot, { left: trackSpan.left }, isSeeking && styles.dotActive]}
        />
      </View>

      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{formatTime(shown)}</Text>
        {/* Total duration, per the reference — not a countdown. */}
        <Text style={styles.timeText}>{formatTime(safeDuration)}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SIZES.lg,
  },
  barBg: {
    height: 4,
    backgroundColor: COLORS.player.progressTrack,
    borderRadius: 2,
    marginBottom: SIZES.sm + 2,
    justifyContent: 'center',
  },
  barFill: {
    height: '100%',
    backgroundColor: COLORS.accent.primary,
    borderRadius: 2,
  },
  dot: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.accent.primary,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    marginLeft: -7,
  },
  /** Slight grow while dragging, so the thumb reads as grabbed. */
  dotActive: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginLeft: -10,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.text.secondary,
  },
});
