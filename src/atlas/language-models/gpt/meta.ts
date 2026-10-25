import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'gpt',
  title: 'A decoder-only language model',
  blurb: 'Embed, add positions, run causal transformer blocks, unembed: next-token probabilities at every position.',
  prereqs: ['transformer-block', 'causal-mask', 'positions', 'unembedding', 'char-lm'],
  mastery: { streak: 4, seconds: 50 },
  deeper: [{ chapter: 'pretraining' }],
};
