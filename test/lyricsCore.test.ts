import test from 'node:test';
import assert from 'node:assert';

/**
 * Regression tests for src/services/lyricsCore.ts (Bug 2 client logic).
 * Run with node --test (Node >= 23.6 strips types natively).
 */
import {
  activeLineIndexFor,
  normalizeForMatch,
  parseLrclibPayload,
  sanitizeCompanionPayload,
  scoreLrclibHit,
} from '../src/services/lyricsCore.ts';

// ── scoreLrclibHit: identity verification ────────────────────────────────────

const REQ_TITLE = normalizeForMatch('Midnight Drive');
const REQ_ARTIST = normalizeForMatch('Neon Alley');

test('a hit by a different artist with a different title is rejected outright', () => {
  const score = scoreLrclibHit(
    { trackName: 'Night Drive', artistName: 'Other Band', duration: 200, syncedLyrics: 'x' },
    REQ_TITLE,
    REQ_ARTIST,
    200
  );
  assert.strictEqual(score, null);
});

test('exact title + exact artist scores high', () => {
  const score = scoreLrclibHit(
    { trackName: 'Midnight Drive', artistName: 'Neon Alley', duration: 200, syncedLyrics: 'x' },
    REQ_TITLE,
    REQ_ARTIST,
    200
  );
  assert.ok(score !== null && score >= 8, `expected high score, got ${score}`);
});

test('title variant containment still matches (live/remaster suffixes)', () => {
  const score = scoreLrclibHit(
    { trackName: 'Midnight Drive (Remastered 2020)', artistName: 'Neon Alley', duration: 201, syncedLyrics: 'x' },
    REQ_TITLE,
    REQ_ARTIST,
    200
  );
  assert.ok(score !== null && score >= 6, `expected strong score, got ${score}`);
});

test('same title by a DIFFERENT artist is rejected — never serve another version', () => {
  // "Midnight Drive" by a cover band is a different song; its lyrics must
  // never be served for the requested artist.
  const score = scoreLrclibHit(
    { trackName: 'Midnight Drive', artistName: 'Cover Band', duration: 200, syncedLyrics: 'x' },
    REQ_TITLE,
    REQ_ARTIST,
    200
  );
  assert.strictEqual(score, null);
});

test('whole-token matching: Night Drive is not Midnight Drive', () => {
  const score = scoreLrclibHit(
    { trackName: 'Night Drive', artistName: 'Neon Alley', duration: 200, syncedLyrics: 'x' },
    REQ_TITLE,
    REQ_ARTIST,
    200
  );
  assert.strictEqual(score, null, 'substring matches must not sneak through');
});

test('artist with extra members still agrees (band/feat variants)', () => {
  const score = scoreLrclibHit(
    { trackName: 'Midnight Drive', artistName: 'Neon Alley & The Crew', duration: 200, syncedLyrics: 'x' },
    REQ_TITLE,
    REQ_ARTIST,
    200
  );
  assert.ok(score !== null, 'token containment should accept artist variants');
});

test('duration proximity adjusts the score', () => {
  const close = scoreLrclibHit(
    { trackName: 'Midnight Drive', artistName: 'Neon Alley', duration: 200, syncedLyrics: 'x' },
    REQ_TITLE,
    REQ_ARTIST,
    200
  );
  const far = scoreLrclibHit(
    { trackName: 'Midnight Drive', artistName: 'Neon Alley', duration: 320, syncedLyrics: 'x' },
    REQ_TITLE,
    REQ_ARTIST,
    200
  );
  assert.ok(close > far);
});

// ── parseLrclibPayload: synced vs plain honesty ──────────────────────────────

test('synced LRC payload parses with genuine timestamps and synced: true', () => {
  const out = parseLrclibPayload({
    syncedLyrics: '[00:01.20] line one\n[01:02.30] line two\n[xx:yy] garbage line',
    plainLyrics: 'plain fallback',
  });
  assert.ok(out);
  assert.strictEqual(out.synced, true);
  assert.strictEqual(out.lines.length, 2);
  assert.strictEqual(out.lines[0].time, 1.2);
  assert.strictEqual(out.lines[1].time, 62.3);
  assert.strictEqual(out.lines[0].text, 'line one');
});

