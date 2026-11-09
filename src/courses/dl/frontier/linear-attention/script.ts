import type { LectureScript } from '../../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-linear-attention',
  title: 'Linear attention',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Katharopoulos, Vyas, Pappas & Fleuret', year: 2020, title: 'Transformers are RNNs: fast autoregressive transformers with linear attention', url: 'https://arxiv.org/abs/2006.16236', scene: 'rnn' },
  ],
  scenes: [
    {
      id: 'cache',
      title: 'Attention keeps every token',
      codeTitle: 'decode.py',
      code: `
        for t in range(T):                #@loop
            K.append(k); V.append(v)      #@grow
            e = K @ q     # t scores      #@score
            a = softmax(e)                #@soft
            o = a @ V                     #@out
        # an RNN: one state, any length   #@rnn
      `,
      beats: [
        { id: 'grow', say: 'While a transformer writes, each new token adds its key and value to the KV cache. Its query scores every key there, and the output, o, mixes the values by the softmax of those scores.', code: ['loop', 'grow', 'score', 'soft', 'out'] },
        { id: 'cost', say: 'So the cache grows with every token, and token t makes t scores: the longer the text, the more each new token costs.', code: ['grow', 'score'] },
        { id: 'rnn', say: 'A recurrent network pays the same at every step: it folds each token into one state of fixed size, and keeps nothing else. Could attention work like that?', code: 'rnn' },
        { id: 'block', say: 'The softmax is what stands in the way. Its exponential, e to the power of q dot k, has to see the query before any key\'s term can be added in, so every key is kept for every query still to come.', code: 'soft' },
      ],
    },
    {
      id: 'drop',
      title: 'Drop the softmax',
      codeTitle: 'linear.py',
      code: `
        o = sum((k @ q) * v for k, v in kvs)      #@plain
        (k @ q) * v == np.outer(v, k) @ q         #@regroup
        np.outer([2, 3], [1, 0])  # [[2, 0],      #@outer
                                  #  [3, 0]]      #@outer
        S = sum(np.outer(v, k) for k, v in kvs)   #@S
        o = S @ q      # the same o, from S alone #@read
      `,
      beats: [
        { id: 'plain', say: 'So drop the softmax. Let each weight be the plain dot product, k dot q: no exponential, and no division.', code: 'plain' },
        { id: 'sum', say: 'The output is then each value times its key\'s score, added up: {o = Σ (kᵢ · q) vᵢ|o equals the sum over the tokens of k i dot q, times v i}.', code: 'plain' },
        { id: 'regroup', say: 'Look at one term: a number, k dot q, times a vector, v. It can be worked the other way round: first a matrix made from v and k alone, then that matrix times q.', code: 'regroup' },
        { id: 'outer', say: 'That matrix is the outer product of v and k, written {v kᵀ|v k transpose}: every entry of v times every entry of k, in a table with a row for each entry of v and a column for each entry of k.', code: 'outer' },
        { id: 'S', say: 'Add up those tables over every token so far, and call the sum S. Then the output is one matrix times the query: {o = S q|o equals S q}.', code: ['S', 'read'] },
        { id: 'fold', say: 'And S never needs a query. Each key and value can be folded into it as they arrive, and then let go.', code: 'S' },
      ],
    },
    {
      id: 'rnn',
      title: 'A recurrence after all',
      codeTitle: 'recurrent.py',
      code: `
        S = np.zeros((2, 2))           #@init
        for k, v, q in tokens:         #@loop
            S = S + np.outer(v, k)     #@write
            o = S @ q                  #@read
        # k1 = [1, 0], v1 = [2, 3]     #@t1
        # k2 = [0, 1], v2 = [1, 4]     #@t2
        # S = [[2, 1], [3, 4]]         #@t2
        S @ [1, 1]     # [3, 7]        #@q
        S @ [1, 0]     # [2, 3]: v1    #@recall
      `,
      beats: [
        { id: 'rec', say: 'So each step adds one table to the state, then reads the state with the query: {Sₜ = Sₜ₋₁ + vₜkₜᵀ|S t equals S t minus one, plus v t k t transpose}, and {oₜ = Sₜqₜ|o t equals S t q t}.', code: ['loop', 'write', 'read'] },
        { id: 'linear', say: 'That is a linear recurrence, with a whole matrix for its state and a decay of one: nothing in it fades.', code: 'write' },
        { id: 't1', say: 'Try it with keys and values of two numbers. S starts at zeros. The first token has key one, zero and value two, three, so its table puts two, three in S\'s first column.', code: ['init', 't1'] },
        { id: 't2', say: 'The second has key zero, one and value one, four, which fills the second column. S now has rows two, one and three, four.', code: 't2' },
        { id: 'q', say: 'A query of one, one reads three, seven: each row of S dotted with q. The old sum agrees: one times two, three, plus one times one, four.', code: 'q' },
        { id: 'recall', say: 'And a query equal to the first key, one, zero, reads back exactly its value, two, three. The state is a memory from keys to values.', code: 'recall' },
        { id: 'paper', say: 'Angelos Katharopoulos and colleagues showed this in 2020, in a paper titled Transformers are {RNNs|R N Ns}. They also kept every number in the queries and keys positive, and divided by a total; later models often drop both.', code: 'write' },
      ],
    },
    {
      id: 'size',
      title: 'A state that never grows',
      codeTitle: 'size.py',
      code: `
        d_head = 64                          #@d
        d_head * d_head    # 4,096: S        #@state
        2 * d_head    # 128 per token: cache #@cache
        4096 / 128         # 32 tokens       #@cross
        2 * 4000 * 64 / 4096   # 125 times   #@ratio
        # per token: one add, one read       #@work
      `,
      beats: [
        { id: 'state', say: 'Now the size. A head whose keys and values have {d_head|d head} numbers keeps a {d_head|d head} by {d_head|d head} state: at sixty four, {4,096|four thousand and ninety six} numbers, however long the text.', code: ['d', 'state'] },
        { id: 'cache', say: 'Softmax attention\'s cache, for the same head, holds a key and a value for every token: a hundred and twenty eight numbers each.', code: 'cache' },
        { id: 'cross', say: 'So by thirty two tokens, the cache is as big as the state. At four thousand, it is a hundred and twenty five times bigger, and still growing.', code: ['cross', 'ratio'] },
        { id: 'work', say: 'The work per token is fixed too: add one table, and read once, where softmax attention scores every token so far.', code: 'work' },
        { id: 'train', say: 'Training needs no loop: with every token known, all the outputs come at once from matrix products, as in a transformer. Only generating runs step by step.', code: 'work' },
        { id: 'fast', say: 'On very long sequences, Katharopoulos\'s linear transformers generated up to four thousand times faster than ordinary ones, with similar results.', code: 'work' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
