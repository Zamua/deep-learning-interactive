import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-adam-moments',
  title: 'Adam\'s running averages',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Kingma & Ba', year: 2014, title: 'Adam: A Method for Stochastic Optimization', url: 'https://arxiv.org/abs/1412.6980', scene: 'problem' },
  ],
  scenes: [
    {
      id: 'problem',
      title: 'One step size for every weight',
      codeTitle: 'valley.py',
      code: `
        # L = 0.5 * (0.05 * w0**2 + w1**2)  #@valley
        w = w - lr * g    # one lr for all  #@step
        # across: g = 1.6, -1.28, 1.02, ... #@across
        # along:  g = -0.225, -0.205, ...  #@along
        # per parameter: direction, size    #@adam
      `,
      beats: [
        { id: 'valley', say: 'Here is momentum\'s narrow valley again, with plain gradient descent zigzagging down it. Below it, each weight\'s gradient, step by step.', code: 'valley' },
        { id: 'across', say: 'Across the valley, the gradient of {w₁|w one} is big, and it flips sign every step as the path zigzags.', code: 'across' },
        { id: 'along', say: 'Along the valley, the gradient of {w₀|w zero} is small, and it points the same way every step.', code: 'along' },
        { id: 'one', say: 'Every number that training adjusts is called a parameter, and gradient descent gives them all one learning rate, {η|eta}. Small enough for {w₁|w one}, it leaves {w₀|w zero} crawling.', code: 'step' },
        { id: 'adam', say: 'In 2014, Diederik Kingma and Jimmy Ba proposed Adam, an optimizer: a rule, like gradient descent or momentum, for turning gradients into steps.', code: 'step' },
        { id: 'two', say: 'For every parameter, Adam tracks two things: which way its gradient has been pointing lately, and how big it usually is.', code: 'adam' },
      ],
    },
    {
      id: 'first',
      title: 'Average the gradient',
      codeTitle: 'm.py',
      code: `
        # g: 2, -4, 3.6, 0.3, 2.9, ...      #@g
        m = 0                               #@zero
        m = 0.9 * m + 0.1 * g               #@keep
        beta1 = 0.9        # the share kept #@b1
        m = beta1 * m + (1 - beta1) * g     #@rule
        # momentum: v = mu*v - lr*g         #@mom
        # m=0.5, g=3: 0.45 + 0.3 = 0.75     #@ex
        # from 0, g = 2:  m = 0.2           #@one
        # then g = -4: 0.18 - 0.4 = -0.22   #@two
      `,
      beats: [
        { id: 'jagged', say: 'Take one parameter whose gradient, g, jumps around from step to step, though on the whole it leans positive.', code: 'g' },
        { id: 'keep', say: 'Keep a second number, m, starting at zero. Each step, move it only part of the way toward the new gradient: keep nine tenths of m, and take one tenth of g.', code: ['zero', 'keep'] },
        { id: 'smooth', say: 'Step after step, m draws a smooth line through the jumps. It lags behind, but it shows where the gradient has been pointing lately.', code: 'keep' },
        { id: 'running', say: 'That is a running average: it updates as each new number arrives, and each step multiplies every older gradient\'s share by nine tenths again.', code: 'keep' },
        { id: 'beta1', say: 'That share kept is named {β₁|beta one}, after the Greek letter beta, and is usually {0.9|zero point nine}. So m gets {β₁|beta one} m, plus one minus {β₁|beta one}, times g.', code: ['b1', 'rule'] },
        { id: 'mom', say: 'That is momentum\'s velocity rule without the {η|eta}: m is not a step, but an average gradient, in the gradient\'s own units.', code: ['rule', 'mom'] },
        { id: 'ex', say: 'Say m is {0.5|zero point five}, and a gradient of three arrives. m keeps {0.45|zero point four five} and takes {0.3|zero point three}: {0.75|zero point seven five}, a tenth of the way toward three.', code: 'ex' },
        { id: 'one', say: 'From zero, though, a first gradient of two leaves m at a tenth of it: {0.2|zero point two}. That is why the line starts low.', code: 'one' },
        { id: 'two', say: 'Then comes minus four. m keeps nine tenths of {0.2|zero point two}, which is {0.18|zero point one eight}, and adds a tenth of minus four, landing at minus {0.22|zero point two two}.', code: 'two' },
      ],
    },
    {
      id: 'second',
      title: 'Average the square',
      codeTitle: 'v.py',
      code: `
        # a: g = 3, 3, 3, ...               #@a
        # b: g = 3, -3, 3, ...              #@b
        # a: m -> 3     b: m near 0         #@m
        v = beta2 * v + (1 - beta2) * g**2  #@v
        beta2 = 0.999      # the share kept #@b2
        # a and b: v -> 9                   #@size
        # from 0, g = 2:  v = 0.001 * 4     #@zero
      `,
      beats: [
        { id: 'two', say: 'Now two parameters, a and b. a\'s gradient is three, every step. b\'s flips: three, minus three, three, and so on.', code: ['a', 'b'] },
        { id: 'm', say: 'a\'s m levels off at three, the gradient itself. In b\'s, each push undoes the last, and m stays near zero.', code: 'm' },
        { id: 'blind', say: 'So an m near zero could mean tiny gradients, or big ones that cancel. m knows the direction, but not the size.', code: 'm' },
        { id: 'v', say: 'That is why Adam keeps a second running average, v, of the squared gradient. This v is not momentum\'s velocity.', code: 'v' },
        { id: 'beta2', say: 'Its share kept, {β₂|beta two}, is usually {0.999|zero point nine nine nine}. So v takes just a thousandth of each new square, and climbs over thousands of steps.', code: ['v', 'b2'] },
        { id: 'sign', say: 'Squaring drops the sign, so a\'s v and b\'s v both head to nine. m tracks the direction; v tracks the size.', code: 'size' },
        { id: 'zero', say: 'From zero, a first gradient of two gives v a thousandth of four: {0.004|zero point zero zero four}. Like m, it starts far too small.', code: 'zero' },
        { id: 'name', say: 'These two averages give Adam its name. The average of a quantity is called its first moment, and the average of its square, its second moment. Adam is short for adaptive moment estimation.', code: ['v', 'size'] },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
