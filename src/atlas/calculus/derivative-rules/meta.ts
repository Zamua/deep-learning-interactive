import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'derivative-rules',
  title: 'Derivative rules',
  blurb: 'The power, exponential, log and sum rules: derivatives without limits.',
  prereqs: ['derivative', 'exp-log'],
  mastery: { streak: 5, seconds: 30 },
  deeper: [{ chapter: 'math-kit', section: 'derivatives' }],
};
