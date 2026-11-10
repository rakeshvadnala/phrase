import type { GrammarIssue } from '../types';

/**
 * Spelling policy.
 *
 * Harper reports unknown words together with dictionary look-alikes. Those
 * look-alikes are frequently wrong for names and technical terms
 * ("kubectl" -> "puberty"), so a spelling suggestion is only pre-selected
 * when it is unambiguous. Everything else is listed for the user to decide.
 */

export const SPELLING_KIND = 'Spelling';

export function isSpellingIssue(issue: Pick<GrammarIssue, 'kind'>): boolean {
  return issue.kind === SPELLING_KIND;
}

/** Classic Levenshtein edit distance (two-row implementation). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/** Words that look like names, acronyms, identifiers or codes are never auto-corrected. */
export function looksLikeTechnicalTerm(word: string): boolean {
  return /\p{Lu}/u.test(word) || /[\d_@/\\.]/.test(word);
}

/**
 * Returns the index of the suggestion that is safe to pre-select for a
 * spelling issue, or -1 when the user should choose.
 */
export function pickSpellingDefault(issue: GrammarIssue): number {
  const word = issue.problemText;
  const candidates = issue.suggestions;
  if (candidates.length === 0 || looksLikeTechnicalTerm(word)) return -1;
  if (candidates.some((s) => s.kind !== 'replace')) return -1;

  // A missing apostrophe ("dont" -> "don't") or capital ("monday" -> "Monday") is unambiguous.
  const strip = (s: string) => s.replace(/['’]/g, '');
  const apostrophe = candidates.findIndex((s) => s.text !== word && strip(s.text) === word);
  if (apostrophe >= 0) return apostrophe;
  const caseOnly = candidates.findIndex((s) => s.text !== word && s.text.toLowerCase() === word.toLowerCase());
  if (caseOnly >= 0) return caseOnly;

  if (candidates.length === 1) return levenshtein(word, candidates[0].text) <= 2 ? 0 : -1;

  // Otherwise require exactly one candidate at edit distance 1.
  const close = candidates.map((s, i) => ({ i, d: levenshtein(word.toLowerCase(), s.text.toLowerCase()) })).filter((c) => c.d === 1);
  return close.length === 1 ? close[0].i : -1;
}

/** Removes spelling issues for words the user has added to their personal dictionary. */
export function filterIgnoredWords(issues: GrammarIssue[], dictionary: string[]): GrammarIssue[] {
  if (dictionary.length === 0) return issues;
  const known = new Set(dictionary.map((w) => w.toLowerCase()));
  return issues.filter((issue) => !(isSpellingIssue(issue) && known.has(issue.problemText.toLowerCase())));
}

/** Normalises a word before it is stored in the personal dictionary. */
export function normaliseDictionaryWord(word: string): string {
  return word.trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}
