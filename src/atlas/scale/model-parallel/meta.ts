import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'model-parallel',
  title: 'Tensor and pipeline parallelism',
  blurb: 'Split one model across GPUs: each matrix by its columns, or the stack by its layers.',
  prereqs: ['data-parallel', 'mlp-forward'],
  mastery: { streak: 4, seconds: 45 },
  deeper: [{ chapter: 'parallelism' }],
};
