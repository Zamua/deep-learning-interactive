import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'res-block',
  title: 'Residual blocks',
  blurb: 'y = x + F(x): the block adds a change to its input, and a 1 × 1 conv on the shortcut matches the shapes when F changes them.',
  prereqs: ['convnet-arch', 'residual'],
  mastery: { streak: 4, seconds: 35 },
};
