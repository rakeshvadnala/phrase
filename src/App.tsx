import { Component, lazy, Suspense, useEffect, useRef, type ReactNode } from 'react';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { useHashRoute, type Route } from './hooks/useHashRoute';
import Home from './pages/Home';

// Secondary pages are split into their own chunks and loaded on demand.
const PhraseLibrary = lazy(() => import('./pages/PhraseLibrary'));
const EmailTemplates = lazy(() => import('./pages/EmailTemplates'));
const History = lazy(() => import('./pages/History'));
const Settings = lazy(() => import('./pages/Settings'));
const Privacy = lazy(() => import('./pages/Privacy'));
const About = lazy(() => import('./pages/About'));

const TITLES: Record<Route, string> = {
  '/': 'Phrase – Write clearly. Communicate professionally.',
  '/library': 'Phrase Library – Phrase',
  '/templates': 'Email Templates – Phrase',
  '/history': 'History – Phrase',
  '/settings': 'Settings – Phrase',
  '/privacy': 'Privacy – Phrase',
  '/about': 'About – Phrase',
};

function Page({ route }: { route: Route }) {
  switch (route) {
    case '/library':
      return <PhraseLibrary />;
    case '/templates':
      return <EmailTemplates />;
    case '/history':
      return <History />;
    case '/settings':
      return <Settings />;
    case '/privacy':
      return <Privacy />;
    case '/about':
      return <About />;
    default:
      return <Home />;
  }
}

class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="card mx-auto max-w-xl p-6 text-center">
        <h1 className="text-lg font-semibold text-brand">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted">This page could not be displayed. Your saved data has not been affected.</p>
        <button type="button" className="btn btn-primary mt-4" onClick={() => window.location.reload()}>
          Reload Phrase
        </button>
      </div>
    );
  }
}

export default function App() {
  const route = useHashRoute();
  const main = useRef<HTMLElement>(null);
  const first = useRef(true);

  useEffect(() => {
    document.title = TITLES[route];
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo(0, 0);
    main.current?.focus({ preventScroll: true });
  }, [route]);

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" onClick={(e) => { e.preventDefault(); main.current?.focus(); }} className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:shadow">
        Skip to content
      </a>
      <Header route={route} />
      <main id="main" ref={main} tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 outline-none sm:px-6 sm:pt-12">
        <ErrorBoundary resetKey={route}>
          <Suspense fallback={<p role="status" className="py-16 text-center text-sm text-muted">Loading…</p>}>
            <Page route={route} />
          </Suspense>
        </ErrorBoundary>
      </main>
      <Footer />
    </div>
  );
}
