import { describe, expect, it } from 'vitest';
import { ConceptGraph, graphIssues } from './graph';
import type { Concept } from './types';

const c = (id: string, ...prereqs: string[]): Concept => ({ id, title: id, blurb: '', domain: 'd', prereqs, mastery: { streak: 5, seconds: 20 } });

describe('graphIssues', () => {
  it('accepts a DAG', () => {
    expect(graphIssues([c('a'), c('b', 'a'), c('c', 'a', 'b')])).toEqual([]);
  });

  it('names a missing prerequisite, a self loop and a duplicate', () => {
    expect(graphIssues([c('a', 'zz'), c('b', 'b'), c('a')])).toEqual([
      'duplicate id a',
      'a needs zz, which does not exist',
      'b lists itself as a prerequisite',
    ]);
  });

  it('spells out a cycle', () => {
    expect(graphIssues([c('a', 'c'), c('b', 'a'), c('c', 'b'), c('d')])).toEqual(['cycle: a needs c needs b needs a']);
  });
});

describe('ConceptGraph', () => {
  const g = new ConceptGraph([c('softmax', 'exp', 'argmax'), c('exp'), c('argmax', 'vector'), c('vector'), c('ce', 'softmax')]);

  it('orders prerequisites first, by depth then input order', () => {
    expect(g.order.map((x) => x.id)).toEqual(['exp', 'vector', 'argmax', 'softmax', 'ce']);
  });

  it('measures depth as the longest prerequisite chain', () => {
    expect(Object.fromEntries(g.depth)).toEqual({ exp: 0, vector: 0, argmax: 1, softmax: 2, ce: 3 });
  });

  it('lists direct dependents', () => {
    expect(g.dependents.get('exp')).toEqual(['softmax']);
    expect(g.dependents.get('ce')).toEqual([]);
  });

  it('refuses an invalid graph', () => {
    expect(() => new ConceptGraph([c('a', 'b')])).toThrow(/a needs b/);
  });
});
