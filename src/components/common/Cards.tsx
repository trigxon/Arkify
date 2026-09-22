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
 * The reference tiles are artwork-backed. Audia ships no cover art for
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
  Charts: {
    Icon: TrendingUp,
    ink: '#8C7BF5',
    wash: ['rgba(84, 60, 190, 0.55)', 'rgba(20, 120, 150, 0.28)', 'rgba(6, 8, 8, 0.92)'],
  },
  'New Releases': {
    Icon: Star,
    ink: '#FFFFFF',
    wash: ['rgba(72, 42, 124, 0.50)', 'rgba(30, 22, 52, 0.45)', 'rgba(6, 8, 8, 0.92)'],
  },
  Moods: {
    Icon: Sun,
    ink: '#FFA63D',
    wash: ['rgba(190, 60, 90, 0.48)', 'rgba(120, 40, 90, 0.34)', 'rgba(6, 8, 8, 0.92)'],
  },
  Indian: {
    Icon: Landmark,
    ink: '#F0A6C8',
    wash: ['rgba(150, 50, 120, 0.50)', 'rgba(80, 30, 90, 0.40)', 'rgba(6, 8, 8, 0.92)'],
  },
  'Hip-Hop': {
    Icon: Headphones,
    ink: '#FF8A3D',
    wash: ['rgba(200, 70, 50, 0.45)', 'rgba(120, 40, 40, 0.34)', 'rgba(6, 8, 8, 0.92)'],
  },
  Pop: {
    Icon: Mic,
    ink: '#FFFFFF',
    wash: ['rgba(60, 60, 140, 0.48)', 'rgba(40, 30, 90, 0.34)', 'rgba(6, 8, 8, 0.92)'],
  },
  EDM: {
    Icon: AudioWaveform,
    ink: '#3DD6C3',
    wash: ['rgba(40, 120, 160, 0.48)', 'rgba(20, 60, 90, 0.38)', 'rgba(6, 8, 8, 0.92)'],
  },
  Rock: {
    Icon: Guitar,
    ink: '#FF6B5A',
    wash: ['rgba(200, 60, 40, 0.50)', 'rgba(140, 50, 30, 0.30)', 'rgba(6, 8, 8, 0.92)'],
  },
  Jazz: {
    Icon: Piano,
    ink: '#7FB2FF',
    wash: ['rgba(40, 70, 150, 0.50)', 'rgba(30, 40, 90, 0.34)', 'rgba(6, 8, 8, 0.92)'],
  },
  Classical: {
    Icon: Music2,
    ink: '#E4D7A8',
    wash: ['rgba(120, 100, 60, 0.42)', 'rgba(70, 60, 40, 0.34)', 'rgba(6, 8, 8, 0.92)'],
  },
  'Lo-Fi': {
    Icon: Moon,
    ink: '#9B8CF0',
    wash: ['rgba(70, 50, 140, 0.45)', 'rgba(40, 30, 80, 0.34)', 'rgba(6, 8, 8, 0.92)'],
  },
  Workout: {
    Icon: Dumbbell,
    ink: '#5AD1A8',
    wash: ['rgba(30, 120, 90, 0.45)', 'rgba(20, 70, 60, 0.34)', 'rgba(6, 8, 8, 0.92)'],
  },
  Party: {
    Icon: PartyPopper,
    ink: '#FFC24D',
    wash: ['rgba(180, 90, 40, 0.45)', 'rgba(90, 50, 80, 0.36)', 'rgba(6, 8, 8, 0.92)'],
  },
  Relax: {
    Icon: Sparkles,
    ink: '#7FE3D4',
    wash: ['rgba(30, 110, 120, 0.44)', 'rgba(20, 60, 80, 0.34)', 'rgba(6, 8, 8, 0.92)'],
  },
};

const DEFAULT_ART: CategoryArt = {
  Icon: Music2,
  ink: COLORS.accent.primary,
  wash: ['rgba(61, 214, 195, 0.40)', 'rgba(30, 90, 90, 0.30)', 'rgba(6, 8, 8, 0.92)'],
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
        colors={['rgba(6, 8, 8, 0.05)', 'rgba(6, 8, 8, 0.72)']}
        start={{ x: 0.5, y: 0.25 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Light streak — the reference's soft atmospheric highlight. */}
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.10)', 'rgba(255, 255, 255, 0)']}
        start={{ x: 0.1, y: 0.05 }}
        end={{ x: 0.75, y: 0.55 }}
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
