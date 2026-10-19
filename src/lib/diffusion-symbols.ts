import type { SymbolMap } from '../core/symbols';

/** Shared by the diffusion chapter and its lecture, so a symbol keeps its color across both. */
export const DIFFUSION_SYMBOLS: SymbolMap = {
  x0: { color: 'orange', name: 'x₀: a clean data point (here a point of the two moons; for images, a whole image)', tex: 'x_0', code: ['x0', 'data'] },
  xt: { color: 'purple', name: 'x_t: the point after t steps of noise; while sampling, the current noisy point', tex: 'x_t', code: ['xt', 'x'] },
  eps: { color: 'teal', name: 'ε: standard Gaussian noise, the thing the network learns to predict', tex: '\\epsilon', code: ['eps'] },
  epsth: { color: 'blue', name: 'ε_θ: the network (weights θ) and its guess of the noise in x_t', tex: '\\epsilon_\\theta', code: ['eps_pred', 'model'] },
  beta: { color: 'green', name: 'β_t: the variance of the noise added at step t (the noise schedule)', tex: '\\beta_t', code: ['beta'] },
  alpha: { color: 'green', name: 'α_t = 1 − β_t: the share of variance one step keeps', tex: '\\alpha_t', code: ['alpha'] },
  ab: { color: 'slate', name: 'ᾱ_t = α₁ α₂ ⋯ α_t: the share of x₀ that survives to step t', tex: '\\bar\\alpha_t', code: ['alpha_bar', 'ab'] },
  c: { color: 'gold', name: 'c: the condition, here which moon to draw (for images, a class or a caption)', code: ['c'] },
  w: { color: 'red', name: 'w: the guidance scale (0 ignores the label, 1 follows it, more exaggerates it)', code: ['w'] },
  L: { color: 'red', name: 'L: the loss, a mean squared error', code: ['loss'] },
  vth: { color: 'blue', name: 'v_θ: the network\'s predicted velocity, the direction from data toward noise', tex: 'v_\\theta', code: ['v_pred'] },
};
