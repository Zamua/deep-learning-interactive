import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'distillation',
  title: 'Distillation',
  blurb: 'Train a small student to match a large teacher\'s softened probabilities, not just the one right answer.',
  prereqs: ['cross-entropy', 'sampling'],
  mastery: { streak: 4, seconds: 45 },
};
