import { describe, expect, it } from 'vitest';
import { applyChanges } from '../src/engine/changes';
import { analyzeText, findRepeatedSentences, getRulesForTone, TONES } from '../src/engine/toneEngine';
import type { PhraseRule } from '../src/types';
import { improve } from './helpers';

describe('professional transformations', () => {
  const cases: Array<[string, string]> = [
    ['I want to know the status.', 'I would like to understand the status.'],
    ['I am facing issue with login.', 'I am experiencing an issue with login.'],
    ['Please do the needful.', 'Could you please take the necessary action?'],
    ['Check and update.', 'Please review and provide an update.'],
    ['I will check.', 'I will look into this.'],
    ['I will check the logs.', 'I will review the logs.'],
    ['Sorry for late reply.', 'Apologies for the delayed response.'],
    ['Do one thing.', 'Could you please consider the following approach?'],
    ['Let me know.', 'Please keep me informed.'],
    ['I have a doubt about the design.', 'I have a question about the design.'],
    ['Hey guys, the build is done from my side.', 'Hello everyone, the build is completed on my end.'],
    ['We will fix the issue today itself.', 'We will resolve the issue today.'],
    ['Pls revert back asap.', 'Please respond as soon as possible.'],
  ];
  it.each(cases)('%s -> %s', (input, expected) => {
    expect(improve(input, 'professional')).toBe(expected);
  });

  it('rewrites a whole message consistently', () => {
    const input = 'Hi Ravi,\n\nSorry for late reply. I am facing issue with the VPN and i want to know the fix. Please do the needful.\n\nThanks';
    expect(improve(input, 'professional')).toBe(
      'Hi Ravi,\n\nApologies for the delayed response. I am experiencing an issue with the VPN and I would like to understand the fix. Could you please take the necessary action?\n\nThank you',
    );
  });
});

describe('polite transformations', () => {
  const cases: Array<[string, string]> = [
    ['Send me the report.', 'Could you please send me the report?'],
    ['Check the logs and confirm.', 'Could you please check the logs and confirm?'],
    ['Can you share the file?', 'Could you please share the file?'],
    ['I want the report by Friday.', 'I would like the report by Friday.'],
    ['You need to update the ticket.', 'Could you please update the ticket?'],
    ['Reply asap.', 'Reply at your earliest convenience.'],
    ["That's wrong.", 'I believe there may be a misunderstanding.'],
    ["I can't join the call.", "I'm afraid I am unable to join the call."],
    ['Give me the credentials.', 'Could you please share the credentials?'],
  ];
  it.each(cases)('%s -> %s', (input, expected) => {
    expect(improve(input, 'polite')).toBe(expected);
  });

  it('does not add a second polite marker', () => {
    expect(improve('Please send me the report.', 'polite')).toBe('Please send me the report.');
    expect(improve('Could you please send it?', 'polite')).toBe('Could you please send it?');
    expect(improve('Kindly share the file.', 'polite')).toBe('Kindly share the file.');
  });

  it('does not treat questions or nouns as instructions', () => {
    expect(improve('Update from the vendor is pending.', 'polite')).toBe('Update from the vendor is pending.');
    expect(improve('Test results are attached.', 'polite')).toBe('Test results are attached.');
  });
});

describe('formal transformations', () => {
  const cases: Array<[string, string]> = [
    ["I can't attend and we don't have a backup.", 'I cannot attend and we do not have a backup.'],
    ["It's been a long week, and it's not over.", 'It has been a long week, and it is not over.'],
    ["I'm sure they'll agree.", 'I am sure they will agree.'],
    ['Thanks for the update.', 'Thank you for the update.'],
    ['We need to find out the cause and deal with it.', 'We need to determine the cause and address it.'],
    ['But the vendor did not reply.', 'However, the vendor did not reply.'],
    ['Hi Priya, please make sure the data is correct.', 'Dear Priya, please ensure the data is correct.'],
    ['Let me know if you have any questions.', 'Should you have any questions, please do not hesitate to contact me.'],
  ];
  it.each(cases)('%s -> %s', (input, expected) => {
    expect(improve(input, 'formal')).toBe(expected);
  });
});

