import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'induction-heads',
  title: 'Induction heads',
  blurb: 'Two heads that together find the last time this token appeared and copy what came after it.',
  prereqs: ['residual-stream', 'causal-mask'],
  mastery: { streak: 4, seconds: 45 },
};
