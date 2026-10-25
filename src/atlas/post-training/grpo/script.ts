import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-grpo',
  title: 'GRPO',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'group',
      title: 'A baseline from the group',
      codeTitle: 'grpo.py',
      code: `
        group = [sample(pi, q) for _ in range(8)]  #@group
        r = np.array([1, 0, 0, 1, 0, 0, 1, 0])     #@r
        r.mean()        # 0.375: the baseline      #@mean
        r.std()         # 0.48                     #@std
        A = (r - r.mean()) / (r.std() + 1e-4)      #@A
        # right: 1.29, wrong: -0.77                #@A
      `,
      beats: [
        { id: 'value', say: 'A good baseline is the reward you expect for this very question. One way to get it is to train a second model to predict it: a value model, a whole second network to train.' },
        { id: 'group', say: 'GRPO does without it. For each question, sample a group of answers, here eight, and check each one: a reward of one if it is right, zero if it is wrong.', code: ['group', 'r'] },
        { id: 'mean', say: 'The group\'s mean reward is the baseline. Three of the eight are right, so it is {0.375|zero point three seven five}.', code: 'mean' },
        { id: 'std', say: 'Then divide by the group\'s standard deviation, how spread out its rewards are: here about {0.48|zero point four eight}. That puts every question\'s advantages on a similar scale.', code: ['std', 'A'] },
        { id: 'adv', say: 'Right answers get {1.29|one point two nine}, and wrong ones minus {0.77|zero point seven seven}.', code: 'A' },
      ],
    },
    {
      id: 'agree',
      title: 'When the group agrees',
      codeTitle: 'grpo.py',
      code: `
        r = [1, 0, 0, 0, 0, 0, 0, 0]   # 1 of 8    #@hard
        r = [1, 1, 1, 1, 1, 1, 1, 0]   # 7 of 8    #@easy
        r = np.ones(8)       # all right           #@all
        r - r.mean()         # all zeros: no push  #@all
        # std = 0, so + 1e-4 keeps 0 / 0 at 0      #@eps
      `,
      beats: [
        { id: 'hard', say: 'A right answer to a hard question, where only one of eight succeeds, earns a big push: {2.65|two point six five}. On an easy one, where seven of eight do, each right answer gets only {0.38|zero point three eight}.', code: ['hard', 'easy'] },
        { id: 'easy', say: 'If every answer in the group is right, each reward equals the mean, and every advantage is zero.', code: 'all' },
        { id: 'none', say: 'Such a group teaches nothing, and the same goes when every answer is wrong. The standard deviation is zero then, so code adds a tiny number to it, and zero divided by that stays zero.', code: 'eps' },
        { id: 'sum', say: 'Within any group, the advantages add up to zero: probability moves from the worse answers to the better ones.' },
        { id: 'cost', say: 'There is no value model to train. The price is sampling several answers for every question.' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
