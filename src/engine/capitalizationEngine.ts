import type { Change, GrammarIssue } from '../types';
import { isSpellingIssue, pickSpellingDefault } from './spellingEngine';
import { findProtectedSpans, getSentenceRanges, type Range } from './textUtils';

/**
 * Capitalisation rules that the grammar checker does not cover:
 *
 *  - the first word of a line or sentence ("hope you are well" -> "Hope ...")
 *  - the name or form of address in a greeting line ("hello ravi," -> "Hello Ravi,")
 *
 * Every capital is an ordinary change the user can reject. Words that look
 * like technical terms are left alone, and unknown words are only offered.
 */

export const CAPITALIZATION_KIND = 'Capitalization';

/** A greeting line: greeting word(s), then one to three words of address, then optional punctuation. */
const GREETING_LINE =
  /^([ \t]*(?:hello|hi|hey|dear|greetings|good[ \t]+(?:morning|afternoon|evening|day)))((?:[ \t]+\p{L}[\p{L}'’.-]*){1,3})[ \t]*([,!:]?)[ \t]*$/iu;

/** Words after a greeting that are not a name or form of address. */
const NOT_ADDRESS = new Set(['and', 'there', 'again', 'the', 'to', 'you', 'both', 'my', 'our', 'from', 'everybody', 'guys', 'folks']);

/** A line this long that does not end a sentence is probably hard-wrapped text. */
const WRAPPED_LINE_LENGTH = 60;

const UNTOUCHABLE = new Set(['url', 'email', 'code', 'identifier', 'mention', 'file', 'number']);

export interface CapitalizationResult {
  changes: Change[];
  /** Positions that are capitalised by default; other changes starting there should follow suit. */
  autoStarts: Set<number>;
  /** Names / forms of address in greeting lines. Spelling look-alikes must not be pre-selected here. */
  addressSpans: Range[];
}

interface Candidate {
  pos: number;
  reason: 'line' | 'sentence' | 'address';
  /** Offered but not applied unless the user chooses it. */
  optional: boolean;
}

/** The whitespace-delimited token starting at `pos`. */
const tokenAt = (text: string, pos: number) => /^\S+/.exec(text.slice(pos, pos + 64))?.[0] ?? '';

/** True for tokens that are plain lower-case words (no capitals, digits, dots or identifier characters inside). */
function isPlainLowercaseWord(token: string): boolean {
  if (!/^\p{Ll}/u.test(token)) return false;
  const core = token.replace(/[.,;:!?)"'’”\]]+$/u, '');
  return !/[\p{Lu}\d_@/\\.]/u.test(core);
}

export function findCapitalization(text: string, issues: GrammarIssue[] = [], dictionary: string[] = []): CapitalizationResult {
  const candidates: Candidate[] = [];
  const addressSpans: Range[] = [];
  const lineStarts = new Set<number>();

  // Lines: first word, and the address in a greeting line.
  let offset = 0;
  let previous = '';
  const lines = text.split('\n');
  lines.forEach((rawLine, index) => {
    const line = rawLine.replace(/\r$/, '');
    const first = line.search(/\S/);
    if (first >= 0) {
      const prev = previous.trim();
      const wrapped = prev.length >= WRAPPED_LINE_LENGTH && !/[.!?:]["'”’)\]]*$/.test(prev);
      lineStarts.add(offset + first);
      if (!wrapped) candidates.push({ pos: offset + first, reason: 'line', optional: false });

      const greeting = GREETING_LINE.exec(line);
      if (greeting) {
        // Without closing punctuation the line is only a greeting if more text follows on a later line.
        const punctuated = greeting[3] !== '';
        const standsAlone = index < lines.length - 1;
        if (punctuated || standsAlone) {
          const word = /\p{L}[\p{L}'’.-]*/gu;
          let m: RegExpExecArray | null;
          while ((m = word.exec(greeting[2]))) {
            if (NOT_ADDRESS.has(m[0].toLowerCase())) continue;
            const start = offset + greeting[1].length + m.index;
            addressSpans.push({ start, end: start + m[0].length });
            candidates.push({ pos: start, reason: 'address', optional: !punctuated });
          }
        }
      }
    }
    previous = line;
    offset += rawLine.length + 1;
  });

  // Sentences that start in the middle of a line.
  for (const r of getSentenceRanges(text)) {
    if (lineStarts.has(r.start)) continue;
    const before = text.slice(Math.max(0, r.start - 6), r.start).trimEnd();
    if (/(?:\.\.|…)$/.test(before)) continue; // an ellipsis rarely ends the sentence
    candidates.push({ pos: r.start, reason: 'sentence', optional: false });
  }
  candidates.sort((a, b) => a.pos - b.pos);

  const spans = findProtectedSpans(text).filter((s) => UNTOUCHABLE.has(s.type));
  const known = new Set(dictionary.map((w) => w.toLowerCase()));
  const issueAt = new Map<number, GrammarIssue[]>();
  for (const issue of issues) issueAt.set(issue.start, [...(issueAt.get(issue.start) ?? []), issue]);

  const changes: Change[] = [];
  const autoStarts = new Set<number>();
  let spanIndex = 0;
  for (const c of candidates) {
    const ch = text[c.pos];
    if (!ch || !/\p{Ll}/u.test(ch) || ch.toUpperCase() === ch) continue;
    const token = tokenAt(text, c.pos);
    if (!isPlainLowercaseWord(token)) continue;
    while (spanIndex < spans.length && spans[spanIndex].end <= c.pos) spanIndex++;
    if (spans.slice(spanIndex, spanIndex + 8).some((s) => s.start <= c.pos && c.pos < s.end)) continue;

    const plain = /^[\p{L}'’-]+/u.exec(token)?.[0] ?? ch;
    const here = issueAt.get(c.pos) ?? [];
    if (here.some((i) => i.kind === CAPITALIZATION_KIND)) continue; // the grammar checker already offers it

    let optional = c.optional;
    if (c.reason !== 'address') {
      // An unknown word may be a command or product name ("kubectl get pods"): offer, do not apply.
      if (known.has(plain.toLowerCase())) optional = true;
      if (here.some((i) => isSpellingIssue(i) && pickSpellingDefault(i) < 0)) optional = true;
    }

    if (!optional) autoStarts.add(c.pos);
    changes.push({
      id: `cap:${c.pos}`,
      source: 'grammar',
      label: 'Capitalization',
      message:
        c.reason === 'address'
          ? 'A name or form of address in a greeting starts with a capital letter.'
          : c.reason === 'line'
            ? 'The first word of a line starts with a capital letter.'
            : 'A sentence starts with a capital letter.',
      start: c.pos,
      end: c.pos + plain.length,
      originalText: plain,
      options: [{ text: plain[0].toUpperCase() + plain.slice(1), start: c.pos, end: c.pos + plain.length }],
      defaultOption: optional ? -1 : 0,
      priority: 5,
      kind: CAPITALIZATION_KIND,
    });
  }
  return { changes, autoStarts, addressSpans };
}

/**
 * Makes other changes agree with the capitalisation rules: a replacement that
 * starts where a capital is due is capitalised too, and spelling look-alikes
 * for a name in a greeting are never pre-selected.
 */
export function alignWithCapitalization(changes: Change[], cap: CapitalizationResult): Change[] {
  return changes.map((change) => {
    let next = change;
    if (cap.autoStarts.has(change.start)) {
      const options = change.options.map((o) => {
        if (o.start !== change.start || !/^\p{Ll}/u.test(o.text)) return o;
        const up = (s: string) => s[0].toUpperCase() + s.slice(1);
        return { ...o, text: up(o.text), ...(o.label && /^\p{Ll}/u.test(o.label) ? { label: up(o.label) } : {}) };
      });
      next = { ...next, options };
    }
    if (next.kind === 'Spelling' && cap.addressSpans.some((s) => s.start <= next.start && next.end <= s.end)) {
      next = { ...next, defaultOption: -1 };
    }
    return next;
  });
}
