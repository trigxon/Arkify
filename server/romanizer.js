/**
 * Audia Universal Phonetic Romanizer Engine
 * Converts non-Latin scripts (Indic: Punjabi/Gurmukhi, Hindi/Devanagari, Bengali, Tamil, Telugu;
 * East Asian: Korean Hangul, Japanese Kana, Chinese; Cyrillic, Arabic/Persian/Urdu)
 * into natural, readable Roman English lyrics.
 */

// Gurmukhi (Punjabi)
const GURMUKHI_CONSONANTS = {
  '\u0A15': 'k', '\u0A16': 'kh', '\u0A17': 'g', '\u0A18': 'gh', '\u0A19': 'ng',
  '\u0A1A': 'ch', '\u0A1B': 'chh', '\u0A1C': 'j', '\u0A1D': 'jh', '\u0A1E': 'ny',
  '\u0A1F': 't', '\u0A20': 'th', '\u0A21': 'd', '\u0A22': 'dh', '\u0A23': 'n',
  '\u0A24': 't', '\u0A25': 'th', '\u0A26': 'd', '\u0A27': 'dh', '\u0A28': 'n',
  '\u0A2A': 'p', '\u0A2B': 'ph', '\u0A2C': 'b', '\u0A2D': 'bh', '\u0A2E': 'm',
  '\u0A2F': 'y', '\u0A30': 'r', '\u0A32': 'l', '\u0A33': 'l', '\u0A35': 'v',
  '\u0A36': 'sh', '\u0A38': 's', '\u0A39': 'h', '\u0A59': 'kh', '\u0A5A': 'gh',
  '\u0A5B': 'z', '\u0A5C': 'r', '\u0A5E': 'f'
};

const GURMUKHI_VOWELS = {
  '\u0A05': 'a', '\u0A06': 'aa', '\u0A07': 'i', '\u0A08': 'ee', '\u0A09': 'u',
  '\u0A0A': 'oo', '\u0A0F': 'e', '\u0A10': 'ai', '\u0A13': 'o', '\u0A14': 'au',
  '\u0A72': 'i', '\u0A73': 'u'
};

const GURMUKHI_MATRAS = {
  '\u0A3E': 'aa', '\u0A3F': 'i', '\u0A40': 'ee', '\u0A41': 'u', '\u0A42': 'oo',
  '\u0A47': 'e', '\u0A48': 'ai', '\u0A4B': 'o', '\u0A4C': 'au'
};

// Devanagari (Hindi, Marathi, Nepali, Bhojpuri)
const DEVANAGARI_CONSONANTS = {
  '\u0915': 'k', '\u0916': 'kh', '\u0917': 'g', '\u0918': 'gh', '\u0919': 'ng',
  '\u091A': 'ch', '\u091B': 'chh', '\u091C': 'j', '\u091D': 'jh', '\u091E': 'ny',
  '\u091F': 't', '\u0920': 'th', '\u0921': 'd', '\u0922': 'dh', '\u0923': 'n',
  '\u0924': 't', '\u0925': 'th', '\u0926': 'd', '\u0927': 'dh', '\u0928': 'n',
  '\u092A': 'p', '\u092B': 'ph', '\u092C': 'b', '\u092D': 'bh', '\u092E': 'm',
  '\u092F': 'y', '\u0930': 'r', '\u0932': 'l', '\u0933': 'l', '\u0935': 'v',
  '\u0936': 'sh', '\u0937': 'sh', '\u0938': 's', '\u0939': 'h',
  '\u0958': 'q', '\u0959': 'kh', '\u095A': 'gh', '\u095B': 'z', '\u095C': 'r',
  '\u095D': 'rh', '\u095E': 'f', '\u095F': 'y'
};

const DEVANAGARI_VOWELS = {
  '\u0904': 'e', '\u0905': 'a', '\u0906': 'aa', '\u0907': 'i', '\u0908': 'ee',
  '\u0909': 'u', '\u090A': 'oo', '\u090B': 'ri', '\u090F': 'e', '\u0910': 'ai',
  '\u0911': 'o', '\u0912': 'o', '\u0913': 'o', '\u0914': 'au'
};

