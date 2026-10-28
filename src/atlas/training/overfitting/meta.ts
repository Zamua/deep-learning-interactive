import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'overfitting',
  title: 'Overfitting',
  blurb: 'Training loss keeps falling while validation loss rises: the model is memorizing, and a held-out split shows it.',
  prereqs: ['minibatch', 'learning-rate'],
  mastery: { streak: 4, seconds: 25 },
};
