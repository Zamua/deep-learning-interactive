import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-dpo',
  title: 'Direct preference optimization',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'implicit',
      title: 'The model\'s own reward',
      codeTitle: 'dpo.py',
      code: `
        # RL route: fit rm, then sample + KL      #@rl
        lp, lp_ref = -12.0, -15.0  # one answer  #@lp
        r_hat = beta * (lp - lp_ref)  # 0.1 * 3   #@imp
      `,
      beats: [
        { id: 'rl', say: 'The usual route has two stages: fit a reward model to preference pairs, then sample answers and push their reward up, with a KL penalty to the reference.', code: 'rl' },
        { id: 'skip', say: 'Direct preference optimization skips both. No reward model, and no sampling: it trains on the pairs directly.' },
        { id: 'implicit', say: 'It uses the model\'s own log-ratio to the reference as the reward: {β|beta} times the log of {π|pi} over {π_ref|pi ref}, for a whole answer.', code: 'imp' },
        { id: 'eg', say: 'If the model gives an answer a log-probability of minus twelve, where the reference gave minus fifteen, the log-ratio is three. With {β|beta} at {0.1|zero point one}, the implicit reward is {0.3|zero point three}.', code: ['lp', 'imp'] },
        { id: 'leash', say: 'That reward grows only as the model moves away from the reference, and {β|beta} sets the exchange rate, as in the KL penalty.', code: 'imp' },
      ],
    },
    {
      id: 'loss',
      title: 'A loss on pairs',
      codeTitle: 'dpo.py',
      code: `
        gap_w = lp_w - lp_ref_w   # 3            #@m
        gap_l = lp_l - lp_ref_l   # -1           #@m
        margin = beta * (gap_w - gap_l)  # 0.4   #@m
        loss = -np.log(sigmoid(margin))  # 0.51  #@loss
        # needs: pairs, pi, frozen pi_ref        #@needs
      `,
      beats: [
        { id: 'plug', say: 'Put the implicit rewards of the chosen and the rejected answer into the reward model\'s loss: minus log sigmoid of their difference.', code: ['m', 'loss'] },
        { id: 'm', say: 'Say the chosen answer\'s log-ratio is three, and the rejected one\'s is minus one. The gap is four; times {β|beta}, {0.4|zero point four}.', code: 'm' },
        { id: 'loss', say: '{σ(0.4)|Sigma of zero point four} is about {0.60|zero point six}, and minus its log is about {0.51|zero point five one}.', code: 'loss' },
        { id: 'push', say: 'Lowering the loss raises the chosen answer\'s probability relative to the reference, and lowers the rejected one\'s.', code: 'loss' },
        { id: 'needs', say: 'All it needs is the pairs, the model being trained, and a frozen reference. Every number comes from reading fixed answers, so nothing is sampled.', code: 'needs' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
