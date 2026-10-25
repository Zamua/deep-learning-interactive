import { describe, expect, it } from 'vitest';
import { ConceptGraph } from './graph';
import { ancestors, descendants, nextProbe } from './placement';
import type { Concept } from './types';

const c = (id: string, ...prereqs: string[]): Concept => ({ id, title: id, blurb: '', domain: 'd', prereqs, mastery: { streak: 3, seconds: 20 } });
// a chain a <- b <- c <- d <- e, with a side branch x <- y off b
const G = new ConceptGraph([c('a'), c('b', 'a'), c('c', 'b'), c('d', 'c'), c('e', 'd'), c('x', 'b'), c('y', 'x')]);

describe('placement', () => {
  it('walks prerequisites and dependents transitively', () => {
    expect([...ancestors(G, 'd')].sort()).toEqual(['a', 'b', 'c', 'd']);
    expect([...descendants(G, 'b')].sort()).toEqual(['b', 'c', 'd', 'e', 'x', 'y']);
  });

  it('probes the concept that splits the graph most evenly', () => {
    expect(nextProbe(G, new Map())).toBe('c');
  });

  it('narrows toward the frontier as answers settle concepts', () => {
    const known = new Map<string, boolean>([...ancestors(G, 'b')].map((id) => [id, true]));
    expect(['c', 'd', 'x']).toContain(nextProbe(G, known));
    for (const id of G.order.map((x) => x.id)) known.set(id, true);
    expect(nextProbe(G, known)).toBeNull();
  });
});
