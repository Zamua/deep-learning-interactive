import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-adam-moments',
  title: 'Adam\'s running averages',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'moments',
      title: 'Two running averages',
      codeTitle: 'adam.py',
      code: `
        m = beta1 * m + (1 - beta1) * g        #@m
        beta1 = 0.9    # keep 0.9, take 0.1    #@mnum
        v_mom = mu * v_mom - lr * g            #@mom
        v = beta2 * v + (1 - beta2) * g**2     #@v
        beta2 = 0.999  # keep 0.999            #@vnum
      `,
      beats: [
        { id: 'm', say: 'Adam, an optimizer built on momentum, keeps two running averages for every parameter. The first, m, averages the gradient: each step, m gets {β₁|beta one} times m, plus one minus {β₁|beta one} times the gradient, where {β₁|beta one}, read “beta one”, is the share of m kept.', code: 'm' },
        { id: 'mnum', say: '{β₁|Beta one} is usually {0.9|zero point nine}. So each step, m keeps nine tenths of itself and takes one tenth of the new gradient.', code: 'mnum' },
        { id: 'mom', say: 'That looks like momentum\'s velocity, with two differences: no {η|eta} inside, and the gradient is weighted by one minus {β₁|beta one}. So m is not a step: it is an average gradient, in the gradient\'s own units.', code: ['m', 'mom'] },
        { id: 'v', say: 'The second, v, here not a velocity, averages the squared gradient the same way, keeping a share {β₂|beta two}. It tracks how big this parameter\'s gradients usually are.', code: 'v' },
        { id: 'vnum', say: '{β₂|Beta two} is usually {0.999|zero point nine nine nine}: v keeps almost all of itself, and takes a thousandth of each new squared gradient.', code: 'vnum' },
      ],
    },
    {
      id: 'start',
      title: 'From zero',
      codeTitle: 'adam.py',
      code: `
        m, v = 0, 0                                 #@zero
        # t = 1, g = 2:   m = 0.2,   v = 0.004      #@zero
        # t = 2, g = -4:  m = -0.22, v = 0.02       #@two
        # g = 3, 3, 3, ...:   m -> 3,  v -> 9       #@steady
        # g = 3, -3, 3, ...:  m near 0,  v -> 9     #@flip
      `,
      beats: [
        { id: 'zero', say: 'Both start at zero. After a first gradient of two, m is a tenth of two, {0.2|zero point two}, and v is a thousandth of four, {0.004|zero point zero zero four}. Both are far too small.', code: 'zero' },
        { id: 'two', say: 'Then the gradient is minus four. m keeps nine tenths of {0.2|zero point two}, {0.18|zero point one eight}, and adds a tenth of minus four: minus {0.22|zero point two two}. v keeps {0.999|zero point nine nine nine} of {0.004|zero point zero zero four}, and adds a thousandth of sixteen: about {0.02|zero point zero two}.', code: 'two' },
        { id: 'steady', say: 'Feed m the same gradient, three, step after step, and it levels off at three: nine tenths of three plus a tenth of three is three again. v levels off at nine, the square.', code: 'steady' },
        { id: 'flip', say: 'Now let the gradient flip between three and minus three. Each push undoes the last inside m, which stays near zero. But every square is nine, so v still heads to nine. m tracks the direction; v tracks the size.', code: 'flip' },
      ],
    },
    {
      id: 'try',
      title: 'Try one',
      codeTitle: 'try.py',
      code: `
        m, beta1, g = 0.5, 0.9, 3.0              #@p1
        m = 0.9 * m + 0.1 * g    # 0.45 + 0.3   #@a1
      `,
      beats: [
        { id: 'p1', say: 'Try one: m is {0.5|zero point five}, {β₁|beta one} is {0.9|zero point nine}, and the new gradient is three. What is m after the update?', code: 'p1' },
        { id: 'a1', say: 'Keep nine tenths of {0.5|zero point five}: {0.45|zero point four five}. Take a tenth of three: {0.3|zero point three}. So m is {0.75|zero point seven five}, a tenth of the way from {0.5|zero point five} toward three.', code: 'a1' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
