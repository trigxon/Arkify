import { Track } from '../core/types';
import { MusicService } from '../services/MusicService';
import { LibraryService } from '../services/LibraryService';
import { tasteProfile } from './TasteProfile';
import { MoodDef, moodById, moodForHour } from './moods';
import { MoodId } from '../constants/theme';
import { AIPlaylistPlan, geminiPlaylistPlan, onDevicePlan } from './gemini';

/**
 * RecommendationEngine — Arkify's on-device recommender.
 *
 * Design goals, in order:
 *   1. Never embarrass itself. Every track returned must match the ask.
 *   2. Feel personal. Taste pulls candidate scoring, always.
 *   3. Keep moving. Zero-latency path: everything here degrades gracefully
 *      to a plain search when the profile is cold.
 *   4. Stay private. All signals are on-device; Gemini only ever receives
 *      an anonymous taste summary when the user opts in with their own key.
 *
 * The pipeline for any radio/mix:
 *   seeds → parallel searches → pool → keyword/flavour filter →
 *   taste scoring → dedupe → shuffle-arrange → result
 */

const SEARCH_LIMIT = 25;

/** Deterministic-enough shuffle that still varies run to run. */
function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export type ScoredTrack = { track: Track; score: number };

export class RecommendationEngine {
  // ---- scoring -----------------------------------------------------------

  /**
   * Score one candidate against the ask. Returns -1 when the track must be
   * excluded outright. Components:
   *
   *   moodMatch   — keyword + duration fit for the requested mood
   *   taste       — listener's affinity for the artist (log-scaled)
   *   affinityPull— how hard taste should matter for this radio
   *   skipPenalty — artists the listener keeps skipping
   *   freshness   — small bonus so the same pool doesn't repeat verbatim
   */
  scoreTrack(track: Track, mood?: MoodDef, affinityPull = 0.4): number {
    const hay = `${track.title} ${track.artist.name} ${track.album ?? ''}`.toLowerCase();

    if (mood?.exclude) {
      for (const bad of mood.exclude) if (hay.includes(bad)) return -1;
    }

    let score = 1;

    // Mood keyword match.
    if (mood) {
      let hits = 0;
      for (const kw of mood.keywords) if (hay.includes(kw)) hits++;
      score += hits * 0.65;

      if (mood.duration && track.duration > 0) {
        if (track.duration < mood.duration.min) score -= 0.5;
        if (track.duration > mood.duration.max) score -= 0.35;
      }
    }

    // Taste pull: log scale so a handful of plays on a new artist can still
    // compete with a heavy favourite.
    const affinity = tasteProfile.affinity(track.artist.name);
    score += Math.log1p(affinity) * 2.2 * affinityPull;

    // Skips bite — an artist the listener keeps skipping loses rank.
    score -= Math.min(1.6, tasteProfile.skipCount(track.artist.name) * 0.22);

    // Flavour alignment: if the listener loves lofi, lofi candidates rise.
    const favs = new Set(tasteProfile.topFlavours(6).map((f) => f.flavour));
    for (const [flavour, re] of FLAVOUR_RES) {
      if (favs.has(flavour) && re.test(hay)) score += 0.4;
    }

    // Long videos are rarely what a radio wants.
    if (track.duration > 15 * 60) score -= 1.2;

    return score;
  }

  // ---- radio generation --------------------------------------------------

  /**
   * Build a mood radio. `excludeIds` keeps queue continuations fresh.
   * Falls back to plain seed searches when offline/cold — never empty-handed
   * unless the network itself is down.
   */
  async generateRadio(
    moodId: MoodId,
    options: { excludeIds?: Set<string>; size?: number; signal?: AbortSignal } = {}
  ): Promise<{ label: string; tagline: string; tracks: Track[] }> {
    const mood = moodById(moodId);
    const size = options.size ?? 30;

    const pool = await this.gatherPool(mood.seeds, options.signal);
    const ranked = this.rankPool(pool, mood, mood.affinityPull, options.excludeIds);

    return {
      label: mood.name,
      tagline: mood.tagline,
      tracks: this.arrange(ranked, size),
    };
  }

  /**
   * The daily Discovery Mix — the flagship "Made For You" surface.
   * 70% taste-adjacent (top artists + their flavour worlds),
   * 30% freshness (flavours they love but artists they don't know yet).
   */
  async generateDiscoveryMix(options: { excludeIds?: Set<string>; signal?: AbortSignal } = {}): Promise<Track[]> {
    await tasteProfile.load();
    const snapshot = tasteProfile.snapshot();

    const seeds: string[] = [];
    const knownArtists = snapshot.topArtists.slice(0, 4);

    // Taste-adjacent seeds.
    for (const artist of knownArtists) {
      seeds.push(`${artist.name} songs`);
    }
    // Flavour freshness.
    for (const { flavour } of snapshot.topFlavours.slice(0, 2)) {
      seeds.push(`${flavour} mix`);
    }
    // Cold start: broadly loved entry points.
    if (seeds.length === 0) {
      seeds.push('trending songs this week', 'songs everyone loves', 'timeless hits mix');
    }

    const pool = await this.gatherPool(seeds.slice(0, 6), options.signal);

    // Discovery mix: moderate taste pull, no mood filter.
    const ranked = this.rankPool(pool, undefined, 0.55, options.excludeIds);
    return this.arrange(ranked, 30);
  }