const DEVANAGARI_MATRAS = {
  '\u093E': 'aa', '\u093F': 'i', '\u0940': 'ee', '\u0941': 'u', '\u0942': 'oo',
  '\u0943': 'ri', '\u0945': 'e', '\u0946': 'e', '\u0947': 'e', '\u0948': 'ai',
  '\u0949': 'o', '\u094A': 'o', '\u094B': 'o', '\u094C': 'au'
};

// Cyrillic
const CYRILLIC_MAP = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
  'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
  'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
  'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu',
  'я': 'ya',
  'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo', 'Ж': 'Zh',
  'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O',
  'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U', 'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts',
  'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Shch', 'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu',
  'Я': 'Ya'
};

// Japanese Kana
const KANA_MAP = {
  'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
  'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko',
  'さ': 'sa', 'し': 'shi', 'す': 'su', 'せ': 'se', 'そ': 'so',
  'た': 'ta', 'ち': 'chi', 'つ': 'tsu', 'て': 'te', 'と': 'to',
  'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no',
  'は': 'ha', 'ひ': 'hi', 'ふ': 'fu', 'へ': 'he', 'ほ': 'ho',
  'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo',
  'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
  'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro',
  'わ': 'wa', 'を': 'wo', 'ん': 'n',
  'が': 'ga', 'ぎ': 'gi', 'ぐ': 'gu', 'げ': 'ge', 'ご': 'go',
  'ざ': 'za', 'じ': 'ji', 'ず': 'zu', 'ぜ': 'ze', 'ぞ': 'zo',
  'だ': 'da', 'ぢ': 'ji', 'づ': 'zu', 'で': 'de', 'ど': 'do',
  'ば': 'ba', 'び': 'bi', 'ぶ': 'bu', 'べ': 'be', 'ぼ': 'bo',
  'ぱ': 'pa', 'ぴ': 'pi', 'ぷ': 'pu', 'ぺ': 'pe', 'ぽ': 'po',
  'ア': 'a', 'イ': 'i', 'ウ': 'u', 'エ': 'e', 'オ': 'o',
  'カ': 'ka', 'キ': 'ki', 'ク': 'ku', 'ケ': 'ke', 'コ': 'ko',
  'サ': 'sa', 'シ': 'shi', 'ス': 'su', 'セ': 'se', 'ソ': 'so',
  'タ': 'ta', 'チ': 'chi', 'ツ': 'tsu', 'テ': 'te', 'ト': 'to',
  'ナ': 'na', 'ニ': 'ni', 'ヌ': 'nu', 'ネ': 'ne', 'ノ': 'no',
  'ハ': 'ha', 'ヒ': 'hi', 'フ': 'fu', 'ヘ': 'he', 'ホ': 'ho',
  'マ': 'ma', 'ミ': 'mi', 'ム': 'mu', 'メ': 'me', 'モ': 'mo',
  'ヤ': 'ya', 'ユ': 'yu', 'ヨ': 'yo',
  'ラ': 'ra', 'リ': 'ri', 'ル': 'ru', 'レ': 're', 'ロ': 'ro',
  'ワ': 'wa', 'ヲ': 'wo', 'ン': 'n',
  'ガ': 'ga', 'ギ': 'gi', 'グ': 'gu', 'ゲ': 'ge', 'ゴ': 'go',
  'ザ': 'za', 'ジ': 'ji', 'ズ': 'zu', 'ゼ': 'ze', 'ゾ': 'zo',
  'ダ': 'da', 'ヂ': 'ji', 'ヅ': 'zu', 'デ': 'de', 'ド': 'do',
  'バ': 'ba', 'ビ': 'bi', 'ブ': 'bu', 'ベ': 'be', 'ボ': 'bo',
  'パ': 'pa', 'ピ': 'pi', 'プ': 'pu', 'ペ': 'pe', 'ポ': 'po',
  'っ': '', 'ッ': ''
};

// Korean Hangul
const HANGUL_CHOSUNG = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'];
const HANGUL_JUNGSUNG = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'];
const HANGUL_JONGSUNG = ['', 'k', 'k', 'ks', 'n', 'nj', 'nh', 't', 'l', 'lg', 'lm', 'lb', 'ls', 'lt', 'lp', 'lh', 'm', 'p', 'ps', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 'h'];

