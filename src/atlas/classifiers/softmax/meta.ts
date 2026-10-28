import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'softmax',
  title: 'Softmax',
  blurb: 'Turns a row of scores into probabilities that are positive and add up to one.',
  prereqs: ['exp-log', 'argmax'],
  mastery: { streak: 5, seconds: 40 },
};
