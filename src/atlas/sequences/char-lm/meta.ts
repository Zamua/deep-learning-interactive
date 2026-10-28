import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'char-lm',
  title: 'Next-token prediction',
  blurb: 'At every step, softmax over the vocabulary predicts the next token; the loss adds up the cross-entropies.',
  prereqs: ['rnn-step', 'cross-entropy'],
  mastery: { streak: 4, seconds: 40 },
};
