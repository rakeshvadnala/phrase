import { describe, expect, it } from 'vitest';
import { draftToText, formatDate, formatTime, renderTemplate } from '../src/engine/templateEngine';
import {
  countCharacters,
  countSentences,
  countWords,
  findProtectedSpans,
  getSentenceRanges,
  isSentenceStart,
} from '../src/engine/textUtils';
import templates from '../src/templates/emailTemplates.json';
import type { EmailTemplate } from '../src/types';

describe('text statistics', () => {
  it('counts an empty editor as zero', () => {
    expect(countCharacters('')).toBe(0);
    expect(countWords('')).toBe(0);
    expect(countWords('   \n ')).toBe(0);
    expect(countSentences('')).toBe(0);
    expect(countSentences('... !!!')).toBe(0);
  });

  it('counts characters, words and sentences', () => {
    const text = "Hi Ravi, I can't join at 10:30. Is 3.5 hours enough? Email me at a.b@example.com!";
    expect(countCharacters(text)).toBe(text.length);
    expect(countWords(text)).toBe(15);
    expect(countSentences(text)).toBe(3);
  });

  it('counts emoji as single characters', () => {
    expect(countCharacters('ok 😀')).toBe(4);
  });

  it('does not split on abbreviations, initials or decimals', () => {
    expect(countSentences('Dr. Rao met Mr. J. Smith at 4.30 p.m. today.')).toBeLessThanOrEqual(2);
    expect(countSentences('Use e.g. the staging server. Then deploy.')).toBe(2);
  });

  it('treats line breaks as sentence boundaries', () => {
    expect(countSentences('Hi team\nThe build passed\nThanks')).toBe(3);
    const text = 'One. Two!  Three?';
    expect(getSentenceRanges(text).map((r) => text.slice(r.start, r.end))).toEqual(['One.', 'Two!', 'Three?']);
  });

  it('detects sentence starts', () => {
    const text = 'Hello there. please reply.\nthanks';
    expect(isSentenceStart(text, 0)).toBe(true);
    expect(isSentenceStart(text, text.indexOf('there'))).toBe(false);
    expect(isSentenceStart(text, text.indexOf('please'))).toBe(true);
    expect(isSentenceStart(text, text.indexOf('thanks'))).toBe(true);
  });

  it('finds protected spans', () => {
    const text = 'Mail a.b@example.com, see https://example.com/x?y=1, run `npm test`, ticket INC-42, file report.xlsx, call getUser().';
    const found = findProtectedSpans(text).map((s) => `${s.type}:${text.slice(s.start, s.end)}`);
    expect(found).toEqual(expect.arrayContaining([
      'email:a.b@example.com',
      'url:https://example.com/x?y=1',
      'code:`npm test`',
      'number:INC-42',
      'file:report.xlsx',
    ]));
  });
});

describe('email templates', () => {
  const list = templates as EmailTemplate[];
  const get = (id: string) => list.find((t) => t.id === id)!;

  it('provides every required template with unique ids', () => {
    const ids = list.map((t) => t.id);
    expect(ids).toEqual([
      'meeting-request', 'meeting-follow-up', 'status-update', 'leave-request', 'wfh-request', 'issue-escalation',
      'technical-update', 'project-update', 'approval-request', 'information-request', 'thank-you', 'apology', 'reminder',
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only references fields that are defined', () => {
    for (const t of list) {
      const keys = new Set(t.fields.map((f) => f.key));
      for (const m of `${t.subject}\n${t.body}`.matchAll(/\{\{[#^/]?(\w+)\}\}/g)) expect(keys.has(m[1]), `${t.id}:${m[1]}`).toBe(true);
    }
  });

  it('renders a complete draft deterministically', () => {
    const values = { recipient: 'Priya', topic: 'the Q3 release plan', date: '2026-11-12', time: '14:30', duration: '30 minutes', agenda: '- Scope\n- Timeline', sender: 'Rakesh' };
    const draft = renderTemplate(get('meeting-request'), values);
    expect(draft.missing).toEqual([]);
    expect(draft.subject).toBe('Meeting Request: the Q3 release plan');
    expect(draft.body).toBe(
      'Hi Priya,\n\nI hope you are doing well.\n\nI would like to schedule a meeting to discuss the Q3 release plan. Would Thursday, 12 November 2026 at 2:30 PM work for you? I expect the discussion to take about 30 minutes.\n\nProposed agenda:\n- Scope\n- Timeline\n\nIf this time does not suit you, please let me know your availability and I will be happy to reschedule.\n\nThank you,\nRakesh',
    );
    expect(renderTemplate(get('meeting-request'), values)).toEqual(draft);
  });

  it('drops optional sections and marks missing required fields', () => {
    const draft = renderTemplate(get('meeting-request'), { recipient: 'Priya' });
    expect(draft.missing).toEqual(['Meeting topic', 'Your name']);
    expect(draft.subject).toBe('Meeting Request: [Meeting topic]');
    expect(draft.body).not.toContain('Proposed agenda');
    expect(draft.body).not.toContain('{{');
    expect(draft.body).not.toMatch(/\n{3,}/);
    expect(draft.body.endsWith('[Your name]')).toBe(true);
  });

  it('supports either/or wording', () => {
    const single = renderTemplate(get('wfh-request'), { recipient: 'Anil', from: '2026-11-12', sender: 'Rakesh' });
    expect(single.body).toContain('work from home on Thursday, 12 November 2026.');
    const range = renderTemplate(get('wfh-request'), { recipient: 'Anil', from: '2026-11-12', to: '2026-11-13', sender: 'Rakesh' });
    expect(range.body).toContain('work from home from Thursday, 12 November 2026 to Friday, 13 November 2026.');
    expect(renderTemplate(get('leave-request'), { recipient: 'A', from: '2026-11-12', to: '2026-11-13', sender: 'R' }).body).toContain('request leave from');
  });

  it('never leaves template syntax in any rendered draft', () => {
    for (const t of list) {
      for (const values of [{}, Object.fromEntries(t.fields.map((f) => [f.key, f.type === 'date' ? '2026-01-05' : f.type === 'time' ? '09:00' : 'value']))]) {
        const draft = renderTemplate(t, values);
        expect(`${draft.subject}${draft.body}`).not.toMatch(/\{\{|\}\}/);
      }
    }
  });

  it('formats dates, times and the clipboard text', () => {
    expect(formatDate('2026-01-05')).toBe('Monday, 5 January 2026');
    expect(formatDate('next week')).toBe('next week');
    expect(formatTime('00:05')).toBe('12:05 AM');
    expect(formatTime('12:00')).toBe('12:00 PM');
    expect(draftToText('Hello', 'Body')).toBe('Subject: Hello\n\nBody');
    expect(draftToText(' ', 'Body')).toBe('Body');
  });
});
