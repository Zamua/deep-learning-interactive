import { describe, expect, it } from 'vitest';
import { ConceptGraph } from './graph';
import { fold, searchConcepts } from './search';
import type { Concept } from './types';

const c = (id: string, title: string, blurb = '', prereqs: string[] = []): Concept => ({ id, title, blurb, prereqs, domain: 'd', mastery: { streak: 3, seconds: 20 } });
const G = new ConceptGraph([
  c('attention-cost', 'The cost of attention', 'Quadratic in the sequence length.'),
  c('self-attention', 'Self-attention', 'Every token looks at every other.'),
  c('attention', 'Attention', 'A weighted average of values.'),
  c('swiglu', 'Gated MLPs', 'A smooth gate inside the MLP.', ['self-attention']),
  c('cafe', 'Café au lait', 'Milk, coffee and foam.'),
  c('multi-head', 'Multi-head attention', 'Several attentions side by side.', ['attention']),
  c('backprop', 'Backpropagation', 'Gradients, layer by layer.'),
  c('propagation', 'Propagation of errors', 'How mistakes travel.'),
]);
const ids = (q: string) => searchConcepts(G, q).map((h) => h.id);

describe('fold', () => {
  it('drops case, accents and hyphens', () => {
    expect(fold('  Café-AU   Lait ')).toBe('cafe au lait');
  });
});

describe('searchConcepts', () => {
  it('ranks a title that starts with the query first, then a title word, then anywhere in the title', () => {
    expect(ids('prop')).toEqual(['propagation', 'backprop']);
    expect(searchConcepts(G, 'prop').map((h) => h.reason)).toEqual(['title-start', 'title']);
    expect(ids('atten')).toEqual(['attention', 'attention-cost', 'self-attention', 'multi-head', 'swiglu']);
  });

  it('then the id as a second name, the blurb, and what a concept builds on', () => {
    expect(ids('swiglu')).toEqual(['swiglu']);
    expect(ids('foam')).toEqual(['cafe']);
    expect(searchConcepts(G, 'self attention')).toEqual([{ id: 'self-attention', reason: 'title-start', span: [0, 14] }, { id: 'swiglu', reason: 'builds-on' }]);
  });

  it('folds case and accents in both the query and the titles', () => {
    expect(ids('CAFE')).toEqual(['cafe']);
    expect(ids('café')).toEqual(['cafe']);
  });

  it('matches a query of several words when each word appears somewhere', () => {
    expect(searchConcepts(G, 'gate mlp')).toEqual([{ id: 'swiglu', reason: 'words' }]);
  });

  it('marks where the query sits in the original title, even through accents and hyphens', () => {
    const [hit] = searchConcepts(G, 'cafe au');
    expect(hit!.span).toEqual([0, 7]);
    expect('Café au lait'.slice(...hit!.span!)).toBe('Café au');
    const selfAttention = searchConcepts(G, 'f att').find((h) => h.id === 'self-attention')!;
    expect('Self-attention'.slice(...selfAttention.span!)).toBe('f-att');
  });

  it('finds nothing for an empty query, and keeps to the limit', () => {
    expect(ids('   ')).toEqual([]);
    expect(searchConcepts(G, 'a', 2)).toHaveLength(2);
  });
});
