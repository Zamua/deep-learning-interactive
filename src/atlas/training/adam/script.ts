import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-adam',
  title: 'Adam',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'correct',
      title: 'Bias correction',
      codeTitle: 'adam.py',
      code: `
        # t = 1: m = 0.2, v = 0.004;  t = 2: m = -0.22    #@recap
        m_hat = m / (1 - beta1**t)   # 0.2 / 0.1 = 2       #@m
        v_hat = v / (1 - beta2**t)   # 0.004 / 0.001 = 4   #@v
        # t = 2:  1 - 0.9**2 = 0.19,  -0.22 / 0.19        #@second
        # t = 20:  1 - 0.9**20 = 0.88                      #@later
      `,
      beats: [
        { id: 'recap', say: 'Adam\'s running averages start at zero, so early on they run small. After a gradient of two, m is {0.2|zero point two} and v is {0.004|zero point zero zero four}. After a second gradient, minus four, m is minus {0.22|zero point two two}.', code: 'recap' },
        { id: 'bias', say: 'Adam divides that drag out. {m̂|m hat}, the hat marking a corrected estimate, is m over one minus {β₁|beta one} to the t, where t counts the steps; {v̂|v hat} is v over one minus {β₂|beta two} to the t.', code: ['m', 'v'] },
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
        m_hat, v_hat, lr = 4.0, 4.0, 0.01       #@p1
        step = lr * m_hat / np.sqrt(v_hat)      #@a1
        # 0.01 * 4 / 2 = 0.02                   #@a1
      `,
      beats: [
        { id: 'p1', say: 'Try one: {m̂|m hat} is four, {v̂|v hat} is four, and {η|eta} is {0.01|zero point zero one}. Ignoring {ε|epsilon}, how far does the parameter move?', code: 'p1' },
        { id: 'a1', say: 'The square root of four is two, and four over two is two. So the step is two times {η|eta}: {0.02|zero point zero two}.', code: 'a1' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
