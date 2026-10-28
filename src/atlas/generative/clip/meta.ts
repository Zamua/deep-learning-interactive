import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'clip',
  title: 'CLIP',
  blurb: 'Images and captions in one space: a batch\'s similarity matrix, trained so each image picks its own caption.',
  prereqs: ['contrastive', 'embeddings'],
  mastery: { streak: 4, seconds: 45 },
};
