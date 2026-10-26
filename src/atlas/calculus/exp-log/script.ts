import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-exp-log',
  title: 'Log rules',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'rules',
      title: 'Products become sums',
      codeTitle: 'rules.py',
      code: `
        np.log(np.exp(2) * np.exp(3))  # 5.0  #@why
        np.log(2)        # 0.69    #@a
        np.log(3)        # 1.10    #@b
        np.log(2 * 3)    # 1.79    #@ab
        np.log(3 * 3)    # 2.20    #@nine
        2 * np.log(3)    # 2.20    #@nine
      `,
      beats: [
        { id: 'why', say: 'Since powers add when exponentials multiply, ln turns a product into a sum. {e² · e³|e squared times e cubed} is {e⁵|e to the five}, so its ln is five: two plus three, the ln of each factor, added.', code: 'why' },
        { id: 'rule', say: 'The same holds for any positive numbers a and b: {ln(ab) = ln a + ln b|ln of a times b is ln a plus ln b}.', code: 'why' },
        { id: 'nums', say: 'ln two is about {0.69|zero point six nine} and ln three about {1.10|one point one}, so ln six is their sum, {1.79|one point seven nine}.', code: ['a', 'b', 'ab'] },
        { id: 'nine', say: 'A power is a product of equal factors. Nine is three times three, so ln nine is ln three plus ln three: two ln three, about {2.20|two point two}.', code: 'nine' },
        { id: 'power', say: 'So for any power k, {ln aᵏ = k ln a|ln of a to the k is k times ln a}: the power comes out in front.', code: 'nine' },
      ],
    },
    {
      id: 'quot',
      title: 'Quotients become differences',
      codeTitle: 'quot.py',
      code: `
        np.log(2) + np.log(0.5)   # 0.0    #@flip
        np.log(0.5)               # -0.69  #@flip
        np.log(3 / 2)             # 0.41   #@quot
        np.log(3) - np.log(2)     # 0.41   #@quot
        -np.log(0.5)              # 0.69   #@small
        -np.log(0.9)              # 0.11   #@small
        p = 1 / 10                         #@try
        np.log(2) + np.log(5)     # 2.30   #@solve
        -np.log(p)                # 2.30   #@solve
      `,
      beats: [
        { id: 'flip', say: 'Two times a half is one, and ln one is zero. So ln two plus ln a half is zero: ln of a half is minus ln two, about minus {0.69|zero point six nine}. One over a number flips the sign of its log.', code: 'flip' },
        { id: 'quot', say: 'Dividing by two is multiplying by a half. So ln of three halves is ln three plus ln a half, which is ln three minus ln two: about {1.10|one point one} minus {0.69|zero point six nine}, {0.41|zero point four one}.', code: 'quot' },
        { id: 'diff', say: 'The log of a quotient is the difference of the logs: {ln(a/b) = ln a − ln b|ln of a over b is ln a minus ln b}.', code: 'quot' },
        { id: 'small', say: 'So minus the log of a number below one is positive: minus ln of a half is {0.69|zero point six nine}. The bigger a number p, the smaller {−ln p|minus ln p}: minus ln of {0.9|zero point nine} is only {0.11|zero point one one}.', code: 'small' },
        { id: 'try', say: 'Try one. Use {ln 2 ≈ 0.69|ln two is about zero point six nine} and {ln 5 ≈ 1.61|ln five is about one point six one}. Let p be one tenth. What is {−ln p|minus ln p}?', code: 'try' },
        { id: 'solve', say: 'Ten is two times five, so ln ten is {0.69|zero point six nine} plus {1.61|one point six one}: {2.30|two point three oh}. One over ten flips the sign of its log, so minus ln p is {2.30|two point three oh}. The smaller p, the taller the bar.', code: 'solve' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
