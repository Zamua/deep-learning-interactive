import type { SymbolMap } from '../core/symbols';

/** Shared by the diffusion chapter and its lecture, so a symbol keeps its color across both. */
export const DIFFUSION_SYMBOLS: SymbolMap = {
  x0: {
    color: 'orange',
    name: 'x₀: a clean data point (here a point of the two moons; for images, a whole image)',
    tex: 'x_0',
    code: ['x0', 'data'],
    about: 'Training picks it from the data, 1,000 toy points of two numbers each. Sampling never sees it, only the guess the network implies: x̂₀ = (x_t − √(1 − ᾱ_t) ε_θ) / √ᾱ_t, which is what DDIM steps through.',
  },
  xt: {
    color: 'purple',
    name: 'x_t: the point after t steps of noise; while sampling, the current noisy point',
    tex: 'x_t',
    code: ['xt', 'x'],
    about: 'x_t = √ᾱ_t x₀ + √(1 − ᾱ_t) ε: the data at t = 0, nearly pure Gaussian noise at t = T = 100. Sampling walks a batch of 500 such points from T back to 0. The name diffusion is borrowed from physics (Sohl-Dickstein et al., 2015): noise spreads through the data like ink through water.',
  },
  eps: {
    color: 'teal',
    name: 'ε: standard Gaussian noise, the thing the network learns to predict',
    tex: '\\epsilon',
    code: ['eps'],
    about: 'A fresh draw from a standard bell curve, the same shape as x₀. As a target it has the same size at every noise level, so one network can serve them all (flow matching targets ε − x₀ instead).',
  },
  epsth: {
    color: 'blue',
    name: 'ε_θ: the network (weights θ) and its guess of the noise in x_t',
    tex: '\\epsilon_\\theta',
    code: ['eps_pred', 'model'],
    about: 'model(x_t, t) on the toy is a small MLP of about ten thousand weights; model(x, t, c) adds the condition. Flipped and divided by √(1 − ᾱ_t), its output estimates the score, the arrow toward denser data.',
  },
  beta: {
    color: 'green',
    name: 'β_t: the variance of the noise added at step t (the noise schedule)',
    tex: '\\beta_t',
    code: ['beta'],
    about: 'Each forward step shrinks x by √(1 − β_t) and adds noise of variance β_t, which keeps the total variance at one. The toy rises from 0.001 to 0.2 over 100 steps; DDPM went from 0.0001 to 0.02 over 1,000.',
  },
  alpha: {
    color: 'green',
    name: 'α_t = 1 − β_t: the share of variance one step keeps',
    tex: '\\alpha_t',
    code: ['alpha'],
    about: 'Close to 1 at every step. Sampling divides by √α_t to undo the shrink of one forward step.',
  },
  ab: {
    color: 'slate',
    name: 'ᾱ_t = α₁ α₂ ⋯ α_t: the share of x₀ that survives to step t',
    tex: '\\bar\\alpha_t',
    code: ['alpha_bar', 'ab'],
    about: 'np.cumprod(alpha), falling from 1 toward 0, it lets training jump straight to any step: √ᾱ_t weights the signal and √(1 − ᾱ_t) the noise. Some papers write α for it, so check which is meant.',
  },
  c: {
    color: 'gold',
    name: 'c: the condition, here which moon to draw (for images, a class or a caption)',
    code: ['c'],
    about: 'Training replaces it with NULL about one time in five, so the same network also learns the unconditional answer that guidance needs. In Stable Diffusion, c is a caption, read through cross attention.',
  },
  w: {
    color: 'red',
    name: 'w: the guidance scale (0 ignores the label, 1 follows it, more exaggerates it)',
    code: ['w'],
    about: 'ε_pred = ε_u + w (ε_c − ε_u): above 1 it buys faithfulness with diversity, and Stable Diffusion\'s default is 7.5. The method is called classifier-free because earlier guidance steered with a separately trained classifier.',
  },
  L: {
    color: 'red',
    name: 'L: the loss, a mean squared error',
    code: ['loss'],
    about: 'Between the true noise ε and the guess ε_θ, or in flow matching between ε − x₀ and v_θ. Always guessing zero scores 1; the toy settles near 0.2, and most of what is left is unavoidable at high noise.',
  },
  vth: {
    color: 'blue',
    name: 'v_θ: the network\'s predicted velocity, the direction from data toward noise',
    tex: 'v_\\theta',
    code: ['v_pred'],
    about: 'Trained to match ε − x₀ along the straight line x_t = (1 − t) x₀ + t ε; it learns the average direction of all the lines through a point. Sampling starts from noise at t = 1 and takes Euler steps x = x − v / k back to 0.',
  },
};
