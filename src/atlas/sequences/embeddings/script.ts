import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-embeddings',
  title: 'Embeddings',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'table',
      title: 'One row per token',
      codeTitle: 'embed.py',
      code: `
        vocab = {'h': 0, 'e': 1, 'l': 2, 'o': 3}   #@vocab
        E = np.array([[ 0.2,  1.0, -0.5],          #@E
                      [-1.0,  0.4,  0.8],          #@E
                      [ 0.5, -1.0,  2.0],          #@E
                      [ 1.5,  0.3, -0.2]])         #@E
        E.shape          # (4, 3): V rows, d columns  #@E
        E[vocab['l']]    # [0.5, -1.0, 2.0]        #@lookup
        E.size           # 12 = V * d              #@count
      `,
      beats: [
        { id: 'ids', say: 'Arithmetic works on numbers, not letters. So every token in the vocabulary gets an id: h is zero, e is one, l is two, and o is three.', code: 'vocab' },
        { id: 'table', say: 'An embedding is a table, E, with one row per token. Each row is a vector of d numbers. Here d is three, so E is four by three.', code: 'E' },
        { id: 'lookup', say: 'To embed the letter l, take its id, two, and read row two of E: {0.5|zero point five}, minus one, two.', code: 'lookup' },
        { id: 'learned', say: 'The rows are free numbers: nothing in them comes from how a token is spelled, so tokens that are used alike can have rows that are alike.', code: 'E' },
        { id: 'count', say: 'The table holds V times d numbers: twelve here. With fifty thousand tokens and d of {768|seven hundred sixty-eight}, that is over {38|thirty-eight} million.', code: 'count' },
      ],
    },
    {
      id: 'onehot',
      title: 'A lookup is a product',
      codeTitle: 'embed.py',
      code: `
        onehot = np.array([0, 0, 1, 0])   # id 2   #@oh
        onehot @ E       # [0.5, -1.0, 2.0]        #@prod
        E[2]             # the same row, no math   #@same
        ids.shape        # (m, n)                  #@batch
        E[ids].shape     # (m, n, d)               #@batch
      `,
      beats: [
        { id: 'onehot', say: 'There is another way to see the lookup. Write id two as a one-hot vector: four entries, all zero except a one in place two.', code: 'oh' },
        { id: 'product', say: 'Multiply it into E. The result is a sum of the rows of E, each weighted by its entry of the one-hot.', code: 'prod' },
        { id: 'picks', say: 'Every row is weighted by zero except row two, weighted by one. So the product is exactly row two.', code: 'prod' },
        { id: 'layer', say: 'So a lookup is a matrix product with a one-hot vector. Reading the row directly gives the same answer and skips every multiplication by zero.', code: 'same' },
        { id: 'batch', say: 'Stack m sequences of n ids into an array of shape m by n, and the lookup gives m by n by d: every id is swapped for its row.', code: 'batch' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
