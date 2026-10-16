import { GLASS } from './theme';

// ---------------------------------------------------------------------------
// Appearance tuning — turns the user's Display settings into real material
// changes. Pure math, no React, so both the context provider and any screen
// can share it.
// ---------------------------------------------------------------------------

export type MotionPref = 'system' | 'on' | 'off';
export type GlassIntensity = 'subtle' | 'standard' | 'intense';

/**
 * How each intensity rescales the Liquid Glass tokens.
 *
 *   subtle   → fills read calmer and more opaque, edges quieter
 *   standard → the authored design, untouched
 *   intense  → fills airier, speculars brighter, rims more luminous
 */
const TUNING: Record<
  Exclude<GlassIntensity, 'standard'>,
  { fill: number; highlight: number; border: number; tint: number; blur: number }
> = {
  subtle: { fill: 1.45, highlight: 0.7, border: 0.8, tint: 0.85, blur: 0.8 },
  intense: { fill: 0.72, highlight: 1.4, border: 1.3, tint: 1.3, blur: 1.25 },
};

/** Parse an `rgba(r, g, b, a)` string. Theme literals are the only input. */
function parseRgba(color: string): { r: number; g: number; b: number; a: number } | null {
  const m = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/.exec(color);
  if (!m) return null;
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: Number(m[4]) };
}

function scaleRgba(color: string, factor: number): string {
  const c = parseRgba(color);
  // Non-rgba inputs pass through untouched rather than silently vanishing.
  if (!c) return color;
  const a = Math.max(0, Math.min(1, c.a * factor));
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${Number(a.toFixed(3))})`;
}

export type TunedGlass = {
  fill: Record<keyof typeof GLASS.fill, string>;
  border: Record<keyof typeof GLASS.border, string>;
  highlight: Record<keyof typeof GLASS.highlight, string>;
  tint: Record<keyof typeof GLASS.tint, string>;
  blur: Record<keyof typeof GLASS.blur, number>;
};

const cache = new Map<GlassIntensity, TunedGlass>();

/**
 * The GLASS tokens rescaled for the chosen intensity. `standard` returns the
 * authored values by identity, so nothing re-renders or re-parses for it.
 */
export function tunedGlass(intensity: GlassIntensity): TunedGlass {
  if (intensity === 'standard') return GLASS as unknown as TunedGlass;

  const cached = cache.get(intensity);
  if (cached) return cached;

  const t = TUNING[intensity];
  const tuned: TunedGlass = {
    fill: {
      ultraThin: scaleRgba(GLASS.fill.ultraThin, t.fill),
      thin: scaleRgba(GLASS.fill.thin, t.fill),
      regular: scaleRgba(GLASS.fill.regular, t.fill),
      thick: scaleRgba(GLASS.fill.thick, t.fill),
    },
    border: {
      subtle: scaleRgba(GLASS.border.subtle, t.border),
      hairline: scaleRgba(GLASS.border.hairline, t.border),
      luminous: scaleRgba(GLASS.border.luminous, t.border),
      accent: scaleRgba(GLASS.border.accent, t.border),
    },
    highlight: {
      strong: scaleRgba(GLASS.highlight.strong, t.highlight),
      soft: scaleRgba(GLASS.highlight.soft, t.highlight),
      faint: scaleRgba(GLASS.highlight.faint, t.highlight),
    },
    tint: {
      accentSoft: scaleRgba(GLASS.tint.accentSoft, t.tint),
      accentGlow: scaleRgba(GLASS.tint.accentGlow, t.tint),
      dangerSoft: scaleRgba(GLASS.tint.dangerSoft, t.tint),
    },
    blur: {
      thin: Math.round(GLASS.blur.thin * t.blur),
      regular: Math.round(GLASS.blur.regular * t.blur),
      thick: Math.round(GLASS.blur.thick * t.blur),
    },
  };

  cache.set(intensity, tuned);
  return tuned;
}

// ---- system reduced-motion ------------------------------------------------

let systemMotionReduced = false;

if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  // Web: the media query is synchronous at load.
  try {
    systemMotionReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    /* very old engines */
  }
}

/** Starts listening for OS reduce-motion changes. Returns an unsubscribe. */
export function subscribeSystemMotion(fn: () => void): () => void {
  const unsubscribers: (() => void)[] = [];

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    try {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      const onChange = (e: MediaQueryListEvent) => {
        systemMotionReduced = e.matches;
        fn();
      };
      // Safari < 14 needs the legacy listener form.
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else mq.addListener(onChange);
      unsubscribers.push(() => {
        if (mq.removeEventListener) mq.removeEventListener('change', onChange);
        else mq.removeListener(onChange);
      });
    } catch {
      /* best effort */
    }
  }

  return () => unsubscribers.forEach((u) => u());
}

export function isSystemMotionReduced(): boolean {
  return systemMotionReduced;
}
