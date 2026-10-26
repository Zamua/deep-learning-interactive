import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'rotation',
  title: 'Rotating a pair',
  blurb: 'Turning a pair [a, b] by an angle gives [a cos − b sin, a sin + b cos]: a new direction, the same length.',
  prereqs: ['positions'],
  mastery: { streak: 4, seconds: 50 },
  from: 'rope',
  deeper: [{ chapter: 'modern-transformer' }],
};
