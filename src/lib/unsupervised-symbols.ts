import type { SymbolMap } from '../core/symbols';

/** Shared by the unsupervised chapter and its lecture, so a symbol keeps its color across both. */
export const UNSUPERVISED_SYMBOLS: SymbolMap = {
  x: {
    color: 'orange',
    name: 'x: a data point (an image, a clip, or here often a 2-D point)',
    code: ['x', 'X', 'x_real'],
    about: 'Its shape depends on the scene: a clip of 8 frames of 10 by 10 for the 3-D convolution, a 2-D point on an arc for the autoencoder and VAE, a single number for the two-bump GAN. With no labels, x is all the model gets, and an autoencoder uses it as its own target.',
  },
  z: {
    color: 'purple',
    name: 'z: the latent code, a few numbers that summarize x',
    code: ['z'],
    about: 'Much smaller than x: 1 number in the toy autoencoder and VAE, 100 in DCGAN. Latent means hidden: z is never observed, only inferred by the encoder or drawn from the prior.',
  },
  mu: {
    color: 'teal',
    name: 'μ: the mean the encoder predicts for z',
    tex: '\\mu',
    code: ['mu'],
    about: 'One per code number, read off the encoder\'s hidden layer. The KL penalty pulls it toward 0, the center of the prior.',
  },
  sig: {
    color: 'green',
    name: 'σ: the spread (standard deviation) the encoder predicts for z',
    tex: '\\sigma',
    code: ['sigma'],
    about: 'The encoder predicts its log variance, since a network output can be any number but a spread must be positive: sigma = np.exp(0.5 * logvar). The KL penalty pulls it toward 1, so the codes overlap and fill the prior.',
  },
  eps: {
    color: 'slate',
    name: 'ε: noise drawn from a standard normal distribution',
    tex: '\\epsilon',
    code: ['eps'],
    about: 'The reparameterization trick: z = mu + sigma * eps. All the randomness lives in eps, so z is a smooth function of mu and sigma, and gradients flow through both.',
  },
  G: {
    color: 'blue',
    name: 'G: the generator, turning noise into a fake sample',
    code: ['G'],
    about: 'G never sees the real data; it learns only from how D reacts, by backpropagating through D. In the toy it maps one random number to one sample, in DCGAN 100 numbers to a 64 by 64 image.',
  },
  D: {
    color: 'gold',
    name: 'D: the discriminator, giving the probability a sample is real',
    code: ['D'],
    about: 'An ordinary binary classifier, trained with real samples labeled 1 and fakes 0. If G matches the data exactly, the best D can do is one half everywhere.',
  },
  L: {
    color: 'red',
    name: 'L: the loss',
    code: ['loss', 'loss_D', 'loss_G'],
    about: 'For an autoencoder, the squared reconstruction error; for a VAE, reconstruction plus the KL penalty. A GAN has two, loss_D and loss_G, and since the networks chase each other, neither says much about quality.',
  },
};
