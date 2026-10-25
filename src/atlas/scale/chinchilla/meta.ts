import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'chinchilla',
  title: 'Compute-optimal size',
  blurb: 'For a fixed budget, grow parameters and tokens together: about 20 tokens per parameter.',
  prereqs: ['training-flops', 'power-laws'],
  mastery: { streak: 4, seconds: 50 },
  deeper: [{ chapter: 'scaling-laws' }],
};