describe('friendly transformations', () => {
  const cases: Array<[string, string]> = [
    ['Dear Priya, I am writing to inform you that the release is ready.', 'Hi Priya, just letting you know that the release is ready.'],
    ['I do not think we will need it.', "I don't think we'll need it."],
    ['Thank you for your assistance.', 'Thanks for your help.'],
    ['Please do not hesitate to contact me.', 'Feel free to reach out.'],
    ['Kindly review it at your earliest convenience.', 'Please review it when you get a chance.'],
  ];
  it.each(cases)('%s -> %s', (input, expected) => {
    expect(improve(input, 'friendly')).toBe(expected);
  });

  it('does not contract at the end of a sentence', () => {
    expect(improve('Yes, I am.', 'friendly')).toBe('Yes, I am.');
  });
});

describe('concise transformations', () => {
  const cases: Array<[string, string]> = [
    ['We met in order to discuss the plan.', 'We met to discuss the plan.'],
    ['Due to the fact that it rained, we stayed.', 'Because it rained, we stayed.'],
    ['Basically, we need more time.', 'We need more time.'],
    ['We are basically done.', 'We are done.'],
    ['Please note that the server will restart.', 'The server will restart.'],
    ['At this point in time we have a large number of tickets.', 'Now we have many tickets.'],
    ['We are in the process of migrating the data.', 'We are migrating the data.'],
    ['The report is very long.', 'The report is long.'],
    ['I hope this email finds you well. The build is ready.', 'The build is ready.'],
  ];
  it.each(cases)('%s -> %s', (input, expected) => {
    expect(improve(input, 'concise')).toBe(expected);
  });

  it('removes a sentence that repeats an earlier one', () => {
    const text = 'The server is down. We are checking. The server is down.';
    expect(findRepeatedSentences(text)).toHaveLength(1);
    expect(improve(text, 'concise')).toBe('The server is down. We are checking.');
  });

  it('keeps short repeated interjections', () => {
    expect(findRepeatedSentences('Thank you. Noted. Thank you.')).toHaveLength(0);
  });

  it('never produces a longer message', () => {
    const text = 'In the event that the job fails, please do not hesitate to contact me in order to resolve it on a daily basis.';
    expect(improve(text, 'concise').length).toBeLessThan(text.length);
  });
});

describe('mode configuration', () => {
  it('exposes the six documented modes', () => {
    expect(TONES.map((t) => t.id)).toEqual(['grammar', 'professional', 'polite', 'formal', 'friendly', 'concise']);
  });

  it('keeps each mode separate', () => {
    expect(improve("I can't do it asap.", 'grammar')).toBe("I can't do it asap.");
    expect(improve('Please do the needful.', 'formal')).toBe('Please do the needful.');
  });

  it('applies shared grammar-slip rules in every mode', () => {
    for (const tone of TONES) expect(improve('We should of discussed about it.', tone.id)).toBe('We should have discussed it.');
  });

  it('lets a custom phrase override a built-in rule of the same mode', () => {
    const custom: PhraseRule[] = [{ id: 'c1', original: 'asap', replacement: 'by end of day', tone: 'professional', priority: 50, custom: true }];
    expect(improve('Send it asap.', 'professional', custom)).toBe('Send it by end of day.');
    expect(improve('Send it asap.', 'formal', custom)).toBe('Send it at the earliest opportunity.');
    expect(getRulesForTone('professional', custom)[0].custom).toBe(true);
  });
});

describe('empty and long input', () => {
  it('returns no changes for empty or whitespace-only input', () => {
    for (const tone of TONES) {
      expect(analyzeText({ text: '', tone: tone.id })).toEqual([]);
      expect(analyzeText({ text: '   \n\t ', tone: tone.id })).toEqual([]);
    }
    expect(applyChanges('', []).text).toBe('');
  });

  it('handles a very long message quickly and correctly', () => {
    const sentence = 'I want to know the status and please do the needful. ';
    const text = sentence.repeat(2000); // ~106,000 characters
    const started = performance.now();
    const changes = analyzeText({ text, tone: 'professional' });
    const out = applyChanges(text, changes).text;
    const elapsed = performance.now() - started;
    expect(changes).toHaveLength(4000);
    expect(out.startsWith('I would like to understand the status and could you please take the necessary action? ')).toBe(true);
    expect(out).not.toContain('do the needful');
    expect(elapsed).toBeLessThan(15_000);
  });

  it('handles text without any letters', () => {
    expect(improve('12345 !!! ??? ...', 'professional')).toBe('12345 !!! ??? ...');
  });
});
