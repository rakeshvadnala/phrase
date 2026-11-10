import type { Change, ChangeOption, PhraseRule } from '../types';
import { REQUEST_VERB_SOURCE, toGerund } from './inflect';
import {
  capitalizeFirst,
  decapitalizeFirst,
  escapeRegExp,
  findProtectedSpans,
  getSentenceRanges,
  isAllCaps,
  isSentenceStart,
  rangesOverlap,
  sentenceAt,
  type ProtectedSpan,
  type Range,
} from './textUtils';

/**
 * Deterministic, rule-based phrase transformation.
 *
 * Every rule is matched against the ORIGINAL text in a single pass, so a
 * replacement is never re-scanned (no repeated or cascading replacements).
 * Matching is phrase-level, whole-word and case-insensitive.
 */

/** How far back to look for neighbouring words and spacing. */
const WINDOW = 80;
/** Protected spans (URLs, quoted text) are never longer than this. */
const MAX_SPAN = 2100;

const BEFORE = "(?<![\\p{L}\\p{N}_'’-])";
const AFTER = "(?![\\p{L}\\p{N}_]|['’-][\\p{L}\\p{N}])";

const TONE_LABEL: Record<string, string> = {
  grammar: 'Grammar',
  professional: 'Professional',
  polite: 'Polite',
  formal: 'Formal',
  friendly: 'Friendly',
  concise: 'Concise',
};

