import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-transformer-params',
  title: 'Counting transformer parameters',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Vaswani, Shazeer, Parmar, Uszkoreit, Jones, Gomez, Kaiser & Polosukhin', year: 2017, title: 'Attention Is All You Need', url: 'https://arxiv.org/abs/1706.03762', scene: 'block' },
    { who: 'Kaplan, McCandlish, Henighan, Brown, Chess, Child, Gray, Radford, Wu & Amodei', year: 2020, title: 'Scaling Laws for Neural Language Models', url: 'https://arxiv.org/abs/2001.08361', scene: 'model' },
  ],
  scenes: [
    {
      id: 'block',
      title: 'One block, in squares',
      codeTitle: 'count.py',
      code: `
        d = 1000                 # width      #@d
        Wq = np.zeros((d, d))    # 1 square   #@sq
        # Wq, Wk, Wv, Wo: 4 squares           #@attn
        W1 = np.zeros((4*d, d))  # 4 squares  #@w1
        W2 = np.zeros((d, 4*d))  # 4 squares  #@w2
        b1 = np.zeros(4*d)       # a sliver   #@small
        12 * d * d     # 12,000,000           #@block
      `,
      beats: [
        { id: 'size', say: 'How big is a transformer? Its size is its parameter count: every weight and bias that training learns. For a transformer, that count fits in one short formula, and the formula shows which choice makes a model big.' },
        { id: 'width', say: 'Each token passes through a block as a vector of d numbers, and that length, d, is called the model\'s width. A d by d matrix holds d squared weights. Draw it as a square.', code: ['d', 'sq'] },
        { id: 'attn', say: 'Attention holds four such squares: the query, key and value weights, and {Wo|W O}, which mixes the heads. Counted across all the heads, each one is d by d.', code: 'attn' },
        { id: 'mlp', say: 'The other branch is the MLP, short for multi-layer perceptron: neurons in layers, like the two-layer network from before. Its first matrix, {W₁|W one}, widens each token\'s d numbers into {4d|four d}, and a ReLU bends them.', code: 'w1' },
        { id: 'w2', say: 'Then {W₂|W two} narrows them back down, from {4d|four d} numbers to the token\'s d. Each of the two matrices is four squares, laid end to end.', code: 'w2' },
        { id: 'four', say: 'Why four times? The first transformer, built by Ashish Vaswani and colleagues in 2017, gave each token {512|five hundred twelve} numbers and its MLP {2,048|two thousand and forty eight}, and that ratio became the standard.', code: ['w1', 'w2'] },
        { id: 'small', say: 'The biases and the layer norms add only single rows, of d or {4d|four d} numbers each: slivers beside a square. So the count leaves them out.', code: 'small' },
        { id: 'total', say: 'Count the squares: four in attention, and eight in the MLP. Twelve, so one block holds about {12d²|twelve d squared} weights, two thirds of them in the MLP.', code: 'block' },
        { id: 'num', say: 'With d of a thousand, each square holds a million weights, so one block holds twelve million.', code: 'block' },
      ],
    },
    {
      id: 'model',
      title: 'The whole model',
      codeTitle: 'count.py',
      code: `
        n_blocks = 12                         #@N
        blocks = 12 * n_blocks * d**2  # 144M #@stack
        vocab = 50000                         #@V
        embed = vocab * d     # 50M           #@embed
        blocks + embed        # 194M          #@all
      `,
      beats: [
        { id: 'stack', say: 'A model stacks blocks, one on top of another, each with its own twelve squares. Write N for the number of blocks: together they hold {12Nd²|twelve N d squared}.', code: ['N', 'stack'] },
        { id: 'twelve', say: 'Twelve blocks of width a thousand: twelve times twelve million, which is {144|one hundred forty four} million.', code: 'stack' },
        { id: 'kaplan', say: 'In 2020, Jared Kaplan and colleagues measured language models by this same count, {12Nd²|twelve N d squared}. The bigger the count, the better a model predicted text, and how it was split between width and blocks mattered little.', code: 'stack' },
        { id: 'embed', say: 'Their count left out the embedding table: one row of d numbers for each token in the vocabulary, so V by d. Fifty thousand rows of a thousand make fifty million, as much as fifty squares.', code: ['V', 'embed'] },
        { id: 'all', say: 'So the whole model holds {144|one hundred forty four} million, plus fifty: {194|one hundred ninety four} million.', code: 'all' },
      ],
    },
    {
      id: 'scale',
      title: 'Which knob',
      codeTitle: 'scale.py',
      code: `
        12 * n_blocks * d**2           #@f
        # 2x d: every square 4x        #@wide
        # 2x n_blocks: 2x              #@deep
        # 3x d: 9x                     #@three
      `,
      beats: [
        { id: 'wide', say: 'Now back to the question: which choice makes a model big? Double the width, and every square doubles along both of its sides. Each holds four times as many weights.', code: 'wide' },
        { id: 'deep', say: 'Double the number of blocks instead, and the stack is only twice as tall: twice the weights.', code: 'deep' },
        { id: 'squared', say: 'In the formula, the width is squared and the blocks are not. Triple the width, and the blocks hold three times three: nine times the weights.', code: ['f', 'three'] },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
