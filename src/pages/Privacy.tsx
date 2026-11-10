import { ShieldCheck } from 'lucide-react';

const POINTS: Array<[string, string]> = [
  ['Your text stays on your device', 'Everything you type, paste or generate is processed inside this browser tab. Phrase has no server, no account system and no database, so there is nowhere for your text to be sent.'],
  ['No AI services', 'Phrase does not call OpenAI, Claude, Gemini or any other AI, grammar or text-processing API. Grammar checking is done by the Harper engine running locally as WebAssembly; rephrasing is done by fixed, readable rule files.'],
  ['No analytics, tracking or cookies', 'There are no analytics scripts, advertising pixels, third-party fonts or tracking cookies. The only network requests are for the application files themselves, loaded from the same site.'],
  ['Nothing is saved unless you choose to', 'History is off by default. Your message is held in memory only and disappears when you close or reload the tab. If you turn history on, the latest 50 results are stored in this browser’s LocalStorage.'],
  ['What is stored locally', 'Only what you create: settings (theme, dialect, default mode, your name for email templates), custom phrases, favourite phrases, personal-dictionary words and — if enabled — history. None of it leaves your browser.'],
  ['You are in control', 'Delete individual history records or clear all history on the History page. “Delete all stored data” in Settings removes everything Phrase has saved. Clearing your browser’s site data has the same effect.'],
  ['Works offline', 'After the first visit the application files, rule libraries and grammar engine are cached by your browser, so Phrase keeps working without a network connection (subject to your browser’s cache).'],
  ['Hosting', 'The site is static and hosted on GitHub Pages. Like any web host, GitHub may log technical request data such as IP addresses when the files are downloaded; Phrase itself never sees or receives that data, and it never includes your text.'],
];

export default function Privacy() {
  return (
    <article className="mx-auto max-w-3xl">
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-brand">
        <ShieldCheck size={26} aria-hidden className="text-accent" /> Privacy
      </h1>
      <p className="mt-2 text-lg text-muted">Phrase is private by design: your writing is processed entirely in your browser and is never transmitted anywhere.</p>
      <dl className="card mt-6 divide-y divide-line">
        {POINTS.map(([title, body]) => (
          <div key={title} className="p-4 sm:p-5">
            <dt className="font-semibold text-ink">{title}</dt>
            <dd className="mt-1 text-muted">{body}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
