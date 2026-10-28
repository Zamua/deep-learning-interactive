import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-dot-product',
  title: 'Dot product',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Gibbs', year: 1881, title: 'Elements of Vector Analysis, arranged for the use of students in physics', url: 'https://archive.org/details/elementsvectora00gibb', scene: 'agree' },
  ],
  scenes: [
    {
      id: 'agree',
      title: 'Do they agree?',
      codeTitle: 'agree.py',
      code: `
        w = np.array([2, 1])     #@w
        x = np.array([3, 1])     #@x
        2 * 3    # across: 6     #@across
        1 * 1    # up: 1         #@up
        6 + 1    # 7: the dot product  #@sum
        x = np.array([-1, 2])    #@perp
        # -2 + 2 = 0: at 90°     #@perp
        x = np.array([-2, -1])   #@opp
        # -4 - 1 = -5: apart     #@opp
      `,
      beats: [
        { id: 'question', say: 'Two arrows leave the origin, the corner where both numbers are zero. Do they point the same way, or apart? We want one number that says how much they agree.', code: ['w', 'x'] },
        { id: 'w', say: 'Call the first arrow w. It goes two across and one up, so w holds the numbers two and one.', code: 'w' },
        { id: 'x', say: 'The second, x, goes three across and one up: almost the same direction.', code: 'x' },
        { id: 'across', say: 'Compare them one direction at a time. Across, both go right, so multiply their across parts: two times three, six. Positive: they agree along that direction.', code: 'across' },
        { id: 'up', say: 'Up, both go up: one times one, one. They agree there too.', code: 'up' },
        { id: 'sum', say: 'Add up the agreement: six plus one, seven. That sum is the dot product.', code: 'sum' },
        { id: 'gibbs', say: 'In {1881|eighteen eighty one}, Josiah Willard Gibbs, who taught physics at Yale, printed notes on vectors for his students. He defined this product from the arrows, by their lengths and the angle between them, and showed it comes out as exactly this sum.', code: 'sum' },
        { id: 'dot', say: 'He wrote it with a dot between the two letters, {w · x|w dot x}, and that dot gave the dot product its name.', code: 'sum' },
        { id: 'perp', say: 'Now turn x to minus one, two. Across, x goes left while w goes right, so they disagree: minus two.', code: 'perp' },
        { id: 'cancel', say: 'Up, both go up: plus two. They cancel out, and {w · x|w dot x} is zero.', code: 'perp' },
        { id: 'right', say: 'These two arrows meet at a right angle, ninety degrees. Arrows at a right angle are called perpendicular, and their dot product is always zero.', code: 'perp' },
        { id: 'opp', say: 'Turn x further, to minus two, minus one, pointing away from w. Now both directions disagree, and the products, minus four and minus one, make minus five.', code: 'opp' },
        { id: 'sign', say: 'So the sign says how they agree: positive when the angle between them is less than ninety degrees, zero at exactly ninety, and negative when it is more.', code: ['sum', 'perp', 'opp'] },
      ],
    },
    {
      id: 'multiply',
      title: 'Any number of entries',
      codeTitle: 'dot.py',
      code: `
        w = np.array([2, -1, 3])   #@w
        x = np.array([1, 4, 2])    #@x
        w * x     # [2, -4, 6]     #@mul
        np.dot(w, x)   # 4         #@dot
        w @ x          # 4         #@at
        sum(w * x)     # 4: the Σ  #@sum
      `,
      beats: [
        { id: 'more', say: 'The recipe never needed the picture. Give w and x three entries each, and pair them up the same way: first with first, second with second, third with third.', code: ['w', 'x'] },
        { id: 'mult', say: 'Multiply each matching pair, and the three products land below.', code: 'mul' },
        { id: 'add', say: 'Add them up: two, minus four and six make four. So {w · x|w dot x} is four.', code: 'mul' },
        { id: 'code', say: 'In code, that is {np.dot(w, x)|NumPy\'s dot, of w and x}, or in short, {w @ x|w at x}.', code: ['dot', 'at'] },
        { id: 'sigma', say: 'Math writes the adding with a big {Σ|sigma}, the Greek capital S, for sum. It means: add up what follows, once for every position.', code: 'sum' },
        { id: 'wi', say: 'What follows is {wᵢ xᵢ|w sub i, times x sub i}. Here i is a position, and {wᵢ|w sub i} is the entry of w at that position, the same as {w[i]|w of i} in code. So each term is one matching pair, multiplied.', code: ['mul', 'sum'] },
        { id: 'weigh', say: 'Read w as weights. Each entry of x counts as much as its weight says, and a negative weight, like the minus one here, makes its entry count against the total.', code: 'mul' },
      ],
    },
    {
      id: 'solve',
      title: 'Find a missing entry',
      codeTitle: 'missing.py',
      code: `
        w = np.array([2, 1, 3])      #@p1
        # x = [1, a, 2], w @ x = 10  #@p1
        # 2*1 + 3*2 = 8              #@known
        # 1*a = 10 - 8, so a = 2     #@a1
        w = np.array([3, 2, 1])      #@p2
        # x = [1, a, 4], w @ x = 13  #@p2
        # 3*1 + 1*4 = 7              #@k2
        # 2*a = 13 - 7 = 6           #@rest
        # a = 6 / 2 = 3              #@a2
      `,
      beats: [
        { id: 'p1', say: 'The dot product also runs backwards. w is two, one, three, and x is one, {a|A}, two, where {a|A} stands for an entry nobody told you. {w · x|w dot x} is ten. What is {a|A}?', code: 'p1' },
        { id: 'known', say: 'The pairs you know give two and six: eight.', code: 'known' },
        { id: 'a1', say: 'So the middle pair, one times {a|A}, makes up the rest: ten minus eight, two. {a|A} is two.', code: 'a1' },
        { id: 'p2', say: 'Now w is three, two, one, x is one, {a|A}, four, and {w · x|w dot x} is thirteen.', code: 'p2' },
        { id: 'k2', say: 'The pairs you know give three and four: seven.', code: 'k2' },
        { id: 'rest', say: 'So two times {a|A} makes up the rest: thirteen minus seven, six.', code: 'rest' },
        { id: 'a2', say: 'Divide by the weight, two: {a|A} is three.', code: 'a2' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
