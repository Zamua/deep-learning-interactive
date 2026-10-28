import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-lr-schedule',
  title: 'Cosine decay',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Loshchilov & Hutter', year: 2016, title: 'SGDR: stochastic gradient descent with warm restarts', url: 'https://arxiv.org/abs/1608.03983', scene: 'fit' },
  ],
  scenes: [
    {
      id: 'shape',
      title: 'Slow, fast, slow',
      codeTitle: 'shapes.py',
      code: `
        hi, lo, T = 0.1, 0.0, 1000          #@lin
        lr = hi - (hi - lo) * t / T         #@lin
        # linear drops: all the same        #@drop
        # cosine drops: small, big, small   #@cdrop
        # top tenth: linear 10%, cos 20%    #@top
      `,
      beats: [
        { id: 'linear', say: 'Linear decay lowers the learning rate in a straight line, from the top rate, {ηₘₐₓ|eta max}, to the bottom one, {ηₘᵢₙ|eta min}, over a run of T steps, one training from start to finish.', code: 'lin' },
        { id: 'ends', say: 'But the two ends want different things. Early on, big steps make fast progress, so stay near the top. At the end, small steps settle in, so linger near the bottom.', code: 'lin' },
        { id: 'cos', say: 'Cosine decay does both. It leaves the top gently, drops fastest through the middle, and eases into the bottom.', code: 'cdrop' },
        { id: 'drops', say: 'Sample both at evenly spaced steps. The straight line drops the same amount every time; the cosine drops a little, then a lot, then a little again.', code: ['drop', 'cdrop'] },
        { id: 'time', say: 'Both pass the middle rate halfway through. But the cosine spends about twice as long near the top, and twice as long near the bottom.', code: 'top' },
      ],
    },
    {
      id: 'circle',
      title: 'Where the curve comes from',
      codeTitle: 'cosine.py',
      code: `
        angle = np.pi * t / T   # 0 to pi   #@angle
        c = np.cos(angle)       # height    #@cos
        # T/3: 0.5, T/2: 0, 3T/4: -0.71     #@vals
      `,
      beats: [
        { id: 'circle', say: 'Where does that shape come from? Take a point on a circle of radius one, at the top, and move it at a steady speed half a turn, to the bottom. Watch its height.', code: 'angle' },
        { id: 'height', say: 'Near the top it moves sideways, so its height barely changes. At the side it moves straight down, and the height falls fastest. Near the bottom it moves sideways again.', code: 'cos' },
        { id: 'cos', say: 'That height is called the cosine of the angle turned, written cos. It starts at one, passes zero at the side, and ends at minus one.', code: 'cos' },
        { id: 'pi', say: 'Measure the angle by the distance travelled around the circle. Half a turn on a circle of radius one is {π|pi}, the Greek letter pi, about {3.14|three point one four}.', code: 'angle' },
        { id: 'tT', say: 'Spread that half turn over the run. At step t of T, the point has gone t over T of the way: an angle of {πt/T|pi t over T}, and a height of {cos(πt/T)|the cosine of pi t over T}.', code: ['angle', 'cos'] },
        { id: 'vals', say: 'A third of the way through, the height is a half. Halfway, zero. Three quarters of the way, about minus {0.71|zero point seven one}.', code: 'vals' },
      ],
    },
    {
      id: 'fit',
      title: 'Fit it to the rates',
      codeTitle: 'cosine.py',
      code: `
        c = np.cos(np.pi * t / T)  # 1 to -1  #@c
        share = (1 + c) / 2        # 1 to 0   #@share
        lr = lo + (hi - lo) * share           #@lr
        # T/2: c = 0,    lr = 0.05            #@half
        # T/3: c = 0.5,  lr = 0.075           #@third
      `,
      beats: [
        { id: 'halve', say: 'The height runs from one down to minus one. Add one and halve it, and it runs from one down to zero instead: how much of the drop is still to come.', code: ['c', 'share'] },
        { id: 'gap', say: 'Multiply that share by the gap between the top and bottom rates, and add the bottom. The rate at step t, {ηₜ|eta t}, is {ηₘᵢₙ|eta min} plus half the gap, times one plus the cosine.', code: 'lr' },
        { id: 'half', say: 'From {0.1|zero point one} down to zero, half the gap is {0.05|zero point zero five}. Halfway through, the cosine is zero, so the rate is just that: {0.05|zero point zero five}.', code: 'half' },
        { id: 'third', say: 'A third of the way in, the cosine is a half, so the rate is {0.05|zero point zero five} times {1.5|one point five}: {0.075|zero point zero seven five}, still above the straight line.', code: 'third' },
        { id: 'history', say: 'Ilya Loshchilov and Frank Hutter proposed this glide in 2016, in a paper on warm restarts: jumping back to the top and gliding down again. Even a single glide, with no restart, often beat the usual step decay.', code: 'lr' },
        { id: 'anneal', say: 'They called it cosine annealing. Annealing is cooling glass or metal slowly.', code: 'lr' },
      ],
    },
    {
      id: 'warm',
      title: 'After a warmup',
      codeTitle: 'schedule.py',
      code: `
        k, T, hi, lo = 1000, 2000, 0.1, 0.01   #@both
        if step < k: lr = hi * step / k        #@both
        else: lr = cosine(step - k, T, hi, lo) #@both
        # step 2500: 1500 / 2000 = 3/4         #@ex
        c = -0.707          # 1 + c = 0.293    #@c
        0.045 * 0.293       # 0.0132           #@gap
        lo + 0.0132         # 0.0232           #@add
      `,
      beats: [
        { id: 'both', say: 'Runs often warm up first: climb to the top over the first k steps, then glide down the cosine over the next T, counting its t from where the warmup ends.', code: 'both' },
        { id: 'ex', say: 'Say a warmup of a thousand steps to {0.1|zero point one}, then a glide to {0.01|zero point zero one} over two thousand. Step two thousand five hundred is fifteen hundred steps into the glide: three quarters of the way.', code: 'ex' },
        { id: 'c', say: 'There the cosine is about minus {0.707|zero point seven zero seven}, so one plus it is {0.293|zero point two nine three}.', code: 'c' },
        { id: 'gap', say: 'Half the gap, {0.045|zero point zero four five}, times {0.293|zero point two nine three}, is about {0.0132|zero point zero one three two}.', code: 'gap' },
        { id: 'add', say: 'Add the bottom, {0.01|zero point zero one}, and the rate is about {0.0232|zero point zero two three two}.', code: 'add' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
