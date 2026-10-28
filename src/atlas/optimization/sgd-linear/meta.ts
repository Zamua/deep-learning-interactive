import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'sgd-linear',
  title: 'SGD step',
  blurb: 'One full update of a linear classifier: every weight and bias steps against its gradient, and the right class\'s row moves toward x.',
  prereqs: ['linear-grad', 'gd-step'],
  mastery: { streak: 4, seconds: 60 },
};
