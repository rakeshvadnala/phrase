import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActionToolbar } from '../components/ActionToolbar';
import { Editor, type Highlight } from '../components/Editor';
import { ResultPanel } from '../components/ResultPanel';
import { applyChanges } from '../engine/changes';
import { issuesToChanges } from '../engine/grammarEngine';
import { SPELLING_KIND } from '../engine/spellingEngine';
import { analyzeText } from '../engine/toneEngine';
import { useAppState } from '../hooks/useAppState';
import { LIVE_CHECK_LIMIT, prepareChecker, useGrammarCheck } from '../hooks/useGrammarCheck';
import { saveHistoryRecord } from '../storage/historyStorage';
import type { GrammarIssue, Selection } from '../types';

export default function Home() {
  const { text, setText, tone, setTone, result, setResult, settings, customPhrases, dictionary, addWord } = useAppState();
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('Improving…');
  const results = useRef<HTMLDivElement>(null);
  const scrollNext = useRef(false);

  const live = useGrammarCheck(text, settings.liveGrammarCheck, settings.dialect, dictionary);
  const liveCheckPaused = text.length > LIVE_CHECK_LIMIT;

  // Underline live issues only while they still describe the current text.
  const highlights = useMemo<Highlight[]>(() => {
    if (live.checkedText !== text || live.issues.length === 0) return [];
    return issuesToChanges(text, live.issues, dictionary).map((c) => ({ start: c.start, end: c.end, spelling: c.kind === SPELLING_KIND }));
  }, [live, text, dictionary]);

  const improve = useCallback(async () => {
    const source = text;
    if (!source.trim() || busy) return;
    setBusy(true);
    setBusyLabel(live.status === 'idle' || live.status === 'loading' ? 'Loading grammar engine…' : 'Improving…');
    let issues: GrammarIssue[] = [];
    let grammarAvailable = true;
    try {
      const checker = await prepareChecker(settings.dialect, dictionary);
      setBusyLabel('Improving…');
      issues = await checker.check(source);
    } catch {
      grammarAvailable = false; // phrase rules still work without the grammar engine
    }
    const changes = analyzeText({ text: source, tone, issues, customRules: customPhrases, dictionary });
    const record = saveHistoryRecord(
      { tone, original: source, improved: applyChanges(source, changes).text },
      settings.historyEnabled,
    );
    scrollNext.current = true;
    setResult({ original: source, tone, changes, selection: {}, grammarAvailable, historyId: record?.id });
    setBusy(false);
  }, [text, busy, live.status, settings.dialect, settings.historyEnabled, dictionary, tone, customPhrases, setResult]);

  useEffect(() => {
    if (!result || !scrollNext.current) return;
    scrollNext.current = false;
    results.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [result]);

  const onSelectionChange = (selection: Selection) => {
    if (!result) return;
    if (result.historyId && settings.historyEnabled) {
      const improved = applyChanges(result.original, result.changes, selection).text;
      saveHistoryRecord({ tone: result.tone, original: result.original, improved }, true, result.historyId);
    }
    setResult({ ...result, selection });
  };

  const onReplaceEditor = (improved: string) => {
    setText(improved);
    setResult(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.getElementById('editor')?.focus({ preventScroll: true });
  };

  const onAddWord = (word: string) => {
    addWord(word);
    if (!result) return;
    const lower = word.toLowerCase();
    setResult({
      ...result,
      changes: result.changes.filter((c) => !(c.kind === SPELLING_KIND && c.originalText.trim().toLowerCase() === lower)),
    });
  };

  return (
    <>
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-brand sm:text-4xl">Make your words better.</h1>
        <p className="mt-2 text-lg text-muted">Write clearly. Communicate professionally.</p>
      </div>

      <div className="mx-auto mt-8 max-w-4xl">
        <Editor
          value={text}
          onChange={setText}
          highlights={highlights}
          status={live.status}
          issueCount={highlights.length}
          liveCheckEnabled={settings.liveGrammarCheck}
          liveCheckPaused={liveCheckPaused}
          onSubmit={improve}
        />
        <ActionToolbar tone={tone} onToneChange={setTone} onImprove={improve} busy={busy} busyLabel={busyLabel} disabled={!text.trim()} />
        <p className="mt-3 text-xs text-muted">
          Tip: press <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-sans">Ctrl</kbd> +{' '}
          <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-sans">Enter</kbd> to improve. Everything runs in your browser using
          fixed rules — no AI, and nothing is sent anywhere.
        </p>
      </div>

      <div ref={results} className="scroll-mt-20">
        {result && (
          <ResultPanel
            result={result}
            stale={result.original !== text}
            onSelectionChange={onSelectionChange}
            onReplaceEditor={onReplaceEditor}
            onAddWord={onAddWord}
          />
        )}
      </div>
    </>
  );
}
