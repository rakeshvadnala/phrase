import { describe, expect, it } from 'vitest';
import { applyChanges, countVersions, selectVersion } from '../src/engine/changes';
import { compareFromChanges } from '../src/engine/comparisonEngine';
import { REQUEST_VERBS, toGerund } from '../src/engine/inflect';
import { analyzeText, BUILTIN_RULES } from '../src/engine/toneEngine';
import type { Change, ToneId } from '../src/types';
import { improve } from './helpers';

/** Every whole-sentence result a change can produce, in option order. */
function wordings(text: string, tone: ToneId): string[] {
  const changes = analyzeText({ text, tone });
  const change = changes.find((c) => c.options.length > 1) ?? changes[0];
  if (!change) return [];
  return change.options.map((_, i) => applyChanges(text, changes, { [change.id]: i }).text);
}

describe('verb inflection', () => {
  it('forms the -ing form', () => {
    const cases: Record<string, string> = {
      send: 'sending', share: 'sharing', update: 'updating', run: 'running', get: 'getting', submit: 'submitting',
      reset: 'resetting', stop: 'stopping', plan: 'planning', fix: 'fixing', verify: 'verifying', reply: 'replying',
      open: 'opening', cancel: 'canceling', see: 'seeing', be: 'being', tie: 'tying', make: 'making',
      'look into': 'looking into', 'let me know': 'letting me know', 'take care of': 'taking care of', 'set up': 'setting up',
    };
    for (const [verb, gerund] of Object.entries(cases)) expect(toGerund(verb), verb).toBe(gerund);
    expect(toGerund('')).toBe('');
  });

  it('produces a plausible -ing form for every request verb', () => {
    for (const verb of REQUEST_VERBS) expect(toGerund(verb)).toMatch(/^[a-z]+ing(?: [a-z ]+)?$/);
  });
});

describe('sentence patterns: structurally different rewrites', () => {
  it('offers several ways to make a request', () => {
    expect(wordings('Can you send me the report?', 'polite')).toEqual([
      'Could you please send me the report?',
      'Would you mind sending me the report?',
      'I would appreciate it if you could send me the report.',
      'Would you be able to send me the report?',
      'I would be grateful if you could send me the report.',
      'May I ask you to send me the report?',
    ]);
  });

  it('turns an instruction into a question, including its punctuation', () => {
    expect(wordings('Send me the report.', 'polite')).toEqual([
      'Could you please send me the report?',
      'Please send me the report.',
      'Would you be able to send me the report?',
      'Would you mind sending me the report?',
      'I would appreciate it if you could send me the report.',
      'Kindly send me the report.',
    ]);
  });

  it('adds missing end punctuation and respects closing quotes', () => {
    expect(improve('Can you check the logs', 'polite')).toBe('Could you please check the logs?');
    expect(improve('Hi Ravi,\ncan you check the logs\nThanks', 'polite')).toBe('Hi Ravi,\nCould you please check the logs?\nThank you');
    expect(improve('You must restart the server!', 'polite')).toBe('Could you please restart the server?');
  });

  it('keeps the rest of the sentence free for other rules', () => {
    expect(improve('Can you send me the report asap?', 'polite')).toBe('Could you please send me the report at your earliest convenience?');
  });

  it('handles suggestions, status checks, apologies and commitments', () => {
    expect(wordings("Let's schedule a call.", 'polite')).toEqual([
      'Could we schedule a call?',
      'Shall we schedule a call?',
      'Would it be possible to schedule a call?',
      'I suggest we schedule a call.',
      'How about scheduling a call?',
      'May I suggest we schedule a call.',
    ]);
    expect(wordings('Any update on the invoice?', 'professional').slice(0, 3)).toEqual([
      'Could you please share an update on the invoice?',
      'May I have an update on the invoice?',
      'I am following up on the invoice.',
    ]);
    expect(wordings('I forgot to attach the file.', 'professional')).toEqual([
      'I overlooked attaching the file.',
      'I missed attaching the file.',
      'I neglected to attach the file.',
      'I did not remember to attach the file.',
    ]);
    expect(improve('Sorry about the confusion.', 'professional')).toBe('I apologize for the confusion.');
    expect(improve('I could not complete the review.', 'professional')).toBe('I was unable to complete the review.');
    expect(improve('Could you please send the file?', 'friendly')).toBe('Can you send the file?');
    expect(improve('I will send the file.', 'friendly')).toBe("I'll send the file.");
    expect(improve('Can you review the document?', 'formal')).toBe('I would be grateful if you could review the document.');
  });

  it('offers closing-line alternatives', () => {
    expect(wordings('Let me know if you have any doubts.', 'professional')).toEqual([
      'Please let me know if you have any questions.',
      'Please feel free to reach out if you have any questions.',
      'I am happy to clarify anything further.',
      'Should you need any clarification, please let me know.',
      'Please do not hesitate to contact me with any questions.',
    ]);
    expect(improve('I am waiting for your reply.', 'professional')).toBe('I look forward to your response.');
  });

  it('only matches known request verbs', () => {
    expect(improve('Can you believe it?', 'polite')).toBe('Could you please believe it?'); // falls back to the plain phrase rule
    const changes = analyzeText({ text: 'Can you believe it?', tone: 'polite' });
    expect(changes[0].ruleId).toBe('pol-can-you');
  });
});

