import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-diffusion-loss',
  title: 'Learning to denoise',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'task',
      title: 'Find the noise',
      codeTitle: 'denoise.py',
      code: `
        xt = np.sqrt(a) * x0 + np.sqrt(1 - a) * eps #@mix
        eps_hat = model(xt, t)  # same shape as xt   #@ask
      `,
      beats: [
        { id: 'mix', say: 'Noise a clean image to some step t, as before: {x_t|x t} blends {x₀|x zero} with the noise {ε|epsilon}.', code: 'mix' },
        { id: 'sees', say: 'The network sees only {x_t|x t}, and the step t, which tells it how much noise to expect. It never sees {x₀|x zero} or {ε|epsilon} on their own.', code: 'ask' },
        { id: 'asks', say: 'Its job is to guess the noise that was mixed in. The guess is written {ε̂|epsilon hat}: the hat marks an estimate of {ε|epsilon}. It has the same shape as the image.', code: 'ask' },
        { id: 'why', say: 'To pull the noise out of the blend, it has to learn what images look like: whatever does not look like an image must be noise.', code: 'ask' },
      ],
    },
    {
      id: 'loss',
      title: 'The squared error',
      codeTitle: 'loss.py',
      code: `
        eps = np.array([0.5, -1, 2, 0])            #@eps
        eps_hat = np.array([0.3, -0.6, 1.5, 0.2])  #@eps
        loss = np.mean((eps - eps_hat) ** 2)       #@loss
        # (0.04 + 0.16 + 0.25 + 0.04) / 4 = 0.12   #@loss
      `,
      beats: [
        { id: 'compare', say: 'The loss compares the guess with the noise that was really used. Say the noise was {0.5|zero point five}, minus one, two and zero, and the guess {0.3|zero point three}, minus {0.6|zero point six}, {1.5|one point five} and {0.2|zero point two}.', code: 'eps' },
        { id: 'square', say: 'The differences are {0.2|zero point two}, minus {0.4|zero point four}, {0.5|zero point five} and minus {0.2|zero point two}. Square them and average: about {0.12|zero point one two}, the mean squared error.', code: 'loss' },
        { id: 'batch', say: 'Training takes a random minibatch of clean images, gives each one its own random step and fresh noise, and takes a gradient step on the average loss. One batch trains every noise level at once.', code: 'loss' },
      ],
    },
    {
      id: 'image',
      title: 'From the noise to the image',
      codeTitle: 'x0_hat.py',
      code: `
        a, xt, eps_hat = 0.64, 0.5, -0.5          #@setup
        noise = np.sqrt(1 - a) * eps_hat  # -0.3  #@sub
        x0_hat = (xt - noise) / np.sqrt(a)  # 1.0 #@div
      `,
      beats: [
        { id: 'solve', say: 'A guess of the noise is also a guess of the image. Solve the blend for {x₀|x zero}, with the guess in place of the noise: take away the scaled noise, then undo the shrinking. The result is the estimate {x̂₀|x zero hat}.', code: ['sub', 'div'] },
        { id: 'pixel', say: 'Say a pixel reads {0.5|zero point five} at {ᾱ|alpha bar} of {0.64|zero point six four}, and the guess of its noise is minus a half.', code: 'setup' },
        { id: 'sub', say: 'Take away {0.6|zero point six} times minus a half: {0.5|zero point five} plus {0.3|zero point three} is {0.8|zero point eight}.', code: 'sub' },
        { id: 'div', say: 'Divide by {0.8|zero point eight}, the square root of {ᾱ|alpha bar}: the clean pixel was about one. The better the noise guess, the closer this lands to the real image.', code: 'div' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
