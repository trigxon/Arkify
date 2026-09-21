import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Play, Pause, MonitorSpeaker } from 'lucide-react-native';
import { Track } from '../../core/types';
import { useProgress } from '../../hooks/usePlayer';
import { PlaybackSourceSheet } from './PlaybackSourceSheet';
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

export const MiniPlayer: React.FC<MiniPlayerProps> = ({
  track,
  isPlaying,
  onPress,
  onPlayPause,
  tabBarHeight,
  isLoading = false
}) => {
  const insets = useSafeAreaInsets();
  const [showSource, setShowSource] = useState(false);
  // Tab bar height matches TabNavigator: 56 content + real bottom inset (or 8 fallback).
  const resolvedTabBarHeight = tabBarHeight ?? 56 + Math.max(insets.bottom, 8);

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
          <Artwork uri={track.albumImageUrl} size={44} radius={10} />

          <View style={styles.infoContainer}>
            <Text style={styles.title} numberOfLines={1}>{track.title}</Text>
            <Text style={styles.artist} numberOfLines={1}>{track.artist.name}</Text>
          </View>

          <View style={styles.controls}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={(e) => {
                // Don't bubble to the outer row — the row opens Now Playing.
                (e as unknown as { stopPropagation?: () => void })?.stopPropagation?.();
                setShowSource(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Playback source"
            >
               <MonitorSpeaker color={COLORS.text.secondary} size={SIZES.icon.sm + 2} />
            </TouchableOpacity>
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
              ) : isPlaying ? (
                <Pause color={COLORS.text.primary} size={SIZES.icon.md + 2} fill={COLORS.text.primary} />
              ) : (
                <Play color={COLORS.text.primary} size={SIZES.icon.md + 2} fill={COLORS.text.primary} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Progress: a hairline along the bottom edge of the bar. */}
        <MiniPlayerProgress />
      </View>

      <PlaybackSourceSheet visible={showSource} onClose={() => setShowSource(false)} />
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
    borderColor: COLORS.hairline,
    borderWidth: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  infoContainer: {
    flex: 1,
    marginLeft: SIZES.md,
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
    padding: SIZES.sm,
    marginLeft: SIZES.xs,
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
