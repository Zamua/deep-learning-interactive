import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'seq2seq',
  title: 'Encoder and decoder',
  blurb: 'An encoder reads the input sequence into a state; a decoder writes the output from it, one token at a time.',
  prereqs: ['lstm', 'char-lm'],
  mastery: { streak: 4, seconds: 30 },
};
