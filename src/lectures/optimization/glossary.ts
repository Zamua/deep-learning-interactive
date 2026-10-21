import type { Glossary } from '../../lecture/glossary';

export const glossary: Glossary = {
  svm_loss: {
    is: 'the multiclass SVM loss of W on some examples',
    more: 'Evaluated here on one example or on all 300, with or without the penalty reg, to show single hinges with sharp creases blending into a smooth convex bowl.',
  },
  f: {
    is: 'the function whose slope is measured',
    more: 'x squared in the slope demo, the loss as a function of W in the numerical gradient, and the softmax loss as a function of one weight w in the experiment on h.',
  },
  slope: {
    is: 'rise over run: the slope of f at x',
    more: 'A one-sided difference, (f(x + h) - f(x)) / h. As h shrinks, the line through the two points settles onto the tangent, and the ratio onto the derivative.',
    eg: 'slope(lambda x: x ** 2, 3.0)   # 6.00001',
  },
  eval_numerical_gradient: {
    is: 'the gradient by nudging each weight in turn',
    more: 'For each entry it takes the centered difference (f(W + h) - f(W - h)) / 2h, then puts the weight back. Simple and hard to get wrong, but two loss evaluations per weight.',
  },
  svm_grad: {
    is: 'the analytic SVM gradient, from calculus',
    more: 'Evaluates the hand-derived formula: x added to each violating class\'s row, x subtracted from the correct row, averaged over examples, plus 2 * reg * W. Fast and exact, so the numerical gradient checks it.',
  },
  evaluate_gradient: {
    is: 'the gradient of the loss with respect to W',
    more: 'The course\'s pseudocode name for any gradient routine, analytic in practice. Given a mini-batch instead of the whole training set, it returns a cheap, noisy estimate of the same gradient.',
  },
  dL: {
    is: 'the gradient of the narrow valley loss',
    more: 'For L = 0.5 * (w0² + c * w1²) the slopes are w0 and c * w1. The across direction is c = 10 times steeper, and it sets the speed limit for the step size.',
  },
};
