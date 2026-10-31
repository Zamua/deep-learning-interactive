// A track: a target concept and everything it needs. Mastery is the learner's, not the track's, so a concept mastered
// on one track counts on every track that holds it.
import type { ConceptGraph } from './graph';
import { streak } from './model';
import { pickNext, type Pace, type Records } from './scheduler';

/** Room in a concept's practice time for misses, reading the problem and its feedback. */
export const PRACTICE_SLACK = 1.5;

export interface Track {
  target: string;
  /** The target and every concept it needs, prerequisites first. */
  ids: string[];
  mastered: number;
  /** The concept to go on with; none once every concept is mastered. */
  next?: string;
  /** About how long the rest takes: explainers not yet heard, and practice up to each bar. */
  seconds: number;
}

/** The target and every concept it needs, in graph order. */
export function trackConcepts(graph: ConceptGraph, target: string): string[] {
  const set = graph.ancestors(target);
  return graph.order.filter((c) => set.has(c.id)).map((c) => c.id);
}

/** `explainer` gives the seconds of a concept's explainer still to hear. Next is what a session on the track learns. */
export function track(graph: ConceptGraph, records: Records, now: number, target: string, pace: Pace, explainer: (id: string) => number): Track {
  const ids = trackConcepts(graph, target);
  const left = ids.filter((id) => !records[id]?.mastered);
  const next = left.length ? pickNext({ graph, records, now, pace, learnOnly: true, within: new Set(ids) })?.concept : undefined;
  const seconds = left.reduce((sum, id) => {
    const bar = graph.get(id)!.mastery;
    const rec = records[id];
    return sum + explainer(id) + Math.max(0, bar.streak - (rec ? streak(rec) : 0)) * bar.seconds * PRACTICE_SLACK;
  }, 0);
  return { target, ids, mastered: ids.length - left.length, next, seconds };
}
