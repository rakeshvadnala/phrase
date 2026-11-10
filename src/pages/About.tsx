import { APP_VERSION } from '../components/Footer';
import { Logo } from '../components/Header';
import { ALL_BUILTIN_RULES, TONES } from '../engine/toneEngine';

export default function About() {
  return (
    <article className="mx-auto max-w-3xl">
      <div className="flex items-center gap-3">
        <Logo size={44} />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-brand">About Phrase</h1>
          <p className="text-muted">Version {APP_VERSION} · Write clearly. Communicate professionally.</p>
        </div>
      </div>

      <div className="card mt-6 space-y-4 p-4 text-ink sm:p-6">
        <p>
          Phrase is a professional writing and grammar assistant for everyday workplace communication: emails, Teams and chat messages, LinkedIn notes and
          general business English.
        </p>
        <p>
          It is deliberately <strong>not</strong> an AI product. Every suggestion comes from one of two deterministic sources:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Grammar and spelling</strong> — the open-source{' '}
            <a className="text-accent underline" href="https://writewithharper.com" target="_blank" rel="noreferrer noopener">Harper</a>{' '}
            grammar checker, running locally in your browser as WebAssembly.
          </li>
          <li>
            <strong>Rephrasing and tone</strong> — {ALL_BUILTIN_RULES.length} hand-written phrase rules across {TONES.length} modes, plus any phrases you add
            yourself. The same input always produces the same output.
          </li>
        </ul>

        <h2 className="pt-2 text-lg font-semibold text-brand">What to expect</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>Phrase recognises phrases, not meaning. It will not restructure paragraphs or understand context beyond what its rules describe.</li>
          <li>Your original text is never changed silently. Every change is listed, and each one can be swapped for an alternative or rejected.</li>
          <li>Names, numbers, dates, links, e-mail addresses, code and quoted text are left untouched.</li>
          <li>Spelling suggestions for unfamiliar words are offered for review rather than applied automatically.</li>
        </ul>

        <h2 className="pt-2 text-lg font-semibold text-brand">Keyboard shortcuts</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li><kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-sans text-sm">Ctrl</kbd> / <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-sans text-sm">⌘</kbd> + <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-sans text-sm">Enter</kbd> in the editor — improve the message</li>
          <li>Arrow keys on the mode selector — switch mode</li>
        </ul>

        <h2 className="pt-2 text-lg font-semibold text-brand">Open-source components</h2>
        <p className="text-muted">
          Harper (Apache-2.0), React (MIT), Tailwind CSS (MIT), Lucide icons (ISC) and the Inter typeface (OFL-1.1). All are bundled with the application;
          nothing is loaded from third-party servers.
        </p>
      </div>
    </article>
  );
}
