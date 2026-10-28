import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'latent-attention',
  title: 'Latent attention',
  blurb: 'Cache one small latent vector per token and rebuild every head\'s keys and values from it.',
  prereqs: ['gqa', 'kv-memory'],
  mastery: { streak: 4, seconds: 50 },
};
