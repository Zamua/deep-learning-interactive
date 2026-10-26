import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-adam',
  title: 'Adam',
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
        # t = 1, g = 2:   m = 0.2,   v = 0.004  #@zero
        # t = 2, g = -4:  m = -0.22, v = 0.02   #@two
      `,
      beats: [
        { id: 'm', say: 'Adam keeps two running averages for every parameter. The first, m, averages the gradient: each step, m gets {β₁|beta one} times m, plus one minus {β₁|beta one} times the gradient, where {β₁|beta one}, read “beta one”, is the share of m kept.', code: 'm' },
        { id: 'mnum', say: '{β₁|Beta one} is usually {0.9|zero point nine}. So each step, m keeps nine tenths of itself and takes one tenth of the new gradient.', code: 'mnum' },
        { id: 'mom', say: 'That looks like momentum\'s velocity, with two differences: no {η|eta} inside, and the gradient is weighted by one minus {β₁|beta one}. So m is not a step: it is an average gradient, in the gradient\'s own units.', code: ['m', 'mom'] },
        { id: 'v', say: 'The second, v, here not a velocity, averages the squared gradient the same way, keeping a share {β₂|beta two}. It tracks how big this parameter\'s gradients usually are.', code: 'v' },
        { id: 'vnum', say: '{β₂|Beta two} is usually {0.999|zero point nine nine nine}: v keeps almost all of itself, and takes a thousandth of each new squared gradient.', code: 'vnum' },
        { id: 'zero', say: 'Both start at zero. After a first gradient of two, m is a tenth of two, {0.2|zero point two}, and v is a thousandth of four, {0.004|zero point zero zero four}. Both are far too small.', code: 'zero' },
        { id: 'two', say: 'Then the gradient is minus four. m keeps nine tenths of {0.2|zero point two}, {0.18|zero point one eight}, and adds a tenth of minus four: minus {0.22|zero point two two}. v keeps {0.999|zero point nine nine nine} of {0.004|zero point zero zero four}, and adds a thousandth of sixteen: about {0.02|zero point zero two}.', code: 'two' },
      ],
    },
    {
      id: 'correct',
      title: 'Bias correction',
      codeTitle: 'adam.py',
      code: `
        m_hat = m / (1 - beta1**t)   # 0.2 / 0.1 = 2       #@m
        v_hat = v / (1 - beta2**t)   # 0.004 / 0.001 = 4   #@v
        # t = 2:  1 - 0.9**2 = 0.19,  -0.22 / 0.19        #@second
        # t = 20:  1 - 0.9**20 = 0.88                      #@later
      `,
      beats: [
        { id: 'bias', say: 'Starting from zero drags both averages toward zero early on, and Adam divides that out. {m̂|m hat}, the hat marking a corrected estimate, is m over one minus {β₁|beta one} to the t, where t counts the steps; {v̂|v hat} is v over one minus {β₂|beta two} to the t.', code: ['m', 'v'] },
        { id: 'first', say: 'At step one, that is {0.2|zero point two} over {0.1|zero point one}: exactly the gradient, two. And {v̂|v hat} is {0.004|zero point zero zero four} over {0.001|zero point zero zero one}: four, the squared gradient.', code: ['m', 'v'] },
        { id: 'second', say: 'At step two, {0.9|zero point nine} squared is {0.81|zero point eight one}, so the divisor is one minus {0.81|zero point eight one}: {0.19|zero point one nine}. {m̂|m hat} is minus {0.22|zero point two two} over {0.19|zero point one nine}: about minus {1.16|one point one six}, between the two gradients, two and minus four.', code: 'second' },
        { id: 'later', say: 'As t grows, {βᵗ|beta to the t}, for either beta, shrinks toward zero, the divisor climbs to one, and the correction fades away.', code: 'later' },
      ],
    },
    {
      id: 'step',
      title: 'A step sized per parameter',
      codeTitle: 'adam.py',
      code: `
        w -= lr * m_hat / (np.sqrt(v_hat) + eps)   #@step
        # t = 1:  lr * g / |g| = lr                #@first
        # tiny gradients, tiny sqrt(v): about lr   #@per
      `,
      beats: [
        { id: 'step', say: 'The step is {η|eta} times {m̂|m hat}, divided by the square root of {v̂|v hat}, written {√v̂|root v hat}, plus a tiny {ε|epsilon}, the Greek letter epsilon, so it never divides by zero.', code: 'step' },
        { id: 'first', say: 'At step one, {√v̂|root v hat} is {\\|g\\||the size of g}, the gradient with its sign dropped, so the step is {η|eta} times two over two: exactly {η|eta}. A gradient of five hundred, or of {0.002|zero point zero zero two}, gives the same first step.', code: 'first' },
        { id: 'per', say: 'Later, each step is the average gradient measured in units of its own typical size. A parameter whose gradients are always tiny still moves about {η|eta} per step, where plain gradient descent would barely move it.', code: 'per' },
      ],
    },
    {
      id: 'try',
      title: 'Try one',
      codeTitle: 'try.py',
      code: `
        m, beta1, g = 0.5, 0.9, 3.0              #@p1
        m = 0.9 * m + 0.1 * g    # 0.45 + 0.3   #@a1
        m_hat, v_hat, lr = 4.0, 4.0, 0.01       #@p2
        step = lr * m_hat / np.sqrt(v_hat)      #@a2
        # 0.01 * 4 / 2 = 0.02                   #@a2
      `,
      beats: [
        { id: 'p1', say: 'Try one: m is {0.5|zero point five}, {β₁|beta one} is {0.9|zero point nine}, and the new gradient is three. What is m after the update?', code: 'p1' },
        { id: 'a1', say: 'Keep nine tenths of {0.5|zero point five}: {0.45|zero point four five}. Take a tenth of three: {0.3|zero point three}. So m is {0.75|zero point seven five}, a tenth of the way from {0.5|zero point five} toward three.', code: 'a1' },
        { id: 'p2', say: 'Now a step: {m̂|m hat} is four, {v̂|v hat} is four, and {η|eta} is {0.01|zero point zero one}. Ignoring {ε|epsilon}, how far does the parameter move?', code: 'p2' },
        { id: 'a2', say: 'The square root of four is two, and four over two is two. So the step is two times {η|eta}: {0.02|zero point zero two}.', code: 'a2' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
