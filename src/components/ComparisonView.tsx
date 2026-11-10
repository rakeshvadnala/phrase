import type { ReactNode } from 'react';
import type { Comparison } from '../engine/comparisonEngine';
import type { Segment } from '../types';

const ORIGINAL_CLASS: Partial<Record<Segment['type'], string>> = {
  removed: 'seg-removed',
  replaced: 'seg-replaced-old',
  grammar: 'seg-grammar-old',
};

const IMPROVED_CLASS: Partial<Record<Segment['type'], string>> = {
  added: 'seg-added',
  replaced: 'seg-replaced-new',
  grammar: 'seg-grammar-new',
};

const DESCRIPTION: Record<Segment['type'], string> = {
  equal: '',
  added: 'added',
  removed: 'removed',
  replaced: 'replaced phrase',
  grammar: 'grammar correction',
};

function Segments({ segments, classes }: { segments: Segment[]; classes: Partial<Record<Segment['type'], string>> }) {
  return (
    <>
      {segments.map((s, i) => {
        const cls = classes[s.type];
        if (!cls) return <span key={i}>{s.text}</span>;
        // Whitespace-only edits (e.g. an inserted space) need a visible box.
        const blank = s.text.trim() === '';
        return (
          <mark key={i} className={`${cls} ${blank ? 'px-1' : 'px-0.5'}`} title={DESCRIPTION[s.type]}>
            {s.text}
            <span className="sr-only"> ({DESCRIPTION[s.type]})</span>
          </mark>
        );
      })}
    </>
  );
}

interface Props {
  comparison: Comparison;
  originalActions?: ReactNode;
  improvedActions?: ReactNode;
  improvedLabel?: string;
}

export function ComparisonView({ comparison, originalActions, improvedActions, improvedLabel = 'Improved message' }: Props) {
  const panel = (title: string, body: ReactNode, actions: ReactNode, accent: boolean) => (
    <section className={`card flex min-w-0 flex-col ${accent ? 'border-teal/50' : ''}`} aria-label={title}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <h3 className="text-sm font-semibold text-brand">{title}</h3>
        <div className="flex flex-wrap gap-2">{actions}</div>
      </header>
      <div className="max-h-[32rem] overflow-y-auto whitespace-pre-wrap px-4 py-3 text-[1.0625rem] leading-7 [overflow-wrap:anywhere]" tabIndex={0}>
        {body}
      </div>
    </section>
  );

  return (
    <div>
      <div className="grid gap-4 lg:grid-cols-2">
        {panel('Original message', <Segments segments={comparison.original} classes={ORIGINAL_CLASS} />, originalActions, false)}
        {panel(improvedLabel, <Segments segments={comparison.improved} classes={IMPROVED_CLASS} />, improvedActions, true)}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Highlight legend">
        <li><span className="seg-added px-1.5">added</span></li>
        <li><span className="seg-removed px-1.5">removed</span></li>
        <li><span className="seg-replaced-old px-1.5">replaced</span> → <span className="seg-replaced-new px-1.5">new phrase</span></li>
        <li><span className="seg-grammar-old">mistake</span> → <span className="seg-grammar-new px-1.5">grammar correction</span></li>
      </ul>
    </div>
  );
}
