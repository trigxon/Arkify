/**
 * Arkify design system — "Abyss Aqua".
 *
 * Tokens are locked to the reference mockups: near-black teal-flooded
 * surfaces (#030A0B canvas, #061113–#0A1719 cards), one luminous aqua
 * (#3BF0DF) reserved for interaction and playback state, deep-teal fills
 * (#118D8E) for selected chips, and hairline aqua glass borders everywhere.
 * Every screen reads from here — nothing hard-codes colors outside this file.
 */

// ---------------------------------------------------------------------------
// Color system (semantic)
// ---------------------------------------------------------------------------

export const COLORS = {
  /** Global canvas background. */
  background: '#030A0B',
  /** Primary viewports, header backings, dock surfaces. */
  surface: '#061113',
  /** Interactive cards, tiles, bottom sheets, search inputs. */
  surfaceElevated: '#0A1719',
  /** Floating bars over scrolling content (tab bar, mini player, sheets). */
  surfaceRaised: '#071315',
  /** Pressed state for surfaces. */
  surfacePressed: '#0D1F21',
  /** Hover/resting variant between surface and elevated. */
  surfaceCard: '#081417',
  /** Legacy alias. */
  surfaceLight: '#0A1719',

  text: {
    primary: '#FFFFFF',
    /** Artist names, greetings, inactive tab labels. */
    secondary: '#7F9495',
    /** Chip/label tone: brighter than secondary, softer than pure white. */
    soft: '#AEC0BF',
    /** Secondary timestamps, disabled glyphs, subtle metadata. */
    muted: '#4A5C5D',
    /** Ink used on filled aqua surfaces. */
    dark: '#030A0B',
  },

  /**
   * Abyss Aqua — applied with strict intentionality: active states,
   * interactive controls, playback state, scrubbers, halos.
   */
  accent: {
    primary: '#3BF0DF',
    bright: '#53FFF0',
    pressed: '#2BD9C8',
    glow: 'rgba(59, 240, 223, 0.50)',
    soft: 'rgba(59, 240, 223, 0.13)',
    ring: '#3BF0DF',
    border: 'rgba(59, 240, 223, 0.30)',
    /** Deep teal fill behind selected chips and hero tiles. */
    deep: '#118D8E',
    // Legacy aliases
    green: '#3BF0DF',
    greenGlow: 'rgba(59, 240, 223, 0.50)',
    red: '#EF4444',
    redGlow: 'rgba(239, 68, 68, 0.20)',
  },

  /**
   * Warm ember — the streak/flame identity used across Home, You and Stats.
   * One hue, one place, so the flame never drifts between screens.
   */
  warm: {
    primary: '#FF8A3D',
    soft: 'rgba(255, 138, 61, 0.30)',
    glow: 'rgba(255, 138, 61, 0.35)',
  },

  /** Semantic status colors. */
  status: {
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    errorGlow: 'rgba(239, 68, 68, 0.20)',
  },

  /** Borders, hairlines and atmospheric scrims — aqua-tinted glass. */
  hairline: 'rgba(59, 240, 223, 0.09)',
  hairlineMuted: 'rgba(59, 240, 223, 0.14)',
  divider: 'rgba(59, 240, 223, 0.09)',
  glassBorder: 'rgba(59, 240, 223, 0.28)',
  glass: 'rgba(7, 19, 21, 0.82)',
  scrim: 'rgba(0, 0, 0, 0.62)',

  player: {
    progressTrack: 'rgba(255, 255, 255, 0.10)',
    progressFill: '#3BF0DF',
    progressFillLegacy: '#FFFFFF',
  },

  atmosphere: {
    soft: 'rgba(59, 240, 223, 0.10)',
    medium: 'rgba(59, 240, 223, 0.20)',
    glow: 'rgba(59, 240, 223, 0.36)',
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

// ---------------------------------------------------------------------------
// LIQUID GLASS — translucent material system (iOS-style depth)
//
// Surfaces are layered, not flat: a translucent fill sits over a tinted
// scrim, carries a hairline border that is brighter along the top edge
// (the specular highlight), and casts a soft ambient glow. The helpers in
// components/common/Glass.tsx assemble these tokens into real materials.
// ---------------------------------------------------------------------------

export const GLASS = {
  /** Translucent teal-flooded fills, darkest → lightest. Kept airy — glass
   *  has to let the atmosphere behind it breathe. AA contrast holds because
   *  the canvas beneath is near-black. */
  fill: {
    ultraThin: 'rgba(10, 23, 25, 0.36)',
    thin: 'rgba(8, 20, 22, 0.52)',
    regular: 'rgba(7, 17, 19, 0.68)',
    thick: 'rgba(5, 13, 15, 0.86)',
  },
  /** Edge treatment. Aqua light reads along every edge — light from above. */
  border: {
    subtle: 'rgba(59, 240, 223, 0.12)',
    hairline: 'rgba(59, 240, 223, 0.18)',
    luminous: 'rgba(59, 240, 223, 0.34)',
    accent: 'rgba(59, 240, 223, 0.48)',
  },
  /** The specular streak drawn along the top edge of a glass panel. */
  highlight: {
    strong: 'rgba(210, 255, 250, 0.30)',
    soft: 'rgba(210, 255, 250, 0.15)',
    faint: 'rgba(210, 255, 250, 0.06)',
  },
  /** Inner ambient tints used by glowing variants. */
  tint: {
    accentSoft: 'rgba(59, 240, 223, 0.14)',
    accentGlow: 'rgba(59, 240, 223, 0.26)',
    dangerSoft: 'rgba(239, 68, 68, 0.12)',
  },
  /** Blur radii per material weight (used where BlurView is available). */
  blur: {
    thin: 24,
    regular: 40,
    thick: 64,
  },
  radius: {
    card: 20,
    sheet: 28,
    tile: 16,
  },
} as const;

/**
 * The glass MATERIAL FAMILY. One visual language, ten tuned recipes — a
 * floating nav slab must not share blur/opacity/highlights with a context
 * menu or a background wash. Each entry names its GlassView weight, border
 * luminance and blur weight; `glassMaterial()` resolves them against the
 * user's glass-intensity setting at render time.
 *
 *   background — barely-there wash under ambient content
 *   card       — floating card glass (rows, tiles)
 *   control    — compact control glass (segmented bars, chips)
 *   button     — interactive button glass (luminous rim on press)
 *   nav        — floating navigation slab
 *   mini       — mini-player slab
 *   player     — expanded Now Playing surfaces
 *   sheet      — bottom sheets (queue, actions, filters)
 *   menu       — context menus / popovers (opacity-forward for text contrast)
 *   modal      — dialogs and full modals
 */
export const GLASS_MATERIALS = {
  background: { weight: 'ultraThin', border: 'subtle', blur: 'thin' },
  card: { weight: 'thin', border: 'hairline', blur: 'regular' },
  control: { weight: 'regular', border: 'hairline', blur: 'regular' },
  button: { weight: 'regular', border: 'luminous', blur: 'thin' },
  nav: { weight: 'regular', border: 'luminous', blur: 'regular' },
  mini: { weight: 'regular', border: 'luminous', blur: 'regular' },
  player: { weight: 'thick', border: 'hairline', blur: 'thick' },
  sheet: { weight: 'thick', border: 'hairline', blur: 'thick' },
  menu: { weight: 'thick', border: 'luminous', blur: 'thick' },
  modal: { weight: 'thick', border: 'luminous', blur: 'thick' },
} as const;

export type GlassMaterialId = keyof typeof GLASS_MATERIALS;

/**
 * Brand gradient pairs. Two-stop diagonal washes used on hero cards,
 * AI surfaces and share cards. Pairs keep the Abyss aqua identity
 * while letting each feature own a hue.
 */
export const GRADIENTS = {
  brand: ['#3BF0DF', '#3AA8F0'] as const,
  aurora: ['#53FFF0', '#9B8CF0'] as const,
  sunset: ['#FF8A5C', '#FF4E8E'] as const,
  midnight: ['#4C5BD4', '#7B4CD4'] as const,
  gold: ['#FFC24D', '#FF8A3D'] as const,
  mint: ['#118D8E', '#3BF0DF'] as const,
  rose: ['#FF6B9E', '#C155D9'] as const,
} as const;

/**
 * Spring presets (react-native-reanimated `withSpring` configs).
 * Materials feel liquid when motion is perceptibly under- or over-damped.
 */
export const SPRINGS = {
  /** Buttons, chips — quick press-in. */
  press: { damping: 18, stiffness: 380, mass: 0.7 },
  /** Release bounce. */
  release: { damping: 14, stiffness: 300, mass: 0.8 },
  /** Section entrances, gentle slides. */
  gentle: { damping: 22, stiffness: 200, mass: 0.9 },
  /** Big choreography: sheet morphs, artwork transitions. */
  lively: { damping: 16, stiffness: 260, mass: 1 },
  /** Karaoke line snap. */
  snap: { damping: 20, stiffness: 320, mass: 0.6 },
  /** Shared-element flight: mini-player artwork ↔ Now Playing hero.
   *  Settles in roughly 350 ms — inside the large-transition band. */
  flight: { damping: 26, stiffness: 320, mass: 0.85 },
} as const;

/**
 * Convert a gesture velocity (px/ms, as reported by PanResponder/pointer
 * events) into a `withSpring` velocity (px/s), clamped so one violent flick
 * can never destabilise the physics.
 */
export function springVelocity(velocityPxPerMs: number, max = 1600): number {
  const v = velocityPxPerMs * 350;
  return Math.max(-max, Math.min(max, v));
}

/**
 * Stagger-in presets for list/section entrances (duration ms + translate).
 * Applied by <FadeInUp> wrappers in the Glass kit.
 */
export const ENTRANCE = {
  fast: { duration: 260, translateY: 14 },
  base: { duration: 340, translateY: 20 },
  slow: { duration: 460, translateY: 26 },
} as const;

/**
 * Mood identities — one gradient, one glow hue and one surface tint each.
 * Shared by Mood Radios, the AI engine's mood detection and Wrapped.
 */
export type MoodId =
  | 'workout'
  | 'focus'
  | 'chill'
  | 'latenight'
  | 'party'
  | 'emotional'
  | 'commute'
  | 'romance';

export const MOOD_PALETTE: Record<MoodId, { gradient: readonly [string, string]; glow: string; tint: string }> = {
  workout: { gradient: ['#FF6B5A', '#FF8A3D'], glow: 'rgba(255, 107, 90, 0.35)', tint: 'rgba(255, 107, 90, 0.12)' },
  focus: { gradient: ['#4C5BD4', '#38BDF8'], glow: 'rgba(76, 91, 212, 0.35)', tint: 'rgba(76, 91, 212, 0.12)' },
  chill: { gradient: ['#3BF0DF', '#5AD1A8'], glow: 'rgba(59, 240, 223, 0.30)', tint: 'rgba(59, 240, 223, 0.10)' },
  latenight: { gradient: ['#9B8CF0', '#5B8DEF'], glow: 'rgba(155, 140, 240, 0.35)', tint: 'rgba(155, 140, 240, 0.12)' },
  party: { gradient: ['#FF4E8E', '#FFC24D'], glow: 'rgba(255, 78, 142, 0.35)', tint: 'rgba(255, 78, 142, 0.12)' },
  emotional: { gradient: ['#7FB2FF', '#C155D9'], glow: 'rgba(127, 178, 255, 0.30)', tint: 'rgba(127, 178, 255, 0.10)' },
  commute: { gradient: ['#53FFF0', '#4C5BD4'], glow: 'rgba(59, 240, 223, 0.30)', tint: 'rgba(59, 240, 223, 0.10)' },
  romance: { gradient: ['#FF6B9E', '#FF8A5C'], glow: 'rgba(255, 107, 158, 0.30)', tint: 'rgba(255, 107, 158, 0.10)' },
};
