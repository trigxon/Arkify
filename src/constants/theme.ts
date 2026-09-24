/**
 * Arkify design system — "Nocturne Cyan".
 *
 * Tokens are locked to the product spec: near-black cinematic surfaces
 * (#0C0F0F / #121414 / #161A1A), one restrained cyan (#35D6C6) reserved for
 * interaction and playback state, and a three-step neutral text scale.
 * Every screen reads from here — nothing hard-codes colors outside this file.
 */

// ---------------------------------------------------------------------------
// Color system (semantic)
// ---------------------------------------------------------------------------

export const COLORS = {
  /** Global canvas background. */
  background: '#0C0F0F',
  /** Primary viewports, header backings, dock surfaces. */
  surface: '#121414',
  /** Interactive cards, tiles, bottom sheets, search inputs. */
  surfaceElevated: '#161A1A',
  /** Floating bars over scrolling content (tab bar, mini player, sheets). */
  surfaceRaised: '#121414',
  /** Pressed state for surfaces. */
  surfacePressed: '#1A1C1C',
  /** Hover/resting variant between surface and elevated. */
  surfaceCard: '#121414',
  /** Legacy alias. */
  surfaceLight: '#161A1A',

  text: {
    primary: '#FFFFFF',
    /** Artist names, greetings, inactive tab labels. */
    secondary: '#8E9E9D',
    /** Chip/label tone: brighter than secondary, softer than pure white. */
    soft: '#B8C4C3',
    /** Secondary timestamps, disabled glyphs, subtle metadata. */
    muted: '#546362',
    /** Ink used on filled cyan surfaces. */
    dark: '#0C0F0F',
  },

  /**
   * Nocturne Cyan — applied with strict intentionality: active states,
   * interactive controls, playback state, scrubbers, halos.
   */
  accent: {
    primary: '#35D6C6',
    bright: '#35D6C6',
    pressed: '#2BC4B4',
    glow: 'rgba(53, 214, 198, 0.45)',
    soft: 'rgba(53, 214, 198, 0.12)',
    ring: '#35D6C6',
    border: 'rgba(53, 214, 198, 0.22)',
    // Legacy aliases
    green: '#35D6C6',
    greenGlow: 'rgba(53, 214, 198, 0.45)',
    red: '#EF4444',
    redGlow: 'rgba(239, 68, 68, 0.20)',
  },

  /** Semantic status colors. */
  status: {
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    errorGlow: 'rgba(239, 68, 68, 0.20)',
  },

  /** Borders, hairlines and atmospheric scrims. */
  hairline: 'rgba(255, 255, 255, 0.05)',
  hairlineMuted: 'rgba(255, 255, 255, 0.08)',
  divider: 'rgba(255, 255, 255, 0.05)',
  glassBorder: 'rgba(53, 214, 198, 0.22)',
  glass: 'rgba(18, 20, 20, 0.85)',
  scrim: 'rgba(0, 0, 0, 0.60)',

  player: {
    progressTrack: 'rgba(255, 255, 255, 0.10)',
    progressFill: '#35D6C6',
    progressFillLegacy: '#FFFFFF',
  },

  atmosphere: {
    soft: 'rgba(53, 214, 198, 0.06)',
    medium: 'rgba(53, 214, 198, 0.12)',
    glow: 'rgba(53, 214, 198, 0.22)',
  },
} as const;

// ---------------------------------------------------------------------------
// Typography — hierarchy through scale and weight, never size alone
// ---------------------------------------------------------------------------

export const TYPE = {
  display: { fontSize: 48, letterSpacing: 12, lineHeight: 58 },
  title1: { fontSize: 28, lineHeight: 34 },
  title2: { fontSize: 22, lineHeight: 28 },
  title3: { fontSize: 18, lineHeight: 24 },
  headline: { fontSize: 16, lineHeight: 22 },
  body: { fontSize: 15, lineHeight: 21 },
  callout: { fontSize: 14, lineHeight: 19 },
  subheadline: { fontSize: 13, lineHeight: 18 },
  footnote: { fontSize: 12, lineHeight: 16 },
  micro: { fontSize: 10, lineHeight: 14 },
  /** Uppercase kicker/eyebrow treatment. */
  overline: { fontSize: 10, lineHeight: 14, letterSpacing: 2.5 },
} as const;

export const FONTS = {
  regular: 'System',
  medium: 'System',
  semibold: 'System',
  bold: 'System',
} as const;

// ---------------------------------------------------------------------------
// Spacing — 4pt grid
// ---------------------------------------------------------------------------

export const SIZES = {
  /**
   * Clearance a scrolling screen must leave at the bottom so the last row is
   * never trapped under the tab bar + mini player.
   */
  bottomInset: 150,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
  /** Standard screen edge margin. */
  gutter: 20,
  radius: {
    sm: 10,
    md: 16,
    lg: 24,
    xl: 28,
    pill: 999,
  },
  /** Icon sizes — one consistent icon language. */
  icon: {
    xs: 14,
    sm: 18,
    md: 22,
    lg: 26,
    xl: 32,
    play: 34,
  },
  /** Minimum comfortable touch target. */
  touchTarget: 44,
} as const;

// ---------------------------------------------------------------------------
// Elevation — restrained, only for things that truly float
// ---------------------------------------------------------------------------

export const SHADOWS = {
  /** Floating bars: mini player. */
  glass: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 12,
  },
  /** Cards. */
  ambient: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  /** Hero artwork on Now Playing. */
  artwork: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.6,
    shadowRadius: 40,
    elevation: 16,
  },
} as const;

// ---------------------------------------------------------------------------
// Motion — short, natural, interruptible
// ---------------------------------------------------------------------------

export const MOTION = {
  /** Fast feedback: presses, small fades. */
  fast: 140,
  /** Standard transitions: section fades, artwork crossfades. */
  base: 220,
  /** Larger choreography: player expansion feel, sheet entrances. */
  slow: 320,
  easing: 'native' as const,
} as const;
