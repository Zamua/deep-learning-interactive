import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'iou',
  title: 'Non-max suppression',
  blurb: 'Keep one box per object: sort by confidence, keep the best, and drop the boxes that overlap it too much.',
  prereqs: ['box-iou'],
  mastery: { streak: 4, seconds: 50 },
};
