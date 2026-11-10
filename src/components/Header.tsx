import { Menu, Moon, Sun, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAppState } from '../hooks/useAppState';
import type { Route } from '../hooks/useHashRoute';

const NAV: Array<{ route: Route; label: string }> = [
  { route: '/', label: 'Home' },
  { route: '/library', label: 'Phrase Library' },
  { route: '/templates', label: 'Email Templates' },
  { route: '/history', label: 'History' },
  { route: '/settings', label: 'Settings' },
];

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden focusable="false">
      <rect width="64" height="64" rx="14" fill="#142B49" />
      <path d="M22 48V16h13.5c7.5 0 12.5 4.6 12.5 11.2S43 38.4 35.5 38.4H29" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="45" cy="47" r="4" fill="#14B8A6" />
    </svg>
  );
}

export function Header({ route }: { route: Route }) {
  const { settings, updateSettings } = useAppState();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [route]);

  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const dark = settings.theme === 'dark' || (settings.theme === 'system' && isDark);

  const link = (item: (typeof NAV)[number], mobile = false) => {
    const active = route === item.route;
    return (
      <a
        key={item.route}
        href={`#${item.route}`}
        aria-current={active ? 'page' : undefined}
        className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${mobile ? 'block' : ''} ${
          active ? 'bg-surface-2 text-brand' : 'text-muted hover:bg-surface-2 hover:text-ink'
        }`}
      >
        {item.label}
      </a>
    );
  };

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <a href="#/" className="flex items-center gap-2.5 rounded-lg" aria-label="Phrase – home">
          <Logo />
          <span className="text-lg font-bold tracking-tight text-brand">Phrase</span>
        </a>
        <nav aria-label="Main" className="ml-auto hidden items-center gap-1 md:flex">
          {NAV.map((item) => link(item))}
        </nav>
        <button
          type="button"
          className="btn btn-ghost btn-sm ml-auto md:ml-1"
          onClick={() => updateSettings({ theme: dark ? 'light' : 'dark' })}
          aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
          title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {dark ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
        </button>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Main" className="space-y-1 border-t border-line px-4 py-3 md:hidden">
          {NAV.map((item) => link(item, true))}
        </nav>
      )}
    </header>
  );
}
