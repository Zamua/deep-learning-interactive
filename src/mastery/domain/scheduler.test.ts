import { describe, expect, it } from 'vitest';
import { ConceptGraph } from './graph';
import { applyAnswer, DAY, emptyRecord, type ConceptRecord } from './model';
import { isUnlocked, MAX_LEARNING, pickNext, type Records, type SessionState } from './scheduler';
import type { Concept } from './types';

const bar = { streak: 3, seconds: 20 };
const c = (id: string, ...prereqs: string[]): Concept => ({ id, title: id, blurb: '', domain: 'd', prereqs, mastery: bar });
const T0 = 1_000_000_000_000;
const answers = (n: number, ok: boolean, at: number, rec = emptyRecord()): ConceptRecord => {
  let r = rec;
  for (let i = 0; i < n; i++) r = applyAnswer(r, bar, { ok, seconds: 5 }, at);
  return r;
};
const mastered = (at = T0) => answers(3, true, at);
const learning = (at: number) => answers(1, true, at);
const slipping = () => applyAnswer(mastered(T0 - 2 * DAY), bar, { ok: false, seconds: 5 }, T0 - DAY);
const S = (graph: ConceptGraph, records: Records, more: Partial<SessionState> = {}): SessionState => ({ graph, records, now: T0, rand: () => 0.5, ...more });

// a and b are roots; a unlocks c and d, b unlocks e, c unlocks f
const G = new ConceptGraph([c('a'), c('b'), c('c', 'a'), c('d', 'a'), c('e', 'b'), c('f', 'c')]);

describe('pickNext', () => {
  it('starts with the shallowest concept that unlocks the most', () => {
    expect(pickNext(S(G, {}))).toEqual({ concept: 'a', reason: 'new', difficulty: 0 });
  });

  it('never picks a locked concept', () => {
    const seen = new Set<string>();
    for (const last of [undefined, 'a', 'b']) seen.add(pickNext(S(G, { a: learning(T0 - 10), b: learning(T0 - 5) }, { last }))!.concept);
    expect([...seen].sort()).toEqual(['a', 'b']);
  });

  it('does not repeat the last concept while another is available', () => {
    expect(pickNext(S(G, { a: learning(T0 - 100), b: learning(T0 - 10) }, { last: 'a' }))!.concept).toBe('b');
  });

  it('repeats the last concept when it is the only one', () => {
    const one = new ConceptGraph([c('a')]);
    expect(pickNext(S(one, { a: learning(T0 - 10) }, { last: 'a' }))!.concept).toBe('a');
  });

  it('interleaves the frontier, least recently practiced first', () => {
    const roots = new ConceptGraph(['r1', 'r2', 'r3'].map((id) => c(id)));
    expect(pickNext(S(roots, { r1: learning(T0 - 100), r2: learning(T0 - 300), r3: learning(T0 - 200) }))!.concept).toBe('r2');
  });

  it('keeps at most three concepts in learning', () => {
    const roots = new ConceptGraph(['r1', 'r2', 'r3', 'r4', 'r5'].map((id) => c(id)));
    const recs = { r1: learning(T0 - 3), r2: learning(T0 - 2), r3: learning(T0 - 1) };
    expect(MAX_LEARNING).toBe(3);
    for (const last of ['r1', 'r2', 'r3']) expect(['r1', 'r2', 'r3']).toContain(pickNext(S(roots, recs, { last }))!.concept);
  });

  it('scales difficulty with the streak', () => {
    const p = pickNext(S(new ConceptGraph([c('a')]), { a: answers(2, true, T0 - 10) }));
    expect(p).toEqual({ concept: 'a', reason: 'learning', difficulty: 2 / 3 });
  });

  it('puts a slipping concept first', () => {
    const recs = { a: mastered(T0 - 2 * DAY), b: slipping() };
    expect(pickNext(S(G, recs))).toMatchObject({ concept: 'b', reason: 'slipping' });
  });

  it('mixes due reviews in about 30% of the time', () => {
    const recs = { a: mastered(T0 - 2 * DAY) };
    expect(pickNext(S(G, recs, { rand: () => 0.1 }))).toMatchObject({ concept: 'a', reason: 'review', difficulty: 0.7 });
    expect(pickNext(S(G, recs, { rand: () => 0.9 }))).toMatchObject({ reason: 'new' });
  });

  it('reviews the most overdue first, and always when nothing is left to learn', () => {
    const one = new ConceptGraph([c('a'), c('b')]);
    const recs = { a: mastered(T0 - 2 * DAY), b: mastered(T0 - 5 * DAY) };
    expect(pickNext(S(one, recs, { rand: () => 0.99 }))).toMatchObject({ concept: 'b', reason: 'review' });
  });

  it('returns null when everything is mastered and nothing is due', () => {
    const one = new ConceptGraph([c('a')]);
    expect(pickNext(S(one, { a: mastered(T0) }))).toBeNull();
  });
});

describe('isUnlocked', () => {
  it('stays unlocked when a prerequisite slips', () => {
    expect(isUnlocked(G, { a: slipping() }, 'c')).toBe(true);
    expect(isUnlocked(G, { a: learning(T0) }, 'c')).toBe(false);
  });
});
