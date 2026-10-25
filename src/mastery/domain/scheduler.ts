import type { ConceptGraph } from './graph';
import { DAY, status, streak, type ConceptRecord, type Status } from './model';

export type Records = Readonly<Record<string, ConceptRecord>>;

export interface Pick {
  concept: string;
  /**
   * `new`: a concept not yet started (its explainer comes first). `learning`: the concept in
   * progress. `review` and `slipping`: mastered ones coming back. `refresh`: a prerequisite of a
   * concept the learner is stuck on.
   */
  reason: 'new' | 'learning' | 'review' | 'slipping' | 'refresh';
  difficulty: number;
  /** For `refresh`, the concept that needs it. */
  for?: string;
}

export interface SessionState {
  graph: ConceptGraph;
  records: Records;
  now: number;
  /** The concept of the previous problem. */
  last?: string;
  rand: () => number;
}

/** Share of picks that go to due reviews, between problems on the concept in progress. */
export const REVIEW_SHARE = 0.3;
/** Misses among a concept's last few answers that send the learner back to a prerequisite. */
const STUCK = { misses: 3, of: 4 };
const DIFFICULTY = { slipping: 0.4, review: 0.7, refresh: 0.5 };

/** Unlocked for good once every prerequisite has been mastered at least once. */
export function isUnlocked(graph: ConceptGraph, records: Records, id: string): boolean {
  return graph.get(id)!.prereqs.every((p) => records[p]?.mastered);
}

export function statuses(graph: ConceptGraph, records: Records, now: number): Map<string, Status> {
  return new Map(graph.order.map((c) => [c.id, status(records[c.id], isUnlocked(graph, records, c.id), now)]));
}

/**
 * The next problem's concept, or null when nothing is due and nothing is left to learn.
 * One concept is learned at a time, until mastered; reviews of mastered concepts are mixed in.
 */
export function pickNext(s: SessionState): Pick | null {
  const { graph, records, now } = s;
  const st = statuses(graph, records, now);
  const ids = (want: Status) => graph.order.filter((c) => st.get(c.id) === want).map((c) => c.id);
  const recent = (a: string, b: string) => (records[b]?.last ?? 0) - (records[a]?.last ?? 0);
  const overdue = (id: string) => {
    const r = records[id]!.review!;
    return (now - r.due) / (r.interval * DAY);
  };
  const due = ids('due').sort((a, b) => overdue(b) - overdue(a)).filter((id) => id !== s.last);
  const review = (): Pick | null => (due.length ? { concept: due[0]!, reason: 'review', difficulty: DIFFICULTY.review } : null);

  // The concept in progress: a slipping or learning one, the most recently practiced first.
  const slipping = ids('slipping').sort(recent);
  if (slipping.length) return { concept: slipping[0]!, reason: 'slipping', difficulty: DIFFICULTY.slipping };
  const focus = ids('learning').sort(recent)[0];
  if (focus) {
    const rec = records[focus]!;
    const lastFew = rec.recent.slice(-STUCK.of);
    if (s.last === focus && lastFew.length === STUCK.of && lastFew.filter((a) => !a.ok).length >= STUCK.misses) {
      const pre = graph.get(focus)!.prereqs.filter((p) => p !== s.last).sort((a, b) => streak(records[a]!) - streak(records[b]!))[0];
      if (pre) return { concept: pre, reason: 'refresh', difficulty: DIFFICULTY.refresh, for: focus };
    }
    if (due.length && s.rand() < REVIEW_SHARE) return review();
    return { concept: focus, reason: 'learning', difficulty: Math.min(1, streak(rec) / graph.get(focus)!.mastery.streak) };
  }

  // Nothing in progress: start a new concept, preferring what the latest mastery unlocked, then its domain.
  const fresh = ids('new');
  if (!fresh.length || (due.length && s.rand() < REVIEW_SHARE)) return review() ?? (fresh.length ? start(fresh) : null);
  return start(fresh);

  function start(cands: string[]): Pick {
    const latest = graph.order.filter((c) => records[c.id]?.attempts).map((c) => c.id).sort(recent)[0];
    const latestMastered = graph.order.filter((c) => records[c.id]?.mastered).map((c) => c.id).sort(recent)[0];
    const domain = latest ? graph.get(latest)!.domain : undefined;
    const unlockedBy = (id: string) => (latestMastered && graph.get(id)!.prereqs.includes(latestMastered) ? 0 : 1);
    const sameDomain = (id: string) => (graph.get(id)!.domain === domain ? 0 : 1);
    const depth = (id: string) => graph.depth.get(id)!;
    const reach = (id: string) => graph.dependents.get(id)!.length;
    const best = [...cands].sort((a, b) => unlockedBy(a) - unlockedBy(b) || sameDomain(a) - sameDomain(b) || depth(a) - depth(b) || reach(b) - reach(a))[0]!;
    return { concept: best, reason: 'new', difficulty: 0 };
  }
}
