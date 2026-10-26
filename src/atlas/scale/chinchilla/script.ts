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
        # 1.2e22 / 1.2e2 = 1e20               #@divide
        # 1e9 * 1e9 = 1e18: a billion squared #@billion
        # 1e20 = 100 * 1e18                   #@billion
        # sqrt: 10 * 1e9, ten billion         #@ex
        n_tokens = 20 * n_params   # 2e11     #@ex
      `,
      beats: [
        { id: 'sub', say: 'Put D equals twenty N into C equals six N D. Six N times twenty N: C is a hundred and twenty N squared.', code: 'sub' },
        { id: 'root', say: 'So N is the square root of C over a hundred and twenty.', code: 'root' },
        { id: 'divide', say: 'For our budget, write a hundred and twenty as {1.2 × 10²|one point two times ten squared}. Divide the leading numbers: {1.2|one point two} over {1.2|one point two} is one. Divide the powers of ten by taking two from twenty two: {10²⁰|ten to the twenty}.', code: 'divide' },
        { id: 'billion', say: 'A billion is {10⁹|ten to the nine}, and a billion times a billion is {10¹⁸|ten to the eighteen}, since the powers add. So write {N²|N squared} in billions squared: {10²⁰|ten to the twenty} is a hundred times {10¹⁸|ten to the eighteen}.', code: 'billion' },
        { id: 'ex', say: 'Take the square root of each part: the root of a hundred is ten, and the root of {10¹⁸|ten to the eighteen} is a billion. So N is ten billion parameters, trained on twenty times that: two hundred billion tokens.', code: 'ex' },
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
      ],
    },
    {
      id: 'try',
      title: 'Two budgets, worked',
      codeTitle: 'try.py',
      code: `
        budget = 4.8e22                         #@p1
        # 4.8 / 1.2 = 4, 1e22 / 1e2 = 1e20      #@d1
        # 4e20 = 400 * 1e18                     #@e1
        # sqrt(400) = 20: 20 billion params     #@r1
        budget = 1.92e23                        #@p2
        # 1.92 / 1.2 = 1.6, 1e23 / 1e2 = 1e21   #@d2
        # 1.6e21 = 1600 * 1e18                  #@e2
        # sqrt(1600) = 40: 40 billion params    #@r2
        # tokens: 20 * 40 = 800 billion         #@r2
      `,
      beats: [
        { id: 'p1', say: 'Try one. The budget is {4.8 × 10²²|four point eight times ten to the twenty two} FLOPs. How many billion parameters should a compute-optimal model have?', code: 'p1' },
        { id: 'd1', say: 'Divide by a hundred and twenty. {4.8|Four point eight} over {1.2|one point two} is four, and twenty two minus two leaves {10²⁰|ten to the twenty}. So {N²|N squared} is {4 × 10²⁰|four times ten to the twenty}.', code: 'd1' },
        { id: 'e1', say: 'In billions squared, {10²⁰|ten to the twenty} is a hundred times {10¹⁸|ten to the eighteen}, so {N²|N squared} is four hundred times {10¹⁸|ten to the eighteen}.', code: 'e1' },
        { id: 'r1', say: 'The root of four hundred is twenty, and the root of {10¹⁸|ten to the eighteen} is a billion: twenty billion parameters.', code: 'r1' },
        { id: 'p2', say: 'Now the budget is {1.92 × 10²³|one point nine two times ten to the twenty three} FLOPs. How many billion tokens should the model see?', code: 'p2' },
        { id: 'd2', say: '{1.92|One point nine two} over {1.2|one point two} is {1.6|one point six}, and twenty three minus two leaves {10²¹|ten to the twenty one}.', code: 'd2' },
        { id: 'e2', say: 'In billions squared, {10²¹|ten to the twenty one} is a thousand times {10¹⁸|ten to the eighteen}, so {N²|N squared} is sixteen hundred times {10¹⁸|ten to the eighteen}.', code: 'e2' },
        { id: 'r2', say: 'The root of sixteen hundred is forty: forty billion parameters. At twenty tokens each, that is eight hundred billion tokens.', code: 'r2' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
