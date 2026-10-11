import React, { useMemo, useRef, useState } from 'react';
import {
  useWindowDimensions,
  Animated,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, ChevronRight, Flame, Headphones, Play, Sparkles, Trophy } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SIZES, FONTS, TYPE, GRADIENTS, MOOD_PALETTE } from '../constants/theme';
import { SpringPressable, FadeInUp, GlassView } from '../components/common/Glass';
import { ShareSheet, ShareRequest } from '../components/share/ShareSheet';
import { computeWrapped, formatHours } from '../engagement/wrapped';
import { useEngagement } from '../hooks/useEngagement';

/**
 * Wrapped — the monthly listening story, told as swipeable slides.
 * Each slide is a poster; the last one is shareable.
 */
export default function WrappedScreen() {
  const insets = useSafeAreaInsets();
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();
  const navigation = useNavigation();
  const eng = useEngagement();
  const [shareRequest, setShareRequest] = useState<ShareRequest | null>(null);
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const wrapped = useMemo(() => computeWrapped(), []);

  const slides = useMemo(
    () => buildSlides(wrapped, eng),
    [wrapped, eng.streak, eng.level, eng.levelName, eng.minutesToday]
  );

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (idx !== page) setPage(idx);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SIZES.sm }]}>
        <SpringPressable
          style={styles.backBtn}
          pressScale={0.9}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft color={COLORS.text.primary} size={SIZES.icon.md} />
        </SpringPressable>
        <Text style={styles.headerTitle}>Wrapped</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        style={{ flex: 1 }}
      >
        {slides.map((slide, i) => (
          <View key={i} style={{ width: SCREEN_W }}>
            <SlideBody slide={slide} />
          </View>
        ))}
      </ScrollView>

      {/* Page dots + next/share */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + SIZES.md }]}>
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
          ))}
        </View>
        {page < slides.length - 1 ? (
          <SpringPressable
            style={styles.nextBtn}
            pressScale={0.94}
            glow
            onPress={() => scrollRef.current?.scrollTo({ x: (page + 1) * SCREEN_W, animated: true })}
            accessibilityRole="button"
            accessibilityLabel="Next slide"
          >
            <Text style={styles.nextText}>Next</Text>
            <ChevronRight color={COLORS.text.dark} size={18} />
          </SpringPressable>
        ) : (
          <SpringPressable
            style={styles.nextBtn}
            pressScale={0.94}
            glow
            onPress={() =>
              setShareRequest({
                kind: 'wrapped',
                monthLabel: wrapped.monthLabel,
                personality: wrapped.personality.title,
                topTrack: wrapped.topTracks[0]
                  ? {
                      title: wrapped.topTracks[0].track.title,
                      artist: wrapped.topTracks[0].track.artist.name,
                      image: wrapped.topTracks[0].track.albumImageUrl,
                    }
                  : undefined,
                minutesTotal: formatHours(wrapped.totalSeconds),
                streak: eng.streak,
                message: `My month in music — ${wrapped.personality.title}. Made with Arkify.`,
              })
            }
            accessibilityRole="button"
            accessibilityLabel="Share your wrapped"
          >
            <Sparkles color={COLORS.text.dark} size={16} />
            <Text style={styles.nextText}>Share it</Text>
          </SpringPressable>
        )}
      </View>

      <ShareSheet request={shareRequest} onClose={() => setShareRequest(null)} />
    </View>
  );
}

// ---------------------------------------------------------------------------

type Slide = {
  kicker: string;
  title: string;
  body?: string;
  gradient: readonly [string, string];
  art?: React.ReactNode;
};

