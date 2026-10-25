import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'adamw',
  title: 'AdamW',
  blurb: 'Weight decay applied to the weights directly, not passed through Adam\'s rescaled gradient.',
  prereqs: ['adam', 'l2-reg'],
  mastery: { streak: 4, seconds: 45 },
  deeper: [{ chapter: 'optimizers' }],
};
