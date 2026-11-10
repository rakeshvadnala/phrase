import { FileText, PenLine, RotateCcw, Wand2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CopyButton } from '../components/CopyButton';
import { draftToText, renderTemplate, type TemplateValues } from '../engine/templateEngine';
import { useAppState } from '../hooks/useAppState';
import { navigate } from '../hooks/useHashRoute';
import rawTemplates from '../templates/emailTemplates.json';
import type { EmailTemplate } from '../types';

const TEMPLATES = rawTemplates as EmailTemplate[];

export default function EmailTemplates() {
  const { settings, updateSettings, setText, setResult } = useAppState();
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id);
  const [values, setValues] = useState<TemplateValues>({ sender: settings.senderName });
  const [draft, setDraft] = useState<{ subject: string; body: string; templateId: string } | null>(null);

  const template = TEMPLATES.find((t) => t.id === templateId)!;
  const categories = useMemo(() => [...new Set(TEMPLATES.map((t) => t.category))], []);
  const preview = useMemo(() => renderTemplate(template, values), [template, values]);

  const choose = (id: string) => {
    setTemplateId(id);
    setDraft(null);
  };

  const generate = () => {
    setDraft({ subject: preview.subject, body: preview.body, templateId });
    if ((values.sender ?? '').trim() !== settings.senderName) updateSettings({ senderName: (values.sender ?? '').trim() });
    requestAnimationFrame(() => document.getElementById('draft-heading')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const resetFields = () => {
    setValues({ sender: settings.senderName });
    setDraft(null);
  };

  const openInEditor = () => {
    if (!draft) return;
    setText(draft.body);
    setResult(null);
    navigate('/');
  };

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-brand">Email Templates</h1>
      <p className="mt-1 text-muted">
        Pick a template, fill in the details and generate a structured draft. Drafts are assembled from fixed templates — nothing is invented.
      </p>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[17rem_1fr]">
        <nav aria-label="Templates" className="card p-3">
          {categories.map((category) => (
            <div key={category} className="mb-2 last:mb-0">
              <h2 className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted">{category}</h2>
              <ul>
                {TEMPLATES.filter((t) => t.category === category).map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      aria-current={t.id === templateId ? 'true' : undefined}
                      onClick={() => choose(t.id)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                        t.id === templateId ? 'bg-surface-2 font-semibold text-brand' : 'text-ink hover:bg-surface-2'
                      }`}
                    >
                      <FileText size={15} aria-hidden className="shrink-0 text-muted" /> {t.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="min-w-0 space-y-6">
          <form
            className="card p-4 sm:p-5"
            onSubmit={(e) => {
              e.preventDefault();
              generate();
            }}
          >
            <h2 className="text-lg font-semibold text-brand">{template.name}</h2>
            <p className="text-sm text-muted">{template.description}</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {template.fields.map((f) => {
                const id = `field-${template.id}-${f.key}`;
                const common = {
                  id,
                  className: 'input',
                  value: values[f.key] ?? '',
                  placeholder: f.placeholder,
                  'aria-required': f.required || undefined,
                };
                return (
                  <div key={f.key} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}>
                    <label className="label" htmlFor={id}>
                      {f.label}
                      {f.required && <span className="text-error dark:text-red-400" aria-hidden> *</span>}
                    </label>
                    {f.type === 'textarea' ? (
                      <textarea {...common} rows={3} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
                    ) : (
                      <input {...common} type={f.type} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
                    )}
                  </div>
                );
              })}
            </div>
            {preview.missing.length > 0 && (
              <p className="mt-4 text-sm text-muted">
                Still empty: {preview.missing.join(', ')}. You can generate anyway — missing details appear as [placeholders] in the draft.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="submit" className="btn btn-primary">
                <Wand2 size={17} aria-hidden /> {draft ? 'Regenerate draft' : 'Generate draft'}
              </button>
              <button type="button" className="btn" onClick={resetFields}>
                <RotateCcw size={16} aria-hidden /> Clear fields
              </button>
            </div>
            {draft && <p className="mt-2 text-xs text-muted">Regenerating replaces any edits you made to the draft below.</p>}
          </form>

          {draft && draft.templateId === templateId && (
            <section className="card p-4 sm:p-5" aria-labelledby="draft-heading">
              <h2 id="draft-heading" className="scroll-mt-20 text-lg font-semibold text-brand">Your draft</h2>
              <p className="text-sm text-muted">Edit freely before copying.</p>
              <div className="mt-4">
                <label className="label" htmlFor="draft-subject">Subject</label>
                <input id="draft-subject" className="input" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
              </div>
              <div className="mt-4">
                <label className="label" htmlFor="draft-body">Message</label>
                <textarea
                  id="draft-body"
                  className="input min-h-80 leading-7"
                  rows={Math.min(24, Math.max(12, draft.body.split('\n').length + 1))}
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                />
              </div>
              {/\[[^\]\n]+\]/.test(`${draft.subject}\n${draft.body}`) && (
                <p className="mt-2 text-sm text-warning">This draft still contains [placeholders] to fill in.</p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <CopyButton text={draftToText(draft.subject, draft.body)} label="Copy email" className="btn btn-primary" />
                <CopyButton text={draft.body} label="Copy message only" className="btn" />
                <button type="button" className="btn" onClick={openInEditor}>
                  <PenLine size={16} aria-hidden /> Check in editor
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
