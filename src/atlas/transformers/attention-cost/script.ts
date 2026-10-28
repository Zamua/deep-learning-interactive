import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-attention-cost',
  title: 'The cost of attention',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Vaswani et al.', year: 2017, title: 'Attention is all you need', url: 'https://arxiv.org/abs/1706.03762', scene: 'grows' },
    { who: 'Child, Gray, Radford & Sutskever', year: 2019, title: 'Generating long sequences with sparse transformers', url: 'https://arxiv.org/abs/1904.10509', scene: 'memory' },
  ],
  scenes: [
    {
      id: 'pairs',
      title: 'Every token meets every token',
      codeTitle: 'pairs.py',
      code: `
        tokens = ['cats', 'like', 'fish']  #@three
        e = Q @ K.T       # (T, T)         #@e
        # T = 4: 16 scores                 #@double
        # T = 8: 64 scores, 4 times as many #@double
        # 10 times T: 100 times the scores #@square
      `,
      beats: [
        { id: 'grid', say: 'In self-attention, every token scores every token, itself included. Cats like fish: three tokens asking, three answering, a grid of nine scores.', code: 'three' },
        { id: 'T', say: 'With T tokens, the grid is T by T, {T²|T squared} scores: the matrix that Q times K transpose makes.', code: 'e' },
        { id: 'double', say: 'Now double the context, the tokens that attention reads at once. Four tokens make sixteen scores; eight make sixty-four.', code: 'double' },
        { id: 'why', say: 'Twice as many tokens ask, and each asks twice as many: two times two, four times the scores.', code: 'double' },
        { id: 'square', say: 'Ten times the tokens, a hundred times the scores. Growing with the square like this is called quadratic, from the Latin for squared.', code: 'square' },
      ],
    },
    {
      id: 'grows',
      title: 'What grows, and what does not',
      codeTitle: 'shapes.py',
      code: `
        Q.shape    # (T, d_k): 2 times    #@Q
        K.shape    # (T, d_k): 2 times    #@Q
        Wq.shape   # (d_k, d): the same   #@W
        e.shape    # (T, T): 4 times      #@e
        # attention: about T * T * d      #@att
        # recurrent: about T * d * d      #@rnn
      `,
      beats: [
        { id: 'rows', say: 'Not everything grows that fast. The queries, keys and values have one row per token: twice the tokens, twice the rows.', code: 'Q' },
        { id: 'weights', say: 'The weights that make them, {Wq|W Q}, {Wk|W K} and {Wv|W V}, are shared by every token, so they stay the same size. Only the scores pair tokens up.', code: 'W' },
        { id: 'vaswani', say: 'Ashish Vaswani and colleagues weighed this cost in 2017, in Attention Is All You Need. Over all the heads, each pair of tokens costs about d multiplications, d being a token\'s length, so attention\'s work grows like T squared, times d.', code: ['e', 'att'] },
        { id: 'rnn', say: 'A recurrent network of the same width pays per token instead: each step multiplies its state by a d by d matrix, so its work grows like T, times d squared.', code: 'rnn' },
        { id: 'cross', say: 'So attention was the cheaper one while there were fewer tokens than d. With d at {512|five hundred twelve}, that held for most sentences in translation, their task.', code: ['att', 'rnn'] },
      ],
    },
    {
      id: 'memory',
      title: 'What it costs in memory',
      codeTitle: 'memory.py',
      code: `
        def score_bytes(n):                  #@fn
            return n * n * 2  # 2 bytes each #@fn
        score_bytes(1000)    # 2,000,000     #@one
        score_bytes(8000)    # 128,000,000   #@long
        n_heads = 16                         #@heads
        n_heads * score_bytes(8000)  # 2 GB  #@heads
      `,
      beats: [
        { id: 'bytes', say: 'The scores take memory, too. A computer counts memory in bytes, and here each score is stored in two bytes.', code: 'fn' },
        { id: 'one', say: 'A thousand tokens make a thousand times a thousand scores: a million.', code: 'one' },
        { id: 'mb', say: 'At two bytes each, that is two million bytes: two megabytes, as a megabyte is a million bytes.', code: 'one' },
        { id: 'long', say: 'Make the context eight times longer, eight thousand tokens, and the scores grow sixty-four times: {128|a hundred and twenty-eight} megabytes, for one head.', code: 'long' },
        { id: 'heads', say: 'And every head keeps its own grid. Sixteen heads hold about two gigabytes: two billion bytes.', code: 'heads' },
        { id: 'layer', say: 'Heads side by side, reading the same tokens, make a self-attention layer, just as neurons side by side make a layer.', code: 'heads' },
        { id: 'child', say: 'In 2019, Rewon Child and colleagues, modelling images, sound and text tens of thousands of steps long, opened their paper with this very cost: time and memory that grow quadratically with the length.', code: 'long' },
        { id: 'end', say: 'That square is why long inputs are expensive for attention: twice the context, four times the work and the memory.', code: 'long' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
