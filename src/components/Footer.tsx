import { ShieldCheck } from 'lucide-react';

export const APP_VERSION = __APP_VERSION__;

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted sm:flex-row sm:px-6">
        <p>
          <span className="font-semibold text-brand">Phrase</span> <span aria-label={`version ${APP_VERSION}`}>v{APP_VERSION}</span>
          <span className="mx-2" aria-hidden>
            ·
          </span>
          <span className="inline-flex items-center gap-1">
            <ShieldCheck size={14} aria-hidden /> Your text never leaves this browser
          </span>
        </p>
        <nav aria-label="Footer" className="flex items-center gap-4">
          <a href="#/privacy" className="rounded hover:text-ink hover:underline">
            Privacy
          </a>
          <a href="#/about" className="rounded hover:text-ink hover:underline">
            About
          </a>
        </nav>
      </div>
    </footer>
  );
}
