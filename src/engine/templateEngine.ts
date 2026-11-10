import type { EmailTemplate, TemplateField } from '../types';

/**
 * Deterministic e-mail drafting. A template is plain text with:
 *   {{key}}                 – replaced by the field value
 *   {{#key}} ... {{/key}}   – kept only when the field has a value
 *   {{^key}} ... {{/key}}   – kept only when the field is empty
 * Nothing is generated: the output is always the template plus the user's input.
 */

export type TemplateValues = Record<string, string>;

export interface EmailDraft {
  subject: string;
  body: string;
  /** Labels of required fields that are still empty. */
  missing: string[];
}

export function formatDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return value;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

export function formatTime(value: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) return value;
  const h = Number(m[1]);
  if (h > 23) return value;
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}

function displayValue(field: TemplateField | undefined, raw: string): string {
  const value = raw.trim();
  if (!value) return '';
  if (field?.type === 'date') return formatDate(value);
  if (field?.type === 'time') return formatTime(value);
  return value;
}

function fill(template: string, t: EmailTemplate, values: TemplateValues): string {
  const field = (key: string) => t.fields.find((f) => f.key === key);
  const valueOf = (key: string) => displayValue(field(key), values[key] ?? '');

  // Conditional blocks first (no nesting).
  // "#" blocks are kept when the field has a value, "^" blocks when it is empty.
  // Repeated so that a block nested inside another block is resolved too.
  const block = /\{\{([#^])(\w+)\}\}([\s\S]*?)\{\{\/\2\}\}/g;
  let out = template;
  for (let pass = 0; pass < 5 && block.test(out); pass++) {
    block.lastIndex = 0;
    out = out.replace(block, (_, kind: string, key: string, inner: string) =>
      (kind === '#') === Boolean(valueOf(key)) ? inner : '',
    );
  }
  out = out.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const v = valueOf(key);
    if (v) return v;
    const f = field(key);
    return f ? `[${f.label}]` : '';
  });
  return out
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function renderTemplate(template: EmailTemplate, values: TemplateValues): EmailDraft {
  const missing = template.fields.filter((f) => f.required && !(values[f.key] ?? '').trim()).map((f) => f.label);
  return {
    subject: fill(template.subject, template, values).replace(/\s*\n\s*/g, ' '),
    body: fill(template.body, template, values),
    missing,
  };
}

/** The text that is copied to the clipboard for a finished draft. */
export function draftToText(subject: string, body: string): string {
  return subject.trim() ? `Subject: ${subject.trim()}\n\n${body}` : body;
}
