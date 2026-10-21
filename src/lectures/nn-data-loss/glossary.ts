import type { Glossary } from '../../lecture/glossary';

export const glossary: Glossary = {
  net: {
    is: 'the network: inputs in, class scores out',
    more: 'The layers built in chapter 7. This chapter leaves it unchanged and works on everything around it: the data, the starting weights, normalization, regularization and the loss.',
  },
  batchnorm: {
    is: 'normalizes each feature over the batch, then rescales',
    more: 'Subtracts the batch mean, divides by the batch standard deviation, then applies the learned gamma and beta (Ioffe and Szegedy, 2015). It goes after a fully connected or conv layer, before the nonlinearity; test time uses running averages.',
  },
  R: {
    is: 'the regularization penalty on the weights',
    more: 'A weight penalty such as L2, half the sum of squared weights, or L1, the sum of absolute values. Scaled by reg (λ) and added to the data loss.',
  },
};
