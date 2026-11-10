import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { PhraseRule, Settings, ToneId } from '../types';
import { AppStateContext, type AppState, type ImproveResult } from './useAppState';
import {
  addCustomPhrase,
  addDictionaryWord,
  deleteCustomPhrase,
  loadCustomPhrases,
  loadDictionary,
  loadFavourites,
  removeDictionaryWord,
  setFavourite,
  updateCustomPhrase,
} from '../storage/phraseStorage';
import { clearAllData } from '../storage/safeStorage';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../storage/settingsStorage';

function applyTheme(theme: Settings['theme']) {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', Boolean(dark));
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [text, setText] = useState('');
  const [tone, setTone] = useState<ToneId>(() => loadSettings().defaultTone);
  const [result, setResult] = useState<ImproveResult | null>(null);
  const [customPhrases, setCustomPhrases] = useState<PhraseRule[]>(loadCustomPhrases);
  const [favourites, setFavourites] = useState<string[]>(loadFavourites);
  const [dictionary, setDictionary] = useState<string[]>(loadDictionary);

  useEffect(() => {
    applyTheme(settings.theme);
    if (settings.theme !== 'system' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [settings.theme]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const value = useMemo<AppState>(
    () => ({
      settings,
      updateSettings,
      text,
      setText,
      tone,
      setTone,
      result,
      setResult,
      customPhrases,
      addPhrase: (input) => setCustomPhrases(addCustomPhrase(input)),
      updatePhrase: (id, input) => setCustomPhrases(updateCustomPhrase(id, input)),
      deletePhrase: (id) => {
        setCustomPhrases(deleteCustomPhrase(id));
        setFavourites(loadFavourites());
      },
      favourites,
      toggleFavourite: (id) => setFavourites((prev) => setFavourite(id, !prev.includes(id))),
      dictionary,
      addWord: (word) => setDictionary(addDictionaryWord(word)),
      removeWord: (word) => setDictionary(removeDictionaryWord(word)),
      resetEverything: () => {
        clearAllData();
        setSettings(DEFAULT_SETTINGS);
        setCustomPhrases([]);
        setFavourites([]);
        setDictionary([]);
        setResult(null);
        setText('');
        setTone(DEFAULT_SETTINGS.defaultTone);
      },
    }),
    [settings, updateSettings, text, tone, result, customPhrases, favourites, dictionary],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}
