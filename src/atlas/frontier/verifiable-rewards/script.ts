import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-verifiable-rewards',
  title: 'Verifiable rewards',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'check',
      title: 'A program as the judge',
      codeTitle: 'reward.py',
      code: `
        answers = ['63', '63', '54', '63']   # 9 × 7     #@ans
        r = [1 if a == '63' else 0 for a in answers]    #@check
        # r = [1, 1, 0, 1]                               #@check
        # code: r = 1 if every test passes, else 0      #@code
        # plus a small bonus for <think> ... </think>    #@format
      `,
      beats: [
        { id: 'ask', say: 'Ask a model {9 × 7|nine times seven}, and sample four answers: sixty three, sixty three, fifty four, sixty three.', code: 'ans' },
        { id: 'check', say: 'No person has to judge them. A program compares each final answer with the known one: a reward, r, of one if they match and zero if not. One, one, zero, one.', code: 'check' },
        { id: 'code', say: 'Code is checked the same way: run each program on tests, and reward it if every test passes.', code: 'code' },
        { id: 'format', say: 'DeepSeek\'s R1, in 2025, trained like this, plus a small reward for the right format: its steps between think tags, then the answer.', code: 'format' },
        { id: 'judge', say: 'The other way is a learned judge, a second network trained to score answers. The model can learn to please it with answers that are still wrong. A checker cannot be fooled: only a right answer earns one.' },
      ],
    },
    {
      id: 'group',
      title: 'Into GRPO',
      codeTitle: 'grpo.py',
      code: `
        r = np.array([1, 1, 0, 1])                   #@r
        r.mean()    # 0.75: 3 of 4 pass               #@mean
        r.std()     # 0.433                           #@std
        A = (r - r.mean()) / r.std()                  #@A
        # right: 0.25 / 0.433 = 0.58                  #@A
        # wrong: -0.75 / 0.433 = -1.73                #@A
      `,
      beats: [
        { id: 'mean', say: 'These four rewards are a GRPO group. Their mean is three of four, {0.75|zero point seven five}: the share that pass, the pass rate.', code: ['r', 'mean'] },
        { id: 'std', say: 'Their standard deviation is about {0.433|zero point four three three}.', code: 'std' },
        { id: 'right', say: 'Each right answer\'s advantage is one minus {0.75|zero point seven five}, over {0.433|zero point four three three}: {0.58|zero point five eight}.', code: 'A' },
        { id: 'wrong', say: 'The wrong one gets minus {0.75|zero point seven five} over {0.433|zero point four three three}: minus {1.73|one point seven three}, a large push down.', code: 'A' },
      ],
    },
    {
      id: 'edge',
      title: 'Where the signal is',
      codeTitle: 'signal.py',
      code: `
        r = np.ones(4)     # 4 of 4: every A = 0   #@all
        r = np.zeros(4)    # 0 of 4: every A = 0   #@all
        # keep prompts it solves some of the time  #@edge
        # over training: longer, self-checking     #@long
      `,
      beats: [
        { id: 'all', say: 'Had all four been right, every reward would equal the mean, and every advantage would be zero. All wrong, the same. That prompt teaches nothing.', code: 'all' },
        { id: 'edge', say: 'So the prompts worth training on sit at the edge of what the model can do: it solves them some of the time.', code: 'edge' },
        { id: 'long', say: 'Only the final answer is checked, never the steps. Yet over training, the answers grow longer: chains that check their own steps land on the right answer more often, so they get pushed up.', code: 'long' },
      ],
    },
    {
      id: 'try',
      title: 'Try one',
      codeTitle: 'try.py',
      code: `
        answers = ['42', '42', '32', '42', '42']  # 17 + 25  #@p1
        r = np.array([1, 1, 0, 1, 1])   # std 0.4            #@r
        r.mean()             # 4 / 5 = 0.8                    #@mean
        (r[2] - 0.8) / 0.4   # -0.8 / 0.4 = -2.0              #@a1
        0.625 * 8            # mean 0.625 over 8: 5 passed    #@count
      `,
      beats: [
        { id: 'p1', say: 'Try one. Five answers to {17 + 25|seventeen plus twenty five} say forty two, forty two, thirty two, forty two, forty two. The rewards\' standard deviation is {0.4|zero point four}. What is the advantage of answer two, counting from zero?', code: 'p1' },
        { id: 'r', say: 'The checker gives one, one, zero, one, one.', code: 'r' },
        { id: 'mean', say: 'Four of five pass, so the mean is {0.8|zero point eight}.', code: 'mean' },
        { id: 'a1', say: 'Answer two got zero. Zero minus {0.8|zero point eight} is minus {0.8|zero point eight}, and over {0.4|zero point four} that is minus two.', code: 'a1' },
        { id: 'count', say: 'The mean also runs backwards: eight answers with a mean reward of {0.625|zero point six two five} means {0.625|zero point six two five} times eight, five, passed.', code: 'count' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
