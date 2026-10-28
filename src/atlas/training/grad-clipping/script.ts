import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-grad-clipping',
  title: 'Gradient clipping',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Mikolov', year: 2012, title: 'Statistical language models based on neural networks (PhD thesis, Brno University of Technology)', url: 'https://www.fit.vutbr.cz/~imikolov/rnnlm/thesis.pdf', scene: 'wall' },
    { who: 'Pascanu, Mikolov & Bengio', year: 2013, title: 'On the difficulty of training recurrent neural networks', url: 'https://arxiv.org/abs/1211.5063', scene: 'clip' },
  ],
  scenes: [
    {
      id: 'wall',
      title: 'Thrown across the valley',
      codeTitle: 'wall.py',
      code: `
        w, eta = 4.0, 0.1                    #@w
        g = 50.0         # on the wall       #@g
        w - eta * g      # 4 - 5 = -1        #@raw
        g = np.clip(g, -5, 5)    # 5         #@cut
        w - eta * g      # 4 - 0.5 = 3.5     #@small
      `,
      beats: [
        { id: 'wall', say: 'Backprop through time can make a gradient explode. To see the harm, plot the loss, L, against a single weight, w: a valley, with a steep wall on its right.', code: 'w' },
        { id: 'slope', say: 'On the wall, where the gradient explodes, the slope, g, is fifty.', code: 'g' },
        { id: 'thrown', say: 'With a step size of {0.1|zero point one}, the step is minus five: w is thrown clear across the valley, and the loss ends up higher than it started.', code: 'raw' },
        { id: 'mikolov', say: 'Tomas Mikolov, training recurrent networks for his 2012 thesis, saw steps like this overwrite the weights with meaningless values, and training fail.', code: 'raw' },
        { id: 'cut', say: 'His fix was to cut the gradient: he kept every value of it between minus fifteen and fifteen, setting any value past that to the limit.', code: 'cut' },
        { id: 'small', say: 'Cut this one to five, and the step is {0.5|zero point five} long: w lands in the valley, just beside the wall.', code: 'small' },
        { id: 'name', say: 'Trimming whatever sticks out past a limit is called clipping, the way a hedge is clipped.', code: 'cut' },
      ],
    },
    {
      id: 'size',
      title: 'How long is a gradient?',
      codeTitle: 'norm.py',
      code: `
        g = np.array([6.0, 8.0])  # exploded  #@g
        g @ g              # 36 + 64 = 100    #@dot
        np.sqrt(g @ g)     # 10               #@norm
        np.linalg.norm(g)  # 10, the same     #@norm
        np.linalg.norm([1, 2, 2])  # 3        #@three
      `,
      beats: [
        { id: 'explode', say: 'With many weights, the gradient is a vector, drawn as an arrow. This one has exploded to six, eight.', code: 'g' },
        { id: 'norm', say: 'How big is it? The length of its arrow is called its norm, written {‖g‖|the norm of g}, with double bars. By Pythagoras, it is {√(6² + 8²)|the square root of six squared plus eight squared}: the root of a hundred, ten.', code: 'norm' },
        { id: 'dot', say: 'Six squared plus eight squared is just g dotted with itself, so the norm is the square root of {g · g|g dot g}, however many entries g has.', code: ['dot', 'norm'] },
        { id: 'three', say: 'With three entries, say one, two, two, it is the root of one plus four plus four, nine: three.', code: 'three' },
      ],
    },
    {
      id: 'clip',
      title: 'Cut, or scale',
      codeTitle: 'clip.py',
      code: `
        c = 5.0              # the limit      #@c
        np.clip(g, -c, c)    # [5, 5]: turned #@each
        np.clip([4, 4], -c, c)  # unchanged   #@miss
        n = np.linalg.norm(g)      # 10       #@scale
        if n > c:                             #@scale
            g = g * c / n          # [3, 4]   #@scale
      `,
      beats: [
        { id: 'threshold', say: 'Pick a threshold, c, the longest gradient allowed: here, five. Draw it as a circle. An arrow that ends inside it is left alone: clipping only ever shrinks.', code: 'c' },
        { id: 'each', say: 'Cutting each entry on its own, as Mikolov did, keeps every entry between minus c and c, written {[−c, c]|minus c to c}. Six, eight becomes five, five.', code: 'each' },
        { id: 'turns', say: 'But five, five is not a multiple of six, eight: eight was cut by more than six, so the arrow turns. The step no longer points straight downhill.', code: 'each' },
        { id: 'miss', say: 'It can also miss. The arrow four, four has no entry over five, so nothing is cut, yet its arrow is about {5.7|five point seven} long, outside the circle.', code: 'miss' },
        { id: 'pascanu', say: 'In 2013, Razvan Pascanu, Tomas Mikolov and Yoshua Bengio clipped the whole arrow instead: when its norm is over c, multiply every entry by c over the norm.', code: 'scale' },
        { id: 'scale', say: 'Here that factor is five over ten, a half, and six, eight becomes three, four.', code: 'scale' },
        { id: 'same', say: 'One factor for every entry keeps their ratios, so the arrow keeps its direction and ends exactly on the circle: its new norm is c.', code: 'scale' },
      ],
    },
    {
      id: 'step',
      title: 'Then step',
      codeTitle: 'step.py',
      code: `
        w = np.array([1.0, 2.0])              #@w
        g = np.array([3.0, 4.0])  # clipped   #@w
        eta = 0.1                             #@eg
        w - eta * g      # [0.7, 1.6]         #@land
        # raw [6, 8]: lands at [0.4, 1.2]     #@raw
        # any clipped step: <= eta * c        #@bound
      `,
      beats: [
        { id: 'step', say: 'Then take the gradient step as usual, with the clipped gradient. From w at one, two, with a step size of {0.1|zero point one}, {η|eta} times g is {0.3|zero point three}, {0.4|zero point four}.', code: ['w', 'eg'] },
        { id: 'land', say: 'Subtract it, and w lands at {0.7|zero point seven}, {1.6|one point six}.', code: 'land' },
        { id: 'raw', say: 'Unclipped, the step would be twice as long, landing at {0.4|zero point four}, {1.2|one point two}.', code: 'raw' },
        { id: 'bound', say: 'However far a gradient explodes, a clipped step is never longer than {η|eta} times c: here, half a unit. Every clipped step lands inside this circle.', code: 'bound' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
