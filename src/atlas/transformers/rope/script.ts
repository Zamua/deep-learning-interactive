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
            R = np.array([[np.cos(t), -np.sin(t)],    #@R
                          [np.sin(t),  np.cos(t)]])   #@R
            return R @ pair                           #@R
        q = np.array([2, 1])                          #@q
        rotate(q, 90)     # [-1, 2]                   #@ninety
        k = np.array([1, 1])                          #@sixty
        rotate(k, 60)     # [-0.37, 1.37]             #@sixty
      `,
      beats: [
        { id: 'pair', say: 'Draw a pair of numbers as an arrow from the origin. Here is a query, q: two, one.', code: 'q' },
        { id: 'turn', say: 'Rotating turns the arrow about the origin, keeping its length: a quarter turn, {90°|ninety degrees}, carries it to minus one, two.', code: 'ninety' },
        { id: 'cossin', say: 'Each angle comes with two numbers, its cosine and its sine, written {cos|cos, for cosine,} and {sin|sine}. They are looked up like e to a power: zero and one for {90°|ninety degrees}.', code: 'fn' },
        { id: 'rule', say: 'Then {[a, b]|a, b} turns to {[a cos − b sin, a sin + b cos]|a cos minus b sin, and a sin plus b cos}: a matrix times the pair.', code: 'R' },
        { id: 'check', say: 'For {90°|ninety degrees}: two times zero minus one times one is minus one, and two times one plus one times zero is two.', code: ['R', 'ninety'] },
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
      `,
      beats: [
        { id: 'both', say: 'Turn a query and a key by the same angle, and they move together: their dot product stays the same.', code: 'both' },
        { id: 'numbers', say: 'Two, one dotted with one, one is three. Turned {90°|ninety degrees} each, they still give three.', code: ['dot', 'both'] },
        { id: 'apart', say: 'Now a query at position five turns by {5θ|five theta}, and a key at position two by {2θ|two theta}.', code: 'apart' },
        { id: 'shift', say: 'Move both four places later, to nine and six. Each turns {4θ|four theta} more, together, so the score stays the same.', code: 'shift' },
        { id: 'distance', say: 'So the score depends only on how far apart the tokens are, and which comes first.', code: ['apart', 'shift'] },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
