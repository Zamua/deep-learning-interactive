import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'softmax-grad',
  title: 'Softmax gradient',
  blurb: 'The gradient of the cross-entropy loss with respect to the scores: p, minus one at the right answer.',
  prereqs: ['cross-entropy', 'chain-rule', 'gradient'],
  mastery: { streak: 5, seconds: 40 },
  deeper: [{ chapter: 'optimization', section: 'analytic' }],
};
