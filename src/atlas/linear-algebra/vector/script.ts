import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-vector',
  title: 'Vectors',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'list',
      title: 'A list of numbers',
      codeTitle: 'vector.py',
      code: `
        x = np.array([3, -1, 4, 2])   #@x
        len(x)       # 4              #@len
        x.shape      # (4,)           #@len
        x[0]         # 3, the first   #@x0
        x[3]         # 2, the last    #@x3
        x[4]         # IndexError     #@x4
      `,
      beats: [
        { id: 'list', say: 'A vector is a list of numbers, kept in order. This one, x, holds four: three, minus one, four, and two.', code: 'x' },
        { id: 'dim', say: 'How many numbers it holds is its length, or its dimension. This x is four-dimensional, written {x ∈ ℝ⁴|x in R four}.', code: 'len' },
        { id: 'index', say: 'Each entry has an index: its position. Python counts from zero, so {x[0]|x of zero} is the first entry, three.', code: 'x0' },
        { id: 'last', say: 'That makes the last of four entries {x[3]|x of three}. There is no {x[4]|x of four}.', code: ['x3', 'x4'] },
      ],
    },
    {
      id: 'image',
      title: 'Anything can be a vector',
      codeTitle: 'image.py',
      code: `
        img = np.zeros((4, 4, 3))   #@img
        img.shape   # (4, 4, 3): height, width, RGB   #@img
        x = img.reshape(-1)         #@flat
        x.shape     # (48,)         #@flat
        # a 32 by 32 photo: 32 * 32 * 3 = 3072   #@big
      `,
      beats: [
        { id: 'image', say: 'Anything described by numbers can be a vector. Take a tiny color image, four pixels by four.', code: 'img' },
        { id: 'rgb', say: 'Each pixel is three numbers: how much red, how much green, and how much blue.', code: 'img' },
        { id: 'flat', say: 'Lay every number out in one row, and the image becomes a vector of four times four times three: {48|forty eight} entries.', code: 'flat' },
        { id: 'big', say: 'A {32 by 32|thirty two by thirty two} color photo works the same way: {3,072|three thousand and seventy two} numbers in one vector.', code: 'big' },
      ],
    },
    {
      id: 'ops',
      title: 'Adding and scaling',
      codeTitle: 'ops.py',
      code: `
        u = np.array([1, 2, 0])      #@u
        v = np.array([3, -1, 2])     #@u
        u + v      # [4, 1, 2]       #@add
        2 * u      # [2, 4, 0]       #@scale
        v4 = np.array([3, -1, 2, 4])  #@bad
        u + v4     # error: 3 vs 4   #@bad
      `,
      beats: [
        { id: 'add', say: 'Two vectors of the same length add entry by entry: first plus first, second plus second, third plus third.', code: ['u', 'add'] },
        { id: 'scale', say: 'Multiplying by a number scales every entry. Two times u doubles each one.', code: 'scale' },
        { id: 'same', say: 'The lengths have to match. Give v a fourth entry, and u has nothing to add to it.', code: 'bad' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
