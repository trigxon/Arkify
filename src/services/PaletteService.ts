import { Platform } from 'react-native';
import jpegJs from 'jpeg-js';
import { readJson, writeJsonDebounced, STORAGE_KEYS } from '../core/storage';

// ---------------------------------------------------------------------------
// Artwork-reactive color engine.
//
// Extracts a restrained accent palette from the current track's album art and
// derives tinted glass tokens from it. Design rules (locked):
//   · The app's dark foundation NEVER brightens — artwork only tints accents,
//     washes and deep backgrounds, all kept well below contrast thresholds.
//   · The brand aqua stays authoritative when art is grayscale, unavailable,
//     or dynamic colors are disabled — the engine then yields `null` and every
//     consumer falls back to theme tokens.
//   · Extraction is capped at a tiny downsample (max ~36×36 samples), runs
//     once per track change (not per frame, never while scrolling), and is
//     cached in memory AND in persisted storage keyed by artwork URL.
//
// Platform backends:
//   · web: <img crossOrigin> → canvas getImageData. i.ytimg.com serves
//     `access-control-allow-origin: *`, so direct reads work; a same-origin
//     `/api/artwork` proxy is the fallback for hosts without CORS.
//   · native: fetch → jpeg-js (pure JS, no native module) → RGBA.
//     PNG/WebP artwork yields null → static tokens (honest degradation).
// ---------------------------------------------------------------------------

export type ArtworkPalette = {
  /** Artwork URL this palette was extracted from. */
  key: string;
  /** Main interaction accent (progress, rings, active states). */
  accent: string;
  /** Brighter variant for glyphs sitting directly on the accent. */
  accentBright: string;
  /** ~13% alpha wash for selected surfaces. */
  accentSoft: string;
  /** ~45% alpha halo for glows. */
  accentGlow: string;
  /** ~34% alpha hairline for accent-tinted borders. */
  accentBorder: string;
  /** ~16% alpha ambient wash layered behind glass. */
  ambient: string;
  /** Deep tinted backdrop (luminance locked ≤ 12%) for immersive surfaces. */
  deep: string;
  /** Secondary hue from the art — used for duotone washes. */
  ambientAlt: string;
};

type Hsl = { h: number; s: number; l: number };

const MAX_CACHE = 60;
const memoryCache = new Map<string, ArtworkPalette | null>();

// Extraction only helps when it can finish; short-circuit slow networks.
const FETCH_TIMEOUT_MS = 6000;

// ---------------------------------------------------------------------------
// Color math
// ---------------------------------------------------------------------------

function rgbToHsl(r: number, g: number, b: number): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h, s, l };
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function hslToHex(h: number, s: number, l: number): string {
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, h) * 255);
  const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function rgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Hue-bucketed dominant-color pick.
 * Weight = saturation × central luminance, so near-black letterboxing and
 * washed-out whites never dominate, and vivid art reads instantly.
 */
function buildPalette(key: string, pixels: Uint8Array | Uint8ClampedArray, size: number): ArtworkPalette | null {
  const BUCKETS = 12;
  const weight = new Float64Array(BUCKETS);
  const sumH = new Float64Array(BUCKETS);
  const sumS = new Float64Array(BUCKETS);
  const total = { w: 0, h: 0, s: 0 };

  for (let i = 0; i < size * size; i++) {
    const r = pixels[i * 4];
    const g = pixels[i * 4 + 1];
    const b = pixels[i * 4 + 2];
    const { h, s, l } = rgbToHsl(r, g, b);
    // Reject letterbox black, blown whites and lifeless grays.
    if (l < 0.1 || l > 0.94 || s < 0.12) continue;
    const w = s * (1 - Math.abs(l - 0.5) * 1.35);
    if (w <= 0) continue;
    const bucket = Math.min(BUCKETS - 1, Math.floor(h * BUCKETS));
    weight[bucket] += w;
    sumH[bucket] += h;
    sumS[bucket] += s;
    total.w += w;
    total.h += h;
    total.s += s;
  }

  // Grayscale / nearly-monochrome art: the aqua identity stays in charge.
  if (total.w < size * size * 0.045) return null;

  let main = 0;
  for (let i = 1; i < BUCKETS; i++) if (weight[i] > weight[main]) main = i;

  // Secondary hue sits far from the main one so duotone washes have depth.
  let alt = -1;
  let altW = 0;
  for (let i = 0; i < BUCKETS; i++) {
    if (weight[i] <= 0) continue;
    const dist = Math.min(Math.abs(i - main), BUCKETS - Math.abs(i - main));
    if (dist >= 3 && weight[i] > altW) {
      altW = weight[i];
      alt = i;
    }
  }

  const h1 = main * (1 / BUCKETS) + 1 / (BUCKETS * 2);
  const s1 = clamp01((sumH[main] > 0 ? sumS[main] / weight[main] : total.s / total.w) * 1.08);
  const accent = hslToHex(h1, clamp01(Math.max(s1, 0.55)), 0.62);

  let ambientAlt = rgba(accent, 0.1);
  if (alt >= 0) {
    const h2 = alt * (1 / BUCKETS) + 1 / (BUCKETS * 2);
    const s2 = sumS[alt] / weight[alt];
    ambientAlt = rgba(hslToHex(h2, clamp01(s2 * 0.8), 0.42), 0.12);
  }

  const deep = hslToHex(h1, clamp01(s1 * 0.55), 0.1);

  return {
    key,
    accent,
    accentBright: hslToHex(h1, clamp01(Math.max(s1, 0.55)), 0.74),
    accentSoft: rgba(accent, 0.13),
    accentGlow: rgba(accent, 0.45),
    accentBorder: rgba(accent, 0.34),
    ambient: rgba(accent, 0.16),
    deep,
    ambientAlt,
  };
}

