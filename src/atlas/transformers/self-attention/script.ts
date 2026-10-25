import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-self-attention',
  title: 'Self-attention in matrices',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'stack',
      title: 'Every token at once',
      codeTitle: 'self_attention.py',
      code: `
        X = np.array([cats, like, fish])        # (T, d): a token per row   #@X
        Q = np.stack([Wq @ x for x in X])       # (T, d_k)                  #@qkv
        K = np.stack([Wk @ x for x in X])       # (T, d_k)                  #@qkv
        V = np.stack([Wv @ x for x in X])       # (T, d_v)                  #@qkv
        e = Q @ K.T / np.sqrt(d_k)              # (T, T)                    #@e
      `,
      beats: [
        { id: 'tokens', say: 'So far, one token asked at a time. Self-attention lets every token ask at once. Stack the tokens as the rows of a matrix, X: T rows, one per token.', code: 'X' },
        { id: 'qkv', say: 'Each token\'s query becomes one row of a matrix, Q; its key, one row of K; its value, one row of V. So Q and K are T by {dₖ|d k}, and V is T by {dᵥ|d v}.', code: 'qkv' },
        { id: 'scores', say: 'Then one matrix product scores every query against every key: Q times K transpose. T by {dₖ|d k}, times {dₖ|d k} by T, gives T by T.', code: 'e' },
        { id: 'entry', say: 'Entry i, j is token i\'s query dotted with token j\'s key, divided by the square root of {dₖ|d k}. Row two, column zero: how much fish looks at cats.', code: 'e' },
      ],
    },
    {
      id: 'mix',
      title: 'Weights times values',
      codeTitle: 'self_attention.py',
      code: `
        A = softmax(e, axis=1)    # (T, T): each row adds up to 1   #@A
        out = A @ V               # (T, d_v): a row per token       #@out
        out[2]                    # [2.0, 2.0]                      #@row
      `,
      beats: [
        { id: 'softmax', say: 'Softmax runs along each row, giving the weights, A. Every row adds up to one: it is how one token splits its attention over all of them.', code: 'A' },
        { id: 'fish', say: 'Here fish, row two, gives a half to cats and a quarter each to like and to itself.', code: 'A' },
        { id: 'out', say: 'Then A times V. T by T, times T by {dᵥ|d v}, gives T by {dᵥ|d v}: one output row per token.', code: 'out' },
        { id: 'row', say: 'Row two of the output is the weighted sum of the rows of V: half of two and zero, plus a quarter of zero and four, plus a quarter of four and four. That is two and two.', code: 'row' },
        { id: 'formula', say: 'All of self-attention in one line: softmax of Q K transpose over the square root of {dₖ|d k}, times V.', code: ['A', 'out'] },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
