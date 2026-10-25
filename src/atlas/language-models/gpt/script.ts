import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-gpt',
  title: 'A decoder-only language model',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'into',
      title: 'Tokens become vectors',
      codeTitle: 'gpt.py',
      code: `
        ids = [5, 9, 7, 2]      # (T,) = (4,)     #@ids
        x = E[ids]              # (4, d)          #@embed
        x = x + pos[:4]         # still (4, d)    #@pos
      `,
      beats: [
        { id: 'ids', say: 'A decoder-only language model, the design behind GPT, reads a sequence of T token ids. Here T is four: the, cat, sat, on.', code: 'ids' },
        { id: 'embed', say: 'First, each id is swapped for its row of the embedding table: T vectors of d numbers, an array, x, of T by d.', code: 'embed' },
        { id: 'pos', say: 'Attention ignores order, so each position adds a vector of its own, from a table with one row per position. The shape stays T by d.', code: 'pos' },
      ],
    },
    {
      id: 'through',
      title: 'Causal blocks',
      codeTitle: 'gpt.py',
      code: `
        for block in blocks:   # N causal blocks    #@blocks
            x = block(x)       # (4, d) -> (4, d)   #@blocks
        # position 2 attends to 0, 1, 2; never 3    #@causal
      `,
      beats: [
        { id: 'blocks', say: 'Then come the transformer blocks, N of them, one after another. Each takes T by d and hands back T by d, so they stack.', code: 'blocks' },
        { id: 'causal', say: 'Every block\'s attention is causal. Position two sees positions zero, one and two, and never three.', code: 'causal' },
        { id: 'why', say: 'So no position can peek at the token it will be asked to predict, and all T positions still run at once, in one pass.', code: 'causal' },
      ],
    },
    {
      id: 'out',
      title: 'A prediction at every position',
      codeTitle: 'gpt.py',
      code: `
        s = x @ W_U.T       # (4, V): scores         #@unembed
        p = softmax(s)      # one row per position   #@probs
        # row 0 -> cat, row 1 -> sat, row 2 -> on   #@shift
        # 4 tokens in, 4 predictions out           #@count
      `,
      beats: [
        { id: 'unembed', say: 'At the top, the unembedding scores every vocabulary token at every position: T by d becomes T by V.', code: 'unembed' },
        { id: 'softmax', say: 'A softmax on each row turns those scores into next-token probabilities.', code: 'probs' },
        { id: 'shift', say: 'Each row predicts the token after its position. Row zero has read the, and predicts cat. Row one predicts sat, and row two predicts on.', code: 'shift' },
        { id: 'last', say: 'Row three has read the whole sequence, so it predicts the token after all of it: a word not written yet.', code: 'shift' },
        { id: 'count', say: 'So T tokens give T predictions, all from one forward pass, and training adds up a cross-entropy loss at every position.', code: 'count' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
