import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'training-flops',
  title: 'Training compute: 6ND',
  blurb: 'Each parameter costs about 2 operations per token forward and 4 backward: 6 times parameters times tokens.',
  prereqs: ['transformer-params', 'mlp-backprop'],
  mastery: { streak: 4, seconds: 45 },
};