  /**
   * "On Repeat" — the listener's confirmed favourites, re-surfaced from
   * history + likes, ordered by weighted affinity.
   */
  async generateRepeatFavorites(signal?: AbortSignal): Promise<Track[]> {
    await tasteProfile.load();
    const snapshot = tasteProfile.snapshot();

    const seeds = snapshot.topArtists.slice(0, 6).map((a) => `${a.name} best songs`);
    if (!seeds.length) {
      const recents = LibraryService.getRecentlyPlayed();
      return recents.slice(0, 20);
    }

    const pool = await this.gatherPool(seeds, signal);

    // Strong taste pull — this mix is about the artists they already love.
    const ranked = this.rankPool(pool, undefined, 1.1)
      .filter(({ track }) => tasteProfile.affinity(track.artist.name) > 0);

    // Favourites first, then recent plays the model can confirm.
    const recents = LibraryService.getRecentlyPlayed();
    const seen = new Set<string>();
    const out: Track[] = [];

    for (const { track } of ranked) {
      if (seen.has(track.id)) continue;
      seen.add(track.id);
      out.push(track);
    }
    for (const t of recents) {
      if (out.length >= 30) break;
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      out.push(t);
    }

    return out.slice(0, 30);
  }

  /**
   * "Ask AI" playlist: prompt → plan (Gemini when configured) → search →
   * rank → tracks.
   */
  async generateFromPrompt(
    prompt: string,
    options: { signal?: AbortSignal; useAI?: boolean } = {}
  ): Promise<{ plan: AIPlaylistPlan; tracks: Track[] }> {
    await tasteProfile.load();
    const snap = tasteProfile.snapshot();

    const plan =
      options.useAI === false
        ? onDevicePlan(prompt)
        : await geminiPlaylistPlan(prompt, {
            topArtists: snap.topArtists.map((a) => a.name),
            topFlavours: snap.topFlavours.map((f) => f.flavour),
          });

    const pool = await this.gatherPool(plan.queries, options.signal);
    const exclude = new Set<string>();

    const moodish: MoodDef | undefined = plan.exclude
      ? {
          id: 'focus',
          name: plan.title,
          tagline: plan.description,
          seeds: plan.queries,
          keywords: [],
          exclude: plan.exclude,
          affinityPull: 0.4,
        }
      : undefined;

    const ranked = this.rankPool(pool, moodish, 0.45, exclude);
    return { plan, tracks: this.arrange(ranked, 30) };
  }

  /**
   * The smart autoplay hook: when the queue runs dry, pick ONE strong next
   * track. Combines related-tracks from the provider (strong signal) with
   * taste scoring (identity signal).
   */
  async nextBestTrack(current: Track, excludeIds: Set<string>, signal?: AbortSignal): Promise<Track | null> {
    await tasteProfile.load();

    try {
      const related = await MusicService.getRelated(current, signal);
      const fresh = related.filter((t) => !excludeIds.has(t.id) && t.duration <= 15 * 60);
      if (fresh.length) {
        const ranked = this.rankPool(fresh, undefined, 0.6, excludeIds);
        if (ranked.length) return ranked[0].track;
      }
    } catch {
      // fall through to taste seeds
    }

    // Fallback: the listener's current top artist's world.
    const tops = tasteProfile.topArtists(3);
    for (const { name } of tops) {
      try {
        const res = await MusicService.search(`${name} songs`, { limit: 15, signal });
        const fresh = res.tracks.filter((t) => !excludeIds.has(t.id) && t.duration <= 15 * 60);
        if (fresh.length) {
          const ranked = this.rankPool(fresh, undefined, 0.6, excludeIds);
          if (ranked.length) return ranked[0].track;
        }
      } catch {
        // try next seed
      }
    }

    return null;
  }

