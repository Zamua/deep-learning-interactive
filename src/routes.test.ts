import { describe, expect, it } from 'vitest';
import { coursePages, FIRST_COURSE, parseRoute, routes, type Route } from './routes';

describe('routes', () => {
  it('reads back every address it builds', () => {
    const course = FIRST_COURSE;
    const pages = coursePages(course);
    const cases: [string, Route][] = [
      [pages.home, { course, page: 'home' }],
      [pages.graph, { course, page: 'graph' }],
      [pages.list, { course, page: 'list' }],
      [pages.history, { course, page: 'history' }],
      [pages.next, { course, page: 'next' }],
      [pages.place, { course, page: 'place' }],
      [pages.concept('softmax'), { course, page: 'concept', concept: 'softmax' }],
      [pages.watch('softmax'), { course, page: 'watch', concept: 'softmax' }],
      [pages.watch('softmax', 'attention'), { course, page: 'watch', concept: 'softmax', track: 'attention' }],
      [pages.learn(), { course, page: 'learn' }],
      [pages.learn('softmax'), { course, page: 'learn', concept: 'softmax' }],
      [pages.learn('softmax', 'attention'), { course, page: 'learn', concept: 'softmax', track: 'attention' }],
      [pages.track('attention'), { course, page: 'track', target: 'attention', map: false }],
      [pages.trackMap('attention'), { course, page: 'track', target: 'attention', map: true }],
      [pages.newTrack(), { course, page: 'new-track' }],
      [pages.newTrack('attention'), { course, page: 'new-track', target: 'attention' }],
      [routes.topics, { page: 'topics' }],
      ['', { page: 'topics' }],
      [routes.account, { page: 'account' }],
      [routes.link('ab3 k9z'), { page: 'account', code: 'ab3-k9z' }],
    ];
    for (const [hash, route] of cases) expect(parseRoute(hash), hash).toEqual(route);
  });

  it('reads an address outside the app as null', () => {
    expect(parseRoute('#/chapters/3')).toBeNull();
    expect(parseRoute('#/atlas/')).toEqual({ course: FIRST_COURSE, page: 'home' });
  });

  it('gives every other course its own addresses, with the same pages', () => {
    const nix = coursePages('nix');
    expect(nix.watch('nix.derivation')).toBe('#/c/nix/nix.derivation/watch');
    expect(parseRoute(nix.home)).toEqual({ course: 'nix', page: 'home' });
    expect(parseRoute(nix.graph)).toEqual({ course: 'nix', page: 'graph' });
    expect(parseRoute(nix.learn('nix.derivation'))).toEqual({ course: 'nix', page: 'learn', concept: 'nix.derivation' });
    expect(parseRoute(nix.watch('nix.derivation'))).toEqual({ course: 'nix', page: 'watch', concept: 'nix.derivation' });
    expect(parseRoute('#/c')).toBeNull();
  });

  it('keeps the first course at its old addresses', () => {
    expect(coursePages(FIRST_COURSE).concept('softmax')).toBe('#/atlas/softmax');
  });
});
