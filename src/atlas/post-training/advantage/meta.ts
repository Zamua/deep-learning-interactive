import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'advantage',
  title: 'Why a baseline is allowed',
  blurb: 'Weighted by probability, the gradients of ln π add up to zero, so a baseline leaves the average estimate unchanged.',
  prereqs: ['baseline'],
  mastery: { streak: 4, seconds: 45 },
  deeper: [{ chapter: 'policy-gradients' }],
};
