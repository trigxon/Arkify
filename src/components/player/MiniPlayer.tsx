import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Heart, Play, Pause } from 'lucide-react-native';
import { Track } from '../../core/types';
import { useProgress } from '../../hooks/usePlayer';
import { useLibrary } from '../../hooks/useLibrary';
import { COLORS, SIZES, FONTS, TYPE, SHADOWS } from '../../constants/theme';
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
 */
const MiniPlayerLike: React.FC<{ track: Track }> = ({ track }) => {
  const { isLiked, toggleLike } = useLibrary();
  const liked = isLiked(track.id);

  return (
    <TouchableOpacity
      style={styles.iconButton}
      onPress={(e) => {
        (e as unknown as { stopPropagation?: () => void })?.stopPropagation?.();
        toggleLike(track);
      }}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      accessibilityRole="button"
      accessibilityLabel={liked ? 'Remove from liked songs' : 'Add to liked songs'}
      accessibilityState={{ selected: liked }}
    >
      <Heart
        color={liked ? COLORS.accent.primary : COLORS.text.secondary}
        fill={liked ? COLORS.accent.primary : 'transparent'}
        size={SIZES.icon.md - 2}
        strokeWidth={2}
      />
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
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={[styles.positionContainer, { bottom: resolvedTabBarHeight + 8 }]}
      accessibilityRole="button"
      accessibilityLabel={`Now playing: ${track.title} by ${track.artist.name}. Open player.`}
    >
      <View style={[styles.container, SHADOWS.glass]}>
        <View style={styles.content}>
          {/* Artwork: inset on a subtle accent-tinted plinth, per the reference. */}
          <View style={styles.artworkWrap}>
            <Artwork uri={track.albumImageUrl} size={42} radius={10} />
          </View>

          <View style={styles.infoContainer}>
            <Text style={styles.title} numberOfLines={1}>{track.title}</Text>
            <Text style={styles.artist} numberOfLines={1}>{track.artist.name}</Text>
          </View>

          <View style={styles.controls}>
            <MiniPlayerLike track={track} />
            <TouchableOpacity
              style={styles.playButton}
              onPress={(e) => {
                (e as unknown as { stopPropagation?: () => void })?.stopPropagation?.();
                onPlayPause();
              }}
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
            >
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
            </TouchableOpacity>
          </View>
        </View>

        {/* Progress: a hairline along the bottom edge of the bar. */}
        <MiniPlayerProgress />
      </View>
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
  container: {
    borderRadius: SIZES.radius.lg,
    overflow: 'hidden',
    backgroundColor: COLORS.surfaceRaised,
    borderColor: 'rgba(61, 214, 195, 0.16)',
    borderWidth: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  artworkWrap: {
    borderRadius: 12,
    padding: 2,
    backgroundColor: COLORS.accent.soft,
    borderWidth: 1,
    borderColor: 'rgba(61, 214, 195, 0.18)',
  },
  infoContainer: {
    flex: 1,
    marginLeft: SIZES.sm + 2,
    justifyContent: 'center',
  },
  title: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.subheadline.fontSize,
    color: COLORS.text.primary,
  },
  artist: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.footnote.fontSize,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(61, 214, 195, 0.55)',
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playRingPlaying: {
    borderColor: COLORS.accent.primary,
    backgroundColor: COLORS.accent.soft,
  },
  progressTrack: {
    height: 2,
    backgroundColor: COLORS.player.progressTrack,
    width: '100%',
    position: 'absolute',
    bottom: 0,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.accent.primary,
  },
});
