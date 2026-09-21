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
  /** App background: deepest layer. */
  background: '#060808',
  /** Flat cards and list backdrops. */
  surface: '#0B0E0E',
  /** One step up: inputs, thumbnails, icon chips. */
  surfaceElevated: '#121717',
  /**
   * Opaque lift for floating bars over scrolling content (tab bar, mini
   * player). Deliberately not translucent: blur is unreliable on Android, so
   * content would otherwise read straight through.
   */
  surfaceRaised: '#141919',
  /** Pressed state for any surface. */
  surfacePressed: '#1C2222',
  /** Legacy alias for surfaceElevated — migrated screens no longer use it. */
  surfaceLight: '#121717',

  text: {
    primary: '#F4F4F2',
    secondary: '#A2A8A6',
    muted: '#6B7170',
  },

  /**
   * Audia accent — cool aurora teal. Interaction, playback state, selection.
   * Used sparingly: if everything is accent, nothing is.
   */
  accent: {
    primary: '#3DD6C3',
    pressed: '#2FB5A5',
    glow: 'rgba(61, 214, 195, 0.14)',
    soft: 'rgba(61, 214, 195, 0.10)',
    // Legacy aliases kept so earlier screens keep compiling while the
    // migration to the semantic names lands.
    green: '#3DD6C3',
    greenGlow: 'rgba(61, 214, 195, 0.14)',
    red: '#FF5A5A',
    redGlow: 'rgba(255, 90, 90, 0.15)',
  },

  /** Semantic status colors, used only for status — never decoration. */
  status: {
    success: '#4ADE80',
    warning: '#FBBF24',
    error: '#FF5A5A',
    errorGlow: 'rgba(255, 90, 90, 0.15)',
  },

  /** Hairlines and dividers. */
  hairline: 'rgba(255, 255, 255, 0.08)',
  divider: 'rgba(255, 255, 255, 0.07)',
  glassBorder: 'rgba(255, 255, 255, 0.10)',
  /** Extremely subtle glass fill (blur-backed cards). */
  glass: 'rgba(255, 255, 255, 0.05)',
  /** Scrim behind modals/sheets. */
  scrim: 'rgba(0, 0, 0, 0.65)',

  player: {
    progressTrack: 'rgba(255, 255, 255, 0.14)',
    progressFill: '#3DD6C3',
    progressFillLegacy: '#FFFFFF',
  },

  /** Ambient card washes — very low-alpha teal atmosphere for hero areas. */
  atmosphere: {
    soft: 'rgba(61, 214, 195, 0.06)',
    medium: 'rgba(61, 214, 195, 0.10)',
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
