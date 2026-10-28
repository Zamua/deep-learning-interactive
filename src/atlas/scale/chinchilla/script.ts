import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-chinchilla',
  title: 'Compute-optimal size',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Kaplan et al.', year: 2020, title: 'Scaling Laws for Neural Language Models', url: 'https://arxiv.org/abs/2001.08361', scene: 'trade' },
    { who: 'Hoffmann et al.', year: 2022, title: 'Training Compute-Optimal Large Language Models', url: 'https://arxiv.org/abs/2203.15556', scene: 'trade' },
  ],
  scenes: [
    {
      id: 'trade',
      title: 'One budget, many shapes',
      codeTitle: 'budget.py',
      code: `
        budget = 6 * n_params * n_tokens  #@area
        # same budget: more n_params,     #@trade
        #   fewer n_tokens                #@trade
        n_tokens = 20 * n_params  # best  #@best
        # Gopher: 280e9 x 300e9 tokens    #@gopher
        # Chinchilla: 70e9 x 1.4e12       #@chin
      `,
      beats: [
        { id: 'ask', say: 'A lab has a fixed amount of compute to spend on training. How big should its model be, and how many tokens should it read?', code: 'area' },
        { id: 'area', say: 'Compute is six N D. So draw the parameters, N, across, and the tokens, D, up: the budget is six times the area of the rectangle.', code: 'area' },
        { id: 'trade', say: 'A fixed budget fixes the area, but not the shape. Widen the model, and the tokens it can afford shrink to match.', code: 'trade' },
        { id: 'ends', say: 'Too wide, and the model is under-trained, with too few tokens for all its parameters. Too tall, and it is too small to make use of all it reads.', code: 'trade' },
        { id: 'best', say: 'The lowest loss sits in between, at about twenty tokens per parameter: D equals twenty N.', code: 'best' },
        { id: 'habit', say: 'Labs did not always build this shape. In 2020, Jared Kaplan\'s team had advised putting a bigger budget mostly into a bigger model, trained on a modest amount of data.', code: 'gopher' },
        { id: 'gopher', say: 'Following it, many of the large models that came next were trained on about three hundred billion tokens. DeepMind\'s Gopher had two hundred and eighty billion parameters.', code: 'gopher' },
        { id: 'hoffmann', say: 'In 2022, Jordan Hoffmann and colleagues at DeepMind trained over four hundred models, and found that size and data should grow equally: for every doubling of the model, double the tokens.', code: 'best' },
        { id: 'chin', say: 'To test it, they trained Chinchilla on Gopher\'s budget: seventy billion parameters, on {1.4|one point four} trillion tokens. A quarter of Gopher\'s size, it beat Gopher across a wide range of tasks.', code: 'chin' },
      ],
    },
    {
      id: 'square',
      title: 'The best shape is a square',
      codeTitle: 'optimal.py',
      code: `
        n_tokens = 20 * n_params          #@square
        budget = 6 * n_params * n_tokens  #@sub
        budget = 120 * n_params**2        #@sub
        n_params = np.sqrt(budget / 120)  #@root
        # 4x budget: 2x params, 2x tokens #@grow
        # 30 per param: 180 * n_params**2 #@other
      `,
      beats: [
        { id: 'square', say: 'Look at the axes: each hundred billion parameters across matches two trillion tokens up, twenty per parameter. So the best shape, D equals twenty N, is drawn as a square.', code: 'square' },
        { id: 'sub', say: 'Its compute is six N, times twenty N: a hundred and twenty N squared.', code: 'sub' },
        { id: 'root', say: 'So the square\'s side, N, is the square root of C over a hundred and twenty.', code: 'root' },
        { id: 'four', say: 'Now give the lab four times the budget. Four times the area, kept square, is a block of two squares by two: twice the parameters, and twice the tokens.', code: 'grow' },
        { id: 'nine', say: 'Nine times the budget is three squares by three: three times each. N grows as the square root of C.', code: 'grow' },
        { id: 'shape', say: 'And the shape never changes: twenty tokens per parameter, whatever the budget.', code: 'grow' },
        { id: 'other', say: 'Twenty is what the measurements found. If the best were thirty tokens per parameter instead, the budget would be six times thirty: a hundred and eighty N squared.', code: 'other' },
      ],
    },
    {
      id: 'solve',
      title: 'One budget, worked',
      codeTitle: 'solve.py',
      code: `
        budget = 4.8e22                #@p
        4.8 / 1.2   # 4, as 120 = 1.2e2  #@lead
        1e22 / 1e2  # 1e20: n² = 4e20  #@pow
        1e9 * 1e9   # one tile: 1e18   #@tile
        4e20 / 1e18  # 400 tiles       #@count
        np.sqrt(400)  # 20: 20e9 params  #@side
        n_tokens = 20 * 20e9   # 4e11  #@tok
      `,
      beats: [
        { id: 'p', say: 'Try one. The budget is {4.8 × 10²²|four point eight times ten to the twenty two} FLOPs. How many billion parameters should a compute-optimal model have?', code: 'p' },
        { id: 'lead', say: 'The square\'s area, N squared, is C over a hundred and twenty. Write a hundred and twenty as {1.2 × 10²|one point two times ten squared}, and divide the leading numbers: {4.8|four point eight} over {1.2|one point two} is four.', code: 'lead' },
        { id: 'pow', say: 'Dividing powers of ten subtracts them: twenty two minus two leaves {10²⁰|ten to the twenty}. So N squared is {4 × 10²⁰|four times ten to the twenty}.', code: 'pow' },
        { id: 'tile', say: 'Now cut the square into tiles a billion parameters on a side. A billion is {10⁹|ten to the nine}, so one tile\'s area is {10⁹|ten to the nine} squared: {10¹⁸|ten to the eighteen}.', code: 'tile' },
        { id: 'count', say: '{10²⁰|Ten to the twenty} is a hundred tiles, so {4 × 10²⁰|four times ten to the twenty} is four hundred.', code: 'count' },
        { id: 'side', say: 'Four hundred tiles make a square twenty tiles on a side. So N is twenty billion parameters.', code: 'side' },
        { id: 'tok', say: 'At twenty tokens per parameter, it should read four hundred billion tokens.', code: 'tok' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
