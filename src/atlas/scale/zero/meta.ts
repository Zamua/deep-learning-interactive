import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'zero',
  title: 'Sharding the optimizer',
  blurb: 'Give each GPU a slice of the weights, gradients and Adam state instead of a full copy.',
  prereqs: ['training-memory', 'data-parallel'],
  mastery: { streak: 4, seconds: 45 },
  deeper: [{ chapter: 'parallelism' }],
};
