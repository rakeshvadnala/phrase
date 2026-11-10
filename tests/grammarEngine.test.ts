import { beforeAll, describe, expect, it } from 'vitest';
import { applyChanges } from '../src/engine/changes';
import { issuesToChanges, type GrammarChecker } from '../src/engine/grammarEngine';
import { filterIgnoredWords, levenshtein, pickSpellingDefault } from '../src/engine/spellingEngine';
import { analyzeText } from '../src/engine/toneEngine';
import type { GrammarIssue } from '../src/types';
import { getTestChecker } from './helpers';

/** Integration tests against the real Harper WebAssembly engine (no network). */
describe('grammar checking integration (Harper)', () => {
  let checker: GrammarChecker;
  beforeAll(async () => {
    checker = await getTestChecker();
  }, 120_000);

  const find = (issues: GrammarIssue[], text: string) => issues.find((i) => i.problemText === text);

  it('returns no issues for empty input', async () => {
    expect(await checker.check('')).toEqual([]);
    expect(await checker.check('   \n ')).toEqual([]);
  });

  it('returns no issues for a clean sentence', async () => {
    expect(await checker.check('The report is ready for your review.')).toEqual([]);
  });

  it('detects spelling mistakes with suggestions', async () => {
    const issues = await checker.check('We will meet tomorow to discuss the plan.');
    const issue = find(issues, 'tomorow')!;
    expect(issue.kind).toBe('Spelling');
    expect(issue.suggestions.map((s) => s.text)).toContain('tomorrow');
  });

  it('detects grammar mistakes', async () => {
    const issues = await checker.check('This is an test of the system.');
    expect(find(issues, 'an')?.suggestions[0]).toEqual({ kind: 'replace', text: 'a' });
  });

  it('detects punctuation issues', async () => {
    const issues = await checker.check('I checked the logs,and they look fine.');
    const issue = issues.find((i) => i.kind === 'Punctuation')!;
    expect(issue.suggestions[0]).toEqual({ kind: 'insertAfter', text: ' ' });
  });

  it('detects capitalization issues', async () => {
    const issues = await checker.check('Yesterday i sent the file.');
    const issue = find(issues, 'i')!;
    expect(issue.kind).toBe('Capitalization');
    expect(issue.suggestions[0].text).toBe('I');
  });

  it('reports spans that address the original text exactly', async () => {
    const text = '😀 Their going to teh office, and i dont no what happend on on monday.';
    const issues = await checker.check(text);
    expect(issues.length).toBeGreaterThan(3);
    for (const issue of issues) expect(text.slice(issue.start, issue.end)).toBe(issue.problemText);
  });

  it('produces a corrected text without touching the original', async () => {
    const text = 'This is an test. Yesterday i has went to teh office,and it was was closed.';
    const issues = await checker.check(text);
    const changes = issuesToChanges(text, issues);
    const result = applyChanges(text, changes);
    expect(result.text).toBe('This is a test. Yesterday I have gone to the office, and it was closed.');
    expect(text).toContain('an test');
  });

  it('lets individual corrections be applied or rejected', async () => {
    const text = 'This is an test of teh system.';
    const changes = issuesToChanges(text, await checker.check(text));
    const article = changes.find((c) => c.originalText === 'an')!;
    const typo = changes.find((c) => c.originalText === 'teh')!;
    expect(applyChanges(text, changes, { [typo.id]: -1 }).text).toBe('This is a test of teh system.');
    expect(applyChanges(text, changes, { [article.id]: -1 }).text).toBe('This is an test of the system.');
  });

  it('does not auto-correct names and technical terms', async () => {
    const text = 'Rakesh deployed kubectl on the server.';
    const changes = issuesToChanges(text, await checker.check(text));
    expect(applyChanges(text, changes).text).toBe(text);
    const flagged = changes.filter((c) => c.kind === 'Spelling');
    expect(flagged.length).toBeGreaterThan(0);
    for (const c of flagged) expect(c.defaultOption).toBe(-1);
  });

  it('respects the personal dictionary', async () => {
    const text = 'Rakesh deployed kubectl on the server.';
    const issues = await checker.check(text);
    expect(issuesToChanges(text, issues, ['rakesh', 'kubectl']).filter((c) => c.kind === 'Spelling')).toEqual([]);
    await checker.setDictionary(['kubectl']);
    const after = await checker.check(text);
    expect(after.some((i) => i.problemText === 'kubectl')).toBe(false);
    await checker.setDictionary([]);
  });

  it('ignores issues inside URLs, e-mail addresses and code', async () => {
    const text = 'Open https://exampel.com/teh/path or mail teh@exampel.com and run `teh comand`.';
    const changes = issuesToChanges(text, await checker.check(text));
    expect(applyChanges(text, changes).text).toBe(text);
  });

  it('combines grammar corrections with phrase rules, phrase rules winning overlaps', async () => {
    const text = 'i want to know teh status. Please do the needful.';
    const changes = analyzeText({ text, tone: 'professional', issues: await checker.check(text) });
    expect(applyChanges(text, changes).text).toBe(
      'I would like to understand the status. Could you please take the necessary action?',
    );
  });

  it('handles long input', async () => {
    const text = 'This is an test of teh system. '.repeat(400); // ~12,400 characters
    const issues = await checker.check(text);
    expect(issues.length).toBeGreaterThanOrEqual(800);
  });
});

describe('spelling policy', () => {
  const issue = (word: string, ...suggestions: string[]): GrammarIssue => ({
    start: 0, end: word.length, problemText: word, kind: 'Spelling', kindLabel: 'Spelling', message: '',
    suggestions: suggestions.map((text) => ({ kind: 'replace' as const, text })),
  });

  it('computes edit distance', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('same', 'same')).toBe(0);
  });

  it('pre-selects only unambiguous corrections', () => {
    expect(pickSpellingDefault(issue('tomorow', 'tomorrow', 'tomorrows', 'Comoros'))).toBe(0);
    expect(pickSpellingDefault(issue('dont', "don't", 'dent', 'don'))).toBe(0);
    expect(pickSpellingDefault(issue('monday', 'Monday', 'midday'))).toBe(0);
    expect(pickSpellingDefault(issue('happend', 'happen', 'happened', 'happens'))).toBe(-1);
    expect(pickSpellingDefault(issue('kubectl', 'puberty', 'subject'))).toBe(-1);
    expect(pickSpellingDefault(issue('Rakesh', 'Rakes', 'Rakish'))).toBe(-1);
    expect(pickSpellingDefault(issue('xyzzy'))).toBe(-1);
  });

  it('filters words from the personal dictionary case-insensitively', () => {
    const issues = [issue('Kubectl', 'x'), issue('teh', 'the')];
    expect(filterIgnoredWords(issues, ['kubectl']).map((i) => i.problemText)).toEqual(['teh']);
  });
});
