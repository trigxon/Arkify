import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  Animated,
  type ViewStyle,
} from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  withDelay,
  cancelAnimation,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronDown,
  EllipsisVertical,
  Heart,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Repeat1,
  Shuffle,
  Share,
  Sparkles,
  AudioLines,
  Timer,
  ListMusic,
  Mic2,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SIZES, FONTS, TYPE, SHADOWS, SPRINGS, springVelocity } from '../constants/theme';
import { peekExpansionOrigin, type ExpansionOrigin } from '../player/expansionStore';
import { SeekBar } from '../components/player/SeekBar';
import { QueueSheet } from '../components/player/QueueSheet';
import { TrackActionsSheet } from '../components/lists/TrackActionsSheet';
import { KaraokeLyrics } from '../components/player/KaraokeLyrics';
import { ShareSheet, ShareRequest } from '../components/share/ShareSheet';
import { Artwork } from '../components/common/Artwork';
import { DownloadService } from '../services/DownloadService';
import { LyricsService, Lyrics } from '../services/LyricsService';
import { SleepTimer } from '../services/SleepTimerService';
import { Track } from '../core/types';
import { usePlayer, useProgress } from '../hooks/usePlayer';
import { useLibrary } from '../hooks/useLibrary';
import { usePalette } from '../hooks/usePalette';
import { useAppearance } from '../hooks/useAppearance';
import { hapticLight } from '../utils/haptics';
import { useNavigation } from '@react-navigation/native';

