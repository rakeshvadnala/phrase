import type { Change, GrammarIssue, PhraseRule, ToneId } from '../types';
import grammarRules from '../rules/grammar.json';
import professionalRules from '../rules/professional.json';
import politeRules from '../rules/polite.json';
import formalRules from '../rules/formal.json';
import friendlyRules from '../rules/friendly.json';
import conciseRules from '../rules/concise.json';
import { alignWithCapitalization, findCapitalization } from './capitalizationEngine';
import { issuesToChanges } from './grammarEngine';
import { findPhraseChanges } from './phraseEngine';
import { getSentenceRanges, rangesOverlap } from './textUtils';

export interface ToneInfo {
  id: ToneId;
  label: string;
  description: string;
}

export const TONES: ToneInfo[] = [
  { id: 'grammar', label: 'Grammar Correction', description: 'Fix spelling, grammar, punctuation and capitalization only.' },
  { id: 'professional', label: 'Professional', description: 'Replace casual expressions with clear workplace wording.' },
  { id: 'polite', label: 'Polite', description: 'Turn blunt instructions into respectful requests.' },
  { id: 'formal', label: 'Formal', description: 'Expand contractions and prefer formal business expressions.' },
  { id: 'friendly', label: 'Friendly', description: 'Sound approachable while staying professional.' },
  { id: 'concise', label: 'Concise', description: 'Remove filler and wordy phrases without changing the meaning.' },
];

export const toneLabel = (id: ToneId) => TONES.find((t) => t.id === id)?.label ?? id;

/** Built-in rule configuration for each mode. Each mode has its own JSON file. */
export const BUILTIN_RULES: Record<ToneId, PhraseRule[]> = {
  grammar: grammarRules as unknown as PhraseRule[],
  professional: professionalRules as unknown as PhraseRule[],
  polite: politeRules as unknown as PhraseRule[],
  formal: formalRules as unknown as PhraseRule[],
  friendly: friendlyRules as unknown as PhraseRule[],
  concise: conciseRules as unknown as PhraseRule[],
};

export const ALL_BUILTIN_RULES: PhraseRule[] = Object.values(BUILTIN_RULES).flat();

/** User rules outrank built-in rules of the same tone. */
const CUSTOM_PRIORITY_BOOST = 200;

/**
 * Rules active for a mode: the mode's own rules, the shared grammar-slip
 * rules, and any user-defined rules for that mode (or for "grammar", which
 * apply everywhere).
 */
export function getRulesForTone(tone: ToneId, customRules: PhraseRule[] = []): PhraseRule[] {
  const builtin = tone === 'grammar' ? BUILTIN_RULES.grammar : [...BUILTIN_RULES[tone], ...BUILTIN_RULES.grammar];
  const custom = customRules
    .filter((r) => r.tone === tone || r.tone === 'grammar')
    .map((r) => ({ ...r, custom: true, priority: r.priority + CUSTOM_PRIORITY_BOOST }));
  return [...custom, ...builtin];
}

/** Concise mode: flags a sentence that repeats an earlier one word-for-word. */
export function findRepeatedSentences(text: string): Change[] {
  const seen = new Set<string>();
  const changes: Change[] = [];
  for (const r of getSentenceRanges(text)) {
    const sentence = text.slice(r.start, r.end);
    const key = sentence.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    if (key.split(' ').length < 3) continue;
    if (!seen.has(key)) {
      seen.add(key);
      continue;
    }
    let start = r.start;
    let end = r.end;
    const trailing = /^[ \t]+/.exec(text.slice(end))?.[0].length ?? 0;
    if (trailing > 0) end += trailing;
    else start -= /[ \t]+$/.exec(text.slice(0, start))?.[0].length ?? 0;
    changes.push({
      id: `c:${r.start}:repeat`,
      source: 'cleanup',
      label: 'Repetition',
      message: 'This sentence repeats an earlier one and can be removed.',
      start,
      end,
      originalText: text.slice(start, end),
      options: [{ text: '', start, end }],
      defaultOption: 0,
      priority: 500,
    });
  }
  return changes;
}

export interface AnalyzeInput {
  text: string;
  tone: ToneId;
  /** Issues reported by the grammar checker for `text` (may be empty if it is unavailable). */
  issues?: GrammarIssue[];
  customRules?: PhraseRule[];
  dictionary?: string[];
}

/**
 * Produces every proposed change for a message in the chosen mode.
 * Nothing is applied here: the caller decides which changes to accept.
 */
export function analyzeText({ text, tone, issues = [], customRules = [], dictionary = [] }: AnalyzeInput): Change[] {
  if (!text.trim()) return [];
  const cleanup = tone === 'concise' ? findRepeatedSentences(text) : [];
  const phrase = findPhraseChanges(text, getRulesForTone(tone, customRules)).filter(
    (p) => !cleanup.some((c) => rangesOverlap(c, p)),
  );
  const grammar = issuesToChanges(text, issues, dictionary);
  const cap = findCapitalization(text, issues, dictionary);
  return [...cleanup, ...alignWithCapitalization([...phrase, ...grammar], cap), ...cap.changes].sort((a, b) => a.start - b.start || b.priority - a.priority);
}
