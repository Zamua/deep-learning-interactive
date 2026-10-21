import type { Glossary } from '../../lecture/glossary';

export const glossary: Glossary = {
  mix: {
    is: 'noises clean data to step t in one jump',
    more: 'It returns √ᾱ_t times the clean input plus √(1 − ᾱ_t) times the noise eps, the same as t small steps of the forward process. Latent diffusion applies it to z0 instead of pixels.',
  },
  mse: {
    is: 'the mean squared error between two arrays',
    more: 'The whole training loss: true noise against predicted noise, or in flow matching, the target velocity against v_pred. A network that always guesses zero scores 1.',
    eg: 'mse(np.array([1., 0.]), np.zeros(2))   # 0.5',
  },
  denoise_step: {
    is: 'one sampling step, from step t to t − 1',
    more: 'It asks the network for its noise guess, removes this step\'s share of it, undoes the shrink, and adds a little fresh noise. The sampling scene spells it out.',
  },
  init_mlp: {
    is: 'random starting weights for an MLP with these layer sizes',
    more: '26 inputs (the noisy point, plus sines and cosines of it and of the step), three hidden layers of 64, and 2 outputs, the noise guess: about ten thousand weights.',
  },
  make_batch: {
    is: 'a fresh batch of noisy training examples',
    more: 'For each of the 128 examples: a clean point from the moons, a random step t and new noise eps, mixed with the jump formula. It returns xt, t and eps.',
  },
  adam_update: {
    is: 'backpropagates the loss, then takes one Adam step',
    more: 'Lecture shorthand: the gradients of loss with respect to params are computed inside, then every weight moves by Adam\'s update.',
  },
  rand: {
    is: 'a random number between 0 and 1',
    more: 'rand() < 0.2 is true one time in five, so the label is replaced by NULL for about 20% of training examples.',
  },
  encoder: {
    is: 'the autoencoder\'s encoder: an image to its latent',
    more: 'It shrinks a 512 by 512 color image eight times on each side, into a 64 by 64 grid of 4 numbers: 48 times fewer numbers for diffusion to work on.',
  },
  sample: {
    is: 'runs the whole sampler, from noise to a latent',
    more: 'The same DDPM or DDIM loop as on the toy, in latent space, with the network reading the condition c at every step.',
  },
  decoder: {
    is: 'the autoencoder\'s decoder: a latent back to an image',
    more: 'Called once, at the very end of sampling. It learned to paint the fine texture back.',
  },
  patchify: {
    is: 'cuts the latent into p by p patch tokens',
    more: 'The first layer of the diffusion transformer, DiT (Peebles and Xie, 2022), which uses the name. A 4 by 64 by 64 latent with p = 2 gives 1,024 tokens of 16 numbers.',
    eg: 'patchify(zt, p=2).shape   # (1024, 16)',
  },
  ddpm_or_ddim: {
    is: 'either sampler: DDPM with fresh noise, or DDIM without',
    more: 'DDPM (denoising diffusion probabilistic models) adds noise at every step; DDIM (denoising diffusion implicit models) is deterministic and can skip steps. Both use the same trained network.',
  },
};
