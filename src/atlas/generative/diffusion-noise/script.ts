import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-diffusion-noise',
  title: 'Adding noise',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Sohl-Dickstein, Weiss, Maheswaranathan & Ganguli', year: 2015, title: 'Deep unsupervised learning using nonequilibrium thermodynamics', url: 'https://arxiv.org/abs/1503.03585', scene: 'path' },
    { who: 'Ho, Jain & Abbeel', year: 2020, title: 'Denoising diffusion probabilistic models', url: 'https://arxiv.org/abs/2006.11239', scene: 'schedule' },
    { who: 'Nichol & Dhariwal', year: 2021, title: 'Improved denoising diffusion probabilistic models', url: 'https://arxiv.org/abs/2102.09672', scene: 'schedule' },
  ],
  scenes: [
    {
      id: 'path',
      title: 'From an image to noise',
      codeTitle: 'path.py',
      code: `
        x0 = img          # the clean image  #@img
        eps = np.random.randn(*x0.shape)     #@eps
        # image -> ... -> pure noise         #@path
      `,
      beats: [
        { id: 'two', say: 'Noise is easy to make: one random number per pixel. An image is harder, because its pixels must work together to make a face.', code: ['img', 'eps'] },
        { id: 'path', say: 'A diffusion model, a way to make images, starts by joining the two with a path that takes an image apart, a little at a time, until only noise is left.', code: 'path' },
        { id: 'ink', say: 'The name is from physics. A drop of ink in water spreads out, or diffuses, until its shape is gone.', code: 'path' },
        { id: 'sohl', say: 'In 2015, {Jascha Sohl-Dickstein|Yasha Sohl-Dickstein} and colleagues proposed doing that to data: destroy its structure slowly, in many small steps of noise.', code: 'path' },
        { id: 'x0', say: 'The clean image is {x₀|x zero}: x at step zero, before any noise. Each pixel is one number.', code: 'img' },
        { id: 'eps', say: 'The noise is {ε|epsilon}: one draw per pixel from a standard normal, the bell curve centered on zero, with a variance of one.', code: 'eps' },
      ],
    },
    {
      id: 'blend',
      title: 'One blend',
      codeTitle: 'blend.py',
      code: `
        ab = 0.64            # alpha bar   #@ab
        xt = (np.sqrt(ab) * x0             #@mix
              + np.sqrt(1 - ab) * eps)     #@mix
        # 0.8 * 1 + 0.6 * (-0.5) = 0.5     #@pixel
      `,
      beats: [
        { id: 'xt', say: 'Every picture on the path blends the two ends. The one at step t is written {xₜ|x t}.', code: 'mix' },
        { id: 'ab', say: 'How much of each goes in is set by one number, {ᾱ|alpha bar}: alpha, with a bar on top. Near one, the image has a light dusting of noise. At a half, the two are equally strong. Near zero, only a faint trace of the image is left.', code: 'ab' },
        { id: 'mix', say: 'The blend scales the image by the square root of {ᾱ|alpha bar}, the noise by the square root of one minus {ᾱ|alpha bar}, and adds them.', code: 'mix' },
        { id: 'roots', say: 'At an {ᾱ|alpha bar} of {0.64|zero point six four}, the image is scaled by {0.8|zero point eight}, and the noise by the root of {0.36|zero point three six}: {0.6|zero point six}.', code: 'ab' },
        { id: 'pixel', say: 'Follow a pixel of one, with noise of minus a half. {0.8|zero point eight} times one, plus {0.6|zero point six} times minus a half, is {0.5|zero point five}.', code: 'pixel' },
      ],
    },
    {
      id: 'variance',
      title: 'Why the square roots',
      codeTitle: 'variance.py',
      code: `
        np.var([1, -1])            # 1.0    #@pair
        np.var([0.8, -0.8])        # 0.64   #@rule
        np.var(np.sqrt(ab) * x0)   # ab     #@img
        np.var(np.sqrt(1-ab)*eps)  # 1 - ab #@noise
        np.var(xt)                 # 1.0    #@sum
        np.var(0.5*x0 + 0.5*eps)   # 0.5    #@without
        # var(x0) = 2: 1.28 + 0.36 = 1.64   #@spread
      `,
      beats: [
        { id: 'keep', say: 'Why the roots? Say the clean pixels have a variance of one, like the noise. The blend keeps it at one, so the pixels stay as spread out, and only what they are made of changes.', code: 'sum' },
        { id: 'pair', say: 'Variance is the average squared distance from the mean. Pixels of one and minus one each sit one away from zero: a variance of one.', code: 'pair' },
        { id: 'rule', say: 'Scale both by {0.8|zero point eight}, and each sits {0.8|zero point eight} away: the variance is {0.64|zero point six four}. Scaling by any number, c, scales the variance by c squared.', code: 'rule' },
        { id: 'parts', say: 'So the image part, scaled by the root of {ᾱ|alpha bar}, has a variance of {ᾱ|alpha bar}, here {0.64|zero point six four}. The noise part has the rest: {0.36|zero point three six}.', code: ['img', 'noise'] },
        { id: 'sum', say: 'The noise is independent of the image, so the variances add: {ᾱ|alpha bar}, plus one minus {ᾱ|alpha bar}, is one. That is what the roots are for.', code: 'sum' },
        { id: 'share', say: 'So {ᾱ|alpha bar} is the share of the variance still image: here, sixty four percent image, and thirty six percent noise.', code: 'img' },
        { id: 'without', say: 'Leave the roots out, and a half and half mix has a variance of a quarter plus a quarter: only a half. The middle of the path would fade toward gray.', code: 'without' },
        { id: 'spread', say: 'That holds only when the image starts at a variance of one. Start it at two, and the image part is {0.64|zero point six four} times two: {1.28|one point two eight}.', code: 'spread' },
        { id: 'total', say: 'The noise part still adds {0.36|zero point three six}, so {xₜ|x t} has a variance of {1.64|one point six four}.', code: 'spread' },
      ],
    },
    {
      id: 'schedule',
      title: 'The noise schedule',
      codeTitle: 'schedule.py',
      code: `
        t = np.arange(1001)          # steps  #@steps
        ab = np.cos(t / 1000 * np.pi / 2)**2  #@sched
        ab[0], ab[500], ab[1000]  # 1, 0.5, 0 #@ends
        # 2020 schedule: ab[500] = 0.08       #@ho
      `,
      beats: [
        { id: 'steps', say: 'A diffusion model splits the path into many steps, say a thousand, and gives every step t its own {ᾱ|alpha bar}.', code: 'steps' },
        { id: 'falls', say: 'At step zero, {ᾱ|alpha bar} is one: the clean image. It falls as t grows, and by the last step it is close to zero: almost pure noise.', code: 'ends' },
        { id: 'sched', say: 'That list of values is the noise schedule: it sets how fast the image fades.', code: 'sched' },
        { id: 'ho', say: 'In 2020, Jonathan Ho, Ajay Jain and Pieter Abbeel used a schedule that fades fast: by step five hundred, under a tenth of the variance is image.', code: 'ho' },
        { id: 'cosine', say: 'In 2021, Alex Nichol and Prafulla Dhariwal found it destroys the image faster than it needs to: the last quarter of the steps is almost pure noise. Their cosine schedule, like this one, keeps about half at step five hundred.', code: ['sched', 'ends'] },
        { id: 'jump', say: 'And since each blend is one formula from {x₀|x zero}, any step can be made directly, without the steps before it.', code: 'ends' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
