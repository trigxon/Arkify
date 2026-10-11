import { Track } from '../core/types';
import { readJson, writeJsonDebounced, STORAGE_KEYS } from '../core/storage';

/**
 * TasteProfile — Arkify's on-device listening model.
 *
 * Everything is computed locally from the listening history. Nothing leaves
 * the device. The profile answers four questions the rest of the AI layer
 * keeps asking:
 *
 *   1. Which artists does this person actually love right now?
 *      (recency-weighted, so last month matters more than last year)
 *   2. When do they listen, and to what? (hour-of-day affinity)
 *   3. What flavours do they gravitate to? (genre/flavour signals mined
 *      from search context, playlists and title keywords)
 *   4. Who have they never tried but probably would? (co-occurrence gaps)
 *
 * A listening event that never crossed the "real listen" threshold is an
 * implicit skip — skips subtract affinity, so the model learns "no" as well
 * as "yes".
 */

const PROFILE_KEY = 'ai-taste-profile';
const HALF_LIFE_DAYS = 21; // an artist's weight halves roughly every 3 weeks
const MAX_ARTISTS = 120;
const MAX_FLAVOURS = 60;

/** Artist normalisation: "Artist - Topic", "VEVO", "Official" all collapse. */
export function normalizeArtistName(name: string): string {
  return name
    .replace(/-\s*Topic$/i, '')
    .replace(/VEVO$/i, '')
    .replace(/Official$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export type Flavour =
  | 'lofi' | 'acoustic' | 'remix' | 'live' | 'instrumental' | 'slowed'
  | 'edm' | 'hiphop' | 'bollywood' | 'punjabi' | 'classical' | 'rock'
  | 'pop' | 'jazz' | 'romance' | 'sad' | 'energetic';

const FLAVOUR_PATTERNS: [Flavour, RegExp][] = [
  ['lofi', /\blo-?fi\b|lofi hip ?hop|chillhop/i],
  ['slowed', /\bslowed\b|\breverb\b|\bnightcore\b/i],
  ['remix', /\bremix\b|\bbootleg\b|\bflip\b/i],
  ['acoustic', /\bacoustic\b|\bunplugged\b|\bcover\b/i],
  ['live', /\blive\b|\bconcert\b|\bunreleased\b/i],
  ['instrumental', /\binstrumental\b|\bno lyrics\b|\bbeats to\b/i],
  ['edm', /\bedm\b|\bdubstep\b|\bhouse mix\b|\btrance\b|\bdrum and bass\b|\bdnb\b/i],
  ['hiphop', /\bhip ?hop\b|\brap\b|\bdrill\b|\btrap\b/i],
  ['bollywood', /\bbollywood\b|\bhindi song|\bbollywood hits/i],
  ['punjabi', /\bpunjabi\b|\bdesi hip ?hop\b/i],
  ['classical', /\bclassical\b|\bpiano sonata|\bmozart|\bchopin|\bbach\b/i],
  ['rock', /\brock\b|\bmetal\b|\bpunk\b/i],
  ['jazz', /\bjazz\b|\bblue note|\bsaxophone\b/i],
  ['pop', /\bpop hits\b|\btop 40\b|\bpop mix\b/i],
  ['romance', /\blove song|\bromantic\b|\bvalentine/i],
  ['sad', /\bsad\b|\bheartbreak\b|\bbroken\b|\bemo\b/i],
  ['energetic', /\bworkout\b|\bgym\b|\bmotivation\b|\bhype\b|\bbanger/i],
];

function flavourFor(text: string): Flavour | null {
  for (const [flavour, re] of FLAVOUR_PATTERNS) {
    if (re.test(text)) return flavour;
  }
  return null;
}

export type ArtistAffinity = {
  /** Weighted play count (decays with time). */
  weight: number;
  /** Raw listen count, never decays — used for "all-time" stats. */
  plays: number;
  /** Last listen, epoch ms — drives decay. */
  lastAt: number;
  /** Artists co-listened in the same sessions, with strength. */
  co: Record<string, number>;
};

export type TasteProfileData = {
  artists: Record<string, ArtistAffinity>;
  /** Flavour -> weight. */
  flavours: Record<string, number>;
  /** Hour (0-23) -> total listens. */
  hours: Record<string, number>;
  /** Skips keyed by artist name (capped — skip signals saturate). */
  skips: Record<string, number>;
  /** Total events folded in. */
  events: number;
  updatedAt: number;
};

export const EMPTY_PROFILE: TasteProfileData = {
  artists: {},
  flavours: {},
  hours: {},
  skips: {},
  events: 0,
  updatedAt: 0,
};

export class TasteProfile {
  private data: TasteProfileData = { ...EMPTY_PROFILE };
  /** Artists heard in the last ~40 minutes — the current "session". */
  private sessionArtists: { name: string; at: number }[] = [];
  private loaded = false;
  private loadPromise: Promise<void> | null = null;

  async load(): Promise<void> {
    if (this.loaded) return;
    if (!this.loadPromise) {
      this.loadPromise = readJson<TasteProfileData>(PROFILE_KEY, EMPTY_PROFILE).then((d) => {
        this.data = d && d.artists && d.flavours ? d : { ...EMPTY_PROFILE };
        this.loaded = true;
      });
    }
    await this.loadPromise;
  }

  /** Persist (debounced — a radio binge writes often). */
  private persist(): void {
    this.data.updatedAt = Date.now();
    writeJsonDebounced(PROFILE_KEY, this.data, 1500);
  }

  // ---- ingestion ---------------------------------------------------------

  /** A real listen (crossed the history threshold). */
  recordListen(track: Track, at: number = Date.now()): void {
    void this.load().then(() => {
      const name = normalizeArtistName(track.artist.name);
      if (name) {
        const artist = this.data.artists[name] ?? { weight: 0, plays: 0, lastAt: 0, co: {} };

        // Decay the stored weight to "now" before adding, so long gaps lose
        // ground and binges compound.
        artist.weight = this.decayed(artist.weight, artist.lastAt, at) + 1;
        artist.plays += 1;
        artist.lastAt = at;

        // Co-occurrence: this artist shares a session with everyone heard
        // in the last 40 minutes.
        for (const other of this.sessionArtists) {
          if (other.name === name) continue;
          if (at - other.at > 40 * 60_000) continue;
          artist.co[other.name] = Math.min(3, (artist.co[other.name] ?? 0) + 0.34);
        }
        this.sessionArtists = this.sessionArtists.filter((s) => at - s.at <= 40 * 60_000);
        this.sessionArtists.push({ name, at });

        this.data.artists[name] = artist;
        this.pruneArtists();
      }

      const hour = new Date(at).getHours();
      this.data.hours[hour] = (this.data.hours[hour] ?? 0) + 1;

      const flavour = flavourFor(`${track.title} ${track.album ?? ''}`);
      if (flavour) this.data.flavours[flavour] = (this.data.flavours[flavour] ?? 0) + 1;

      this.data.events += 1;
      this.persist();
    });
  }

  /** A tap-and-skip. Artist weight takes a small hit — the model learns "no". */
  recordSkip(track: Track, at: number = Date.now()): void {
    void this.load().then(() => {
      const name = normalizeArtistName(track.artist.name);
      if (!name) return;

      const artist = this.data.artists[name];
      if (artist) {
        artist.weight = Math.max(0, artist.weight - 0.4);
        artist.lastAt = at;
      }

      this.data.skips[name] = Math.min(12, (this.data.skips[name] ?? 0) + 1);
      this.persist();
    });
  }

  /** Flavour signal from search/browse context (what the user looks for). */
  recordFlavourSignal(text: string, strength = 0.5): void {
    void this.load().then(() => {
      const flavour = flavourFor(text);
      if (flavour) {
        this.data.flavours[flavour] = (this.data.flavours[flavour] ?? 0) + strength;
        this.persist();
      }
    });
  }

  private decayed(weight: number, lastAt: number, now: number): number {
    if (!lastAt || weight <= 0) return weight;
    const days = Math.max(0, (now - lastAt) / 86_400_000);
    return weight * Math.pow(0.5, days / HALF_LIFE_DAYS);
  }

  private pruneArtists(): void {
    const entries = Object.entries(this.data.artists);
    if (entries.length <= MAX_ARTISTS) return;

    entries.sort((a, b) => b[1].weight - a[1].weight);
    const kept = entries.slice(0, MAX_ARTISTS);
    this.data.artists = Object.fromEntries(kept);

    const f = Object.entries(this.data.flavours);
    if (f.length > MAX_FLAVOURS) {
      f.sort((a, b) => b[1] - a[1]);
      this.data.flavours = Object.fromEntries(f.slice(0, MAX_FLAVOURS));
    }
  }

  // ---- queries -----------------------------------------------------------

  /** affinity(artistName) — the recency-weighted score the recommender ranks by. */
  affinity(artistName: string, now: number = Date.now()): number {
    const artist = this.data.artists[normalizeArtistName(artistName)];
    if (!artist) return 0;
    return this.decayed(artist.weight, artist.lastAt, now);
  }

  /** All known artists sorted by affinity, strongest first. */
  topArtists(limit = 12, now: number = Date.now()): { name: string; weight: number }[] {
    return Object.entries(this.data.artists)
      .map(([name, a]) => ({ name, weight: this.decayed(a.weight, a.lastAt, now) }))
      .filter((a) => a.weight > 0)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, limit);
  }

  /** Top flavours sorted by weight. */
  topFlavours(limit = 5): { flavour: string; weight: number }[] {
    return Object.entries(this.data.flavours)
      .map(([flavour, weight]) => ({ flavour, weight }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, limit);
  }

  /**
   * Hour-of-day listening histogram, normalised to 0..1.
   * Used for mood detection ("late night" at 1am) and schedule-aware radios.
   */
  hourHistogram(): number[] {
    const out = new Array(24).fill(0) as number[];
    let max = 0;
    for (let h = 0; h < 24; h++) {
      out[h] = this.data.hours[h] ?? 0;
      if (out[h] > max) max = out[h];
    }
    if (max > 0) for (let h = 0; h < 24; h++) out[h] /= max;
    return out;
  }

  /** Skips recorded for an artist (saturating signal, 0..12). */
  skipCount(artistName: string): number {
    return this.data.skips[normalizeArtistName(artistName)] ?? 0;
  }

  /** True when the profile has enough signal to personalise. */
  get isColdStart(): boolean {
    return this.data.events < 5 || Object.keys(this.data.artists).length === 0;
  }

  /** Summary for the AI prompt layer + stats screens. */
  snapshot() {
    return {
      events: this.data.events,
      topArtists: this.topArtists(10),
      topFlavours: this.topFlavours(6),
      hours: this.hourHistogram(),
      distinctArtists: Object.keys(this.data.artists).length,
    };
  }

  /** Wipe (Settings → reset personalisation). */
  async reset(): Promise<void> {
    this.data = { ...EMPTY_PROFILE };
    this.sessionArtists = [];
    await writeJsonDebounced(PROFILE_KEY, this.data, 0);
  }
}

export const tasteProfile = new TasteProfile();
