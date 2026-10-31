import { describe, expect, it } from 'vitest';
import { applyAnswer, DAY, emptyRecord, placeMastered, status, streak, type ConceptRecord } from './model';

const bar = { streak: 5, seconds: 20 };
const T0 = 1_000_000_000_000;
const run = (rec: ConceptRecord, answers: [boolean, number, boolean?][], now = T0) =>
  answers.reduce((r, [ok, seconds, help]) => applyAnswer(r, bar, { ok, seconds, help }, now), rec);

describe('mastery', () => {
  it('is reached by the streak at or under the time bar', () => {
    const r = run(emptyRecord(), Array.from({ length: 5 }, () => [true, 12] as [boolean, number]));
    expect(r.mastered).toBe(true);
    expect(r.review).toEqual({ due: T0 + DAY, interval: 1, ease: 2.5, passed: 0 });
  });

  it('is not reached one answer short', () => {
    const r = run(emptyRecord(), Array.from({ length: 4 }, () => [true, 12] as [boolean, number]));
    expect(r.mastered).toBe(false);
    expect(status(r, true, T0)).toBe('learning');
  });

  it('waits for slow but correct answers to average under the bar', () => {
    let r = run(emptyRecord(), Array.from({ length: 5 }, () => [true, 30] as [boolean, number]));
    expect(r.mastered).toBe(false);
    expect(streak(r)).toBe(5);
    r = run(r, [[true, 10], [true, 10]]);
    expect(r.mastered).toBe(false);
    r = run(r, [[true, 10]]);
    expect(r.mastered).toBe(true);
  });

  it('caps one answer at three times the target', () => {
    const r = run(emptyRecord(), [[true, 600], [true, 0], [true, 0], [true, 0], [true, 0]]);
    expect(r.recent[0]!.t).toBe(60);
    expect(r.mastered).toBe(true);
  });

  it('restarts the streak after a miss', () => {
    const r = run(emptyRecord(), [[true, 5], [true, 5], [true, 5], [true, 5], [false, 5], [true, 5]]);
    expect(streak(r)).toBe(1);
    expect(r.mastered).toBe(false);
  });

  it('does not count an assisted answer toward the streak', () => {
    const r = run(emptyRecord(), [[true, 5], [true, 5], [true, 5], [true, 5, true], [true, 5]]);
    expect(streak(r)).toBe(1);
    expect(r.correct).toBe(5);
  });
});

describe('reviews', () => {
  const mastered = run(emptyRecord(), Array.from({ length: 5 }, () => [true, 5] as [boolean, number]));

  it('come due after 1 day, then 3, then interval times ease', () => {
    expect(status(mastered, true, T0 + DAY - 1)).toBe('mastered');
    expect(status(mastered, true, T0 + DAY)).toBe('due');
    const r1 = applyAnswer(mastered, bar, { ok: true, seconds: 5 }, T0 + DAY);
    expect(r1.review).toMatchObject({ interval: 3, due: T0 + 4 * DAY, passed: 1 });
    const r2 = applyAnswer(r1, bar, { ok: true, seconds: 5 }, T0 + 4 * DAY);
    expect(r2.review).toMatchObject({ interval: 7.5, due: T0 + 11.5 * DAY, passed: 2 });
  });

  it('do not move when practiced before they are due', () => {
    const r = applyAnswer(mastered, bar, { ok: true, seconds: 5 }, T0 + 1000);
    expect(r.review).toEqual(mastered.review);
  });

  it('mark the concept slipping on a miss, lowering ease to at least 1.3', () => {
    const r = applyAnswer(mastered, bar, { ok: false, seconds: 5 }, T0 + DAY);
    expect(status(r, true, T0 + DAY)).toBe('slipping');
    expect(r.review!.ease).toBeCloseTo(2.3);
    let low: ConceptRecord = { ...mastered, mastered: true, slipping: false, review: { ...mastered.review!, ease: 1.4 } };
    low = applyAnswer(low, bar, { ok: false, seconds: 5 }, T0 + DAY);
    expect(low.review!.ease).toBe(1.3);
  });

  it('recover after half the streak, rounded up, with a fresh 1-day interval', () => {
    let r = applyAnswer(mastered, bar, { ok: false, seconds: 5 }, T0 + DAY);
    r = run(r, [[true, 5], [true, 5]], T0 + DAY);
    expect(r.slipping).toBe(true);
    r = run(r, [[true, 5]], T0 + 2 * DAY);
    expect(r.slipping).toBe(false);
    expect(r.review).toMatchObject({ due: T0 + 3 * DAY, interval: 1, passed: 0 });
    expect(r.review!.ease).toBeCloseTo(2.3);
    expect(r.mastered).toBe(true);
  });
});

describe('status', () => {
  it('is locked until unlocked, then new, then learning', () => {
    expect(status(undefined, false, T0)).toBe('locked');
    expect(status(undefined, true, T0)).toBe('new');
    expect(status(run(emptyRecord(), [[false, 5]]), true, T0)).toBe('learning');
  });

  it('shows placement as mastered with an early review', () => {
    const r = placeMastered(emptyRecord(), T0);
    expect(status(r, false, T0)).toBe('mastered');
    expect(r.review!.due).toBe(T0 + DAY);
  });
});
