import type { BinaryModule, Lint, Linter } from 'harper.js';
import type { Change, ChangeOption, DialectSetting, GrammarIssue, GrammarSuggestion } from '../types';
import { filterIgnoredWords, isSpellingIssue, pickSpellingDefault } from './spellingEngine';
import { findProtectedSpans, rangesOverlap } from './textUtils';

/**
 * Grammar checking, powered by Harper (https://writewithharper.com).
 * Harper is a rule-based checker compiled to WebAssembly; it runs entirely
 * on this device and never contacts a server.
 */

export interface GrammarChecker {
  check(text: string): Promise<GrammarIssue[]>;
  setDialect(dialect: DialectSetting): Promise<void>;
  /** Replaces the personal dictionary (words that should not be flagged). */
  setDictionary(words: string[]): Promise<void>;
  dispose(): Promise<void>;
}

export interface GrammarCheckerOptions {
  dialect?: DialectSetting;
  /** Run Harper in a Web Worker so long texts never block the UI (browser only). */
  useWorker?: boolean;
  /** Override the WebAssembly binary (used by the Node test-suite). */
  binary?: BinaryModule;
}

const SUGGESTION_KINDS: GrammarSuggestion['kind'][] = ['replace', 'remove', 'insertAfter'];

function release(obj: { free?: () => void } | null | undefined) {
  try {
    obj?.free?.();
  } catch {
    /* already released */
  }
}

/** Converts Harper's WebAssembly-backed lints into plain serialisable data. */
export function lintsToIssues(text: string, lints: Lint[]): GrammarIssue[] {
  const issues: GrammarIssue[] = [];
  for (const lint of lints) {
    try {
      const span = lint.span();
      let start = span.start;
      let end = span.end;
      release(span);
      const problemText = lint.get_problem_text();
      // Defensive: make sure the reported span really addresses the reported text.
      if (text.slice(start, end) !== problemText) {
        const near = text.indexOf(problemText, Math.max(0, start - 8));
        if (problemText && near >= 0 && near - start <= 16) {
          start = near;
          end = near + problemText.length;
        } else {
          continue;
        }
      }
      const suggestions: GrammarSuggestion[] = [];
      for (const s of lint.suggestions()) {
        const kind = SUGGESTION_KINDS[s.kind() as number] ?? 'replace';
        const replacement = kind === 'remove' ? '' : s.get_replacement_text();
        release(s);
        if (!suggestions.some((x) => x.kind === kind && x.text === replacement)) suggestions.push({ kind, text: replacement });
      }
      issues.push({
        start,
        end,
        problemText,
        kind: lint.lint_kind(),
        kindLabel: lint.lint_kind_pretty(),
        message: lint.message(),
        suggestions: suggestions.slice(0, 6),
      });
    } finally {
      release(lint);
    }
  }
  return issues.sort((a, b) => a.start - b.start || a.end - b.end);
}

export async function createGrammarChecker(options: GrammarCheckerOptions = {}): Promise<GrammarChecker> {
  const harper = await import('harper.js');
  const binary = options.binary ?? (await import('harper.js/slimBinary')).slimBinary;
  const toDialect = (d: DialectSetting | undefined) => harper.Dialect[d ?? 'American'] ?? harper.Dialect.American;

  const init = { binary, dialect: toDialect(options.dialect) };
  const linter: Linter = options.useWorker ? new harper.WorkerLinter(init) : new harper.LocalLinter(init);
  await linter.setup();

  return {
    async check(text) {
      if (!text.trim()) return [];
      const lints = await linter.lint(text, { language: 'plaintext' });
      return lintsToIssues(text, lints);
    },
    async setDialect(dialect) {
      await linter.setDialect(toDialect(dialect));
    },
    async setDictionary(words) {
      await linter.clearWords();
      if (words.length) await linter.importWords(words);
    },
    dispose: () => linter.dispose(),
  };
}

let shared: Promise<GrammarChecker> | null = null;

/** Lazily creates the single worker-backed checker used by the UI. */
export function getGrammarChecker(dialect?: DialectSetting): Promise<GrammarChecker> {
  if (!shared) {
    shared = createGrammarChecker({ dialect, useWorker: typeof Worker !== 'undefined' });
    shared.catch(() => {
      shared = null; // allow a retry after a failed load
    });
  }
  return shared;
}

/** Lint kinds that are pre-selected. Stylistic kinds are opt-in. */
const AUTO_APPLY_KINDS = new Set([
  'Agreement', 'BoundaryError', 'Capitalization', 'Eggcorn', 'Formatting', 'Grammar', 'Malapropism', 'Miscellaneous',
  'Nonstandard', 'Punctuation', 'Redundancy', 'Repetition', 'Typo', 'Usage', 'WordChoice', 'WordOrder',
]);

const UNTOUCHABLE = new Set(['url', 'email', 'code', 'identifier', 'mention', 'file']);

/**
 * Turns grammar issues into selectable changes against the original text.
 * Issues inside URLs, e-mail addresses, code and identifiers are discarded.
 */
export function issuesToChanges(text: string, issues: GrammarIssue[], dictionary: string[] = []): Change[] {
  const untouchable = findProtectedSpans(text).filter((s) => UNTOUCHABLE.has(s.type));
  return filterIgnoredWords(issues, dictionary)
    .filter((issue) => !untouchable.some((s) => rangesOverlap(s, issue)))
    .map((issue, index) => {
      const options: ChangeOption[] = issue.suggestions.map((s) =>
        s.kind === 'insertAfter'
          ? { text: s.text, start: issue.end, end: issue.end }
          : { text: s.text, start: issue.start, end: issue.end },
      );
      let defaultOption = -1;
      if (options.length > 0) {
        if (isSpellingIssue(issue)) defaultOption = pickSpellingDefault(issue);
        else if (AUTO_APPLY_KINDS.has(issue.kind)) defaultOption = 0;
      }
      return {
        id: `g:${issue.start}:${issue.end}:${index}`,
        source: 'grammar' as const,
        label: issue.kindLabel || issue.kind,
        message: issue.message,
        start: issue.start,
        end: issue.end,
        originalText: text.slice(issue.start, issue.end),
        options,
        defaultOption,
        priority: 10,
        kind: issue.kind,
      };
    });
}
