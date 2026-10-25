import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-vae',
  title: 'Variational autoencoders',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'spread',
      title: 'A mean and a spread',
      codeTitle: 'encoder.py',
      code: `
        h = encode(x)                       #@plain
        mu = W_mu @ h       # [1.0, -0.5]   #@two
        sigma = np.exp(W_s @ h)  # [0.5, 0.2] #@two
      `,
      beats: [
        { id: 'plain', say: 'A plain autoencoder maps each input to one code: a single point.', code: 'plain' },
        { id: 'two', say: 'A variational autoencoder, or VAE, gives two numbers for every code dimension instead: a mean, {μ|mu}, and a spread, {σ|sigma}. With a code of two dimensions, the encoder outputs four numbers.', code: 'two' },
        { id: 'bell', say: 'Each pair describes a bell curve. Codes near the mean are likely, and the spread says how far they range: here one, give or take a half, and minus a half, give or take {0.2|zero point two}.', code: 'two' },
      ],
    },
    {
      id: 'sample',
      title: 'Sample a code with noise',
      codeTitle: 'sample.py',
      code: `
        eps = np.random.randn(2)  # [0.4, -1.0] #@eps
        z = mu + sigma * eps      # [1.2, -0.7] #@z
        x_hat = decode(z)                       #@why
        # dz/dmu = 1    dz/dsigma = eps         #@grad
      `,
      beats: [
        { id: 'eps', say: 'In training, the decoder does not get the mean. First draw noise, {ε|epsilon}, from a standard normal, with mean zero and spread one: here {0.4|zero point four} and minus one.', code: 'eps' },
        { id: 'z', say: 'Stretch it by the spread and shift it by the mean: z is {μ|mu} plus {σ|sigma} times {ε|epsilon}. One, plus a half times {0.4|zero point four}, is {1.2|one point two}. Minus a half, plus {0.2|zero point two} times minus one, is minus {0.7|zero point seven}.', code: 'z' },
        { id: 'why', say: 'Every step draws a fresh code near the mean, and the decoder has to rebuild the same input from each one. So a whole neighborhood of codes comes to decode alike.', code: 'why' },
        { id: 'grad', say: 'The randomness sits in {ε|epsilon}, which no weight sets. So backprop still reaches {μ|mu} and {σ|sigma}: z moves one for one with {μ|mu}, and by {ε|epsilon} times any change in {σ|sigma}.', code: 'grad' },
      ],
    },
    {
      id: 'prior',
      title: 'Keep codes near a standard normal',
      codeTitle: 'vae_loss.py',
      code: `
        var = sigma ** 2                      #@term
        kl = 0.5 * (mu**2 + var - 1 - np.log(var)) #@term
        # 0 only at mu = 0, sigma = 1         #@zero
        loss = recon + kl.sum()               #@zero
        z = np.random.randn(2)   # any code   #@gen
        x_new = decode(z)                     #@gen
      `,
      beats: [
        { id: 'drift', say: 'Left alone, training would shrink every spread toward zero, making codes exact again, and scatter the means wherever it liked, with gaps in between.', code: 'term' },
        { id: 'term', say: 'So the loss gets an extra term for each code dimension: one half of {μ|mu} squared, plus {σ|sigma} squared, minus one, minus the log of {σ|sigma} squared.', code: 'term' },
        { id: 'zero', say: 'It is zero only when {μ|mu} is zero and {σ|sigma} is one: a standard normal. Move the mean away, or shrink or widen the spread, and it grows. So it pulls every input\'s bell toward that one.', code: 'zero' },
        { id: 'generate', say: 'With every code crowded into the same region, a fresh draw from a standard normal lands where the decoder knows what to do. Decode it, and out comes a new image.', code: 'gen' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
