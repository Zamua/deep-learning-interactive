import type { SymbolMap } from '../core/symbols';

/** Shared by the optimizers chapter and its lecture, so a symbol keeps its color across both. */
export const OPTIMIZERS_SYMBOLS: SymbolMap = {
  W: {
    color: 'blue',
    name: 'W: the weights (a matrix, or any parameter tensor)',
    code: ['W', 'w'],
    about: 'Adam treats it as a list of numbers, one step size per entry. Muon treats a hidden layer\'s W as a linear map, which turns the unit circle into an ellipse; in the race scene it is a 2 by 2 matrix learned toward W_star.',
  },
  G: {
    color: 'teal',
    name: 'G: the gradient of the loss with respect to the weights',
    code: ['G', 'g', 'grad'],
    about: 'For a linear layer it is a sum of outer products, one per example, so it has the same shape as W. Its singular values are lopsided, a few large and many tiny, which is what Muon corrects.',
  },
  M: {
    color: 'gold',
    name: 'M: momentum, a moving average of recent gradients',
    code: ['M', 'm'],
    about: 'Adam\'s m mixes 0.9 of the old average with 0.1 of the new gradient; Muon keeps M = 0.95 * M + G as a matrix. The name is borrowed from physics: like a ball rolling downhill, the update keeps moving the way it has been going.',
  },
  v: {
    color: 'orange',
    name: 'v: a moving average of squared gradients (Adam)',
    code: ['v'],
    about: 'Adam divides by sqrt(v), so every parameter steps by about the same amount, whatever the size of its gradients. Its 0.999 decay makes it a slow average that rests on only a few samples early on, one reason for warmup.',
  },
  O: {
    color: 'purple',
    name: 'O: the orthogonalized update, U Vᵀ, every singular value set to 1',
    code: ['O'],
    about: 'Same singular directions as M, with no stretch, so the step moves every direction by the same amount. Of all matrices whose singular values are all 1, it is the closest to M; newton_schulz5 computes it approximately.',
  },
  sig: {
    color: 'red',
    name: 'σᵢ: the singular values, how much a matrix stretches each of its directions',
    tex: '\\sigma',
    code: ['S', 'sigma'],
    about: 'The SVD writes any matrix as rotate, stretch, rotate, U Σ Vᵀ, and the σᵢ are the stretches. Muon sets them all to 1; Newton-Schulz first divides by the norm so that none is above 1, then pushes the small ones up.',
  },
  lr: {
    color: 'slate',
    name: 'η: the learning rate',
    tex: '\\eta',
    code: ['lr', 'lr_t', 'peak', 'eta'],
    about: 'Every update is scaled by it. Over training it follows a schedule: a warmup ramp from near zero, a peak, then a cosine or WSD decay to a small value below the noise floor.',
  },
  lam: {
    color: 'green',
    name: 'λ: weight decay strength',
    tex: '\\lambda',
    code: ['wd'],
    about: 'In AdamW every step shrinks each weight by lr * wd, the same fraction for all of them; 0.1 is typical, on weight matrices only. Put inside Adam\'s gradient instead, it gets divided by sqrt(v) and stops being uniform.',
  },
};
