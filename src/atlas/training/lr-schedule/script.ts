import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-lr-schedule',
  title: 'Cosine decay',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'cosine',
      title: 'Cosine decay',
      codeTitle: 'cosine.py',
      code: `
        c = np.cos(np.pi * t / T)    # 1 down to -1     #@cos
        # t = T/3: 0.5,  T/2: 0,  3T/4: -0.71          #@vals
        share = (1 + c) / 2          # 1 down to 0      #@halve
        lr = lo + (hi - lo) * share                     #@scale
        # = lo + 0.5 * (hi - lo) * (1 + c)              #@scale
        # t = T/2:  c = 0,    lr = 0.05                 #@half
        # t = T/3:  c = 0.5,  lr = 0.075                #@third
      `,
      beats: [
        { id: 'cos', say: 'Cosine decay glides along a curve called the cosine, written cos. Feed it {π|pi}, a number about {3.14|three point one four}, times t over T. As t runs from zero to T, {cos(πt/T)|the cosine of pi t over T} falls from one to minus one: slowly, then fast, then slowly.', code: 'cos' },
        { id: 'vals', say: 'Along the way, a third of the way through, it is a half. Halfway, it is zero. Three quarters of the way, it is about minus {0.71|zero point seven one}.', code: 'vals' },
        { id: 'halve', say: 'Add one and halve it, and the curve runs from one down to zero instead: a third of the way, {0.75|zero point seven five}; halfway, a half.', code: 'halve' },
        { id: 'scale', say: 'Stretch it across the gap from the top rate, {ηₘₐₓ|eta max}, to the bottom one, {ηₘᵢₙ|eta min}, and add the bottom. The rate at step t, {ηₜ|eta t}, is {ηₘᵢₙ|eta min} plus half the gap, times one plus the cosine.', code: 'scale' },
        { id: 'half', say: 'From {0.1|zero point one} down to zero, half the gap is {0.05|zero point zero five}. Halfway through, the cosine is zero, so the rate is {0.05|zero point zero five} times one: {0.05|zero point zero five}.', code: 'half' },
        { id: 'third', say: 'A third of the way in, the cosine is a half, so the rate is {0.05|zero point zero five} times {1.5|one point five}: {0.075|zero point zero seven five}.', code: 'third' },
      ],
    },
    {
      id: 'both',
      title: 'Warmup, then cosine',
      codeTitle: 'schedule.py',
      code: `
        k, T, hi, lo = 1000, 3000, 0.1, 0.0           #@both
        if step < k: lr = hi * step / k               #@both
        else: lr = cosine(step - k, T, hi, lo)        #@both
        # step 2500:  1500 / 3000 = 1/2,  lr = 0.05   #@ex
      `,
      beats: [
        { id: 'both', say: 'Runs often join the two: warm up over the first k steps, then decay along the cosine over the next T, counting its t from the end of the warmup.', code: 'both' },
        { id: 'ex', say: 'Warm up to {0.1|zero point one} over a thousand steps, then decay to zero over three thousand. Step two thousand five hundred is fifteen hundred steps into the decay: halfway, where the cosine is zero. So the rate is {0.05|zero point zero five}.', code: 'ex' },
      ],
    },
    {
      id: 'try',
      title: 'Try one',
      codeTitle: 'try.py',
      code: `
        hi, lo, T, t = 0.1, 0.01, 1200, 900     #@p1
        c = np.cos(np.pi * 3 / 4)    # -0.707    #@a1
        half = 0.5 * (hi - lo)       # 0.045     #@a2
        lr = lo + half * (1 + c)     # 0.0232    #@a2
      `,
      beats: [
        { id: 'p1', say: 'Try one: cosine decay from {0.1|zero point one} down to {0.01|zero point zero one} over twelve hundred steps. What is the rate at step nine hundred? Use a cosine of about minus {0.707|zero point seven zero seven}.', code: 'p1' },
        { id: 'a1', say: 'Nine hundred over twelve hundred is three quarters of the way. The cosine there is about minus {0.707|zero point seven zero seven}, so one plus it is {0.293|zero point two nine three}.', code: 'a1' },
        { id: 'a2', say: 'Half the gap is half of {0.09|zero point zero nine}: {0.045|zero point zero four five}. Times {0.293|zero point two nine three}, that is about {0.0132|zero point zero one three two}. Add the bottom, {0.01|zero point zero one}: about {0.0232|zero point zero two three two}.', code: 'a2' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
