import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-positions',
  title: 'Positional information',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'blind',
      title: 'Attention ignores order',
      codeTitle: 'order.py',
      code: `
        attend(['dog', 'bites', 'man'])   # [0.7, 1.3, -0.4]   #@one
        attend(['man', 'bites', 'dog'])   # [-0.4, 1.3, 0.7]   #@two
      `,
      beats: [
        { id: 'one', say: 'Self-attention scores every token against every token, and nothing in a score says where a token sits. Take dog bites man, and one number from each output.', code: 'one' },
        { id: 'swap', say: 'Now swap the first and last words: man bites dog. Every token brings the same query, key and value as before.', code: 'two' },
        { id: 'same', say: 'So bites gets exactly the same output, and dog and man keep theirs too: the outputs just trade places with their tokens.', code: ['one', 'two'] },
        { id: 'bag', say: 'To attention, a sentence is a bag of tokens. Two sentences with opposite meanings look the same.' },
      ],
    },
    {
      id: 'add',
      title: 'Add a position vector',
      codeTitle: 'positions.py',
      code: `
        E = np.array([[1, 2], [0, 1], [3, 0]])       # dog, bites, man   #@E
        P = np.array([[0, 1], [2, 0], [1, -1]])      # positions 0, 1, 2  #@P
        E[0] + P[0]     # dog at position 0: [1, 3]                       #@add
        E[0] + P[2]     # dog at position 2: [2, 1]                       #@diff
        P.shape         # (1024, 768): 786,432 numbers                     #@size
      `,
      beats: [
        { id: 'table', say: 'The fix is a second table, P, with one vector per position: row zero for the first token, row one for the second, and so on.', code: 'P' },
        { id: 'sum', say: 'Each token\'s input is its embedding plus the vector for its position. Dog at position zero: one and two, plus zero and one, is one and three.', code: ['E', 'add'] },
        { id: 'differ', say: 'Dog at position two gets one and two, plus one and minus one: two and one. The same word now enters differently in each place, so attention can tell the two sentences apart.', code: 'diff' },
        { id: 'learned', say: 'The position vectors are learned, like the embeddings. Write {Tₘₐₓ|T max} for the most tokens a model takes: P is {Tₘₐₓ|T max} by d. With {1,024|one thousand and twenty four} tokens of {768|seven hundred sixty eight} numbers, that is about {786,000|seven hundred eighty six thousand} learned numbers.', code: 'size' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
