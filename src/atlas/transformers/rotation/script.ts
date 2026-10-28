import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-rotation',
  title: 'Rotating a pair',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Gunter', year: 1620, title: 'Canon triangulorum, sive tabulae sinuum et tangentium artificialium', url: 'https://locomat.loria.fr/gunter1620/gunter1620doc.pdf', scene: 'unit' },
  ],
  scenes: [
    {
      id: 'turn',
      title: 'Turning an arrow',
      codeTitle: 'turn.py',
      code: `
        q = np.array([2, 1])  # a query pair  #@q
        k = np.array([1, 1])  # a key pair    #@k
        q @ k    # 2 + 1 = 3: their score     #@score
        # turn k: the score changes,          #@spin
        # but its length does not             #@len
        # quarter turn: [2, 1] -> [-1, 2]     #@quarter
        # [a, b] -> [-b, a]                   #@swap
      `,
      beats: [
        { id: 'pair', say: 'Take two entries of a query, a pair: two and one. Drawn from the origin, the pair is an arrow, q.', code: 'q' },
        { id: 'key', say: 'Two entries of a key, one and one, make a second arrow, k. Their dot product, two plus one, is three: their score, how well they match.', code: ['k', 'score'] },
        { id: 'spin', say: 'Now turn k about the origin. The score changes as it goes: highest when k points along q, zero at a right angle, and negative when it points away.', code: 'spin' },
        { id: 'length', say: 'Yet k never grows or shrinks. Its length, its norm, stays the same, so its tip runs round a circle. Only its direction changes.', code: 'len' },
        { id: 'name', say: 'That is a rotation, from rota, the Latin for a wheel: the tip goes round like a point on a turning rim.', code: 'len' },
        { id: 'quarter', say: 'So where does a turned arrow land? Start with a quarter turn, {90°|ninety degrees}. Angles turn counterclockwise, against a clock\'s hands: from across toward up.', code: 'quarter' },
        { id: 'path', say: 'Think of q as a path: two steps across, then one step up.', code: 'q' },
        { id: 'steps', say: 'Turn the whole path a quarter turn. The two steps across now point up, and the one step up now points left. So q lands at minus one, two.', code: 'quarter' },
        { id: 'swap', say: 'For any pair {a|A}, b, a quarter turn swaps the entries, then flips the sign of the new first one: minus b, {a|A}.', code: 'swap' },
      ],
    },
    {
      id: 'unit',
      title: 'Any angle: cos and sin',
      codeTitle: 'unit.py',
      code: `
        # [1, 0] turned: [across, up]         #@one
        # across: the cosine                  #@cos
        cos = {30: 0.87, 60: 0.5, 90: 0}      #@cos
        # up: the sine                        #@sin
        sin = {30: 0.5, 60: 0.87, 90: 1}      #@sin
        cos[60] == sin[30]   # True           #@co
      `,
      beats: [
        { id: 'one', say: 'Other angles need a little more. Start from the simplest arrow: length one, pointing straight across, at one, zero.', code: 'one' },
        { id: 'tip', say: 'Turn it by an angle, say {60°|sixty degrees}. Its tip stays on the circle of radius one, and lands partway up.', code: 'one' },
        { id: 'cos', say: 'How far across it lands is the angle\'s cosine, written cos. Here, one half.', code: 'cos' },
        { id: 'sin', say: 'How far up is its sine, written {sin|s i n}: about {0.87|zero point eight seven}.', code: 'sin' },
        { id: 'ninety', say: 'Turn it all the way to {90°|ninety degrees}, and it points straight up: cos is zero, and {sin|sine} is one.', code: ['cos', 'sin'] },
        { id: 'gunter', say: 'The name cosine ties the two together. In {1620|sixteen twenty}, in a book of tables for angles, Edmund Gunter wrote of the sine of the complement, which for short he called the cosine.', code: 'co' },
        { id: 'complement', say: 'The complement is what an angle lacks of a right angle: here, {30°|thirty degrees}. Measured from straight up, the arrow is that far over, so its across part, one half, is the sine of {30°|thirty degrees}.', code: 'co' },
        { id: 'lookup', say: 'Like e to a power, cosines and sines are looked up, in a table or on a calculator, not worked out by hand.', code: ['cos', 'sin'] },
      ],
    },
    {
      id: 'rule',
      title: 'Any pair, any angle',
      codeTitle: 'rotate.py',
      code: `
        # [a, b] = a*[1, 0] + b*[0, 1]        #@split
        # [1, 0] -> [cos, sin]                #@one
        # [0, 1] -> [-sin, cos]               #@up
        def rotate(pair, angle):              #@rule
            a, b = pair                       #@rule
            c, s = cos[angle], sin[angle]     #@rule
            return [a*c - b*s, a*s + b*c]     #@rule
      `,
      beats: [
        { id: 'split', say: 'Now any pair, {a|A} and b. Like q\'s path, it is {a|A} steps along one, zero, then b steps along zero, one.', code: 'split' },
        { id: 'both', say: 'Turn the path by an angle, and both kinds of step turn with it. One, zero lands at cos, {sin|sine}.', code: 'one' },
        { id: 'up', say: 'Zero, one starts a quarter turn further round, so it lands a quarter turn past cos, {sin|sine}. A quarter turn swaps and flips the first sign: minus {sin|sine}, cos.', code: 'up' },
        { id: 'rule', say: 'So {a|A}, b lands at {a|A} times cos, {sin|sine}, plus b times minus {sin|sine}, cos. Entry by entry: {[a cos − b sin, a sin + b cos]|A cos minus b sine, then A sine plus b cos}.', code: 'rule' },
        { id: 'check', say: 'At {90°|ninety degrees}, cos is zero and {sin|sine} is one, so the rule gives minus b, {a|A}: the quarter turn again.', code: 'rule' },
      ],
    },
    {
      id: 'try',
      title: 'A turn, worked',
      codeTitle: 'try.py',
      code: `
        k = np.array([1, 1])  # the key pair  #@p
        cos[60], sin[60]      # 0.5, 0.87     #@p
        1*0.5 - 1*0.87        # -0.37         #@first
        1*0.87 + 1*0.5        # 1.37          #@second
        rotate(k, 60)    # [-0.37, 1.37]      #@done
      `,
      beats: [
        { id: 'p', say: 'Back to the key, one, one. Where does a {60°|sixty degree} turn take it? cos {60°|sixty degrees} is one half, and {sin|sine} {60°|sixty degrees} is about {0.87|zero point eight seven}.', code: 'p' },
        { id: 'first', say: 'The first entry is {a cos − b sin|A cos minus b sine}: one times one half, minus one times {0.87|zero point eight seven}. About minus {0.37|zero point three seven}.', code: 'first' },
        { id: 'second', say: 'The second is {a sin + b cos|A sine plus b cos}: one times {0.87|zero point eight seven}, plus one times one half. About {1.37|one point three seven}.', code: 'second' },
        { id: 'done', say: 'So k turns to minus {0.37|zero point three seven}, {1.37|one point three seven}: a sixth of a full turn further round, and just as long as before.', code: 'done' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
