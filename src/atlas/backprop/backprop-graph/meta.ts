import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'backprop-graph',
  title: 'Backprop on a graph',
  blurb: 'Walk the graph backwards: each node multiplies the gradient from above by its local slope, and branches add.',
  prereqs: ['gates'],
  mastery: { streak: 4, seconds: 45 },
  deeper: [{ chapter: 'backprop', section: 'local' }],
};
