import { ChevronDown, PenLine, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ComparisonView } from '../components/ComparisonView';
import { CopyButton } from '../components/CopyButton';
import { diffWords } from '../engine/comparisonEngine';
import { toneLabel } from '../engine/toneEngine';
import { useAppState } from '../hooks/useAppState';
import { navigate } from '../hooks/useHashRoute';
import { clearHistory, deleteHistoryRecord, loadHistory } from '../storage/historyStorage';
import type { HistoryRecord } from '../types';

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 'Unknown date' : dateFormat.format(d);
}

function RecordDetails({ record }: { record: HistoryRecord }) {
  const comparison = useMemo(() => diffWords(record.original, record.improved), [record]);
  return (
    <div className="border-t border-line p-4">
      <ComparisonView
        comparison={comparison}
        originalActions={<CopyButton text={record.original} label="Copy original" />}
        improvedActions={<CopyButton text={record.improved} label="Copy improved" className="btn btn-sm btn-primary" />}
      />
    </div>
  );
}

export default function History() {
  const { settings, updateSettings, setText, setTone, setResult } = useAppState();
  const [records, setRecords] = useState<HistoryRecord[]>(loadHistory);
  const [openId, setOpenId] = useState<string | null>(null);

  const reopen = (r: HistoryRecord) => {
    setText(r.original);
    setTone(r.tone);
    setResult(null);
    navigate('/');
  };

  const clearAll = () => {
    if (!window.confirm(`Delete all ${records.length} saved messages? This cannot be undone.`)) return;
    clearHistory();
    setRecords([]);
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-brand">History</h1>
          <p className="mt-1 text-muted">Recently processed messages, stored only in this browser.</p>
        </div>
        {records.length > 0 && (
          <button type="button" className="btn btn-danger" onClick={clearAll}>
            <Trash2 size={16} aria-hidden /> Clear all history
          </button>
        )}
      </div>

      <div className="card mt-6 flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="font-semibold text-ink">History is {settings.historyEnabled ? 'on' : 'off'}</p>
          <p className="text-sm text-muted">
            {settings.historyEnabled
              ? 'Each message you improve is saved here (latest 50). Turn this off to stop saving.'
              : 'Nothing you write is being saved. Turn history on to keep your recent results.'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={settings.historyEnabled}
          aria-label="Save history"
          className="btn"
          onClick={() => updateSettings({ historyEnabled: !settings.historyEnabled })}
        >
          {settings.historyEnabled ? 'Turn off' : 'Turn on history'}
        </button>
      </div>

      {records.length === 0 ? (
        <p className="card mt-4 p-8 text-center text-muted">
          {settings.historyEnabled ? 'No saved messages yet. Improve a message on the Home page and it will appear here.' : 'No saved messages.'}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {records.map((r) => {
            const open = openId === r.id;
            return (
              <li key={r.id} className="card overflow-hidden">
                <div className="flex flex-wrap items-start gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
                      <time dateTime={r.createdAt}>{formatWhen(r.createdAt)}</time>
                      <span className="badge">{toneLabel(r.tone)}</span>
                    </p>
                    <p className="mt-1 line-clamp-2 text-ink [overflow-wrap:anywhere]">{r.improved || r.original}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button type="button" className="btn btn-sm" aria-expanded={open} onClick={() => setOpenId(open ? null : r.id)}>
                      <ChevronDown size={15} aria-hidden className={`transition-transform ${open ? 'rotate-180' : ''}`} /> {open ? 'Hide' : 'View result'}
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => reopen(r)}>
                      <PenLine size={15} aria-hidden /> Open in editor
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      aria-label={`Delete message from ${formatWhen(r.createdAt)}`}
                      onClick={() => {
                        setRecords(deleteHistoryRecord(r.id));
                        if (open) setOpenId(null);
                      }}
                    >
                      <Trash2 size={15} aria-hidden /> Delete
                    </button>
                  </div>
                </div>
                {open && <RecordDetails record={r} />}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