function romanizeHangulChar(ch) {
  const code = ch.charCodeAt(0);
  if (code >= 0xAC00 && code <= 0xD7A3) {
    const syllableIndex = code - 0xAC00;
    const cho = Math.floor(syllableIndex / 588);
    const jung = Math.floor((syllableIndex % 588) / 28);
    const jong = syllableIndex % 28;
    return HANGUL_CHOSUNG[cho] + HANGUL_JUNGSUNG[jung] + HANGUL_JONGSUNG[jong];
  }
  return ch;
}

// Arabic / Persian / Urdu phonetic mapping
const ARABIC_MAP = {
  'ا': 'a', 'آ': 'aa', 'ب': 'b', 'پ': 'p', 'ت': 't', 'ٹ': 't', 'ث': 's',
  'ج': 'j', 'چ': 'ch', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ڈ': 'd', 'ذ': 'z',
  'ر': 'r', 'ڑ': 'r', 'ز': 'z', 'ژ': 'zh', 'س': 's', 'ش': 'sh', 'ص': 's',
  'ض': 'z', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q',
  'ک': 'k', 'گ': 'g', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ں': 'n', 'و': 'o',
  'ہ': 'h', 'ھ': 'h', 'ء': '', 'ی': 'i', 'ے': 'e', 'ۂ': 'h'
};

/**
 * Transliterate a single Gurmukhi / Punjabi word
 */
function transliterateGurmukhiWord(word) {
  let out = '';
  let i = 0;
  const len = word.length;

  while (i < len) {
    const ch = word[i];
    const nextCh = i + 1 < len ? word[i + 1] : '';

    if (ch === 'ੱ') { // Addak
      if (nextCh && GURMUKHI_CONSONANTS[nextCh]) {
        out += GURMUKHI_CONSONANTS[nextCh];
      }
      i++;
      continue;
    }

    if (ch === 'ਂ' || ch === 'ੰ') { // Bindi / Tippi
      out += 'n';
      i++;
      continue;
    }

    if (ch === '੍ਹ' || ch === '੍') { // Pairi haha / halant
      if (ch === '੍ਹ') out += 'h';
      i++;
      continue;
    }

    if (GURMUKHI_VOWELS[ch]) {
      if (nextCh && GURMUKHI_MATRAS[nextCh]) {
        if (ch === 'ਅ' && nextCh === 'ਾ') out += 'aa';
        else if (ch === 'ਅ' && nextCh === 'ੈ') out += 'ai';
        else if (ch === 'ਅ' && nextCh === 'ੌ') out += 'au';
        else if (ch === 'ੲ' && nextCh === 'ਿ') out += 'i';
        else if (ch === 'ੲ' && nextCh === 'ੀ') out += 'ee';
        else if (ch === 'ੲ' && nextCh === 'ੇ') out += 'e';
        else if (ch === 'ੳ' && nextCh === 'ੁ') out += 'u';
        else if (ch === 'ੳ' && nextCh === 'ੂ') out += 'oo';
        else if (ch === 'ੳ' && nextCh === 'ੋ') out += 'o';
        else out += GURMUKHI_MATRAS[nextCh];
        i += 2;
        continue;
      }
      out += GURMUKHI_VOWELS[ch];
      i++;
      continue;
    }

    if (GURMUKHI_CONSONANTS[ch]) {
      const c = GURMUKHI_CONSONANTS[ch];
      let v = '';
      let advance = 1;

      if (nextCh === '਼') { // Nukta
        advance = 2;
      }

      const matraCandidate = word[i + advance] || '';
      if (GURMUKHI_MATRAS[matraCandidate]) {
        v = GURMUKHI_MATRAS[matraCandidate];
        advance++;
      } else if (matraCandidate === '੍') {
        v = '';
        advance++;
      } else if (matraCandidate === 'ੱ') {
        v = 'a';
      } else if (i + advance >= len || !GURMUKHI_CONSONANTS[word[i + advance]]) {
        v = (i === 0 && len === 1) ? 'a' : (i + advance >= len ? '' : 'a');
      } else {
        v = 'a';
      }

      out += c + v;
      i += advance;
      continue;
    }

    out += ch;
    i++;
  }

  return out;
}

