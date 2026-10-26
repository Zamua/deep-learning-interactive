import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-rope',
  title: 'Rotary positions',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'turn',
      title: 'Turning a pair',
      codeTitle: 'rotate.py',
      code: `
        def rotate(pair, angle):                      #@fn
            t = np.radians(angle)                     #@fn
            c, s = np.cos(t), np.sin(t)               #@unit
            a, b = pair                               #@rule
            return np.array([a*c - b*s, a*s + b*c])   #@rule
        rotate([1, 0], 60)   # [0.5, 0.87]            #@basis
        rotate([0, 1], 60)   # [-0.87, 0.5]           #@basis
        q = np.array([2, 1])                          #@q
        rotate(q, 90)     # [-1, 2]                   #@ninety
        k = np.array([1, 1])                          #@sixty
        rotate(k, 60)     # [-0.37, 1.37]             #@sixty
      `,
      beats: [
        { id: 'pair', say: 'Draw a pair of numbers as an arrow from the origin. Here is a query, q: two, one.', code: 'q' },
        { id: 'turn', say: 'Rotating turns the arrow about the origin, keeping its length: a quarter turn, {90°|ninety degrees}, carries it to minus one, two.', code: 'ninety' },
        { id: 'unit', say: 'To turn any pair, start from an arrow of length one, pointing right, and turn it by the angle. Its tip lands at two numbers: across, the angle\'s cosine, written {cos|cos}, and up, its sine, written {sin|sine}.', code: ['fn', 'unit'] },
        { id: 'cossin', say: 'At {90°|ninety degrees} the arrow points straight up: cos is zero and sin is one. At {60°|sixty degrees} it lands one half across and about {0.87|zero point eight seven} up. Like e to a power, they are looked up, not worked out by hand.', code: 'unit' },
        { id: 'basis', say: 'So one, zero turns to cos, sin. And zero, one is one, zero already turned a quarter, so it lands a quarter turn past cos, sin. A quarter turn swaps the entries and flips the first sign, as two, one became minus one, two: minus sin, cos.', code: 'basis' },
        { id: 'rule', say: 'Any pair a, b is a times one, zero, plus b times zero, one. Turning moves both pieces, so it lands at a times cos, sin, plus b times minus sin, cos: {[a cos − b sin, a sin + b cos]|a cos minus b sin, and a sin plus b cos}.', code: 'rule' },
        { id: 'check', say: 'For {90°|ninety degrees}: two times zero minus one times one is minus one, and two times one plus one times zero is two.', code: ['rule', 'ninety'] },
        { id: 'sixty', say: 'At {60°|sixty degrees}, with cosine one half and sine about {0.87|zero point eight seven}, the key one, one turns to about minus {0.37|zero point three seven} and {1.37|one point three seven}.', code: 'sixty' },
      ],
    },
    {
      id: 'position',
      title: 'Turning by position',
      codeTitle: 'rope.py',
      code: `
        theta = 30           # degrees per position   #@theta
        rotate(q, 0 * theta) # position 0: no turn    #@zero
        rotate(q, 3 * theta) # position 3: 90°        #@three
        # d_k = 64: 32 pairs, each its own theta      #@pairs
        # fastest 57°, slowest under 0.01°            #@pairs
        e = rotate(q, m*theta) @ rotate(k, n*theta)   #@score
      `,
      beats: [
        { id: 'idea', say: 'Rotary positions mark where a token sits by turning each query and key, instead of adding a position vector.', code: 'theta' },
        { id: 'angle', say: 'Each pair turns by a fixed angle per position, written {θ|theta}, the Greek letter theta. At position m, it has turned by {mθ|m times theta}.', code: 'theta' },
        { id: 'example', say: 'With {θ|theta} of {30°|thirty degrees}, position zero is not turned, and position three turns by {90°|ninety}.', code: ['zero', 'three'] },
        { id: 'pairs', say: 'A query of {dₖ|d k} entries makes {dₖ|d k} over two pairs, each with its own {θ|theta}, some fast and some slow.', code: 'pairs' },
        { id: 'only', say: 'Nothing is learned or added to the token: only queries and keys turn, just before scoring.', code: 'score' },
      ],
    },
    {
      id: 'relative',
      title: 'Only the distance counts',
      codeTitle: 'relative.py',
      code: `
        q @ k                            # 3          #@dot
        rotate(q, 90) @ rotate(k, 90)    # 3          #@both
        # query at 5, key at 2: 5 and 2 times theta   #@apart
        # query at 9, key at 6: 4 theta more each     #@shift
        # the same score: 3 positions apart           #@shift
        # theta = 90: query at 1, key at 0            #@try
        rotate(q, 90)     # [-1, 2]                   #@tq
        rotate(q, 90) @ k     # -1 + 2 = 1            #@tdot
      `,
      beats: [
        { id: 'both', say: 'Turn a query and a key by the same angle, and they move together: their dot product stays the same.', code: 'both' },
        { id: 'numbers', say: 'Two, one dotted with one, one is three. Turned {90°|ninety degrees} each, they still give three.', code: ['dot', 'both'] },
        { id: 'apart', say: 'Now a query at position five turns by {5θ|five theta}, and a key at position two by {2θ|two theta}.', code: 'apart' },
        { id: 'shift', say: 'Move both four places later, to nine and six. Each turns {4θ|four theta} more, together, so the score stays the same.', code: 'shift' },
        { id: 'distance', say: 'So the score depends only on how far apart the tokens are, and which comes first.', code: ['apart', 'shift'] },
        { id: 'try', say: 'Try one, with {θ|theta} of {90°|ninety degrees}: the query two, one at position one, and the key one, one at position zero.', code: 'try' },
        { id: 'tq', say: 'The query turns by one times {90°|ninety degrees}: two times zero minus one times one is minus one, and two times one plus one times zero is two. The key, at position zero, does not turn.', code: 'tq' },
        { id: 'tdot', say: 'Dot them: minus one times one, plus two times one. The score is one, where the unturned pair gave three.', code: 'tdot' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
