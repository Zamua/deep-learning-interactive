import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'lr-schedule',
  title: 'Learning rate schedules',
  blurb: 'Warm up from near zero, then decay: in steps, in a straight line, or along a cosine.',
  prereqs: ['learning-rate'],
  mastery: { streak: 4, seconds: 35 },
  deeper: [{ chapter: 'optimizers', section: 'schedules' }],
};
