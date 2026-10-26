import { describe, expect, it } from 'vitest';
import { ConceptGraph } from './graph';
import { applyAnswer, DAY, emptyRecord, type ConceptRecord } from './model';
import { inheritSplits, isUnlocked, pickNext, type Records, type SessionState } from './scheduler';
import type { Concept } from './types';

const bar = { streak: 3, seconds: 20 };
const c = (id: string, prereqs: string[] = [], domain = 'd'): Concept => ({ id, title: id, blurb: '', domain, prereqs, mastery: bar });
const T0 = 1_000_000_000_000;
const answers = (oks: boolean[], at: number, rec = emptyRecord()): ConceptRecord =>
  oks.reduce((r, ok) => applyAnswer(r, bar, { ok, seconds: 5 }, at), rec);
const mastered = (at = T0) => answers([true, true, true], at);
const learning = (at: number) => answers([true], at);
const slipping = () => applyAnswer(mastered(T0 - 2 * DAY), bar, { ok: false, seconds: 5 }, T0 - DAY);
const S = (graph: ConceptGraph, records: Records, more: Partial<SessionState> = {}): SessionState => ({ graph, records, now: T0, ...more });

// a and b are roots; a unlocks c and d, b unlocks e, c unlocks f
const G = new ConceptGraph([c('a'), c('b'), c('c', ['a']), c('d', ['a']), c('e', ['b']), c('f', ['c'])]);

describe('pickNext', () => {
  it('starts with the shallowest concept that unlocks the most', () => {
    expect(pickNext(S(G, {}))).toEqual({ concept: 'a', reason: 'new', difficulty: 0 });
  });

  it('stays on the concept in progress, problem after problem', () => {
    expect(pickNext(S(G, { a: learning(T0 - 10) }, { last: 'a' }))).toMatchObject({ concept: 'a', reason: 'learning' });
  });

  it('resumes the most recently practiced concept first', () => {
    expect(pickNext(S(G, { a: learning(T0 - 100), b: learning(T0 - 10) }))!.concept).toBe('b');
  });

  it('never picks a locked concept', () => {
    const p = pickNext(S(G, { b: mastered(T0 - 10) }));
    expect(['a', 'e']).toContain(p!.concept);
  });

  it('starts next on what the latest mastery unlocked', () => {
    expect(pickNext(S(G, { a: mastered(T0 - 10) }, { last: 'a' }))).toEqual({ concept: 'c', reason: 'new', difficulty: 0 });
  });

  it('otherwise keeps to the domain of the latest practice', () => {
    const g = new ConceptGraph([c('x', [], 'A'), c('y', [], 'B'), c('z', [], 'A')]);
    expect(pickNext(S(g, { y: mastered(T0 - 100), x: mastered(T0 - 10) }))!.concept).toBe('z');
  });

  it('scales difficulty with the streak', () => {
    const p = pickNext(S(new ConceptGraph([c('a')]), { a: answers([true, true], T0 - 10) }));
    expect(p).toEqual({ concept: 'a', reason: 'learning', difficulty: 2 / 3 });
  });

  it('puts a slipping concept first', () => {
    expect(pickNext(S(G, { a: mastered(T0 - 2 * DAY), b: slipping() }))).toMatchObject({ concept: 'b', reason: 'slipping' });
  });

  it('takes every due review before the concept in progress, foundations first', () => {
    const recs = { a: mastered(T0 - 2 * DAY), b: mastered(T0 - 5 * DAY), c: mastered(T0 - 2 * DAY), e: learning(T0 - 10) };
    expect(pickNext(S(G, recs))).toMatchObject({ concept: 'a', reason: 'review', difficulty: 0.7 });
    expect(pickNext(S(G, recs, { reviewed: new Set(['a']) }))).toMatchObject({ concept: 'b', reason: 'review' });
    expect(pickNext(S(G, recs, { reviewed: new Set(['a', 'b']) }))).toMatchObject({ concept: 'c', reason: 'review' });
    expect(pickNext(S(G, recs, { reviewed: new Set(['a', 'b', 'c']) }))).toMatchObject({ concept: 'e', reason: 'learning' });
  });

  it('takes due reviews before starting anything new', () => {
    expect(pickNext(S(G, { a: mastered(T0 - 2 * DAY) }))).toMatchObject({ concept: 'a', reason: 'review' });
    expect(pickNext(S(G, { a: mastered(T0 - 2 * DAY) }, { reviewed: new Set(['a']) }))).toMatchObject({ concept: 'c', reason: 'new' });
  });

  it('keeps a session opened on a concept on it until it is mastered', () => {
    const recs = { a: mastered(T0 - 2 * DAY), b: slipping() };
    expect(pickNext(S(G, recs, { focus: 'c' }))).toEqual({ concept: 'c', reason: 'new', difficulty: 0 });
    expect(pickNext(S(G, { ...recs, c: learning(T0 - 10) }, { focus: 'c', last: 'c' }))).toMatchObject({ concept: 'c', reason: 'learning' });
    expect(pickNext(S(G, { ...recs, c: mastered(T0 - 10) }, { focus: 'c', last: 'c' }))).toMatchObject({ concept: 'b', reason: 'slipping' });
  });

  it('names what to learn next, leaving reviews and slips aside', () => {
    const recs = { a: mastered(T0 - 2 * DAY), b: slipping() };
    expect(pickNext(S(G, recs, { learnOnly: true }))).toMatchObject({ concept: 'e', reason: 'new' });
  });

  it('sends a learner stuck on a concept back to a prerequisite, then returns', () => {
    const stuck = answers([true, false, false, true, false], T0 - 10);
    const recs = { a: mastered(T0 - 100), c: stuck };
    expect(pickNext(S(G, recs, { last: 'c' }))).toEqual({ concept: 'a', reason: 'refresh', difficulty: 0.5, for: 'c' });
    expect(pickNext(S(G, recs, { last: 'a' }))).toMatchObject({ concept: 'c', reason: 'learning' });
  });

  it('returns null when everything is mastered and nothing is due', () => {
    expect(pickNext(S(new ConceptGraph([c('a')]), { a: mastered(T0) }))).toBeNull();
  });
});

describe('isUnlocked', () => {
  it('stays unlocked when a prerequisite slips', () => {
    expect(isUnlocked(G, { a: slipping() }, 'c')).toBe(true);
    expect(isUnlocked(G, { a: learning(T0) }, 'c')).toBe(false);
  });
});

describe('inheritSplits', () => {
  const S2 = new ConceptGraph([c('a'), { ...c('a0'), from: 'b' }, c('b', ['a0'])]);

  it('places a split-off concept mastered when its origin is', () => {
    const r = inheritSplits(S2, { b: mastered() }, T0);
    expect(r.a0?.mastered).toBe(true);
    expect(r.a0?.review?.due).toBe(T0 + DAY);
    expect(isUnlocked(S2, r, 'b')).toBe(true);
  });

  it('leaves it alone when the origin is not mastered or it has a record of its own', () => {
    const own = learning(T0);
    expect(inheritSplits(S2, { b: learning(T0) }, T0).a0).toBeUndefined();
    expect(inheritSplits(S2, { b: mastered(), a0: own }, T0).a0).toBe(own);
    const none = { a: mastered() };
    expect(inheritSplits(S2, none, T0)).toBe(none);
  });
});
