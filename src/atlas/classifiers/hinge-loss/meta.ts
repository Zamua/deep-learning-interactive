import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'hinge-loss',
  title: 'Hinge loss',
  blurb: 'The multiclass SVM loss: a penalty for every wrong class that scores within a margin of the right one.',
  prereqs: ['linear-score'],
  mastery: { streak: 5, seconds: 45 },
  deeper: [{ chapter: 'linear-classification', section: 'svm' }],
};
