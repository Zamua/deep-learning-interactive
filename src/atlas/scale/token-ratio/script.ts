import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-token-ratio',
  title: 'Tokens per parameter',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'valley',
      title: 'One budget, many sizes',
      codeTitle: 'budget.py',
      code: `
        budget = 1.2e22                    #@budget
        for n_params in [1e9, 1e10, 1e11]:   #@split
            n_tokens = budget / (6 * n_params)  #@split
            # 2e12, 2e11, 2e10 tokens      #@split
        # best: n_tokens = 20 * n_params   #@best
      `,
      beats: [
        { id: 'budget', say: 'Fix a budget of {1.2 × 10²²|one point two times ten to the twenty two} FLOPs. Compute is six N D, so the bigger the model, the fewer tokens it can afford to read.', code: 'budget' },
        { id: 'trade', say: 'A billion parameters can read two trillion tokens. Ten times the parameters read a tenth of the tokens: two hundred billion.', code: 'split' },
        { id: 'sizes', say: 'Train models of many sizes on that same budget, and plot each one\'s final loss against its size.', code: 'split' },
        { id: 'small', say: 'Too small, and the model lacks the room to learn, however many tokens it reads.' },
        { id: 'big', say: 'Too big, and it reads too few tokens to train all those parameters: it is under-trained.' },
        { id: 'best', say: 'The bottom of the valley is the compute-optimal size. Measured across many budgets, it sits at about twenty tokens per parameter.', code: 'best' },
      ],
    },
    {
      id: 'ratio',
      title: 'Tokens per parameter',
      codeTitle: 'ratio.py',
      code: `
        n_tokens / n_params   # compare with 20  #@ratio
        300e9 / 175e9         # 1.7              #@under
        1.4e12 / 70e9         # 20               #@opt
        15e12 / 8e9           # 1875             #@over
      `,
      beats: [
        { id: 'ratio', say: 'To judge a trained model, divide its tokens by its parameters, and compare with twenty.', code: 'ratio' },
        { id: 'under', say: 'A hundred and seventy five billion parameters on three hundred billion tokens is under two per parameter: badly under-trained. A smaller model, on more tokens, would have reached a lower loss for the same compute.', code: 'under' },
        { id: 'opt', say: 'Seventy billion parameters on {1.4|one point four} trillion tokens is twenty per parameter: compute-optimal.', code: 'opt' },
        { id: 'over', say: 'Eight billion on fifteen trillion is nearly two thousand per parameter, far past compute-optimal. That costs extra training, but every forward pass afterwards is cheaper, at two N FLOPs per token.', code: 'over' },
      ],
    },
    {
      id: 'try',
      title: 'Two models, worked',
      codeTitle: 'try.py',
      code: `
        n_params, n_tokens = 8e9, 1.6e12        #@p1
        # 1.6 trillion = 1,600 billion          #@r1
        1600e9 / 8e9    # 200 per parameter     #@r1
        # far above 20: past compute-optimal    #@v1
        n_params = 30e9                         #@p2
        n_tokens = 20 * n_params   # 600e9      #@r2
      `,
      beats: [
        { id: 'p1', say: 'Try one. A model with eight billion parameters was trained on {1.6|one point six} trillion tokens. Next to compute-optimal, how was it trained?', code: 'p1' },
        { id: 'r1', say: '{1.6|One point six} trillion is {1,600|sixteen hundred} billion. Divided by eight billion, that is two hundred tokens per parameter.', code: 'r1' },
        { id: 'v1', say: 'Far more than twenty: it was trained well past compute-optimal.', code: 'v1' },
        { id: 'p2', say: 'Now a model with thirty billion parameters is trained compute-optimally. How many billion tokens should it see?', code: 'p2' },
        { id: 'r2', say: 'Twenty tokens for each parameter: twenty times thirty billion is six hundred billion tokens.', code: 'r2' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
