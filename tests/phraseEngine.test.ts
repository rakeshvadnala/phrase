import { describe, expect, it } from 'vitest';
import { applyChanges } from '../src/engine/changes';
import { adjustCase, compileRule, findPhraseChanges } from '../src/engine/phraseEngine';
import { BUILTIN_RULES, getRulesForTone } from '../src/engine/toneEngine';
import type { PhraseRule } from '../src/types';
import { improve } from './helpers';

const rule = (r: Partial<PhraseRule> & Pick<PhraseRule, 'original' | 'replacement'>): PhraseRule => ({
  id: `t-${r.original}`,
  tone: 'professional',
  priority: 50,
  ...r,
});

const run = (text: string, rules: PhraseRule[]) => applyChanges(text, findPhraseChanges(text, rules)).text;

describe('phrase matching', () => {
  it('matches whole phrases, not fragments of words', () => {
    const rules = [rule({ original: 'asap', replacement: 'as soon as possible' })];
    expect(run('Send it asap.', rules)).toBe('Send it as soon as possible.');
    expect(run('The asapx module is fine.', rules)).toBe('The asapx module is fine.');
    expect(run('Our pre-asap process.', rules)).toBe('Our pre-asap process.');
  });

  it('matches case-insensitively and tolerates extra spaces', () => {
    const rules = [rule({ original: 'i want to know', replacement: 'I would like to understand' })];
    expect(run('I WANT   to Know the status.', rules)).toBe('I would like to understand the status.');
  });

  it('treats straight and curly apostrophes alike', () => {
    const rules = [rule({ original: "don't", replacement: 'do not', tone: 'formal' })];
    expect(run('We don’t know. We don\'t care.', rules)).toBe('We do not know. We do not care.');
  });

  it('prefers the higher-priority / longer rule when rules overlap', () => {
    const rules = [
      rule({ original: 'let me know', replacement: 'please keep me informed', priority: 50 }),
      rule({ original: 'check and let me know', replacement: 'please review and provide an update', priority: 80 }),
    ];
    expect(run('Check and let me know.', rules)).toBe('Please review and provide an update.');
  });

  it('never re-scans its own output (no repeated or cascading replacements)', () => {
    const rules = [
      rule({ original: 'help', replacement: 'help and support' }),
      rule({ original: 'support', replacement: 'assistance' }),
    ];
    expect(run('I need help.', rules)).toBe('I need help and support.');
    const once = improve('Please do the needful.', 'professional');
    expect(improve(once, 'professional')).toBe(once);
  });

  it('replaces every occurrence exactly once', () => {
    const rules = [rule({ original: 'asap', replacement: 'as soon as possible' })];
    const changes = findPhraseChanges('asap, ASAP and asap', rules);
    expect(changes).toHaveLength(3);
  });

  it('does not introduce duplicate words at the seams', () => {
    expect(improve('Please let me know.', 'polite')).toBe('Please let me know.');
    const out = improve('Please do the needful.', 'professional');
    expect(out).not.toMatch(/please\s+please/i);
    expect(improve('I hope you are doing well.', 'professional')).toBe('I hope you are doing well.');
  });

  it('does not duplicate a word where two neighbouring replacements meet', () => {
    expect(improve('Pls check and update asap.', 'professional')).toBe('Please review and provide an update as soon as possible.');
    expect(improve('Kindly do the needful.', 'professional')).toBe('Could you please take the necessary action?');
    const rules = [
      rule({ original: 'so as', replacement: 'in order to' }),
      rule({ original: 'get', replacement: 'to obtain' }),
    ];
    expect(run('We left so as get tickets.', rules)).toBe('We left in order to obtain tickets.');
  });

  it('honours sentence-start-only rules', () => {
    const rules = [rule({ original: 'hey', replacement: 'Hello', position: 'sentenceStart' })];
    expect(run('Hey John. I said hey to him.', rules)).toBe('Hello John. I said hey to him.');
  });

  it('skips a rule when the sentence already contains an excluded phrase', () => {
    const rules = [rule({ original: 'can you', replacement: 'could you please', unlessSentenceContains: ['please'] })];
    expect(run('Can you please send it? Can you call me?', rules)).toBe('Can you please send it? Could you please call me?');
  });

  it('supports capture groups in pattern rules', () => {
    expect(improve('I joined two years back.', 'grammar')).toBe('I joined two years ago.');
    expect(improve('Please send the mail today itself.', 'professional')).toBe('Please send the email today.');
  });

  it('ignores invalid user patterns instead of throwing', () => {
    const bad = rule({ original: 'x', pattern: '(unclosed', replacement: 'y' });
    expect(compileRule(bad)).toBeNull();
    expect(run('x marks the spot', [bad])).toBe('x marks the spot');
  });

  it('offers alternative suggestions that the user can select', () => {
    const text = 'I want to know the plan.';
    const changes = findPhraseChanges(text, getRulesForTone('professional'));
    expect(changes).toHaveLength(1);
    expect(changes[0].options.map((o) => o.text).slice(0, 3)).toEqual([
      'I would like to understand',
      'I would like to know',
      'Could you please clarify',
    ]);
    expect(changes[0].options.length).toBeGreaterThanOrEqual(5);
    expect(applyChanges(text, changes, { [changes[0].id]: 1 }).text).toBe('I would like to know the plan.');
    expect(applyChanges(text, changes, { [changes[0].id]: -1 }).text).toBe(text);
  });
});

