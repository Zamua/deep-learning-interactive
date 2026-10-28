import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'dot-product',
  title: 'Dot product',
  blurb: 'Multiply matching entries and add them up: one number that says how much two vectors agree.',
  prereqs: ['vector'],
  mastery: { streak: 5, seconds: 25 },
};
