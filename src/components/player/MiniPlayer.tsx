import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { PanResponder, Platform, StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { Heart, Play, Pause } from 'lucide-react-native';
import { Track } from '../../core/types';
import { useProgress } from '../../hooks/usePlayer';
import { useLibrary } from '../../hooks/useLibrary';
import { usePalette } from '../../hooks/usePalette';
import { useAppearance } from '../../hooks/useAppearance';
import { COLORS, SIZES, FONTS, TYPE, SHADOWS, SPRINGS, springVelocity } from '../../constants/theme';
import { Artwork } from '../common/Artwork';
import { glassMaterial } from '../common/Glass';
import { setExpansionOrigin } from '../../player/expansionStore';
import { hapticLight } from '../../utils/haptics';

interface MiniPlayerProps {
  track: Track | null;
  isPlaying: boolean;
  onPress: () => void;
  onPlayPause: () => void;
  tabBarHeight?: number;
  isLoading?: boolean;
}

/**
 * Progress subtree: width from the real playback position, colour crossfaded
 * to the artwork palette on the UI thread (no re-render per tick).
 */
const MiniPlayerProgress: React.FC<{ accentShared: SharedValue<string> }> = React.memo(
  ({ accentShared }) => {
    const { position, duration } = useProgress();

    const progressPercent =
      duration > 0 ? Math.min(100, Math.max(0, (position / duration) * 100)) : 0;

    const fillStyle = useAnimatedStyle(() => ({
      backgroundColor: accentShared.value,
    }));

    return (
      <View style={styles.progressTrack} accessibilityElementsHidden>
        <Animated.View style={[styles.progressFill, { width: `${progressPercent}%` }, fillStyle]} />
      </View>
    );
  }
);
MiniPlayerProgress.displayName = 'MiniPlayerProgress';

/**
 * Like button subtree — re-renders only when liked state changes.
 * The heart pops on like (iOS spring) and ticks a light haptic.
 */
const MiniPlayerLike: React.FC<{ track: Track }> = ({ track }) => {
  const { isLiked, toggleLike } = useLibrary();
  const liked = isLiked(track.id);
  const pop = useSharedValue(1);

  useEffect(() => {
    pop.value = withSpring(liked ? 1.25 : 1, {
      damping: 12,
      stiffness: 360,
      mass: 0.6,
    });
  }, [liked, pop]);

  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  return (
    <TouchableOpacity
      style={styles.iconButton}
      onPress={() => {
        hapticLight();
        toggleLike(track);
      }}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      accessibilityRole="button"
      accessibilityLabel={liked ? 'Remove from liked songs' : 'Add to liked songs'}
      accessibilityState={{ selected: liked }}
      aria-pressed={liked}
    >
      <Animated.View style={heartStyle}>
        <Heart
          color={liked ? COLORS.accent.primary : COLORS.text.primary}
          fill={liked ? COLORS.accent.primary : 'transparent'}
          size={SIZES.icon.md}
          strokeWidth={1.9}
        />
      </Animated.View>
    </TouchableOpacity>
  );
};
MiniPlayerLike.displayName = 'MiniPlayerLike';

export const MiniPlayer: React.FC<MiniPlayerProps> = ({
  track,
  isPlaying,
  onPress,
  onPlayPause,
  tabBarHeight,
  isLoading = false
}) => {
  const insets = useSafeAreaInsets();
  // Tab bar height matches TabNavigator: 62 content + real bottom inset (or 8 fallback).
  const resolvedTabBarHeight = tabBarHeight ?? 62 + Math.max(insets.bottom, 8);

  // Artwork-reactive accent, crossfaded on the UI thread (480 ms — inside the
  // directive's 350–600 ms band, and never an abrupt recolor).
  const { palette } = usePalette();
  const { motionReduced, glass } = useAppearance();
  // The slab uses the named `mini` material — glass-intensity aware.
  const miniMaterial = glassMaterial(glass, 'mini');
  const accent = palette?.accent ?? COLORS.accent.primary;
  const accentSoft = palette?.accentSoft ?? COLORS.accent.soft;
  const accentShared = useSharedValue<string>(accent);
  const underGlowColor = useSharedValue<string>(COLORS.accent.soft);

  useEffect(() => {
    accentShared.value = withTiming(accent, { duration: motionReduced ? 0 : 480 });
    underGlowColor.value = withTiming(palette?.ambient ?? COLORS.accent.soft, {
      duration: motionReduced ? 0 : 480,
    });
  }, [accent, palette, motionReduced, accentShared, underGlowColor]);

  const underGlowStyle = useAnimatedStyle(() => ({
    backgroundColor: underGlowColor.value,
  }));

  // --- shared-element handoff ----------------------------------------------
  // The full player flies the artwork out of this slab, so the artwork's
  // window rect is published continuously (layout + every open) with the
  // artwork URI stamped in — a stale rect can never fly the wrong image.
  const artworkRef = useRef<View | null>(null);
  const trackRef = useRef(track);
  useEffect(() => {
    trackRef.current = track;
  }, [track]);

  const publishOrigin = useCallback(() => {
    const t = trackRef.current;
    if (!t || !artworkRef.current) return;
    artworkRef.current.measureInWindow((x, y, width) => {
      if (width <= 0) return;
      setExpansionOrigin({ x, y, size: width, uri: t.albumImageUrl ?? null });
    });
  }, []);

  // Keep the store warm on mount, track change and layout so even an
  // immediate press finds a fresh rect (measureInWindow resolves async).
  useEffect(() => {
    publishOrigin();
  }, [publishOrigin, track]);

  /** Open the full player: refresh the rect first, then navigate. */
  const openPlayer = useCallback(() => {
    publishOrigin();
    onPress();
  }, [publishOrigin, onPress]);

  // --- swipe-up to expand --------------------------------------------------
  // Vertical upward drags lift the slab and open the full player; taps pass
  // straight through to the touchables (the responder is claimed on movement
  // only). Disabled under reduced motion — tap still opens the player.
  // Release honours FLICK VELOCITY: a fast flick commits even from a short
  // drag, and the settle-back spring inherits the gesture's velocity so the
  // slab decelerates like a mass, not a timer.
  const dragY = useSharedValue(0);
  const openPlayerRef = useRef(openPlayer);
  const motionRef = useRef(motionReduced);
  useEffect(() => {
    openPlayerRef.current = openPlayer;
    motionRef.current = motionReduced;
  }, [openPlayer, motionReduced]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          !motionRef.current && g.dy < -14 && Math.abs(g.dy) > Math.abs(g.dx) * 1.15,
        onPanResponderMove: (_, g) => {
          dragY.value = Math.max(g.dy, -44);
        },
        onPanResponderRelease: (_, g) => {
          const flick = g.vy < -0.8; // px/ms — a decisive upward throw
          if (g.dy < -34 || flick) {
            dragY.value = withTiming(0, { duration: 110 });
            openPlayerRef.current();
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
    transform: [{ translateY: dragY.value * 0.55 }],
    opacity: 1 - Math.min(0.32, Math.abs(dragY.value) / 120),
  }));

  // Web swipe-up: document-level pointer tracking scoped to the mini player.
  // Native keeps the PanResponder; on web RNW's pan claim is unreliable.
  // Velocity is derived from the last two pointer samples (px/ms).
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    let active = false;
    let startY = 0;
    let lastY = 0;
    let lastT = 0;
    let velocity = 0;
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || typeof t.closest !== 'function' || !t.closest('[data-testid="mini-player"]')) return;
      active = true;
      startY = e.clientY;
      lastY = e.clientY;
      lastT = e.timeStamp;
      velocity = 0;
    };
    const onMove = (e: PointerEvent) => {
      if (!active || motionRef.current) return;
      const dy = e.clientY - startY;
      if (dy < 0) dragY.value = Math.max(dy, -44);
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
      if (dy < -34 || velocity < -0.8) {
        dragY.value = withTiming(0, { duration: 110 });
        openPlayerRef.current();
      } else if (dragY.value < 0) {
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
  }, [dragY]);

  // Layout changes (tab bar height, rotation) invalidate the stored rect.
  const onArtworkLayout = publishOrigin;

  if (!track) return null;

  return (
    <Animated.View
      style={[styles.positionContainer, { bottom: resolvedTabBarHeight + 8 }, dragStyle, styles.noSelect]}
      testID="mini-player"
      {...pan.panHandlers}
    >
      {/* Aqua ambience bleeding from under the slab — matches the tab bar. */}
      <Animated.View pointerEvents="none" style={[styles.underGlow, underGlowStyle]} />
      {/* Liquid glass slab: real blur on native, backdrop-filter sampling on
       *  web. CLEAR material — thin tint over sampled backdrop. */}
      <View
        style={[
          styles.container,
          SHADOWS.glass,
          { backgroundColor: miniMaterial.fill, borderColor: miniMaterial.border },
        ]}
      >
        {Platform.OS !== 'web' ? (
          <BlurView intensity={Math.round(miniMaterial.blur * 1.5)} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
        ) : (
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backdropFilter: `blur(${Math.round(miniMaterial.blur * 1.5)}px) saturate(135%)` } as unknown as ViewStyle]}
          />
        )}
        <LinearGradient
          colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.03)', 'rgba(255,255,255,0)']}
          locations={[0, 0.16, 0.48]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.10)']}
          locations={[0.68, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.content}>
          {/* Main tap area: opens the full player. Sibling to controls to prevent nested button hydration errors in React Native Web. */}
          <TouchableOpacity
            style={styles.mainPressArea}
            activeOpacity={0.85}
            onPress={openPlayer}
            accessibilityRole="button"
            accessibilityLabel={`Now playing: ${track.title} by ${track.artist.name}. Open player.`}
          >
            {/* Artwork: inset on a subtle accent-tinted plinth, per the reference.
                This exact rect is the origin of the shared-element flight. */}
            <View style={styles.artworkWrap} ref={artworkRef} onLayout={onArtworkLayout}>
              <Artwork uri={track.albumImageUrl} size={44} radius={10} />
            </View>

            <View style={styles.infoContainer}>
              <Text style={styles.title} numberOfLines={1}>{track.title}</Text>
              <Text style={styles.artist} numberOfLines={1}>{track.artist.name}</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.controls}>
            <MiniPlayerLike track={track} />
            <MiniPlayerPlay
              isPlaying={isPlaying}
              isLoading={isLoading}
              onPlayPause={onPlayPause}
              accent={accent}
              accentSoft={accentSoft}
            />
          </View>
        </View>

        {/* Progress: a hairline along the bottom edge of the bar. */}
        <MiniPlayerProgress accentShared={accentShared} />
      </View>
    </Animated.View>
  );
};

