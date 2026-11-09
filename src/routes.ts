// Every address in the app: what pages link to, and the one reading of an address the router goes by.

/** The views of the one place for looking around a book. */
export const EXPLORE_VIEWS = ['chapters', 'map', 'list', 'goals', 'history'] as const;
export type ExploreView = (typeof EXPLORE_VIEWS)[number];

/** The course that was once the whole site. Its addresses stay `#/atlas/...`, so old links and reminders still work. */
export const FIRST_COURSE = 'dl';

/** A course's page, as its address names it. Ids are not checked against the course here. */
export type CourseRoute = { course: string } & (
  | { page: 'home' | 'list' | 'history' | 'next' | 'place' }
  | { page: 'explore'; view: ExploreView }
  /** The map, on one part of the course. Without `part`, the part the learner is in. */
  | { page: 'graph'; part?: string }
  | { page: 'concept'; concept: string }
  | { page: 'watch'; concept: string; track?: string }
  | { page: 'learn'; concept?: string; track?: string }
  | { page: 'track'; target: string; map: boolean }
  | { page: 'new-track'; target?: string }
);

/** The pages that belong to the site rather than to a course. */
export type SitePage = 'shelf' | 'review' | 'path' | 'settings';

export type Route = CourseRoute | { page: SitePage } | { page: 'account'; code?: string };

const tail = (part?: string) => (part ? `/${part}` : '');

/** The addresses of one course's pages. */
export function coursePages(course: string) {
  const base = course === FIRST_COURSE ? '#/atlas' : `#/c/${course}`;
  return {
    home: base,
    explore: (view: ExploreView = 'chapters') => `${base}/explore/${view}`,
    graph: `${base}/graph`,
    part: (id: string) => `${base}/graph/${id}`,
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
  shelf: '#/',
  review: '#/review',
  path: '#/path',
  settings: '#/settings',
  account: '#/account',
  /** A link that joins this device to an account; the code's spaces become dashes. */
  link: (code: string) => `#/link/${code.replace(/ /g, '-')}`,
} as const;

const FIXED = new Set(['list', 'history', 'next', 'place']);
const SITE = new Set<string>(['review', 'path', 'settings']);

function coursePage(course: string, [a = '', b = '', c = '']: string[]): CourseRoute {
  if (!a) return { course, page: 'home' };
  if (FIXED.has(a)) return { course, page: a as 'list' };
  if (a === 'explore') return { course, page: 'explore', view: (EXPLORE_VIEWS as readonly string[]).includes(b) ? (b as ExploreView) : 'chapters' };
  if (a === 'graph') return { course, page: 'graph', part: b || undefined };
  if (a === 'learn') return { course, page: 'learn', concept: b || undefined, track: (b && c) || undefined };
  if (a === 'new-track') return { course, page: 'new-track', target: b || undefined };
  if (a === 'track') return { course, page: 'track', target: b, map: c === 'map' };
  return b === 'watch' ? { course, page: 'watch', concept: a, track: c || undefined } : { course, page: 'concept', concept: a };
}

/** The page an address names, or null for an address outside the app. */
export function parseRoute(hash: string): Route | null {
  const [root = '', a = '', ...rest] = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (!root) return { page: 'shelf' };
  if (SITE.has(root)) return { page: root as SitePage };
  if (root === 'account') return { page: 'account' };
  if (root === 'link') return { page: 'account', code: a || undefined };
  if (root === 'atlas') return coursePage(FIRST_COURSE, a ? [a, ...rest] : []);
  if (root === 'c' && a) return coursePage(a, rest);
  return null;
}
