import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'in-context',
  title: 'In-context learning',
  blurb: 'Examples placed in the prompt change what comes next, without changing a single weight.',
  prereqs: ['gpt'],
  mastery: { streak: 4, seconds: 40 },
};
