// Placement by bisection: pick the unsettled concept whose answer settles the most either way.
import type { ConceptGraph } from './graph';

/** The unsettled concept that splits the rest most evenly, whichever way the answer goes. */
export function nextProbe(g: ConceptGraph, known: ReadonlyMap<string, boolean>): string | null {
  let best: string | null = null;
  let score = -1;
  for (const c of g.order) {
    if (known.has(c.id)) continue;
    const up = [...g.ancestors(c.id)].filter((x) => !known.has(x)).length;
    const down = [...g.descendants(c.id)].filter((x) => !known.has(x)).length;
    const s = Math.min(up, down) * 1000 + up + down;
    if (s > score) [best, score] = [c.id, s];
  }
  return best;
}

