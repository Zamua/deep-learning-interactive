import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'residual-stream',
  title: 'The residual stream',
  blurb: 'Every block reads from one running vector per token and adds its output back in.',
  prereqs: ['transformer-block'],
  mastery: { streak: 4, seconds: 40 },
};
