import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-flow-matching',
  title: 'Flow matching',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Liu, Gong & Liu', year: 2022, title: 'Flow straight and fast: learning to generate and transfer data with rectified flow', url: 'https://arxiv.org/abs/2209.03003', scene: 'road' },
    { who: 'Lipman, Chen, Ben-Hamu, Nickel & Le', year: 2022, title: 'Flow matching for generative modeling', url: 'https://arxiv.org/abs/2210.02747', scene: 'road' },
    { who: 'Euler', year: 1768, title: 'Institutionum calculi integralis, volumen primum', url: 'https://scholarlycommons.pacific.edu/euler-works/342/', scene: 'sample' },
  ],
  scenes: [
    {
      id: 'road',
      title: 'The road back',
      codeTitle: 'road.py',
      code: `
        x0 = np.array([1., 0.])    # image  #@x0
        eps = np.array([-1., 2.])  # noise  #@x0
        xt = (np.sqrt(ab) * x0              #@arc
              + np.sqrt(1 - ab) * eps)      #@arc
        # back: step the way it points      #@back
        # big steps drift off a curve       #@drift
        # on a line, one step lands         #@line
      `,
      beats: [
        { id: 'pair', say: 'Take a two pixel image, {x₀|x zero}, as a point in the plane, and some noise, {ε|epsilon}, as another.', code: 'x0' },
        { id: 'arc', say: 'The diffusion blend joins them: as {ᾱ|alpha bar} falls, it slides from the image to the noise, and in this plane its path is a curve.', code: 'arc' },
        { id: 'back', say: 'To make a new image, walk that path backwards: from the noise toward the image, each step the way the path points where you stand.', code: 'back' },
        { id: 'drift', say: 'On a curve, big steps go wrong: each heads off straight while the path bends away, and two of them end far from the image.', code: 'drift' },
        { id: 'many', say: 'Small steps hug the curve, but then the walk takes many of them.', code: 'drift' },
        { id: 'straight', say: 'A straight path has no bend to fall off. One step, the way it points, lands exactly on the image.', code: 'line' },
        { id: 'liu', say: 'That is the idea of rectified flow, from {Xingchao Liu|Shing-chow Liu} and colleagues in 2022: rectified means made straight, since a straight path can be followed exactly.', code: 'line' },
        { id: 'lipman', say: 'A month later, Yaron Lipman and colleagues reached straight paths too, and named the method: flow matching.', code: 'line' },
      ],
    },
    {
      id: 'line',
      title: 'A straight line',
      codeTitle: 'line.py',
      code: `
        t = 0.25   # 0: image, 1: noise  #@t
        xt = (1 - t) * x0 + t * eps      #@line
        # 0.75*[1, 0] + 0.25*[-1, 2]     #@point
        #   = [0.5, 0.5]                 #@point
        v = eps - x0   # [-2, 2]         #@v
      `,
      beats: [
        { id: 'line', say: 'Flow matching uses the straight line. Its point at time t, {x_t|x t}, is one minus t, times {x₀|x zero}, plus t times {ε|epsilon}.', code: 'line' },
        { id: 't', say: 'Here t runs from zero, the image, to one, pure noise.', code: 't' },
        { id: 'point', say: 'At t of a quarter, take three quarters of {x₀|x zero}, plus a quarter of {ε|epsilon}: a half, and a half.', code: 'point' },
        { id: 'v', say: 'As t grows, the point slides along at a steady pace. How far it moves per unit of t is its velocity, v. Over the whole line it travels from the image to the noise, so v is {ε|epsilon} minus {x₀|x zero}.', code: 'v' },
        { id: 'steady', say: 'Here that is minus two and two, at every t. On the curve, the direction kept turning; on the line, it never does.', code: 'v' },
      ],
    },
    {
      id: 'train',
      title: 'Learn the velocity',
      codeTitle: 'loss.py',
      code: `
        v = eps - x0             # [-2, 2]  #@net
        v_hat = model(xt, t)   # [-1.5, 2]  #@net
        loss = np.mean((v_hat - v) ** 2)    #@loss
        # (0.5² + 0²) / 2 = 0.125           #@loss
        # one point, one t: one guess       #@flow
      `,
      beats: [
        { id: 'net', say: 'Train the network as for diffusion, with a new target. It sees {x_t|x t} and t, and guesses the velocity: {v̂|v hat}, the hat marking a guess.', code: 'net' },
        { id: 'loss', say: 'The loss is the squared error against {ε|epsilon} minus {x₀|x zero}, averaged. A guess of minus one and a half, and two, misses by a half and by zero: the loss is a quarter over two, {0.125|zero point one two five}.', code: 'loss' },
        { id: 'cross', say: 'Train on many images, each with its own noise, and their lines criss-cross. These two pass the same point at the same t, with different velocities.', code: 'flow' },
        { id: 'average', say: 'The network sees only the point and t, not the line, so its best guess is their average: that is where the squared error is smallest.', code: 'flow' },
        { id: 'flow', say: 'Arrows at every point, carrying points along like water in a stream, are called a flow. Training matches the network\'s flow to the lines: flow matching.', code: 'flow' },
      ],
    },
    {
      id: 'sample',
      title: 'Euler steps back',
      codeTitle: 'sample.py',
      code: `
        xt = np.random.randn(2)  # t = 1  #@start
        dt = 0.5                          #@dt
        for t in [1.0, 0.5]:              #@dt
            v_hat = model(xt, t)          #@step
            xt = xt - dt * v_hat          #@step
        # [-1, 2] -> [0, 1] -> [1, 0]     #@ex
      `,
      beats: [
        { id: 'start', say: 'To make an image, start at t of one, with fresh noise, and walk back to zero.', code: 'start' },
        { id: 'dt', say: 'Pick a step size, {Δt|delta t}: the change in t per step. With {Δt|delta t} of a half, two steps get from one to zero.', code: 'dt' },
        { id: 'rule', say: 'Each step asks the network for {v̂|v hat} where the point is, and moves against it, back toward the image: the new {x_t|x t} is the old one, minus {Δt|delta t} times {v̂|v hat}.', code: 'step' },
        { id: 'ex', say: 'Start from minus one and two, with a guess of minus two and two. Half the guess is minus one and one; take that away, and the point lands on zero and one, at t of a half.', code: 'ex' },
        { id: 'exact', say: 'A second step lands on one and zero: the image. With a velocity that never changes, one step of {Δt|delta t} equal to one would land there too.', code: 'ex' },
        { id: 'euler', say: 'Stepping the way an arrow points, then looking again, is {Euler\'s|Oiler\'s} method, from {Leonhard Euler|Leonhard Oiler} in 1768. Gradient descent steps the same way: w gets w minus {η|eta} g.', code: 'step' },
        { id: 'bend', say: 'The network\'s arrows are averages, though, so its paths bend, and samplers take a few steps rather than one.', code: 'step' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
