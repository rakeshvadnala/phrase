import { useEffect, useState } from 'react';

/**
 * Minimal hash router. Routes look like `#/library`, which GitHub Pages can
 * always serve because the server only ever sees `/`. Deep links and reloads
 * therefore work without any server-side rewrite rules.
 */

export const ROUTES = ['/', '/library', '/templates', '/history', '/settings', '/privacy', '/about'] as const;
export type Route = (typeof ROUTES)[number];

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '').replace(/\/+$/, '') || '/';
  return (ROUTES as readonly string[]).includes(path) ? (path as Route) : '/';
}

export function navigate(route: Route) {
  if (parseRoute(window.location.hash) === route) return;
  window.location.hash = route;
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