function buildSlides(
  w: ReturnType<typeof computeWrapped>,
  eng: ReturnType<typeof useEngagement>
): Slide[] {
  const slides: Slide[] = [];

  slides.push({
    kicker: w.monthLabel,
    title: 'Your month\nin music.',
    body: 'Swipe through the story of what you listened to.',
    gradient: GRADIENTS.midnight,
    art: <Headphones color="rgba(255,255,255,0.9)" size={72} />,
  });

  slides.push({
    kicker: 'Total time',
    title: formatHours(w.totalSeconds),
    body: `across ${w.listens} plays and ${w.distinctArtists} artists.`,
    gradient: GRADIENTS.aurora,
  });

  if (w.topTracks[0]) {
    slides.push({
      kicker: 'Your #1 song',
      title: w.topTracks[0].track.title,
      body: `by ${w.topTracks[0].track.artist.name} — ${w.topTracks[0].plays} plays.`,
      gradient: GRADIENTS.rose,
      art: w.topTracks[0].track.albumImageUrl ? (
        <Image
          source={{ uri: w.topTracks[0].track.albumImageUrl }}
          style={{ width: 160, height: 160, borderRadius: 20 }}
        />
      ) : undefined,
    });
  }

  if (w.topArtists[0]) {
    slides.push({
      kicker: 'Your top artist',
      title: w.topArtists[0].name,
      body: `${w.topArtists[0].plays} plays this period.`,
      gradient: GRADIENTS.sunset,
    });
  }

  slides.push({
    kicker: 'Your listening personality',
    title: w.personality.title,
    body: w.personality.blurb,
    gradient: GRADIENTS.brand,
    art: <Sparkles color="rgba(255,255,255,0.92)" size={64} />,
  });

  slides.push({
    kicker: 'The streak',
    title: `${eng.streak} day${eng.streak === 1 ? '' : 's'}`,
    body: `Level ${eng.level} · ${eng.levelName}. Keep the flame alive — tomorrow needs you.`,
    gradient: GRADIENTS.gold,
    art: <Flame color="rgba(255,255,255,0.92)" size={72} fill="rgba(255,255,255,0.2)" />,
  });

  return slides;
}

const SlideBody: React.FC<{ slide: Slide }> = ({ slide }) => (
  <LinearGradient
    colors={slide.gradient}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={styles.slide}
  >
    <LinearGradient
      colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.4)']}
      start={{ x: 0.5, y: 0.3 }}
      end={{ x: 0.5, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
    <View style={styles.slideContent}>
      <Text style={styles.slideKicker}>{slide.kicker.toUpperCase()}</Text>
      {slide.art ? <View style={styles.slideArt}>{slide.art}</View> : null}
      <Text style={styles.slideTitle}>{slide.title}</Text>
      {slide.body ? <Text style={styles.slideBody}>{slide.body}</Text> : null}
    </View>
    <Text style={styles.slideMark}>ARKIFY</Text>
  </LinearGradient>
);

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
    zIndex: 10,
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
  slide: {
    flex: 1,
    borderRadius: 24,
    margin: SIZES.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: SIZES.xl,
  },
  slideContent: {
    alignItems: 'center',
    gap: 18,
  },
  slideKicker: {
    fontFamily: FONTS.bold,
    fontSize: TYPE.subheadline.fontSize,
    letterSpacing: 3,
    color: 'rgba(255,255,255,0.8)',
  },
  slideArt: {
    marginBottom: 6,
  },
  slideTitle: {
    fontFamily: FONTS.bold,
    fontSize: 40,
    lineHeight: 46,
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -1,
  },
  slideBody: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.body.fontSize,
    lineHeight: 24,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    maxWidth: 280,
  },
  slideMark: {
    position: 'absolute',
    bottom: 24,
    fontFamily: FONTS.bold,
    fontSize: 11,
    letterSpacing: 6,
    color: 'rgba(255,255,255,0.6)',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.gutter + 6,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dotActive: {
    backgroundColor: COLORS.accent.primary,
    width: 18,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 48,
    paddingHorizontal: 24,
    borderRadius: 24,
    backgroundColor: COLORS.accent.primary,
  },
  nextText: {
    fontFamily: FONTS.bold,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.text.dark,
  },
});