describe('optional suggestions', () => {
  it('are listed but not applied by default', () => {
    const text = 'I will send the report tomorrow.';
    const changes = analyzeText({ text, tone: 'professional' });
    expect(changes).toHaveLength(1);
    expect(changes[0].defaultOption).toBe(-1);
    expect(applyChanges(text, changes).text).toBe(text);
    expect(applyChanges(text, changes, { [changes[0].id]: 1 }).text).toBe('I will be sending the report tomorrow.');
    expect(applyChanges(text, changes, { [changes[0].id]: 2 }).text).toBe('Let me send the report tomorrow.');
  });

  it('are offered when the text is already polite, without changing it', () => {
    for (const text of ['Please send me the report.', 'Could you please send it?', 'Thank you for the update.']) {
      const tone: ToneId = text.startsWith('Thank') ? 'professional' : 'polite';
      const changes = analyzeText({ text, tone });
      expect(applyChanges(text, changes).text, text).toBe(text);
      expect(changes.some((c) => c.defaultOption === -1 && c.options.length >= 3), text).toBe(true);
    }
  });

  it('never leave template syntax in any wording', () => {
    const samples = [
      'Can you send me the report?', 'Send me the report.', 'Please review the document.', "Let's schedule a call.", 'I want to discuss the plan.',
      'Any update on the invoice?', 'Thanks for the update.', 'I will send the file.', 'We need to review the design.', 'I could not complete the task.',
      'I forgot to attach the file.', 'You need to update the ticket.', 'Could you please confirm the date?',
    ];
    for (const tone of ['professional', 'polite', 'formal', 'friendly'] as ToneId[]) {
      for (const text of samples) {
        const changes = analyzeText({ text, tone });
        for (const c of changes) {
          c.options.forEach((o, i) => {
            const out = applyChanges(text, changes, { [c.id]: i }).text;
            expect(out, `${tone}: ${text}`).not.toMatch(/\$\d|\{[.?!]\}|:ing|\{verb\}|[.?!]{2,}|\s{2,}|\s[.?!,]/);
            expect(`${o.label ?? ''}${o.text}`).not.toMatch(/\$\d|\{[.?!]\}/);
          });
        }
      }
    }
  });
});

