import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-residual-stream',
  title: 'The residual stream',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Elhage, Nanda, Olsson et al.', year: 2021, title: 'A Mathematical Framework for Transformer Circuits', url: 'https://transformer-circuits.pub/2021/framework/index.html', scene: 'stream' },
  ],
  scenes: [
    {
      id: 'stream',
      title: 'One stream through every block',
      codeTitle: 'stream.py',
      code: `
        x = embed[token]     # x₀: the start  #@x0
        for block in blocks:                  #@loop
            x = x + block.attn(ln(x))  # write #@attn
            x = x + block.mlp(ln(x))   # write #@mlp
      `,
      beats: [
        { id: 'stack', say: 'Stack transformer blocks, and follow one token up through them. If each block turned the token\'s vector into something new, whatever block one worked out would have to be passed along by every block after it.', code: 'loop' },
        { id: 'adds', say: 'But a block never replaces the vector. Its attention and its MLP each add their output to it: those are the residual connections.', code: ['attn', 'mlp'] },
        { id: 'stream', say: 'So the vector runs straight up, past every block, and each block reads it and adds something back. This is the residual stream: one vector per token, flowing up through the whole model.', code: 'loop' },
        { id: 'name', say: 'Residual, because it is the residual connections, joined end to end. A stream, because it flows past every block, and every block pours into it.', code: 'loop' },
        { id: 'x0', say: 'At the bottom, the stream is the token\'s embedding, {x₀|x zero}. What a block adds to it is called its write.', code: 'x0' },
        { id: 'keep', say: 'Writes are only ever added, so they stay. What block one writes is still in the stream when block nine reads it, with no block in between passing it on.', code: ['attn', 'mlp'] },
        { id: 'pad', say: 'Every block reads the whole stream and writes back into it, like a shared scratchpad.', code: 'loop' },
        { id: 'history', say: 'In 2021, Nelson Elhage, Chris Olah and colleagues at Anthropic called it the residual stream, in A Mathematical Framework for Transformer Circuits. They saw it as a communication channel: it does no processing of its own, and every layer talks to the others through it.', code: 'loop' },
      ],
    },
    {
      id: 'sum',
      title: 'A running sum',
      codeTitle: 'sum.py',
      code: `
        x = np.array([1, 0, 2])   # x₀       #@x0
        x = x + [0, 1, -1]  # attn: [1, 1, 1] #@a
        x = x + [2, 0, 1]   # MLP: [3, 1, 2]  #@m
        x - [1, 1, 1]       # = [2, 0, 1]     #@diff
      `,
      beats: [
        { id: 'zoom', say: 'Now put numbers on one block, with d of three: three numbers per token.', code: 'x0' },
        { id: 'x0', say: 'The stream comes in as {x₀|x zero}: one, zero, two.', code: 'x0' },
        { id: 'a', say: 'Attention reads it and writes zero, one, minus one. Added in, the stream becomes one, one, one.', code: 'a' },
        { id: 'm', say: 'The MLP reads that and writes two, zero, one. Added in, the stream becomes three, one, two.', code: 'm' },
        { id: 'sum', say: 'So after any block, the stream is {x₀|x zero} plus every write so far: not just the latest one, and never without {x₀|x zero}.', code: ['a', 'm'] },
        { id: 'diff', say: 'Run it backward to find a write: take the stream before from the stream after. Three, one, two, less one, one, one, leaves two, zero, one: the MLP\'s write.', code: 'diff' },
      ],
    },
    {
      id: 'width',
      title: 'One width, bottom to top',
      codeTitle: 'shapes.py',
      code: `
        x.shape           # (tokens, d)       #@shape
        block.mlp(ln(x))  # 4d inside, d out  #@mlp
        x = x + write     # still (tokens, d) #@add
      `,
      beats: [
        { id: 'same', say: 'Adding needs two vectors of the same size, so every write is exactly as wide as the stream: d numbers.', code: 'add' },
        { id: 'mlp', say: 'The MLP widens each token to {4d|four d} numbers inside, but its last layer brings them back down to d before the add.', code: 'mlp' },
        { id: 'never', say: 'So the stream never grows. With ten tokens and d of {768|seven hundred sixty eight}, it is ten by {768|seven hundred sixty eight} at the bottom, after every block, and at the top: one vector per token, all the way up.', code: 'shape' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
