import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'hybrid-attention',
  title: 'Hybrid attention',
  blurb: 'Mostly fixed-state layers, with full attention every few: a KV cache only where exact recall needs one.',
  prereqs: ['gated-deltanet'],
  mastery: { streak: 4, seconds: 50 },
};