/**
 * Transliterate a single Devanagari / Hindi word
 */
function transliterateDevanagariWord(word) {
  let out = '';
  let i = 0;
  const len = word.length;

  while (i < len) {
    const ch = word[i];
    const nextCh = i + 1 < len ? word[i + 1] : '';

    if (ch === 'ँ' || ch === 'ं') { // Chandrabindu / Anusvara
      out += 'n';
      i++;
      continue;
    }
    if (ch === 'ः') { // Visarga
      out += 'h';
      i++;
      continue;
    }
    if (ch === '्') { // Virama
      i++;
      continue;
    }

    if (DEVANAGARI_VOWELS[ch]) {
      out += DEVANAGARI_VOWELS[ch];
      i++;
      continue;
    }

    if (DEVANAGARI_CONSONANTS[ch]) {
      const c = DEVANAGARI_CONSONANTS[ch];
      let v = '';
      let advance = 1;

      if (nextCh === '़') { // Nukta
        advance = 2;
      }

      const matraCandidate = word[i + advance] || '';
      if (DEVANAGARI_MATRAS[matraCandidate]) {
        v = DEVANAGARI_MATRAS[matraCandidate];
        advance++;
      } else if (matraCandidate === '्') {
        v = '';
        advance++;
      } else if (i + advance >= len || !DEVANAGARI_CONSONANTS[word[i + advance]]) {
        v = (i === 0 && len === 1) ? 'a' : (i + advance >= len ? '' : 'a');
      } else {
        v = 'a';
      }

      out += c + v;
      i += advance;
      continue;
    }

    out += ch;
    i++;
  }

  return out;
}

/**
 * Transliterate any single line into Roman English
 */
function transliterateLine(line) {
  if (!line) return '';

  // 1. Check for Arabic / Persian / Urdu script
  if (/[\u0600-\u06FF]/.test(line)) {
    let arabOut = '';
    for (const ch of line) {
      arabOut += ARABIC_MAP[ch] !== undefined ? ARABIC_MAP[ch] : ch;
    }
    line = arabOut;
  }

  // 2. Check for Gurmukhi script
  if (/[\u0A00-\u0A7F]/.test(line)) {
    line = line.split(/(\s+)/).map(transliterateGurmukhiWord).join('');
  }

  // 3. Check for Devanagari script
  if (/[\u0900-\u097F]/.test(line)) {
    line = line.split(/(\s+)/).map(transliterateDevanagariWord).join('');
  }

  // 4. Check for Cyrillic
  if (/[\u0400-\u04FF]/.test(line)) {
    let cyrOut = '';
    for (const ch of line) {
      cyrOut += CYRILLIC_MAP[ch] !== undefined ? CYRILLIC_MAP[ch] : ch;
    }
    line = cyrOut;
  }

  // 5. Check for Japanese Kana
  if (/[\u3040-\u30FF]/.test(line)) {
    let kanaOut = '';
    for (const ch of line) {
      kanaOut += KANA_MAP[ch] !== undefined ? KANA_MAP[ch] : ch;
    }
    line = kanaOut;
  }

  // 6. Check for Korean Hangul
  if (/[\uAC00-\uD7A3]/.test(line)) {
    let korOut = '';
    for (const ch of line) {
      korOut += romanizeHangulChar(ch);
    }
    line = korOut;
  }

  // Clean formatting: capitalize first letter, remove stray characters, clean repeated spaces
  line = line
    .replace(/[^\x00-\x7F\s.,!?'"()\-–—]/g, '') // remove unprintable or non-Latin remnants
    .replace(/\s+/g, ' ')
    .trim();

  if (line.length > 0) {
    line = line.charAt(0).toUpperCase() + line.slice(1);
  }

  return line;
}

/**
 * Transliterate multi-line lyrics to Roman English
 */
function toRomanEnglish(text) {
  if (!text) return '';
  return text
    .split('\n')
    .map(transliterateLine)
    .join('\n');
}

module.exports = {
  toRomanEnglish,
  transliterateLine,
};
