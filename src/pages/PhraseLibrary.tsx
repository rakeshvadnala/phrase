import { ArrowRight, Pencil, Plus, Search, Star, Trash2, X } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { CopyButton } from '../components/CopyButton';
import { ALL_BUILTIN_RULES, TONES, toneLabel } from '../engine/toneEngine';
import { useAppState } from '../hooks/useAppState';
import type { CustomPhraseInput } from '../storage/phraseStorage';
import type { PhraseRule, ToneId } from '../types';

const PAGE = 60;

interface Draft {
  id?: string;
  original: string;
  replacement: string;
  alternatives: string;
  tone: ToneId;
  description: string;
}

const emptyDraft = (tone: ToneId = 'professional'): Draft => ({ original: '', replacement: '', alternatives: '', tone, description: '' });

/** Shows how a replacement template reads ("$1" capture groups become an ellipsis). */
const display = (s: string) => (s === '' ? '(remove)' : s.replace(/\$0/g, '…').replace(/\$\d/g, '…'));

function PhraseForm({ draft, onCancel, onSave }: { draft: Draft; onCancel: () => void; onSave: (d: Draft) => string | null }) {
  const [d, setD] = useState(draft);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<Draft>) => setD((prev) => ({ ...prev, ...patch }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(onSave(d));
  };
  return (
    <form onSubmit={submit} className="card mb-6 p-4 sm:p-5" aria-label={d.id ? 'Edit phrase' : 'Add phrase'}>
      <h2 className="text-base font-semibold text-brand">{d.id ? 'Edit your phrase' : 'Add your own phrase'}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="pf-original">Phrase to replace</label>
          <input id="pf-original" className="input" value={d.original} onChange={(e) => set({ original: e.target.value })} placeholder="e.g. by eod" required autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="pf-replacement">Suggested phrase</label>
          <input id="pf-replacement" className="input" value={d.replacement} onChange={(e) => set({ replacement: e.target.value })} placeholder="e.g. by the end of the day" />
        </div>
        <div>
          <label className="label" htmlFor="pf-alternatives">Alternatives (one per line, optional)</label>
          <textarea id="pf-alternatives" className="input min-h-20" rows={2} value={d.alternatives} onChange={(e) => set({ alternatives: e.target.value })} />
        </div>
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="pf-tone">Tone</label>
            <select id="pf-tone" className="input" value={d.tone} onChange={(e) => set({ tone: e.target.value as ToneId })}>
              {TONES.map((t) => (
                <option key={t.id} value={t.id}>{t.id === 'grammar' ? 'All modes (always applied)' : t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="pf-description">Note (optional)</label>
            <input id="pf-description" className="input" value={d.description} onChange={(e) => set({ description: e.target.value })} placeholder="When to use this phrase" />
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">Matching is case-insensitive and whole-phrase. Leave the suggested phrase empty to have the phrase removed.</p>
      {error && <p role="alert" className="mt-3 text-sm font-medium text-error dark:text-red-400">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button type="submit" className="btn btn-primary">{d.id ? 'Save changes' : 'Add phrase'}</button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export default function PhraseLibrary() {
  const { customPhrases, addPhrase, updatePhrase, deletePhrase, favourites, toggleFavourite } = useAppState();
  const [query, setQuery] = useState('');
  const [tone, setTone] = useState<ToneId | 'all'>('all');
  const [scope, setScope] = useState<'all' | 'favourites' | 'custom'>('all');
  const [limit, setLimit] = useState(PAGE);
  const [draft, setDraft] = useState<Draft | null>(null);

  const all = useMemo(() => [...customPhrases, ...ALL_BUILTIN_RULES], [customPhrases]);
  const favouriteSet = useMemo(() => new Set(favourites), [favourites]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((r) => {
      if (tone !== 'all' && r.tone !== tone) return false;
      if (scope === 'favourites' && !favouriteSet.has(r.id)) return false;
      if (scope === 'custom' && !r.custom) return false;
      if (!q) return true;
      const haystack = [r.original, r.replacement, ...(r.variants ?? []), ...(r.alternatives ?? []), r.description ?? '', r.context ?? ''].join('\n').toLowerCase();
      return haystack.includes(q);
    });
  }, [all, query, tone, scope, favouriteSet]);

  const resetPaging = () => setLimit(PAGE);

  const save = (d: Draft): string | null => {
    const input: CustomPhraseInput = {
      original: d.original,
      replacement: d.replacement,
      tone: d.tone,
      alternatives: d.alternatives.split('\n'),
      description: d.description,
    };
    try {
      if (d.id) updatePhrase(d.id, input);
      else addPhrase(input);
      setDraft(null);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'The phrase could not be saved.';
    }
  };

  const edit = (r: PhraseRule) =>
    setDraft({ id: r.id, original: r.original, replacement: r.replacement, alternatives: (r.alternatives ?? []).join('\n'), tone: r.tone, description: r.description ?? '' });

  const remove = (r: PhraseRule) => {
    if (window.confirm(`Delete your phrase “${r.original}”?`)) deletePhrase(r.id);
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-brand">Phrase Library</h1>
          <p className="mt-1 text-muted">
            {ALL_BUILTIN_RULES.length} built-in phrases and {customPhrases.length} of your own. Your phrases take priority over built-in ones.
          </p>
        </div>
        {!draft && (
          <button type="button" className="btn btn-primary" onClick={() => setDraft(emptyDraft(tone === 'all' ? 'professional' : tone))}>
            <Plus size={18} aria-hidden /> Add phrase
          </button>
        )}
      </div>

      <div className="mt-6">
        {draft && <PhraseForm key={draft.id ?? 'new'} draft={draft} onCancel={() => setDraft(null)} onSave={save} />}

        <div className="card p-4">
          <div className="relative">
            <Search size={18} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="search"
              className="input !pl-10"
              placeholder="Search phrases…"
              aria-label="Search phrases"
              value={query}
              onChange={(e) => { setQuery(e.target.value); resetPaging(); }}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter by tone">
            {[{ id: 'all' as const, label: 'All tones' }, ...TONES.map((t) => ({ id: t.id, label: t.id === 'grammar' ? 'Grammar' : t.label }))].map((t) => (
              <button key={t.id} type="button" className="chip" aria-pressed={tone === t.id} onClick={() => { setTone(t.id); resetPaging(); }}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Filter by collection">
            {([['all', 'Everything'], ['favourites', `Favourites (${favourites.length})`], ['custom', `My phrases (${customPhrases.length})`]] as const).map(([id, label]) => (
              <button key={id} type="button" className="chip" aria-pressed={scope === id} onClick={() => { setScope(id); resetPaging(); }}>
                {id === 'favourites' && <Star size={13} aria-hidden />} {label}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-4 text-sm text-muted" role="status">
          {filtered.length.toLocaleString()} {filtered.length === 1 ? 'phrase' : 'phrases'}
          {(query || tone !== 'all' || scope !== 'all') && (
            <button type="button" className="ml-2 inline-flex items-center gap-1 text-accent hover:underline" onClick={() => { setQuery(''); setTone('all'); setScope('all'); resetPaging(); }}>
              <X size={13} aria-hidden /> Clear filters
            </button>
          )}
        </p>

        {filtered.length === 0 ? (
          <p className="card mt-3 p-8 text-center text-muted">
            {scope === 'favourites' && favourites.length === 0
              ? 'No favourites yet. Select the star next to a phrase to save it here.'
              : scope === 'custom' && customPhrases.length === 0
                ? 'You have not added any phrases yet.'
                : 'No phrases match your search.'}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {filtered.slice(0, limit).map((r) => {
              const fav = favouriteSet.has(r.id);
              return (
                <li key={r.id} className="card flex items-start gap-3 p-3 sm:p-4">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm mt-0.5 shrink-0 !px-1.5"
                    aria-pressed={fav}
                    aria-label={fav ? `Remove “${r.original}” from favourites` : `Add “${r.original}” to favourites`}
                    onClick={() => toggleFavourite(r.id)}
                  >
                    <Star size={18} aria-hidden className={fav ? 'fill-warning text-warning' : 'text-muted'} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-muted">{r.original}</span>
                      <ArrowRight size={14} aria-hidden className="shrink-0 text-muted" />
                      <span className="font-semibold text-ink">{display(r.replacement)}</span>
                    </p>
                    {r.alternatives && r.alternatives.length > 0 && (
                      <p className="mt-1 text-sm text-muted">Also: {r.alternatives.map(display).join(' · ')}</p>
                    )}
                    {r.description && <p className="mt-1 text-sm text-muted">{r.description}</p>}
                    <p className="mt-2 flex flex-wrap gap-1.5">
                      <span className="badge">{r.tone === 'grammar' ? (r.custom ? 'All modes' : 'Grammar') : toneLabel(r.tone)}</span>
                      {r.custom && <span className="badge !bg-teal/15 !text-accent">My phrase</span>}
                      {r.context && !r.custom && <span className="badge">{r.context}</span>}
                      {r.position === 'sentenceStart' && <span className="badge">Start of sentence</span>}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                    {r.replacement && !/\$\d/.test(r.replacement) && <CopyButton text={r.replacement} iconOnly label="Copy phrase" className="btn btn-ghost btn-sm !px-2" />}
                    {r.custom && (
                      <>
                        <button type="button" className="btn btn-ghost btn-sm !px-2" aria-label={`Edit “${r.original}”`} title="Edit" onClick={() => edit(r)}>
                          <Pencil size={16} aria-hidden />
                        </button>
                        <button type="button" className="btn btn-ghost btn-danger btn-sm !px-2" aria-label={`Delete “${r.original}”`} title="Delete" onClick={() => remove(r)}>
                          <Trash2 size={16} aria-hidden />
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {filtered.length > limit && (
          <button type="button" className="btn mt-4 w-full" onClick={() => setLimit((l) => l + PAGE)}>
            Show more ({(filtered.length - limit).toLocaleString()} remaining)
          </button>
        )}
      </div>
    </>
  );
}
