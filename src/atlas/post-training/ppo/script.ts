import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-ppo',
  title: 'PPO\'s clipped objective',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'ratio',
      title: 'Reuse a batch, weigh by a ratio',
      codeTitle: 'ppo.py',
      code: `
        batch = sample(pi_old)    # once: slow  #@batch
        for step in range(4):     # reuse it    #@loop
            rho = pi(tok) / pi_old(tok)         #@rho
            # 0.3 / 0.2 = 1.5                   #@rho
            obj = rho * A                       #@obj
      `,
      beats: [
        { id: 'batch', say: 'Sampling answers is slow, so we would like to make several updates from each batch of samples.', code: ['batch', 'loop'] },
        { id: 'old', say: 'Call the model that sampled the batch {π_old|pi old}. After the first update, the model being trained, {π|pi}, already differs from it.', code: 'batch' },
        { id: 'rho', say: 'So each sampled token is weighed by the ratio of its new probability to its old one, {ρ|rho}. Before any update, it is one.', code: 'rho' },
        { id: 'eg', say: 'If {π_old|pi old} gave a token {0.2|zero point two} and {π|pi} now gives it {0.3|zero point three}, the ratio is {1.5|one point five}.', code: 'rho' },
        { id: 'obj', say: 'The objective is the ratio times the advantage. Raising it makes tokens with a positive advantage more likely, and those with a negative one less likely.', code: 'obj' },
      ],
    },
    {
      id: 'clip',
      title: 'Clip the ratio',
      codeTitle: 'ppo.py',
      code: `
        eps = 0.2                                #@eps
        c = np.clip(rho, 1 - eps, 1 + eps)       #@clip
        obj = np.minimum(rho * A, c * A)         #@min
        # A > 0: flat past 1.2                   #@pos
        # A < 0: flat below 0.8                  #@neg
      `,
      beats: [
        { id: 'trust', say: 'But the samples only tell us about answers near {π_old|pi old}. Push a ratio far from one, and the estimate stops being trustworthy.' },
        { id: 'clip', say: 'So PPO clips the ratio to between one minus {ε|epsilon} and one plus {ε|epsilon}, with {ε|epsilon} often {0.2|zero point two}.', code: ['eps', 'clip'] },
        { id: 'min', say: 'Then it takes the smaller of the clipped and the unclipped term.', code: 'min' },
        { id: 'pos', say: 'With a positive advantage, the objective rises with the ratio until {1.2|one point two}, then goes flat: no reward for pushing further.', code: 'pos' },
        { id: 'neg', say: 'With a negative advantage, it rises as the ratio falls, until {0.8|zero point eight}, and then goes flat.', code: 'neg' },
        { id: 'wrong', say: 'Taking the smaller term means clipping only ever removes a reward. A ratio that moved the wrong way is still pulled back.', code: 'min' },
        { id: 'why', say: 'So one batch can serve several updates, and none of them moves the model far. The KL penalty has a different job: keeping the whole run near the reference.' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
