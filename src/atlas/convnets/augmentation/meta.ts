import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'augmentation',
  title: 'Data augmentation',
  blurb: 'Flip, crop and recolor training images in ways that keep their labels, so the model sees more variety.',
  prereqs: ['overfitting', 'linear-score'],
  mastery: { streak: 4, seconds: 30 },
};
