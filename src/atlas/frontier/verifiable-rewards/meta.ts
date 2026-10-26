import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'verifiable-rewards',
  title: 'Verifiable rewards',
  blurb: 'Score each sampled answer with a checker, 1 if right and 0 if wrong, instead of a learned reward model, and train on the group with GRPO.',
  prereqs: ['grpo', 'chain-of-thought'],
  mastery: { streak: 4, seconds: 45 },
  deeper: [{ chapter: 'grpo' }],
};
