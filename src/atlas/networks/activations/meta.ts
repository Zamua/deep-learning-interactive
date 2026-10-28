import type { ConceptMeta } from '../../../mastery/domain/types';

export const meta: ConceptMeta = {
  id: 'activations',
  title: 'Activation functions',
  blurb: 'ReLU, sigmoid and tanh: what each outputs, where each goes flat, and why ReLU won.',
  prereqs: ['neuron', 'sigmoid-grad'],
  mastery: { streak: 5, seconds: 25 },
};
