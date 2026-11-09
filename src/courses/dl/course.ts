// The deep learning course, the site's first: its concept ids predate courses, so they carry no prefix.
import type { CourseDef } from '../course';

export const course: CourseDef = {
  code: 'Atlas',
  title: 'AI by mastery',
  era: 'A growing map of concepts',
  blurb: 'Built differently: every idea is a small concept with a short voiced explainer and generated problems. Master one and the concepts built on it unlock; mastered ones come back for review before you forget them.',
  idPrefix: '',
  domains: [
    { id: 'linear-algebra', title: 'Linear algebra', color: 'blue' },
    { id: 'calculus', title: 'Calculus', color: 'purple' },
    { id: 'classifiers', title: 'Classifiers', color: 'teal' },
    { id: 'optimization', title: 'Optimization', color: 'gold' },
    { id: 'backprop', title: 'Backpropagation', color: 'red' },
    { id: 'networks', title: 'Neural networks', color: 'green' },
    { id: 'training', title: 'Training', color: 'orange' },
    { id: 'convnets', title: 'ConvNets', color: 'slate' },
    { id: 'sequences', title: 'Sequence models', color: 'teal' },
    { id: 'transformers', title: 'Transformers', color: 'blue' },
    { id: 'language-models', title: 'Language models', color: 'purple' },
    { id: 'scale', title: 'Scale', color: 'gold' },
    { id: 'generative', title: 'Seeing and generating', color: 'green' },
    { id: 'post-training', title: 'Post-training', color: 'red' },
    { id: 'inference', title: 'Reasoning and inference', color: 'orange' },
    { id: 'interpretability', title: 'Interpretability', color: 'slate' },
    { id: 'frontier', title: 'Frontier', color: 'purple' },
  ],
};
