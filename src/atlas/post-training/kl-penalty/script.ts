import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-kl-penalty',
  title: 'The KL penalty',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'drift',
      title: 'Compare with where it started',
      codeTitle: 'kl.py',
      code: `
        pi_ref = frozen_copy(pi)  # the start         #@ref
        p, p_ref = 0.6, 0.3   # one token             #@p
        np.log(p / p_ref)     # ln 2 = 0.69           #@ratio
        np.log(p) - np.log(p_ref)  # -0.51 + 1.20     #@diff
        np.log(0.37) - np.log(0.5) # -0.99 + 0.69     #@neg
        # thing: 0.5 / 0.1 = 5, the largest ratio     #@most
      `,
      beats: [
        { id: 'drift', say: 'Training on a reward moves a model away from where it started. Pushed far enough, it finds answers that score well but have stopped making sense.' },
        { id: 'ref', say: 'So keep a frozen copy of the starting model, the reference, {π_ref|pi ref}, and charge the model for drifting from it.', code: 'ref' },
        { id: 'ratio', say: 'For each token of a sampled answer, compare the probability each model gives it: the log of {π|pi} over {π_ref|pi ref}.', code: ['p', 'ratio'] },
        { id: 'value', say: 'Here the model now gives sure {0.6|zero point six}, where the reference gave {0.3|zero point three}: twice as likely. The log of two is about {0.69|zero point six nine}: the model has moved toward this token.', code: 'ratio' },
        { id: 'diff', say: 'The log of a quotient is a difference of logs, so it is also ln {0.6|zero point six} minus ln {0.3|zero point three}: minus {0.51|zero point five one}, plus {1.20|one point two}, which is {0.69|zero point six nine}. Given the two logs, just subtract.', code: 'diff' },
        { id: 'neg', say: 'A token the model now likes less than the reference did gets a negative log-ratio. The exclamation mark fell from {0.5|zero point five} to {0.37|zero point three seven}: minus {0.99|zero point nine nine}, plus {0.69|zero point six nine}, is minus {0.30|zero point three}.', code: 'neg' },
        { id: 'most', say: 'Which token costs most? thing rose from {0.1|zero point one} to {0.5|zero point five}, five times as likely. ln grows with its input, so the largest ratio has the largest log: {1.61|one point six one}, more than sure\'s, though sure has the larger {π|pi}.', code: 'most' },
      ],
    },
    {
      id: 'sum',
      title: 'The penalized reward',
      codeTitle: 'kl.py',
      code: `
        lp     = np.array([-0.51, -0.69, -0.99])  # ln pi      #@tok
        lp_ref = np.array([-1.20, -2.30, -0.69])  # ln pi_ref  #@tok
        lr = lp - lp_ref    # [0.69, 1.61, -0.30]              #@lr
        kl = lr.sum()       # 2.0                              #@sum
        R_kl = R - beta * kl     # 1 - 0.2                     #@pen
      `,
      beats: [
        { id: 'logs', say: 'Often the two models hand back log-probabilities. Then each token\'s log-ratio is ln {π|pi} minus ln {π_ref|pi ref}. For sure, those are minus {0.51|zero point five one} and minus {1.20|one point two}, so minus {0.51|zero point five one} plus {1.20|one point two}: {0.69|zero point six nine}.', code: ['tok', 'lr'] },
        { id: 'sum', say: 'Add the log-ratios over the answer\'s tokens: {0.69|zero point six nine}, plus {1.61|one point six one}, minus {0.30|zero point three}: two. Averaged over many sampled answers, that sum is the KL divergence: zero when the two models agree, and larger the further they part.', code: 'sum' },
        { id: 'never', say: 'One answer\'s sum can come out negative, but the average over the model\'s own samples never does.', code: 'sum' },
        { id: 'pen', say: 'The model trains on its reward minus that sum, scaled by a strength written with the Greek letter {β|beta}. The sum runs over the answer\'s tokens, {yₜ|y t}, one for each position t.', code: 'pen' },
        { id: 'eg', say: 'With a reward of one and {β|beta} at {0.1|zero point one}, the penalty is {0.2|zero point two}, and the model trains on {0.8|zero point eight}.', code: 'pen' },
      ],
    },
    {
      id: 'beta',
      title: 'How hard to hold on',
      codeTitle: 'kl.py',
      code: `
        beta = 10       # stays near the start  #@big
        beta = 0.001    # chases the reward     #@small
        beta = 0.1      # improves, stays sane  #@mid
      `,
      beats: [
        { id: 'big', say: 'A large {β|beta} makes any drift expensive. The model stays close to the reference, and its reward barely rises.', code: 'big' },
        { id: 'small', say: 'A tiny {β|beta} makes drift nearly free. The model chases the reward wherever it leads, even into answers that only fool the reward.', code: 'small' },
        { id: 'mid', say: 'In between, the model improves on the reward while it still writes like itself.', code: 'mid' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
