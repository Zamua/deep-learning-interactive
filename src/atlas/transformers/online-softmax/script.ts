import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-online-softmax',
  title: 'Softmax in one pass',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'max',
      title: 'Subtract the largest score',
      codeTitle: 'softmax.py',
      code: `
        s = np.array([3, 4, 0])                #@s
        m = max(s)          # 4                #@m
        e = np.exp(s - m)   # [0.37, 1, 0.02]  #@e
        l = sum(e)          # 1.39             #@l
        p = e / l           # [0.27, 0.72, 0.01]   #@p
      `,
      beats: [
        { id: 'scores', say: 'Softmax on the scores three, four and zero: exponentiate each, then divide by the total.', code: 's' },
        { id: 'shift', say: 'Subtracting the same amount from every score changes nothing, so subtract the largest, four. The scores become minus one, zero and minus four.', code: 'm' },
        { id: 'small', say: 'Now no exponential is above one: about {0.37|zero point three seven}, one, and {0.02|zero point zero two}, adding up to {1.39|one point three nine}.', code: ['e', 'l'] },
        { id: 'catch', say: 'But that takes two passes, with every score kept in between: for attention, the T by T matrix.', code: ['m', 'l'] },
      ],
    },
    {
      id: 'pass',
      title: 'One pass',
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
        { id: 'two', say: 'Instead, read the scores once, keeping the largest so far, m, and the running sum, l, of e to the s minus m.', code: ['init', 'loop'] },
        { id: 'first', say: 'First, three: m is three, and l is e to the zero, one.', code: 'add' },
        { id: 'grow', say: 'Then four, a new max. The term in l was measured against three, so multiply l by e to the three minus four: about {0.37|zero point three seven}.', code: ['max', 'rescale'] },
        { id: 'add', say: 'Then add e to the zero for the four itself. l is {1.37|one point three seven}, and m is four.', code: 'add' },
        { id: 'below', say: 'Last, zero, below the max: no rescale, just add e to the minus four, about {0.02|zero point zero two}. l is {1.39|one point three nine}, the same total as before.', code: ['add', 'done'] },
        { id: 'weights', say: 'Each weight is then e to the s minus m, over l: the four gets one over {1.39|one point three nine}, about {0.72|zero point seven two}.', code: 'done' },
      ],
    },
    {
      id: 'tiles',
      title: 'Attention in tiles',
      codeTitle: 'flash.py',
      code: `
        m, l, o = -np.inf, 0.0, np.zeros(d_v)    #@state
        for K_t, V_t in tiles:  # a few keys each #@tiles
            s = K_t @ q / np.sqrt(d_k)            #@tiles
            m_new = max(m, max(s))                #@tiles
            c = np.exp(m - m_new)  # rescale      #@out
            l = l * c + sum(np.exp(s - m_new))    #@out
            o = o * c + np.exp(s - m_new) @ V_t   #@out
            m = m_new
        out = o / l     # attention's output      #@divide
      `,
      beats: [
        { id: 'tiles', say: 'This is how FlashAttention runs attention. Each query reads the keys a tile at a time, and the T by T scores are never stored.', code: 'tiles' },
        { id: 'output', say: 'Besides m and l, the query keeps a running output: the values weighted by e to the s minus m. When m grows, it is rescaled by the same factor as l.', code: 'out' },
        { id: 'divide', say: 'After the last tile, divide the output by l. That is exactly attention\'s output.', code: 'divide' },
        { id: 'memory', say: 'However long the input, each query holds just a max, a sum and one output row.', code: 'state' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
