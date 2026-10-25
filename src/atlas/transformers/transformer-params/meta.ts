import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'transformer-params',
  title: 'Counting transformer parameters',
  blurb: 'About 12d² per block: 4d² for attention and 8d² for the MLP.',
  prereqs: ['transformer-block', 'param-count'],
  mastery: { streak: 4, seconds: 50 },
  deeper: [{ chapter: 'transformer' }],
};
