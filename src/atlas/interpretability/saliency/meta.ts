import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'saliency',
  title: 'Saliency maps',
  blurb: 'The gradient of a class score with respect to the input pixels: which pixels would move the score most.',
  prereqs: ['backprop-graph', 'linear-score'],
  mastery: { streak: 4, seconds: 40 },
};
