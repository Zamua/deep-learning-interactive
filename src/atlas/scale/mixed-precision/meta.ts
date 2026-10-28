import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'mixed-precision',
  title: 'Mixed precision',
  blurb: 'Do the math in 16-bit numbers and keep a 32-bit master copy of the weights.',
  prereqs: ['training-memory'],
  mastery: { streak: 4, seconds: 40 },
};