test('a synced payload with no usable timestamps is NOT treated as synced', () => {
  const out = parseLrclibPayload({ syncedLyrics: 'no timestamps here at all', plainLyrics: 'plain text\nsecond line' });
  assert.ok(out);
  assert.strictEqual(out.synced, false);
  assert.strictEqual(out.lines[0].text, 'plain text');
});

test('plain-only payload is parsed unsynced', () => {
  const out = parseLrclibPayload({ plainLyrics: 'a\nb\nc' });
  assert.ok(out);
  assert.strictEqual(out.synced, false);
  assert.strictEqual(out.lines[0].time, undefined);
});

test('empty payload parses to null', () => {
  assert.strictEqual(parseLrclibPayload({}), null);
  assert.strictEqual(parseLrclibPayload(null), null);
});

// ── sanitizeCompanionPayload: defence against bad server payloads ───────────

test('synced:true with NO timestamps is downgraded to unsynced', () => {
  const out = sanitizeCompanionPayload({
    lines: [{ text: 'one' }, { text: 'two' }],
    synced: true,
    romanized: false,
    source: 'LRCLIB',
  });
  assert.ok(out);
  assert.strictEqual(out.synced, false, 'plain lines can never drive karaoke');
});

test('synced:true WITH genuine timestamps stays synced', () => {
  const out = sanitizeCompanionPayload({
    lines: [{ text: 'one', time: 1 }, { text: 'two', time: 4 }],
    synced: true,
    source: 'LRCLIB',
  });
  assert.ok(out);
  assert.strictEqual(out.synced, true);
});

test('original text is preserved when the display text is romanized', () => {
  const out = sanitizeCompanionPayload({
    lines: [{ text: 'Mainoon tere', original: 'ਮੈਨੂੰ ਤੇਰੇ', time: 1 }],
    synced: true,
    romanized: true,
    source: 'LRCLIB',
  });
  assert.ok(out);
  assert.strictEqual(out.romanized, true);
  assert.strictEqual(out.lines[0].original, 'ਮੈਨੂੰ ਤੇਰੇ');
});

test('empty / malformed payloads are rejected', () => {
  assert.strictEqual(sanitizeCompanionPayload({ lines: [] }), null);
  assert.strictEqual(sanitizeCompanionPayload(null), null);
  assert.strictEqual(sanitizeCompanionPayload({ lines: [{}, { text: '' }] }), null);
  assert.strictEqual(sanitizeCompanionPayload({ nope: true }), null);
});

// ── activeLineIndexFor: sync behaviour ──────────────────────────────────────

const SYNCED = {
  synced: true,
  lines: [
    { time: 0, text: 'a' },
    { time: 10, text: 'b' },
    { time: 20, text: 'c' },
  ],
};

test('active line follows playback position', () => {
  assert.strictEqual(activeLineIndexFor(SYNCED as never, 0), 0);
  assert.strictEqual(activeLineIndexFor(SYNCED as never, 9.9), 0);
  assert.strictEqual(activeLineIndexFor(SYNCED as never, 10), 1);
  assert.strictEqual(activeLineIndexFor(SYNCED as never, 45), 2);
});

test('seeking backwards recomputes the active line immediately', () => {
  assert.strictEqual(activeLineIndexFor(SYNCED as never, 45), 2);
  assert.strictEqual(activeLineIndexFor(SYNCED as never, 5), 0);
});

test('unsynced lyrics never return an active line', () => {
  const unsynced = { synced: false, lines: [{ text: 'a' }, { text: 'b' }] };
  assert.strictEqual(activeLineIndexFor(unsynced as never, 10), -1);
  assert.strictEqual(activeLineIndexFor(null, 10), -1);
});

test('partially timestamped lines are tolerated (only real timestamps participate)', () => {
  const partial = {
    synced: true,
    lines: [{ text: 'intro' }, { time: 8, text: 'verse' }, { text: 'bridge' }, { time: 20, text: 'outro' }],
  };
  assert.strictEqual(activeLineIndexFor(partial as never, 5), -1);
  assert.strictEqual(activeLineIndexFor(partial as never, 10), 1);
  assert.strictEqual(activeLineIndexFor(partial as never, 25), 3);
});
