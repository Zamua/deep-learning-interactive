import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-adam',
  title: 'Adam',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Tieleman & Hinton', year: 2012, title: 'Neural Networks for Machine Learning, lecture 6e. rmsprop: divide the gradient by a running average of its recent magnitude', url: 'https://www.cs.toronto.edu/~tijmen/csc321/slides/lecture_slides_lec6.pdf', scene: 'divide' },
    { who: 'Kingma & Ba', year: 2014, title: 'Adam: A Method for Stochastic Optimization', url: 'https://arxiv.org/abs/1412.6980', scene: 'step' },
  ],
  scenes: [
    {
      id: 'divide',
      title: 'Divide by the size',
      codeTitle: 'adam.py',
      code: `
        # m: which way g has pointed   #@m
        # v: how big g² usually is     #@v
        np.sqrt(v)  # g's typical size #@root
        w -= lr * m / np.sqrt(v)       #@step
        # along: m, sqrt(v) alike      #@along
        # across: m near 0             #@across
      `,
      beats: [
        { id: 'back', say: 'Back in the narrow valley, plain gradient descent, stepping {η|eta} times the gradient, zigzags across and crawls along. Adam keeps two running averages per parameter: m, the way its gradient points, and v, its usual square.', code: ['m', 'v'] },
        { id: 'root', say: 'v is in squared units, so take its root, {√v|root v}: the gradient\'s typical size, sign dropped. A root of a mean of squares is a root mean square, or {RMS|R M S}.', code: 'root' },
        { id: 'divide', say: 'Adam\'s step is {η|eta} times m, over {√v|root v}: the gradient measured against its own typical size.', code: 'step' },
        { id: 'along', say: 'Along the valley, {w₀|w zero}\'s gradient is small but steady, so m and {√v|root v} are the same size. The ratio is about minus one, and {w₀|w zero} moves about {η|eta} a step, however small its gradients.', code: 'along' },
        { id: 'across', say: 'Across, {w₁|w one}\'s gradient is big but flips sign: m stays near zero while {√v|root v} is large. The ratio is small, and the zigzag dies down.', code: 'across' },
        { id: 'path', say: 'So Adam swings down the valley and reaches the bottom first, while plain descent still zigzags.', code: 'step' },
        { id: 'rms', say: 'Dividing by the {RMS|R M S} predates Adam: in 2012, Geoffrey Hinton\'s online course taught it as {RMSProp|R M S prop}, crediting {Tijmen Tieleman|Tymen Teeleman}. It divided the raw gradient; Adam divides m.', code: 'step' },
      ],
    },
    {
      id: 'zero',
      title: 'The zero start',
      codeTitle: 'correct.py',
      code: `
        # g = 2 at every step              #@g
        m = 0.9 * 0 + 0.1 * 2   # 0.2      #@one
        1 - beta1**t   # t = 1: 0.1        #@share
        m_hat = m / (1 - beta1**t)  # 2    #@mhat
        v_hat = v / (1 - beta2**t)  # 4    #@vhat
        # g = 2, then -4: m = -0.22        #@two
        1 - 0.9**2     # 0.19              #@two
        -0.22 / 0.19   # about -1.16       #@two2
        # t large: 1 - beta1**t -> 1       #@fade
      `,
      beats: [
        { id: 'drag', say: 'One catch: m and v start at zero. Feed Adam a gradient of two every step. The average is plainly two, yet m starts at a tenth of it, {0.2|zero point two}, and creeps up.', code: ['g', 'one'] },
        { id: 'bias', say: 'Starting at zero pulls the estimate toward zero. A pull that leans an estimate one way is a bias, and undoing it is called bias correction.', code: 'g' },
        { id: 'share', say: 'After t steps, where t counts them, m has come one minus {β₁|beta one} to the t of the way: after one step, one minus {0.9|zero point nine}, a tenth.', code: 'share' },
        { id: 'mhat', say: 'So divide it back out. {m̂|m hat}, the hat marking a corrected estimate, is m over one minus {β₁|beta one} to the t: here {0.2|zero point two} over {0.1|zero point one}, exactly two.', code: 'mhat' },
        { id: 'vhat', say: 'v gets the same fix with {β₂|beta two}. After one step v is {0.004|zero point zero zero four}, one minus {β₂|beta two} is a thousandth, and {v̂|v hat} is four: g squared.', code: 'vhat' },
        { id: 'two', say: 'Gradients that change work the same way. Two, then minus four, left m at minus {0.22|zero point two two}. At step two, {β₁|beta one} squared is {0.81|zero point eight one}, so the divisor is {0.19|zero point one nine}.', code: 'two' },
        { id: 'two2', say: '{m̂|m hat} is minus {0.22|zero point two two} over {0.19|zero point one nine}: about minus {1.16|one point one six}, between the two gradients.', code: 'two2' },
        { id: 'fade', say: 'As t grows, {β₁|beta one} to the t shrinks toward zero, the divisor climbs to one, and the correction fades away.', code: 'fade' },
      ],
    },
    {
      id: 'step',
      title: 'The whole step',
      codeTitle: 'adam.py',
      code: `
        root = np.sqrt(v_hat) + eps        #@root
        w -= lr * m_hat / root             #@step
        # eps = 1e-8: never divide by 0    #@eps
        # t = 1: lr * g / |g| = lr         #@first
        # g = 500 or 0.002: a step of lr   #@scale
        # no fix: up to 6.5 * lr early     #@nofix
        m_hat, v_hat, lr = -1.0, 4.0, 0.1  #@ex
        # -1 / 2 = -0.5; step = -0.05      #@move
        w = 1 - (-0.05)   # 1.05           #@move
      `,
      beats: [
        { id: 'rule', say: 'All together, Adam\'s step is {η|eta} times {m̂|m hat}, over the root of {v̂|v hat}, taken away from the weight as in gradient descent.', code: ['root', 'step'] },
        { id: 'eps', say: 'The divisor adds a tiny {ε|epsilon}, around {10⁻⁸|ten to the minus eight}, so it never divides by zero. By hand, leave it out.', code: ['root', 'eps'] },
        { id: 'first', say: 'At the first step, {m̂|m hat} is the gradient and the root of {v̂|v hat} its size, so the step is exactly {η|eta}, whether the gradient is five hundred or {0.002|zero point zero zero two}.', code: 'first' },
        { id: 'scale', say: 'Plain gradient descent would move the first two hundred and fifty thousand times farther.', code: 'scale' },
        { id: 'nofix', say: 'Without the correction, raw v lags far behind m, and a steady gradient\'s early steps run up to six and a half times {η|eta}.', code: 'nofix' },
        { id: 'paper', say: '{RMSProp|R M S prop} had no correction. Diederik Kingma and Jimmy Ba added one to Adam in 2014, and found that without it, with {β₂|beta two} near one, training often diverged.', code: 'nofix' },
        { id: 'ex', say: 'One by hand: {m̂|m hat} is minus one, {v̂|v hat} is four, and {η|eta} is {0.1|zero point one}. The root of four is two, so the ratio is minus a half.', code: 'ex' },
        { id: 'move', say: 'The step, {η|eta} times that, is minus {0.05|zero point zero five}. Taking it away moves a weight at one up to {1.05|one point zero five}: the gradient is negative, so downhill is up.', code: 'move' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
