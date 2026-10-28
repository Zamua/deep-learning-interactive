import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'quantization',
  title: 'Quantization',
  blurb: 'Store weights as 8-bit or 4-bit integers and a scale: a half or a quarter of the bytes, for a small rounding error.',
  prereqs: ['training-memory'],
  mastery: { streak: 4, seconds: 45 },
};
