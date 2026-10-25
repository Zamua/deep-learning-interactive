import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-transformer-block',
  title: 'The transformer block',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'parts',
      title: 'Two branches, two adds',
      codeTitle: 'block.py',
      code: `
        def block(x):                     # x: (T, d)            #@io
            x = x + attention(ln1(x))     # tokens talk          #@attn
            x = x + mlp(ln2(x))           # each token alone     #@mlp
            return x                      # still (T, d)         #@io

        def mlp(u):                       # one token at a time
            return W2 @ relu(W1 @ u)      # d -> 4d -> d         #@width
      `,
      beats: [
        { id: 'io', say: 'A transformer block takes T tokens, each a vector of d numbers, and returns T vectors of d numbers. Same shape in and out, so blocks can be stacked.', code: 'io' },
        { id: 'attn', say: 'First the tokens exchange information: layer norm, then multi-head attention, and the result is added back to the input. A residual connection: {x + Attn(LN(x))|x plus attention of layer norm of x}.', code: 'attn' },
        { id: 'mlp', say: 'Then each token is processed on its own: layer norm again, then an MLP, added back the same way.', code: 'mlp' },
        { id: 'width', say: 'The MLP widens each token to {4d|four d} numbers, applies a ReLU, and comes back down to d. With d of {768|seven hundred sixty eight}, its hidden layer is {3,072|three thousand and seventy two} wide.', code: 'width' },
      ],
    },
    {
      id: 'flow',
      title: 'Following one token',
      codeTitle: 'block.py',
      code: `
        x = [1, 2]                         # one token, d = 2   #@x
        attention(ln1(...))  # [0.5, -1]   -> x = [1.5, 1]      #@a
        mlp(ln2(...))        # [-0.5, 2]   -> x = [1, 3]        #@m
      `,
      beats: [
        { id: 'x', say: 'Follow one token through, with d of two. It enters as one and two.', code: 'x' },
        { id: 'a', say: 'For this token, the attention branch returns {0.5|zero point five} and minus one. Added to the input, that makes {1.5|one point five} and one.', code: 'a' },
        { id: 'm', say: 'The MLP branch, reading the normalized sum, returns minus {0.5|zero point five} and two. Added on, that makes one and three: the block\'s output.', code: 'm' },
        { id: 'path', say: 'The input runs straight through the adds, and each branch only adds a change, as in a residual block. With the norms at the start of each branch, this is called a pre-norm block.', code: ['a', 'm'] },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
