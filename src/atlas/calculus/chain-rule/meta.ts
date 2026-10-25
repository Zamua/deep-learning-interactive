import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'chain-rule',
  title: 'Chain rule',
  blurb: 'The derivative of a function inside a function: multiply the local slopes.',
  prereqs: ['derivative-rules'],
  mastery: { streak: 5, seconds: 40 },
  deeper: [{ chapter: 'math-kit', section: 'chain-rule' }, { chapter: 'backprop', section: 'chain-rule' }],
};
