import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'token-ratio',
  title: 'Tokens per parameter',
  blurb: 'On a fixed budget, a bigger model reads fewer tokens; the lowest loss comes at about 20 tokens per parameter.',
  prereqs: ['training-flops', 'power-laws'],
  mastery: { streak: 4, seconds: 40 },
  from: 'chinchilla',
};
