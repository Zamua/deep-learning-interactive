import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'convnet-arch',
  title: 'ConvNet architecture',
  blurb: 'Conv, ReLU and pooling repeated, then fully connected layers: track the shape at every stage.',
  prereqs: ['pooling', 'conv-params', 'mlp-forward'],
  mastery: { streak: 4, seconds: 50 },
  deeper: [{ chapter: 'convnets', section: 'architectures' }],
};