describe('end-of-sentence punctuation edits', () => {
  it('are reported as part of the same change and reconstruct both texts', () => {
    const text = 'Send me the report. Thanks';
    const changes = analyzeText({ text, tone: 'polite' });
    const result = applyChanges(text, changes);
    expect(result.text).toBe('Could you please send me the report? Thank you');
    const ids = result.applied.map((a) => a.change.id);
    expect(new Set(ids).size).toBe(2); // two changes ...
    expect(ids).toHaveLength(3); // ... three edits (the request brings its "?" along)
    const c = compareFromChanges(text, result);
    expect(c.original.map((s) => s.text).join('')).toBe(text);
    expect(c.improved.map((s) => s.text).join('')).toBe(result.text);
  });

  it('are dropped with their change when it is rejected', () => {
    const text = 'Send me the report.';
    const changes = analyzeText({ text, tone: 'polite' });
    expect(applyChanges(text, changes, { [changes[0].id]: -1 }).text).toBe(text);
  });

  it('do not block other changes in the sentence', () => {
    const text = 'Can you send teh report asap.';
    const typo: Change = { id: 'g', source: 'grammar', label: 'Typo', message: '', start: 13, end: 16, originalText: 'teh', options: [{ text: 'the', start: 13, end: 16 }], defaultOption: 0, priority: 10 };
    const changes = [...analyzeText({ text, tone: 'polite' }), typo];
    expect(applyChanges(text, changes).text).toBe('Could you please send the report at your earliest convenience?');
  });
});

describe('whole-message versions', () => {
  const text = 'Sorry for late reply. I want to know the status. Please do the needful.';
  const changes = analyzeText({ text, tone: 'professional' });

  it('counts the available versions', () => {
    expect(countVersions(changes)).toBeGreaterThanOrEqual(5);
    expect(countVersions([])).toBe(1);
  });

  it('version 0 is the default result', () => {
    expect(selectVersion(changes, {}, 0)).toEqual({});
    expect(applyChanges(text, changes, selectVersion(changes, {}, 0)).text).toBe(
      'Apologies for the delayed response. I would like to understand the status. Could you please take the necessary action?',
    );
  });

  it('each version rewords the whole message differently', () => {
    const n = countVersions(changes);
    const outputs = Array.from({ length: n }, (_, v) => applyChanges(text, changes, selectVersion(changes, {}, v)).text);
    expect(new Set(outputs).size).toBe(n);
    expect(outputs[1]).toBe('I apologize for the delay in responding. I would like to know the status. Please take the necessary action.');
    for (const out of outputs) expect(out).not.toContain('do the needful');
  });

  it('keeps grammar choices and cycles optional suggestions through "off"', () => {
    const grammar: Change = { id: 'g1', source: 'grammar', label: 'Spelling', message: '', start: 0, end: 1, originalText: 'x', options: [{ text: 'y', start: 0, end: 1 }], defaultOption: -1, priority: 10 };
    const optional: Change = { id: 'p1', source: 'phrase', label: '', message: '', start: 5, end: 6, originalText: 'a', options: [{ text: 'b', start: 5, end: 6 }, { text: 'c', start: 5, end: 6 }], defaultOption: -1, priority: 100 };
    const list = [grammar, optional];
    expect(countVersions(list)).toBe(3);
    expect(selectVersion(list, { g1: 0 }, 0)).toEqual({ g1: 0 });
    expect(selectVersion(list, { g1: 0 }, 1)).toEqual({ g1: 0, p1: 0 });
    expect(selectVersion(list, { g1: 0 }, 2)).toEqual({ g1: 0, p1: 1 });
    expect(selectVersion(list, { g1: 0, p1: 1 }, 3)).toEqual({ g1: 0, p1: -1 });
  });
});

describe('rule library variety', () => {
  it('gives most professional and polite rules several wordings', () => {
    for (const tone of ['professional', 'polite'] as ToneId[]) {
      const rules = BUILTIN_RULES[tone];
      const rich = rules.filter((r) => (r.alternatives?.length ?? 0) >= 3).length;
      expect(rich / rules.length, tone).toBeGreaterThan(0.45);
    }
  });

  it('has no duplicate wordings inside a rule', () => {
    for (const r of Object.values(BUILTIN_RULES).flat()) {
      const all = [r.replacement, ...(r.alternatives ?? [])].map((s) => s.toLowerCase());
      expect(new Set(all).size, r.id).toBe(all.length);
    }
  });
});
