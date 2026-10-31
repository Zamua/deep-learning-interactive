import type { MasteryBar } from './types';

export const DAY = 86_400_000;
/** Answers kept per concept: enough for any mastery bar and the recovery streak. */
const KEEP = 20;
const EASE = { start: 2.5, miss: 0.2, min: 1.3 };

export type Status = 'locked' | 'new' | 'learning' | 'mastered' | 'due' | 'slipping';

export interface Attempt {
  ok: boolean;
  /** Seconds taken, capped at three times the concept's target. */
  t: number;
  /** Answered after rewatching the worked example: recorded, but never part of a streak. */
  help?: boolean;
}

export interface Review {
  /** Epoch ms. */
  due: number;
  /** Days between the last review and `due`. */
  interval: number;
  ease: number;
  /** Reviews passed since the concept was last (re)mastered. */
  passed: number;
}

interface Practice {
  attempts: number;
  correct: number;
  /** Newest last. */
  recent: Attempt[];
  /** Epoch ms of the latest answer. */
  last: number;
}

/** Not yet mastered: no reviews. */
export interface Unmastered extends Practice {
  mastered: false;
  slipping: false;
  review: null;
}

/** Has met the bar at least once, which unlocks its dependents for good, and comes back for reviews. */
export interface Mastered extends Practice {
  mastered: true;
  /** Missed a review: practiced back up to the recovery streak before reviews resume. */
  slipping: boolean;
  review: Review;
}

export type ConceptRecord = Unmastered | Mastered;

export function emptyRecord(): Unmastered {
  return { attempts: 0, correct: 0, recent: [], mastered: false, slipping: false, review: null, last: 0 };
}

/** The review a concept gets when it is (re)mastered at `now`. */
export const firstReview = (now: number, ease: number = EASE.start): Review => ({ due: now + DAY, interval: 1, ease, passed: 0 });

/** Correct, unassisted answers at the end of `recent`. */
export function streak(rec: Pick<Practice, 'recent'>): number {
  let n = 0;
  for (let i = rec.recent.length - 1; i >= 0 && rec.recent[i]!.ok && !rec.recent[i]!.help; i--) n++;
  return n;
}

/** Mean seconds over the last `n` answers. */
export function meanTime(rec: Pick<Practice, 'recent'>, n: number): number {
  const xs = rec.recent.slice(-n);
  return xs.length ? xs.reduce((a, x) => a + x.t, 0) / xs.length : 0;
}

/** Answers in a row a slipping concept needs to count as mastered again. */
export const recoveryStreak = (bar: MasteryBar) => Math.ceil(bar.streak / 2);

export function status(rec: ConceptRecord | undefined, unlocked: boolean, now: number): Status {
  if (rec?.slipping) return 'slipping';
  if (rec?.review) return now >= rec.review.due ? 'due' : 'mastered';
  if (!unlocked) return 'locked';
  return rec && rec.attempts > 0 ? 'learning' : 'new';
}

/** The record after one answer. Pure: returns a new record. */
export function applyAnswer(rec: ConceptRecord, bar: MasteryBar, a: { ok: boolean; seconds: number; help?: boolean }, now: number): ConceptRecord {
  // Tenths of a second: finer adds nothing to the bar's average and only weighs down what syncs.
  const att: Attempt = { ok: a.ok, t: Math.round(Math.min(a.seconds, 3 * bar.seconds) * 10) / 10, ...(a.help ? { help: true } : {}) };
  const practice: Practice = {
    attempts: rec.attempts + 1,
    correct: rec.correct + (a.ok ? 1 : 0),
    recent: [...rec.recent, att].slice(-KEEP),
    last: now,
  };
  if (!rec.mastered) {
    const met = streak(practice) >= bar.streak && meanTime(practice, bar.streak) <= bar.seconds;
    return met ? { ...practice, mastered: true, slipping: false, review: firstReview(now) } : { ...practice, mastered: false, slipping: false, review: null };
  }
  const review = rec.review;
  if (rec.slipping) {
    const won = streak(practice) >= recoveryStreak(bar);
    return won ? { ...practice, mastered: true, slipping: false, review: firstReview(now, review.ease) } : { ...practice, mastered: true, slipping: true, review };
  }
  if (!a.ok && !a.help) return { ...practice, mastered: true, slipping: true, review: { ...review, ease: Math.max(EASE.min, review.ease - EASE.miss) } };
  if (a.ok && !a.help && now >= review.due) {
    const interval = review.passed === 0 ? 3 : review.interval * review.ease;
    return { ...practice, mastered: true, slipping: false, review: { ...review, interval, due: now + interval * DAY, passed: review.passed + 1 } };
  }
  return { ...practice, mastered: true, slipping: false, review };
}

/** Marks a concept mastered without practice (placement), with an early first review. */
export function placeMastered(rec: ConceptRecord, now: number): ConceptRecord {
  return rec.mastered ? rec : { ...rec, mastered: true, slipping: false, review: firstReview(now) };
}
