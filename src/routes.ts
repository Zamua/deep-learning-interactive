// Every address in the app: what pages link to, and the one reading of an address the router goes by.

/** A page, as its address names it. Ids are not checked against the course here. */
export type Route =
  | { page: 'home' | 'graph' | 'list' | 'history' | 'next' | 'place' }
  | { page: 'concept'; concept: string }
  | { page: 'watch'; concept: string; track?: string }
  | { page: 'learn'; concept?: string; track?: string }
  | { page: 'track'; target: string; map: boolean }
  | { page: 'new-track'; target?: string }
  | { page: 'account'; code?: string };

const tail = (part?: string) => (part ? `/${part}` : '');

export const routes = {
  home: '#/atlas',
  graph: '#/atlas/graph',
  list: '#/atlas/list',
  history: '#/atlas/history',
  next: '#/atlas/next',
  place: '#/atlas/place',
  account: '#/account',
  concept: (id: string) => `#/atlas/${id}`,
  /** A concept's explainer; with `track`, it ends pointing along that track. */
  watch: (id: string, track?: string) => `#/atlas/${id}/watch${tail(track)}`,
  /** A practice session, opened on `id` when given, following `track` when given. */
  learn: (id?: string, track?: string) => `#/atlas/learn${id ? `/${id}${tail(track)}` : ''}`,
  track: (target: string) => `#/atlas/track/${target}`,
  trackMap: (target: string) => `#/atlas/track/${target}/map`,
  newTrack: (target?: string) => `#/atlas/new-track${tail(target)}`,
  /** A link that joins this device to an account; the code's spaces become dashes. */
  link: (code: string) => `#/link/${code.replace(/ /g, '-')}`,
} as const;

const FIXED = new Set(['graph', 'list', 'history', 'next', 'place']);

/** The page an address names, or null for an address outside the app. */
export function parseRoute(hash: string): Route | null {
  const [root = '', a = '', b = '', c = ''] = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (root === 'account') return { page: 'account' };
  if (root === 'link') return { page: 'account', code: a || undefined };
  if (root !== 'atlas') return null;
  if (!a) return { page: 'home' };
  if (FIXED.has(a)) return { page: a as 'graph' };
  if (a === 'learn') return { page: 'learn', concept: b || undefined, track: (b && c) || undefined };
  if (a === 'new-track') return { page: 'new-track', target: b || undefined };
  if (a === 'track') return { page: 'track', target: b, map: c === 'map' };
  return b === 'watch' ? { page: 'watch', concept: a, track: c || undefined } : { page: 'concept', concept: a };
}
