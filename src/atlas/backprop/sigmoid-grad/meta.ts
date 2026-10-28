import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'sigmoid-grad',
  title: 'Sigmoid gradient',
  blurb: 'The sigmoid squashes any number into (0, 1), and its slope is σ(1 − σ): never more than a quarter.',
  prereqs: ['backprop-graph', 'exp-log'],
  mastery: { streak: 5, seconds: 35 },
};
