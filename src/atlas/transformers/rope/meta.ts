import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'rope',
  title: 'Rotary positions',
  blurb: 'Rotate each pair of query and key entries by an angle set by the position, so their dot product depends only on the distance.',
  prereqs: ['rotation'],
  mastery: { streak: 4, seconds: 50 },
  deeper: [{ chapter: 'modern-transformer' }],
};
