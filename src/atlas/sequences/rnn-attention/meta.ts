import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'rnn-attention',
  title: 'Attention over the encoder',
  blurb: 'Instead of one squeezed state, the decoder takes a softmax-weighted average of every encoder state.',
  prereqs: ['seq2seq', 'softmax'],
  mastery: { streak: 4, seconds: 45 },
};
