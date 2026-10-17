const test = require('node:test');
const assert = require('node:assert');

/**
 * Regression tests for the romanizer honesty contract (Bug 2).
 *
 * - Latin input is NEVER described as transliterated (romanized: false).
 * - Supported non-Latin scripts are genuinely romanized.
 * - Unsupported scripts (e.g. Han ideographs) are preserved verbatim — the
 *   old implementation stripped unmapped characters, corrupting those lines.
 */

const { transliterateLine, toRomanEnglish } = require('../server/romanizer.js');

test('plain Latin/English lines pass through unmodified and are not marked romanized', () => {
  const inputs = [
    'Hello, world!',
    'How are you? I am fine',
    "Don't stop the music — it's my song",
    '1234 numbers and (parentheses)',
  ];
  for (const line of inputs) {
    const out = transliterateLine(line);
    assert.strictEqual(out.romanized, false, `must not claim romanization for: ${line}`);
    assert.strictEqual(out.text, line, `Latin text must be preserved verbatim: ${line}`);
  }
});

test('Gurmukhi (Punjabi) lines are romanized', () => {
  const out = transliterateLine('ਮੈਨੂੰ ਤੇਰੇ');
  assert.strictEqual(out.romanized, true);
  assert.match(out.text, /^[a-zA-Z ]+$/);
  assert.ok(out.text.length > 0);
});

test('Devanagari (Hindi) lines are romanized', () => {
  const out = transliterateLine('नमस्ते दुनिया');
  assert.strictEqual(out.romanized, true);
  assert.match(out.text, /^[a-zA-Z ]+$/);
});

test('Cyrillic, Kana and Hangul lines are romanized', () => {
  for (const line of ['Привет мир', 'こんにちは', '사랑해']) {
    const out = transliterateLine(line);
    assert.strictEqual(out.romanized, true, line);
    assert.match(out.text, /^[a-zA-Z ]+$/, line);
  }
});

test('unsupported scripts (Han ideographs) are preserved verbatim, never stripped', () => {
  const line = '漢字テスト mixed with English';
  const out = transliterateLine(line);
  assert.strictEqual(out.romanized, false);
  assert.strictEqual(out.text, line);
});

test('mixed unsupported-script lines keep their original text', () => {
  const line = '漢字 only line';
  const out = transliterateLine(line);
  assert.strictEqual(out.romanized, false);
  assert.strictEqual(out.text, '漢字 only line');
});

test('toRomanEnglish maps every line through the same contract', () => {
  const text = 'Hello\nਮੈਨੂੰ\n漢字';
  const out = toRomanEnglish(text);
  const parts = out.split('\n');
  assert.strictEqual(parts[0], 'Hello');
  assert.match(parts[1], /^[a-zA-Z]+$/);
  assert.strictEqual(parts[2], '漢字');
});

test('empty input is handled without throwing', () => {
  assert.deepStrictEqual(transliterateLine(''), { text: '', romanized: false });
  assert.strictEqual(toRomanEnglish(''), '');
});