/** Sample a uniform grid of `target²` points from a raw RGBA buffer. */
function downsample(src: Uint8Array | Uint8ClampedArray, w: number, h: number, target = 36): { pixels: Uint8Array; size: number } {
  const out = new Uint8Array(target * target * 4);
  let o = 0;
  for (let gy = 0; gy < target; gy++) {
    // Sample cell centres, not corners — avoids edge letterbox bias.
    const y = Math.min(h - 1, Math.floor(((gy + 0.5) / target) * h));
    for (let gx = 0; gx < target; gx++) {
      const x = Math.min(w - 1, Math.floor(((gx + 0.5) / target) * w));
      const si = (y * w + x) * 4;
      out[o++] = src[si];
      out[o++] = src[si + 1];
      out[o++] = src[si + 2];
      out[o++] = 255;
    }
  }
  return { pixels: out, size: target };
}

// ---------------------------------------------------------------------------
// Platform backends
// ---------------------------------------------------------------------------

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('palette timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

/** Draw an <img> into a tiny canvas and read the pixels back. */
function pixelsFromImageElement(img: HTMLImageElement): { pixels: Uint8ClampedArray; size: number } | null {
  const SIZE = 36;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, SIZE, SIZE);
  const data = ctx.getImageData(0, 0, SIZE, SIZE);
  return { pixels: data.data, size: SIZE };
}

function loadImage(url: string, anonymous: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (anonymous) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = url;
  });
}

async function extractWeb(url: string): Promise<{ pixels: Uint8ClampedArray; size: number } | null> {
  // 1) Direct read — works for i.ytimg.com (ACAO *).
  try {
    const img = await withTimeout(loadImage(url, true), FETCH_TIMEOUT_MS);
    const res = pixelsFromImageElement(img);
    if (res) return res;
  } catch {
    /* fall through to the proxy */
  }
  // 2) Same-origin proxy — for hosts without CORS. Tainted canvases throw on
  //    read, which lands here too.
  try {
    const proxied = `/api/artwork?url=${encodeURIComponent(url)}`;
    const img = await withTimeout(loadImage(proxied, false), FETCH_TIMEOUT_MS);
    return pixelsFromImageElement(img);
  } catch {
    return null;
  }
}

async function extractNative(url: string): Promise<{ pixels: Uint8Array; size: number } | null> {
  try {
    const res = await withTimeout(fetch(url), FETCH_TIMEOUT_MS);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    // Pure-JS JPEG decode of a thumbnail is single-digit-to-low-double-digit
    // milliseconds and happens once per track, not per frame.
    const decoded = jpegJs.decode(new Uint8Array(buf), { useTArray: true, tolerantDecoding: true });
    if (!decoded || !decoded.data) return null;
    return downsample(decoded.data, decoded.width, decoded.height);
  } catch {
    // PNG/WebP artwork or a decode failure: honest null → static tokens.
    return null;
  }
}

// ---------------------------------------------------------------------------
// Persistent cache (best-effort, bounded)
// ---------------------------------------------------------------------------

type PaletteStore = Record<string, ArtworkPalette>;
let storePromise: Promise<PaletteStore> | null = null;

function loadStore(): Promise<PaletteStore> {
  if (!storePromise) {
    storePromise = readJson<PaletteStore>(STORAGE_KEYS.palettes, {}).catch(() => ({}));
  }
  return storePromise;
}

function persist(key: string, palette: ArtworkPalette | null): void {
  void loadStore().then((store) => {
    if (palette === null) return; // failures are not worth persisting
    store[key] = palette;
    const keys = Object.keys(store);
    if (keys.length > MAX_CACHE) {
      for (const k of keys.slice(0, keys.length - MAX_CACHE)) delete store[k];
    }
    writeJsonDebounced(STORAGE_KEYS.palettes, store, 1200);
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract (or recall) the palette for an artwork URL.
 * Resolves `null` when dynamic color is not possible — never throws.
 */
export async function extractArtworkPalette(url: string): Promise<ArtworkPalette | null> {
  if (!url || typeof url !== 'string') return null;

  if (memoryCache.has(url)) return memoryCache.get(url) ?? null;

  const store = await loadStore().catch(() => ({} as PaletteStore));
  const cached = store[url];
  if (cached && cached.accent) {
    memoryCache.set(url, cached);
    return cached;
  }

  const raw =
    Platform.OS === 'web'
      ? await extractWeb(url)
      : await extractNative(url);

  const palette = raw ? buildPalette(url, raw.pixels, raw.size) : null;

  // Bounded LRU-ish memory cache.
  if (memoryCache.size > MAX_CACHE) {
    const oldest = memoryCache.keys().next().value;
    if (oldest !== undefined) memoryCache.delete(oldest);
  }
  memoryCache.set(url, palette);
  persist(url, palette);

  return palette;
}
