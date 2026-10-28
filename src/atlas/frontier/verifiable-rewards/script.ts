import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-verifiable-rewards',
  title: 'Verifiable rewards',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Lambert et al.', year: 2024, title: 'Tulu 3: Pushing Frontiers in Open Language Model Post-Training', url: 'https://arxiv.org/abs/2411.15124', scene: 'judge' },
    { who: 'DeepSeek-AI', year: 2025, title: 'DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning', url: 'https://arxiv.org/abs/2501.12948', scene: 'check' },
  ],
  scenes: [
    {
      id: 'judge',
      title: 'Who gives the reward?',
      codeTitle: 'reward.py',
      code: `
        prompt = 'What is 9 × 7?'          #@prompt
        answer = '... I am sure: 54'       #@hack
        # a learned judge: 0.9, fooled     #@judge
        final = answer.split()[-1]  # '54' #@check
        r = 1 if final == '63' else 0      #@check
        # r = 0: only a right answer pays  #@name
      `,
      beats: [
        { id: 'rl', say: 'GRPO, group relative policy optimization, learns from rewards: the model tries answers, and the ones that score well become more likely. Learning by trial and reward is called reinforcement learning, or RL: what pays off is reinforced.' },
        { id: 'prompt', say: 'Give the model a prompt, the text it is asked to answer: {9 × 7|nine times seven}. Every answer it samples needs a reward. Who gives it?', code: 'prompt' },
        { id: 'judge', say: 'One way is a learned judge: a second network, trained to score answers the way people would.', code: 'judge' },
        { id: 'hack', say: 'But that judge is a network too, and it can be wrong. Trained against it long enough, the model finds answers it scores high that are still wrong, like a confident fifty four. That is called reward hacking.', code: ['hack', 'judge'] },
        { id: 'checker', say: 'Here the right answer is known, so a short program can check instead. It reads the final answer and compares it with sixty three: one if they match, zero if not. Fifty four gets zero, however sure it sounds.', code: 'check' },
        { id: 'name', say: 'A reward a program can check like this is called verifiable. In 2024, Nathan Lambert and colleagues, training their {Tülu 3|Tulu three} models, named the method reinforcement learning with verifiable rewards: RLVR.', code: 'name' },
      ],
    },
    {
      id: 'check',
      title: 'Math, code and format',
      codeTitle: 'reward.py',
      code: `
        answers = ['63', '63', '54', '63']  #@ans
        r = [1 if a == '63' else 0          #@check
             for a in answers]              #@check
        # r = [1, 1, 0, 1]                  #@check
        # code: 1 if every test passes      #@code
        # format: <think> steps </think>    #@format
      `,
      beats: [
        { id: 'ans', say: 'Sample four answers to {9 × 7|nine times seven}. They end in sixty three, sixty three, fifty four and sixty three.', code: 'ans' },
        { id: 'check', say: 'The checker gives one, one, zero, one. No person had to read a word.', code: 'check' },
        { id: 'code', say: 'Code is checked the same way: run each program on tests, and reward it only if every test passes.', code: 'code' },
        { id: 'r1', say: 'In January 2025, DeepSeek\'s {R1|R one} paper trained a model called {R1-Zero|R one zero} this way, with GRPO and no learned judge at all: such a judge, it found, may suffer from reward hacking.', code: ['check', 'code'] },
        { id: 'format', say: 'Math answers had to put the final answer in a set place, such as a box, so a rule could find it. A second reward asked for the steps between think tags.', code: 'format' },
      ],
    },
    {
      id: 'group',
      title: 'Into GRPO',
      codeTitle: 'grpo.py',
      code: `
        r = np.array([1, 1, 0, 1])     #@r
        r.mean()    # 3 / 4 = 0.75     #@mean
        0.625 * 8   # 5 of 8 passed    #@back
        r.std()     # ≈ 0.433          #@std
        A = (r - r.mean()) / r.std()   #@A
        # right: 0.25 / 0.433 ≈ 0.58   #@right
        # wrong: -0.75 / 0.433 ≈ -1.73 #@wrong
      `,
      beats: [
        { id: 'mean', say: 'These four rewards make a GRPO group. Their mean, three of four, is {0.75|zero point seven five}: the share that pass, called the pass rate.', code: ['r', 'mean'] },
        { id: 'back', say: 'It runs backwards too: eight answers with a mean reward of {0.625|zero point six two five} means {0.625|zero point six two five} times eight, five, passed.', code: 'back' },
        { id: 'std', say: 'The standard deviation, a typical distance from the mean, is about {0.433|zero point four three three}.', code: 'std' },
        { id: 'right', say: 'Each right answer\'s advantage is one minus {0.75|zero point seven five}, over {0.433|zero point four three three}: about {0.58|zero point five eight}.', code: ['A', 'right'] },
        { id: 'wrong', say: 'The wrong one gets minus {0.75|zero point seven five} over {0.433|zero point four three three}: about minus {1.73|one point seven three}, a big push down.', code: ['A', 'wrong'] },
        { id: 'scale', say: 'The size of the reward does not matter: {Tülu 3|Tulu three} paid ten for a right answer, and GRPO would give these same advantages, since it divides by the spread.', code: 'A' },
      ],
    },
    {
      id: 'edge',
      title: 'Where the signal is',
      codeTitle: 'signal.py',
      code: `
        r = np.ones(4)    # 4 of 4: A = 0  #@all
        r = np.zeros(4)   # 0 of 4: A = 0  #@all
        # train on prompts it solves       #@edge
        #   some of the time               #@edge
        # checked: the final answer only   #@long
      `,
      beats: [
        { id: 'all', say: 'Had all four been right, every reward would equal the mean, and every advantage would be zero. All wrong, the same: that prompt teaches nothing.', code: 'all' },
        { id: 'edge', say: 'So the prompts worth training on sit at the edge of what the model can do: it solves them some of the time.', code: 'edge' },
        { id: 'long', say: 'Only the final answer is checked, never the steps. Yet as {R1-Zero|R one zero} trained, its answers grew longer, to thousands of tokens, and it began going back over its own steps.', code: 'long' },
        { id: 'why', say: 'Nothing rewarded that directly. But whatever made a right final answer more likely was pushed up along with it.', code: 'long' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
