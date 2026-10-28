import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-ddpm-sampling',
  title: 'Sampling by denoising',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Ho, Jain & Abbeel', year: 2020, title: 'Denoising diffusion probabilistic models', url: 'https://arxiv.org/abs/2006.11239', scene: 'walk' },
    { who: 'Song, Meng & Ermon', year: 2020, title: 'Denoising diffusion implicit models', url: 'https://arxiv.org/abs/2010.02502', scene: 'end' },
  ],
  scenes: [
    {
      id: 'walk',
      title: 'Walk back from noise',
      codeTitle: 'sample.py',
      code: `
        xt = np.random.randn(64, 64) # noise #@start
        for t in range(1000, 0, -1):         #@loop
            eps_hat = model(xt, t)           #@call
            xt = ...       # one step back   #@loop
        # t = 0: xt is a new image           #@done
      `,
      beats: [
        { id: 'start', say: 'To make a new image, start with what is easy: pure noise, one random draw per pixel, which is where the noising path ends, at step a thousand.', code: 'start' },
        { id: 'back', say: 'Then walk the path backwards: at each step, the network guesses the noise, and a little of it comes out. At step zero, what is left is a new image.', code: ['loop', 'done'] },
        { id: 'sampler', say: 'This loop is a sampler: each run draws, or samples, one new image. Other starting noise gives another image.', code: 'loop' },
        { id: 'call', say: 'Each step asks the network once, for its guess of the noise in {xₜ|x t}. A thousand steps: a thousand network calls.', code: 'call' },
        { id: 'blur', say: 'Why not jump straight to the estimate, {x̂₀|x zero hat}? At step a thousand, the noise hides almost everything, so the estimate is a blur: broad shapes, no details.', code: 'call' },
        { id: 'ho', say: 'In their 2020 paper, Denoising Diffusion Probabilistic Models, or {DDPM|D D P M}, Jonathan Ho, Ajay Jain and Pieter Abbeel watched that estimate along the walk: large features appear first, and details last. So each step moves a little, then looks again.', code: 'loop' },
      ],
    },
    {
      id: 'step',
      title: 'One step back',
      codeTitle: 'step.py',
      code: `
        ab, xt, eps_hat = 0.64, 0.5, -0.5   #@one
        x0_hat = (xt - np.sqrt(1 - ab)      #@est
                  * eps_hat) / np.sqrt(ab)  #@est
        ab_prev = 0.81    # at step t - 1   #@level
        z = np.random.randn()     # 1.0     #@fresh
        s2 = 0.03          # sigma squared  #@split
        mean = (np.sqrt(ab_prev) * x0_hat   #@img
                + np.sqrt(1 - ab_prev - s2) #@root
                * eps_hat)       # 0.7      #@mean
        xt = mean + np.sqrt(s2) * z  # 0.87 #@land
      `,
      beats: [
        { id: 'one', say: 'Now one step, from t down to t minus one, for one pixel. It reads {0.5|zero point five}, and the network guesses its noise is minus a half.', code: 'one' },
        { id: 'est', say: 'First, solve the blend for the clean pixel, as before. At an {ᾱ|alpha bar} of {0.64|zero point six four}, {0.5|zero point five} plus {0.3|zero point three}, over {0.8|zero point eight}, gives an estimate {x̂₀|x zero hat} of one.', code: 'est' },
        { id: 'level', say: 'The new pixel, {xₜ₋₁|x t minus one}, is a blend too, one step back on the path: its {ᾱ|alpha bar} is {0.81|zero point eight one}, so that much of its variance is image, and {0.19|zero point one nine} is noise.', code: 'level' },
        { id: 'img', say: 'Fill the image share with the estimate, {x̂₀|x zero hat}, scaled by the root of {0.81|zero point eight one}: {0.9|zero point nine}.', code: 'img' },
        { id: 'fresh', say: 'Two kinds of noise fill the rest. One is the guess: it is the noise this pixel holds, so keeping part of it carries the same noise down a step. The other is fresh noise, z, a new draw from a standard normal.', code: ['root', 'fresh'] },
        { id: 'split', say: 'The fresh noise gets a slice, {σ²|sigma squared}, so it is scaled by {σ|sigma}: a plain number here, not the sigmoid. With {σ²|sigma squared} at {0.03|zero point zero three}, {σ|sigma} is about {0.17|zero point one seven}.', code: 'split' },
        { id: 'root', say: 'The guess fills the other {0.16|zero point one six}, so it is scaled by the root of that: {0.4|zero point four}.', code: 'root' },
        { id: 'mean', say: 'Image plus kept guess is the center of the step, its mean: {0.9|zero point nine}, plus {0.4|zero point four} times minus a half, is {0.7|zero point seven}.', code: ['img', 'root', 'mean'] },
        { id: 'land', say: 'Last, add {σ|sigma} times z. With z equal to one, the pixel lands at {0.7|zero point seven} plus {0.17|zero point one seven}: {0.87|zero point eight seven}.', code: 'land' },
      ],
    },
    {
      id: 'end',
      title: 'Fresh noise, and skipping',
      codeTitle: 'steps.py',
      code: `
        xt = mean + np.sqrt(s2) * z  # a draw #@why
        # t = 1: ab_prev = 1, so s2 = 0       #@last
        # and xt = x0_hat                     #@last
        # 1000 steps: 1000 calls, 999 draws   #@count
        for t in range(1000, 0, -20): ...     #@skip
        # 1000, 980, ..., 20: 50 calls        #@fifty
      `,
      beats: [
        { id: 'why', say: 'Why add noise while taking it away? The mean is only the center of where the step could land. Fresh noise picks one point around it, refilling the noise share that step t minus one should hold.', code: 'why' },
        { id: 'last', say: 'On the last step, down to step zero, {ᾱ|alpha bar} is one, so no noise share is left. Nothing of the guess is kept, nothing fresh is added, and the new image is the estimate {x̂₀|x zero hat} itself.', code: 'last' },
        { id: 'count', say: 'So a thousand steps take a thousand network calls, but only nine hundred and ninety nine fresh draws.', code: 'count' },
        { id: 'skip', say: 'A thousand calls is slow. Also in 2020, Jiaming Song, Chenlin Meng and Stefano Ermon wrote the step in this three-part form, and saw that, since every level is a blend straight from the image, a step can land many levels down, with the same trained network.', code: 'skip' },
        { id: 'fifty', say: 'Step down by twenty: a thousand, nine eighty, nine sixty, and so on. Fifty calls instead of a thousand.', code: 'fifty' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
