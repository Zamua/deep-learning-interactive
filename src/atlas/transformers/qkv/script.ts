import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-qkv',
  title: 'Queries, keys and values',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'three',
      title: 'Three vectors per token',
      codeTitle: 'qkv.py',
      code: `
        x = np.array([2, 1])                 #@x
        Wq = np.array([[1, 1], [0, 1]])      #@q
        Wk = np.array([[1, 0], [1, -1]])     #@k
        Wv = np.array([[0, 1], [2, 0]])      #@v
        q = Wq @ x     # [3, 1]: the query   #@q
        k = Wk @ x     # [2, 1]: the key     #@k
        v = Wv @ x     # [1, 4]: the value   #@v
        Wq.shape       # (d_k, d)            #@shape
      `,
      beats: [
        { id: 'two', say: 'In attention over the encoder, each encoder state did two jobs. It was scored against the decoder\'s state, and it was what got averaged.', code: 'x' },
        { id: 'split', say: 'Queries, keys and values give every token, x, three separate vectors: one to ask with, one to be scored by, and one to be mixed. Each comes from its own matrix.', code: ['q', 'k', 'v'] },
        { id: 'query', say: 'The query, q, is {Wq|W Q} times x: what this token is looking for. With x equal to two and one, q is three and one.', code: 'q' },
        { id: 'key', say: 'The key, k, is {Wk|W K} times x: what this token offers to a query that comes looking. Here, two and one.', code: 'k' },
        { id: 'value', say: 'The value, v, is {Wv|W V} times x: what this token hands over when it is chosen. Here, one and four.', code: 'v' },
        { id: 'shape', say: 'Each matrix has one row per entry of what it makes, and one column per entry of x. Write {d|d} for a token\'s length and {dₖ|d k} for a query\'s: {Wq|W Q} is {dₖ by d|d k by d}. With d of {512|five hundred twelve} and {dₖ|d k} of {64|sixty four}, that is {64 by 512|sixty four by five hundred twelve}.', code: 'shape' },
      ],
    },
    {
      id: 'match',
      title: 'Queries meet keys',
      codeTitle: 'attend.py',
      code: `
        q = Wq @ x2                   # [1, 1]: fish asks         #@q
        keys = [k0, k1, k2]           # one key per token         #@keys
        e = [q @ k for k in keys]     # [2, 0, 1]                 #@e
        a = softmax(e)                # [0.67, 0.09, 0.24]        #@a
        out = a @ values              # [1.58, 0.42]              #@out
      `,
      beats: [
        { id: 'ask', say: 'Now three tokens: cats, like and fish. Token two, fish, asks with its query: one and one.', code: 'q' },
        { id: 'score', say: 'Its query is scored against every token\'s key, its own included, with a dot product: two, zero and one.', code: ['keys', 'e'] },
        { id: 'weights', say: 'Softmax turns the scores into weights: {0.67|zero point six seven}, {0.09|zero point zero nine} and {0.24|zero point two four}.', code: 'a' },
        { id: 'mix', say: 'Fish\'s output is the weighted sum of the values, mostly the value of cats, two and zero. It comes to {1.58|one point five eight} and {0.42|zero point four two}.', code: 'out' },
        { id: 'roles', say: 'So the keys decide how much each token counts, and the values decide what it brings. The three matrices are learned, and every token uses the same three.', code: ['e', 'out'] },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
