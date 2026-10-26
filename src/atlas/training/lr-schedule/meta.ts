import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'lr-schedule',
  title: 'Cosine decay',
  blurb: 'Glide the learning rate from its top to its bottom along a cosine, slowly, then fast, then slowly, often after a warmup.',
  prereqs: ['lr-decay'],
  mastery: { streak: 4, seconds: 40 },
  deeper: [{ chapter: 'optimizers', section: 'schedules' }],
};
