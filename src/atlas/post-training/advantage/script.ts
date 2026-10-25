import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-advantage',
  title: 'Baselines and advantages',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'allup',
      title: 'Every reward pushes up',
      codeTitle: 'baseline.py',
      code: `
        R = np.array([0.9, 0.6, 0.5, 0.2])     #@R
        pg = R[i] * grad_logp(ans[i])          #@pg
        # every R > 0: every answer pushed up  #@up
      `,
      beats: [
        { id: 'rewards', say: 'A grader scores four answers a model sampled for one question, from zero to one: {0.9|zero point nine}, {0.6|zero point six}, {0.5|zero point five} and {0.2|zero point two}.', code: 'R' },
        { id: 'allup', say: 'Every reward is positive, so the policy gradient pushes every one of these answers up, even the worst. Only the size of the push differs.', code: ['pg', 'up'] },
        { id: 'noise', say: 'On average the good answers still win, but each estimate is noisy: whatever happens to be sampled gets pushed up.', code: 'up' },
      ],
    },
    {
      id: 'baseline',
      title: 'Subtract what you expected',
      codeTitle: 'baseline.py',
      code: `
        baseline = R.mean()      # 0.55        #@b
        A = R - baseline                       #@A
        # [0.35, 0.05, -0.05, -0.35]           #@A
        pg = A[i] * grad_logp(ans[i])          #@pg
      `,
      beats: [
        { id: 'b', say: 'So subtract a baseline, b: the reward you expected. Here, the average of the four, {0.55|zero point five five}.', code: 'b' },
        { id: 'A', say: 'What is left is the advantage, A, equal to R minus b: {0.35|zero point three five}, {0.05|zero point zero five}, minus {0.05|zero point zero five} and minus {0.35|zero point three five}.', code: 'A' },
        { id: 'signs', say: 'Use A in place of R. Now the answers that beat expectations are pushed up, and the rest are pushed down.', code: 'pg' },
        { id: 'third', say: 'Look at the third answer. Its reward, {0.5|zero point five}, is positive, but below what was expected, so now it gets pushed down.', code: 'A' },
      ],
    },
    {
      id: 'same',
      title: 'Same direction, less noise',
      codeTitle: 'baseline.py',
      code: `
        # sum_y pi(y) * grad log pi(y)          #@sum
        #   = grad of sum_y pi(y) = grad 1 = 0  #@one
        # so baseline * grad log pi averages 0  #@zero
      `,
      beats: [
        { id: 'sum', say: 'Why is this allowed? Average the gradient of log {π|pi} over the model\'s answers. {π|pi} times the gradient of its log is just the gradient of {π|pi}.', code: 'sum' },
        { id: 'one', say: 'And the probabilities always add up to one, so their gradients add up to zero: they cannot all rise at once.', code: 'one' },
        { id: 'zero', say: 'So the baseline\'s share of the estimate, b times the gradient of log {π|pi}, averages to zero. The expected direction stays the same; only the noise drops.', code: 'zero' },
        { id: 'best', say: 'The best baseline is the reward you expect for that very question: a running average of past rewards works, or a second model trained to predict it.' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
