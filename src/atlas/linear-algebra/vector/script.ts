import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-vector',
  title: 'Vectors',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Hamilton', year: 1846, title: 'On quaternions; or on a new system of imaginaries in algebra', url: 'https://doi.org/10.1080/14786444608562593', scene: 'arrow' },
  ],
  scenes: [
    {
      id: 'image',
      title: 'A picture as numbers',
      codeTitle: 'image.py',
      code: `
        # img: a tiny color image     #@img
        img.shape   # (4, 4, 3)       #@rgb
        x = img.reshape(-1)  # a row  #@flat
        x.shape     # (48,)           #@flat
        # 32 * 32 * 3 = 3072          #@big
      `,
      beats: [
        { id: 'numbers', say: 'A program cannot see a picture: all it can work with is numbers. So first, an image has to become numbers.', code: 'img' },
        { id: 'rgb', say: 'Take this tiny color image, four pixels by four. Each pixel, one small square of color, is three numbers: how much red, green and blue.', code: 'rgb' },
        { id: 'flat', say: 'Lay them all out in one row: pixel after pixel, red, green, then blue. Four times four times three: {48|forty eight} numbers.', code: 'flat' },
        { id: 'vector', say: 'A list of numbers in a fixed order is called a vector: here, the whole image as one object. The order tells the numbers apart: the first is always the top left pixel\'s red.', code: 'flat' },
        { id: 'big', say: 'A {32 by 32|thirty two by thirty two} color photo works the same way: {3,072|three thousand and seventy two} numbers in one vector.', code: 'big' },
      ],
    },
    {
      id: 'arrow',
      title: 'Two numbers, one arrow',
      codeTitle: 'arrow.py',
      code: `
        x = np.array([3, 2])       #@x
        # 3 across, 2 up           #@x
        # 2 numbers: 2 dimensions  #@dim
        x = np.array([3, 2, 1])    #@three
        # 3 numbers: 3 dimensions  #@three
        # 48 numbers: 48-D         #@more
      `,
      beats: [
        { id: 'point', say: 'Now a vector of just two numbers, three and two. On a graph, they say where to go: three across, then two up.', code: 'x' },
        { id: 'arrow', say: 'Or draw it as an arrow: from the origin, the corner where both numbers are zero, out to the point.', code: 'x' },
        { id: 'name', say: 'In 1846, the Irish mathematician William Rowan Hamilton called such a line, with a length and a direction, a vector: Latin for carrier. It carries you from the origin to the point.', code: 'x' },
        { id: 'dim', say: 'Each number moves you along a direction of its own: the first across, the second up. Two directions make a flat plane, with two dimensions: a vector\'s dimension is how many numbers it holds.', code: 'dim' },
        { id: 'three', say: 'A third number adds a third direction, out of the page: three dimensions, like a room.', code: 'three' },
        { id: 'more', say: 'Past three, no picture fits, but the count still works: the image\'s {48|forty eight} numbers make a {48-dimensional|forty eight dimensional} vector.', code: 'more' },
      ],
    },
    {
      id: 'list',
      title: 'Count and index',
      codeTitle: 'vector.py',
      code: `
        x = np.array([3, -1, 4, 2])   #@x
        len(x)      # 4               #@len
        x.shape     # (4,)            #@shape
        # in math: x ∈ ℝ⁴             #@in
        x[0]        # 3, the first    #@x0
        x[3]        # 2, the last     #@x3
        x[4]        # IndexError      #@x4
      `,
      beats: [
        { id: 'list', say: 'Longer vectors are written as lists. This x holds four numbers: three, minus one, four and two.', code: 'x' },
        { id: 'len', say: 'Four numbers, so x is four-dimensional. Python calls that count its length, and NumPy writes its shape as {(4,)|four, comma}: one row of four.', code: ['len', 'shape'] },
        { id: 'reals', say: 'In math, the real numbers, all the points on the number line, are written {ℝ|as a double-struck R}. Lists of four of them make {ℝ⁴|R four}.', code: 'in' },
        { id: 'in', say: 'So {x ∈ ℝ⁴|x in R four} says x is a list of four real numbers. The sign {∈|in the middle} means “is in”.', code: 'in' },
        { id: 'index', say: 'Each entry has an index, its position, in square brackets. Python counts from zero, so {x[0]|x of zero} is the first entry: three.', code: 'x0' },
        { id: 'last', say: 'So the last of four is {x[3]|x of three}, which is two, and there is no {x[4]|x of four}: the last index is one less than the count.', code: ['x3', 'x4'] },
      ],
    },
    {
      id: 'ops',
      title: 'Add and scale',
      codeTitle: 'ops.py',
      code: `
        u = np.array([1, 2])        #@u
        v = np.array([3, -1])       #@v
        u + v     # [4, 1]          #@add
        2 * u     # [2, 4]          #@scale
        -1 * u    # [-1, -2]        #@neg
        v3 = np.array([3, -1, 2])   #@bad
        u + v3    # error: 2 vs 3   #@bad
      `,
      beats: [
        { id: 'two', say: 'Take two vectors, u and v: u is one, two, and v is three, minus one.', code: ['u', 'v'] },
        { id: 'add', say: 'Add them entry by entry, first with first and second with second: u plus v is four, one.', code: 'add' },
        { id: 'tail', say: 'On the graph, that is one arrow after the other: follow the arrow u, then v from where it ends, and the walk ends at four, one.', code: 'add' },
        { id: 'scale', say: 'Multiply by a number, and every entry is multiplied: two times u is two, and four. The arrow keeps its direction and grows twice as long, which is why this is called scaling.', code: 'scale' },
        { id: 'neg', say: 'A negative number turns it around: minus one times u is minus one, and minus two.', code: 'neg' },
        { id: 'same', say: 'Adding needs the same number of entries. Give v a third, and u has none to match it: NumPy refuses.', code: 'bad' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
