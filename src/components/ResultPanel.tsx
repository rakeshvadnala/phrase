import { CheckCircle2, Info, Replace, RotateCcw, Shuffle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { applyChanges, chosenOption, countVersions, selectVersion } from '../engine/changes';
import { compareFromChanges } from '../engine/comparisonEngine';
import { toneLabel } from '../engine/toneEngine';
import type { ImproveResult } from '../hooks/useAppState';
import type { Selection } from '../types';
import { ComparisonView } from './ComparisonView';
import { CopyButton } from './CopyButton';
import { ChangeList, GrammarSuggestions } from './GrammarSuggestions';

interface Props {
  result: ImproveResult;
  /** True when the editor text no longer matches the text this result was computed from. */
  stale: boolean;
  onSelectionChange: (selection: Selection) => void;
  onReplaceEditor: (text: string) => void;
  onAddWord: (word: string) => void;
}

export function ResultPanel({ result, stale, onSelectionChange, onReplaceEditor, onAddWord }: Props) {
  const { original, changes, selection, tone } = result;

  const outcome = useMemo(() => applyChanges(original, changes, selection), [original, changes, selection]);
  const comparison = useMemo(() => compareFromChanges(original, outcome), [original, outcome]);
  const applied = useMemo(() => new Set(outcome.applied.map((a) => a.change.id)), [outcome]);
  const blocked = useMemo(() => new Set(outcome.blocked), [outcome]);

  // Whole-message versions: each one moves every phrase suggestion on to its next wording.
  const versions = useMemo(() => countVersions(changes), [changes]);
  const [version, setVersion] = useState(0);
  // The ref keeps rapid clicks in step even before React has re-rendered.
  const versionRef = useRef(0);
  const showVersion = (v: number) => {
    versionRef.current = v;
    setVersion(v);
  };
  useEffect(() => showVersion(0), [changes]);
  const nextVersion = () => {
    const next = (versionRef.current + 1) % versions;
    showVersion(next);
    onSelectionChange(selectVersion(changes, selection, next));
  };
  const reset = () => {
    showVersion(0);
    onSelectionChange({});
  };
  const appliedCount = applied.size;

  const grammar = changes.filter((c) => c.source === 'grammar');
  const phrases = changes.filter((c) => c.source !== 'grammar');
  const pending = changes.filter((c) => c.options.length > 0 && chosenOption(c, selection) === -1).length;
  const changed = outcome.text !== original;
  const customised = Object.keys(selection).length > 0;

  const select = (id: string, option: number) => onSelectionChange({ ...selection, [id]: option });
  const bulk = (ids: string[], accept: boolean) => {
    const next = { ...selection };
    for (const id of ids) {
      const change = changes.find((c) => c.id === id)!;
      // "Apply all" restores the safe default; ambiguous spellings (names, technical terms) stay opt-in.
      const current = chosenOption(change, selection);
      next[id] = accept ? (current >= 0 ? current : change.defaultOption) : -1;
    }
    onSelectionChange(next);
  };

  return (
    <section className="mt-10" aria-labelledby="results-heading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="results-heading" className="text-xl font-bold tracking-tight text-brand">
            Results
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted" role="status">
            {changed ? (
              <>
                <CheckCircle2 size={16} aria-hidden className="text-success" />
                {appliedCount} {appliedCount === 1 ? 'change' : 'changes'} applied in {toneLabel(tone)} mode
              </>
            ) : (
              <>
                <Info size={16} aria-hidden /> No changes applied in {toneLabel(tone)} mode
              </>
            )}
            {pending > 0 && <span>· {pending} optional or awaiting your review</span>}
          </p>
        </div>
        {versions > 1 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted" aria-live="polite">
              Version {version + 1} of {versions}
            </span>
            <button type="button" className="btn" onClick={nextVersion} title="Switch every phrase suggestion to its next wording">
              <Shuffle size={16} aria-hidden /> Try another version
            </button>
          </div>
        )}
      </div>

      {stale && (
        <p role="status" className="mb-4 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          The editor text has changed since these results were produced. Select Improve My Message to refresh them.
        </p>
      )}

      <ComparisonView
        comparison={comparison}
        originalActions={<CopyButton text={original} label="Copy original" />}
        improvedActions={
          <>
            <CopyButton text={outcome.text} label="Copy improved" className="btn btn-sm btn-primary" />
            <button type="button" className="btn btn-sm" onClick={() => onReplaceEditor(outcome.text)} disabled={!changed}>
              <Replace size={15} aria-hidden /> Replace editor text
            </button>
            <button type="button" className="btn btn-sm" onClick={reset} disabled={!customised}>
              <RotateCcw size={15} aria-hidden /> Reset changes
            </button>
          </>
        }
      />

      {changes.length === 0 && (
        <p className="card mt-4 flex items-center gap-2 p-4 text-sm text-muted">
          <CheckCircle2 size={18} aria-hidden className="shrink-0 text-success" />
          Nothing to improve: no rule in this mode matched your message and no grammar issues were detected.
        </p>
      )}

      <div className="mt-6 grid items-start gap-4 lg:grid-cols-2">
        <GrammarSuggestions
          changes={grammar}
          grammarAvailable={result.grammarAvailable}
          selection={selection}
          applied={applied}
          blocked={blocked}
          onSelect={select}
          onBulk={bulk}
          onAddWord={onAddWord}
        />
        <section className="card p-4" aria-labelledby="phrase-heading">
          <h3 id="phrase-heading" className="text-base font-semibold text-brand">
            Suggested {tone === 'grammar' ? 'wording fixes' : `${toneLabel(tone).toLowerCase()} phrases`}{' '}
            <span className="font-normal text-muted">({phrases.length})</span>
          </h3>
          {phrases.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No phrase rule for this mode matched your message.</p>
          ) : (
            <div className="mt-3">
              <p className="mb-3 text-xs text-muted">
                Pick an alternative wording, or keep your original phrase. Suggestions marked Optional are not applied unless you choose one.
              </p>
              <ChangeList changes={phrases} selection={selection} applied={applied} blocked={blocked} onSelect={select} />
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
