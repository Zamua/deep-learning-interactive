import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-lr-schedule',
  title: 'Learning rate schedules',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'warmup',
      title: 'Warmup',
      codeTitle: 'warmup.py',
      code: `
        peak, k = 0.1, 1000                 #@peak
        lr = peak * min(1, t / k)           #@ramp
        # t = 250:  0.1 * 0.25 = 0.025      #@ex
      `,
      beats: [
        { id: 'why', say: 'The learning rate does not have to stay fixed. Big steps make fast progress early on, and small steps settle in at the end.' },
        { id: 'ramp', say: 'Many runs begin with a warmup: the rate climbs in a straight line from zero to its peak, written {ηₘₐₓ|eta max}, over the first k steps. So at step t it is the peak times t over k.', code: ['peak', 'ramp'] },
        { id: 'ex', say: 'With a peak of {0.1|zero point one} over a thousand steps, step two hundred and fifty runs at a quarter of the peak: {0.025|zero point zero two five}.', code: 'ex' },
        { id: 'reason', say: 'Why bother? At the start, far from any minimum, the slopes are steep and the gradients large. The full rate times a large gradient makes a huge step, which can overshoot and blow up, just as too large a rate does. So warmup eases in.', code: 'ramp' },
      ],
    },
    {
      id: 'steps',
      title: 'Step and linear decay',
      codeTitle: 'decay.py',
      code: `
        lr = 0.1 * 0.1 ** (step // 10000)        #@rule
        # step 15,000: 0.01,  25,000: 0.001      #@ex
        lr = hi - (hi - lo) * t / T   # linear   #@linear
        # 0.1, 0.075, 0.05, 0.025, 0             #@linear
      `,
      beats: [
        { id: 'rule', say: 'The classic decay goes in steps: multiply the rate by a factor, often {0.1|zero point one}, every so many steps.', code: 'rule' },
        { id: 'ex', say: 'Start at {0.1|zero point one} and drop every {10,000|ten thousand} steps: step {15,000|fifteen thousand} runs at {0.01|zero point zero one}, and step {25,000|twenty-five thousand} at {0.001|zero point zero zero one}.', code: 'ex' },
        { id: 'linear', say: 'Linear decay goes in a straight line instead, from the top rate down to the bottom one over T steps: the same drop every step. From {0.1|zero point one} to zero, sampled four times along the way: {0.075|zero point zero seven five}, {0.05|zero point zero five}, {0.025|zero point zero two five}, zero.', code: 'linear' },
      ],
    },
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
        { id: 'scale', say: 'Now stretch it across the gap from the top rate, {ηₘₐₓ|eta max}, to the bottom one, {ηₘᵢₙ|eta min}, and add the bottom. The rate at step t, {ηₜ|eta t}, is {ηₘᵢₙ|eta min} plus half the gap, times one plus the cosine.', code: 'scale' },
        { id: 'half', say: 'From {0.1|zero point one} down to zero, half the gap is {0.05|zero point zero five}. Halfway through, the cosine is zero, so the rate is {0.05|zero point zero five} times one: {0.05|zero point zero five}.', code: 'half' },
        { id: 'third', say: 'A third of the way in, the cosine is a half, so the rate is {0.05|zero point zero five} times {1.5|one point five}: {0.075|zero point zero seven five}.', code: 'third' },
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
