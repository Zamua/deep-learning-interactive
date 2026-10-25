import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'softmax-grad',
  title: 'Softmax gradient',
  blurb: 'The gradient of the cross-entropy loss with respect to the scores: p minus the one-hot label.',
  prereqs: ['cross-entropy', 'chain-rule'],
  mastery: { streak: 5, seconds: 40 },
  deeper: [{ chapter: 'optimization', section: 'analytic' }],
};
