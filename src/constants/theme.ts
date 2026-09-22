/**
 * Audia design system.
 *
 * Dark-first, cinematic, quiet-chrome: deep blacks for the foundation, a
 * single restrained accent for interaction and playback state, and artwork as
 * the visual star. Every screen reads from here — nothing hard-codes colors,
 * sizes or type outside this file's scale.
 */

// ---------------------------------------------------------------------------
// Color system (semantic)
// ---------------------------------------------------------------------------

export const COLORS = {
  /** App background: deepest cinematic obsidian teal. */
  background: '#05080A',
  /** Flat cards, list backdrops, and containers. */
  surface: '#0B1316',
  /** Elevated cards, inputs, thumbnails, action rows. */
  surfaceElevated: '#0F1A1D',
  /** Floating bars over scrolling content (tab bar, mini player, sheets). */
  surfaceRaised: '#0C1619',
  /** Pressed state for surfaces. */
  surfacePressed: '#142226',
  /** Subtle surface card background for high contrast. */
  surfaceCard: '#0D171A',
  /** Legacy alias. */
  surfaceLight: '#0F1A1D',

  text: {
    primary: '#FFFFFF',
    secondary: '#94A3B8',
    muted: '#5A6C74',
    dark: '#041014',
  },

  /**
   * Audia signature electric cyan / turquoise accent.
   * High vibrance, glowing halo, dark text on filled surfaces.
   */
  accent: {
    primary: '#18E5D5',
    bright: '#00E5FF',
    pressed: '#14C5B7',
    glow: 'rgba(24, 229, 213, 0.28)',
    soft: 'rgba(24, 229, 213, 0.10)',
    ring: '#18E5D5',
    border: 'rgba(24, 229, 213, 0.35)',
    // Legacy aliases
    green: '#18E5D5',
    greenGlow: 'rgba(24, 229, 213, 0.28)',
    red: '#FF5252',
    redGlow: 'rgba(255, 82, 82, 0.20)',
  },

  /** Semantic status colors. */
  status: {
    success: '#10B981',
    warning: '#F59E0B',
    error: '#FF5252',
    errorGlow: 'rgba(255, 82, 82, 0.20)',
  },

  /** Borders, hairlines and atmospheric scrims. */
  hairline: 'rgba(24, 229, 213, 0.12)',
  hairlineMuted: 'rgba(255, 255, 255, 0.08)',
  divider: 'rgba(255, 255, 255, 0.06)',
  glassBorder: 'rgba(24, 229, 213, 0.22)',
  glass: 'rgba(15, 26, 29, 0.75)',
  scrim: 'rgba(0, 0, 0, 0.72)',

  player: {
    progressTrack: 'rgba(255, 255, 255, 0.12)',
    progressFill: '#18E5D5',
    progressFillLegacy: '#FFFFFF',
  },

  atmosphere: {
    soft: 'rgba(24, 229, 213, 0.06)',
    medium: 'rgba(24, 229, 213, 0.12)',
    glow: 'rgba(24, 229, 213, 0.20)',
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
