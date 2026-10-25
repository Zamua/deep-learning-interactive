import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'batch-norm',
  title: 'Batch normalization',
  blurb: 'Normalize each feature over the batch to mean 0 and variance 1, then scale and shift by learned γ and β.',
  prereqs: ['mlp-forward', 'minibatch'],
  mastery: { streak: 4, seconds: 45 },
  deeper: [{ chapter: 'nn-data-loss', section: 'batchnorm' }],
};
