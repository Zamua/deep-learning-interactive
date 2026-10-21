import type { Glossary } from '../../lecture/glossary';

export const glossary: Glossary = {
  translate: {
    is: 'turns English words into French words',
    more: 'The whole lecture in one call: an encoder RNN reads the source sentence and a decoder RNN writes the translation. The models here are tiny translators trained on a toy slice of English and French.',
  },
  gru_enc: {
    is: 'one encoder step: folds the next word into h',
    more: 'A GRU cell takes the old state and one word embedding and returns the new 32-number state. GRU stands for gated recurrent unit, a simpler cousin of the LSTM introduced by Cho et al. in 2014 for this kind of translation model.',
  },
  gru_dec: {
    is: 'one decoder step: updates s from its input',
    more: 'A second GRU, with its own weights. Its input joins the embedding of the word just written with the context: the fixed c, or with attention a fresh c_t for every word.',
  },
  decoder_step: {
    is: 'the probabilities of the next French word',
    more: 'Given the previous word, it returns p over the whole French vocabulary. In training that previous word is the correct one, not the model\'s guess: teacher forcing.',
  },
  encode: {
    is: 'reads a whole sentence into one context vector',
    more: 'It runs the encoder over every word and returns its last state, 32 numbers whatever the sentence length. That fixed size is the bottleneck.',
  },
  random_sentence: { is: 'a random toy English sentence of L words', more: 'Drawn from the same toy grammar as the training sentences, 40 fresh ones for every length.' },
  perfect: {
    is: 'whether model m translates x with no mistakes',
    more: 'True only when every output word matches the reference French, so np.mean over the 40 tests is the share translated perfectly.',
  },
  encode_bidirectional: {
    is: 'one encoder state per word, read both ways',
    more: 'One RNN reads left to right and another right to left, and h_j joins their states at word j, so it describes the word with what comes before and after. Every state is kept, not just the last.',
  },
  attention_weights: {
    is: 'the attention weights for output word t',
    more: 'One weight per source word, positive and summing to 1. Stacked over t, the rows form the alignment matrix A.',
  },
};
