import { Loader2, Sparkles } from 'lucide-react';
import { useRef, type KeyboardEvent } from 'react';
import { TONES } from '../engine/toneEngine';
import type { ToneId } from '../types';

interface Props {
  tone: ToneId;
  onToneChange: (tone: ToneId) => void;
  onImprove: () => void;
  busy: boolean;
  busyLabel: string;
  disabled: boolean;
}

export function ActionToolbar({ tone, onToneChange, onImprove, busy, busyLabel, disabled }: Props) {
  const group = useRef<HTMLDivElement>(null);
  const active = TONES.find((t) => t.id === tone)!;

  // Radio-group keyboard behaviour: arrow keys move the selection.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const index = TONES.findIndex((t) => t.id === tone);
    const next = TONES[(index + delta + TONES.length) % TONES.length];
    onToneChange(next.id);
    group.current?.querySelector<HTMLButtonElement>(`[data-tone="${next.id}"]`)?.focus();
  };

  return (
    <section className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center" aria-label="Actions">
      <div className="min-w-0 flex-1">
        <div ref={group} role="radiogroup" aria-label="Choose how to improve your message" className="flex flex-wrap gap-2" onKeyDown={onKeyDown}>
          {TONES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              data-tone={t.id}
              aria-checked={t.id === tone}
              tabIndex={t.id === tone ? 0 : -1}
              className="chip"
              onClick={() => onToneChange(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted">{active.description}</p>
      </div>
      <button type="button" className="btn btn-primary h-12 shrink-0 px-6 text-base" onClick={onImprove} disabled={disabled || busy} title="Ctrl + Enter">
        {busy ? <Loader2 size={18} aria-hidden className="animate-spin" /> : <Sparkles size={18} aria-hidden />}
        <span aria-live="polite">{busy ? busyLabel : 'Improve My Message'}</span>
      </button>
    </section>
  );
}
