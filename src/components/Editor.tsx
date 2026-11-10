import { ClipboardPaste, Eraser } from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { Range } from '../engine/textUtils';
import type { GrammarStatus } from '../hooks/useGrammarCheck';
import { TextStatistics } from './TextStatistics';

export interface Highlight extends Range {
  spelling?: boolean;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Ranges of `value` to underline. Ignored if they do not fit the current text. */
  highlights: Highlight[];
  status: GrammarStatus;
  issueCount: number;
  liveCheckEnabled: boolean;
  liveCheckPaused: boolean;
  onSubmit: () => void;
}

/** Splits the text into plain and underlined runs for the backdrop layer. */
function renderBackdrop(text: string, highlights: Highlight[]): ReactNode[] {
  const out: ReactNode[] = [];
  let cursor = 0;
  for (const h of highlights) {
    if (h.start < cursor || h.end > text.length || h.end <= h.start) continue;
    if (h.start > cursor) out.push(text.slice(cursor, h.start));
    out.push(
      <mark key={h.start} className={`editor-mark ${h.spelling ? 'editor-mark-spelling' : ''}`}>
        {text.slice(h.start, h.end)}
      </mark>,
    );
    cursor = h.end;
  }
  out.push(text.slice(cursor));
  out.push('\n'); // keeps the last line's height in sync with the textarea
  return out;
}

export function Editor({ value, onChange, highlights, status, issueCount, liveCheckEnabled, liveCheckPaused, onSubmit }: Props) {
  const area = useRef<HTMLTextAreaElement>(null);
  const [notice, setNotice] = useState('');

  // Auto-grow so the textarea and the highlight layer always have identical geometry.
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    const fit = () => {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    };
    fit();
    // Text re-wraps when the width changes (rotation, window resize), so re-measure then too.
    let width = el.clientWidth;
    const refit = () => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      fit();
    };
    window.addEventListener('resize', refit);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(refit);
    observer?.observe(el);
    return () => {
      window.removeEventListener('resize', refit);
      observer?.disconnect();
    };
  }, [value]);

  const backdrop = useMemo(() => renderBackdrop(value, highlights), [value, highlights]);

  const paste = async () => {
    setNotice('');
    try {
      const clip = await navigator.clipboard.readText();
      if (!clip) {
        setNotice('The clipboard is empty.');
        return;
      }
      const el = area.current;
      const start = el?.selectionStart ?? value.length;
      const end = el?.selectionEnd ?? value.length;
      onChange(value.slice(0, start) + clip + value.slice(end));
      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(start + clip.length, start + clip.length);
      });
    } catch {
      setNotice('Clipboard access was blocked. Press Ctrl+V (⌘V on Mac) to paste instead.');
      area.current?.focus();
    }
  };

  const clear = () => {
    setNotice('');
    onChange('');
    area.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onSubmit();
    }
  };

  let statusText = '';
  if (!liveCheckEnabled) statusText = 'Live grammar check is off';
  else if (liveCheckPaused) statusText = 'Live check paused for long text – use Improve My Message';
  else if (status === 'loading') statusText = 'Loading grammar engine…';
  else if (status === 'checking') statusText = 'Checking…';
  else if (status === 'error') statusText = 'Grammar engine unavailable';
  else if (status === 'ready') statusText = issueCount === 0 ? 'No issues found' : `${issueCount} possible ${issueCount === 1 ? 'issue' : 'issues'}`;

  return (
    <section className="card overflow-hidden" aria-label="Writing editor">
      <div className="relative">
        <div className="editor-layer pointer-events-none absolute inset-0 select-none text-transparent" aria-hidden>
          {backdrop}
        </div>
        <textarea
          ref={area}
          id="editor"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          rows={8}
          spellCheck={false}
          autoFocus
          placeholder="Type or paste your message here…"
          aria-label="Your message"
          aria-describedby="editor-help"
          className="editor-layer relative block min-h-56 w-full resize-none overflow-hidden bg-transparent text-ink placeholder:text-muted/70 focus:outline-none"
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line bg-surface-2/50 px-4 py-2.5">
        <TextStatistics text={value} />
        <p
          role="status"
          aria-live="polite"
          className={`text-sm ${status === 'error' ? 'text-warning' : status === 'ready' && issueCount > 0 && !liveCheckPaused ? 'font-medium text-error dark:text-red-400' : 'text-muted'}`}
        >
          {statusText}
        </p>
        <div className="ml-auto flex gap-2">
          <button type="button" className="btn btn-sm" onClick={paste}>
            <ClipboardPaste size={16} aria-hidden /> Paste
          </button>
          <button type="button" className="btn btn-sm" onClick={clear} disabled={!value}>
            <Eraser size={16} aria-hidden /> Clear
          </button>
        </div>
      </div>
      {notice && (
        <p role="alert" className="border-t border-line px-4 py-2 text-sm text-warning">
          {notice}
        </p>
      )}
      <p id="editor-help" className="sr-only">
        Press Control or Command plus Enter to improve your message.
      </p>
    </section>
  );
}
