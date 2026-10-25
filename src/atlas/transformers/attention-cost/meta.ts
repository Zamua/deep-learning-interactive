import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'attention-cost',
  title: 'The cost of attention',
  blurb: 'The score matrix is T by T, so doubling the context quadruples attention\'s work and memory.',
  prereqs: ['self-attention', 'multi-head'],
  mastery: { streak: 4, seconds: 40 },
  deeper: [{ chapter: 'transformer' }],
};
