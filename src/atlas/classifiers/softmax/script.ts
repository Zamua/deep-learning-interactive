import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-softmax',
  title: 'Softmax',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'scores',
      title: 'Scores are not probabilities',
      codeTitle: 'softmax.py',
      code: `
        s = np.array([2, 1, -1])   #@s
        e = np.exp(s)              #@exp
        # [7.39, 2.72, 0.37]       #@exp
        p = e / e.sum()            #@norm
        # [0.71, 0.26, 0.04]       #@norm
        p.sum()    # 1.0           #@sum
      `,
      beats: [
        { id: 'scores', say: 'Here are three scores, one for each of three options: two, one, and minus one.', code: 's' },
        { id: 'want', say: 'Often we want probabilities instead. Every one positive, and all of them adding up to one.' },
        { id: 'fail', say: 'These scores fail both tests. Minus one is negative, and together they add up to two.', code: 's' },
      ],
    },
    {
      id: 'exp',
      title: 'Move one: exponentiate',
      codeTitle: 'softmax.py',
      code: `
        s = np.array([2, 1, -1])   #@s
        e = np.exp(s)              #@exp
        # [7.39, 2.72, 0.37]       #@exp
        p = e / e.sum()            #@norm
        # [0.71, 0.26, 0.04]       #@norm
        p.sum()    # 1.0           #@sum
      `,
      beats: [
        { id: 'two', say: 'Softmax fixes both in two moves.' },
        { id: 'exp', say: 'First, raise e, about {2.718|two point seven one eight}, to the power of each score.', code: 'exp' },
        { id: 'pos', say: 'e to any power is positive, so minus one becomes {0.37|zero point three seven}.', code: 'exp' },
        { id: 'grow', say: 'And each extra point of score multiplies by about {2.7|two point seven}, so the top score pulls ahead: two becomes {7.39|seven point three nine}.', code: 'exp' },
      ],
    },
    {
      id: 'divide',
      title: 'Move two: divide by the total',
      codeTitle: 'softmax.py',
      code: `
        s = np.array([2, 1, -1])   #@s
        e = np.exp(s)              #@exp
        # [7.39, 2.72, 0.37]       #@exp
        p = e / e.sum()            #@norm
        # [0.71, 0.26, 0.04]       #@norm
        p.sum()    # 1.0           #@sum
      `,
      beats: [
        { id: 'total', say: 'Second, add them up. The total is {10.48|ten point four eight}.', code: 'norm' },
        { id: 'divide', say: 'Then divide each one by that total.', code: 'norm' },
        { id: 'result', say: 'Option zero gets {0.71|zero point seven one}, option one {0.26|zero point two six}, and option two {0.04|zero point zero four}.', code: 'norm' },
        { id: 'check', say: 'All positive, and they add up to one.', code: 'sum' },
        { id: 'formula', say: 'In symbols: {pₖ is e to the sₖ, divided by the sum of e to the sⱼ|p k is e to the s k, divided by the sum of e to the s j}, over every option j.', code: ['exp', 'norm'] },
      ],
    },
    {
      id: 'gaps',
      title: 'Only the gaps matter',
      codeTitle: 'gaps.py',
      code: `
        softmax(s)        # [0.71, 0.26, 0.04]   #@base
        softmax(s + 5)    # [0.71, 0.26, 0.04]   #@shift
        softmax(2 * s)    # [0.88, 0.12, 0.00]   #@scale
      `,
      beats: [
        { id: 'shift', say: 'Add five to every score. Every exponential gets multiplied by the same factor, and that factor cancels when we divide. Nothing changes.', code: ['base', 'shift'] },
        { id: 'scale', say: 'Double every score instead, and the gaps between them double. The top option grows to {0.88|zero point eight eight}.', code: ['base', 'scale'] },
        { id: 'soft', say: 'That is the name: a soft maximum. The top score gets most of the probability, but every option keeps a little.', code: 'scale' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
