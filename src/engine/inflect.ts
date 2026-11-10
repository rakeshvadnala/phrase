/**
 * Minimal, deterministic verb inflection used by sentence-pattern rules
 * ("Can you send ..." -> "Would you mind sending ...").
 *
 * Only the verbs in REQUEST_VERBS are ever inflected, so the small rule set
 * below does not have to cope with the whole of English.
 */

/** Base-form verbs (and a few fixed verb phrases) that commonly follow a workplace request. */
export const REQUEST_VERBS = [
  'look into', 'let me know', 'make sure', 'roll back', 'follow up', 'set up', 'sign off', 'get back', 'find out', 'take care of',
  'add', 'address', 'advise', 'allow', 'approve', 'arrange', 'ask', 'assign', 'assist', 'attach', 'attend', 'book', 'bring', 'call',
  'cancel', 'change', 'check', 'clarify', 'close', 'complete', 'confirm', 'connect', 'consider', 'contact', 'create', 'delete',
  'deploy', 'disable', 'discuss', 'do', 'email', 'enable', 'ensure', 'escalate', 'explain', 'extend', 'finish', 'fix', 'forward',
  'get', 'give', 'grant', 'handle', 'help', 'include', 'inform', 'install', 'investigate', 'join', 'keep', 'make', 'merge', 'move',
  'notify', 'open', 'organize', 'plan', 'prepare', 'prioritize', 'proceed', 'process', 'provide', 'raise', 'read', 'remove',
  'reply', 'reschedule', 'reset', 'resolve', 'respond', 'restart', 'review', 'run', 'schedule', 'send', 'share', 'show', 'sign',
  'start', 'stop', 'submit', 'support', 'take', 'tell', 'test', 'unlock', 'update', 'upload', 'validate', 'verify', 'wait', 'write',
];

/** Regex source matching any request verb (longest first so "look into" wins over "look"). */
export const REQUEST_VERB_SOURCE = `(?:${[...REQUEST_VERBS]
  .sort((a, b) => b.length - a.length)
  .map((v) => v.replace(/ /g, '[ \\t]+'))
  .join('|')})`;

/** Verbs whose final consonant doubles before -ing. */
const DOUBLING = new Set([
  'run', 'get', 'stop', 'set', 'put', 'plan', 'begin', 'submit', 'ship', 'drop', 'chat', 'log', 'swap', 'cut', 'let', 'sit', 'skip',
  'forget', 'commit', 'refer', 'permit', 'admit', 'reset', 'debug', 'tag', 'scan', 'map', 'plug', 'zip', 'step', 'wrap',
  'transfer', 'occur', 'prefer', 'upset', 'grab',
]);

const IRREGULAR_GERUND: Record<string, string> = { be: 'being', see: 'seeing', agree: 'agreeing', free: 'freeing', die: 'dying', lie: 'lying', tie: 'tying' };

function gerundOfWord(word: string): string {
  const w = word.toLowerCase();
  if (IRREGULAR_GERUND[w]) return IRREGULAR_GERUND[w];
  if (w.endsWith('ie')) return `${w.slice(0, -2)}ying`;
  if (w.endsWith('e') && !/(?:ee|ye|oe)$/.test(w)) return `${w.slice(0, -1)}ing`;
  if (DOUBLING.has(w)) return `${w}${w[w.length - 1]}ing`;
  return `${w}ing`;
}

/**
 * Returns the -ing form of a base verb. For a verb phrase only the first
 * word changes: "look into" -> "looking into", "let me know" -> "letting me know".
 */
export function toGerund(verb: string): string {
  const trimmed = verb.trim();
  if (!trimmed) return '';
  const [first, ...rest] = trimmed.split(/\s+/);
  return [gerundOfWord(first), ...rest].join(' ');
}
