import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-kl-penalty',
  title: 'The KL penalty',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Ziegler et al.', year: 2019, title: 'Fine-Tuning Language Models from Human Preferences', url: 'https://arxiv.org/abs/1909.08593', scene: 'drift' },
    { who: 'Kullback & Leibler', year: 1951, title: 'On Information and Sufficiency', url: 'https://doi.org/10.1214/aoms/1177729694', scene: 'sum' },
  ],
  scenes: [
    {
      id: 'drift',
      title: 'Why hold on',
      codeTitle: 'kl.py',
      code: `
        # train pi on its reward, R      #@R
        # R keeps climbing as pi drifts  #@far
        pi_ref = frozen_copy(pi)         #@ref
        # charge pi for drifting away    #@ref
      `,
      beats: [
        { id: 'climb', say: 'Train a model on a reward, and it moves away from where it started. At first that is the point: its answers get better, and its reward climbs.', code: 'R' },
        { id: 'far', say: 'But a reward is only a score from some checker, and no checker sees everything. Pushed far enough, the model finds answers that score well but have stopped making sense.', code: 'far' },
        { id: 'ziegler', say: 'In 2019, Daniel Ziegler and colleagues tuned a language model on a reward this way. Without a penalty for drifting, they reported, its text turned to gibberish.', code: 'far' },
        { id: 'ref', say: 'So keep a frozen copy of the model as it started, called the reference, {π_ref|pi ref}, and charge the model for drifting from it. That charge is the {KL|K L} penalty: K L for Solomon Kullback and Richard Leibler, whose measure of drift it uses.', code: 'ref' },
      ],
    },
    {
      id: 'ratio',
      title: 'One token at a time',
      codeTitle: 'ratio.py',
      code: `
        p, p_ref = 0.6, 0.3   # sure     #@p
        p / p_ref             # 2        #@p
        np.log(p / p_ref)     # 0.69     #@ln
        -np.log(p_ref)  # surprise 1.20  #@surp
        -np.log(p)      # surprise 0.51  #@surp
        np.log(p) - np.log(p_ref)        #@diff
        np.log(0.37 / 0.5)    # -0.30    #@neg
        np.log(0.5 / 0.1)     # 1.61     #@most
      `,
      beats: [
        { id: 'tokens', say: 'To measure the drift, take one answer the model wrote, {sure thing!|sure thing, with an exclamation mark}, and ask both models how likely each of its three tokens was.' },
        { id: 'sure', say: 'The model now gives sure a probability of {0.6|zero point six}, where the reference gave it {0.3|zero point three}. Twice as likely: on this token, the model has moved.', code: 'p' },
        { id: 'ln', say: 'The penalty takes the log of that ratio: the log of two, about {0.69|zero point six nine}. That is the token\'s log-ratio.', code: 'ln' },
        { id: 'surprise', say: 'Why a log? Minus ln p is surprise. The reference\'s surprise at sure is {1.20|one point two}, and the model\'s is now only {0.51|zero point five one}.', code: 'surp' },
        { id: 'diff', say: 'The gap, {1.20|one point two} minus {0.51|zero point five one}, is {0.69|zero point six nine} again. The log of a ratio is a difference of logs: ln {π|pi}, minus ln {π_ref|pi ref}.', code: 'diff' },
        { id: 'neg', say: 'A token the model now likes less gets a negative log-ratio. The exclamation mark had {0.5|zero point five} under the reference, and now has {0.37|zero point three seven}: about minus {0.3|zero point three}.', code: 'neg' },
        { id: 'most', say: 'Which token costs most? The token thing had {0.1|zero point one} under the reference, and now has {0.5|zero point five}: five times as likely. The log grows with the ratio, so thing\'s {1.61|one point six one} is the largest, though sure has the larger {π|pi}.', code: 'most' },
      ],
    },
    {
      id: 'sum',
      title: 'The penalty',
      codeTitle: 'kl.py',
      code: `
        lr = np.array([0.69, 1.61, -0.3])  #@lr
        kl = lr.sum()     # 2.0          #@sum
        R_kl = R - beta * kl             #@pen
        1 - 0.1 * 2       # 0.8          #@eg
      `,
      beats: [
        { id: 'sum', say: 'Add the log-ratios over the answer: {0.69|zero point six nine}, plus {1.61|one point six one}, minus {0.3|zero point three}, which makes two. That is how far this one answer has drifted.', code: ['lr', 'sum'] },
        { id: 'kl', say: 'Average that sum over many answers the model samples, and you get the {KL|K L} divergence: a divergence, because it measures how far two models\' probabilities have parted.', code: 'sum' },
        { id: 'names', say: 'Kullback and Leibler defined it in 1951, in a paper called On Information and Sufficiency.', code: 'sum' },
        { id: 'never', say: 'One answer\'s sum can come out negative. But on the model\'s own answers, no other model is less surprised, on average, than the model itself. So the divergence is never below zero, and it is zero only when the two agree.', code: 'sum' },
        { id: 'pen', say: 'The model then trains on its reward minus that sum, scaled by a strength written {β|beta}.', code: 'pen' },
        { id: 'eg', say: 'With a reward of one and {β|beta} at {0.1|zero point one}, the penalty is {0.1|zero point one} times two: {0.2|zero point two}. The model trains on {0.8|zero point eight}.', code: 'eg' },
      ],
    },
    {
      id: 'beta',
      title: 'How hard to hold on',
      codeTitle: 'beta.py',
      code: `
        beta = 10      # stays near start  #@big
        beta = 0.001   # chases R          #@small
        beta = 0.1     # better, still sane  #@mid
      `,
      beats: [
        { id: 'big', say: 'Back to the first picture. {β|beta} is the price of drift. A large {β|beta} makes any drift expensive: the model stays close to the reference, and its reward barely rises.', code: 'big' },
        { id: 'small', say: 'A tiny {β|beta} makes drift nearly free. The model chases the reward wherever it leads, even into answers that only fool the checker.', code: 'small' },
        { id: 'mid', say: 'In between, the model improves on the reward while it still writes like itself.', code: 'mid' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
