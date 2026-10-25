import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'gan',
  title: 'Generative adversarial networks',
  blurb: 'A generator makes fakes and a discriminator calls them out; each trains against the other.',
  prereqs: ['mlp-forward', 'cross-entropy', 'sigmoid-grad', 'gd-step'],
  mastery: { streak: 4, seconds: 45 },
  deeper: [{ chapter: 'unsupervised' }],
};
