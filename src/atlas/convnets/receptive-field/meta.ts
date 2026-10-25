import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'receptive-field',
  title: 'Receptive field',
  blurb: 'How much of the input one output unit can see: stacked 3 × 3 layers see 5 × 5, then 7 × 7.',
  prereqs: ['conv-output-size'],
  mastery: { streak: 4, seconds: 30 },
  deeper: [{ chapter: 'convnets-practice', section: 'stacking' }],
};
