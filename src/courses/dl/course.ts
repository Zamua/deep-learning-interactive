// The deep learning course, the site's first: its concept ids predate courses, so they carry no prefix.
import type { CourseDef } from '../course';

export const course: CourseDef = {
  title: 'Deep Learning',
  blurb: 'From vectors to transformers, one idea at a time.',
  about: [
    'Seventeen chapters that build a working picture of modern neural networks, starting from vectors and derivatives and ending at the systems people use today.',
    'Every idea gets a short explainer you can listen to, a figure you can move, and problems that check you can use it. Nothing is assumed that an earlier chapter has not taught.',
  ],
  cover: '#3d5a4c',
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