/** Tactile press: quick scale-down, spring back. Short and interruptible. */
function usePressScale() {
  const value = useRef(new Animated.Value(1)).current;
  const onPressIn = () => Animated.spring(value, { toValue: 0.92, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
  const onPressOut = () => Animated.spring(value, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
  return { animatedStyle: { transform: [{ scale: value }] }, onPressIn, onPressOut };
}

// ---------------------------------------------------------------------------
// Lyrics view — Roman English lines, with a KARAOKE mode when the track is
// synced: line-by-line highlight, spring activations, tap-to-seek.
// ---------------------------------------------------------------------------

const LyricsView: React.FC<{
  track: Track;
  lyrics: Lyrics | null;
  loading: boolean;
  onSeek?: (seconds: number) => void;
  onRetry?: () => void;
  /** Opens the track's action sheet, per the reference's ⋮ affordance. */
  onMore?: () => void;
}> = ({ track, lyrics, loading, onSeek, onRetry, onMore }) => {
  const { position } = useProgress();
  const scrollRef = useRef<ScrollView>(null);
  const activeIndexRef = useRef(-1);
  const [karaoke, setKaraoke] = useState(true);

  const activeIndex = useMemo(
    () => (lyrics?.synced ? LyricsService.activeLineIndex(lyrics, position) : -1),
    [lyrics, Math.floor(position * 2)]
  );

  // Keep the active line centred (plain mode only; karaoke scrolls itself).
  useEffect(() => {
    if (karaoke) return;
    if (activeIndex < 0 || activeIndex === activeIndexRef.current) return;
    activeIndexRef.current = activeIndex;
    scrollRef.current?.scrollTo({ y: Math.max(0, activeIndex * 48 - 130), animated: true });
  }, [activeIndex, karaoke]);

  return (
    <View style={styles.lyricsWrap}>
      {/* Track header: small artwork + title/artist + Roman English pill */}
      <View style={styles.lyricsHeader}>
        <Artwork uri={track.albumImageUrl} size={44} radius={10} />
        <View style={styles.lyricsHeaderText}>
          <Text style={styles.lyricsTitle} numberOfLines={1}>{track.title}</Text>
          <Text style={styles.lyricsArtist} numberOfLines={1}>{track.artist.name}</Text>
        </View>
        {lyrics?.synced ? (
          <TouchableOpacity
            style={[styles.karaokeToggle, karaoke && styles.karaokeToggleOn]}
            onPress={() => setKaraoke((v) => !v)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={karaoke ? 'Switch to plain lyrics' : 'Switch to karaoke'}
          >
            <Mic2 color={karaoke ? COLORS.text.dark : COLORS.accent.primary} size={13} />
            <Text style={[styles.karaokeToggleText, karaoke && styles.karaokeToggleTextOn]}>
              KARAOKE
            </Text>
          </TouchableOpacity>
        ) : null}
        {onMore ? (
          <TouchableOpacity
            style={styles.lyricsMore}
            onPress={onMore}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Track actions"
          >
            <EllipsisVertical color={COLORS.text.primary} size={SIZES.icon.md} />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.lyricsLoading}>
          <ActivityIndicator color={COLORS.accent.primary} size="large" />
          <Text style={styles.lyricsLoadingText}>Loading Roman English lyrics...</Text>
        </View>
      ) : !lyrics || lyrics.lines.length === 0 ? (
        <View style={styles.lyricsEmpty}>
          <AudioLines color={COLORS.text.muted} size={SIZES.icon.lg} />
          <Text style={styles.lyricsEmptyTitle}>Lyrics unavailable</Text>
          <Text style={styles.lyricsEmptyHint}>
            Could not fetch Roman English lyrics for this track right now.
          </Text>
          {onRetry && (
            <TouchableOpacity style={styles.retryLyricsButton} onPress={onRetry}>
              <Text style={styles.retryLyricsText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : lyrics.synced && karaoke ? (
        <KaraokeLyrics lyrics={lyrics} position={position} onSeek={(s) => onSeek?.(s)} />
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.lyricsScroll}
          contentContainerStyle={styles.lyricsContent}
          showsVerticalScrollIndicator={false}
        >
          {lyrics.lines.map((line, i) => {
            const isActive = lyrics.synced && i === activeIndex;
            return (
              <TouchableOpacity
                key={i}
                activeOpacity={0.75}
                disabled={!lyrics.synced || line.time === undefined || !onSeek}
                onPress={() => {
                  if (line.time !== undefined && onSeek) {
                    onSeek(line.time);
                  }
                }}
                style={styles.lyricLineRow}
              >
                <Text
                  style={[
                    styles.lyricLine,
                    isActive && styles.lyricLineActive,
                    lyrics.synced && !isActive && styles.lyricLineDim,
                  ]}
                >
                  {line.text || ' '}
                </Text>
              </TouchableOpacity>
            );
          })}
          <View style={styles.lyricsFooter}>
            <Text style={styles.lyricsSource}>
              {lyrics.source}
              {lyrics.synced ? ' · Live Synced' : ''} · Roman English
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
};

// ---------------------------------------------------------------------------
// The screen
// ---------------------------------------------------------------------------

export default function NowPlayingScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const {
    currentTrack,
    isPlaying,
    togglePlayPause,
    pauseIfPlaying,
    isLoading,
    isBuffering,
    error,
    retry,
    seekTo,
    next,
    previous,
    shuffle,
    toggleShuffle,
    repeat,
    cycleRepeat,
    queue,
    upcoming,
    queueContext,
    jumpTo,
    removeFromQueue,
    reorderUpcomingInQueue,
    clearQueue,
    playNext,
    addToQueue,
    playRadio,
    volume,
    setVolume,
  } = usePlayer();

  const { isLiked, toggleLike } = useLibrary();
  const [view, setView] = useState<'player' | 'lyrics' | 'about'>('player');
  const [showQueue, setShowQueue] = useState(false);
  const [actionsTrack, setActionsTrack] = useState<Track | null>(null);
  // Timer shortcuts land straight in the sleep picker, not the generic menu.
  const [actionsInitial, setActionsInitial] = useState<'actions' | 'sleep'>('actions');
  const [shareRequest, setShareRequest] = useState<ShareRequest | null>(null);
  /** Immersive listening: dims the room, enlarges the art, keeps controls. */
  const [immersive, setImmersive] = useState(false);

  // Responsive artwork sizing so all controls stay comfortably on-screen
  const isCompact = height < 740;
  const isUltraCompact = height < 640;

  const artworkSize = useMemo(() => {
    const reservedVertical = isUltraCompact ? 280 : isCompact ? 330 : 380;
    const verticalMax = Math.max(140, height - (insets.top + insets.bottom + reservedVertical));
    const horizontalMax = Math.max(140, width - SIZES.lg * 2);
    return Math.min(horizontalMax, verticalMax, isUltraCompact ? 220 : isCompact ? 270 : 330);
  }, [width, height, insets.top, insets.bottom, isCompact, isUltraCompact]);

  // Lyrics: fetched for the current track in Roman English
  const [lyrics, setLyrics] = useState<Lyrics | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);

  const loadLyrics = useCallback(() => {
    if (!currentTrack) return;
    // Guard: a fast track switch must never land an older track's lyrics.
    let cancelled = false;
    setLyrics(null);
    setLyricsLoading(true);
    LyricsService.get(currentTrack)
      .then((result) => {
        if (!cancelled) setLyrics(result);
      })
      .catch(() => {
        if (!cancelled) setLyrics(null);
      })
      .finally(() => {
        if (!cancelled) setLyricsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentTrack]);

  useEffect(() => loadLyrics(), [loadLyrics]);

  // Sleep timer: wired here so the action sheet's picker controls real
  // playback pause through the app's own play/pause path. pauseIfPlaying is
  // ref-stable, so the timer always does the right thing no matter how often
  // the user pauses/resumes while it runs.
  const handleSleepTimer = useCallback(
    (minutes: number | null) => {
      if (minutes === null) {
        SleepTimer.cancel();
        return;
      }
      SleepTimer.start(minutes, pauseIfPlaying);
      Alert.alert('Sleep timer', `Playback will pause in ${minutes} minutes.`);
    },
    [pauseIfPlaying]
  );

  const play = usePressScale();

  // ---------------------------------------------------------------------------
  // Artwork-reactive ambience + cinematic motion (all reanimated, UI thread).
  //
  // Honesty rules encoded here:
  //   · Palette crossfades run 480 ms — inside the 350–600 ms band — so a
  //     track change NEVER flashes the interface into a new color scheme.
  //   · The ambient pulse is driven ONLY by real playback state (isPlaying);
  //     it is a breathing glow, not a faked spectrum. (Audio-reactive FFT is
  //     technically unavailable: IFrame audio is cross-origin and expo-audio
  //     exposes no analyser tap — so none is pretended.)
  //   · Reduced motion collapses every effect here to an instant state set.
  // ---------------------------------------------------------------------------
  const { palette } = usePalette();
  const { motionReduced } = useAppearance();
  const accent = palette?.accent ?? COLORS.accent.primary;
  const accentSoft = palette?.accentSoft ?? COLORS.accent.soft;
  const accentGlow = palette?.accentGlow ?? COLORS.accent.glow;
  const ambientWash = palette?.ambient ?? COLORS.atmosphere.soft;

  const accentShared = useSharedValue(accent);
  const ringBgShared = useSharedValue(accentSoft);
  const glowShared = useSharedValue(accentGlow);
  const washShared = useSharedValue(ambientWash);
  const chromeOpacity = useSharedValue(1);
  const bottomOpacity = useSharedValue(1);
  const immersiveGlow = useSharedValue(0);
  const artworkScale = useSharedValue(1);
  const entranceOpacity = useSharedValue(1);
  const pulseOpacity = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const dragY = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const colorFade = motionReduced ? 0 : 480;

  // -----------------------------------------------------------------------
  // Shared-element flight — the artwork physically travels from the mini
  // player's rect to the hero position (and back on dismissal).
  //
  // Honesty + safety rules:
  //   · The flight only runs when the mini player published a rect for the
  //     SAME artwork URI, motion is allowed, and the hero has laid out.
  //     Anything else falls back to the plain fade entrance/dismissal.
  //   · The clone and the real hero swap in the same frame (hero snaps
  //     visible the moment the clone lands), so no seam is ever visible.
  //   · Window coordinates are converted into the screen's own coordinate
  //     space (the container origin), which matters on web where the app
  //     renders inside a phone frame offset from the viewport origin.
  // -----------------------------------------------------------------------
  const flightOriginRef = useRef<ExpansionOrigin | null>(peekExpansionOrigin());
  const flightUri = flightOriginRef.current?.uri ?? null;
  const flightActive = !!flightOriginRef.current && !motionReduced && !!flightUri;
  const flightActiveRef = useRef(flightActive);
  useEffect(() => {
    flightActiveRef.current = flightActive;
  }, [flightActive]);

  // Flight clone shared values; they start parked on the mini rect.
  const flyX = useSharedValue(flightOriginRef.current?.x ?? 0);
  const flyY = useSharedValue(flightOriginRef.current?.y ?? 0);
  const flySize = useSharedValue(flightOriginRef.current?.size ?? 44);
  const flyRadius = useSharedValue(12);
  const flyOpacity = useSharedValue(flightActive ? 1 : 0);
  // Hero hidden while the clone owns the artwork; screen dissolves in behind it.
  const heroVisible = useSharedValue(flightActive ? 0 : 1);
  const screenIn = useSharedValue(flightActive ? 0 : 1);
  const [flightUriState, setFlightUriState] = useState<string | null>(flightActive && flightUri ? flightUri : null);
  const landedRef = useRef(!flightActive);
  const committedRef = useRef(false);
  const flyStartedRef = useRef(!flightActive);
  const landTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heroRef = useRef<View | null>(null);
  const containerRef = useRef<View | null>(null);

  useEffect(() => {
    return () => {
      if (landTimerRef.current) clearTimeout(landTimerRef.current);
      if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    };
  }, []);

  /** The real hero takes over from the clone in one frame. */
  const landFlight = useCallback(() => {
    if (landedRef.current) return;
    landedRef.current = true;
    heroVisible.value = 1;
    flyOpacity.value = 0;
    // Keep the clone mounted one extra tick so the swap can never flash.
    setTimeout(() => setFlightUriState(null), 80);
  }, [heroVisible, flyOpacity]);

  /** Fly the clone from wherever the hero is right now back to the mini rect. */
  const commitDismiss = useCallback(() => {
    if (committedRef.current) return;
    committedRef.current = true;
    navigationRef.current.goBack();
  }, []);

  const dismissingRef = useRef(false);
  const requestDismiss = useCallback(
    (velocityY = 0, relaxDrag = false) => {
      if (dismissingRef.current) return;
      const origin = peekExpansionOrigin();
      const node = heroRef.current;
      // Honest fallback: no flight data, reduced motion, or no laid-out hero
      // (lyrics/about views) → the plain route dismissal.
      if (!flightActiveRef.current || !origin || !node) {
        if (relaxDrag) dragY.value = withTiming(0, { duration: 160 });
        commitDismiss();
        return;
      }
      dismissingRef.current = true;
      // Freeze drag tracking while measuring so the takeover is exact.
      const uri = currentTrack?.albumImageUrl ?? origin.uri ?? '';
      node.measureInWindow((hx, hy, w) => {
        if (w <= 0) {
          if (relaxDrag) dragY.value = withTiming(0, { duration: 160 });
          commitDismiss();
          return;
        }
        containerRef.current?.measureInWindow((cx, cy) => {
          // Clone takes over from the hero's LIVE rect (scroll, parallax and
          // any drag translation included), then flies home.
          flyX.value = hx - cx;
          flyY.value = hy - cy;
          flySize.value = w;
          flyRadius.value = SIZES.radius.xl;
          flyOpacity.value = 1;
          setFlightUriState(uri || null);
          heroVisible.value = 0;
          // The room dissolves while the artwork travels home.
          screenIn.value = withTiming(0, { duration: 240 });
          if (relaxDrag) dragY.value = withTiming(0, { duration: 200 });
          const spring = { ...SPRINGS.flight, velocity: springVelocity(velocityY) };
          flyX.value = withSpring(origin.x - cx, spring);
          flyY.value = withSpring(origin.y - cy, spring, (finished) => {
            if (finished) runOnJS(commitDismiss)();
          });
          flySize.value = withSpring(origin.size, spring);
          flyRadius.value = withSpring(12, spring);
          if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
          commitTimerRef.current = setTimeout(commitDismiss, 800);
        });
      });
    },
    [commitDismiss, dragY, currentTrack, flyOpacity, flyRadius, flySize, flyX, flyY, heroVisible, screenIn]
  );

  // Ref bridge: memoized gesture handlers must reach the latest closure.
  const requestDismissRef = useRef(requestDismiss);
  useEffect(() => {
    requestDismissRef.current = requestDismiss;
  }, [requestDismiss]);

  useEffect(() => {
    accentShared.value = withTiming(accent, { duration: colorFade });
    ringBgShared.value = withTiming(accentSoft, { duration: colorFade });
    glowShared.value = withTiming(accentGlow, { duration: colorFade });
    washShared.value = withTiming(ambientWash, { duration: colorFade });
  }, [accent, accentSoft, accentGlow, ambientWash, colorFade, accentShared, ringBgShared, glowShared, washShared]);

  // Immersive mode: the room dims, the art leans forward, ambience deepens.
  useEffect(() => {
    chromeOpacity.value = withTiming(immersive ? 0.35 : 1, { duration: motionReduced ? 0 : 320 });
    bottomOpacity.value = withTiming(immersive ? 0.6 : 1, { duration: motionReduced ? 0 : 320 });
    immersiveGlow.value = withTiming(immersive ? 0.9 : 0, { duration: motionReduced ? 0 : 320 });
    artworkScale.value = motionReduced
      ? immersive ? 1.06 : 1
      : withSpring(immersive ? 1.06 : 1, SPRINGS.lively);
  }, [immersive, motionReduced, chromeOpacity, bottomOpacity, immersiveGlow, artworkScale]);

  // Entrance choreography — once per mount, before immersive can fight it.
  // With a shared-element flight pending, the flight owns the artwork and
  // only the room fades in; the plain choreography never runs.
  const didEnter = useRef(false);
  useEffect(() => {
    if (didEnter.current) return;
    didEnter.current = true;
    if (motionReduced) return;
    if (flightActiveRef.current) {
      screenIn.value = withTiming(1, { duration: 300 });
      return;
    }
    entranceOpacity.value = 0;
    artworkScale.value = 0.92;
    entranceOpacity.value = withTiming(1, { duration: 300 });
    artworkScale.value = withSpring(1, SPRINGS.lively);
  }, [motionReduced, entranceOpacity, artworkScale, screenIn]);

  // Ambient pulse — breathing glow around the play ring while ACTUALLY playing.
  useEffect(() => {
    if (isPlaying && !motionReduced && !immersive) {
      pulseScale.value = 1;
      pulseOpacity.value = 0;
      pulseScale.value = withDelay(
        250,
        withRepeat(
          withSequence(withTiming(1.36, { duration: 900 }), withTiming(1, { duration: 40 })),
          -1,
          false
        )
      );
      pulseOpacity.value = withDelay(
        250,
        withRepeat(
          withSequence(withTiming(0.5, { duration: 900 }), withTiming(0, { duration: 900 })),
          -1,
          false
        )
      );
    } else {
      cancelAnimation(pulseScale);
      cancelAnimation(pulseOpacity);
      pulseOpacity.value = withTiming(0, { duration: 200 });
      pulseScale.value = 1;
    }
  }, [isPlaying, motionReduced, immersive, pulseOpacity, pulseScale]);

  // Artwork parallax: the hero drifts at 8% of scroll speed and its glow
  // recedes as it leaves — depth without any extra blur cost.
  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const parallaxStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scrollY.value * 0.08 }, { scale: artworkScale.value }],
    opacity: entranceOpacity.value,
  }));
  // The hero itself hides while the flight clone owns the artwork — the glow
  // stays, so the light arrives before the object, like the reference.
  const heroStyle = useAnimatedStyle(() => ({ opacity: heroVisible.value }));
  const screenStyle = useAnimatedStyle(() => ({ opacity: screenIn.value }));
  const flyStyle = useAnimatedStyle(() => ({
    width: flySize.value,
    height: flySize.value,
    borderRadius: flyRadius.value,
    transform: [{ translateX: flyX.value }, { translateY: flyY.value }],
    opacity: flyOpacity.value,
  }));

  /** Measure the hero's live window rect and launch the flight to it. */
  const onHeroLayout = useCallback(() => {
    if (flyStartedRef.current) return;
    const node = heroRef.current;
    if (!node) return;
    node.measureInWindow((hx, hy, w) => {
      if (flyStartedRef.current || w <= 0) return;
      const origin = flightOriginRef.current;
      if (!origin) return;
      containerRef.current?.measureInWindow((cx, cy) => {
        if (flyStartedRef.current) return;
        flyStartedRef.current = true;
        flyX.value = withSpring(hx - cx, SPRINGS.flight);
        flyY.value = withSpring(hy - cy, SPRINGS.flight, (finished) => {
          if (finished) runOnJS(landFlight)();
        });
        flySize.value = withSpring(w, SPRINGS.flight);
        flyRadius.value = withSpring(SIZES.radius.xl, SPRINGS.flight);
        // Safety: an interrupted spring must still hand over to the hero.
        if (landTimerRef.current) clearTimeout(landTimerRef.current);
        landTimerRef.current = setTimeout(landFlight, 900);
      });
    });
  }, [flyX, flyY, flySize, flyRadius, landFlight]);

  /**
   * Container origin: window coords → screen-local coords. The parked clone
   * starts in window coordinates; the moment the container measures, the
   * clone is re-anchored into local space (identical visual position) so web
   * frames offset from the viewport never show it at the wrong spot.
   */
  const onContainerLayout = useCallback(() => {
    containerRef.current?.measureInWindow((cx, cy) => {
      const origin = flightOriginRef.current;
      if (!origin || flyStartedRef.current) return;
      flyX.value = origin.x - cx;
      flyY.value = origin.y - cy;
    });
  }, [flyX, flyY]);

  const glowStyle = useAnimatedStyle(() => {
    const base = Math.max(0, 1 - Math.min(scrollY.value / 320, 0.6));
    const boost = immersiveGlow.value > 0.5 ? 1.4 : 1;
    return {
      backgroundColor: glowShared.value,
      opacity: Math.min(1, base * boost),
    };
  });

  // Drag-down-to-dismiss on the header — the inverse of the mini-player's
  // swipe-up. Direct tracking; commit past 110 pt, spring back otherwise.
  const navigationRef = useRef(navigation);
  const motionRef = useRef(motionReduced);
  useEffect(() => {
    motionRef.current = motionReduced;
  }, [motionReduced]);
  const headerPan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          !motionRef.current && g.dy > 12 && Math.abs(g.dy) > Math.abs(g.dx) * 1.1,
        onPanResponderMove: (_, g) => {
          dragY.value = Math.max(g.dy, 0);
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy > 110 || g.vy > 0.9) {
            // The flight owns the exit: freeze the drag where it is, let
            // requestDismiss measure and hand over, then relax the chrome.
            requestDismissRef.current(g.vy, true);
          } else {
            dragY.value = withSpring(0, {
              ...SPRINGS.release,
              velocity: springVelocity(g.vy),
            });
          }
        },
        onPanResponderTerminate: () => {
          dragY.value = withSpring(0, SPRINGS.release);
        },
      }),
    [dragY]
  );
  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value * 0.9 }],
    opacity: 1 - Math.min(dragY.value / 320, 0.7),
  }));

  // Web drag-to-dismiss: document-level pointer tracking keyed to the header
  // (testID closest-match). The PanResponder above stays authoritative on
  // native; on web RNW's pan claim is unreliable and text selection wins —
  // this path is deterministic. Listeners live for the screen's lifetime and
  // only act while a press STARTED inside the header. Velocity comes from
  // the last two pointer samples (px/ms), matching the mini player.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    let active = false;
    let startY = 0;
    let lastY = 0;
    let lastT = 0;
    let velocity = 0;
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || typeof t.closest !== 'function' || !t.closest('[data-testid="np-header"]')) return;
      active = true;
      startY = e.clientY;
      lastY = e.clientY;
      lastT = e.timeStamp;
      velocity = 0;
    };
    const onMove = (e: PointerEvent) => {
      if (!active || motionRef.current) return;
      const dy = e.clientY - startY;
      if (dy > 0) dragY.value = dy;
      const dt = e.timeStamp - lastT;
      if (dt > 0) {
        velocity = velocity * 0.6 + ((e.clientY - lastY) / dt) * 0.4;
        lastY = e.clientY;
        lastT = e.timeStamp;
      }
    };
    const onUp = (e: PointerEvent) => {
      if (!active) return;
      active = false;
      const dy = e.clientY - startY;
      if (dy > 110 || velocity > 0.9) {
        requestDismissRef.current(velocity, true);
      } else if (dragY.value > 0) {
        dragY.value = withSpring(0, {
          ...SPRINGS.release,
          velocity: springVelocity(velocity),
        });
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chromeStyle = useAnimatedStyle(() => ({ opacity: chromeOpacity.value }));
  const bottomChromeStyle = useAnimatedStyle(() => ({ opacity: bottomOpacity.value }));
  const washStyle = useAnimatedStyle(() => ({ backgroundColor: washShared.value }));
  const immersiveWashStyle = useAnimatedStyle(() => ({
    backgroundColor: washShared.value,
    opacity: immersiveGlow.value,
  }));
  const ringStyle = useAnimatedStyle(() => ({
    borderColor: accentShared.value,
    backgroundColor: ringBgShared.value,
  }));
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
    transform: [{ scale: pulseScale.value }],
    backgroundColor: accentShared.value,
  }));

  if (!currentTrack) return null;

  const liked = isLiked(currentTrack.id);
  const busy = isLoading || isBuffering;

  /** Artist/album lookup: real search navigation, same as Library rows. */
  const goToString = (q: string) => {
    setShowQueue(false);
    setActionsTrack(null);
    navigation.goBack();
    // SearchTab picks up browseQuery params from other screens; one
    // synchronous navigate lands on the right tab with the query attached —
    // no timer, no unmount race.
    (navigation.navigate as (name: string, params?: object) => void)('SearchTab', {
      browseQuery: q,
    });
  };

  return (
    <View style={styles.container} ref={containerRef}>
      <Reanimated.View style={[StyleSheet.absoluteFill, screenStyle]} pointerEvents="box-none">
      {/* Background artwork blur — the track colours the room. */}
      <Image
        source={{ uri: currentTrack.albumImageUrl }}
        style={StyleSheet.absoluteFill}
        blurRadius={24}
      />
      <LinearGradient
        colors={['rgba(4, 10, 11, 0.55)', COLORS.background]}
        locations={[0, 0.72]}
        style={StyleSheet.absoluteFill}
      />
      {/* Artwork-reactive ambience: a breathing wash above the blurred art,
          plus an immersive layer that deepens the room in immersive mode. */}
      <Reanimated.View pointerEvents="none" style={[StyleSheet.absoluteFill, washStyle]} />
      <Reanimated.View pointerEvents="none" style={[StyleSheet.absoluteFill, immersiveWashStyle]} />

      <Reanimated.ScrollView
        style={[styles.scroll, dragStyle]}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + (isCompact ? 4 : SIZES.xs),
            paddingBottom: insets.bottom + (isCompact ? SIZES.xs : SIZES.md),
          },
        ]}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Header: collapse · Playing from · actions. Dragging it down dismisses
            the player (the same direct-manipulation language as the mini bar). */}
        <Reanimated.View
          style={[styles.header, chromeStyle, styles.noSelect]}
          testID="np-header"
          {...headerPan.panHandlers}
        >
          <TouchableOpacity
            onPress={() => requestDismiss()}
            style={styles.headerIcon}
            accessibilityRole="button"
            accessibilityLabel="Close player"
          >
            <ChevronDown color={COLORS.text.primary} size={SIZES.icon.lg} />
          </TouchableOpacity>

          {view === 'player' ? (
            <>
              {/* Full player: one line of context, share at the right. */}
              <Text style={styles.headerContext} numberOfLines={1}>
                Playing from {queueContext || 'Arkify'}
              </Text>
              <TouchableOpacity
                style={styles.headerIcon}
                onPress={() =>
                  setShareRequest({
                    kind: 'track',
                    title: currentTrack.title,
                    artist: currentTrack.artist.name,
                    artworkUri: currentTrack.albumImageUrl,
                    contextLabel: queueContext || 'Now playing',
                    message: `${currentTrack.title} — ${currentTrack.artist.name}`,
                  })
                }
                accessibilityRole="button"
                accessibilityLabel="Share as card"
              >
                <Share color={COLORS.text.primary} size={SIZES.icon.md} />
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Lyrics view, per the reference: ••• returns to the artwork,
                  ⋮ opens the track's actions. */}
              <TouchableOpacity
                style={styles.headerIcon}
                onPress={() => setView('player')}
                accessibilityRole="button"
                accessibilityLabel="Show artwork"
              >
                <MoreHorizontal color={COLORS.text.primary} size={SIZES.icon.md} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerIcon}
                onPress={() => setActionsTrack(currentTrack)}
                accessibilityRole="button"
                accessibilityLabel="Track actions"
              >
                <EllipsisVertical color={COLORS.text.primary} size={SIZES.icon.md} />
              </TouchableOpacity>
            </>
          )}
        </Reanimated.View>

        {view === 'player' ? (
          <>
            {/* Artwork hero — parallax drift, entrance spring, palette glow */}
            <Reanimated.View style={[styles.artworkGlowWrap, isCompact && { marginTop: 4 }, parallaxStyle]}>
              <Reanimated.View
                style={[
                  styles.artworkGlow,
                  glowStyle,
                  {
                    width: artworkSize + 36,
                    height: artworkSize + 36,
                    borderRadius: (artworkSize + 36) / 2,
                  },
                ]}
              />
              <Reanimated.View
                ref={heroRef}
                onLayout={onHeroLayout}
                style={[
                  styles.artworkContainer,
                  { width: artworkSize, height: artworkSize },
                  SHADOWS.artwork,
                  heroStyle,
                ]}
              >
                <Artwork
                  uri={currentTrack.albumImageUrl}
                  size={artworkSize}
                  radius={SIZES.radius.xl}
                />
              </Reanimated.View>
            </Reanimated.View>

            {/* Track Info */}
            <View
              style={[
                styles.infoContainer,
                isCompact && { marginTop: SIZES.md, marginBottom: SIZES.sm },
              ]}
            >
              <View style={styles.textInfo}>
                <Text style={styles.trackTitle} numberOfLines={1}>{currentTrack.title}</Text>
                <Text style={styles.trackArtist} numberOfLines={1}>{currentTrack.artist.name}</Text>
              </View>
              <TouchableOpacity
                onPress={() => toggleLike(currentTrack)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={liked ? 'Remove from liked songs' : 'Add to liked songs'}
                accessibilityState={{ selected: liked }}
              >
                <Heart
                  color={liked ? accent : COLORS.text.primary}
                  fill={liked ? accent : 'transparent'}
                  size={SIZES.icon.lg + 2}
                />
              </TouchableOpacity>
            </View>

            {/* Progress. SeekBar owns its own measurement, gesture handling and
                position subscription, so this screen no longer re-renders on every
                playback tick. */}
            <SeekBar onSeek={seekTo} accentColor={accent} />

            {/* Error state -- never leaves the player stuck */}
            {error && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={retry}
                style={styles.errorBanner}
                accessibilityRole="button"
                accessibilityLabel={`Playback error: ${error}. Tap to retry.`}
              >
                <Text style={styles.errorText} numberOfLines={2}>{error}</Text>
                <Text style={styles.errorHint}>Tap to retry</Text>
              </TouchableOpacity>
            )}

            {/* Main Controls */}
            <View
              style={[
                styles.controlsContainer,
                isCompact && { marginBottom: SIZES.md },
              ]}
            >
              <TouchableOpacity
                onPress={toggleShuffle}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={shuffle ? 'Shuffle on' : 'Shuffle off'}
                accessibilityState={{ selected: shuffle }}
              >
                <Shuffle color={shuffle ? accent : COLORS.text.secondary} size={SIZES.icon.md + 2} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={previous}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Previous track"
              >
                <SkipBack color={COLORS.text.primary} size={SIZES.icon.xl} />
              </TouchableOpacity>
              <Animated.View style={[play.animatedStyle, styles.playButtonWrap]}>
                {/* Breathing glow driven by real playback state (see pulse effect). */}
                <Reanimated.View pointerEvents="none" style={[styles.pulseRing, pulseStyle]} />
                <Reanimated.View style={[styles.playRing, ringStyle, { shadowColor: accent }]}>
                  <TouchableOpacity
                    style={styles.playButton}
                    onPress={togglePlayPause}
                    onPressIn={play.onPressIn}
                    onPressOut={play.onPressOut}
                    activeOpacity={1}
                    accessibilityRole="button"
                    accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
                  >
                    {busy ? (
                      <ActivityIndicator color={accent} />
                    ) : isPlaying ? (
                      <Pause
                        color={accent}
                        size={SIZES.icon.play}
                        fill={accent}
                      />
                    ) : (
                      <Play
                        color={accent}
                        size={SIZES.icon.play}
                        fill={accent}
                      />
                    )}
                  </TouchableOpacity>
                </Reanimated.View>
              </Animated.View>
              <TouchableOpacity
                onPress={next}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Next track"
              >
                <SkipForward color={COLORS.text.primary} size={SIZES.icon.xl} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={cycleRepeat}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={`Repeat mode: ${repeat === 'off' ? 'off' : repeat === 'all' ? 'repeat all' : 'repeat one'}`}
                accessibilityState={{ selected: repeat !== 'off' }}
              >
                {repeat === 'one' ? (
                  <Repeat1 color={accent} size={SIZES.icon.md + 2} />
                ) : (
                  <Repeat
                    color={repeat === 'all' ? accent : COLORS.text.secondary}
                    size={SIZES.icon.md + 2}
                  />
                )}
              </TouchableOpacity>
            </View>

            {/* Bottom row, per the reference: timer · Lyrics pill · immersive · queue. */}
            <Reanimated.View style={[styles.bottomActions, bottomChromeStyle]}>
              <TouchableOpacity
                style={styles.bottomIcon}
                onPress={() => {
                  setActionsInitial('sleep');
                  setActionsTrack(currentTrack);
                }}
                accessibilityRole="button"
                accessibilityLabel="Sleep timer"
              >
                <Timer color={COLORS.text.primary} size={SIZES.icon.md} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.lyricsPill,
                  {
                    borderColor: palette?.accentBorder ?? 'rgba(59, 240, 223, 0.35)',
                    backgroundColor: accentSoft,
                  },
                ]}
                onPress={() => setView('lyrics')}
                accessibilityRole="button"
                accessibilityLabel="Open lyrics"
              >
                <Sparkles color={accent} size={SIZES.icon.sm + 2} />
                <Text style={[styles.lyricsPillText, { color: accent }]}>Lyrics</Text>
              </TouchableOpacity>

              {/* Immersive listening — dims the room, enlarges the art. */}
              <TouchableOpacity
                style={styles.bottomIcon}
                onPress={() => {
                  hapticLight();
                  setImmersive((v) => !v);
                }}
                accessibilityRole="button"
                accessibilityLabel={immersive ? 'Exit immersive mode' : 'Enter immersive mode'}
                accessibilityState={{ selected: immersive }}
              >
                {immersive ? (
                  <Minimize2 color={accent} size={SIZES.icon.md} />
                ) : (
                  <Maximize2 color={COLORS.text.primary} size={SIZES.icon.md} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.bottomIcon}
                onPress={() => setShowQueue(true)}
                accessibilityRole="button"
                accessibilityLabel="Show queue"
              >
                <ListMusic color={COLORS.text.primary} size={SIZES.icon.md} />
              </TouchableOpacity>
            </Reanimated.View>
          </>
        ) : (
          <>
            {/* Lyrics / About tabs, per the reference. */}
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tabChip, view === 'lyrics' && styles.tabChipActive]}
                activeOpacity={0.8}
                onPress={() => setView('lyrics')}
                accessibilityRole="tab"
                accessibilityState={{ selected: view === 'lyrics' }}
                accessibilityLabel="Lyrics tab"
              >
                <Text style={[styles.tabText, view === 'lyrics' && styles.tabTextActive]}>
                  Lyrics
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabChip, view === 'about' && styles.tabChipActive]}
                activeOpacity={0.8}
                onPress={() => setView('about')}
                accessibilityRole="tab"
                accessibilityState={{ selected: view === 'about' }}
                accessibilityLabel="About tab"
              >
                <Text style={[styles.tabText, view === 'about' && styles.tabTextActive]}>
                  About
                </Text>
              </TouchableOpacity>
            </View>

            {view === 'lyrics' ? (
              <LyricsView
                track={currentTrack}
                lyrics={lyrics}
                loading={lyricsLoading}
                onSeek={seekTo}
                onRetry={loadLyrics}
                onMore={() => setActionsTrack(currentTrack)}
              />
            ) : (
              <View style={styles.aboutWrap}>
                <View style={styles.aboutArtwork}>
                  <Artwork uri={currentTrack.albumImageUrl} size={148} radius={SIZES.radius.lg} />
                </View>
                <Text style={styles.aboutTitle} numberOfLines={2}>{currentTrack.title}</Text>
                <Text style={styles.aboutArtist} numberOfLines={1}>{currentTrack.artist.name}</Text>
                {currentTrack.album ? (
                  <View style={styles.aboutRow}>
                    <Text style={styles.aboutLabel}>ALBUM</Text>
                    <Text style={styles.aboutValue} numberOfLines={1}>{currentTrack.album}</Text>
                  </View>
                ) : null}
                <View style={styles.aboutRow}>
                  <Text style={styles.aboutLabel}>SOURCE</Text>
                  <Text style={styles.aboutValue}>{currentTrack.provider}</Text>
                </View>
                <View style={styles.aboutRow}>
                  <Text style={styles.aboutLabel}>DURATION</Text>
                  <Text style={styles.aboutValue}>
                    {currentTrack.duration > 0
                      ? `${Math.round(currentTrack.duration / 60)} min`
                      : '—'}
                  </Text>
                </View>
              </View>
            )}

            {/* Progress + controls stay available beneath the lyrics, per the
                reference: lyrics never trap the player. */}
            <SeekBar onSeek={seekTo} accentColor={accent} />
            {/* The full transport stays live under the lyrics, per the
                reference — reading lyrics never strands playback. */}
            <View style={styles.controlsContainer}>
              <TouchableOpacity
                onPress={toggleShuffle}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={shuffle ? 'Shuffle on' : 'Shuffle off'}
                accessibilityState={{ selected: shuffle }}
              >
                <Shuffle
                  color={shuffle ? accent : COLORS.text.secondary}
                  size={SIZES.icon.md + 2}
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={previous} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button" accessibilityLabel="Previous track">
                <SkipBack color={COLORS.text.primary} size={SIZES.icon.xl} />
              </TouchableOpacity>
              <Animated.View style={[play.animatedStyle, styles.playButtonWrap]}>
                <View style={styles.playRing}>
                  <TouchableOpacity
                    style={styles.playButton}
                    onPress={togglePlayPause}
                    onPressIn={play.onPressIn}
                    onPressOut={play.onPressOut}
                    activeOpacity={1}
                    accessibilityRole="button"
                    accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
                  >
                    {busy ? (
                      <ActivityIndicator color={COLORS.accent.primary} />
                    ) : isPlaying ? (
                      <Pause
                        color={COLORS.accent.primary}
                        size={SIZES.icon.play}
                        fill={COLORS.accent.primary}
                      />
                    ) : (
                      <Play
                        color={COLORS.accent.primary}
                        size={SIZES.icon.play}
                        fill={COLORS.accent.primary}
                      />
                    )}
                  </TouchableOpacity>
                </View>
              </Animated.View>
              <TouchableOpacity onPress={next} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button" accessibilityLabel="Next track">
                <SkipForward color={COLORS.text.primary} size={SIZES.icon.xl} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={cycleRepeat}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={`Repeat mode: ${repeat === 'off' ? 'off' : repeat === 'all' ? 'repeat all' : 'repeat one'}`}
                accessibilityState={{ selected: repeat !== 'off' }}
              >
                {repeat === 'one' ? (
                  <Repeat1 color={accent} size={SIZES.icon.md + 2} />
                ) : (
                  <Repeat
                    color={repeat === 'all' ? accent : COLORS.text.secondary}
                    size={SIZES.icon.md + 2}
                  />
                )}
              </TouchableOpacity>
            </View>

            {/* Same timer / queue pair as the artwork view. */}
            <View style={styles.bottomActions}>
              <TouchableOpacity
                style={styles.bottomIcon}
                onPress={() => {
                  setActionsInitial('sleep');
                  setActionsTrack(currentTrack);
                }}
                accessibilityRole="button"
                accessibilityLabel="Sleep timer"
              >
                <Timer color={COLORS.text.primary} size={SIZES.icon.md} />
              </TouchableOpacity>
              <View style={styles.bottomSpacer} />
              <TouchableOpacity
                style={styles.bottomIcon}
                onPress={() => setShowQueue(true)}
                accessibilityRole="button"
                accessibilityLabel="Show queue"
              >
                <ListMusic color={COLORS.text.primary} size={SIZES.icon.md} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </Reanimated.ScrollView>
      </Reanimated.View>

      {/* The flying artwork clone — outside the fading room so it stays fully
          visible while the screen dissolves in or out around it. */}
      {flightUriState ? (
        <Reanimated.View pointerEvents="none" style={[styles.flyArtwork, flyStyle]}>
          <Image source={{ uri: flightUriState }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        </Reanimated.View>
      ) : null}

      {/* Queue sheet */}
      <QueueSheet
        visible={showQueue}
        onClose={() => setShowQueue(false)}
        queue={queue}
        currentTrack={currentTrack}
        context={queueContext}
        upcoming={upcoming}
        onJumpTo={jumpTo}
        onRemove={removeFromQueue}
        onReorder={reorderUpcomingInQueue}
        onClear={clearQueue}
        shuffle={shuffle}
        onShuffle={toggleShuffle}
      />

      {/* Action sheet (reference composition) */}
      <TrackActionsSheet
        track={actionsTrack}
        initial={actionsInitial}
        onClose={() => setActionsTrack(null)}
        onPlayNext={playNext}
        onAddToQueue={addToQueue}
        onGoToRadio={(t) => void playRadio(t)}
        onGoToArtist={(t) => goToString(t.artist.name)}
        onViewAlbum={(t) => goToString([t.album, t.artist?.name].filter(Boolean).join(" "))}
        onSleepTimer={handleSleepTimer}
        volume={volume}
        onVolumeChange={setVolume}
      />

      {/* Share card */}
      <ShareSheet request={shareRequest} onClose={() => setShareRequest(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Transparent on purpose: the room (blur image + gradient + content)
    // fades in over the app behind it during the shared-element flight.
    backgroundColor: 'transparent',
  },
  /** The flying artwork clone — window-anchored, above every sheet. */
  flyArtwork: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
    backgroundColor: COLORS.surfaceElevated,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 16,
    zIndex: 50,
  } as ViewStyle,
  /** Headers never become text-selection sources during drag gestures. */
  noSelect: {
    userSelect: 'none',
  } as unknown as ViewStyle,
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: SIZES.lg,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.md,
  },
  headerIcon: {
    padding: SIZES.xs,
    minHeight: SIZES.touchTarget,
    justifyContent: 'center',
  },
  /** "Playing from …" — one line, centred between the two header actions. */
  headerContext: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FONTS.regular,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.text.secondary,
    paddingHorizontal: SIZES.sm,
  },
  artworkGlowWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SIZES.md,
  },
  artworkGlow: {
    position: 'absolute',
    backgroundColor: COLORS.accent.glow,
  },
  artworkContainer: {
    borderRadius: 22,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  infoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SIZES.xl,
    marginBottom: SIZES.lg,
  },
  textInfo: {
    flex: 1,
    paddingRight: SIZES.md,
  },
  trackTitle: {
    fontFamily: FONTS.bold,
    fontSize: 26,
    lineHeight: 32,
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  trackArtist: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.body.fontSize,
    color: COLORS.text.secondary,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.xl,
    paddingHorizontal: SIZES.sm,
  },
  playButtonWrap: {},
  /**
   * Outlined transport, per the reference: one accent ring around an accent
   * glyph on a near-transparent fill, with an ambient glow.
   */
  playRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1.5,
    borderColor: COLORS.accent.ring,
    backgroundColor: COLORS.accent.soft,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.accent.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8,
  },
  /** Breathing halo behind the play ring — real playback state only. */
  pulseRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  playButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.sm,
  },
  bottomIcon: {
    width: SIZES.touchTarget,
    height: SIZES.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSpacer: {
    height: SIZES.touchTarget,
  },
  lyricsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm + 2,
    paddingHorizontal: SIZES.lg,
    height: 44,
    borderRadius: SIZES.radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(59, 240, 223, 0.35)',
    backgroundColor: COLORS.accent.soft,
  },
  lyricsPillText: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.accent.primary,
  },
  tabRow: {
    flexDirection: 'row',
    gap: SIZES.sm,
    marginBottom: SIZES.lg,
  },
  tabChip: {
    flex: 1,
    height: 44,
    borderRadius: SIZES.radius.pill,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Selected tab fills with the accent, per the reference. */
  tabChipActive: {
    borderColor: COLORS.accent.primary,
    backgroundColor: COLORS.accent.primary,
  },
  tabText: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.text.soft,
  },
  tabTextActive: {
    color: COLORS.text.dark,
    fontFamily: FONTS.semibold,
  },
  lyricsWrap: {
    flex: 1,
    minHeight: 0,
  },
  aboutWrap: {
    flex: 1,
    minHeight: 0,
    alignItems: 'center',
    paddingTop: SIZES.sm,
  },
  aboutArtwork: {
    marginBottom: SIZES.lg,
  },
  aboutTitle: {
    fontFamily: FONTS.semibold,
    fontSize: TYPE.title3.fontSize,
    color: COLORS.text.primary,
    textAlign: 'center',
  },
  aboutArtist: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.subheadline.fontSize,
    color: COLORS.text.secondary,
    marginTop: 2,
    marginBottom: SIZES.lg,
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: SIZES.radius.md,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm + 2,
    marginBottom: SIZES.sm,
  },
  aboutLabel: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.overline.fontSize,
    letterSpacing: 2,
    color: COLORS.text.muted,
  },
  aboutValue: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.text.primary,
    textAlign: 'right',
    marginLeft: SIZES.md,
  },
  lyricsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.md,
    marginBottom: SIZES.md,
  },
  lyricsHeaderText: {
    flex: 1,
  },
  lyricsTitle: {
    fontFamily: FONTS.semibold,
    fontSize: TYPE.headline.fontSize,
    color: COLORS.text.primary,
  },
  lyricsArtist: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.subheadline.fontSize,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  /** The ⋮ affordance on the lyrics header, per the reference. */
  lyricsMore: {
    width: SIZES.touchTarget,
    height: SIZES.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** KARAOKE mode pill on the lyrics header. */
  karaokeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 15,
    backgroundColor: 'rgba(59, 240, 223, 0.10)',
    borderWidth: 1,
    borderColor: COLORS.accent.border,
  },
  karaokeToggleOn: {
    backgroundColor: COLORS.accent.primary,
    borderColor: COLORS.accent.primary,
  },
  karaokeToggleText: {
    fontFamily: FONTS.bold,
    fontSize: 9,
    letterSpacing: 1.2,
    color: COLORS.accent.primary,
  },
  karaokeToggleTextOn: {
    color: COLORS.text.dark,
  },
  lyricsScroll: {
    flex: 1,
  },
  lyricsContent: {
    paddingBottom: SIZES.xl,
    paddingTop: SIZES.xs,
  },
  lyricLineRow: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: SIZES.radius.sm,
  },
  lyricLine: {
    fontFamily: FONTS.semibold,
    fontSize: TYPE.title3.fontSize,
    lineHeight: 38,
    color: COLORS.text.primary,
    letterSpacing: 0.2,
  },
  /** The sung line reads brightest; the rest recede, per the reference. */
  lyricLineActive: {
    color: COLORS.text.primary,
    fontFamily: FONTS.bold,
  },
  lyricLineDim: {
    color: 'rgba(244, 244, 242, 0.42)',
  },
  lyricsFooter: {
    marginTop: SIZES.lg,
  },
  lyricsSource: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.micro.fontSize,
    color: COLORS.text.muted,
  },
  lyricsLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SIZES.sm,
    paddingVertical: SIZES.xxl,
  },
  lyricsLoadingText: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.subheadline.fontSize,
    color: COLORS.text.secondary,
  },
  lyricsEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SIZES.xl,
  },
  lyricsEmptyTitle: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.text.primary,
    marginTop: SIZES.md,
  },
  lyricsEmptyHint: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.text.muted,
    textAlign: 'center',
    marginTop: SIZES.xs,
    lineHeight: 18,
  },
  retryLyricsButton: {
    marginTop: SIZES.md,
    paddingHorizontal: SIZES.lg,
    paddingVertical: SIZES.xs + 2,
    borderRadius: SIZES.radius.pill,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.hairline,
  },
  retryLyricsText: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.accent.primary,
  },
  errorBanner: {
    backgroundColor: COLORS.status.errorGlow,
    borderRadius: SIZES.radius.sm,
    borderWidth: 1,
    borderColor: COLORS.status.error,
    padding: SIZES.sm,
    marginBottom: SIZES.md,
  },
  errorText: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.subheadline.fontSize,
    color: COLORS.text.primary,
  },
  errorHint: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.micro.fontSize,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
});
