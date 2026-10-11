import { MoodId } from '../constants/theme';

/**
 * Mood Radio definitions.
 *
 * Each mood is a small program: seed queries give it raw material, keyword
 * filters bias selection, and the affinity settings say how much the listener's
 * taste should pull the radio toward what they already love (vs. discovery).
 */
export type MoodDef = {
  id: MoodId;
  name: string;
  tagline: string;
  /** Search queries that seed the radio pool. */
  seeds: string[];
  /** Title/artist keywords that score a candidate up (lowercase). */
  keywords: string[];
  /** Keywords that disqualify a candidate (lowercase). */
  exclude?: string[];
  /** Preferred duration window in seconds. */
  duration?: { min: number; max: number };
  /** 0 = pure discovery, 1 = only what they know. */
  affinityPull: number;
  /** Default hour ranges this mood naturally belongs to (for "now" detection). */
  hours?: [number, number][];
};

export const MOODS: MoodDef[] = [
  {
    id: 'workout',
    name: 'Workout',
    tagline: 'Adrenaline, on tap',
    seeds: [
      'workout motivation songs', 'gym workout mix', 'power workout bangers',
      'high energy run mix', 'pump up songs',
    ],
    keywords: ['workout', 'gym', 'pump', 'power', 'energy', 'hype', 'banger', 'beast', 'stronger', 'run'],
    exclude: ['sleep', 'sad version', 'slowed'],
    affinityPull: 0.35,
  },
  {
    id: 'focus',
    name: 'Focus',
    tagline: 'Deep work, zero distractions',
    seeds: [
      'deep focus music', 'instrumental study concentration', 'ambient focus flow',
      'productivity beats', 'lofi work sessions',
    ],
    keywords: ['focus', 'study', 'concentration', 'instrumental', 'ambient', 'flow', 'deep work', 'beats'],
    exclude: ['remix', 'mashup', 'live', '10 hour', '1 hour', '3 hour'],
    duration: { min: 120, max: 480 },
    affinityPull: 0.2,
  },
  {
    id: 'chill',
    name: 'Chill',
    tagline: 'Take the edge off',
    seeds: [
      'chill relaxing songs', 'lofi chill beats', 'sunset chill mix',
      'easy acoustic chill', 'calm evening songs',
    ],
    keywords: ['chill', 'relax', 'lofi', 'calm', 'sunset', 'easy', 'soft', 'mellow', 'coffee'],
    exclude: ['hard bass', 'aggressive'],
    affinityPull: 0.4,
    hours: [[17, 22]],
  },
  {
    id: 'latenight',
    name: 'Late Night',
    tagline: 'For the hours nobody sees',
    seeds: [
      'late night vibes', '3am songs', 'night drive music',
      'midnight slow jams', 'after hours rnb',
    ],
    keywords: ['night', 'midnight', '3am', 'after hours', 'moon', 'nocturne', 'late'],
    exclude: ['day', 'morning'],
    affinityPull: 0.45,
    hours: [[23, 4]],
  },
  {
    id: 'party',
    name: 'Party',
    tagline: 'Turn it all the way up',
    seeds: [
      'party anthems', 'dance floor hits', 'club bangers mix',
      'weekend party songs', 'edm party mix',
    ],
    keywords: ['party', 'dance', 'club', 'anthem', 'banger', 'turn up', 'edm', 'remix'],
    affinityPull: 0.35,
  },
  {
    id: 'emotional',
    name: 'Feels',
    tagline: 'Sit with it for a while',
    seeds: [
      'sad songs to cry', 'heartbreak playlist', 'emotional songs',
      'rainy day sad songs', 'breakup songs',
    ],
    keywords: ['sad', 'cry', 'heartbreak', 'broken', 'alone', 'tears', 'miss you', 'goodbye'],
    exclude: ['remix', 'sped up'],
    affinityPull: 0.5,
  },
  {
    id: 'commute',
    name: 'Commute',
    tagline: 'Make the ride shorter',
    seeds: [
      'road trip songs', 'drive mix', 'morning commute music',
      'feel good driving songs', 'traffic jam tunes',
    ],
    keywords: ['drive', 'road', 'highway', 'ride', 'journey', 'morning'],
    affinityPull: 0.5,
    hours: [[7, 10], [17, 20]],
  },
  {
    id: 'romance',
    name: 'Romance',
    tagline: 'Two-person playlist',
    seeds: [
      'romantic love songs', 'date night music', 'love duets',
      'soulful love ballads', 'anniversary songs',
    ],
    keywords: ['love', 'romantic', 'heart', 'baby', 'forever', 'kiss', 'valentine'],
    exclude: ['sad version'],
    affinityPull: 0.45,
  },
];

export const moodById = (id: MoodId): MoodDef =>
  MOODS.find((m) => m.id === id) ?? MOODS[2];

/**
 * The mood the clock says it should be — used for the "Made for this moment"
 * chip on Home. Falls back to chill.
 */
export function moodForHour(hour: number): MoodId {
  for (const mood of MOODS) {
    if (!mood.hours) continue;
    for (const [from, to] of mood.hours) {
      // Range may wrap midnight (23 → 4).
      const inRange = from <= to ? hour >= from && hour <= to : hour >= from || hour <= to;
      if (inRange) return mood.id;
    }
  }
  return hour < 12 ? 'commute' : 'chill';
}
