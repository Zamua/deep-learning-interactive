import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-residual-stream',
  title: 'The residual stream',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'sum',
      title: 'A running sum',
      codeTitle: 'stream.py',
      code: `
        x = embed[token]          # x_0: d numbers   #@x0
        for block in blocks:
            x = x + block.attn(ln(x))   # read, add  #@attn
            x = x + block.mlp(ln(x))    # read, add  #@mlp
      `,
      beats: [
        { id: 'block', say: 'Inside a transformer block, attention and the MLP each add their output to their input: x, plus attention of x, then plus the MLP.', code: ['attn', 'mlp'] },
        { id: 'stream', say: 'Read it the other way round. Each token has one running vector, the residual stream. It starts as the token\'s embedding, {x₀|x zero}.', code: 'x0' },
        { id: 'writes', say: 'Every attention and every MLP reads the stream and adds a write to it. Say {x₀|x zero} is one, zero, two. Attention writes zero, one, minus one, and the MLP writes two, zero, one.', code: ['attn', 'mlp'] },
        { id: 'total', say: 'The stream is now their sum: three, one, two. After the last block, it is {x₀|x zero} plus every write.', code: ['attn', 'mlp'] },
      ],
    },
    {
      id: 'width',
      title: 'One width, bottom to top',
      codeTitle: 'shapes.py',
      code: `
        x.shape           # (tokens, d)         #@shape
        block.mlp(ln(x))  # 4d inside, d out    #@mlp
        x = x + write     # still (tokens, d)   #@add
      `,
      beats: [
        { id: 'same', say: 'Because writes are added, every write has the stream\'s width, d. The MLP may widen a token to four d inside, but it projects back down to d before adding.', code: ['mlp', 'add'] },
        { id: 'never', say: 'So the stream never grows: d numbers per token at the bottom, d at the top, and d after every block.', code: 'shape' },
      ],
    },
    {
      id: 'read',
      title: 'A shared scratchpad',
      codeTitle: 'scratchpad.py',
      code: `
        x = x0 + w0 + w1 + w2 + ...   # writes stay  #@sum
        # block 9 reads block 1's write directly     #@read
      `,
      beats: [
        { id: 'keep', say: 'A write is never replaced, only added to. What block one writes is still in the stream when block nine reads it.', code: 'sum' },
        { id: 'direct', say: 'So a late block can read an early block\'s write directly, with no block in between passing it along. Each block reads the whole stream, and writes back into it.', code: 'read' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
