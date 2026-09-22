import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, StyleProp, ViewStyle } from 'react-native';
import {
  LucideIcon,
  Music,
  TrendingUp,
  Star,
  Sun,
  Landmark,
  Headphones,
  Mic,
  Activity,
  Flame,
} from 'lucide-react-native';
import { ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SIZES, FONTS, TYPE, SHADOWS } from '../../constants/theme';
import { Artwork } from './Artwork';

/** Per-category hue pair and icon for the browse tiles matching Reference Image 7. */
const CATEGORY_META: Record<
  string,
  { colors: [string, string, string]; icon: LucideIcon; iconColor: string }
> = {
  Charts: {
    colors: ['rgba(16, 185, 129, 0.40)', 'rgba(6, 78, 59, 0.25)', '#0B1518'],
    icon: TrendingUp,
    iconColor: '#10B981',
  },
  'New Releases': {
    colors: ['rgba(139, 92, 246, 0.40)', 'rgba(76, 29, 149, 0.25)', '#0B1518'],
    icon: Star,
    iconColor: '#A78BFA',
  },
  Moods: {
    colors: ['rgba(245, 158, 11, 0.40)', 'rgba(180, 83, 9, 0.25)', '#0B1518'],
    icon: Sun,
    iconColor: '#FBBF24',
  },
  Indian: {
    colors: ['rgba(217, 70, 239, 0.40)', 'rgba(134, 25, 143, 0.25)', '#0B1518'],
    icon: Landmark,
    iconColor: '#F472B6',
  },
  'Hip-Hop': {
    colors: ['rgba(249, 115, 22, 0.40)', 'rgba(154, 52, 18, 0.25)', '#0B1518'],
    icon: Headphones,
    iconColor: '#FB923C',
  },
  Pop: {
    colors: ['rgba(236, 72, 153, 0.40)', 'rgba(157, 23, 77, 0.25)', '#0B1518'],
    icon: Mic,
    iconColor: '#F472B6',
  },
  EDM: {
    colors: ['rgba(24, 229, 213, 0.40)', 'rgba(14, 116, 144, 0.25)', '#0B1518'],
    icon: Activity,
    iconColor: '#18E5D5',
  },
  Rock: {
    colors: ['rgba(239, 68, 68, 0.40)', 'rgba(153, 27, 27, 0.25)', '#0B1518'],
    icon: Flame,
    iconColor: '#F87171',
  },
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
  const meta = CATEGORY_META[label] ?? {
    colors: ['rgba(24, 229, 213, 0.35)', 'rgba(14, 116, 144, 0.20)', '#0B1518'],
    icon: Music,
    iconColor: COLORS.accent.primary,
  };
  const Icon = meta.icon;

  return (
    <TouchableOpacity
      style={[styles.categoryTile, style]}
      activeOpacity={0.75}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Browse ${label}`}
    >
      <LinearGradient
        colors={meta.colors}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
      />
      <View style={[styles.categoryTileGlyph, { borderColor: meta.iconColor + '40' }]}>
        <Icon color={meta.iconColor} size={15} strokeWidth={2.4} />
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
    height: 104,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: SIZES.md,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    ...SHADOWS.ambient,
  },
  categoryTileLabel: {
    fontFamily: FONTS.semibold,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: '#FFFFFF',
  },
  categoryTileGlyph: {
    position: 'absolute',
    top: SIZES.sm + 2,
    right: SIZES.sm + 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
