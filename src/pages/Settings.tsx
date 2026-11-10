import { AlertTriangle, Trash2, X } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { TONES } from '../engine/toneEngine';
import { useAppState } from '../hooks/useAppState';
import { loadHistory } from '../storage/historyStorage';
import { isStorageAvailable } from '../storage/safeStorage';
import type { DialectSetting, ThemeSetting, ToneId } from '../types';

const DIALECTS: DialectSetting[] = ['American', 'British', 'Australian', 'Canadian', 'Indian'];
const THEMES: Array<{ id: ThemeSetting; label: string }> = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'Match system' },
];

function Row({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-line py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-semibold text-ink">{title}</p>
        <p className="text-sm text-muted">{description}</p>
      </div>
      <div className="shrink-0 sm:w-64">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 rounded-full border transition-colors ${checked ? 'border-teal bg-teal' : 'border-line bg-surface-2'}`}
    >
      <span className={`absolute top-0.5 h-5.5 w-5.5 rounded-full bg-white shadow transition-all ${checked ? 'left-[1.45rem]' : 'left-0.5'}`} />
    </button>
  );
}

export default function Settings() {
  const { settings, updateSettings, dictionary, addWord, removeWord, customPhrases, resetEverything } = useAppState();
  const [word, setWord] = useState('');
  const storageOk = isStorageAvailable();

  const submitWord = (e: FormEvent) => {
    e.preventDefault();
    if (word.trim()) addWord(word);
    setWord('');
  };

  const wipe = () => {
    const history = loadHistory().length;
    const summary = `${customPhrases.length} custom phrase(s), ${dictionary.length} dictionary word(s), ${history} history record(s) and all settings`;
    if (window.confirm(`Delete everything Phrase has stored in this browser?\n\nThis removes ${summary}. It cannot be undone.`)) resetEverything();
  };

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-brand">Settings</h1>
      <p className="mt-1 text-muted">Preferences are saved in this browser only.</p>

      {!storageOk && (
        <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
          <AlertTriangle size={18} aria-hidden className="mt-0.5 shrink-0" />
          Browser storage is unavailable (for example in private browsing). Phrase still works, but settings, phrases and history will be lost when you close this tab.
        </p>
      )}

      <section className="card mt-6 px-4 sm:px-5" aria-label="Appearance and writing">
        <Row title="Theme" description="Light is the default. Dark mode is easier on the eyes at night.">
          <select className="input" aria-label="Theme" value={settings.theme} onChange={(e) => updateSettings({ theme: e.target.value as ThemeSetting })}>
            {THEMES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </Row>
        <Row title="English dialect" description="Used by the grammar and spelling checker.">
          <select className="input" aria-label="English dialect" value={settings.dialect} onChange={(e) => updateSettings({ dialect: e.target.value as DialectSetting })}>
            {DIALECTS.map((d) => <option key={d} value={d}>{d} English</option>)}
          </select>
        </Row>
        <Row title="Default mode" description="The mode selected when you open Phrase.">
          <select className="input" aria-label="Default mode" value={settings.defaultTone} onChange={(e) => updateSettings({ defaultTone: e.target.value as ToneId })}>
            {TONES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </Row>
        <Row title="Check grammar while typing" description="Underlines possible issues in the editor shortly after you stop typing.">
          <Toggle checked={settings.liveGrammarCheck} onChange={(v) => updateSettings({ liveGrammarCheck: v })} label="Check grammar while typing" />
        </Row>
        <Row title="Your name" description="Pre-fills the sender field in email templates.">
          <input className="input" aria-label="Your name" value={settings.senderName} maxLength={100} onChange={(e) => updateSettings({ senderName: e.target.value })} />
        </Row>
      </section>

      <section className="card mt-6 px-4 sm:px-5" aria-label="Privacy">
        <Row title="Save history" description="Off by default. When on, the latest 50 processed messages are kept in this browser.">
          <Toggle checked={settings.historyEnabled} onChange={(v) => updateSettings({ historyEnabled: v })} label="Save history" />
        </Row>
      </section>

      <section className="card mt-6 p-4 sm:p-5" aria-labelledby="dictionary-heading">
        <h2 id="dictionary-heading" className="font-semibold text-ink">Personal dictionary</h2>
        <p className="text-sm text-muted">Names, product names and technical terms listed here are never flagged as spelling mistakes.</p>
        <form onSubmit={submitWord} className="mt-3 flex gap-2">
          <input className="input" aria-label="Word to add" placeholder="Add a word…" value={word} maxLength={60} onChange={(e) => setWord(e.target.value)} />
          <button type="submit" className="btn shrink-0" disabled={!word.trim()}>Add</button>
        </form>
        {dictionary.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No words added yet.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {dictionary.map((w) => (
              <li key={w} className="chip !pr-1.5">
                {w}
                <button type="button" className="rounded-full p-0.5 text-muted hover:bg-surface-2 hover:text-ink" aria-label={`Remove ${w}`} onClick={() => removeWord(w)}>
                  <X size={14} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card mt-6 p-4 sm:p-5" aria-labelledby="data-heading">
        <h2 id="data-heading" className="font-semibold text-ink">Your data</h2>
        <p className="text-sm text-muted">Remove every setting, custom phrase, favourite, dictionary word and history record that Phrase has stored in this browser.</p>
        <button type="button" className="btn btn-danger mt-3" onClick={wipe}>
          <Trash2 size={16} aria-hidden /> Delete all stored data
        </button>
      </section>
    </>
  );
}
