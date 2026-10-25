import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'self-attention',
  title: 'Self-attention in matrices',
  blurb: 'Every token attends to every token at once: softmax(QKᵀ/√d) times V, with shapes that line up.',
  prereqs: ['scaled-attention', 'matmul-shapes'],
  mastery: { streak: 4, seconds: 50 },
  deeper: [{ chapter: 'transformer' }],
};
