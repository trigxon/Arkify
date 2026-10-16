import React, { useEffect } from 'react';
import { Platform, StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Heart, Play, Pause } from 'lucide-react-native';
import { Track } from '../../core/types';
import { useProgress } from '../../hooks/usePlayer';
import { useLibrary } from '../../hooks/useLibrary';
import { COLORS, SIZES, FONTS, TYPE, SHADOWS, SPRINGS } from '../../constants/theme';
import { Artwork } from '../common/Artwork';

interface MiniPlayerProps {
  track: Track | null;
  isPlaying: boolean;
  onPress: () => void;
  onPlayPause: () => void;
  tabBarHeight?: number;
  isLoading?: boolean;
}

/**
 * Only this subtree subscribes to playback position.
 *
 * useProgress fires ~4x a second. Reading it in MiniPlayer itself re-rendered
 * the artwork and both Text nodes on every tick; isolating it here keeps the
 * bar live while the rest of the bar stays still.
 */
const MiniPlayerProgress: React.FC = React.memo(() => {
  const { position, duration } = useProgress();

  const progressPercent =
    duration > 0 ? Math.min(100, Math.max(0, (position / duration) * 100)) : 0;

  return (
    <View style={styles.progressTrack} accessibilityElementsHidden>
      <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
    </View>
  );
});
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
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        }
        toggleLike(track);
      }}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      accessibilityRole="button"
      accessibilityLabel={liked ? 'Remove from liked songs' : 'Add to liked songs'}
      accessibilityState={{ selected: liked }}
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

  if (!track) return null;

  return (
    <View style={[styles.positionContainer, { bottom: resolvedTabBarHeight + 8 }]}>
      {/* Aqua ambience bleeding from under the slab — matches the tab bar. */}
      <View pointerEvents="none" style={styles.underGlow} />
      {/* Liquid glass slab: real blur on native, layered translucency on web. */}
      <View style={[styles.container, SHADOWS.glass]}>
        {Platform.OS !== 'web' ? (
          <BlurView intensity={48} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
        ) : null}
        <LinearGradient
          colors={['rgba(255,255,255,0.20)', 'rgba(255,255,255,0.03)', 'rgba(255,255,255,0)']}
          locations={[0, 0.18, 0.52]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.22)']}
          locations={[0.62, 1]}
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
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={`Now playing: ${track.title} by ${track.artist.name}. Open player.`}
          >
            {/* Artwork: inset on a subtle accent-tinted plinth, per the reference. */}
            <View style={styles.artworkWrap}>
              <Artwork uri={track.albumImageUrl} size={44} radius={10} />
            </View>

            <View style={styles.infoContainer}>
              <Text style={styles.title} numberOfLines={1}>{track.title}</Text>
              <Text style={styles.artist} numberOfLines={1}>{track.artist.name}</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.controls}>
            <MiniPlayerLike track={track} />
            <MiniPlayerPlay isPlaying={isPlaying} isLoading={isLoading} onPlayPause={onPlayPause} />
          </View>
        </View>

        {/* Progress: a hairline along the bottom edge of the bar. */}
        <MiniPlayerProgress />
      </View>
    </View>
  );
};

/** Play/pause with a spring press — the most-touched control in the app. */
const MiniPlayerPlay: React.FC<{
  isPlaying: boolean;
  isLoading: boolean;
  onPlayPause: () => void;
}> = ({ isPlaying, isLoading, onPlayPause }) => {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

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
          <ActivityIndicator size="small" color={COLORS.accent.primary} />
        ) : (
          <View style={[styles.playRing, isPlaying && styles.playRingPlaying]}>
            {isPlaying ? (
              <Pause color={COLORS.text.primary} size={16} fill={COLORS.text.primary} />
            ) : (
              <Play color={COLORS.text.primary} size={16} fill={COLORS.text.primary} />
            )}
          </View>
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
    backgroundColor: 'rgba(59, 240, 223, 0.16)',
    shadowColor: '#3BF0DF',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
  },
  container: {
    borderRadius: SIZES.radius.lg,
    overflow: 'hidden',
    backgroundColor:
      Platform.OS === 'web' ? 'rgba(8, 20, 22, 0.78)' : 'rgba(7, 18, 20, 0.74)',
    borderColor: 'rgba(59, 240, 223, 0.26)',
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
});
