import { Track } from '../core/types';
import { LibraryService, HistoryEntry } from '../services/LibraryService';
import { tasteProfile, normalizeArtistName } from '../ai/TasteProfile';

/**
 * Wrapped — the monthly listening recap.
 *
 * Aggregates the listening log into a story: top tracks, top artists, total
 * time, listening personality, hour-of-day shape. Runs entirely on-device.
 * The log holds the most recent 300 real listens, so the recap covers the
 * last ~30 days of activity for a typical listener.
 */

export type WrappedStats = {
  /** Calendar month label, e.g. "October 2026". */
  monthLabel: string;
  /** Total listening seconds represented in the log window. */
  totalSeconds: number;
  /** Real listens counted. */
  listens: number;
  topTracks: { track: Track; plays: number }[];
  topArtists: { name: string; plays: number; image?: string }[];
  /** Hour histogram 0-23 (relative 0..1). */
  hours: number[];
  /** Peak listening hour (0-23). */
  peakHour: number;
  /** Listener personality, derived from the shape of the month. */
  personality: { title: string; blurb: string };
  /** The flavour that dominated, e.g. "lofi". */
  topFlavour: string | null;
  /** Distinct artists heard. */
  distinctArtists: number;
  /** Longest single-day streak within the window. */
  longestDayChain: number;
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function personalityFor(hours: number[], totalSeconds: number, topFlavour: string | null): { title: string; blurb: string } {
  // Time-of-day buckets.
  const bucket = (from: number, to: number) => {
    let sum = 0;
    for (let h = from; h <= to; h++) sum += hours[h];
    return sum;
  };

  const night = bucket(0, 4) + bucket(22, 23);
  const morning = bucket(5, 11);
  const day = bucket(12, 17);
  const evening = bucket(18, 21);
  const max = Math.max(night, morning, day, evening, 0.0001);

  if (night / max > 0.75) {
    return { title: 'The Night Owl', blurb: 'You do your best listening when the world is asleep. Late-night sessions defined your month.' };
  }
  if (morning / max > 0.75) {
    return { title: 'The Sunrise Listener', blurb: 'Music starts before everything else does. Your mornings have a soundtrack and it is yours.' };
  }
  if (evening / max > 0.75) {
    return { title: 'The Golden Hour Devotee', blurb: 'Your evenings belong to the music. Sunset to midnight is your prime time.' };
  }
  if (totalSeconds > 40 * 3600) {
    return { title: 'The Deep Diver', blurb: 'You do not skim music — you move in. Serious hours, serious taste.' };
  }
  if (topFlavour === 'lofi' || topFlavour === 'instrumental') {
    return { title: 'The Flow Keeper', blurb: 'Beats to think to. Your month ran on focus fuel.' };
  }
  if (topFlavour === 'energetic' || topFlavour === 'edm') {
    return { title: 'The Power Source', blurb: 'Loud, fast, relentless. You listen like every song is the last chorus.' };
  }
  return { title: 'The All-Rounder', blurb: 'Morning coffee, midday energy, midnight calm — your taste refuses to sit in one box.' };
}

export function computeWrapped(now: Date = new Date()): WrappedStats {
  const history: HistoryEntry[] = LibraryService.getHistory();
  const monthLabel = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

  // Keep listens from this calendar month; fall back to the full log when
  // the month is young so day-one users still get a story.
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  let entries = history.filter((e) => e.playedAt >= monthStart);
  if (entries.length < 8) entries = history;

  const totalSeconds = entries.reduce((sum, e) => sum + (e.track.duration > 0 ? Math.min(e.track.duration, 600) : 210), 0);

  // Top tracks.
  const trackCounts = new Map<string, { track: Track; plays: number }>();
  for (const e of entries) {
    const hit = trackCounts.get(e.track.id);
    if (hit) hit.plays += 1;
    else trackCounts.set(e.track.id, { track: e.track, plays: 1 });
  }
  const topTracks = [...trackCounts.values()].sort((a, b) => b.plays - a.plays).slice(0, 5);

  // Top artists.
  const artistCounts = new Map<string, { name: string; plays: number; image?: string; display: string }>();
  for (const e of entries) {
    const key = normalizeArtistName(e.track.artist.name);
    if (!key) continue;
    const hit = artistCounts.get(key);
    if (hit) {
      hit.plays += 1;
    } else {
      artistCounts.set(key, {
        name: key,
        display: e.track.artist.name,
        plays: 1,
        image: e.track.artist.imageUrl ?? e.track.albumImageUrl,
      });
    }
  }
  const topArtists = [...artistCounts.values()]
    .sort((a, b) => b.plays - a.plays)
    .slice(0, 5)
    .map(({ name, plays, image, display }) => ({ name: display || name, plays, image }));

  // Hour histogram.
  const hours = new Array(24).fill(0) as number[];
  for (const e of entries) hours[new Date(e.playedAt).getHours()] += 1;
  const maxHour = Math.max(...hours, 0.0001);
  const norm = hours.map((h) => h / maxHour);
  const peakHour = hours.indexOf(Math.max(...hours));

  // Flavours from the taste model (monthly proxy).
  const topFlavour = tasteProfile.topFlavours(1)[0]?.flavour ?? null;

  // Longest consecutive-day chain within the window.
  const days = new Set(entries.map((e) => new Date(e.playedAt).toDateString()));
  let longestDayChain = 0;
  for (const day of days) {
    let chain = 1;
    let cursor = new Date(day).getTime();
    while (days.has(new Date(cursor + 86_400_000).toDateString())) {
      chain += 1;
      cursor += 86_400_000;
    }
    longestDayChain = Math.max(longestDayChain, chain);
  }

  return {
    monthLabel,
    totalSeconds,
    listens: entries.length,
    topTracks,
    topArtists,
    hours: norm,
    peakHour,
    personality: personalityFor(norm, totalSeconds, topFlavour),
    topFlavour,
    distinctArtists: artistCounts.size,
    longestDayChain,
  };
}

export const formatHours = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};
