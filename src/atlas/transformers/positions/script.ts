import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-positions',
  title: 'Positional information',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Vaswani, Shazeer, Parmar, Uszkoreit, Jones, Gomez, Kaiser & Polosukhin', year: 2017, title: 'Attention Is All You Need', url: 'https://arxiv.org/abs/1706.03762', scene: 'add' },
  ],
  scenes: [
    {
      id: 'blind',
      title: 'Attention ignores order',
      codeTitle: 'order.py',
      code: `
        # recurrent: one token per step    #@rnn
        # attention: all at once           #@all
        attend(['dog', 'bites', 'man'])    #@one
        # outputs: [0.7, 1.3, -0.4]        #@one
        attend(['man', 'bites', 'dog'])    #@two
        # outputs: [-0.4, 1.3, 0.7]        #@two
      `,
      beats: [
        { id: 'rnn', say: 'A recurrent network reads a sentence one token per step, so the order comes built in: dog is first because it is read first.', code: 'rnn' },
        { id: 'all', say: 'Self-attention dropped the steps. Every token scores every token at once, and nothing in a score says where a token sits.', code: 'all' },
        { id: 'one', say: 'Take dog bites man, and one number from each token\'s output.', code: 'one' },
        { id: 'swap', say: 'Now swap the first and last words: man bites dog. Every token brings the same query, key and value as before.', code: 'two' },
        { id: 'same', say: 'So bites gets exactly the same output, and dog and man keep theirs too: the outputs just trade places with their tokens.', code: ['one', 'two'] },
        { id: 'bag', say: 'To attention, a sentence is a bag of tokens, like words shaken in a bag: all there, in no order. Two sentences with opposite meanings look the same.', code: ['one', 'two'] },
      ],
    },
    {
      id: 'add',
      title: 'Add a position vector',
      codeTitle: 'positions.py',
      code: `
        E = np.array([[1, 2],    # dog     #@E
                      [0, 1],    # bites   #@E
                      [3, 0]])   # man     #@E
        P = np.array([[0, 1],    # pos 0   #@P
                      [2, 0],    # pos 1   #@P
                      [1, -1]])  # pos 2   #@P
        E[0] + P[0]   # [1, 3]: dog at 0   #@add0
        E[0] + P[2]   # [2, 1]: dog at 2   #@add2
      `,
      beats: [
        { id: 'fix', say: 'The fix came in the same paper that dropped the steps. In 2017, Ashish Vaswani and colleagues gave every position a vector of its own, and added it to the embedding of the token there.', code: 'E' },
        { id: 'table', say: 'Stack those vectors as the rows of a second table, P: row zero for the first position, row one for the second, and so on.', code: 'P' },
        { id: 'dog', say: 'Dog\'s embedding is the point one, two. Draw it as an arrow from the origin.', code: 'E' },
        { id: 'sum0', say: 'At position zero, add row zero of P, which is zero, one, tip to tail: dog lands at one, three.', code: 'add0' },
        { id: 'sum2', say: 'At position two, add row two instead, one, minus one: now dog lands at two, one.', code: 'add2' },
        { id: 'rows', say: 'Two lookups, then: E by which token it is, and P by where it sits.', code: ['add0', 'add2'] },
        { id: 'differ', say: 'The same word now enters at a different point in each place, so its query, key and value change with it, and attention can tell dog bites man from man bites dog.', code: ['add0', 'add2'] },
      ],
    },
    {
      id: 'learned',
      title: 'A learned table',
      codeTitle: 'table.py',
      code: `
        P.shape   # (T_max, d)             #@shape
        P.shape   # (1024, 768)            #@size
        P.size    # 786,432: all learned   #@size
        P[1024]   # error: no such row     #@end
      `,
      beats: [
        { id: 'learned', say: 'The numbers in P are learned, the same way the embeddings are, so vectors like these are also called position embeddings.', code: 'shape' },
        { id: 'tmax', say: 'P needs a row for every position the model will see. Write {Tₘₐₓ|T max} for the most tokens it reads at once: T for tokens, as in attention, and max for the most. So P is {Tₘₐₓ|T max} by d.', code: 'shape' },
        { id: 'size', say: 'Say a model reads up to {1,024|one thousand and twenty four} tokens, each of {768|seven hundred sixty eight} numbers. Then P holds {1,024|one thousand and twenty four} times {768|seven hundred sixty eight}: {786,432|seven hundred eighty six thousand, four hundred thirty two} learned numbers.', code: 'size' },
        { id: 'end', say: 'And a token past the last row gets no position vector at all. So {Tₘₐₓ|T max} is the longest input the model can read.', code: 'end' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
