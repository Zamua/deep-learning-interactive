import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'lr-decay',
  title: 'Warmup and decay',
  blurb: 'Ramp the learning rate up from zero over the first steps, then lower it: by a factor every so many steps, or in a straight line.',
  prereqs: ['learning-rate'],
  mastery: { streak: 4, seconds: 30 },
  from: 'lr-schedule',
};
