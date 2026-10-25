import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-attention-cost',
  title: 'The cost of attention',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'square',
      title: 'One score per pair',
      codeTitle: 'cost.py',
      code: `
        e = Q @ K.T / np.sqrt(d_k)   # (T, T)              #@e
        # 4 tokens: 16 scores; 8 tokens: 64 scores         #@double
        Q.shape                      # (T, d_k): grows with T     #@linear
        Wq.shape                     # (d_k, d): never grows      #@linear
      `,
      beats: [
        { id: 'pairs', say: 'Self-attention scores every token against every token. T tokens make a T by T matrix: {T²|T squared} scores. Four tokens, sixteen scores.', code: 'e' },
        { id: 'double', say: 'Double the tokens to eight, and there are sixty four scores: four times as many. Doubling T quadruples the scores.', code: 'double' },
        { id: 'linear', say: 'The queries, keys and values grow only in step with T: one row per token. And the weights do not grow at all.', code: 'linear' },
      ],
    },
    {
      id: 'memory',
      title: 'What it costs',
      codeTitle: 'cost.py',
      code: `
        def score_bytes(n):                                  #@fn
            return n * n * 2      # 2 bytes per score        #@fn
        score_bytes(1000)         # 2,000,000: 2 MB          #@one
        score_bytes(8000)         # 128,000,000: 128 MB      #@long
        16 * score_bytes(8000)    # 16 heads: about 2 GB     #@heads
      `,
      beats: [
        { id: 'bytes', say: 'Each score is stored in two bytes. One score matrix for a thousand tokens is a million scores: two million bytes, two megabytes.', code: ['fn', 'one'] },
        { id: 'long', say: 'At eight thousand tokens, it is sixty four million scores, {128|one hundred twenty eight} megabytes, for a single head.', code: 'long' },
        { id: 'heads', say: 'And every head computes its own. With sixteen heads, one layer holds about two gigabytes of scores.', code: 'heads' },
        { id: 'why', say: 'That square is why long inputs are expensive for attention: twice the context, four times the work and memory.' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
