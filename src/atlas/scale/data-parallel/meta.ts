import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'data-parallel',
  title: 'Data parallelism',
  blurb: 'Every GPU holds the whole model and a slice of the batch; their gradients are averaged before each step.',
  prereqs: ['minibatch'],
  mastery: { streak: 4, seconds: 40 },
  deeper: [{ chapter: 'parallelism' }],
};
