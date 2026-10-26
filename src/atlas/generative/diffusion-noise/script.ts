import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-diffusion-noise',
  title: 'Adding noise',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'blend',
      title: 'Blend an image with noise',
      codeTitle: 'noise.py',
      code: `
        x0 = img                          #@img
        eps = np.random.randn(*x0.shape)  #@eps
        a = 0.64          # alpha bar     #@mix
        xt = np.sqrt(a) * x0 + np.sqrt(1 - a) * eps #@mix
        # 0.8 * 1 + 0.6 * (-0.5) = 0.5    #@pixel
      `,
      beats: [
        { id: 'img', say: 'Start from a clean image, written {x₀|x zero}: x with a small zero below, for step zero, before any noise. Each pixel is one number.', code: 'img' },
        { id: 'eps', say: 'Draw noise of the same shape from a standard normal, with mean zero and variance one. It is written {ε|epsilon}, the Greek letter epsilon: one random number per pixel.', code: 'eps' },
        { id: 'mix', say: 'Then blend them into the noised image, {x_t|x t}: the square root of {ᾱ|alpha bar} times {x₀|x zero}, plus the square root of one minus {ᾱ|alpha bar} times {ε|epsilon}. {ᾱ|Alpha bar}, the Greek alpha with a bar on top, is a number between zero and one, and the small t is the step: how far the noising has gone.', code: 'mix' },
        { id: 'pixel', say: 'Take a pixel of one, with noise of minus a half, at {ᾱ|alpha bar} of {0.64|zero point six four}. The roots are {0.8|zero point eight} and {0.6|zero point six}: {0.8|zero point eight} minus {0.3|zero point three} is {0.5|zero point five}.', code: 'pixel' },
      ],
    },
    {
      id: 'variance',
      title: 'Why the square roots',
      codeTitle: 'variance.py',
      code: `
        np.var(x0)                    # 1.0   #@one
        np.var([1, -1])               # 1.0   #@pair
        np.var([0.8, -0.8])           # 0.64  #@rule
        np.var(np.sqrt(a) * x0)       # a     #@scale
        np.var(np.sqrt(1 - a) * eps)  # 1 - a #@scale
        np.var(xt)                    # 1.0   #@sum
        # np.var(x0) = 2: 1.28 + 0.36 = 1.64  #@spread
      `,
      beats: [
        { id: 'one', say: 'Say the clean pixels have a variance of one, like the noise.', code: 'one' },
        { id: 'pair', say: 'Take two pixels, one and minus one. Their mean is zero, and each sits one away from it, so their variance is one.', code: 'pair' },
        { id: 'rule', say: 'Scale both by {0.8|zero point eight}. Each now sits {0.8|zero point eight} away, so the variance is {0.8|zero point eight} squared: {0.64|zero point six four}. Scaling by any number, c, multiplies the variance by c squared.', code: 'rule' },
        { id: 'scale', say: 'The image part is scaled by the square root of {ᾱ|alpha bar}, so its variance is {ᾱ|alpha bar}: here {0.64|zero point six four}. The noise part\'s is one minus {ᾱ|alpha bar}: {0.36|zero point three six}.', code: 'scale' },
        { id: 'sum', say: 'The two are independent, so their variances add: {ᾱ|alpha bar}, plus one minus {ᾱ|alpha bar}, is one. The blend keeps the spread of the pixels the same, and changes only what they are made of.', code: 'sum' },
        { id: 'share', say: 'So {ᾱ|alpha bar} is the share of the variance that is still image. At {0.64|zero point six four}: sixty four percent image, thirty six percent noise.', code: 'scale' },
        { id: 'spread', say: 'That holds when the image starts at variance one. Start it at two, and the image part is {0.64|zero point six four} times two: {1.28|one point two eight}. The noise part still adds {0.36|zero point three six}, so {xₜ|x t} has a variance of {1.64|one point six four}.', code: 'spread' },
      ],
    },
    {
      id: 'schedule',
      title: 'The noise schedule',
      codeTitle: 'schedule.py',
      code: `
        t = np.arange(1001)                    #@steps
        ab = np.cos(t / 1000 * np.pi / 2) ** 2 #@sched
        ab[0], ab[500], ab[1000]  # 1, 0.5, 0  #@ends
      `,
      beats: [
        { id: 'steps', say: 'A diffusion model noises images over many steps, say a thousand, and every step t has its own {ᾱ|alpha bar}.', code: 'steps' },
        { id: 'falls', say: 'At step zero, {ᾱ|alpha bar} is one: the clean image. It falls as t grows, and by the last step it is close to zero: almost pure noise.', code: 'ends' },
        { id: 'sched', say: 'That list of {ᾱ|alpha bar} values is the noise schedule. It sets how fast the image fades. This one keeps half of the variance at step five hundred; a faster one has lost most of it by then.', code: 'sched' },
        { id: 'jump', say: 'And since the blend is a single formula, any step can be made straight from the clean image, without walking through the steps before it.', code: ['sched', 'ends'] },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
