import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, StyleProp, ViewStyle } from 'react-native';
import {
  LucideIcon,
  AudioWaveform,
  Dumbbell,
  Guitar,
  Headphones,
  Landmark,
  Mic,
  Moon,
  Music2,
  PartyPopper,
  Piano,
  Sparkles,
  Star,
  Sun,
  TrendingUp,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SIZES, FONTS, TYPE, SHADOWS } from '../../constants/theme';

/**
 * Per-category artwork treatment.
 *
 * The reference tiles are artwork-backed. Arkify ships no cover art for
 * categories, so each tile gets a layered ambient composition instead — a
 * category-hued wash, a darker vignette and a light streak — plus its own
 * icon and accent colour. These are drawn, not faked: no invented imagery, no
 * network asset, nothing to load.
 */
type CategoryArt = {
  Icon: LucideIcon;
  /** Icon ink colour, matching the reference's per-category icon treatment. */
  ink: string;
  /** Three-stop diagonal wash: hue → deep tone → near-black. */
  wash: [string, string, string];
};

const CATEGORY_ART: Record<string, CategoryArt> = {
  // Saturated, photographic-weight colour: the reference's tiles are full-bleed
  // artwork, so the drawn substitutes have to carry real colour rather than a
  // hint of tint over black.
  Charts: {
    Icon: TrendingUp,
    ink: '#A78BFA',
    wash: ['rgba(44, 168, 152, 0.95)', 'rgba(92, 62, 200, 0.62)', 'rgba(8, 12, 16, 0.96)'],
  },
  'New Releases': {
    Icon: Star,
    ink: '#FFFFFF',
    wash: ['rgba(104, 66, 205, 0.92)', 'rgba(46, 32, 92, 0.78)', 'rgba(9, 9, 16, 0.96)'],
  },
  Moods: {
    Icon: Sun,
    ink: '#FFA63D',
    wash: ['rgba(214, 74, 124, 0.92)', 'rgba(152, 52, 64, 0.74)', 'rgba(12, 8, 12, 0.96)'],
  },
  Indian: {
    Icon: Landmark,
    ink: '#F5A9CE',
    wash: ['rgba(176, 62, 156, 0.92)', 'rgba(96, 32, 116, 0.78)', 'rgba(11, 8, 15, 0.96)'],
  },
  'Hip-Hop': {
    Icon: Headphones,
    ink: '#FF8A3D',
    wash: ['rgba(196, 74, 46, 0.92)', 'rgba(114, 42, 42, 0.76)', 'rgba(13, 9, 9, 0.96)'],
  },
  Pop: {
    Icon: Mic,
    ink: '#FFFFFF',
    wash: ['rgba(86, 86, 208, 0.92)', 'rgba(52, 42, 124, 0.76)', 'rgba(9, 10, 19, 0.96)'],
  },
  EDM: {
    Icon: AudioWaveform,
    ink: '#57E8D6',
    wash: ['rgba(42, 148, 196, 0.92)', 'rgba(26, 84, 124, 0.76)', 'rgba(7, 12, 17, 0.96)'],
  },
  Rock: {
    Icon: Guitar,
    ink: '#FF6B5A',
    wash: ['rgba(206, 68, 46, 0.92)', 'rgba(146, 58, 32, 0.74)', 'rgba(13, 8, 8, 0.96)'],
  },
  Jazz: {
    Icon: Piano,
    ink: '#7FB2FF',
    wash: ['rgba(52, 88, 188, 0.92)', 'rgba(34, 46, 104, 0.76)', 'rgba(8, 10, 18, 0.96)'],
  },
  Classical: {
    Icon: Music2,
    ink: '#E4D7A8',
    wash: ['rgba(146, 122, 70, 0.88)', 'rgba(78, 68, 44, 0.74)', 'rgba(10, 9, 8, 0.96)'],
  },
  'Lo-Fi': {
    Icon: Moon,
    ink: '#9B8CF0',
    wash: ['rgba(88, 62, 176, 0.90)', 'rgba(46, 34, 92, 0.74)', 'rgba(9, 8, 14, 0.96)'],
  },
  Workout: {
    Icon: Dumbbell,
    ink: '#5AD1A8',
    wash: ['rgba(36, 146, 108, 0.90)', 'rgba(22, 78, 66, 0.74)', 'rgba(7, 11, 10, 0.96)'],
  },
  Party: {
    Icon: PartyPopper,
    ink: '#FFC24D',
    wash: ['rgba(198, 100, 44, 0.90)', 'rgba(100, 54, 88, 0.76)', 'rgba(11, 9, 10, 0.96)'],
  },
  Relax: {
    Icon: Sparkles,
    ink: '#7FE3D4',
    wash: ['rgba(34, 128, 138, 0.90)', 'rgba(22, 68, 90, 0.74)', 'rgba(7, 10, 13, 0.96)'],
  },
};

const DEFAULT_ART: CategoryArt = {
  Icon: Music2,
  ink: COLORS.accent.primary,
  wash: ['rgba(40, 150, 146, 0.90)', 'rgba(24, 78, 82, 0.74)', 'rgba(7, 10, 11, 0.96)'],
};

// ---------------------------------------------------------------------------
// CategoryTile — Search's browse grid
// ---------------------------------------------------------------------------

type CategoryTileProps = {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Browse category tile, per the Search reference: a tall artwork-backed card
 * with the category icon above the label at the bottom-left.
 */
export const CategoryTile: React.FC<CategoryTileProps> = ({ label, onPress, style }) => {
  const art = CATEGORY_ART[label] ?? DEFAULT_ART;

  return (
    <TouchableOpacity
      style={[styles.categoryTile, style]}
      activeOpacity={0.8}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Browse ${label}`}
    >
      {/* Base wash */}
      <LinearGradient
        colors={art.wash}
        locations={[0, 0.55, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Depth: darken the lower half so the label always holds contrast. */}
      <LinearGradient
        colors={['rgba(12, 15, 15, 0.02)', 'rgba(12, 15, 15, 0.62)']}
        start={{ x: 0.5, y: 0.3 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Light streak — the reference's soft atmospheric highlight. */}
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.16)', 'rgba(255, 255, 255, 0)']}
        start={{ x: 0.1, y: 0.02 }}
        end={{ x: 0.8, y: 0.6 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.categoryTileIcon}>
        <art.Icon color={art.ink} size={SIZES.icon.lg} strokeWidth={2} />
      </View>
      <Text style={styles.categoryTileLabel} numberOfLines={2}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  categoryTile: {
    height: 108,
    borderRadius: SIZES.radius.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    padding: SIZES.md,
    justifyContent: 'space-between',
    overflow: 'hidden',
    ...SHADOWS.ambient,
  },
  categoryTileIcon: {
    height: SIZES.icon.lg,
    justifyContent: 'center',
  },
  categoryTileLabel: {
    fontFamily: FONTS.semibold,
    fontSize: TYPE.headline.fontSize,
    color: '#FFFFFF',
  },
});
