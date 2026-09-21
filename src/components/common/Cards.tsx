import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, StyleProp, ViewStyle } from 'react-native';
import { LucideIcon, Music } from 'lucide-react-native';
import { ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SIZES, FONTS, TYPE, SHADOWS } from '../../constants/theme';
import { Artwork } from './Artwork';

/** Per-category hue pair for the browse tiles' ambient depth. */
const CATEGORY_GLOWS: Record<string, [string, string]> = {
  Charts: ['rgba(46, 204, 113, 0.16)', 'rgba(46, 204, 113, 0)'],
  'New Releases': ['rgba(155, 89, 182, 0.16)', 'rgba(155, 89, 182, 0)'],
  Moods: ['rgba(255, 159, 67, 0.15)', 'rgba(255, 159, 67, 0)'],
  Indian: ['rgba(241, 196, 15, 0.14)', 'rgba(241, 196, 15, 0)'],
  'Hip-Hop': ['rgba(93, 173, 226, 0.16)', 'rgba(93, 173, 226, 0)'],
  Pop: ['rgba(244, 143, 177, 0.15)', 'rgba(244, 143, 177, 0)'],
  EDM: ['rgba(61, 214, 195, 0.17)', 'rgba(61, 214, 195, 0)'],
  Rock: ['rgba(236, 112, 99, 0.15)', 'rgba(236, 112, 99, 0)'],
};

// ---------------------------------------------------------------------------
// MediaCard — artwork-led card for playlists / artists / albums
// ---------------------------------------------------------------------------

type MediaCardProps = {
  uri?: string;
  label: string;
  sublabel?: string;
  /** Artwork edge in px. The card matches this width. */
  size: number;
  /** Circle for artists. */
  round?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export const MediaCard: React.FC<MediaCardProps> = ({
  uri,
  label,
  sublabel,
  size,
  round = false,
  onPress,
  onLongPress,
  accessibilityLabel,
  style,
}) => (
  <TouchableOpacity
    style={[styles.mediaCard, { width: size }, style]}
    activeOpacity={0.7}
    onPress={onPress}
    onLongPress={onLongPress}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel ?? `${label}${sublabel ? `, ${sublabel}` : ''}`}
  >
    <Artwork uri={uri} size={size} round={round} />
    <Text style={[styles.mediaCardLabel, { marginTop: SIZES.sm }]} numberOfLines={1}>
      {label}
    </Text>
    {sublabel ? (
      <Text style={styles.mediaCardSublabel} numberOfLines={1}>
        {sublabel}
      </Text>
    ) : null}
  </TouchableOpacity>
);

// ---------------------------------------------------------------------------
// QuickActionTile — Home's compact mood shortcuts
// ---------------------------------------------------------------------------

type QuickActionTileProps = {
  Icon: LucideIcon;
  label: string;
  onPress: () => void;
  /** Shows the inline spinner instead of the icon while the query runs. */
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export const QuickActionTile: React.FC<QuickActionTileProps> = ({
  Icon,
  label,
  onPress,
  loading = false,
  style,
}) => (
  <TouchableOpacity
    style={[styles.quickTile, style]}
    activeOpacity={0.75}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ busy: loading }}
  >
    <View style={styles.quickTileIcon}>
      {loading ? (
        <ActivityIndicator size="small" color={COLORS.accent.primary} />
      ) : (
        <Icon color={COLORS.text.primary} size={SIZES.icon.sm} />
      )}
    </View>
    <Text style={styles.quickTileLabel} numberOfLines={1}>
      {label}
    </Text>
  </TouchableOpacity>
);

// ---------------------------------------------------------------------------
// CategoryTile — Search's browse grid
// ---------------------------------------------------------------------------

type CategoryTileProps = {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Browse category tile: dark elevated card with a soft category-hued ambient
 * wash and a corner icon chip. Artwork-free by design (no fake covers) —
 * depth comes from the wash, not from invented imagery.
 */
export const CategoryTile: React.FC<CategoryTileProps> = ({ label, onPress, style }) => {
  const glow = CATEGORY_GLOWS[label] ?? ['rgba(61, 214, 195, 0.14)', 'rgba(61, 214, 195, 0)'];

  return (
    <TouchableOpacity
      style={[styles.categoryTile, style]}
      activeOpacity={0.75}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Browse ${label}`}
    >
      <LinearGradient
        colors={glow}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
      />
      <View style={styles.categoryTileGlyph}>
        <Music color={COLORS.accent.primary} size={14} strokeWidth={2.2} />
      </View>
      <Text style={[styles.categoryTileLabel, { position: 'relative' }]} numberOfLines={2}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  mediaCard: {
    marginRight: SIZES.md,
  },
  mediaCardLabel: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.subheadline.fontSize,
    color: COLORS.text.primary,
  },
  mediaCardSublabel: {
    fontFamily: FONTS.regular,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.text.secondary,
    marginTop: 2,
  },

  quickTile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: SIZES.radius.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    marginHorizontal: 4,
  },
  quickTileIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SIZES.sm,
  },
  quickTileLabel: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.footnote.fontSize,
    color: COLORS.text.primary,
  },

  categoryTile: {
    height: 96,
    borderRadius: SIZES.radius.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    padding: SIZES.md,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    ...SHADOWS.ambient,
  },
  categoryTileLabel: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.text.primary,
  },
  categoryTileGlyph: {
    position: 'absolute',
    top: SIZES.sm + 2,
    right: SIZES.sm + 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(61, 214, 195, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(61, 214, 195, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
