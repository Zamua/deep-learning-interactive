import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'matrix-shape',
  title: 'Matrix shapes',
  blurb: 'Rows by columns: reading a matrix\'s shape, and finding any entry by its row and column.',
  prereqs: ['vector'],
  mastery: { streak: 4, seconds: 15 },
  deeper: [{ chapter: 'math-kit', section: 'matrices' }],
};
