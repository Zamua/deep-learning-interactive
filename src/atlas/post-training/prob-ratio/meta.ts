import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'prob-ratio',
  title: 'The probability ratio',
  blurb: 'Reuse one batch for several updates: weigh each sampled token by its new probability over its old one.',
  prereqs: ['advantage'],
  mastery: { streak: 4, seconds: 40 },
  from: 'ppo',
};
