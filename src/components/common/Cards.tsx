import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, StyleProp, ViewStyle } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator } from 'react-native';
import { COLORS, SIZES, FONTS, TYPE, SHADOWS } from '../../constants/theme';
import { Artwork } from './Artwork';

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

export const CategoryTile: React.FC<CategoryTileProps> = ({ label, onPress, style }) => (
  <TouchableOpacity
    style={[styles.categoryTile, style]}
    activeOpacity={0.75}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={`Browse ${label}`}
  >
    <Text style={styles.categoryTileLabel} numberOfLines={2}>
      {label}
    </Text>
    <View style={styles.categoryTileGlyph}>
      <View style={[styles.categoryTileDot, { backgroundColor: COLORS.accent.primary }]} />
    </View>
  </TouchableOpacity>
);

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
    height: 88,
    borderRadius: SIZES.radius.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    padding: SIZES.md,
    justifyContent: 'flex-end',
  },
  categoryTileLabel: {
    fontFamily: FONTS.medium,
    fontSize: TYPE.callout.fontSize,
    color: COLORS.text.primary,
  },
  categoryTileGlyph: {
    position: 'absolute',
    top: SIZES.md,
    right: SIZES.md,
  },
  categoryTileDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.9,
  },
});
