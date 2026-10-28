import type { ConceptGraph } from './graph';
import { DAY, emptyRecord, placeMastered, status, streak, type ConceptRecord, type Status } from './model';

export type Records = Readonly<Record<string, ConceptRecord>>;

/** How new concepts are chosen: `deep` follows the chain just mastered, `broad` turns to the area left longest. */
export type Pace = 'deep' | 'broad';

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
  /** `deep` by default. */
  pace?: Pace;
  /** A track's concepts: what to learn comes from these while any is left. */
  within?: ReadonlySet<string>;
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
  const learning = ids('learning');
  const fresh = ids('new');
  // A track's concepts while any is left to learn; then the whole map.
  const scoped = !!s.within && [...learning, ...fresh].some((id) => s.within!.has(id));
  const pool = (list: string[]) => (scoped ? list.filter((id) => s.within!.has(id)) : list);
  const focus = pool(learning).sort(recent)[0];
  if (focus) return learn(focus);

  // Nothing in progress: start a new concept.
  const open = pool(fresh);
  return open.length ? { concept: rankNew(graph, records, open, s.pace ?? 'deep')[0]!, reason: 'new', difficulty: 0 } : null;
}

/**
 * Concepts not yet started, best first for the pace. Deep: what the latest mastery unlocked, then the domain of the
 * latest practice. Broad: the domain practiced longest ago, never practiced first. Then the shallowest, then the one
 * that unlocks the most.
 */
export function rankNew(graph: ConceptGraph, records: Records, cands: readonly string[], pace: Pace): string[] {
  const recent = (a: string, b: string) => (records[b]?.last ?? 0) - (records[a]?.last ?? 0);
  const practiced = graph.order.filter((c) => records[c.id]?.attempts).map((c) => c.id).sort(recent);
  const latestMastered = graph.order.filter((c) => records[c.id]?.mastered).map((c) => c.id).sort(recent)[0];
  const domain = practiced[0] ? graph.get(practiced[0])!.domain : undefined;
  const lastIn = new Map<string, number>();
  for (const id of practiced) lastIn.set(graph.get(id)!.domain, Math.max(lastIn.get(graph.get(id)!.domain) ?? 0, records[id]!.last));
  const unlockedBy = (id: string) => (latestMastered && graph.get(id)!.prereqs.includes(latestMastered) ? 0 : 1);
  const sameDomain = (id: string) => (graph.get(id)!.domain === domain ? 0 : 1);
  const left = (id: string) => lastIn.get(graph.get(id)!.domain) ?? 0;
  const depth = (id: string) => graph.depth.get(id)!;
  const reach = (id: string) => graph.dependents.get(id)!.length;
  const tail = (a: string, b: string) => depth(a) - depth(b) || reach(b) - reach(a);
  return [...cands].sort(pace === 'deep' ? (a, b) => unlockedBy(a) - unlockedBy(b) || sameDomain(a) - sameDomain(b) || tail(a, b) : (a, b) => left(a) - left(b) || tail(a, b));
}

export interface NewChoices {
  /** The next step along the chain in progress. */
  deeper?: string;
  /** The best start in another domain than `deeper`'s. */
  different?: string;
  /** Every concept open and not yet started, in graph order. */
  open: string[];
}

/** What a learner could start now: the two ways to go on, and all of it. */
export function newChoices(graph: ConceptGraph, records: Records, now: number): NewChoices {
  const st = statuses(graph, records, now);
  const open = graph.order.filter((c) => st.get(c.id) === 'new').map((c) => c.id);
  const deeper = rankNew(graph, records, open, 'deep')[0];
  const different = rankNew(graph, records, open, 'broad').find((id) => !deeper || graph.get(id)!.domain !== graph.get(deeper)!.domain);
  return { deeper, different, open };
}
