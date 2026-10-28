import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'adam',
  title: 'Adam',
  blurb: 'Correct the running averages for their zero start, then step by the average gradient over its typical size: about η per parameter.',
  prereqs: ['adam-moments'],
  mastery: { streak: 4, seconds: 45 },
};
