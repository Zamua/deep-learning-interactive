import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-chinchilla',
  title: 'Compute-optimal size',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'solve',
      title: 'Solving for N',
      codeTitle: 'optimal.py',
      code: `
        n_tokens = 20 * n_params   # 70e9: 1.4e12  #@opt
        # budget = 6 * n * 20 * n = 120 * n**2  #@sub
        n_params = np.sqrt(budget / 120)      #@root
        budget = 1.2e22                       #@divide
        # 1.2e22 / 1.2e2 = 1e20               #@divide
        # 1e9 * 1e9 = 1e18: a billion squared #@billion
        # 1e20 = 100 * 1e18                   #@billion
        # sqrt: 10 * 1e9, ten billion         #@ex
        n_tokens = 20 * n_params   # 2e11     #@ex
      `,
      beats: [
        { id: 'opt', say: 'Compute-optimal training reads about twenty tokens per parameter: seventy billion parameters, {1.4|one point four} trillion tokens.', code: 'opt' },
        { id: 'sub', say: 'Put D equals twenty N into C equals six N D. Six N times twenty N: C is a hundred and twenty N squared.', code: 'sub' },
        { id: 'root', say: 'So N is the square root of C over a hundred and twenty.', code: 'root' },
        { id: 'divide', say: 'Take a budget of {1.2 × 10²²|one point two times ten to the twenty two} FLOPs, and write a hundred and twenty as {1.2 × 10²|one point two times ten squared}. The leading numbers: {1.2|one point two} over {1.2|one point two} is one. The powers of ten: twenty two minus two leaves {10²⁰|ten to the twenty}.', code: 'divide' },
        { id: 'billion', say: 'A billion is {10⁹|ten to the nine}, and a billion squared is {10¹⁸|ten to the eighteen}: the powers add. So write {N²|N squared} in billions squared: {10²⁰|ten to the twenty} is a hundred times {10¹⁸|ten to the eighteen}.', code: 'billion' },
        { id: 'ex', say: 'Take the square root of each part: the root of a hundred is ten, and the root of {10¹⁸|ten to the eighteen} is a billion. So N is ten billion parameters, trained on twenty times that: two hundred billion tokens.', code: 'ex' },
        { id: 'grow', say: 'N grows as the square root of C. So four times the budget buys twice the parameters and twice the tokens.' },
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
        { id: 'd1', say: 'Divide by a hundred and twenty: {4.8|four point eight} over {1.2|one point two} is four, and twenty two minus two leaves {10²⁰|ten to the twenty}. So {N²|N squared} is {4 × 10²⁰|four times ten to the twenty}.', code: 'd1' },
        { id: 'e1', say: 'In billions squared, {10²⁰|ten to the twenty} is a hundred times {10¹⁸|ten to the eighteen}, so {N²|N squared} is four hundred times {10¹⁸|ten to the eighteen}.', code: 'e1' },
        { id: 'r1', say: 'The root of four hundred is twenty, and of {10¹⁸|ten to the eighteen}, a billion: twenty billion parameters.', code: 'r1' },
        { id: 'p2', say: 'Now a budget of {1.92 × 10²³|one point nine two times ten to the twenty three} FLOPs. How many billion tokens should the model see?', code: 'p2' },
        { id: 'd2', say: '{1.92|One point nine two} over {1.2|one point two} is {1.6|one point six}, and twenty three minus two leaves {10²¹|ten to the twenty one}.', code: 'd2' },
        { id: 'e2', say: 'In billions squared, {10²¹|ten to the twenty one} is a thousand times {10¹⁸|ten to the eighteen}, so {N²|N squared} is sixteen hundred times {10¹⁸|ten to the eighteen}.', code: 'e2' },
        { id: 'r2', say: 'The root of sixteen hundred is forty: forty billion parameters. At twenty tokens each: eight hundred billion tokens.', code: 'r2' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
