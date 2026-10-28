import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'masked-lm',
  title: 'Masked language models',
  blurb: 'Hide some tokens and predict them from both sides, instead of predicting each token from the left only.',
  prereqs: ['gpt'],
  mastery: { streak: 4, seconds: 40 },
};
