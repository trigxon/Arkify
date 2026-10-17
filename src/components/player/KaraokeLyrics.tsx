import React, { useEffect, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import { SPRINGS } from '../../constants/theme';
import { Lyrics, LyricsService } from '../../services/LyricsService';

/**
 * KaraokeLyrics — Apple Music-style live lyrics.
 *
 * The active line reads large and bright with a soft glow; past lines settle
 * back, future lines sit dimmer — a depth cue that makes the next line feel
 * like it is arriving. Tapping any line seeks to it.
 *
 * Position comes in as a prop (the parent subscribes via useProgress at ~4Hz);
 * line activation is springy and driven locally, so no reanimated worklet
 * needs the raw position stream.
 */

const LINE_SPACING = 12;
const LINE_PAD_Y = 5;
const AUTO_SCROLL_OFFSET = 150;
// BUG FIX: the active line used to change fontSize (24→30) — every activation
// reflowed the whole list and lower lines jumped. Layout metrics are now
// CONSTANT (lineHeight 40 for every line); the active pop comes from a scale
// transform, which never moves layout. Pitch = 40 + 5*2 pad + 12 gap.
const LINE_PITCH = 40 + LINE_PAD_Y * 2 + LINE_SPACING;

type Props = {
  lyrics: Lyrics;
  position: number;
  onSeek: (seconds: number) => void;
};

export const KaraokeLyrics: React.FC<Props> = ({ lyrics, position, onSeek }) => {
  const scrollRef = useRef<ScrollView>(null);
  const lastLineRef = useRef(-1);

  const activeIndex = useMemo(
    () => (lyrics.synced ? LyricsService.activeLineIndex(lyrics, position) : -1),
    // 2Hz re-evaluation is plenty for lyric sync and keeps renders cheap.
    [lyrics, Math.floor(position * 2)]
  );

  // Auto-scroll on line change.
  useEffect(() => {
    if (activeIndex < 0 || activeIndex === lastLineRef.current) return;
    lastLineRef.current = activeIndex;
    const y = Math.max(0, activeIndex * LINE_PITCH - AUTO_SCROLL_OFFSET);
    scrollRef.current?.scrollTo({ y, animated: true });
  }, [activeIndex]);

  if (!lyrics.synced) return null;

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ height: AUTO_SCROLL_OFFSET }} />
      {lyrics.lines.map((line, i) => (
        <KaraokeLine
          key={`${i}-${line.time ?? 'u'}`}
          text={line.text || '•'}
          active={i === activeIndex}
          onPress={() => {
            if (line.time !== undefined) onSeek(Math.max(0, line.time - 0.2));
          }}
        />
      ))}
      <View style={{ height: 140 }} />
    </ScrollView>
  );
};

// ---------------------------------------------------------------------------

const KaraokeLine: React.FC<{
  text: string;
  active: boolean;
  onPress: () => void;
}> = ({ text, active, onPress }) => {
  const activeSV = useSharedValue(0);

  useEffect(() => {
    activeSV.value = withSpring(active ? 1 : 0, SPRINGS.snap);
  }, [active, activeSV]);

  const style = useAnimatedStyle(() => {
    const t = activeSV.value;
    return {
      opacity: interpolate(t, [0, 1], [0.34, 1]),
      // Optical emphasis only — scale never touches layout, so activation
      // can't reflow the lines below (the old fontSize swap did).
      transform: [{ scale: interpolate(t, [0, 1], [0.9, 1.15]) }],
    };
  });

  const glowStyle = useAnimatedStyle(() => ({
    opacity: activeSV.value * 0.6,
  }));

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
      <Animated.View style={[styles.lineWrap, style]}>
        <Animated.View pointerEvents="none" style={[styles.lineGlow, glowStyle]} />
        <Text style={[styles.line, active && styles.lineActive]} numberOfLines={3}>
          {text}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 4,
  },
  lineWrap: {
    marginBottom: LINE_SPACING,
    paddingVertical: LINE_PAD_Y,
  },
  lineGlow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(59, 240, 223, 0.10)',
    borderRadius: 14,
  },
  line: {
    fontSize: 24,
    lineHeight: 40,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.3,
  },
  lineActive: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(59, 240, 223, 0.45)',
    textShadowRadius: 18,
    textShadowOffset: { width: 0, height: 0 },
  },
});
