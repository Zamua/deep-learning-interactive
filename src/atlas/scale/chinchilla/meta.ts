import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'chinchilla',
  title: 'Compute-optimal size',
  blurb: 'For a budget C, solve C = 120N² for the compute-optimal size: parameters and tokens grow together, as the square root of compute.',
  prereqs: ['token-ratio'],
  mastery: { streak: 4, seconds: 50 },
  deeper: [{ chapter: 'scaling-laws' }],
};