/** Play/pause with a spring press — the most-touched control in the app.
 *  Its ring crossfades to the artwork palette while playing. */
const MiniPlayerPlay: React.FC<{
  isPlaying: boolean;
  isLoading: boolean;
  onPlayPause: () => void;
  accent: string;
  accentSoft: string;
}> = ({ isPlaying, isLoading, onPlayPause, accent, accentSoft }) => {
  const scale = useSharedValue(1);
  const ringBorder = useSharedValue<string>(COLORS.accent.primary);
  const ringBg = useSharedValue<string>(COLORS.surfaceElevated);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const ringStyle = useAnimatedStyle(() => ({
    borderColor: ringBorder.value,
    backgroundColor: ringBg.value,
  }));

  useEffect(() => {
    ringBorder.value = withTiming(isPlaying ? accent : 'rgba(59, 240, 223, 0.60)', {
      duration: 480,
    });
    ringBg.value = withTiming(isPlaying ? accentSoft : COLORS.surfaceElevated, {
      duration: 480,
    });
  }, [isPlaying, accent, accentSoft, ringBorder, ringBg]);

  return (
    <TouchableOpacity
      style={styles.playButton}
      onPress={onPlayPause}
      onPressIn={() => {
        scale.value = withSpring(0.86, SPRINGS.press);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, SPRINGS.release);
      }}
      accessibilityRole="button"
      accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
    >
      <Animated.View style={anim}>
        {isLoading ? (
          <ActivityIndicator size="small" color={accent} />
        ) : (
          <Animated.View style={[styles.playRing, ringStyle, isPlaying && styles.playRingPlaying]}>
            {isPlaying ? (
              <Pause color={COLORS.text.primary} size={16} fill={COLORS.text.primary} />
            ) : (
              <Play color={COLORS.text.primary} size={16} fill={COLORS.text.primary} />
            )}
          </Animated.View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  positionContainer: {
    position: 'absolute',
    left: SIZES.sm,
    right: SIZES.sm,
    zIndex: 100,
  },
  underGlow: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: -8,
    height: 26,
    borderRadius: 999,
    backgroundColor: 'rgba(59, 240, 223, 0.11)',
    shadowColor: '#3BF0DF',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  container: {
    borderRadius: SIZES.radius.lg,
    overflow: 'hidden',
    // Fill/border come from the `mini` material at render time; these static
    // values are only the pre-measure fallback.
    backgroundColor: 'rgba(8, 21, 23, 0.36)',
    borderColor: 'rgba(190, 250, 243, 0.24)',
    borderWidth: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  mainPressArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SIZES.xs,
  },
  artworkWrap: {
    borderRadius: 12,
    padding: 2,
    backgroundColor: COLORS.accent.soft,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  infoContainer: {
    flex: 1,
    marginLeft: SIZES.sm + 2,
    justifyContent: 'center',
  },
  title: {
    fontFamily: FONTS.semibold,
    fontSize: TYPE.body.fontSize,
    color: COLORS.text.primary,
  },
  artist: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.subheadline.fontSize,
    color: COLORS.text.secondary,
    marginTop: 1,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: SIZES.sm,
  },
  playButton: {
    padding: SIZES.xs,
    marginLeft: SIZES.xs,
  },
  playRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(59, 240, 223, 0.60)',
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playRingPlaying: {
    borderColor: COLORS.accent.primary,
    backgroundColor: COLORS.accent.soft,
    shadowColor: '#3BF0DF',
    shadowOpacity: 0.65,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  progressTrack: {
    height: 3,
    backgroundColor: COLORS.player.progressTrack,
    width: '100%',
    position: 'absolute',
    bottom: 0,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.accent.primary,
    shadowColor: '#3BF0DF',
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  noSelect: {
    userSelect: 'none',
  } as unknown as ViewStyle,
});
