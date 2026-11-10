import { describe, expect, it } from 'vitest';
import { ConceptGraph } from './graph';
import { applyAnswer, emptyRecord, type ConceptRecord } from './model';
import { pickNext } from './scheduler';
import { PRACTICE_SLACK, track, trackConcepts, upcoming } from './tracks';
import type { Concept } from './types';

const bar = { streak: 3, seconds: 20 };
const c = (id: string, prereqs: string[] = []): Concept => ({ id, title: id, blurb: '', domain: 'd', prereqs, mastery: bar });
const T0 = 1_000_000_000_000;
const answers = (oks: boolean[], at: number): ConceptRecord => oks.reduce((r: ConceptRecord, ok) => applyAnswer(r, bar, { ok, seconds: 5 }, at), emptyRecord());
const mastered = (at = T0) => answers([true, true, true], at);

// a and b are roots; c needs a, d needs a and b, t needs c and d; x stands apart
const G = new ConceptGraph([c('a'), c('b'), c('x'), c('c', ['a']), c('d', ['a', 'b']), c('t', ['c', 'd'])]);
const none = () => 0;

describe('tracks', () => {
  it('hold the target and everything it needs, prerequisites first', () => {
    expect(trackConcepts(G, 't')).toEqual(['a', 'b', 'c', 'd', 't']);
    expect(trackConcepts(G, 'c')).toEqual(['a', 'c']);
  });

  it('count mastery from anywhere, so overlapping tracks share it', () => {
    const recs = { a: mastered(), x: mastered() };
    expect(track(G, recs, T0, 't', 'deep', none)).toMatchObject({ mastered: 1, ids: ['a', 'b', 'c', 'd', 't'] });
    expect(track(G, recs, T0, 'c', 'deep', none)).toMatchObject({ mastered: 1, next: 'c' });
  });

  it('go on with the concept in progress on the track, never one outside it', () => {
    const recs = { a: mastered(T0 - 100), x: answers([true], T0 - 10), b: answers([true], T0 - 50) };
    expect(track(G, recs, T0, 't', 'deep', none).next).toBe('b');
  });

  it('have no next once every concept is mastered', () => {
    const recs = Object.fromEntries(['a', 'b', 'c', 'd', 't'].map((id) => [id, mastered()]));
    expect(track(G, recs, T0, 't', 'deep', none)).toMatchObject({ mastered: 5, next: undefined, seconds: 0 });
  });

  it('estimate the explainers left and the answers each bar still needs', () => {
    const recs = { a: mastered(), b: answers([true, true], T0) };
    const est = track(G, recs, T0, 'd', 'deep', (id) => (id === 'd' ? 100 : 0)).seconds;
    expect(est).toBeCloseTo(100 + (1 + 3) * bar.seconds * PRACTICE_SLACK);
  });
});

describe('a session on a track', () => {
  it('learns only the track while any of it is left, then the whole map', () => {
    const within = new Set(trackConcepts(G, 'c'));
    expect(pickNext({ graph: G, records: { x: answers([true], T0 - 10) }, now: T0, within })!.concept).toBe('a');
    const done = { a: mastered(T0 - 20), c: mastered(T0 - 10) };
    expect(within.has(pickNext({ graph: G, records: done, now: T0, within })!.concept)).toBe(false);
  });
});

describe('the explainers that come next', () => {
  it('are only the one the course leads with when no track is followed', () => {
    expect(upcoming(G, {}, T0, 'deep', [], 3)).toEqual([pickNext({ graph: G, records: {}, now: T0, pace: 'deep', learnOnly: true })!.concept]);
  });

  it('add each track\'s next few, soonest first, the tracks taking turns', () => {
    const recs = { a: mastered() };
    const lead = pickNext({ graph: G, records: recs, now: T0, pace: 'deep', learnOnly: true })!.concept;
    const t = track(G, recs, T0, 't', 'deep', none).next!;
    const got = upcoming(G, recs, T0, 'deep', ['t', 'x'], 2);
    expect(got).toEqual([...new Set([lead, t, 'x', ['b', 'c', 'd', 't'].find((id) => id !== t)!])]);
    expect(got).not.toContain('a');
  });

  it('are none once everything is mastered', () => {
    const all = Object.fromEntries(G.order.map((x) => [x.id, mastered()]));
    expect(upcoming(G, all, T0, 'deep', ['t'], 3)).toEqual([]);
  });
});
