import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-rotation',
  title: 'Rotating a pair',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'turn',
      title: 'Turning a pair',
      codeTitle: 'rotate.py',
      code: `
        q = np.array([2, 1])                          #@q
        # a quarter turn: [-1, 2]                     #@ninety
        def rotate(pair, angle):                      #@fn
            t = np.radians(angle)                     #@fn
            c, s = np.cos(t), np.sin(t)               #@unit
      `,
      beats: [
        { id: 'pair', say: 'Take two entries of a query, a pair: two, one. Draw it as an arrow from the origin.', code: 'q' },
        { id: 'turn', say: 'Rotating turns the arrow about the origin, keeping its length: a quarter turn, {90°|ninety degrees}, carries it to minus one, two.', code: 'ninety' },
        { id: 'unit', say: 'To turn any pair, start from an arrow of length one, pointing right, and turn it by the angle. Its tip lands at two numbers: across, the angle\'s cosine, written {cos|cos}, and up, its sine, written {sin|sine}.', code: ['fn', 'unit'] },
        { id: 'cossin', say: 'At {90°|ninety degrees} the arrow points straight up: cos is zero and sin is one. At {60°|sixty degrees} it lands one half across and about {0.87|zero point eight seven} up. Like e to a power, they are looked up, not worked out by hand.', code: 'unit' },
      ],
    },
    {
      id: 'rule',
      title: 'The rule',
      codeTitle: 'rotate.py',
      code: `
        def rotate(pair, angle):                      #@fn
            t = np.radians(angle)                     #@fn
            c, s = np.cos(t), np.sin(t)               #@fn
            a, b = pair                               #@rule
            return np.array([a*c - b*s, a*s + b*c])   #@rule
        rotate([1, 0], 60)   # [0.5, 0.87]            #@basis
        rotate([0, 1], 60)   # [-0.87, 0.5]           #@basis
        rotate(np.array([2, 1]), 90)   # [-1, 2]      #@check
      `,
      beats: [
        { id: 'basis', say: 'So one, zero turns to cos, sin. And zero, one is one, zero already turned a quarter, so it lands a quarter turn past cos, sin. A quarter turn swaps the entries and flips the first sign, as two, one became minus one, two: minus sin, cos.', code: 'basis' },
        { id: 'rule', say: 'Any pair a, b is a times one, zero, plus b times zero, one. Turning moves both pieces, so it lands at a times cos, sin, plus b times minus sin, cos: {[a cos − b sin, a sin + b cos]|a cos minus b sin, and a sin plus b cos}.', code: 'rule' },
        { id: 'check', say: 'For {90°|ninety degrees}: two times zero minus one times one is minus one, and two times one plus one times zero is two.', code: ['rule', 'check'] },
      ],
    },
    {
      id: 'try',
      title: 'A turn, worked',
      codeTitle: 'try.py',
      code: `
        k = np.array([1, 1])        # one pair of a key  #@p
        c, s = 0.5, 0.87            # 60 degrees         #@p
        1 * c - 1 * s               # -0.37              #@first
        1 * s + 1 * c               # 1.37               #@second
        rotate(k, 60)               # [-0.37, 1.37]      #@done
      `,
      beats: [
        { id: 'p', say: 'Try one. One pair of a key is one, one. What is it after a {60°|sixty degree} rotation? Use cos {60°|sixty degrees} is one half, and sin {60°|sixty degrees} about {0.87|zero point eight seven}.', code: 'p' },
        { id: 'first', say: 'The first entry is a cos minus b sin: one times one half, minus one times {0.87|zero point eight seven}. About minus {0.37|zero point three seven}.', code: 'first' },
        { id: 'second', say: 'The second is a sin plus b cos: one times {0.87|zero point eight seven}, plus one times one half. About {1.37|one point three seven}.', code: 'second' },
        { id: 'done', say: 'So the pair turns to minus {0.37|zero point three seven}, {1.37|one point three seven}: the same length, pointing a sixth of a turn further round.', code: 'done' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
