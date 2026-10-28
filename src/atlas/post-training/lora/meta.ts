import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'lora',
  title: 'LoRA',
  blurb: 'Freeze W and learn a low-rank change BA: a sliver of the parameters.',
  prereqs: ['transfer-learning', 'matmul-shapes', 'param-count'],
  mastery: { streak: 4, seconds: 45 },
};
