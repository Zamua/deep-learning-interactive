import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'argmax',
  title: 'Argmax',
  blurb: 'The position of the largest entry: which of several options scores highest.',
  prereqs: ['vector'],
  mastery: { streak: 4, seconds: 18 },
  deeper: [{ chapter: 'math-kit', section: 'notation' }],
};
