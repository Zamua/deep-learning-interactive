import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-chinchilla',
  title: 'Compute-optimal size',
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
        { id: 'sizes', say: 'Train models of many sizes on that same budget, and plot each one\'s final loss against its size.', code: 'split' },
        { id: 'small', say: 'Too small, and the model lacks the room to learn, however many tokens it reads.' },
        { id: 'big', say: 'Too big, and it reads too few tokens to train all those parameters: it is under-trained.' },
        { id: 'best', say: 'The bottom of the valley is the compute-optimal size. Measured across many budgets, it sits at about twenty tokens per parameter.', code: 'best' },
      ],
    },
    {
      id: 'solve',
      title: 'Solving for N',
      codeTitle: 'optimal.py',
      code: `
        # n_tokens = 20 * n_params            #@sub
        # budget = 6 * n * 20 * n = 120 * n**2  #@sub
        n_params = np.sqrt(budget / 120)      #@root
        # sqrt(1e20) = 1e10                   #@ex
        n_tokens = 20 * n_params   # 2e11     #@ex
      `,
      beats: [
        { id: 'sub', say: 'Put D equals twenty N into C equals six N D. Six N times twenty N: C is a hundred and twenty N squared.', code: 'sub' },
        { id: 'root', say: 'So N is the square root of C over a hundred and twenty.', code: 'root' },
        { id: 'ex', say: 'For our budget, C over a hundred and twenty is {10²⁰|ten to the twenty}, and its square root is {10¹⁰|ten to the ten}: ten billion parameters, trained on twenty times that, two hundred billion tokens.', code: 'ex' },
        { id: 'grow', say: 'N grows as the square root of C. So four times the budget buys twice the parameters and twice the tokens: they grow together.' },
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
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
