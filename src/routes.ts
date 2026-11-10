// Every address in the app: what pages link to, and the one reading of an address the router goes by.

/** The course that was once the whole site. Its addresses stay `#/atlas/...`, so old links and reminders still work. */
export const FIRST_COURSE = 'dl';

/** A course's page, as its address names it. Ids are not checked against the course here. */
export type CourseRoute = { course: string } & (
  | { page: 'home' | 'graph' | 'list' | 'history' | 'next' | 'place' }
  | { page: 'concept'; concept: string }
  | { page: 'watch'; concept: string; track?: string }
  | { page: 'learn'; concept?: string; track?: string }
  | { page: 'track'; target: string; map: boolean }
  | { page: 'new-track'; target?: string }
);

export type Route = CourseRoute | { page: 'account'; code?: string };

const tail = (part?: string) => (part ? `/${part}` : '');

/** The addresses of one course's pages. */
export function coursePages(course: string) {
  const base = course === FIRST_COURSE ? '#/atlas' : `#/c/${course}`;
  return {
    home: base,
    graph: `${base}/graph`,
    list: `${base}/list`,
    history: `${base}/history`,
    next: `${base}/next`,
    place: `${base}/place`,
    concept: (id: string) => `${base}/${id}`,
    /** A concept's explainer; with `track`, it ends pointing along that track. */
    watch: (id: string, track?: string) => `${base}/${id}/watch${tail(track)}`,
    /** A practice session, opened on `id` when given, following `track` when given. */
    learn: (id?: string, track?: string) => `${base}/learn${id ? `/${id}${tail(track)}` : ''}`,
    track: (target: string) => `${base}/track/${target}`,
    trackMap: (target: string) => `${base}/track/${target}/map`,
    newTrack: (target?: string) => `${base}/new-track${tail(target)}`,
  };
}
export type CoursePages = ReturnType<typeof coursePages>;

/** The addresses that belong to the site rather than to a course. */
export const routes = {
  account: '#/account',
  /** A link that joins this device to an account; the code's spaces become dashes. */
  link: (code: string) => `#/link/${code.replace(/ /g, '-')}`,
} as const;

const FIXED = new Set(['graph', 'list', 'history', 'next', 'place']);

function coursePage(course: string, [a = '', b = '', c = '']: string[]): CourseRoute {
  if (!a) return { course, page: 'home' };
  if (FIXED.has(a)) return { course, page: a as 'graph' };
  if (a === 'learn') return { course, page: 'learn', concept: b || undefined, track: (b && c) || undefined };
  if (a === 'new-track') return { course, page: 'new-track', target: b || undefined };
  if (a === 'track') return { course, page: 'track', target: b, map: c === 'map' };
  return b === 'watch' ? { course, page: 'watch', concept: a, track: c || undefined } : { course, page: 'concept', concept: a };
}

/** The page an address names, or null for an address outside the app. */
export function parseRoute(hash: string): Route | null {
  const [root = '', a = '', ...rest] = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (root === 'account') return { page: 'account' };
  if (root === 'link') return { page: 'account', code: a || undefined };
  if (root === 'atlas') return coursePage(FIRST_COURSE, a ? [a, ...rest] : []);
  if (root === 'c' && a) return coursePage(a, rest);
  return null;
}
