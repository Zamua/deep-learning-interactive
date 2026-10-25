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
        { id: 'ramp', say: 'Many runs begin with a warmup: the rate climbs in a straight line from zero to its peak over the first k steps.', code: ['peak', 'ramp'] },
        { id: 'ex', say: 'With a peak of {0.1|zero point one} over a thousand steps, step two hundred and fifty runs at a quarter of the peak: {0.025|zero point zero two five}.', code: 'ex' },
        { id: 'reason', say: 'Why bother? At the start, far from any minimum, the gradients are at their largest and least steady. A full-size step on them can overshoot and blow up, so warmup eases in.', code: 'ramp' },
      ],
    },
    {
      id: 'steps',
      title: 'Step decay',
      codeTitle: 'step_decay.py',
      code: `
        lr = 0.1 * 0.1 ** (step // 10000)        #@rule
        # step 15,000: 0.01,  25,000: 0.001      #@ex
      `,
      beats: [
        { id: 'rule', say: 'The classic decay goes in steps: multiply the rate by a factor, often {0.1|zero point one}, every so many steps.', code: 'rule' },
        { id: 'ex', say: 'Start at {0.1|zero point one} and drop every {10,000|ten thousand} steps: step {15,000|fifteen thousand} runs at {0.01|zero point zero one}, and step {25,000|twenty-five thousand} at {0.001|zero point zero zero one}.', code: 'ex' },
      ],
    },
    {
      id: 'cosine',
      title: 'Cosine decay',
      codeTitle: 'cosine.py',
      code: `
        lr = lo + 0.5 * (hi - lo) * (1 + np.cos(np.pi * t / T))   #@rule
        # t = T/2:  cos = 0,    lr = 0.05                          #@half
        # t = T/3:  cos = 0.5,  lr = 0.075                         #@third
      `,
      beats: [
        { id: 'cos', say: 'Cosine decay glides down instead, along half a cosine wave, from {η|eta} max to {η|eta} min over T steps.', code: 'rule' },
        { id: 'shape', say: 'It starts flat, falls fastest in the middle, and flattens out again at the end.', code: 'rule' },
        { id: 'half', say: 'Halfway through, the cosine is zero, so the rate sits halfway between. From {0.1|zero point one} down to zero, that is {0.05|zero point zero five}.', code: 'half' },
        { id: 'third', say: 'A third of the way in, the cosine of {π|pi} over three is a half, so the rate is three quarters of the peak: {0.075|zero point zero seven five}.', code: 'third' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
