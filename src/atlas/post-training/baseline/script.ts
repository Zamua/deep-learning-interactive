import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-baseline',
  title: 'Baselines and advantages',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Sutton', year: 1984, title: 'Temporal credit assignment in reinforcement learning', url: 'http://incompleteideas.net/papers/Sutton-PhD-thesis.pdf', scene: 'allup' },
    { who: 'Williams', year: 1992, title: 'Simple statistical gradient-following algorithms for connectionist reinforcement learning', url: 'https://doi.org/10.1007/BF00992696', scene: 'baseline' },
  ],
  scenes: [
    {
      id: 'allup',
      title: 'Every reward pushes up',
      codeTitle: 'baseline.py',
      code: `
        R = np.array([.9, .6, .5, .2])  #@R
        pg = R[i] * grad_logp(ans[i])   #@pg
        # every R > 0: all pushed up    #@up
        # draw R = .2: pushed up too    #@one
      `,
      beats: [
        { id: 'rewards', say: 'A grader scores four answers a model sampled for one question, from zero to one: {0.9|zero point nine}, {0.6|zero point six}, {0.5|zero point five} and {0.2|zero point two}.', code: 'R' },
        { id: 'allup', say: 'The policy gradient pushes each answer by its reward, and the sign of R alone sets the direction. Every reward here is positive, so every answer is pushed up, even the worst.', code: ['pg', 'up'] },
        { id: 'one', say: 'And a step often sees just one draw. Draw the worst answer, at {0.2|zero point two}, and the step makes it more likely.', code: 'one' },
        { id: 'noise', say: 'The better answers do pull ahead, but only over many draws, because their pushes are bigger. Any single step pushes up whatever happened to be drawn.', code: 'up' },
        { id: 'sutton', say: 'In his {1984|nineteen eighty four} thesis, Richard Sutton called rewards like these unbalanced: nearly all positive, so they give credit to everything. His fix was to compare each reward with the rewards that came before.', code: 'up' },
      ],
    },
    {
      id: 'baseline',
      title: 'Subtract what you expected',
      codeTitle: 'baseline.py',
      code: `
        b = {{b:0.55}}   # the level      #@b
        A = R - b                       #@A
        # A: {{A:.35 .05 -.05 -.35}}    #@A
        pg = A[i] * grad_logp(ans[i])   #@pg
      `,
      beats: [
        { id: 'level', say: 'So draw a level across the bars, called b, and push each answer by how far its reward lands above it: R minus b. With b at zero, nothing changes.', code: ['b', 'pg'] },
        { id: 'raise', say: 'Raise the level, and every push shrinks. As it passes the top of a bar, that answer\'s push flips: now it goes down.', code: ['b', 'A'] },
        { id: 'top', say: 'Above every bar, every answer is pushed down, even the best: the same problem, upside down.', code: 'A' },
        { id: 'mean', say: 'Set it at the average of the four, {0.55|zero point five five}. Now the two better answers go up, and the two worse go down. The average is what a draw scores on the whole: the reward you expected.', code: 'b' },
        { id: 'name', say: 'That level is called the baseline: the line you measure from, like a patient\'s resting heart rate, against which each new reading is judged.', code: 'b' },
        { id: 'adv', say: 'What is left, R minus b, is called the advantage, A: how far an answer came out ahead of what was expected. Positive when it is ahead, negative when it falls behind.', code: 'A' },
        { id: 'third', say: 'Look at the third answer. Its reward, {0.5|zero point five}, is positive, but it falls short of {0.55|zero point five five}, so its advantage is negative, and now it is pushed down.', code: ['A', 'pg'] },
        { id: 'zero', say: 'An answer that scores exactly the baseline has an advantage of zero, and is not pushed at all.', code: 'A' },
        { id: 'williams', say: 'Ronald Williams wrote such a level into his policy gradient rule of {1992|nineteen ninety two}, and named it the reinforcement baseline.', code: 'pg' },
      ],
    },
    {
      id: 'try',
      title: 'Try one',
      codeTitle: 'advantage.py',
      code: `
        R = np.array([1, 0.4, 0.1])        #@p1
        b = R.mean()  # 1.5 / 3 = 0.5      #@a1
        A = R - b     # [0.5, -0.1, -0.4]  #@a1
        dlogp = 2     # answer 1, theta 0  #@p2
        A[1] * dlogp  # -0.1 * 2 = -0.2    #@a2
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
