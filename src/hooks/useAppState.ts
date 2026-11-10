import { createContext, useContext } from 'react';
import type { CustomPhraseInput } from '../storage/phraseStorage';
import type { Change, PhraseRule, Selection, Settings, ToneId } from '../types';

/** The outcome of one "Improve My Message" run. Held in memory only. */
export interface ImproveResult {
  original: string;
  tone: ToneId;
  changes: Change[];
  selection: Selection;
  /** False when the grammar engine could not be loaded; phrase rules still ran. */
  grammarAvailable: boolean;
  historyId?: string;
}

export interface AppState {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;

  text: string;
  setText: (text: string) => void;
  tone: ToneId;
  setTone: (tone: ToneId) => void;
  result: ImproveResult | null;
  setResult: (result: ImproveResult | null | ((prev: ImproveResult | null) => ImproveResult | null)) => void;

  customPhrases: PhraseRule[];
  addPhrase: (input: CustomPhraseInput) => void;
  updatePhrase: (id: string, input: CustomPhraseInput) => void;
  deletePhrase: (id: string) => void;
  favourites: string[];
  toggleFavourite: (id: string) => void;
  dictionary: string[];
  addWord: (word: string) => void;
  removeWord: (word: string) => void;

  resetEverything: () => void;
}

/**
 * The context lives in its own module (with type-only imports) so that hot
 * reloading an engine or storage file never recreates it.
 */
export const AppStateContext = createContext<AppState | null>(null);

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used inside <AppStateProvider>');
  return ctx;
}
