const test = require('node:test');
const assert = require('node:assert');

/**
 * Regression tests for /api/lyrics (server/lyricsProxy.js) — Bug 2.
 *
 * The previous implementation:
 *   1. generated placeholder "(Verse 1) ♪" lyrics from the song title when no
 *      provider had the song (fabrication),
 *   2. distributed plain lyrics across the duration with invented timestamps
 *      and returned synced:true (faked live synchronization),
 *   3. accepted the FIRST hit with any synced lyrics even when it belonged to
 *      a different artist/version (wrong lyrics for one track).
 *
 * These tests pin the corrected behaviour with a stubbed global fetch.
 */

const realFetch = globalThis.fetch;
const { handleLyricsRequest } = require('../server/lyricsProxy.js');

function makeRes() {
  return {
    status: null,
    headers: null,
    body: null,
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    end(body) {
      this.body = body;
    },
  };
}

function parsed(query) {
  return new URL(`http://localhost/api/lyrics?${query}`);
}

/** Stub fetch with a queue of { match: RegExp|fn, reply: {ok,status,json} }. */
function stubFetch(routes) {
  globalThis.fetch = async (url) => {
    for (const route of routes) {
      const matches = typeof route.match === 'function' ? route.match(url) : route.match.test(url);
      if (matches) return route.reply;
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
}

const SYNCED_LRC = [
  '[00:01.00] First line of the real song',
  '[00:05.00] Second line of the real song',
  '[00:09.00] Third line of the real song',
  '[00:13.00] Fourth line of the real song',
].join('\n');

const PLAIN_TEXT = [
  'Plain first line',
  'Plain second line',
  'Plain third line',
  'Plain fourth line',
].join('\n');

function lrclibSearchReply(hits) {
  return { ok: true, status: 200, json: async () => hits };
}

test('no fabrication: an unknown song returns an explicit empty result, never placeholder lyrics', async () => {
  stubFetch([
    { match: /lrclib\.net/, reply: { ok: true, status: 200, json: async () => [] } },
    { match: /lyrics\.ovh/, reply: { ok: false, status: 404, json: async () => ({}) } },
  ]);

  const res = makeRes();
  await handleLyricsRequest({ method: 'GET' }, res, parsed('title=Totally+Unknown+Song+XZ&artist=Nobody&duration=180&id=t1'));

  assert.strictEqual(res.status, 200);
  const data = JSON.parse(res.body);
  assert.deepStrictEqual(data.lines, [], 'no lyric lines may be invented');
  assert.strictEqual(data.synced, false);
  assert.strictEqual(data.romanized, false);
  assert.ok(!res.body.includes('Verse'), 'invented Verse labels are forbidden');
  assert.ok(!res.body.includes('Intro'), 'invented Intro labels are forbidden');
  assert.ok(!res.body.includes('♪'), 'invented decorative lines are forbidden');
});

test('plain lyrics are returned UNSYNCED — no invented timestamps, no fake live sync', async () => {
  stubFetch([
    {
      match: /lrclib\.net\/api\/search/,
      reply: lrclibSearchReply([
        {
          trackName: 'Plain Song',
          artistName: 'The Plaintives',
          duration: 200,
          syncedLyrics: null,
          plainLyrics: PLAIN_TEXT,
        },
      ]),
    },
  ]);

  const res = makeRes();
  await handleLyricsRequest({ method: 'GET' }, res, parsed('title=Plain+Song&artist=The+Plaintives&duration=200&id=t2'));

  const data = JSON.parse(res.body);
  assert.strictEqual(data.synced, false, 'plain text must never be labelled synced');
  for (const line of data.lines) {
    assert.strictEqual(line.time, undefined, 'no timestamp may be invented for plain lyrics');
    assert.ok(line.text.length > 0);
  }
});

test('wrong-version rejection: a synced hit by a DIFFERENT artist is not served', async () => {
  stubFetch([
    {
      match: /lrclib\.net\/api\/search/,
      reply: lrclibSearchReply([
        {
          trackName: 'Midnight Drive',
          artistName: 'Some Other Band',
          duration: 199,
          syncedLyrics: SYNCED_LRC,
          plainLyrics: null,
        },
      ]),
    },
  ]);

  const res = makeRes();
  await handleLyricsRequest({ method: 'GET' }, res, parsed('title=Midnight+Drive&artist=Neon+Alley&duration=200&id=t3'));

  const data = JSON.parse(res.body);
  assert.deepStrictEqual(data.lines, [], 'a different artist\'s lyrics must not be served');
  assert.strictEqual(data.synced, false);
});

test('verified selection: the matching hit wins over an earlier non-matching synced hit', async () => {
  stubFetch([
    {
      match: /lrclib\.net\/api\/search/,
      reply: lrclibSearchReply([
        {
          trackName: 'Neon Skyline (Live at Nowhere)',
          artistName: 'Cover Band',
          duration: 190,
          syncedLyrics: '[00:01.00] wrong cover version lyrics here\n[00:02.00] more wrong\n[00:03.00] still wrong',
          plainLyrics: null,
        },
        {
          trackName: 'Neon Skyline',
          artistName: 'Neon Alley',
          duration: 200,
          syncedLyrics: SYNCED_LRC,
          plainLyrics: null,
        },
      ]),
    },
  ]);

  const res = makeRes();
  await handleLyricsRequest({ method: 'GET' }, res, parsed('title=Neon+Skyline&artist=Neon+Alley&duration=200&id=t4'));

  const data = JSON.parse(res.body);
  assert.strictEqual(data.synced, true, 'genuine LRC timestamps stay synced');
  assert.strictEqual(data.romanized, false, 'English lyrics must not be described as transliterated');
  assert.strictEqual(data.lines[0].text, 'First line of the real song');
  assert.strictEqual(data.lines[0].time, 1);
  assert.ok(data.lines.every((l) => typeof l.time === 'number'), 'synced lines carry real timestamps');
});

test('romanization preserves the original: non-Latin lines carry original text and romanized flag', async () => {
  const gurmukhiLrc = [
    '[00:01.00] ਮੈਨੂੰ ਤੇਰੇ',
    '[00:05.00] ਹੋਰ ਲਾਈਨ',
    '[00:09.00] ਤੀਜੀ ਲਾਈਨ',
    '[00:13.00] ਚੌਥੀ ਲਾਈਨ',
  ].join('\n');

  stubFetch([
    {
      match: /lrclib\.net\/api\/search/,
      reply: lrclibSearchReply([
        {
          trackName: 'Punjabi Song',
          artistName: 'Gurmukhi Artist',
          duration: 200,
          syncedLyrics: gurmukhiLrc,
          plainLyrics: null,
        },
      ]),
    },
  ]);

  const res = makeRes();
  await handleLyricsRequest({ method: 'GET' }, res, parsed('title=Punjabi+Song&artist=Gurmukhi+Artist&duration=200&id=t5'));

  const data = JSON.parse(res.body);
  assert.strictEqual(data.synced, true);
  assert.strictEqual(data.romanized, true, 'genuine transliteration is flagged');
  for (const line of data.lines) {
    assert.match(line.text, /^[a-zA-Z ]+$/, 'display text is Roman English');
    assert.ok(line.original, 'the provider original script is preserved per line');
  }
});

test('genuine synced LRC keeps real timestamps and honest source', async () => {
  stubFetch([
    {
      match: /lrclib\.net\/api\/search/,
      reply: lrclibSearchReply([
        {
          trackName: 'Static Horizon',
          artistName: 'Neon Alley',
          duration: 200,
          syncedLyrics: SYNCED_LRC,
          plainLyrics: null,
        },
      ]),
    },
  ]);

  const res = makeRes();
  await handleLyricsRequest({ method: 'GET' }, res, parsed('title=Static+Horizon&artist=Neon+Alley&duration=200&id=t6'));

  const data = JSON.parse(res.body);
  assert.strictEqual(data.source, 'LRCLIB', 'source names the provider, not a claim of transliteration');
  assert.strictEqual(data.synced, true);
  assert.strictEqual(data.lines.length, 4);
  assert.strictEqual(data.lines[2].time, 9);
});

test('missing title is a 400', async () => {
  const res = makeRes();
  await handleLyricsRequest({ method: 'GET' }, res, parsed('artist=X'));
  assert.strictEqual(res.status, 400);
});

test('cleanup: restore global fetch', () => {
  globalThis.fetch = realFetch;
  assert.ok(true);
});
