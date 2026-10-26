import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-baseline',
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
      id: 'try',
      title: 'Try one',
      codeTitle: 'advantage.py',
      code: `
        R = np.array([1, 0.4, 0.1])             #@p1
        b = R.mean()       # 1.5 / 3 = 0.5      #@a1
        A = R - b          # [0.5, -0.1, -0.4]  #@a1
        dlogp = 2          # answer 1, theta 0  #@p2
        A[1] * dlogp       # -0.1 * 2 = -0.2    #@a2
      `,
      beats: [
        { id: 'p1', say: 'Try one. Three answers to a question get rewards one, {0.4|zero point four} and {0.1|zero point one}. With their mean as the baseline, what are the advantages?', code: 'p1' },
        { id: 'a1', say: 'The mean is {1.5|one point five} over three: {0.5|zero point five}. Subtract it from each reward: {0.5|zero point five}, minus {0.1|zero point one}, and minus {0.4|zero point four}.', code: 'a1' },
        { id: 'p2', say: 'Now one parameter, {θ₀|theta zero}. The second answer has {∂ln π/∂θ₀|partial ln pi, partial theta zero} of two. What is its estimate\'s entry for {θ₀|theta zero}?', code: 'p2' },
        { id: 'a2', say: 'Use its advantage in place of R: minus {0.1|zero point one}, times two, is minus {0.2|zero point two}. Its reward is positive, but below the baseline, so it is pushed down.', code: 'a2' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
