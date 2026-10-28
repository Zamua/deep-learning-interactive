import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-rope',
  title: 'Rotary positions',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Su, Lu, Pan, Murtadha, Wen & Liu', year: 2021, title: 'RoFormer: Enhanced Transformer with Rotary Position Embedding', url: 'https://arxiv.org/abs/2104.09864', scene: 'goal' },
  ],
  scenes: [
    {
      id: 'goal',
      title: 'Where, or how far apart',
      codeTitle: 'goal.py',
      code: `
        # positions: emb + P[pos], added    #@add
        gap = 5 - 4   # query 5, key 4: 1  #@back
        gap = 9 - 8   # query 9, key 8: 1  #@back
        # P[5], P[4] and P[9], P[8]:       #@twice
        #   unrelated rows, learned apart  #@twice
        # want: a score set by gap alone   #@want
        # RoPE: turn q and k, add nothing  #@rope
      `,
      beats: [
        { id: 'add', say: 'With learned positions, each slot has its own vector, a row of P, added to the embedding of the token sitting there.', code: 'add' },
        { id: 'back', say: 'But much of what a query looks for is relative, like the word just before it: the key at four, for a query at five, or the key at eight, for a query at nine.', code: 'back' },
        { id: 'twice', say: 'To added vectors, those two cases share nothing. Rows five and four of P are one pair, rows nine and eight another, so the model has to learn the word before afresh at every slot.', code: 'twice' },
        { id: 'want', say: 'Better if the score depended only on how far apart the query and the key sit: the gap, which is one in both cases.', code: 'want' },
        { id: 'su', say: 'In 2021, Jianlin Su and colleagues found a way. Instead of adding a vector, turn each query and each key by an angle set by its position.', code: 'rope' },
        { id: 'name', say: 'They called it rotary position embedding, {RoPE|rope} for short. Rotary, because it rotates. Position embedding, after vectors like P, though here nothing is added.', code: 'rope' },
      ],
    },
    {
      id: 'turn',
      title: 'Turning by position',
      codeTitle: 'rope.py',
      code: `
        q = [2, 1]   # one pair of a query  #@q
        theta = 30   # degrees per position #@theta
        rotate(q, m * theta)  # position m  #@m
        rotate(q, 0 * theta)  # pos 0: none #@three
        rotate(q, 3 * theta)  # pos 3: 90°  #@three
        rotate(q, 12 * theta) # 360°: = q   #@wrap
        # d_k = 64: 32 pairs, own speeds    #@pairs
        # fastest 57°, slowest < 0.01°      #@speeds
      `,
      beats: [
        { id: 'pair', say: 'Start with one pair of a query: two and one, the arrow q from rotation. Here is that same pair at positions zero to four, one dial each.', code: 'q' },
        { id: 'theta', say: 'Each step of position turns it a fixed angle further, written {θ|theta}, the Greek letter theta. Here, {30°|thirty degrees}.', code: 'theta' },
        { id: 'm', say: 'Write m for the position. At position m, the pair has turned by m times {θ|theta}.', code: 'm' },
        { id: 'three', say: 'So position zero does not turn at all, and position three turns three times {30°|thirty degrees}: {90°|ninety degrees}.', code: 'three' },
        { id: 'wrap', say: 'But one pair alone soon comes round. Twelve steps of {30°|thirty degrees} make a full turn, so position twelve looks just like position zero.', code: 'wrap' },
        { id: 'pairs', say: 'So the {dₖ|d k} entries of a query are cut into {dₖ|d k} over two pairs, and each pair turns at its own speed. Here, pair one turns only {3°|three degrees} a step.', code: 'pairs' },
        { id: 'clock', say: 'It works like the hands of a clock. The fast hand tells neighbors apart, and a slow one still tells twelve from zero, long after the fast hand has come round.', code: 'pairs' },
        { id: 'speeds', say: 'With {dₖ|d k} of {64|sixty four}, the paper\'s {32|thirty two} pairs run from about {57°|fifty seven degrees} a step, the fastest, to under a hundredth of a degree, the slowest.', code: 'speeds' },
        { id: 'only', say: 'Nothing is learned, and nothing is added to the token. Just before scoring, every query and every key is turned by its own position.', code: 'm' },
      ],
    },
    {
      id: 'relative',
      title: 'Only the distance counts',
      codeTitle: 'relative.py',
      code: `
        q @ k                          # 3  #@dot
        rotate(q, 90) @ rotate(k, 90)  # 3  #@both
        # query at 5, key at 2: 3 apart    #@apart
        # both 4 later, 9 and 6: 3 apart   #@shift
        # theta = 90: q at 1, k at 0       #@try
        rotate(q, 90)        # [-1, 2]     #@tq
        rotate(q, 90) @ k    # -1 + 2 = 1  #@tdot
      `,
      beats: [
        { id: 'both', say: 'Why does turning help? Turn a query and a key by the same angle, and they move together: the angle between them stays, and so does their dot product.', code: 'both' },
        { id: 'numbers', say: 'Two, one dotted with one, one is three. Turned {90°|ninety degrees} each, they still give three.', code: ['dot', 'both'] },
        { id: 'apart', say: 'Now put a query at position five, turned by {5θ|five theta}, and a key at position two, turned by {2θ|two theta}. They end up {3θ|three theta} apart: one {θ|theta} for each step between them.', code: 'apart' },
        { id: 'shift', say: 'Move both four places later, to nine and six. Each turns {4θ|four theta} more, together, so the angle between them stays, and so does the score.', code: 'shift' },
        { id: 'distance', say: 'So the score depends only on how far apart the two sit, and which comes first. The word before now looks the same at every slot, and is learned once.', code: ['apart', 'shift'] },
        { id: 'try', say: 'Try one, with {θ|theta} of {90°|ninety degrees}: the query two, one at position one, and the key one, one at position zero.', code: 'try' },
        { id: 'tq', say: 'The query makes one quarter turn, which swaps its entries and flips the new first sign: minus one, two. The key, at position zero, does not turn.', code: 'tq' },
        { id: 'tdot', say: 'Dot them: minus one, plus two. The score is one, where the unturned pair gave three.', code: 'tdot' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
