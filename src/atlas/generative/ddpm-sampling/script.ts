import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-ddpm-sampling',
  title: 'Sampling by denoising',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'walk',
      title: 'Walk back from noise',
      codeTitle: 'sample.py',
      code: `
        xt = np.random.randn(64, 64)  # step 1000   #@start
        for t in range(1000, 0, -1):  # 1000 ... 1  #@loop
            eps_hat = model(xt, t)    # one call    #@call
            xt = ...                  # step t - 1  #@loop
        # step 0: xt is a new image                 #@done
      `,
      beats: [
        { id: 'start', say: 'To make a new image, run the noising backwards. Start at the last step, a thousand, where an image is pure noise: just draw {x_t|x t} from a standard normal.', code: 'start' },
        { id: 'loop', say: 'Then walk back one step at a time, down to zero, removing a little noise each time.', code: ['loop', 'done'] },
        { id: 'call', say: 'Each step asks the network once for its noise guess. A thousand steps, a thousand network calls.', code: 'call' },
      ],
    },
    {
      id: 'step',
      title: 'One step back',
      codeTitle: 'step.py',
      code: `
        ab, xt, eps_hat = 0.64, 0.5, -0.5          #@guess
        noise = np.sqrt(1 - ab) * eps_hat  # -0.3  #@est
        x0_hat = (xt - noise) / np.sqrt(ab) # 1.0  #@est
        ab_prev, s2 = 0.81, 0.03                   #@level
        img = np.sqrt(ab_prev) * x0_hat    # 0.9   #@img
        keep = np.sqrt(1 - ab_prev - s2)   # 0.4   #@split
        mean = img + keep * eps_hat        # 0.7   #@mean
        z = np.random.randn()              # 1.0   #@fresh
        xt = mean + np.sqrt(s2) * z        # 0.87  #@fresh
      `,
      beats: [
        { id: 'guess', say: 'Here is one step, from t down to t minus one. Say {ᾱₜ|alpha bar t}, the {ᾱ|alpha bar} of step t, is {0.64|zero point six four}, a pixel reads {0.5|zero point five}, and the network guesses its noise is minus a half.', code: 'guess' },
        { id: 'est', say: 'First, estimate the clean image, as before: take away {0.6|zero point six} times the guess, and divide by {0.8|zero point eight}. {x̂₀|x zero hat} is one.', code: 'est' },
        { id: 'level', say: 'Then build the image at step t minus one. Like any noised image, it must be a blend: the root of {ᾱₜ₋₁|alpha bar t minus one} times an image, plus the root of one minus {ᾱₜ₋₁|alpha bar t minus one} times noise. Here {ᾱₜ₋₁|alpha bar t minus one} is {0.81|zero point eight one}: {0.81|zero point eight one} of the variance is image, and {0.19|zero point one nine} is noise.', code: 'level' },
        { id: 'img', say: 'For the image, use the estimate {x̂₀|x zero hat}, scaled by the root of {0.81|zero point eight one}: {0.9|zero point nine}.', code: 'img' },
        { id: 'fill', say: 'For the noise, reuse the guess: it is the noise this pixel holds, so keeping it carries the same noise down a level, only less of it. But the guess fills only part of the noise share. The rest goes to fresh noise z, scaled by {σ|sigma}, here a plain number, not the sigmoid.', code: ['mean', 'fresh'] },
        { id: 'split', say: 'Of the {0.19|zero point one nine}, set {σ²|sigma squared} aside for the fresh noise, here {0.03|zero point zero three}. The other {0.16|zero point one six} goes to the guess, scaled by its root, {0.4|zero point four}.', code: 'split' },
        { id: 'mean', say: 'So the step\'s mean is {0.9|zero point nine} times one, plus {0.4|zero point four} times minus a half: {0.7|zero point seven}.', code: 'mean' },
        { id: 'fresh', say: 'Last, add {σ|sigma} times z, a fresh draw from a standard normal. With z equal to one, {xₜ₋₁|x t minus one} is {0.7|zero point seven} plus {0.17|zero point one seven}: {0.87|zero point eight seven}.', code: 'fresh' },
      ],
    },
    {
      id: 'end',
      title: 'Fresh noise, and the last step',
      codeTitle: 'steps.py',
      code: `
        xt = mean + np.sqrt(s2) * z  # one draw  #@why
        # t = 1: ab_prev = 1, so s2 = 0          #@last
        # and xt = x0_hat                        #@last
        # 1000 steps: 1000 calls, 999 draws      #@count
        for t in range(1000, 0, -20): ...        #@skip
        # 1000, 980, ..., 20: 50 calls           #@skip
      `,
      beats: [
        { id: 'why', say: 'Why add noise while taking it away? The mean is only the center of where the step could land. Fresh noise picks one point around it, and refills the noise share that step t minus one should have.', code: 'why' },
        { id: 'last', say: 'On the last step, down to zero, {ᾱ|alpha bar} is one: no noise share is left. Nothing of the guess is kept, nothing fresh is added, and the image is the estimate {x̂₀|x zero hat} itself.', code: 'last' },
        { id: 'count', say: 'So a thousand steps take a thousand network calls, but only nine hundred and ninety nine fresh draws.', code: 'count' },
        { id: 'skip', say: 'And since the blend can land on any level, a sampler can also skip: a thousand, nine eighty, nine sixty, and so on. Fifty calls instead of a thousand.', code: 'skip' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
