import type { Concept } from './types';

/** Everything wrong with a set of concepts as a graph; empty when it is a valid DAG. */
export function graphIssues(concepts: readonly Concept[]): string[] {
  const issues: string[] = [];
  const ids = new Set<string>();
  for (const c of concepts) {
    if (ids.has(c.id)) issues.push(`duplicate id ${c.id}`);
    ids.add(c.id);
  }
  for (const c of concepts) {
    for (const p of c.prereqs) {
      if (p === c.id) issues.push(`${c.id} lists itself as a prerequisite`);
      else if (!ids.has(p)) issues.push(`${c.id} needs ${p}, which does not exist`);
    }
  }
  const cycle = findCycle(concepts);
  if (cycle) issues.push(`cycle: ${cycle.join(' needs ')}`);
  return issues;
}

function findCycle(concepts: readonly Concept[]): string[] | null {
  const by = new Map(concepts.map((c) => [c.id, c]));
  const mark = new Map<string, 1 | 2>();
  const path: string[] = [];
  const visit = (id: string): string[] | null => {
    if (mark.get(id) === 2) return null;
    if (mark.get(id) === 1) return [...path.slice(path.indexOf(id)), id];
    mark.set(id, 1);
    path.push(id);
    for (const p of by.get(id)?.prereqs ?? []) {
      if (p === id || !by.has(p)) continue;
      const c = visit(p);
      if (c) return c;
    }
    path.pop();
    mark.set(id, 2);
    return null;
  };
  for (const c of concepts) {
    const found = visit(c.id);
    if (found) return found;
  }
  return null;
}

/** A validated concept graph with the orderings the scheduler and the map need. */
export class ConceptGraph {
  readonly byId: ReadonlyMap<string, Concept>;
  /** Prerequisites before dependents; ties keep the input order. */
  readonly order: readonly Concept[];
  /** 0 for a concept with no prerequisites, else one more than its deepest prerequisite. */
  readonly depth: ReadonlyMap<string, number>;
  /** Concepts that list each concept as a direct prerequisite. */
  readonly dependents: ReadonlyMap<string, readonly string[]>;

  constructor(concepts: readonly Concept[]) {
    const issues = graphIssues(concepts);
    if (issues.length) throw new Error(`invalid concept graph:\n${issues.join('\n')}`);
    this.byId = new Map(concepts.map((c) => [c.id, c]));
    const depth = new Map<string, number>();
    const depthOf = (id: string): number => {
      let d = depth.get(id);
      if (d === undefined) {
        d = Math.max(-1, ...this.byId.get(id)!.prereqs.map(depthOf)) + 1;
        depth.set(id, d);
      }
      return d;
    };
    concepts.forEach((c) => depthOf(c.id));
    this.depth = depth;
    const pos = new Map(concepts.map((c, i) => [c.id, i]));
    this.order = [...concepts].sort((a, b) => depth.get(a.id)! - depth.get(b.id)! || pos.get(a.id)! - pos.get(b.id)!);
    const deps = new Map<string, string[]>(concepts.map((c) => [c.id, []]));
    for (const c of this.order) for (const p of c.prereqs) deps.get(p)!.push(c.id);
    this.dependents = deps;
  }

  get(id: string): Concept | undefined {
    return this.byId.get(id);
  }
}
