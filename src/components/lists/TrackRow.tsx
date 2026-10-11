import React, { useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  TextStyle,
} from 'react-native';
import { MoreVertical } from 'lucide-react-native';
import { Track } from '../../core/types';
import { COLORS, SIZES, FONTS, TYPE } from '../../constants/theme';
import { Artwork } from '../common/Artwork';

interface TrackRowProps {
  track: Track;
  /** Receives the row's track, so one stable callback can serve a whole list. */
  onPress: (track: Track) => void;
  isPlaying?: boolean;
  /** Shown while the row's target is being expanded or resolved. */
  isLoading?: boolean;
  onMorePress?: (track: Track) => void;
}

const TrackRowComponent: React.FC<TrackRowProps> = ({
  track,
  onPress,
  isPlaying,
  isLoading,
  onMorePress,
}) => {
  const handlePress = useCallback(() => onPress(track), [onPress, track]);
  const handleMorePress = useCallback(
    () => onMorePress?.(track),
    [onMorePress, track]
  );

  return (
    <View style={[styles.container, isPlaying && styles.containerPlaying]}>
      <TouchableOpacity
        style={styles.mainPressArea}
        activeOpacity={0.6}
        onPress={handlePress}
        delayPressIn={30}
        accessibilityRole="button"
        accessibilityLabel={
          isPlaying
            ? `Now playing: ${track.title} by ${track.artist.name}`
            : `Play ${track.title} by ${track.artist.name}`
        }
      >
        <Artwork uri={track.albumImageUrl} size={48} radius={10} />

        <View style={styles.infoContainer}>
          <Text style={[styles.title, isPlaying && styles.playingTitle]} numberOfLines={1}>
            {track.title}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {track.artist.name}
          </Text>
        </View>

        {isPlaying && !isLoading ? (
          // Tiny equalizer-style cue: three bars, no animation loop (cheap).
          <View style={styles.eqWrap} accessible={false} importantForAccessibility="no-hide-descendants">
            <View style={[styles.eqBar, { height: 8 }]} />
            <View style={[styles.eqBar, { height: 14 }]} />
            <View style={[styles.eqBar, { height: 10 }]} />
          </View>
        ) : null}
      </TouchableOpacity>

      {isLoading ? (
        <View style={styles.moreButton}>
          <ActivityIndicator size="small" color={COLORS.accent.primary} />
        </View>
      ) : (
        <TouchableOpacity
          style={styles.moreButton}
          onPress={handleMorePress}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={`More options for ${track.title}`}
        >
          <MoreVertical color={COLORS.text.muted} size={SIZES.icon.sm} />
        </TouchableOpacity>
      )}
    </View>
  );
};

/**
 * Memoized: a track row only re-renders when its own props change.
 *
 * Lists re-render whenever playback state changes; without this every row in
 * a 50-row search result rebuilt its Image and Text nodes on each tap.
 */
export const TrackRow = React.memo(TrackRowComponent);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: SIZES.radius.md,
  },
  containerPlaying: {
    backgroundColor: COLORS.accent.soft,
  },
  mainPressArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: SIZES.sm,
  },
  infoContainer: {
    flex: 1,
    marginLeft: SIZES.md,
    marginRight: SIZES.xs,
    justifyContent: 'center',
  },
  title: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.headline.fontSize,
    color: COLORS.text.primary,
    marginBottom: 2,
  } as TextStyle,
  playingTitle: {
    color: COLORS.accent.primary,
  },
  artist: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.subheadline.fontSize,
    color: COLORS.text.secondary,
  },
  eqWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    marginRight: SIZES.xs,
  },
  eqBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: COLORS.accent.primary,
  },
  moreButton: {
    padding: SIZES.sm + 2,
    paddingRight: SIZES.sm,
  },
});
