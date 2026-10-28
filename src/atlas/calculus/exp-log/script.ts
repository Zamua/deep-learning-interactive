import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-exp-log',
  title: 'Log rules',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'John Napier', year: 1614, title: 'Mirifici Logarithmorum Canonis Descriptio', url: 'https://archive.org/details/mirificilogarit00napi', scene: 'prod' },
  ],
  scenes: [
    {
      id: 'prod',
      title: 'Products become sums',
      codeTitle: 'prod.py',
      code: `
        3255682 * 9455186  # slow by hand  #@slow
        3255682 + 9455186  # quick         #@slow
        np.log(2)          # 0.69          #@two
        np.log(3)          # 1.10          #@three
        np.log(2) + np.log(3)  # 1.79      #@six
        np.log(2 * 3)      # 1.79          #@six
      `,
      beats: [
        { id: 'slow', say: 'Multiplying long numbers by hand is slow, and easy to get wrong. Adding them is quick.', code: 'slow' },
        { id: 'napier', say: 'In 1614, John Napier published tables of logarithms to trade one for the other. With them, he wrote, adding does the work of multiplying, and subtracting the work of dividing.', code: 'slow' },
        { id: 'curve', say: 'To see why, go back to the curve of {eˣ|e to the x}, where ln reads a height back to its x.', code: 'two' },
        { id: 'two', say: 'The curve reaches height two at x of about {0.69|zero point six nine}: that is ln two.', code: 'two' },
        { id: 'three', say: 'Height three, at about {1.10|one point one}: that is ln three.', code: 'three' },
        { id: 'six', say: 'Lay those two lengths end to end: {0.69 + 1.10 = 1.79|zero point six nine plus one point one is one point seven nine}. The curve there stands at six, which is two times three.', code: 'six' },
        { id: 'why', say: 'It has to: two is e to the {0.69|zero point six nine}, three is e to the {1.10|one point one}, and multiplying exponentials adds their powers.', code: 'six' },
        { id: 'rule', say: 'So for positive numbers a and b, {ln(ab) = ln a + ln b|ln of a b is ln a plus ln b}. The log of a product, what multiplying gives, is the sum of the logs, one log per factor.', code: 'six' },
      ],
    },
    {
      id: 'pow',
      title: 'Powers come out in front',
      codeTitle: 'pow.py',
      code: `
        np.log(3 * 3)    # 2.20            #@nine
        2 * np.log(3)    # 2.20            #@nine
        np.log(3 ** 4)   # 4.39            #@k
        4 * np.log(3)    # 4.39            #@k
        np.log(3) ** 2   # 1.21: not it    #@not
      `,
      beats: [
        { id: 'nine', say: 'Nine is three times three, so its x is two equal steps of {1.10|one point one}: {ln 9 ≈ 2.20|ln nine is about two point two}.', code: 'nine' },
        { id: 'k', say: 'Any power is equal factors: a to the k is k factors of a. So its log is k equal steps: {ln aᵏ = k ln a|ln of a to the k is k times ln a}.', code: 'k' },
        { id: 'front', say: 'The power comes down in front, as a multiplier. It does not square the log: {(ln 3)²|ln three, squared,} is only about {1.21|one point two one}.', code: 'not' },
      ],
    },
    {
      id: 'quot',
      title: 'Quotients become differences',
      codeTitle: 'quot.py',
      code: `
        np.log(1 / 2)    # -0.69           #@half
        -np.log(2)       # -0.69           #@half
        np.log(3 / 2)    # 0.41            #@quot
        np.log(3) - np.log(2)  # 0.41      #@quot
        -np.log(0.9)     # 0.11            #@small
        -np.log(0.5)     # 0.69            #@small
        -np.log(1 / 10)  # 2.30            #@try
        np.log(2) + np.log(5)  # 2.30      #@solve
      `,
      beats: [
        { id: 'half', say: 'Dividing undoes multiplying, so along x it steps back. Two times a half is one, which sits at zero, so the steps for two and for a half cancel: {ln ½ = −ln 2|ln of a half is minus ln two}.', code: 'half' },
        { id: 'flip', say: 'One over a number flips the sign of its log: ln of a half is about minus {0.69|zero point six nine}.', code: 'half' },
        { id: 'quot', say: 'So three divided by two steps back from ln three: {1.10 − 0.69 = 0.41|one point one minus zero point six nine is zero point four one}, the height one and a half.', code: 'quot' },
        { id: 'diff', say: 'The log of a quotient, what dividing gives, is the difference of the logs, top minus bottom: {ln(a/b) = ln a − ln b|ln of a over b is ln a minus ln b}.', code: 'quot' },
        { id: 'small', say: 'Any number p between zero and one sits left of zero, so {−ln p|minus ln p} is positive: how far left it sits.', code: 'small' },
        { id: 'order', say: 'The smaller p, the farther left, and the bigger minus ln p. Minus ln of {0.9|zero point nine} is only about {0.11|zero point one one}.', code: 'small' },
        { id: 'try', say: 'Try one. Use {ln 2 ≈ 0.69|ln two is about zero point six nine} and {ln 5 ≈ 1.61|ln five is about one point six one}. Let p be a tenth. What is {−ln p|minus ln p}?', code: 'try' },
        { id: 'ten', say: 'A tenth is one over ten, so minus ln p is ln ten itself.', code: 'try' },
        { id: 'solve', say: 'And ten is two times five, so add: {0.69 + 1.61 = 2.30|zero point six nine plus one point six one is two point three oh}.', code: 'solve' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
