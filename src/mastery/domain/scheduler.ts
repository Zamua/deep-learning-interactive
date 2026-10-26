import type { ConceptGraph } from './graph';
import { DAY, emptyRecord, placeMastered, status, streak, type ConceptRecord, type Status } from './model';

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
  /** The concept the session opened on: practiced until mastered before anything else comes up. */
  focus?: string;
  /** Concepts reviewed this session: one that needed help stays due, for the next session. */
  reviewed?: ReadonlySet<string>;
  /** Only what to learn next: no reviews and no slipped concepts. */
  learnOnly?: boolean;
}

/** Misses among a concept's last few answers that send the learner back to a prerequisite. */
const STUCK = { misses: 3, of: 4 };
const DIFFICULTY = { slipping: 0.4, review: 0.7, refresh: 0.5 };

/** Unlocked for good once every prerequisite has been mastered at least once. */
export function isUnlocked(graph: ConceptGraph, records: Records, id: string): boolean {
  return graph.get(id)!.prereqs.every((p) => records[p]?.mastered);
}

/** Records with every concept split off a mastered one, and not yet started, placed as mastered. */
export function inheritSplits(graph: ConceptGraph, records: Records, now: number): Records {
  const heirs = graph.order.filter((c) => c.from && !records[c.id] && records[c.from]?.mastered);
  return heirs.length ? { ...records, ...Object.fromEntries(heirs.map((c) => [c.id, placeMastered(emptyRecord(), now)])) } : records;
}

export function statuses(graph: ConceptGraph, records: Records, now: number): Map<string, Status> {
  return new Map(graph.order.map((c) => [c.id, status(records[c.id], isUnlocked(graph, records, c.id), now)]));
}

/**
 * The next problem's concept, or null when nothing is due and nothing is left to learn. A fixed order, so a session
 * reads as blocks: concepts that slipped on a review, then every due review (foundations first), then the concept in
 * progress until mastered, then a new one. A session opened on a concept stays on it until it is mastered.
 */
export function pickNext(s: SessionState): Pick | null {
  const { graph, records, now } = s;
  const st = statuses(graph, records, now);
  const ids = (want: Status) => graph.order.filter((c) => st.get(c.id) === want).map((c) => c.id);
  const recent = (a: string, b: string) => (records[b]?.last ?? 0) - (records[a]?.last ?? 0);

  /** A problem on a concept being learned, or on a prerequisite when the last few went wrong. */
  const learn = (id: string): Pick => {
    const rec = records[id] ?? emptyRecord();
    const lastFew = rec.recent.slice(-STUCK.of);
    if (s.last === id && lastFew.length === STUCK.of && lastFew.filter((a) => !a.ok).length >= STUCK.misses) {
      const pre = graph.get(id)!.prereqs.filter((p) => p !== s.last).sort((a, b) => streak(records[a]!) - streak(records[b]!))[0];
      if (pre) return { concept: pre, reason: 'refresh', difficulty: DIFFICULTY.refresh, for: id };
    }
    return rec.attempts
      ? { concept: id, reason: 'learning', difficulty: Math.min(1, streak(rec) / graph.get(id)!.mastery.streak) }
      : { concept: id, reason: 'new', difficulty: 0 };
  };

  const fs = s.focus ? st.get(s.focus) : undefined;
  if (fs === 'learning' || fs === 'new') return learn(s.focus!);
  if (!s.learnOnly) {
    const slipping = ids('slipping').sort(recent);
    if (slipping.length) return { concept: slipping[0]!, reason: 'slipping', difficulty: DIFFICULTY.slipping };
    const due = ids('due').filter((id) => !s.reviewed?.has(id));
    if (due.length) return { concept: due[0]!, reason: 'review', difficulty: DIFFICULTY.review };
  }
  const focus = ids('learning').sort(recent)[0];
  if (focus) return learn(focus);

  // Nothing in progress: start a new concept, preferring what the latest mastery unlocked, then its domain.
  const fresh = ids('new');
  return fresh.length ? start(fresh) : null;

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
