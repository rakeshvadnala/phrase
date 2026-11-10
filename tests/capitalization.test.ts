import { beforeAll, describe, expect, it } from 'vitest';
import { applyChanges } from '../src/engine/changes';
import { findCapitalization } from '../src/engine/capitalizationEngine';
import type { GrammarChecker } from '../src/engine/grammarEngine';
import { analyzeText } from '../src/engine/toneEngine';
import type { GrammarIssue, ToneId } from '../src/types';
import { getTestChecker, improve } from './helpers';

const fix = (text: string, tone: ToneId = 'grammar') => improve(text, tone);

describe('capitalisation of line and sentence starts', () => {
  it('capitalises the first word of each line', () => {
    expect(fix('hello,\nhope you are well')).toBe('Hello,\nHope you are well');
    expect(fix('thanks,\nravi')).toBe('Thanks,\nRavi');
    expect(fix('  indented line')).toBe('  Indented line');
  });

  it('capitalises a sentence that starts in the middle of a line', () => {
    expect(fix('It works. the build is green! is it deployed? yes.')).toBe('It works. The build is green! Is it deployed? Yes.');
  });

  it('leaves text that is already capitalised alone', () => {
    const text = 'Hello Ravi,\nHope you are well. Thank you.';
    expect(analyzeText({ text, tone: 'grammar' })).toEqual([]);
  });

  it('does not capitalise after an abbreviation, an ellipsis or a colon', () => {
    for (const text of ['Use a tool, e.g. grep.', 'Wait... then retry.', 'Note: the job failed.', 'See fig. two.']) expect(fix(text), text).toBe(text);
  });

  it('never touches technical tokens at the start of a line', () => {
    const samples = [
      'https://example.com is down', 'www.example.com is down', 'user@example.com replied', '`npm test` fails', 'iPhone build is ready',
      'user_id is missing', 'config.yaml was updated', 'v2 is out', 'e.g. this one', '@ravi please check', '#general channel', 'eBay order',
      'getUser() returns null', '- bullet point','"quoted" text',
    ];
    for (const text of samples) expect(fix(text), text).toBe(text);
  });

  it('skips lines that look hard-wrapped', () => {
    const text = 'This is a long line of text that was wrapped by an e-mail client and\ncontinues on the next line.';
    expect(fix(text)).toBe(text);
    expect(fix('A short line\nthen another')).toBe('A short line\nThen another');
  });

  it('offers but does not apply a capital for a personal-dictionary word', () => {
    const text = 'kubectl get pods';
    const changes = analyzeText({ text, tone: 'grammar', dictionary: ['kubectl'] });
    expect(changes).toHaveLength(1);
    expect(changes[0].defaultOption).toBe(-1);
    expect(applyChanges(text, changes).text).toBe(text);
    expect(applyChanges(text, changes, { [changes[0].id]: 0 }).text).toBe('Kubectl get pods');
  });

  it('offers but does not apply a capital for a word the checker does not know', () => {
    const text = 'kubectl get pods';
    const issues: GrammarIssue[] = [
      { start: 0, end: 7, problemText: 'kubectl', kind: 'Spelling', kindLabel: 'Spelling', message: '', suggestions: [{ kind: 'replace', text: 'puberty' }, { kind: 'replace', text: 'subtle' }] },
    ];
    expect(applyChanges(text, analyzeText({ text, tone: 'grammar', issues })).text).toBe(text);
  });

  it('does not duplicate a capitalisation the grammar checker already reports', () => {
    const text = 'hello there.';
    const issues: GrammarIssue[] = [
      { start: 0, end: 5, problemText: 'hello', kind: 'Capitalization', kindLabel: 'Capitalization', message: '', suggestions: [{ kind: 'replace', text: 'Hello' }] },
    ];
    const changes = analyzeText({ text, tone: 'grammar', issues });
    expect(changes).toHaveLength(1);
    expect(applyChanges(text, changes).text).toBe('Hello there.');
  });

  it('can be rejected like any other change', () => {
    const text = 'hello,\nhope you are well';
    const changes = analyzeText({ text, tone: 'grammar' });
    expect(changes.map((c) => c.originalText)).toEqual(['hello', 'hope']);
    expect(applyChanges(text, changes, { [changes[0].id]: -1 }).text).toBe('hello,\nHope you are well');
  });

  it('capitalises a replacement that lands at the start of a line or sentence', () => {
    expect(fix('thanks for the update. pls check the logs', 'professional')).toBe('Thank you for the update. Please check the logs');
    expect(fix('Hi Ravi,\ncan you check the logs\nthanks', 'polite')).toBe('Hi Ravi,\nCould you please check the logs?\nThank you');
    const issues: GrammarIssue[] = [
      { start: 0, end: 5, problemText: 'youre', kind: 'Spelling', kindLabel: 'Spelling', message: '', suggestions: [{ kind: 'replace', text: "you're" }, { kind: 'replace', text: 'your' }] },
    ];
    expect(applyChanges('youre right', analyzeText({ text: 'youre right', tone: 'grammar', issues })).text).toBe("You're right");
  });

  it('handles a very long text quickly', () => {
    const text = 'hello team,\nplease check the logs. the build failed.\n'.repeat(2000);
    const started = Date.now();
    const out = fix(text);
    expect(Date.now() - started).toBeLessThan(5000);
    expect(out.startsWith('Hello Team,\nPlease check the logs. The build failed.\n')).toBe(true);
  });
});

