import type { SymbolMap } from '../core/symbols';

/** Shared by the nn-learning chapter and its lecture, so a symbol keeps its color across both. */
export const NN_LEARNING_SYMBOLS: SymbolMap = {
  w: {
    color: 'blue',
    name: 'w: the parameters (weights) being trained',
    code: ['w', 'W', 'W1'],
    about: 'In code also W, and W1 for the first layer\'s matrix. Every update rule here changes it: SGD, momentum, Nesterov, Adagrad, RMSprop, Adam, Newton. A running average of it, w_test, often evaluates better than w itself.',
  },
  dw: {
    color: 'teal',
    name: '∇L: the gradient of the loss with respect to w',
    tex: '\\nabla L',
    code: ['dw', 'dW'],
    about: 'Same shape as w. SGD steps against it, momentum accumulates it into a velocity, and adaptive methods divide it by its typical size, so each parameter moves by roughly the learning rate.',
  },
  lr: {
    color: 'slate',
    name: 'η: the learning rate (step size)',
    tex: '\\eta',
    code: ['learning_rate', 'lr', 'lr0'],
    about: 'Scales every update, and is the most important knob: searched on a log scale and decayed during training. A healthy update is about a thousandth of the weight\'s size. The name says what it sets: how far each update moves the weights, and so how fast the network learns.',
  },
  mu: {
    color: 'gold',
    name: 'μ: the momentum coefficient, often 0.9',
    tex: '\\mu',
    code: ['mu'],
    about: 'In v = mu * v - learning_rate * dw it shrinks the old velocity every step, like friction. 0.9 is common and lets steps grow up to ten times larger. Not the mean μ of earlier chapters.',
  },
  L: {
    color: 'red',
    name: 'L: the loss',
    code: ['loss'],
    about: 'Plotted against epochs: a good learning rate drops fast and keeps improving, a high one stalls, a very high one explodes. An untrained 10-class softmax should start near -log(1/10) = 2.302.',
  },
  lam: {
    color: 'purple',
    name: 'λ: regularization strength',
    tex: '\\lambda',
    code: ['reg'],
    about: 'reg in code. Turned off (reg=0.0) for the gradient check and the memorization test, and turned way up (1e3) to confirm the loss rises. The search samples it on a log scale, 10 ** uniform(-5, 5).',
  },
  h: {
    color: 'orange',
    name: 'h: the small step used for a numerical gradient',
    code: ['h'],
    about: 'Best around 1e-6 to 1e-5 in double precision. Too large and the line is a poor stand-in for the curve; too small and subtracting two nearly equal losses wipes out the digits.',
  },
};
