import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-online-softmax',
  title: 'Softmax in one pass',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Milakov & Gimelshein', year: 2018, title: 'Online normalizer calculation for softmax', url: 'https://arxiv.org/abs/1805.02867', scene: 'pass' },
    { who: 'Dao, Fu, Ermon, Rudra & Ré', year: 2022, title: 'FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness', url: 'https://arxiv.org/abs/2205.14135', scene: 'tiles' },
  ],
  scenes: [
    {
      id: 'row',
      title: 'Why the whole row is kept',
      codeTitle: 'softmax.py',
      code: `
        s = np.array([3, 4, 0])  # one row  #@s
        np.exp(1000.0)   # inf: too big     #@big
        m = max(s)       # pass 1: 4        #@m
        e = np.exp(s - m)  # at most 1      #@e
        l = sum(e)       # pass 2: 1.39     #@l
        p = e / l        # pass 3           #@p
      `,
      beats: [
        { id: 'row', say: 'Attention\'s T by T scores can take gigabytes. They are kept because of softmax. One query\'s scores fill one row, and every weight is divided by the row\'s total, so no weight is known until the whole row has been read.', code: 's' },
        { id: 'big', say: 'And softmax is not computed quite as written. e grows fast: e to the hundred has forty four digits, and e to the thousand is too big for the computer at all: it comes out as infinity.', code: 'big' },
        { id: 'shift', say: 'The fix is a fact softmax already showed: only the gaps between scores matter. So subtract the largest score from every score. Call it m, for max.', code: 'm' },
        { id: 'small', say: 'Take the scores three, four and zero. m is four, so every score drops to zero or below, and every e is at most one: about {0.37|zero point three seven}, one, and {0.02|zero point zero two}.', code: 'e' },
        { id: 'sum', say: 'Their total is written {ℓ|l}, a curly l, for the sum: {1.39|one point three nine}. Each weight is its term over {ℓ|l}.', code: 'l' },
        { id: 'passes', say: 'Now count the passes, each a full read of the row: the first finds m, the second adds up {ℓ|l}, and the third divides. Three passes, so the row must be kept the whole time.', code: ['m', 'l', 'p'] },
      ],
    },
    {
      id: 'pass',
      title: 'Max and sum in one pass',
      codeTitle: 'online.py',
      code: `
        m, l = -np.inf, 0.0             #@init
        for s in [3, 4, 0]:             #@loop
            m_new = max(m, s)           #@max
            l = l * np.exp(m - m_new)   #@rescale
            l = l + np.exp(s - m_new)   #@add
            m = m_new                   #@max
        # m = 4, l = 1.39: as before    #@done
      `,
      beats: [
        { id: 'idea', say: 'In 2018, Maxim Milakov and Natalia Gimelshein, at NVIDIA, merged the first two passes. Read the scores once, keeping m as the largest so far, and {ℓ|l} as the sum so far, every term measured against that m.', code: ['init', 'loop'] },
        { id: 'first', say: 'First, three: the largest so far, so m is three. Its term, e to the zero, is exactly one: measured against m, the max always has a bar of one.', code: 'add' },
        { id: 'grow', say: 'Then four, a new max. The old bar was measured against three, and must now be measured against four, so it shrinks by e to the minus one: about {0.37|zero point three seven}.', code: ['max', 'rescale'] },
        { id: 'rule', say: 'That is the whole trick. When m grows, multiply {ℓ|l} by e to the old m minus the new m. Old minus new, so the factor is below one.', code: 'rescale' },
        { id: 'add', say: 'Then add the four\'s own bar, one. {ℓ|l} is {1.37|one point three seven}, and m is four.', code: 'add' },
        { id: 'below', say: 'Last, zero: below the max, so nothing shrinks. Just add its bar, e to the minus four, about {0.02|zero point zero two}. {ℓ|l} is {1.39|one point three nine}: the same total, from one pass.', code: ['add', 'done'] },
        { id: 'weight', say: 'Each weight is still its bar over {ℓ|l}. The four\'s bar is one, so its weight is one over {1.39|one point three nine}: about {0.72|zero point seven two}.', code: 'done' },
        { id: 'online', say: 'It is called online because it keeps up with the scores as they arrive, one at a time, never waiting for the rest.', code: 'loop' },
      ],
    },
    {
      id: 'tiles',
      title: 'Attention in tiles',
      codeTitle: 'flash.py',
      code: `
        m, l = -np.inf, 0.0                #@state
        o = np.zeros(d_v)  # running output #@state
        for K_t, V_t in tiles:             #@tiles
            s = K_t @ q / np.sqrt(d_k)     #@tiles
            m_new = max(m, max(s))         #@tiles
            c = np.exp(m - m_new)          #@out
            e = np.exp(s - m_new)          #@out
            l = l * c + sum(e)             #@out
            o = o * c + e @ V_t            #@out
            m = m_new
        out = o / l  # attention's output  #@divide
      `,
      beats: [
        { id: 'value', say: 'Attention needs only the weighted sum of the values, not the weights themselves. So keep that running too: an output, o, adding up each value times its bar.', code: 'state' },
        { id: 'shrink', say: 'When m grows, the bars already inside o were measured against the old max too, so o shrinks by the same factor as {ℓ|l}.', code: 'out' },
        { id: 'divide', say: 'After the last key, divide o by {ℓ|l}. Every weight\'s division happens at once, and the result is exactly attention\'s output.', code: 'divide' },
        { id: 'tile', say: 'In practice the keys come a few at a time, in tiles: a small block of the T by T grid, a few queries against a few keys. Like tiles on a floor, the blocks cover the grid, one at a time.', code: 'tiles' },
        { id: 'flash', say: 'In 2022, Tri Dao and colleagues at Stanford built attention this way and called it FlashAttention. Their paper\'s title says what it is: fast, memory-efficient, exact attention.', code: 'tiles' },
        { id: 'memory', say: 'However long the input, each query keeps just a max, a sum, and one output row of {dᵥ|d v} numbers. The T by T scores are never stored.', code: 'state' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
