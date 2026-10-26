import type { LectureScript } from '../../../lecture/types';

const code = `
  r, jump = 1, 1        # one pixel sees itself   #@init
  for F, S in layers:                             #@loop
      r += (F - 1) * jump                         #@add
      jump *= S                                   #@jump
  # [(3, 1)] * 3        -> r = 7                  #@stack
  # [(3, 2), (3, 1)]    -> r = 7                  #@stride
`;

export const script: LectureScript = {
  id: 'atlas-receptive-field',
  title: 'Receptive field',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'grow',
      title: 'Each layer sees further',
      codeTitle: 'field.py',
      code,
      beats: [
        { id: 'one', say: 'One unit after a three by three conv sees a three by three patch of the input. That patch is its receptive field: three wide.', code: ['init', 'add'] },
        { id: 'two', say: 'Stack a second three by three layer. Its unit sees three units below it, and together those see five input pixels. The layer added two.', code: ['loop', 'add'] },
        { id: 'three', say: 'A third layer reaches seven. Each stride one layer adds F minus one, so L layers of three by three see one plus two L.', code: 'stack' },
      ],
    },
    {
      id: 'stride',
      title: 'Strides make it grow faster',
      codeTitle: 'field.py',
      code,
      beats: [
        { id: 'jump', say: 'A stride speeds this up. After a stride two layer, neighboring units sit two input pixels apart. Call that gap the jump.', code: 'jump' },
        { id: 'adds', say: 'So the next three by three layer spans twice as much: it adds two times two, four. Three becomes seven.', code: ['add', 'stride'] },
        { id: 'deep', say: 'This is how a deep network\'s last layers come to see the whole image, while every filter stays small.', code: 'loop' },
      ],
    },
    {
      id: 'why',
      title: 'Small filters, stacked',
      codeTitle: 'weights.py',
      code: `
        stack = 3*3 + 3*3      # 18 weights   #@stack
        big = 5*5              # 25 weights   #@big
        # both see 5 x 5                      #@same
        three = 3 * 3*3        # 27, vs 7*7 = 49  #@more
      `,
      beats: [
        { id: 'same', say: 'Two stacked three by three layers see five by five, exactly like a single five by five filter.', code: 'same' },
        { id: 'fewer', say: 'But they need fewer weights: nine plus nine, eighteen, against twenty five.', code: ['stack', 'big'] },
        { id: 'more', say: 'The saving grows with depth. Three layers of three by three see seven by seven with twenty seven weights; one seven by seven filter needs forty nine. Same view, fewer weights.', code: 'more' },
      ],
    },
    {
      id: 'try',
      title: 'Track the field and the jump',
      codeTitle: 'walk.py',
      code: `
        layers = [(3, 2), (2, 2), (3, 1)]   #@p
        r, jump = 1, 1                      #@rj
        r += (3 - 1) * 1   # 3              #@l1
        jump *= 2          # 2              #@j1
        r += (2 - 1) * 2   # 5              #@l2
        jump *= 2          # 4              #@j2
        r += (3 - 1) * 4   # 13             #@l3
      `,
      beats: [
        { id: 'p', say: 'Try one with two strides: a three by three conv with stride two, then a two by two with stride two, then a three by three with stride one. How wide is the last layer\'s receptive field?', code: 'p' },
        { id: 'rj', say: 'Track two numbers, layer by layer: r, the receptive field so far, and j, the jump. Before any layer, a unit is one pixel, so both start at one.', code: 'rj' },
        { id: 'l1', say: 'Layer one adds {F − 1|F minus one}, two, times the jump, one: r is three. Only then does its stride double the jump, to two, for the layers above.', code: ['l1', 'j1'] },
        { id: 'l2', say: 'Layer two adds one times the jump, two: r is five. Its stride doubles the jump again, to four.', code: ['l2', 'j2'] },
        { id: 'l3', say: 'Layer three adds two times four, eight: r is thirteen. Two strides made the jump four, so the last small filter reaches thirteen pixels across.', code: 'l3' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
