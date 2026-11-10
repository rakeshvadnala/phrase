/** The transformation modes offered by the action toolbar. */
export type ToneId = 'grammar' | 'professional' | 'polite' | 'formal' | 'friendly' | 'concise';

export const TONE_IDS: ToneId[] = ['grammar', 'professional', 'polite', 'formal', 'friendly', 'concise'];

/**
 * One phrase-transformation rule. Built-in rules live in `src/rules/*.json`;
 * user-defined rules use the same shape and are kept in LocalStorage.
 */
export interface PhraseRule {
  id: string;
  /** Human-readable phrase. Matched literally (case-insensitive, whole words) unless `pattern` is set. */
  original: string;
  /** Additional literal spellings that should behave exactly like `original`. */
  variants?: string[];
  /**
   * Optional regular-expression source used instead of the literal phrase.
   * Word boundaries are added automatically. Use `{match}` in the replacement
   * to re-insert the matched text.
   */
  pattern?: string;
  /** Preferred replacement. An empty string removes the phrase. */
  replacement: string;
  /** Other acceptable replacements the user can pick from. */
  alternatives?: string[];
  tone: ToneId;
  /** Higher numbers win when two rules overlap. */
  priority: number;
  /** Short note describing when the rule is appropriate. */
  context?: string;
  description?: string;
  /** `sentenceStart` restricts the rule to the first words of a sentence. */
  position?: 'any' | 'sentenceStart';
  /** Skip the rule when the surrounding sentence already contains one of these phrases. */
  unlessSentenceContains?: string[];
  /** True for rules created by the user. */
  custom?: boolean;
}

export type ChangeSource = 'grammar' | 'phrase' | 'cleanup';

/** One concrete way to rewrite a span of the original text. */
export interface ChangeOption {
  /** Text to insert. */
  text: string;
  /** Range of the ORIGINAL text that this option replaces. */
  start: number;
  end: number;
}

/**
 * A proposed edit, expressed against the original text. Nothing is applied
 * until the user (or the default selection) accepts one of the options.
 */
export interface Change {
  id: string;
  source: ChangeSource;
  /** Category label shown in the UI, e.g. "Spelling" or "Professional". */
  label: string;
  message: string;
  /** Outer range covered by any option (used for overlap checks and highlighting). */
  start: number;
  end: number;
  /** The affected original text (`original.slice(start, end)`). */
  originalText: string;
  options: ChangeOption[];
  /** Index of the option applied by default, or -1 when the user must opt in. */
  defaultOption: number;
  priority: number;
  ruleId?: string;
  /** Harper lint kind for grammar changes. */
  kind?: string;
}

/** Map of change id -> chosen option index (-1 = rejected). Missing ids use the default. */
export type Selection = Record<string, number>;

export type SegmentType = 'equal' | 'added' | 'removed' | 'replaced' | 'grammar';

export interface Segment {
  type: SegmentType;
  text: string;
}

export interface GrammarSuggestion {
  kind: 'replace' | 'remove' | 'insertAfter';
  text: string;
}

export interface GrammarIssue {
  start: number;
  end: number;
  problemText: string;
  /** Harper lint kind, e.g. "Spelling", "Punctuation", "Capitalization". */
  kind: string;
  kindLabel: string;
  message: string;
  suggestions: GrammarSuggestion[];
}

export type ThemeSetting = 'light' | 'dark' | 'system';
export type DialectSetting = 'American' | 'British' | 'Australian' | 'Canadian' | 'Indian';

export interface Settings {
  theme: ThemeSetting;
  dialect: DialectSetting;
  historyEnabled: boolean;
  liveGrammarCheck: boolean;
  defaultTone: ToneId;
  senderName: string;
}

export interface HistoryRecord {
  id: string;
  /** ISO timestamp of when the message was processed. */
  createdAt: string;
  tone: ToneId;
  original: string;
  improved: string;
}

export interface TemplateField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'time';
  placeholder?: string;
  required?: boolean;
}

export interface EmailTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  fields: TemplateField[];
  subject: string;
  body: string;
}
