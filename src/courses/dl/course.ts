// The deep learning course, the site's first: its concept ids predate courses, so they carry no prefix.
import type { CourseDef } from '../course';

export const course: CourseDef = {
  title: 'Deep Learning',
  blurb: 'From vectors to transformers, one idea at a time.',
  cover: '#3d5a4c',
  idPrefix: '',
  domains: [
    { id: 'linear-algebra', title: 'Linear algebra' },
    { id: 'calculus', title: 'Calculus' },
    { id: 'classifiers', title: 'Classifiers' },
    { id: 'optimization', title: 'Optimization' },
    { id: 'backprop', title: 'Backpropagation' },
    { id: 'networks', title: 'Neural networks' },
    { id: 'training', title: 'Training' },
    { id: 'convnets', title: 'ConvNets' },
    { id: 'sequences', title: 'Sequence models' },
    { id: 'transformers', title: 'Transformers' },
    { id: 'language-models', title: 'Language models' },
    { id: 'scale', title: 'Scale' },
    { id: 'generative', title: 'Seeing and generating' },
    { id: 'post-training', title: 'Post-training' },
    { id: 'inference', title: 'Reasoning and inference' },
    { id: 'interpretability', title: 'Interpretability' },
    { id: 'frontier', title: 'Frontier' },
  ],
};