  /**
   * Song radio: build a station around one seed track, Spotify-style.
   *
   * Provider related-tracks are the strongest signal; artist-world and the
   * listener's own flavour vocabulary round the station out so it never runs
   * dry after ten songs. The pool is taste-ranked and arranged like the AI
   * playlists: strong openers, gentle rotation after. The seed is always
   * track one.
   */
  async radioFromSeed(
    seed: Track,
    size = 25,
    signal?: AbortSignal
  ): Promise<Track[]> {
    await tasteProfile.load();

    const picked: Track[] = [];
    const seen = new Set<string>([seed.id]);

    const absorb = (list: Track[]) => {
      for (const t of list) {
        if (picked.length >= size) return;
        if (seen.has(t.id) || t.duration > 15 * 60) continue;
        if (!t.albumImageUrl) continue; // no art = poor radio experience
        if (t.isVideo && /video|visualizer/i.test(t.title)) continue;
        seen.add(t.id);
        picked.push(t);
      }
    };

    // 1. The provider's own related-tracks, when it has them.
    try {
      absorb(await MusicService.getRelated(seed, signal));
    } catch {
      // Related is optional; the searches below cover for it.
    }

    // 2. The artist's world plus the listener's flavour vocabulary.
    const snapshot = tasteProfile.snapshot();
    const seeds = [
      `${seed.artist.name} songs`,
      `${seed.artist.name} mix`,
      ...snapshot.topFlavours.slice(0, 2).map((f) => `${f.flavour} mix`),
    ];

    try {
      absorb(await this.gatherPool(seeds, signal));
    } catch {
      // A thin radio beats no radio.
    }

    // 3. Taste-rank and arrange for listening. The seed never scores itself
    //    out of slot one — it is prepended after the cut.
    const ranked = this.rankPool(picked, undefined, 0.6, new Set([seed.id]));
    return [seed, ...this.arrange(ranked, size)];
  }

  /** The mood the clock + history suggest right now (Home chip). */
  async suggestedMood(): Promise<{ id: MoodId; reason: string }> {
    await tasteProfile.load();
    const hour = new Date().getHours();
    const clockMood = moodForHour(hour);
    return {
      id: clockMood,
      reason:
        clockMood === 'latenight' ? 'It is late — keep it low'
        : clockMood === 'commute' ? 'Made for the ride'
        : clockMood === 'focus' ? 'Prime focus hours'
        : clockMood === 'party' ? 'The weekend is calling'
        : 'Suits this time of day',
    };
  }

  // ---- internals ---------------------------------------------------------

  /** Fan out over seed queries, merge, and drop obvious junk. */
  private async gatherPool(seeds: string[], signal?: AbortSignal): Promise<Track[]> {
    const settled = await Promise.allSettled(
      seeds.map((q) => MusicService.search(q, { limit: SEARCH_LIMIT, signal }))
    );

    const byId = new Map<string, Track>();
    for (const result of settled) {
      if (result.status !== 'fulfilled') continue;
      for (const track of result.value.tracks) {
        if (!track.albumImageUrl) continue; // no art = poor radio experience
        if (track.isVideo && /video|visualizer/i.test(track.title)) continue;
        if (!byId.has(track.id)) byId.set(track.id, track);
      }
    }

    return [...byId.values()];
  }

  /** Score the pool and drop the bottom + excluded. */
  private rankPool(
    pool: Track[],
    mood: MoodDef | undefined,
    affinityPull: number,
    excludeIds?: Set<string>
  ): ScoredTrack[] {
    const excluded = excludeIds ?? new Set<string>();

    return pool
      .filter((t) => !excluded.has(t.id))
      .map((track) => ({ track, score: this.scoreTrack(track, mood, affinityPull) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Arrange a ranked list for listening: strong openers, then gentle
   * rotation so the radio doesn't read as a sorted chart.
   */
  private arrange(ranked: ScoredTrack[], size: number): Track[] {
    const head = ranked.slice(0, Math.ceil(size * 0.25));
    const rest = shuffle(ranked.slice(head.length));

    const tracks: Track[] = [];
    const seen = new Set<string>();

    const push = ({ track }: ScoredTrack) => {
      if (seen.has(track.id) || tracks.length >= size) return;
      seen.add(track.id);
      tracks.push(track);
    };

    head.forEach(push);
    rest.forEach(push);

    return tracks;
  }
}

// Flavour regexes mirrored here (kept in sync with TasteProfile's table).
const FLAVOUR_RES: [string, RegExp][] = [
  ['lofi', /\blo-?fi\b|lofi hip ?hop|chillhop/i],
  ['slowed', /\bslowed\b|\breverb\b|\bnightcore\b/i],
  ['remix', /\bremix\b|\bbootleg\b|\bflip\b/i],
  ['acoustic', /\bacoustic\b|\bunplugged\b|\bcover\b/i],
  ['live', /\blive\b|\bconcert\b/i],
  ['instrumental', /\binstrumental\b|\bbeats to\b/i],
  ['edm', /\bedm\b|\bdubstep\b|\bhouse mix\b|\btrance\b/i],
  ['hiphop', /\bhip ?hop\b|\brap\b|\bdrill\b|\btrap\b/i],
  ['bollywood', /\bbollywood\b|\bhindi song/i],
  ['punjabi', /\bpunjabi\b|\bdesi hip ?hop\b/i],
  ['classical', /\bclassical\b|\bpiano sonata/i],
  ['rock', /\brock\b|\bmetal\b|\bpunk\b/i],
  ['jazz', /\bjazz\b|\bsaxophone\b/i],
  ['pop', /\bpop hits\b|\btop 40\b/i],
  ['romance', /\blove song|\bromantic\b/i],
  ['sad', /\bsad\b|\bheartbreak\b/i],
  ['energetic', /\bworkout\b|\bgym\b|\bhype\b|\bbanger/i],
];

export const recommendationEngine = new RecommendationEngine();
