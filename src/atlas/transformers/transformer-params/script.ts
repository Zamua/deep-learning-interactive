import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-transformer-params',
  title: 'Counting transformer parameters',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'block',
      title: 'One block: 12d²',
      codeTitle: 'count.py',
      code: `
        d = 1000
        attn = 4 * d * d       # Wq, Wk, Wv, Wo: (d, d) each    #@attn
        mlp = 2 * 4 * d * d    # W1: (4d, d), W2: (d, 4d)       #@mlp
        block = attn + mlp     # 12 * d * d = 12,000,000         #@block
      `,
      beats: [
        { id: 'attn', say: 'Count the weights in one block. Attention has four matrices, {Wq|W Q}, {Wk|W K}, {Wv|W V} and {Wo|W O}, each d by d once the heads are put together: four d squared.', code: 'attn' },
        { id: 'mlp', say: 'The MLP has two: {W₁|W one}, four d by d, and {W₂|W two}, d by four d. Each is four d squared, so eight d squared.', code: 'mlp' },
        { id: 'small', say: 'The biases and the layer norms\' {γ|gamma} and {β|beta} are only vectors of length d or four d, tiny next to d squared, so they are left out.' },
        { id: 'total', say: 'That makes twelve d squared per block: a third in attention, two thirds in the MLP. With d of a thousand, twelve million.', code: 'block' },
      ],
    },
    {
      id: 'model',
      title: 'The whole model',
      codeTitle: 'count.py',
      code: `
        n_blocks, vocab = 12, 50000
        blocks = n_blocks * 12 * d * d   # 144,000,000      #@stack
        embed = vocab * d                # 50,000,000       #@embed
        blocks + embed                   # 194 million      #@embed
        # 2x d: 4x the blocks; 2x n_blocks: 2x              #@scale
      `,
      beats: [
        { id: 'stack', say: 'Stack N blocks and multiply: twelve N d squared. Twelve blocks of width a thousand hold {144|one hundred forty four} million.', code: 'stack' },
        { id: 'embed', say: 'Then the embedding table, V by d: one row for each token in the vocabulary. Fifty thousand tokens add fifty million, for {194|one hundred ninety four} million in all.', code: 'embed' },
        { id: 'scale', say: 'Width counts twice. Double d, and the blocks hold four times as many weights. Double the number of blocks, and they only double.', code: 'scale' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
