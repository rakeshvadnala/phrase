import { useEffect, useRef, useState } from 'react';
import { getGrammarChecker } from '../engine/grammarEngine';
import type { DialectSetting, GrammarIssue } from '../types';

export type GrammarStatus = 'idle' | 'loading' | 'checking' | 'ready' | 'error';

/** Live checking is paused above this size; "Improve My Message" still checks the full text. */
export const LIVE_CHECK_LIMIT = 20_000;
const DEBOUNCE_MS = 600;

interface LiveCheck {
  /** Issues for `checkedText` (which may lag behind the editor while typing). */
  issues: GrammarIssue[];
  checkedText: string;
  status: GrammarStatus;
}

let appliedDialect: DialectSetting | undefined;
let appliedDictionary: string | undefined;

/** Loads the shared checker and brings its dialect and dictionary up to date. */
export async function prepareChecker(dialect: DialectSetting, dictionary: string[]) {
  const checker = await getGrammarChecker(dialect);
  if (appliedDialect !== dialect) {
    await checker.setDialect(dialect);
    appliedDialect = dialect;
  }
  const key = dictionary.join('\n');
  if (appliedDictionary !== key) {
    await checker.setDictionary(dictionary);
    appliedDictionary = key;
  }
  return checker;
}

/**
 * Debounced, latest-wins grammar checking for the editor. The engine runs in a
 * Web Worker, so typing is never blocked.
 */
export function useGrammarCheck(text: string, enabled: boolean, dialect: DialectSetting, dictionary: string[]): LiveCheck {
  const [state, setState] = useState<LiveCheck>({ issues: [], checkedText: '', status: 'idle' });
  const requestId = useRef(0);
  const loaded = useRef(false);

  useEffect(() => {
    const id = ++requestId.current;
    if (!enabled || !text.trim() || text.length > LIVE_CHECK_LIMIT) {
      setState({ issues: [], checkedText: text, status: 'idle' });
      return;
    }
    const timer = setTimeout(async () => {
      setState((s) => ({ ...s, status: loaded.current ? 'checking' : 'loading' }));
      try {
        const checker = await prepareChecker(dialect, dictionary);
        loaded.current = true;
        if (id !== requestId.current) return;
        setState((s) => ({ ...s, status: 'checking' }));
        const issues = await checker.check(text);
        if (id !== requestId.current) return; // a newer edit superseded this run
        setState({ issues, checkedText: text, status: 'ready' });
      } catch {
        if (id === requestId.current) setState({ issues: [], checkedText: text, status: 'error' });
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, enabled, dialect, dictionary]);

  return state;
}
