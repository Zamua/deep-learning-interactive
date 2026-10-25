import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'argmax',
  title: 'Argmax',
  blurb: 'The position of the largest entry: how scores become a prediction.',
  prereqs: ['vector'],
  mastery: { streak: 4, seconds: 12 },
  deeper: [{ chapter: 'math-kit', section: 'notation' }],
};
