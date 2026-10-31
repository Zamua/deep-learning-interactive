import { describe, expect, it } from 'vitest';
import { parseRoute, routes, type Route } from './routes';

describe('routes', () => {
  it('reads back every address it builds', () => {
    const cases: [string, Route][] = [
      [routes.home, { page: 'home' }],
      [routes.graph, { page: 'graph' }],
      [routes.list, { page: 'list' }],
      [routes.history, { page: 'history' }],
      [routes.next, { page: 'next' }],
      [routes.place, { page: 'place' }],
      [routes.account, { page: 'account' }],
      [routes.concept('softmax'), { page: 'concept', concept: 'softmax' }],
      [routes.watch('softmax'), { page: 'watch', concept: 'softmax' }],
      [routes.watch('softmax', 'attention'), { page: 'watch', concept: 'softmax', track: 'attention' }],
      [routes.learn(), { page: 'learn' }],
      [routes.learn('softmax'), { page: 'learn', concept: 'softmax' }],
      [routes.learn('softmax', 'attention'), { page: 'learn', concept: 'softmax', track: 'attention' }],
      [routes.track('attention'), { page: 'track', target: 'attention', map: false }],
      [routes.trackMap('attention'), { page: 'track', target: 'attention', map: true }],
      [routes.newTrack(), { page: 'new-track' }],
      [routes.newTrack('attention'), { page: 'new-track', target: 'attention' }],
      [routes.link('ab3 k9z'), { page: 'account', code: 'ab3-k9z' }],
    ];
    for (const [hash, route] of cases) expect(parseRoute(hash), hash).toEqual(route);
  });

  it('reads an address outside the app as null', () => {
    expect(parseRoute('')).toBeNull();
    expect(parseRoute('#/chapters/3')).toBeNull();
    expect(parseRoute('#/atlas/')).toEqual({ page: 'home' });
  });
});