describe('greeting lines', () => {
  it('capitalises the name or form of address', () => {
    expect(fix('hello dear,\nhope you are well')).toBe('Hello Dear,\nHope you are well');
    expect(fix('hi ravi kumar,')).toBe('Hi Ravi Kumar,');
    expect(fix('dear sir,')).toBe('Dear Sir,');
    expect(fix('good morning team!')).toBe('Good morning Team!');
    expect(fix('hey ravi and priya,')).toBe('Hey Ravi and Priya,');
    expect(fix('hi there,')).toBe('Hi there,');
  });

  it('only suggests it when the greeting has no punctuation', () => {
    const text = 'hello ravi\nhope you are well';
    const changes = analyzeText({ text, tone: 'grammar' });
    expect(applyChanges(text, changes).text).toBe('Hello ravi\nHope you are well');
    const name = changes.find((c) => c.originalText === 'ravi');
    expect(name?.defaultOption).toBe(-1);
    expect(applyChanges(text, changes, { [name!.id]: 0 }).text).toBe('Hello Ravi\nHope you are well');
  });

  it('ignores lines that are not greetings', () => {
    expect(fix('hello, how are you')).toBe('Hello, how are you');
    expect(fix('hey wait')).toBe('Hey wait');
    expect(fix('hi ravi can you check the server status today,')).toBe('Hi ravi can you check the server status today,');
    expect(findCapitalization('I said hello ravi, then left').addressSpans).toEqual([]);
  });

  it('never pre-selects a spelling look-alike for the name', () => {
    const text = 'hello ravi,\nthe build passed';
    const issues: GrammarIssue[] = [
      { start: 6, end: 10, problemText: 'ravi', kind: 'Spelling', kindLabel: 'Spelling', message: '', suggestions: [{ kind: 'replace', text: 'rave' }, { kind: 'replace', text: 'rabbi' }] },
    ];
    const changes = analyzeText({ text, tone: 'grammar', issues });
    expect(applyChanges(text, changes).text).toBe('Hello Ravi,\nThe build passed');
    const spelling = changes.find((c) => c.kind === 'Spelling')!;
    expect(spelling.defaultOption).toBe(-1);
    // Choosing the look-alike on purpose still works and keeps the capital.
    expect(applyChanges(text, changes, { [spelling.id]: 0 }).text).toBe('Hello Rave,\nThe build passed');
  });
});

describe('capitalisation with the real grammar checker (Harper)', () => {
  let checker: GrammarChecker;
  beforeAll(async () => {
    checker = await getTestChecker();
  }, 120_000);

  const run = async (text: string, tone: ToneId = 'grammar') => applyChanges(text, analyzeText({ text, tone, issues: await checker.check(text) })).text;

  it('fixes a lower-case greeting and a missing apostrophe', async () => {
    expect(await run('hello dear,\nhope youre doing well')).toBe("Hello Dear,\nHope you're doing well");
  });

  it('keeps a lower-case name instead of replacing it with a look-alike', async () => {
    expect(await run('hello ravi,\nhope youre doing well')).toBe("Hello Ravi,\nHope you're doing well");
    expect(await run('hi priya,\nthanks for the update', 'professional')).toBe('Hi Priya,\nThank you for the update');
  });

  it('does not produce a doubled or conflicting capitalisation', async () => {
    expect(await run('the report is ready. i will send it today.')).toBe('The report is ready. I will send it today.');
    expect(await run('kubectl get pods')).toBe('kubectl get pods');
  });
});
