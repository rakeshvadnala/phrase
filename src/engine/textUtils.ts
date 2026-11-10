/** Shared, dependency-free text helpers used by every engine. */

export interface Range {
  start: number;
  end: number;
}

export interface ProtectedSpan extends Range {
  type: 'url' | 'email' | 'code' | 'quote' | 'mention' | 'identifier' | 'number' | 'file';
}

const WORD_RE = /[\p{L}\p{N}]+(?:['’.\-@/_:][\p{L}\p{N}]+)*/gu;

export function countCharacters(text: string): number {
  // Count user-perceived code points rather than UTF-16 units.
  let n = 0;
  for (const _ of text) n++;
  return n;
}

export function countWords(text: string): number {
  return text.match(WORD_RE)?.length ?? 0;
}

const ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'vs', 'etc', 'e.g', 'i.e', 'eg', 'ie', 'no', 'inc', 'ltd', 'co', 'approx', 'dept', 'fig', 'est',
]);

/**
 * Splits text into sentence ranges (trailing whitespace excluded).
 * Line breaks always end a sentence; a full stop after a known abbreviation
 * or a single initial ("J. Smith") does not.
 */
export function getSentenceRanges(text: string): Range[] {
  const ranges: Range[] = [];
  const boundary = /[.!?]+["'”’)\]]*(?=\s|$)|\n+/g;
  let start = 0;
  const push = (end: number) => {
    let s = start;
    while (s < end && /\s/.test(text[s])) s++;
    let e = end;
    while (e > s && /\s/.test(text[e - 1])) e--;
    if (e > s) ranges.push({ start: s, end: e });
  };
  let m: RegExpExecArray | null;
  while ((m = boundary.exec(text))) {
    if (m[0][0] === '.') {
      const before = /([\p{L}.]+)$/u.exec(text.slice(start, m.index))?.[1] ?? '';
      const isInitial = /^\p{Lu}$/u.test(before);
      if (m[0].length === 1 && (ABBREVIATIONS.has(before.toLowerCase()) || isInitial) && m.index + 1 < text.length) continue;
    }
    push(m.index + (m[0][0] === '\n' ? 0 : m[0].length));
    start = m.index + m[0].length;
  }
  push(text.length);
  return ranges;
}

export function countSentences(text: string): number {
  return getSentenceRanges(text).filter((r) => /[\p{L}\p{N}]/u.test(text.slice(r.start, r.end))).length;
}

/** True when `index` is the first non-space position of a sentence. */
export function isSentenceStart(text: string, index: number): boolean {
  let i = index - 1;
  while (i >= 0 && (text[i] === ' ' || text[i] === '\t')) i--;
  if (i < 0) return true;
  const ch = text[i];
  if (ch === '\n' || ch === '\r') return true;
  // Skip closing quotes/brackets, then look for sentence-ending punctuation.
  while (i >= 0 && /["'”’)\]]/.test(text[i])) i--;
  if (i < 0) return true;
  if (!/[.!?:]/.test(text[i])) return false;
  if (text[i] === ':') return false;
  if (text[i] === '.') {
    const before = /([\p{L}.]+)$/u.exec(text.slice(Math.max(0, i - 24), i))?.[1] ?? '';
    if (ABBREVIATIONS.has(before.toLowerCase()) || /^\p{Lu}$/u.test(before)) return false;
  }
  return i !== index - 1; // punctuation must be followed by whitespace
}

/** Returns the sentence containing `index` (falls back to the whole text). */
export function sentenceAt(text: string, index: number, ranges = getSentenceRanges(text)): Range {
  // Ranges are sorted and disjoint, so a binary search finds the sentence.
  let lo = 0;
  let hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const r = ranges[mid];
    if (index < r.start) hi = mid - 1;
    else if (index >= r.end) lo = mid + 1;
    else return r;
  }
  return { start: 0, end: text.length };
}

const PROTECTED_PATTERNS: Array<[ProtectedSpan['type'], RegExp]> = [
  ['url', /\b(?:https?:\/\/|www\.)[^\s<>"']{1,2000}[^\s<>"'.,;:!?)]/gi],
  ['email', /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g],
  ['code', /`[^`\n]{1,2000}`/g],
  ['quote', /"[^"\n]{1,300}"|“[^”\n]{1,300}”/g],
  ['mention', /(?<![\w])[@#][\w-]+/g],
  ['file', /\b[\w-]+\.(?:js|jsx|ts|tsx|py|java|cs|go|rb|php|json|xml|csv|xlsx?|pdf|docx?|pptx?|exe|ya?ml|md|txt|log|sql|html?|css|sh|bat|zip|png|jpe?g|svg)\b/gi],
  // snake_case, kebab-with-digits, camelCase / PascalCase identifiers, dotted.names()
  ['identifier', /\b[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+\b|\b[a-z]+[A-Z][A-Za-z0-9]*\b|\b[A-Z][a-z0-9]+[A-Z][A-Za-z0-9]*\b|\b[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+\(\)?/g],
  // numbers, dates, times, versions, ticket ids (ABC-123), amounts
  ['number', /\b[A-Za-z]{1,10}-\d+\b|[$€£₹]?\b\d[\d.,:/-]*\d\b%?|\b\d\b%?|\b[A-Za-z]+\d[\w.-]*\b/g],
];

/** Finds spans that must never be rewritten: URLs, e-mail addresses, code, quotes, identifiers, numbers. */
export function findProtectedSpans(text: string): ProtectedSpan[] {
  const spans: ProtectedSpan[] = [];
  for (const [type, re] of PROTECTED_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (m[0].length === 0) {
        re.lastIndex++;
        continue;
      }
      spans.push({ type, start: m.index, end: m.index + m[0].length });
    }
  }
  return spans.sort((a, b) => a.start - b.start);
}

export function rangesOverlap(a: Range, b: Range): boolean {
  if (a.start === a.end && b.start === b.end) return a.start === b.start;
  if (a.start === a.end) return a.start > b.start && a.start < b.end;
  if (b.start === b.end) return b.start > a.start && b.start < a.end;
  return a.start < b.end && b.start < a.end;
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function capitalizeFirst(s: string): string {
  const i = s.search(/\p{L}/u);
  return i < 0 ? s : s.slice(0, i) + s[i].toUpperCase() + s.slice(i + 1);
}

/** Lower-cases the first letter unless the first word is "I" or looks like an acronym / proper form. */
export function decapitalizeFirst(s: string): string {
  const m = /^(\P{L}*)(\p{L}[\p{L}'’]*)/u.exec(s);
  if (!m) return s;
  const word = m[2];
  if (/^I(?:$|['’])/.test(word)) return s; // I, I'm, I'll, I'd, I've
  if (word.length > 1 && /\p{Lu}/u.test(word.slice(1))) return s; // ASAP, iPhone
  return m[1] + word[0].toLowerCase() + s.slice(m[1].length + 1);
}

export function isAllCaps(s: string): boolean {
  return /\p{L}/u.test(s) && s === s.toUpperCase() && s !== s.toLowerCase();
}

/** Small debounce helper that also exposes cancel(). */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, wait: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const wrapped = (...args: A) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  wrapped.cancel = () => {
    if (timer) clearTimeout(timer);
  };
  return wrapped;
}

export function uid(prefix = ''): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return prefix + rand;
}
