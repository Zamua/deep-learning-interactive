import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'iou',
  title: 'Boxes and IoU',
  blurb: 'Score how well two boxes overlap by intersection over union, and drop the weaker of two boxes that overlap too much.',
  prereqs: ['convnet-arch'],
  mastery: { streak: 4, seconds: 50 },
  deeper: [{ chapter: 'detection' }],
};
