import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/** Copies text with the async Clipboard API, falling back to execCommand. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

interface Props {
  text: string;
  label?: string;
  className?: string;
  disabled?: boolean;
  /** Hide the text label on small buttons (the label is still announced). */
  iconOnly?: boolean;
}

export function CopyButton({ text, label = 'Copy', className = 'btn btn-sm', disabled, iconOnly }: Props) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const onClick = async () => {
    const ok = await copyText(text);
    setState(ok ? 'copied' : 'failed');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 1800);
  };

  const shown = state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : label;
  return (
    <button type="button" className={className} onClick={onClick} disabled={disabled || !text} aria-label={iconOnly ? shown : undefined} title={iconOnly ? shown : undefined}>
      {state === 'copied' ? <Check size={16} aria-hidden className="text-success" /> : <Copy size={16} aria-hidden />}
      {!iconOnly && <span aria-live="polite">{shown}</span>}
    </button>
  );
}
