import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'layer-norm',
  title: 'Layer normalization',
  blurb: 'Normalize each example on its own, across its features, so nothing depends on the rest of the batch.',
  prereqs: ['batch-norm'],
  mastery: { streak: 4, seconds: 40 },
  deeper: [{ chapter: 'transformer' }],
};
