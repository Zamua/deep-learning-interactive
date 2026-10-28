import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-vae',
  title: 'Variational autoencoders',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Kingma & Welling', year: 2013, title: 'Auto-encoding variational Bayes', url: 'https://arxiv.org/abs/1312.6114', scene: 'spread' },
    { who: 'Kullback & Leibler', year: 1951, title: 'On information and sufficiency', url: 'https://doi.org/10.1214/aoms/1177729694', scene: 'pull' },
  ],
  scenes: [
    {
      id: 'gaps',
      title: 'Codes with gaps',
      codeTitle: 'gaps.py',
      code: `
        # each image x: one code z       #@enc
        x_hat = decode(z)  # x, rebuilt  #@dec
        z = 0.1     # no image's code    #@new
        decode(z)   # a smudge           #@new
      `,
      beats: [
        { id: 'codes', say: 'An autoencoder squeezes each image into a short code, z, and its decoder rebuilds the image from it. Picture a code of one number: each image is a point on a line.', code: ['enc', 'dec'] },
        { id: 'new', say: 'Can the decoder make new images? Decode a code that no image produced, between the seven and the zero.', code: 'new' },
        { id: 'smudge', say: 'Out comes a smudge: training only ever showed the decoder the codes of real images, so between them it learned nothing.', code: 'new' },
        { id: 'cloud', say: 'The fix: give each image a range of codes, and train the decoder to rebuild it from anywhere in that range. Wide enough, the ranges cover the gaps.', code: 'dec' },
      ],
    },
    {
      id: 'spread',
      title: 'A bell for each image',
      codeTitle: 'encoder.py',
      code: `
        h = relu(W1 @ x + b1)               #@h
        mu = W_mu @ h + b_mu   # [1, -0.5]  #@mu
        raw = W_s @ h + b_s    # any sign   #@sigma
        sigma = np.exp(raw)    # [0.5, 0.2] #@sigma
      `,
      beats: [
        { id: 'bell', say: 'The range is a bell curve. Draw many random numbers, as for a network\'s first weights, and count how often each value comes up: most near the middle, fewer farther out. That pattern is a distribution.', code: 'h' },
        { id: 'mu', say: 'The encoder places a bell for each image. First, its center: the mean, written {μ|mu}, the Greek letter mu. Here, one.', code: 'mu' },
        { id: 'sigma', say: 'Then its width: the standard deviation, {σ|sigma}, here a half. A spread, not the sigmoid. A width cannot be negative, so e to the x makes it positive.', code: 'sigma' },
        { id: 'four', say: 'A code of two numbers gets two bells, so the encoder outputs four numbers, each with its own row of weights and its own bias.', code: ['mu', 'sigma'] },
        { id: 'name', say: 'Diederik Kingma and Max Welling introduced this in 2013: the variational autoencoder, or {VAE|V A E}. Variational methods, from statistics, replace a distribution too hard to compute with the closest simple one. Here, a bell.', code: ['mu', 'sigma'] },
      ],
    },
    {
      id: 'sample',
      title: 'Draw a code from the bell',
      codeTitle: 'sample.py',
      code: `
        eps = np.random.randn(2)  # [0.4, -1] #@eps
        z = mu + sigma * eps  # [1.2, -0.7]   #@z
        x_hat = decode(z)                     #@dec
        # dz/dmu = 1    dz/dsigma = eps       #@grad
      `,
      beats: [
        { id: 'eps', say: 'To train, draw a code from the bell. Start with noise from the standard normal, mean zero and standard deviation one: {ε|epsilon}, the Greek letter epsilon, here {0.4|zero point four}.', code: 'eps' },
        { id: 'stretch', say: 'Stretch it by the spread: {σ|sigma} times {ε|epsilon}, a half times {0.4|zero point four}, is {0.2|zero point two}.', code: 'z' },
        { id: 'shift', say: 'Then shift it by the mean: one plus {0.2|zero point two}, so z is {1.2|one point two}. The second dimension gives minus {0.7|zero point seven}.', code: 'z' },
        { id: 'fresh', say: 'Each training step draws fresh noise, so a fresh code under the bell, and the decoder must rebuild this same image from every one.', code: 'dec' },
        { id: 'grad', say: 'The randomness sits in {ε|epsilon}, which no weight sets, so backprop passes through z to {μ|mu} and {σ|sigma}: z moves one for one with {μ|mu}, and {ε|epsilon} times as fast as {σ|sigma}.', code: 'grad' },
        { id: 'trick', say: 'Kingma and Welling called this the reparameterization trick: random draw and all, the model trains with ordinary gradient steps.', code: 'z' },
      ],
    },
    {
      id: 'pull',
      title: 'Pull the bells together',
      codeTitle: 'vae_loss.py',
      code: `
        var = sigma ** 2                 #@kl
        kl = 0.5 * (mu**2 + var          #@kl
                    - 1 - np.log(var))   #@kl
        loss = recon + kl.sum()          #@loss
        z = np.random.randn(2)  # new    #@gen
        x_new = decode(z)                #@gen
      `,
      beats: [
        { id: 'cheat', say: 'With only the reconstruction error, the autoencoder\'s squared error, a {VAE|V A E} would cheat: shrink every {σ|sigma} to zero, and the noise is gone. One exact code per image again, gaps and all.', code: 'loss' },
        { id: 'term', say: 'So the loss adds a term per code dimension, comparing its bell with the standard normal: zero when they match, {μ|mu} zero and {σ|sigma} one.', code: ['kl', 'loss'] },
        { id: 'mean', say: 'Set the mean at two, and {μ|mu} squared, halved, makes the term two. That pulls every mean toward zero.', code: 'kl' },
        { id: 'narrow', say: 'Narrow the bell to {σ|sigma} a half, and minus the log of {σ|sigma} squared climbs, since the log of a number below one is negative: about {0.32|zero point three two}.', code: 'kl' },
        { id: 'wide', say: 'Widen it to {σ|sigma} two, and {σ|sigma} squared, the variance, takes over: about {0.81|zero point eight one}. Lowest at exactly one, it pulls every spread toward one.', code: 'kl' },
        { id: 'kl', say: 'This is the {KL|K L} divergence, from Solomon Kullback and Richard Leibler in 1951: a measure of how much one distribution differs from another.', code: 'kl' },
        { id: 'generate', say: 'Pulled toward one bell, the images\' bells overlap and fill the standard normal. So draw any code from it, decode it, and out comes a new image.', code: 'gen' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
