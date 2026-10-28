import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'box-iou',
  title: 'Boxes and IoU',
  blurb: 'Score how well two boxes agree: the area they share over the area either one covers.',
  prereqs: ['convnet-arch'],
  mastery: { streak: 4, seconds: 50 },
  from: 'iou',
};
