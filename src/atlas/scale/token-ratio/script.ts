import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-token-ratio',
  title: 'Tokens per parameter',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Hoffmann et al.', year: 2022, title: 'Training Compute-Optimal Large Language Models', url: 'https://arxiv.org/abs/2203.15556', scene: 'budgets' },
    { who: 'Brown et al.', year: 2020, title: 'Language Models are Few-Shot Learners', url: 'https://arxiv.org/abs/2005.14165', scene: 'ratio' },
    { who: 'Meta AI', year: 2024, title: 'Introducing Meta Llama 3: The most capable openly available LLM to date', url: 'https://ai.meta.com/blog/meta-llama-3/', scene: 'ratio' },
  ],
  scenes: [
    {
      id: 'valley',
      title: 'One budget, many sizes',
      codeTitle: 'budget.py',
      code: `
        budget = 1.2e22   # FLOPs            #@budget
        # 6 * n_params * n_tokens = budget   #@cost
        for n_params in [1e9, 1e10, 1e11]:   #@split
            n_tokens = budget / (6*n_params) #@split
            # 2e12, 2e11, 2e10 tokens        #@split
        # best: 1e10 params, 2e11 tokens     #@best
        2e11 / 1e10   # 20 per parameter     #@ratio
      `,
      beats: [
        { id: 'spend', say: 'Say you have a fixed budget of compute to train a model. Spend more of it on a bigger model, and the model reads fewer tokens of text. Spend more on tokens, and the model must be smaller.', code: 'budget' },
        { id: 'cost', say: 'That is because training costs six N D FLOPs, floating point operations: six for every parameter, on every token. With the budget fixed, N times D is fixed too. Double one, and the other halves.', code: 'cost' },
        { id: 'budget', say: 'Take a budget of {1.2 × 10²²|one point two times ten to the twenty two} FLOPs. A billion parameters can then read two trillion tokens.', code: ['budget', 'split'] },
        { id: 'trade', say: 'Ten times the parameters, ten billion, read a tenth of the tokens: two hundred billion.', code: 'split' },
        { id: 'sizes', say: 'Train models of many sizes on that same budget, and plot each one\'s final loss against its size.', code: 'split' },
        { id: 'small', say: 'Too small, and the model lacks the room to learn, however many tokens it reads.' },
        { id: 'big', say: 'Too big, and it reads too few tokens to train all those parameters: it is under-trained.' },
        { id: 'best', say: 'The bottom of the valley is the compute-optimal size: the lowest loss this budget can buy. Here, that is ten billion parameters, on two hundred billion tokens.', code: 'best' },
        { id: 'ratio', say: 'Divide the tokens by the parameters: two hundred billion over ten billion is twenty. The best model read twenty tokens for each of its parameters.', code: 'ratio' },
      ],
    },
    {
      id: 'budgets',
      title: 'Every budget, the same ratio',
      codeTitle: 'budgets.py',
      code: `
        budgets = [1.2e20, 1.2e22, 1.2e24]  #@more
        # best n_params: 1e9, 1e10, 1e11    #@same
        # best n_tokens: 2e10, 2e11, 2e12   #@same
        # each: n_tokens / n_params = 20    #@same
        # Hoffmann et al., 2022:            #@hoff
        #   10B params, 1.23e22 FLOPs,      #@hoff
        #   205.1B tokens: 20.5 per param   #@hoff
      `,
      beats: [
        { id: 'more', say: 'Now do it again with a hundred times less compute, and with a hundred times more. Each budget digs its own valley, with its bottom at its own size.', code: 'more' },
        { id: 'same', say: 'Yet measure each bottom, and the ratio comes out the same. One billion parameters on twenty billion tokens; a hundred billion on two trillion. Twenty tokens per parameter, every time.', code: 'same' },
        { id: 'hoffmann', say: 'Jordan Hoffmann and colleagues at DeepMind measured this in 2022, after training over four hundred models. Their table even lists this budget: ten billion parameters, at about {1.2 × 10²²|one point two times ten to the twenty two} FLOPs, on two hundred and five billion tokens.', code: 'hoff' },
      ],
    },
    {
      id: 'ratio',
      title: 'Judge a model by its ratio',
      codeTitle: 'ratio.py',
      code: `
        n_tokens / n_params  # compare with 20 #@ratio
        300e9 / 175e9    # GPT-3: 1.7          #@under
        1.4e12 / 70e9    # Chinchilla: 20      #@opt
        15e12 / 8e9      # Llama 3: 1875       #@over
      `,
      beats: [
        { id: 'judge', say: 'So to judge any trained model, divide its tokens by its parameters, and compare with twenty.', code: 'ratio' },
        { id: 'gpt3', say: 'In 2020, OpenAI trained {GPT-3|G P T three}. The letters stand for generative pre-trained transformer: a transformer that generates text, trained first on a great deal of it.', code: 'under' },
        { id: 'under', say: 'It had a hundred and seventy five billion parameters, and read three hundred billion tokens: under two per parameter, badly under-trained. A smaller model, on more tokens, would have reached a lower loss for the same compute.', code: 'under' },
        { id: 'opt', say: 'Hoffmann\'s team trained Chinchilla at twenty per parameter: seventy billion parameters, on {1.4|one point four} trillion tokens. It beat {GPT-3|G P T three} with fewer than half its parameters.', code: 'opt' },
        { id: 'over', say: 'In 2024, Meta\'s Llama 3 went the other way: eight billion parameters, on over fifteen trillion tokens. That is nearly two thousand per parameter, far past compute-optimal.', code: 'over' },
        { id: 'why', say: 'The extra training was on purpose. Once trained, a model costs two N FLOPs for every token it reads, so a smaller model is cheaper every time it runs, and the extra tokens kept making it better.', code: 'over' },
      ],
    },
    {
      id: 'try',
      title: 'Two models, worked',
      codeTitle: 'try.py',
      code: `
        n_params, n_tokens = 8e9, 1.6e12        #@p1
        # 1.6 trillion = 1,600 billion          #@r1
        1600e9 / 8e9    # 200 per parameter     #@div
        # far above 20: past compute-optimal    #@v1
        n_params = 30e9                         #@p2
        n_tokens = 20 * n_params   # 600e9      #@r2
        n_params = 600e9 / 20      # 30e9       #@back
      `,
      beats: [
        { id: 'p1', say: 'Try one. A model with eight billion parameters was trained on {1.6|one point six} trillion tokens. Next to compute-optimal, how was it trained?', code: 'p1' },
        { id: 'r1', say: 'First, {1.6|one point six} trillion is {1,600|sixteen hundred} billion.', code: 'r1' },
        { id: 'div', say: 'Divided by eight billion, that is two hundred tokens per parameter.', code: 'div' },
        { id: 'v1', say: 'Far more than twenty: it was trained well past compute-optimal.', code: 'v1' },
        { id: 'p2', say: 'Now a model with thirty billion parameters is trained compute-optimally. How many billion tokens should it see?', code: 'p2' },
        { id: 'r2', say: 'Twenty tokens for each parameter: twenty times thirty billion is six hundred billion tokens.', code: 'r2' },
        { id: 'back', say: 'And backwards: a compute-optimal model that read six hundred billion tokens has a twentieth as many parameters, thirty billion.', code: 'back' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
