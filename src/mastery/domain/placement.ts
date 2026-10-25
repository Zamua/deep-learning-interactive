// Placement by bisection: pick the unsettled concept whose answer settles the most either way.
import type { ConceptGraph } from './graph';

const closure = (start: string, next: (id: string) => readonly string[]): Set<string> => {
  const seen = new Set<string>();
  const stack = [start];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...next(id));
  }
  return seen;
};

export const ancestors = (g: ConceptGraph, id: string) => closure(id, (x) => g.get(x)!.prereqs);
export const descendants = (g: ConceptGraph, id: string) => closure(id, (x) => g.dependents.get(x)!);

/** The unsettled concept that splits the rest most evenly, whichever way the answer goes. */
export function nextProbe(g: ConceptGraph, known: ReadonlyMap<string, boolean>): string | null {
  let best: string | null = null;
  let score = -1;
  for (const c of g.order) {
    if (known.has(c.id)) continue;
    const up = [...ancestors(g, c.id)].filter((x) => !known.has(x)).length;
    const down = [...descendants(g, c.id)].filter((x) => !known.has(x)).length;
    const s = Math.min(up, down) * 1000 + up + down;
    if (s > score) [best, score] = [c.id, s];
  }
  return best;
}

