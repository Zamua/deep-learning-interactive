import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'learning-rate',
  title: 'Learning rate',
  blurb: 'How large a step can be: on a bowl a x², a rate of 1/(2a) lands in one step, and past 1/a every overshoot lands farther out.',
  prereqs: ['step-factor'],
  mastery: { streak: 4, seconds: 35 },
  deeper: [{ chapter: 'optimization', section: 'gradient-descent' }],
};
