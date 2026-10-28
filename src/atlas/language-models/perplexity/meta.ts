import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'perplexity',
  title: 'Perplexity',
  blurb: 'e to the average next-token loss: how many tokens the model is, in effect, choosing between.',
  prereqs: ['char-lm', 'exp-log'],
  mastery: { streak: 4, seconds: 40 },
};
