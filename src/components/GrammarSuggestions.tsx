import { ArrowRight, BookPlus, CheckCheck, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { chosenOption } from '../engine/changes';
import { SPELLING_KIND } from '../engine/spellingEngine';
import type { Change, Selection } from '../types';

const PAGE = 40;

function optionLabel(change: Change, index: number): string {
  const option = change.options[index];
  if (option.label) return option.label;
  if (option.text === '') return 'Remove';
  if (option.text.trim() === '') return 'Add a space';
  if (option.start === option.end) return `Add “${option.text.trim()}”`;
  return option.text.trim();
}

interface ListProps {
  changes: Change[];
  selection: Selection;
  /** Ids of changes currently applied to the improved text. */
  applied: Set<string>;
  /** Ids of changes that are selected but overridden by an overlapping change. */
  blocked: Set<string>;
  onSelect: (id: string, option: number) => void;
  onAddWord?: (word: string) => void;
  keepLabel?: string;
}

/** A reviewable list of proposed changes. Every change can be applied, swapped or rejected individually. */
export function ChangeList({ changes, selection, applied, blocked, onSelect, onAddWord, keepLabel = 'Keep original' }: ListProps) {
  const [limit, setLimit] = useState(PAGE);
  return (
    <>
      <ul className="space-y-3">
        {changes.slice(0, limit).map((change) => {
          const chosen = chosenOption(change, selection);
          const isBlocked = blocked.has(change.id);
          const isApplied = applied.has(change.id);
          const original = change.originalText.trim();
          return (
            <li key={change.id} className="rounded-xl border border-line bg-surface p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge">{change.label}</span>
                {isApplied && <span className="badge !bg-teal/15 !text-accent">Applied</span>}
                {!isApplied && !isBlocked && change.source !== 'grammar' && change.defaultOption < 0 && <span className="badge">Optional</span>}
                {isBlocked && <span className="badge">Covered by another suggestion</span>}
                {change.options.length === 0 && <span className="badge">No automatic fix</span>}
              </div>
              <p className="mt-1.5 text-sm text-muted">{change.message.replace(/`/g, '“').replace(/“([^“]*)“/g, '“$1”')}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2" role="radiogroup" aria-label={`Suggestions for “${original}”`}>
                <span className={`rounded-md bg-surface-2 px-2 py-1 text-sm ${isApplied ? 'text-muted line-through' : 'text-ink'}`}>
                  {original || '(position in text)'}
                </span>
                {change.options.length > 0 && <ArrowRight size={14} aria-hidden className="shrink-0 text-muted" />}
                {change.options.map((_, i) => (
                  <button key={i} type="button" role="radio" aria-checked={chosen === i} className="chip" onClick={() => onSelect(change.id, i)}>
                    {optionLabel(change, i)}
                  </button>
                ))}
                {change.options.length > 0 && (
                  <button type="button" role="radio" aria-checked={chosen === -1} className="chip" onClick={() => onSelect(change.id, -1)}>
                    {keepLabel}
                  </button>
                )}
              </div>
              {onAddWord && change.kind === SPELLING_KIND && original && (
                <button type="button" className="btn btn-ghost btn-sm mt-2 -ml-2 text-accent" onClick={() => onAddWord(original)}>
                  <BookPlus size={15} aria-hidden /> Add “{original}” to my dictionary
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {changes.length > limit && (
        <button type="button" className="btn btn-sm mt-3 w-full" onClick={() => setLimit((l) => l + PAGE * 5)}>
          Show more ({(changes.length - limit).toLocaleString()} remaining)
        </button>
      )}
    </>
  );
}

interface Props extends Omit<ListProps, 'keepLabel'> {
  grammarAvailable: boolean;
  onBulk: (ids: string[], accept: boolean) => void;
}

export function GrammarSuggestions({ changes, grammarAvailable, onBulk, ...list }: Props) {
  const fixable = changes.filter((c) => c.options.length > 0).map((c) => c.id);
  return (
    <section className="card p-4" aria-labelledby="grammar-heading">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="grammar-heading" className="text-base font-semibold text-brand">
          Detected grammar issues <span className="font-normal text-muted">({changes.length})</span>
        </h3>
        {fixable.length > 0 && (
          <div className="flex gap-2">
            <button type="button" className="btn btn-sm" onClick={() => onBulk(fixable, true)} title="Applies every unambiguous correction. Uncertain spellings still need your choice.">
              <CheckCheck size={15} aria-hidden /> Apply all
            </button>
            <button type="button" className="btn btn-sm" onClick={() => onBulk(fixable, false)}>
              <Undo2 size={15} aria-hidden /> Ignore all
            </button>
          </div>
        )}
      </header>
      {!grammarAvailable ? (
        <p role="alert" className="mt-3 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
          The grammar engine could not be loaded, so only phrase rules were applied. Check your connection and try again — once loaded, it works offline.
        </p>
      ) : changes.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No spelling, grammar, punctuation or capitalization issues were detected.</p>
      ) : (
        <div className="mt-3">
          <p className="mb-3 text-xs text-muted">
            Spelling suggestions for names and technical terms are never applied automatically — choose one, or add the word to your dictionary.
          </p>
          <ChangeList changes={changes} keepLabel="Ignore" {...list} />
        </div>
      )}
    </section>
  );
}
