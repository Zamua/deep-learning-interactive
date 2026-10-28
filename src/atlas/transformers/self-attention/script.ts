import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-self-attention',
  title: 'Self-attention in matrices',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Vaswani, Shazeer, Parmar, Uszkoreit, Jones, Gomez, Kaiser & Polosukhin', year: 2017, title: 'Attention Is All You Need', url: 'https://arxiv.org/abs/1706.03762', scene: 'ask' },
  ],
  scenes: [
    {
      id: 'ask',
      title: 'Every token asks',
      codeTitle: 'ask.py',
      code: `
        tokens = [cats, like, fish]         #@all
        q = Wq @ fish      # fish asks      #@one
        e = [q @ k for k in keys]           #@one
        a = softmax(e)  # [0.5, 0.25, 0.25] #@one
        out = a @ values   # fish's answer  #@one
        # every token asks: 3 x 3 pairs     #@all
        # q, k, v: all from the same tokens #@self
        # no recurrence: nobody waits       #@par
      `,
      beats: [
        { id: 'one', say: 'With queries, keys and values, one token asked: fish. It scored every token\'s key, its own included, and took a weighted sum of their values.', code: 'one' },
        { id: 'all', say: 'But the tokens cats and like need answers of their own. So let every token ask, all at once. Call the number of tokens T: here, three, each looking at all three.', code: 'all' },
        { id: 'self', say: 'That is why it is called self-attention. In attention over the encoder, the decoder asked and the encoder answered: two different sequences. Here the tokens asking and the tokens answering are the same. The sentence attends to itself.', code: 'self' },
        { id: 'paper', say: 'In 2017, Ashish Vaswani and colleagues at Google built a translation model on it, in a paper called Attention Is All You Need. Their definition: attention relating different positions of a single sequence.', code: 'self' },
        { id: 'parallel', say: 'And they dropped recurrence. A recurrent network reads one token per step, and each step waits for the one before. Here nobody waits: every token asks at the same time.', code: 'par' },
      ],
    },
    {
      id: 'stack',
      title: 'Stack the tokens',
      codeTitle: 'self_attention.py',
      code: `
        X = np.stack(tokens)   # (T, d)     #@X
        Q = X @ Wq.T           # (T, d_k)   #@Q
        K = X @ Wk.T           # (T, d_k)   #@K
        V = X @ Wv.T           # (T, d_v)   #@V
        e = Q @ K.T            # (T, T)     #@e
        e = e / np.sqrt(d_k)   # same shape #@scale
      `,
      beats: [
        { id: 'X', say: 'All at once means matrices. Stack the tokens as the rows of one matrix, X: T rows of d numbers, so X is T by d.', code: 'X' },
        { id: 'Q', say: 'Multiply X by the query weights, transposed so the shapes line up, and every token\'s query comes out at once, as the rows of Q: T by {dₖ|d k}.', code: 'Q' },
        { id: 'K', say: 'The keys come out the same way, as the rows of K, also T by {dₖ|d k}.', code: 'K' },
        { id: 'V', say: 'And the values, as the rows of V.', code: 'V' },
        { id: 'same', say: 'A row stays with its token: row two is fish, in X, Q, K and V alike. Only the lengths differ. A value has its own length, {dᵥ|d v}, so V is T by {dᵥ|d v}.', code: ['X', 'Q', 'K', 'V'] },
        { id: 'scores', say: 'Now one matrix product scores every query against every key: Q times K transpose. T by {dₖ|d k}, times {dₖ|d k} by T, gives T by T.', code: 'e' },
        { id: 'grid', say: 'That grid is the fans of lines from before. Row i holds token i\'s scores, so row two, column zero is fish\'s query dotted with cats\' key: how much fish looks at cats.', code: 'e' },
        { id: 'scale', say: 'Then every score is divided by the square root of {dₖ|d k}, as before.', code: 'scale' },
      ],
    },
    {
      id: 'mix',
      title: 'Weights times values',
      codeTitle: 'self_attention.py',
      code: `
        A = softmax(e, axis=1)  # (T, T)    #@A
        # each row adds up to 1             #@A
        # a column can add up to anything   #@cols
        out = A @ V        # (T, d_v)       #@out
        out[2]             # [2.0, 2.0]     #@row
      `,
      beats: [
        { id: 'softmax', say: 'Softmax runs along each row, turning each token\'s scores into weights: the matrix A. Every row adds up to one. It is how one token splits its attention.', code: 'A' },
        { id: 'fish', say: 'Fish\'s row gives a half to cats, a quarter to like, and a quarter to itself.', code: 'A' },
        { id: 'cols', say: 'A column need not add up to one. Column zero is how much attention cats gets, and cats gets the most.', code: 'cols' },
        { id: 'out', say: 'Then A times V does every token\'s weighted sum at once. T by T, times T by {dᵥ|d v}, gives T by {dᵥ|d v}: one output row per token.', code: 'out' },
        { id: 'row', say: 'Fish\'s output is row two of A, weighting the rows of V: half of two and zero, a quarter of zero and four, and a quarter of four and four. Together, two and two.', code: 'row' },
        { id: 'formula', say: 'So all of self-attention is one line: {softmax(QKᵀ / √dₖ) V|softmax of Q K transpose over the square root of d k, times V}. A few matrix products, and every token gets its answer at once.', code: ['A', 'out'] },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