/** Converts a literal phrase to a regex source: flexible spaces and apostrophes. */
export function literalToSource(phrase: string): string {
  return phrase
    .trim()
    .split(/\s+/)
    .map((token) => escapeRegExp(token).replace(/['’]/g, "['’]"))
    .join('[ \\t]+');
}

const compiled = new WeakMap<PhraseRule, RegExp | null>();

/** Builds (and caches) the matcher for a rule. Returns null for unusable rules. */
export function compileRule(rule: PhraseRule): RegExp | null {
  const cached = compiled.get(rule);
  if (cached !== undefined) return cached;
  let regex: RegExp | null = null;
  try {
    const literals = [...(rule.pattern ? [] : [rule.original]), ...(rule.variants ?? [])]
      .filter((s) => s.trim().length > 0)
      .sort((a, b) => b.length - a.length)
      .map(literalToSource);
    const pattern = rule.pattern?.replace(/\{verb\}/g, REQUEST_VERB_SOURCE);
    const sources = [...(pattern ? [pattern] : []), ...literals];
    if (sources.length > 0) regex = new RegExp(`${BEFORE}(?:${sources.join('|')})${AFTER}`, 'giu');
  } catch {
    regex = null; // invalid user-supplied pattern
  }
  compiled.set(rule, regex);
  return regex;
}

interface Candidate extends Range {
  rule: PhraseRule;
  match: RegExpExecArray;
  atSentenceStart: boolean;
}

/** A trailing `{?}` / `{.}` / `{!}` in a template sets the punctuation that ends the sentence. */
const END_MARK = /\{([.?!])\}$/;

function expandTemplate(template: string, match: RegExpExecArray): string {
  return template.replace(END_MARK, '').replace(/\$(\d)(:ing)?/g, (_, d: string, ing?: string) => {
    const raw = d === '0' ? decapitalizeFirst(match[0]) : (match[Number(d)] ?? '');
    return ing ? toGerund(raw) : raw;
  });
}

/** The edit that makes the sentence containing `index` end with `punct` (null if it already does). */
function endPunctuationEdit(text: string, index: number, sentences: Range[], punct: string, notBefore: number): ChangeOption | null {
  const s = sentenceAt(text, index, sentences);
  const tail = /([.?!]+)(["'”’)\]]*)$/.exec(text.slice(s.start, s.end));
  if (!tail) return s.end >= notBefore ? { text: punct, start: s.end, end: s.end } : null;
  const start = s.end - tail[0].length;
  const end = start + tail[1].length;
  if (start < notBefore || text.slice(start, end) === punct) return null;
  return { text: punct, start, end };
}

const startsWithI = (s: string) => /^I(?:$|[\s'’])/.test(s);

/** Applies sentence-start / all-caps casing of the matched text to a replacement. */
export function adjustCase(replacement: string, matched: string, atSentenceStart: boolean): string {
  if (!replacement) return replacement;
  if (isAllCaps(matched) && /\s/.test(matched.trim())) return replacement.toUpperCase();
  // A lone acronym ("ASAP") says nothing about how its expansion should be cased.
  const matchedIsCapitalised = /^\p{Lu}/u.test(matched) && !startsWithI(matched) && !isAllCaps(matched);
  if (atSentenceStart || matchedIsCapitalised) return capitalizeFirst(replacement);
  return decapitalizeFirst(replacement);
}

/** Words that already make a request polite (including shorthand that other rules expand to "please"). */
const POLITE_MARKERS = new Set(['please', 'kindly', 'pls', 'plz', 'plss', 'plzz']);

const lastWord = (s: string) => /([\p{L}'’]+)[^\p{L}]*$/u.exec(s)?.[1]?.toLowerCase();
const firstWord = (s: string) => /^[^\p{L}]*([\p{L}'’]+)/u.exec(s)?.[1]?.toLowerCase();

function buildOption(text: string, c: Candidate, template: string, sentences: Range[]): ChangeOption | null {
  const endPunct = END_MARK.exec(template)?.[1];
  let replacement = expandTemplate(template, c.match);
  let start = c.start;
  let end = c.end;
  const after = text.slice(end);

  if (replacement === '') {
    // Deletion: tidy up the surrounding spacing and punctuation.
    if (c.atSentenceStart) {
      const swallowed = /^(?:[.!?]+|,)?[ \t]*/.exec(after)![0];
      end += swallowed.length;
      const endedSentence = /[.!?]/.test(swallowed);
      const next = text[end];
      if (!endedSentence && next && /\p{Ll}/u.test(next)) {
        replacement = next.toUpperCase();
        end += 1;
      }
    } else {
      const lead = /[ \t]+$/.exec(text.slice(Math.max(0, start - WINDOW), start))?.[0] ?? '';
      start -= lead.length;
      if (text[start - 1] === ',' && text[end] === ',') end += 1;
      else if (lead.length === 0) end += /^[ \t]+/.exec(after)?.[0].length ?? 0;
    }
    return { text: replacement, start, end };
  }

  // Sentence-final punctuation carried by the replacement itself ("...action?").
  const terminal = /[.?!]$/.test(replacement);
  if (terminal) {
    const punct = /^[ \t]*[.?!]+/.exec(after);
    if (punct) end += punct[0].length;
    else if (!/^[ \t]*(?:\r?\n|$)/.test(after)) replacement = replacement.replace(/[.?!]+$/, '');
  }

  replacement = adjustCase(replacement, c.match[0], c.atSentenceStart);

  // Avoid duplicated words at the seams ("Please please ...", "... to to ...").
  const prev = c.atSentenceStart ? undefined : lastWord(text.slice(Math.max(0, start - 40), start));
  const beforeIsWordAdjacent = /[\p{L}'’][ \t]+$/u.test(text.slice(Math.max(0, start - WINDOW), start));
  if (prev && beforeIsWordAdjacent) {
    if (prev === firstWord(replacement)) {
      replacement = replacement.replace(/^[^\p{L}]*[\p{L}'’]+[ \t]*/u, '');
    } else if (POLITE_MARKERS.has(prev) && /\bplease\b/i.test(replacement)) {
      replacement = replacement.replace(/\bplease[ \t]*/i, '').trimEnd();
    }
  }
  const nextWord = /^[ \t]+([\p{L}'’]+)/u.exec(text.slice(end))?.[1]?.toLowerCase();
  if (nextWord && nextWord === lastWord(replacement) && !/[.?!,]$/.test(replacement)) {
    replacement = replacement.replace(/[ \t]*[\p{L}'’]+$/u, '');
  }

  const unchanged = replacement === text.slice(start, end);
  const extra = endPunct ? endPunctuationEdit(text, c.start, sentences, endPunct, end) : null;
  if (!extra) return unchanged ? null : { text: replacement, start, end };
  const label = `${replacement} …${endPunct}`;
  // Same words, different sentence ending: the punctuation edit is the whole change.
  if (unchanged) return { ...extra, label };
  return { text: replacement, start, end, extra: [extra], label };
}

function isBlockedByProtectedSpan(c: Range, text: string, spans: ProtectedSpan[], replacements: string[]): boolean {
  // Spans are sorted by start: binary-search the first one that could reach the candidate.
  let lo = 0;
  let hi = spans.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (spans[mid].start < c.start - MAX_SPAN) lo = mid + 1;
    else hi = mid;
  }
  for (let i = lo; i < spans.length && spans[i].start < c.end; i++) {
    const span = spans[i];
    if (!rangesOverlap(span, c)) continue;
    const inside = span.start >= c.start && span.end <= c.end;
    const spanText = text.slice(span.start, span.end);
    // A protected token may sit inside a match only if every replacement keeps it verbatim.
    if (!inside || !replacements.every((r) => r.includes(spanText))) return true;
  }
  return false;
}

export interface PhraseEngineOptions {
  /** Added to every rule priority so phrase changes outrank grammar changes on overlap. */
  basePriority?: number;
}

/** Finds every non-overlapping phrase change for `text` under the given rules. */
export function findPhraseChanges(text: string, rules: PhraseRule[], options: PhraseEngineOptions = {}): Change[] {
  if (!text.trim() || rules.length === 0) return [];
  const basePriority = options.basePriority ?? 100;
  const protectedSpans = findProtectedSpans(text);
  const sentences = getSentenceRanges(text);
  const candidates: Candidate[] = [];

  for (const rule of rules) {
    const re = compileRule(rule);
    if (!re) continue;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (m[0].length === 0) {
        re.lastIndex++;
        continue;
      }
      const start = m.index;
      const end = start + m[0].length;
      const atSentenceStart = isSentenceStart(text, start);
      if (rule.position === 'sentenceStart' && !atSentenceStart) continue;
      if (rule.unlessSentenceContains?.length) {
        const s = sentenceAt(text, start, sentences);
        const sentence = text.slice(s.start, s.end).toLowerCase();
        if (rule.unlessSentenceContains.some((p) => sentence.includes(p.toLowerCase()))) continue;
      }
      candidates.push({ rule, match: m, start, end, atSentenceStart });
    }
  }

  candidates.sort(
    (a, b) => b.rule.priority - a.rule.priority || b.end - b.start - (a.end - a.start) || a.start - b.start,
  );

  // Occupancy map: one flag per character already claimed by an accepted change.
  const taken = new Uint8Array(text.length + 1);
  const isFree = (r: Range) => {
    for (let i = r.start; i < Math.max(r.end, r.start + 1); i++) if (taken[i]) return false;
    return true;
  };
  const changes: Change[] = [];
  for (const c of candidates) {
    if (!isFree(c)) continue;
    const templates = [c.rule.replacement, ...(c.rule.alternatives ?? [])];
    const expanded = templates.map((t) => expandTemplate(t, c.match));
    if (isBlockedByProtectedSpan(c, text, protectedSpans, expanded)) continue;

    const seen = new Set<string>();
    const opts: ChangeOption[] = [];
    for (const template of templates) {
      const option = buildOption(text, c, template, sentences);
      if (!option) continue;
      const key = `${option.start}:${option.end}:${option.text}:${option.extra?.[0]?.text ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      opts.push(option);
    }
    // The preferred replacement must be usable; otherwise the rule does not apply here
    // (unless the rule asks for its alternatives to be offered regardless).
    const preferredUsable = buildOption(text, c, templates[0], sentences) !== null;
    const offerAnyway = c.rule.alwaysOffer || c.rule.suggestOnly;
    if (opts.length === 0 || (!preferredUsable && !offerAnyway)) continue;

    // Outer range: the match plus any spacing an option tidies up next to it.
    const near = opts.filter((o) => o.start <= c.end);
    const start = Math.min(c.start, ...near.map((o) => o.start));
    const end = Math.max(c.end, ...near.map((o) => o.end));
    if (!isFree({ start, end })) continue;
    taken.fill(1, start, Math.max(end, start + 1));
    changes.push({
      id: `p:${c.start}:${c.rule.id}`,
      source: 'phrase',
      label: c.rule.custom ? 'My phrase' : (TONE_LABEL[c.rule.tone] ?? 'Phrase'),
      message:
        c.rule.description ??
        (opts[0].text ? `Suggested ${c.rule.tone} wording.` : 'This phrase can be removed without changing the meaning.'),
      start,
      end,
      originalText: text.slice(start, end),
      options: opts,
      defaultOption: c.rule.suggestOnly || !preferredUsable ? -1 : 0,
      priority: basePriority + c.rule.priority,
      ruleId: c.rule.id,
    });
  }
  changes.sort((a, b) => a.start - b.start);

  // Two neighbouring replacements must not meet on the same word ("... to" + "to ...").
  for (let i = 1; i < changes.length; i++) {
    const a = changes[i - 1];
    const b = changes[i];
    if (!/^[ \t]+$/.test(text.slice(a.end, b.start))) continue;
    const seam = lastWord(a.options[0].text);
    if (!seam) continue;
    b.options = b.options.map((o) =>
      firstWord(o.text) === seam ? { ...o, text: o.text.replace(/^[^\p{L}]*[\p{L}'’]+[ \t]*/u, '') } : o,
    );
  }
  return changes;
}
