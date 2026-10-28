import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'linear-grad',
  title: 'Linear classifier gradient',
  blurb: 'The loss\'s gradient on a linear classifier\'s weights and biases: each weight gets its class\'s score gradient times its input.',
  prereqs: ['softmax-grad', 'linear-score'],
  mastery: { streak: 4, seconds: 45 },
  from: 'sgd-linear',
};
