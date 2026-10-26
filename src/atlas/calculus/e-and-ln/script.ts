import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-e-and-ln',
  title: 'e and ln',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'exp',
      title: 'Each step multiplies by e',
      codeTitle: 'exp.py',
      code: `
        np.exp(1)    # 2.718    #@one
        np.exp(0)    # 1.0      #@zero
        np.exp(2)    # 7.389    #@two
        np.exp(3)    # 20.09    #@two
        np.exp(-1)   # 0.368    #@neg
        np.exp(2) * np.exp(1)   #@add
        # = np.exp(3)           #@add
        np.exp(3) / np.exp(1)   #@div
        # = np.exp(2)           #@div
        np.exp(2) ** 3          #@pow
        # = np.exp(6)           #@pow
      `,
      beats: [
        { id: 'e', say: 'The number e is about {2.718|two point seven one eight}, written {e ≈ 2.718|e is about two point seven one eight}: the wavy equals sign means “is about”. {eˣ|e to the x} means e multiplied by itself, x times.', code: 'one' },
        { id: 'zero', say: 'e to the zero is one. Each step of one in x multiplies by e again: {2.72|two point seven two}, {7.39|seven point three nine}, then about twenty.', code: ['zero', 'one', 'two'] },
        { id: 'neg', say: 'A step down divides by e instead: e to the minus one is {0.37|zero point three seven}. Smaller, but never negative. e to any power is positive.', code: 'neg' },
        { id: 'add', say: 'So adding powers multiplies results. {e² · e¹ = e³|e squared times e to the one is e cubed}, where the raised dot means times: the powers add, two plus one.', code: 'add' },
        { id: 'div', say: 'Dividing takes factors of e away. {e³ / e¹|e cubed over e to the one} is {e²|e squared}: {20.09|twenty point oh nine} divided by {2.72|two point seven two} is {7.39|seven point three nine}. The powers subtract, three minus one.', code: 'div' },
        { id: 'pow', say: 'And {(e²)³|e squared, cubed} is e squared times itself three times. The powers add, two plus two plus two, which is three times two: {e⁶|e to the six}. A power of a power multiplies.', code: 'pow' },
      ],
    },
    {
      id: 'log',
      title: 'ln runs it backwards',
      codeTitle: 'log.py',
      code: `
        np.log(7.389)       # 2.0    #@two
        np.log(1)           # 0.0    #@one
        np.log(0.368)       # -1.0   #@neg
        -np.log(0.368)      # 1.0    #@neg
        np.log(np.exp(5))   # 5.0    #@undo
        np.exp(np.log(5))   # 5.0    #@undo
        np.log(np.exp(4) * np.exp(-1))   #@try
        np.log(np.exp(4 + -1))  # 3.0    #@solve
      `,
      beats: [
        { id: 'ask', say: 'The natural log, ln, runs this backwards. For a positive number y, {ln y|ln of y} asks: e to what power gives y?' },
        { id: 'two', say: 'e squared is {7.39|seven point three nine}, so ln of {7.39|seven point three nine} is two.', code: 'two' },
        { id: 'one', say: 'e to the zero is one, so ln of one is zero.', code: 'one' },
        { id: 'neg', say: 'Below one, the log is negative: ln of {0.37|zero point three seven} is minus one. Any number between zero and one has a negative log, so with a minus sign in front it turns positive: {−ln 0.37 = 1|minus ln of zero point three seven is one}.', code: 'neg' },
        { id: 'undo', say: 'ln and e to the x undo each other. For any number a, {ln(eᵃ) = a|ln of e to the a is a}, and for a positive a, {eˡⁿ ᵃ = a|e to the ln of a is a}.', code: 'undo' },
        { id: 'try', say: 'Try one: what is {ln(e⁴ · e⁻¹)|ln of e to the four times e to the minus one}?', code: 'try' },
        { id: 'solve', say: 'Multiplying adds the powers: four plus minus one is three, so the product is {e³|e cubed}. And ln undoes e to a power, leaving three.', code: 'solve' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
