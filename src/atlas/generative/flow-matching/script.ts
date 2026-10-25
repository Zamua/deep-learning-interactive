import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-flow-matching',
  title: 'Flow matching',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'line',
      title: 'A straight line',
      codeTitle: 'path.py',
      code: `
        x0 = np.array([1., 0.])    # the image  #@x0
        eps = np.array([-1., 2.])  # the noise  #@x0
        xt = (1 - t) * x0 + t * eps             #@line
        # t = 0.25: [0.5, 0.5]                  #@point
        v = eps - x0               # [-2, 2]    #@v
      `,
      beats: [
        { id: 'arc', say: 'Take a two pixel image, {x₀|x zero}, as a point in the plane, and its noise {ε|epsilon} as another. As {ᾱ|alpha bar} falls, the diffusion blend travels from one to the other along a curve.', code: 'x0' },
        { id: 'line', say: 'Flow matching takes the straight line instead. {x_t|x t} is one minus t, times {x₀|x zero}, plus t times {ε|epsilon}, with t running from zero, the image, to one, pure noise.', code: 'line' },
        { id: 'point', say: 'Say {x₀|x zero} is one and zero, and {ε|epsilon} is minus one and two. At t of a quarter, take three quarters of {x₀|x zero} plus a quarter of {ε|epsilon}: a half, and a half.', code: 'point' },
        { id: 'v', say: 'Along the line, the point moves at a steady velocity, v: {ε|epsilon} minus {x₀|x zero}, here minus two and two, for each unit of t. It is the same at every t.', code: 'v' },
      ],
    },
    {
      id: 'train',
      title: 'Learn the velocity',
      codeTitle: 'loss.py',
      code: `
        v = eps - x0                  # [-2, 2]    #@net
        v_hat = model(xt, t)          # [-1.5, 2]  #@net
        loss = np.mean((v_hat - v) ** 2)  # 0.125  #@loss
      `,
      beats: [
        { id: 'net', say: 'Train the network as before, with a new target. It sees {x_t|x t} and t, and guesses the velocity: {v̂|v hat}, the hat marking a guess of v.', code: 'net' },
        { id: 'loss', say: 'The loss is the squared error against {ε|epsilon} minus {x₀|x zero}, averaged. A guess of minus one and a half, and two, misses by a half and by zero: the loss is a quarter over two, {0.125|zero point one two five}.', code: 'loss' },
      ],
    },
    {
      id: 'sample',
      title: 'Euler steps back',
      codeTitle: 'sample.py',
      code: `
        xt = np.random.randn(2)   # t = 1: noise  #@start
        dt = 0.5                                  #@euler
        for t in [1.0, 0.5]:                      #@euler
            v_hat = model(xt, t)                  #@euler
            xt = xt - dt * v_hat                  #@euler
        # [-1, 2] -> [0, 1] -> [1, 0]             #@ex
      `,
      beats: [
        { id: 'start', say: 'To make an image, start at t equals one, with pure noise, and walk back to zero.', code: 'start' },
        { id: 'euler', say: 'Each Euler step asks the network for {v̂|v hat} at the current point, and moves against it: the new {x_t|x t} is the old one minus {Δt|delta t} times {v̂|v hat}, where {Δt|delta t} is the step\'s size in t. Then t drops by {Δt|delta t}.', code: 'euler' },
        { id: 'ex', say: 'Start from minus one and two, with {Δt|delta t} of a half. If the guess is minus two and two, the step adds one and takes away one: the point lands on zero and one, at t of a half.', code: 'ex' },
        { id: 'exact', say: 'A second step lands on one and zero: the image. On a straight line the velocity never changes, so even one long step would land exactly.', code: 'ex' },
        { id: 'bend', say: 'But the network never sees which image a noise came from, so its velocity is an average over every line through the point, and its paths bend a little. A few steps follow them well.', code: 'euler' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
