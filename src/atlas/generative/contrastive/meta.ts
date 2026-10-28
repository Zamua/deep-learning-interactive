import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'contrastive',
  title: 'Pull, push and temperature',
  blurb: 'The contrastive loss pulls each positive in and pushes each negative away by its probability; a small temperature aims the push at the closest negatives.',
  prereqs: ['contrastive-loss'],
  mastery: { streak: 4, seconds: 45 },
};
