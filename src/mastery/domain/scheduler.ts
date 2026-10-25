import type { ConceptGraph } from './graph';
import { DAY, status, streak, type ConceptRecord, type Status } from './model';

export type Records = Readonly<Record<string, ConceptRecord>>;

export interface Pick {
  concept: string;
  /** `new` means the concept's explainer comes first. */
  reason: 'slipping' | 'review' | 'learning' | 'new';
  difficulty: number;
}

export interface SessionState {
  graph: ConceptGraph;
  records: Records;
  now: number;
  /** The concept of the previous problem, which should not come straight back. */
  last?: string;
  rand: () => number;
}

/** Concepts in learning at once; more spread practice too thin. */
export const MAX_LEARNING = 3;
/** Share of picks that go to due reviews while new material is waiting. */
export const REVIEW_SHARE = 0.3;
const DIFFICULTY = { slipping: 0.4, review: 0.7 };

/** Unlocked for good once every prerequisite has been mastered at least once. */
export function isUnlocked(graph: ConceptGraph, records: Records, id: string): boolean {
  return graph.get(id)!.prereqs.every((p) => records[p]?.mastered);
}

export function statuses(graph: ConceptGraph, records: Records, now: number): Map<string, Status> {
  return new Map(graph.order.map((c) => [c.id, status(records[c.id], isUnlocked(graph, records, c.id), now)]));
}

/** The next problem's concept, or null when nothing is due and nothing is left to learn. */
export function pickNext(s: SessionState): Pick | null {
  return choose(s, s.last) ?? choose(s, undefined);
}

function choose(s: SessionState, avoid: string | undefined): Pick | null {
  const { graph, records, now } = s;
  const st = statuses(graph, records, now);
  const ids = (want: Status) => graph.order.filter((c) => st.get(c.id) === want && c.id !== avoid).map((c) => c.id);
  const depth = (id: string) => graph.depth.get(id)!;

  const slipping = ids('slipping').sort((a, b) => depth(a) - depth(b));
  if (slipping.length) return { concept: slipping[0]!, reason: 'slipping', difficulty: DIFFICULTY.slipping };

  const overdue = (id: string) => {
    const r = records[id]!.review!;
    return (now - r.due) / (r.interval * DAY);
  };
  const due = ids('due').sort((a, b) => overdue(b) - overdue(a));

  // The frontier: everything in learning, topped up with new concepts to MAX_LEARNING.
  const learning = graph.order.filter((c) => st.get(c.id) === 'learning').map((c) => c.id);
  const fresh = ids('new').sort((a, b) => depth(a) - depth(b) || graph.dependents.get(b)!.length - graph.dependents.get(a)!.length);
  const frontier = [...learning.filter((id) => id !== avoid), ...fresh.slice(0, Math.max(0, MAX_LEARNING - learning.length))];

  if (due.length && (!frontier.length || s.rand() < REVIEW_SHARE)) return { concept: due[0]!, reason: 'review', difficulty: DIFFICULTY.review };
  if (frontier.length) {
    // Least recently practiced first, so a few concepts interleave.
    const id = frontier.reduce((a, b) => ((records[b]?.last ?? 0) < (records[a]?.last ?? 0) ? b : a));
    const rec = records[id];
    if (!rec || rec.attempts === 0) return { concept: id, reason: 'new', difficulty: 0 };
    return { concept: id, reason: 'learning', difficulty: Math.min(1, streak(rec) / graph.get(id)!.mastery.streak) };
  }
  return null;
}
