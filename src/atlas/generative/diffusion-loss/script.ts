import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-diffusion-loss',
  title: 'Learning to denoise',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Ho, Jain & Abbeel', year: 2020, title: 'Denoising diffusion probabilistic models', url: 'https://arxiv.org/abs/2006.11239', scene: 'loss' },
  ],
  scenes: [
    {
      id: 'task',
      title: 'Find the noise',
      codeTitle: 'denoise.py',
      code: `
        xt = (np.sqrt(ab) * x0          #@mix
              + np.sqrt(1 - ab) * eps)  #@mix
        # hidden from it: x0 and eps    #@hide
        eps_hat = model(xt, t)          #@ask
        # eps_hat: same shape as xt     #@ask
      `,
      beats: [
        { id: 'easy', say: 'Turning an image into noise is easy: one blend, and no learning needed.', code: 'mix' },
        { id: 'hard', say: 'The other way is hard. Handed only the noisy picture, which part of it is static?', code: 'mix' },
        { id: 'job', say: 'That is what a diffusion model\'s network learns: to find the noise in a noised image. Taking noise out is called denoising.', code: 'ask' },
        { id: 'sees', say: 'It is shown only the noised image, {xₜ|x t}, and the step t, which says how much noise to look for: never {x₀|x zero} or {ε|epsilon} alone.', code: ['ask', 'hide'] },
        { id: 'asks', say: 'Out comes its guess of the noise, the same shape as the image, written {ε̂|epsilon hat}: a hat marks an estimate.', code: 'ask' },
        { id: 'learn', say: 'To do that, it must learn what images look like: whatever does not look like part of one is noise.', code: 'ask' },
      ],
    },
    {
      id: 'loss',
      title: 'Score the guess',
      codeTitle: 'loss.py',
      code: `
        eps = np.array([0.5, -1, 2])          #@eps
        eps_hat = np.array([0.3, -0.6, 1.5])  #@hat
        miss = eps - eps_hat  # 0.2 -0.4 0.5  #@miss
        np.mean(miss)    # 0.1: they cancel   #@cancel
        miss ** 2        # 0.04 0.16 0.25     #@sq
        loss = np.mean(miss ** 2)  # 0.15     #@mean
      `,
      beats: [
        { id: 'loss', say: 'Training needs one number for how wrong a guess is: the loss, the f that gradient descent pushes down.', code: ['eps', 'hat'] },
        { id: 'free', say: 'Here the right answer is known, since the noise was drawn on purpose: the target is {ε|epsilon} itself.', code: 'eps' },
        { id: 'three', say: 'Take three pixels: the noise that went in, and the guess, side by side.', code: ['eps', 'hat'] },
        { id: 'miss', say: 'At the first pixel, the noise was {0.5|zero point five} and the guess {0.3|zero point three}: a miss of {0.2|zero point two}.', code: 'miss' },
        { id: 'others', say: 'The second misses by minus {0.4|zero point four}, and the third by {0.5|zero point five}.', code: 'miss' },
        { id: 'cancel', say: 'Averaging the misses as they are lets them cancel: a miss up and a miss down add to nothing.', code: 'cancel' },
        { id: 'square', say: 'So square each one. A square is never negative, and a miss twice as big costs four times as much.', code: 'sq' },
        { id: 'squares', say: '{0.2|Zero point two} squared is {0.04|zero point zero four}. The other two give {0.16|zero point one six} and {0.25|zero point two five}.', code: 'sq' },
        { id: 'mean', say: 'Together, {0.45|zero point four five}. Over three pixels, that is {0.15|zero point one five}: the loss.', code: 'mean' },
        { id: 'name', say: 'The name reads it backwards: each error, squared, then their mean. The mean squared error.', code: 'mean' },
        { id: 'ho', say: 'In 2020, Jonathan Ho, Ajay Jain and Pieter Abbeel trained this way. Asking for the clean image directly had made worse images.', code: 'mean' },
        { id: 'simple', say: 'Their theory gave each step\'s error its own weight. They dropped the weights, kept this plain squared error, called {L_simple|L simple}, and got better images.', code: 'mean' },
      ],
    },
    {
      id: 'batch',
      title: 'One training step',
      codeTitle: 'train.py',
      code: `
        idx = np.random.randint(0, N, B)    #@pick
        x0 = images[idx]  # B clean images  #@pick
        t = np.random.randint(1, 1001, B)   #@t
        eps = np.random.randn(*x0.shape)    #@t
        ab = alpha_bar[t].reshape(B, 1, 1)  #@t
        xt = (np.sqrt(ab) * x0              #@t
              + np.sqrt(1 - ab) * eps)      #@t
        eps_hat = model(xt, t)              #@guess
        loss = np.mean((eps - eps_hat)**2)  #@loss
      `,
      beats: [
        { id: 'pick', say: 'One step of training takes a random minibatch of B clean images.', code: 'pick' },
        { id: 't', say: 'Each gets its own random step t and fresh noise, so one batch mixes every task: a light dusting here, almost pure static there.', code: 't' },
        { id: 'guess', say: 'The network guesses the noise in every one of them.', code: 'guess' },
        { id: 'step', say: 'The loss averages the squared misses over every pixel of every image, and a gradient step pushes it down.', code: 'loss' },
      ],
    },
    {
      id: 'image',
      title: 'A guess of the image',
      codeTitle: 'x0_hat.py',
      code: `
        ab, xt, eps_hat = 0.64, 0.5, -0.5    #@setup
        left = xt - np.sqrt(1-ab) * eps_hat  #@sub
        # 0.5 - 0.6 * (-0.5) = 0.8           #@sub
        x0_hat = left / np.sqrt(ab)  # 1.0   #@div
      `,
      beats: [
        { id: 'also', say: 'A guess of the noise is also a guess of the image: peel the guessed noise away from {xₜ|x t}, and the image is what is left.', code: ['sub', 'div'] },
        { id: 'undo', say: 'The noise went in scaled by the root of one minus {ᾱ|alpha bar}, so take the guess away scaled the same. Then divide by the root of {ᾱ|alpha bar}, which shrank the image.', code: ['sub', 'div'] },
        { id: 'hat', say: 'The result is written {x̂₀|x zero hat}: an estimate of the clean image.', code: 'div' },
        { id: 'worse', say: 'The better the noise guess, the cleaner the estimate. A poor guess leaves static behind.', code: 'div' },
        { id: 'pixel', say: 'Follow one pixel: {0.5|zero point five}, at an {ᾱ|alpha bar} of {0.64|zero point six four}, with a noise guess of minus a half.', code: 'setup' },
        { id: 'scaled', say: 'Scaled by {0.6|zero point six}, the guess is minus {0.3|zero point three}.', code: 'sub' },
        { id: 'sub', say: 'Taking away minus {0.3|zero point three} adds it: {0.5|zero point five} plus {0.3|zero point three} is {0.8|zero point eight}.', code: 'sub' },
        { id: 'div', say: 'Divide by {0.8|zero point eight}, the root of {0.64|zero point six four}: the estimate of the clean pixel is one.', code: 'div' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
