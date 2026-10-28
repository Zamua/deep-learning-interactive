import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-momentum',
  title: 'Momentum',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Polyak', year: 1964, title: 'Some methods of speeding up the convergence of iteration methods', url: 'https://doi.org/10.1016/0041-5553(64)90137-5', scene: 'ball' },
    { who: 'Rumelhart, Hinton & Williams', year: 1986, title: 'Learning representations by back-propagating errors', url: 'https://doi.org/10.1038/323533a0', scene: 'build' },
  ],
  scenes: [
    {
      id: 'valley',
      title: 'A long, narrow valley',
      codeTitle: 'valley.py',
      code: `
        w = np.array([-4.5, 1.6])      #@w
        # f = 0.05*w[0]**2 + w[1]**2   #@f
        lr = 0.9                       #@step
        w = w - lr * g   # one step    #@step
      `,
      beats: [
        { id: 'map', say: 'Here is f, a function of two weights, {w₀|w zero} and {w₁|w one}: numbers that a program tunes as it learns. Seen from above, each ring joins points of equal height.', code: ['w', 'f'] },
        { id: 'valley', say: 'The rings make a long, narrow valley: steep from wall to wall, and nearly flat along the floor.', code: 'f' },
        { id: 'descent', say: 'Gradient descent walks down it, one gradient step after another, each moving w by minus {η|eta} times the gradient.', code: 'step' },
        { id: 'zig', say: 'Across the valley the walls are steep, so each step overshoots to the far wall: a zigzag.', code: 'step' },
        { id: 'crawl', say: 'Along the floor the slope is gentle, so the steps are short, and the walk crawls.', code: 'step' },
      ],
    },
    {
      id: 'trap',
      title: 'One step size, two slopes',
      codeTitle: 'factor.py',
      code: `
        # across: a = 1, along: a = 0.05  #@split
        lr = 0.9                          #@lr
        1 - 2 * 1 * lr      # -0.8: zig   #@across
        1 - 2 * 0.05 * lr   # 0.91: crawl #@along
        lr_max = 1 / 1      # the cap     #@cap
      `,
      beats: [
        { id: 'split', say: 'Why not take bigger steps? Each direction is a bowl of its own: across, its steepness, {a|A}, is one; along, just {0.05|zero point zero five}.', code: 'split' },
        { id: 'across', say: 'With {η|eta} at {0.9|zero point nine}, the step factor across, one minus two {a|A} {η|eta}, is minus {0.8|zero point eight}: the sign flips every step.', code: ['lr', 'across'] },
        { id: 'along', say: 'Along, the factor is {0.91|zero point nine one}: each step leaves ninety-one percent of the way to go.', code: 'along' },
        { id: 'cap', say: 'And {η|eta} cannot pass one over {a|A} across, which is one, or the zigzag blows up: the steep side caps the step for both.', code: 'cap' },
      ],
    },
    {
      id: 'ball',
      title: 'A heavy ball',
      codeTitle: 'momentum.py',
      code: `
        mu, lr = 0.5, 0.9            #@mu
        v = np.zeros(2)   # at rest  #@v0
        v = mu * v - lr * g          #@v
        w = w + v                    #@w
      `,
      beats: [
        { id: 'heavy', say: 'Boris Polyak, a mathematician in Moscow, noted in 1964 that most functions look like this near their lowest point, and took a fix from physics: a heavy ball rolling down this valley keeps its motion, and runs along the floor.', code: ['v', 'w'] },
        { id: 'name', say: 'He called it the heavy ball method. Its usual name, momentum, is the physicist\'s word for the motion a moving mass carries.', code: 'v' },
        { id: 'velocity', say: 'So keep the last move as a vector, v, the velocity: how far, and which way, the weights went last step.', code: 'v0' },
        { id: 'keep', say: 'Each step, the velocity keeps a share of itself, {μ|mu}, the Greek letter mu: here, a half.', code: 'mu' },
        { id: 'push', say: 'Then it adds the usual push, minus {η|eta} g. Alone, the push lands high on the far wall; the kept half pulls it back down, and farther along.', code: 'v' },
        { id: 'rule', say: 'Together, {v ← μv − ηg|v gets mu v minus eta g}. Then the weights move by the velocity: {w ← w + v|w gets w plus v}.', code: ['v', 'w'] },
        { id: 'zero', say: '{μ|Mu} sets how much motion survives a step, like one minus friction. At zero, this is plain gradient descent.', code: 'mu' },
        { id: 'half', say: 'At a half, with the same {η|eta}, the zigzag dies in a few steps, and the ball runs far ahead.', code: ['v', 'w'] },
      ],
    },
    {
      id: 'build',
      title: 'Agree and build, flip and cancel',
      codeTitle: 'velocity.py',
      code: `
        mu, lr, g = 0.9, 0.1, 2.0          #@set
        v, w = 0.0, 1.0                    #@set
        v = mu * v - lr * g   # -0.2       #@v1
        w = w + v             # 0.8        #@w1
        v = mu * v - lr * g   # -0.38      #@v2
        w = w + v             # 0.42       #@w2
        # v: -0.54, -0.69, ... -> -2.0     #@steady
        # v == 0.9*v - 0.2: 0.1*v == -0.2  #@settle
        -lr * g / (1 - mu)    # -2.0       #@limit
        # g flips sign: pushes cancel      #@flip
      `,
      beats: [
        { id: 'one', say: 'Rumelhart, Hinton and Williams used momentum in 1986 to make programs learn faster; in one example, {μ|mu} was {0.9|zero point nine} and {η|eta} {0.1|zero point one}. Take those for a single weight, w, at one, with a gradient of two.', code: 'set' },
        { id: 'v1', say: 'From rest, v is zero, so the first velocity is just minus {0.1|zero point one} times two: minus {0.2|zero point two}, a plain step.', code: 'v1' },
        { id: 'w1', say: 'So w, which was one, becomes {0.8|zero point eight}.', code: 'w1' },
        { id: 'v2', say: 'The gradient is two again. The velocity keeps {0.9|zero point nine} of minus {0.2|zero point two}, and adds another minus {0.2|zero point two}: minus {0.38|zero point three eight}.', code: 'v2' },
        { id: 'w2', say: 'So this step is almost twice as long: w, at {0.8|zero point eight}, becomes {0.42|zero point four two}.', code: 'w2' },
        { id: 'steady', say: 'Keep the gradient steady, and the pushes pile up in v, each adding a little less.', code: 'steady' },
        { id: 'settle', say: 'It levels off where a step no longer changes it: where v equals {0.9|zero point nine} v, minus {0.2|zero point two}.', code: 'settle' },
        { id: 'solve', say: 'Take {0.9|zero point nine} v from both sides: {0.1|zero point one} v is minus {0.2|zero point two}, so v is minus two: ten times a plain step.', code: 'settle' },
        { id: 'limit', say: 'With any {μ|mu}, the same steps give {v → −ηg / (1 − μ)|v approaches minus eta g, over one minus mu}, the arrow read “approaches”: one over one minus {μ|mu}, times a plain step.', code: 'limit' },
        { id: 'flip', say: 'Across the valley, though, the gradient flips sign every step: each push undoes the last inside v, and the zigzag is damped.', code: 'flip' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
