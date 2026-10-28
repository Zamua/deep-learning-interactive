import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'sft',
  title: 'Supervised fine-tuning',
  blurb: 'Train on conversations, counting the loss only on the assistant\'s tokens.',
  prereqs: ['gpt', 'transfer-learning'],
  mastery: { streak: 4, seconds: 45 },
};
