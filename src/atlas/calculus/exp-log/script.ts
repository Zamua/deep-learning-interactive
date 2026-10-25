import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-exp-log',
  title: 'Exp and log',
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
      `,
      beats: [
        { id: 'e', say: 'The number e is about {2.718|two point seven one eight}, written {e ≈ 2.718|e is about two point seven one eight}: the wavy equals sign means “is about”. {eˣ|e to the x} means e multiplied by itself, x times.', code: 'one' },
        { id: 'zero', say: 'e to the zero is one. Each step of one in x multiplies by e again: {2.72|two point seven two}, {7.39|seven point three nine}, then about twenty.', code: ['zero', 'one', 'two'] },
        { id: 'neg', say: 'A step down divides by e instead: e to the minus one is {0.37|zero point three seven}. Smaller, but never negative. e to any power is positive.', code: 'neg' },
        { id: 'add', say: 'So adding powers multiplies results. {e² · e¹ = e³|e squared times e to the one is e cubed}, where the raised dot means times: the powers add, two plus one.', code: 'add' },
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
        np.log(np.exp(5))   # 5.0    #@undo
        np.exp(np.log(5))   # 5.0    #@undo
      `,
      beats: [
        { id: 'ask', say: 'The natural log, ln, runs this backwards. For a positive number y, {ln y|ln of y} asks: e to what power gives y?' },
        { id: 'two', say: 'e squared is {7.39|seven point three nine}, so ln of {7.39|seven point three nine} is two.', code: 'two' },
        { id: 'one', say: 'e to the zero is one, so ln of one is zero.', code: 'one' },
        { id: 'neg', say: 'Below one, the log is negative: ln of {0.37|zero point three seven} is minus one. Any number between zero and one has a negative log.', code: 'neg' },
        { id: 'undo', say: 'ln and e to the x undo each other. For any number a, {ln(eᵃ) = a|ln of e to the a is a}, and for a positive a, {eˡⁿ ᵃ = a|e to the ln of a is a}.', code: 'undo' },
      ],
    },
    {
      id: 'rules',
      title: 'Products become sums',
      codeTitle: 'rules.py',
      code: `
        np.log(2)       # 0.69    #@a
        np.log(3)       # 1.10    #@b
        np.log(2 * 3)   # 1.79    #@ab
        np.log(0.5)     # -0.69   #@flip
        -np.log(0.5)    # 0.69    #@flip
        -np.log(0.1)    # 2.30    #@small
      `,
      beats: [
        { id: 'why', say: 'Because powers add when exponentials multiply, ln turns a product into a sum. For positive numbers a and b, {ln(ab) = ln a + ln b|ln of a times b is ln a plus ln b}.', code: 'ab' },
        { id: 'nums', say: 'ln two is about {0.69|zero point six nine} and ln three about {1.10|one point one}, so ln six is their sum, {1.79|one point seven nine}.', code: ['a', 'b', 'ab'] },
        { id: 'flip', say: 'One over a number flips the sign of its log: ln of a half is minus ln two, about minus {0.69|zero point six nine}. So minus ln of a half is plus {0.69|zero point six nine}.', code: 'flip' },
        { id: 'small', say: 'The smaller a number p, the bigger {−ln p|minus ln p}: minus ln of a tenth is about {2.3|two point three}.', code: 'small' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
