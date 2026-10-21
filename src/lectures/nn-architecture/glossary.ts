import type { Glossary } from '../../lecture/glossary';

export const glossary: Glossary = {
  neuron: {
    is: 'one sigmoid neuron: a weighted sum, squashed',
    more: 'Computes w.dot(x) + b and squashes it with the sigmoid into P(y = 1 | x); trained with cross-entropy, it is logistic regression. The name comes from the classic brain model: inputs scaled at synapses, summed in the cell body, then a firing rate.',
  },
  target: {
    is: 'the wiggly function to approximate',
    more: '0.5 + 0.3 sin(8x) + 0.15 sin(25x). The bump construction samples its height at the middle of each piece.',
  },
  sig: {
    is: 'the sigmoid, written as a lambda',
    more: 'Applied to k * (x - a) with a large steepness k, it is nearly a step from 0 to 1 at a. Two steps subtracted make a bump.',
    eg: 'sig(0.0)   # 0.5',
  },
  backprop: {
    is: 'the backward pass: a gradient for every weight',
    more: 'Stands for the backprop of Chapter 6, here on the softmax loss of these scores plus an L2 penalty of strength reg. The gradients feed adam_update.',
  },
  TwoLayerNet: {
    is: 'a two-layer network: inputs, hidden units, classes',
    more: 'TwoLayerNet(2, H, 3) takes 2-D points, H hidden ReLU units and 3 class scores. Each seed gives it a different random start.',
  },
  '.train': {
    is: 'trains the network and returns its final loss',
    more: 'Collected per hidden size H over ten seeds: with 3 hidden units the final losses scatter, with 30 they all land at the same low loss.',
  },
};
