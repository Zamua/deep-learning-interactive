import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'hyperparams',
  title: 'Hyperparameter search',
  blurb: 'Search learning rates on a log scale, at random rather than on a grid, and judge on validation data.',
  prereqs: ['overfitting'],
  mastery: { streak: 4, seconds: 30 },
};
