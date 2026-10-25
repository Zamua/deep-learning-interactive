import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'comp-graph',
  title: 'Computational graphs',
  blurb: 'A formula drawn as a graph of simple operations, evaluated forward from the inputs to the output.',
  prereqs: ['chain-rule'],
  mastery: { streak: 4, seconds: 30 },
  deeper: [{ chapter: 'backprop', section: 'simple' }],
};
