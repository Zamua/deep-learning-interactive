import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'neuron',
  title: 'A neuron',
  blurb: 'A weighted sum plus a bias, passed through an activation: a linear classifier with a bend.',
  prereqs: ['linear-score'],
  mastery: { streak: 4, seconds: 30 },
};
