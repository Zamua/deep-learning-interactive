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
        v = beta2 * v + (1 - beta2) * g**2     #@v
        beta1, beta2 = 0.9, 0.999              #@betas
        # t = 1, g = 2:  m = 0.2, v = 0.004    #@zero
      `,
      beats: [
        { id: 'm', say: 'Adam keeps two running averages for every parameter. The first, m, is a momentum: {β₁|beta one} times m, plus one minus {β₁|beta one} times the gradient.', code: 'm' },
        { id: 'v', say: 'The second, v, averages the squared gradient the same way, with {β₂|beta two}. It tracks how big this parameter\'s gradients usually are.', code: 'v' },
        { id: 'betas', say: 'Typical values are {0.9|zero point nine} and {0.999|zero point nine nine nine}.', code: 'betas' },
        { id: 'zero', say: 'Both start at zero. After one step with a gradient of two, m is a tenth of two, {0.2|zero point two}, and v is a thousandth of four, {0.004|zero point zero zero four}. Both are far too small.', code: 'zero' },
      ],
    },
    {
      id: 'correct',
      title: 'Bias correction',
      codeTitle: 'adam.py',
      code: `
        m_hat = m / (1 - beta1**t)   # 0.2 / 0.1 = 2       #@m
        v_hat = v / (1 - beta2**t)   # 0.004 / 0.001 = 4   #@v
        # t = 20:  1 - 0.9**20 = 0.88                      #@later
      `,
      beats: [
        { id: 'bias', say: 'Starting from zero drags both averages toward zero early on. Adam divides that out: m hat is m over one minus {β₁|beta one} to the t, where t counts the steps.', code: 'm' },
        { id: 'first', say: 'At step one, that is {0.2|zero point two} over {0.1|zero point one}: exactly the gradient, two. And v hat is {0.004|zero point zero zero four} over {0.001|zero point zero zero one}: four, the squared gradient.', code: ['m', 'v'] },
        { id: 'later', say: 'As t grows, {β|beta} to the t shrinks toward zero, the divisor climbs to one, and the correction fades away.', code: 'later' },
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
        { id: 'step', say: 'The step is {η|eta} times m hat, divided by the square root of v hat, plus a tiny epsilon so it never divides by zero.', code: 'step' },
        { id: 'first', say: 'At step one that is {η|eta} times two over two: exactly {η|eta}. A gradient of five hundred, or of {0.002|zero point zero zero two}, gives the same first step.', code: 'first' },
        { id: 'per', say: 'Later, each step is the average gradient measured in units of its own typical size. A parameter whose gradients are always tiny still moves about {η|eta} per step, where plain gradient descent would barely move it.', code: 'per' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
