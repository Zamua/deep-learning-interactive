import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'chain-slopes',
  title: 'Chained slopes',
  blurb: 'When one function feeds another, a nudge is scaled by each link in turn: multiply the local slopes.',
  prereqs: ['derivative-rules'],
  from: 'chain-rule',
  mastery: { streak: 5, seconds: 30 },
  deeper: [{ chapter: 'math-kit', section: 'chain-rule' }, { chapter: 'backprop', section: 'chain-rule' }],
};
