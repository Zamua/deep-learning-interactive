import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-lr-decay',
  title: 'Warmup and decay',
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
        { id: 'linear', say: 'Linear decay goes in a straight line instead, from the top rate, {ηₘₐₓ|eta max}, down to the bottom one, {ηₘᵢₙ|eta min}, over T steps: the same drop every step. From {0.1|zero point one} to zero, sampled four times along the way: {0.075|zero point zero seven five}, {0.05|zero point zero five}, {0.025|zero point zero two five}, zero.', code: 'linear' },
      ],
    },
    {
      id: 'try',
      title: 'Try it',
      codeTitle: 'try.py',
      code: `
        lr0, every = 0.1, 5000                  #@p1
        # drops at 5,000 and 10,000: two        #@a1
        lr = 0.1 * 0.1 ** 2      # 0.001        #@a1
        hi, lo, T, t = 0.1, 0.01, 1000, 400     #@p2
        drop = (hi - lo) * t / T  # 0.036       #@a2
        lr = hi - drop            # 0.064       #@a2
      `,
      beats: [
        { id: 'p1', say: 'Try one: the rate starts at {0.1|zero point one} and is multiplied by {0.1|zero point one} every five thousand steps. Counting steps from zero, what is the rate at step ten thousand?', code: 'p1' },
        { id: 'a1', say: 'The drops come at steps five thousand and ten thousand, and step ten thousand is one of them. So two drops have happened: {0.1|zero point one} times {0.1|zero point one}, twice, is {0.001|zero point zero zero one}.', code: 'a1' },
        { id: 'p2', say: 'Now linear decay from {0.1|zero point one} down to {0.01|zero point zero one} over a thousand steps. What is the rate at step four hundred?', code: 'p2' },
        { id: 'a2', say: 'The gap is {0.09|zero point zero nine}. Four hundred of a thousand steps is {0.4|zero point four} of the way, so the rate has dropped {0.4|zero point four} times {0.09|zero point zero nine}: {0.036|zero point zero three six}. And {0.1|zero point one} minus {0.036|zero point zero three six} is {0.064|zero point zero six four}.', code: 'a2' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
