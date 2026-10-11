import { GoogleGenAI } from '@google/genai';
import { readJson, writeJson, STORAGE_KEYS } from '../core/storage';

/**
 * Gemini layer — the optional intelligence boost.
 *
 * The app is fully smart without it (TasteProfile + RecommendationEngine run
 * on-device). When the user pastes a Gemini API key in Settings, two things
 * upgrade:
 *
 *   1. "Ask AI" playlist prompts go from keyword-matched searches to a real
 *      plan (multiple curated queries + a title + a rationale).
 *   2. Radio seeds get refreshed with taste-aware query ideas.
 *
 * The key is stored locally and used ONLY for these requests.
 */

const KEY_STORAGE = 'ai-gemini-key';
const MODEL = 'gemini-2.5-flash-lite';

let cachedKey: string | null = null;
let loaded = false;

export async function getGeminiKey(): Promise<string> {
  if (!loaded) {
    cachedKey = (await readJson<string>(KEY_STORAGE, '')) || '';
    loaded = true;
  }
  return cachedKey ?? '';
}

export async function setGeminiKey(key: string): Promise<void> {
  cachedKey = key.trim();
  loaded = true;
  await writeJson(KEY_STORAGE, cachedKey);
}

export const isGeminiConfigured = async (): Promise<boolean> => {
  return (await getGeminiKey()).length > 20;
};

export type AIPlaylistPlan = {
  title: string;
  description: string;
  /** 3-5 search queries that together cover the requested vibe. */
  queries: string[];
  /** Optional negative keywords to filter out of results. */
  exclude?: string[];
  /** 'gemini' when the plan came from the model, 'on-device' otherwise. */
  source: 'gemini' | 'on-device';
};

/**
 * Build an on-device plan from the prompt. Deterministic, instant, private —
 * the fallback when no key is set (or the call fails).
 */
export function onDevicePlan(prompt: string): AIPlaylistPlan {
  const p = prompt.toLowerCase();

  // Keyword → query templates. Ordered: first match wins the flavour.
  const templates: [RegExp, { title: string; queries: string[]; exclude?: string[] }][] = [
    [/gym|workout|pump|lift|training/, {
      title: 'Gym Mode',
      queries: ['workout motivation songs', 'gym bangers mix', 'high energy training music'],
      exclude: ['slowed', 'sleep'],
    }],
    [/study|focus|work|concentrat|exam/, {
      title: 'Deep Focus',
      queries: ['deep focus instrumental', 'lofi study beats', 'ambient concentration music'],
      exclude: ['remix', 'live'],
    }],
    [/sleep|relax|calm|unwind|night/, {
      title: 'Wind Down',
      queries: ['calming sleep music', 'soft relaxing songs', 'peaceful ambient mix'],
      exclude: ['remix', 'banger'],
    }],
    [/sad|cry|heartbreak|breakup|miss/, {
      title: 'Feels strong today',
      queries: ['sad songs that hit', 'heartbreak playlist', 'emotional ballads'],
    }],
    [/party|dance|club|weekend/, {
      title: 'Party Starters',
      queries: ['party anthems', 'dance hits mix', 'club bangers'],
    }],
    [/drive|road|travel|commute/, {
      title: 'On the Road',
      queries: ['road trip songs', 'driving feel good mix', 'travel songs'],
    }],
    [/love|romantic|date|valentine/, {
      title: 'Written in the Stars',
      queries: ['romantic love songs', 'soulful love ballads', 'date night music'],
    }],
    [/punjabi|desi|bhangra/, {
      title: 'Desi Heat',
      queries: ['punjabi hits', 'desi hip hop', 'bhangra bangers'],
    }],
    [/hindi|bollywood/, {
      title: 'Bollywood Journeys',
      queries: ['bollywood hits', 'hindi romantic songs', 'bollywood party mix'],
    }],
  ];

  for (const [re, plan] of templates) {
    if (re.test(p)) {
      return {
        title: plan.title,
        description: `Built from your prompt: "${prompt.trim()}"`,
        queries: plan.queries,
        exclude: plan.exclude,
        source: 'on-device',
      };
    }
  }

  // Generic: treat the whole prompt as a search seed.
  return {
    title: prompt.trim().slice(0, 42) || 'AI Mix',
    description: `Built from your prompt: "${prompt.trim()}"`,
    queries: [prompt.trim(), `${prompt.trim()} mix`, `${prompt.trim()} playlist`],
    source: 'on-device',
  };
}

/**
 * Ask Gemini for a playlist plan. Throws only on hard failures the caller
 * wants to surface; falls back to on-device when no key exists.
 */
export async function geminiPlaylistPlan(
  prompt: string,
  context: { topArtists: string[]; topFlavours: string[] }
): Promise<AIPlaylistPlan> {
  const key = await getGeminiKey();
  if (!key) return onDevicePlan(prompt);

  try {
    const ai = new GoogleGenAI({ apiKey: key });

    const system = [
      'You plan music playlists for a music player app. The app searches YouTube Music,',
      'so every query must be a realistic YouTube Music search phrase.',
      'Reply with ONLY minified JSON, no markdown fences, in this exact shape:',
      '{"title":string(<=42 chars),"description":string(<=90 chars),"queries":string[3],"exclude":string[0..4]}',
      'Make the queries diverse but all clearly aligned with the user request.',
      'The exclude list holds keywords that should be filtered out of results.',
    ].join(' ');

    const taste =
      context.topArtists.length || context.topFlavours.length
        ? ` Listener's favourite artists: ${context.topArtists.slice(0, 6).join(', ') || 'n/a'}.`
        + ` Favourite flavours: ${context.topFlavours.join(', ') || 'n/a'}. Blend familiarity with discovery.`
        : ' Listener history is cold — favour broadly loved tracks for the vibe.';

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: `${system}${taste}\n\nUser request: ${prompt}`,
    });

    const text = response.text ?? '';
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart < 0 || jsonEnd <= jsonStart) throw new Error('no json');

    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as Partial<AIPlaylistPlan>;
    if (!Array.isArray(parsed.queries) || parsed.queries.length === 0) {
      throw new Error('empty queries');
    }

    return {
      title: String(parsed.title || 'AI Mix').slice(0, 42),
      description: String(parsed.description || '').slice(0, 90),
      queries: parsed.queries.slice(0, 5).map(String),
      exclude: Array.isArray(parsed.exclude) ? parsed.exclude.map(String).slice(0, 4) : undefined,
      source: 'gemini',
    };
  } catch {
    return onDevicePlan(prompt);
  }
}
