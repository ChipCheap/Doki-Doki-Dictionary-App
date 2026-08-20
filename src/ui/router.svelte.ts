/**
 * H3 — a minimal hash router.
 *
 * Under a dozen screens and no server, so this is a route name plus a params
 * bag rather than a routing library. Hash-based because the app is served from
 * a project subpath on static hosting, where path routing needs server rewrites
 * the service worker would then have to duplicate.
 */

export type RouteName =
  | 'home'
  | 'firstRun'
  | 'installPack'
  | 'newVocabulary'
  | 'quiz'
  | 'summary'
  | 'settings'
  | 'transfer'
  | 'keyboardHelp';

export interface Route {
  name: RouteName;
  params: Record<string, string>;
}

const DEFAULT: Route = { name: 'home', params: {} };

function parse(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '');
  if (raw.length === 0) return DEFAULT;

  const [name, query] = raw.split('?');
  const params: Record<string, string> = {};

  if (query) {
    for (const [key, value] of new URLSearchParams(query)) params[key] = value;
  }

  return { name: (name as RouteName) || 'home', params };
}

function stringify(name: RouteName, params: Record<string, string> = {}): string {
  const query = new URLSearchParams(params).toString();
  return `#/${name}${query ? `?${query}` : ''}`;
}

/** Svelte 5 rune-based store. Components read `router.current`. */
class Router {
  current = $state<Route>(DEFAULT);

  start(): () => void {
    const sync = () => {
      this.current = parse(window.location.hash);
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }

  go(name: RouteName, params: Record<string, string> = {}): void {
    window.location.hash = stringify(name, params);
  }

  /** Navigate without adding a history entry — used after a session ends. */
  replace(name: RouteName, params: Record<string, string> = {}): void {
    window.history.replaceState(null, '', stringify(name, params));
    this.current = { name, params };
  }
}

export const router = new Router();
