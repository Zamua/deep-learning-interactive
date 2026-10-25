import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'gates',
  title: 'Gate gradients',
  blurb: 'Add hands the gradient through, multiply swaps the inputs, and max routes it to the winner.',
  prereqs: ['comp-graph'],
  mastery: { streak: 5, seconds: 30 },
  deeper: [{ chapter: 'backprop', section: 'patterns' }],
};