describe('case preservation', () => {
  it('capitalises at the start of a sentence', () => {
    expect(improve('asap is fine. fyi, it shipped.', 'professional')).toBe(
      'As soon as possible is fine. For your information, it shipped.',
    );
  });

  it('keeps lower case in the middle of a sentence', () => {
    expect(improve('We should talk and let me know.', 'professional')).toBe('We should talk and please keep me informed.');
  });

  it('keeps "I" capitalised mid-sentence', () => {
    expect(improve('Hello, i want to know the plan.', 'professional')).toBe('Hello, I would like to understand the plan.');
  });

  it('preserves an all-caps phrase', () => {
    expect(improve('PLEASE DO THE NEEDFUL', 'professional')).toBe('COULD YOU PLEASE TAKE THE NECESSARY ACTION?');
  });

  it('does not shout when a single abbreviation is expanded', () => {
    expect(improve('Reply ASAP please.', 'professional')).toBe('Reply as soon as possible please.');
  });

  it('adjustCase handles the individual cases', () => {
    expect(adjustCase('thank you', 'Thanks', false)).toBe('Thank you');
    expect(adjustCase('Thank you', 'thanks', false)).toBe('thank you');
    expect(adjustCase('I apologize', 'sorry', false)).toBe('I apologize');
    expect(adjustCase('apologies', 'I am sorry', false)).toBe('apologies');
  });
});

describe('punctuation preservation', () => {
  it('keeps the original sentence punctuation', () => {
    expect(improve('Sorry for late reply!', 'professional')).toBe('Apologies for the delayed response!');
    expect(improve('Is it done asap?', 'professional')).toBe('Is it done as soon as possible?');
    expect(improve('fyi, the build passed; thx.', 'professional')).toBe('For your information, the build passed; thank you.');
  });

  it('uses the replacement punctuation when the phrase ends the sentence', () => {
    expect(improve('Please do the needful.', 'professional')).toBe('Could you please take the necessary action?');
    expect(improve('Do one thing', 'professional')).toBe('Could you please consider the following approach?');
  });

  it('drops the replacement punctuation in the middle of a sentence', () => {
    expect(improve('Please do the needful and confirm.', 'professional')).toBe(
      'Could you please take the necessary action and confirm.',
    );
  });

  it('preserves line breaks and spacing around the phrase', () => {
    expect(improve('Hi Ravi,\n\nPlease do the needful.\n\nThanks,\nRakesh', 'professional')).toBe(
      'Hi Ravi,\n\nCould you please take the necessary action?\n\nThank you,\nRakesh',
    );
  });
});

describe('protected content', () => {
  it('never rewrites URLs, e-mail addresses, code or quoted text', () => {
    const text = 'See https://example.com/asap/fyi and mail asap@example.com, run `kubectl get info` and "let me know".';
    expect(improve(text, 'professional')).toBe(text);
  });

  it('leaves names, numbers, dates and identifiers untouched', () => {
    const text = 'Rakesh will ping me on 12/05/2026 at 10:30 about INC-10423, build v2.4.1 and getUserInfo.';
    const out = improve(text, 'professional');
    expect(out).toBe('Rakesh will contact me on 12/05/2026 at 10:30 about INC-10423, build v2.4.1 and getUserInfo.');
  });

  it('keeps a number that sits inside a matched phrase', () => {
    expect(improve('I am having 5 years of experience.', 'grammar')).toBe('I have 5 years of experience.');
  });
});

describe('built-in rule libraries', () => {
  it('have unique ids and compile', () => {
    const all = Object.values(BUILTIN_RULES).flat();
    expect(new Set(all.map((r) => r.id)).size).toBe(all.length);
    for (const r of all) expect(compileRule(r), r.id).not.toBeNull();
  });

  it('carry the documented fields', () => {
    for (const [tone, rules] of Object.entries(BUILTIN_RULES)) {
      expect(rules.length).toBeGreaterThan(20);
      for (const r of rules) {
        expect(r.tone).toBe(tone);
        expect(typeof r.original).toBe('string');
        expect(typeof r.replacement).toBe('string');
        expect(typeof r.priority).toBe('number');
      }
    }
  });
});
