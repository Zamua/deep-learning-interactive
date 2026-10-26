import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'softmax-grad',
  title: 'Deriving the softmax gradient',
  blurb: 'Why the gradient on the scores is p, minus one at the right answer: the chain rule through the log of the total.',
  prereqs: ['score-grad', 'chain-rule'],
  mastery: { streak: 5, seconds: 40 },
  deeper: [{ chapter: 'optimization', section: 'analytic' }],
};
