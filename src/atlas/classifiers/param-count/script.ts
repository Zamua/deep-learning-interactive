import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-param-count',
  title: 'Parameter count',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'line',
      title: 'A classifier is its numbers',
      codeTitle: 'line.py',
      code: `
        w = np.array([{{w0:1}}, {{w1:1}}])  # turns it  #@w
        b = {{b:-4}}                # slides it  #@b
        # w and b: 3 parameters            #@n
        x = np.array([{{x0:2}}, {{x1:4}}])  # an input  #@x
      `,
      beats: [
        { id: 'open', say: 'A classifier keeps a set of numbers, and each must be chosen well for it to work. How many are there, and what makes that count grow?', code: ['w', 'b'] },
        { id: 'line', say: 'Take the line between cats and ships, drawn from two features. Its two weights, in w, turn it, and its bias, b, slides it.', code: ['w', 'b'] },
        { id: 'three', say: 'Those three numbers are the whole classifier. Choose them, and you have chosen one line out of all the lines you could draw.', code: 'n' },
        { id: 'name', say: 'Numbers that pick out one member of a whole family like this are called parameters. You know two already: m and b are the parameters of {y = mx + b|y equals m x plus b}.', code: 'n' },
        { id: 'input', say: 'The points are not parameters. They are inputs, a new one with every image: the inputs pass through, and the parameters stay put.', code: 'x' },
      ],
    },
    {
      id: 'block',
      title: 'One row per class',
      codeTitle: 'count.py',
      code: `
        D = 4                 # features  #@D
        C = 3                 # classes   #@C
        W = np.zeros((C, D))  # (3, 4)    #@W
        b = np.zeros(C)       # (3,)      #@b
        W.size + b.size       # 12 + 3    #@n
        # in general: C*D + C             #@rule
      `,
      beats: [
        { id: 'D', say: 'Now give it more features: D of them, four here. A class weighs every feature, so its weights fill a row of D numbers.', code: 'D' },
        { id: 'C', say: 'Each class gets its own row, as in the matrix W. With C classes, three here, W is C rows by D columns.', code: ['C', 'W'] },
        { id: 'weights', say: 'Three rows of four: twelve weights.', code: 'W' },
        { id: 'bias', say: 'Then each class adds one bias, in a column beside W: three more.', code: 'b' },
        { id: 'total', say: 'Twelve plus three: fifteen parameters. In general, C times D, plus C.', code: ['n', 'rule'] },
        { id: 'shape', say: 'As shapes, W is C by D, three by four, and b holds C numbers. Not four by three: each row is dotted with the input, so it needs one weight per feature.', code: ['W', 'b'] },
      ],
    },
    {
      id: 'grows',
      title: 'What makes it grow',
      codeTitle: 'grow.py',
      code: `
        D = 2 * 2        # 4: gray pixels   #@px
        D = 4 * 4        # 16: 2x the sides #@side
        D = 4 * 4 * 3    # 48: in color     #@color
        D = 32 * 32 * 3  # 3,072: a photo   #@photo
        10 * D + 10      # 30,730           #@photo
        20 * D + 20      # 61,460: 2x       #@class
        # more images: no change            #@data
      `,
      beats: [
        { id: 'px', say: 'Where do the features come from? Often straight from an image, one per pixel. A tiny gray image, two pixels by two, gives four, so D is four.', code: 'px' },
        { id: 'side', say: 'Make it twice as wide and twice as tall, and it has four times the pixels. Every row of W grows four times as long: three times sixteen, plus three, is fifty one.', code: 'side' },
        { id: 'color', say: 'Make it color, and each pixel brings three numbers, for red, green and blue. D triples to forty eight, and so do the weights.', code: 'color' },
        { id: 'photo', say: 'A real photo works the same way, only bigger. A {32 by 32|thirty two by thirty two} color photo is {3,072|three thousand and seventy two} numbers, so ten classes take ten rows that long, plus ten biases: {30,730|thirty thousand, seven hundred and thirty} parameters.', code: 'photo' },
        { id: 'class', say: 'Make it twenty classes instead of ten, and the rows and the biases both double. So does the whole count.', code: 'class' },
        { id: 'data', say: 'What never enters the count is how many images it scores. Ten or a million, W and b keep their shape.', code: 'data' },
      ],
    },
    {
      id: 'chain',
      title: 'Two maps in a row',
      codeTitle: 'chain.py',
      code: `
        W @ x + b        # D -> C numbers  #@one
        h = W1 @ x + b1  # 4 -> 5 numbers  #@m1
        W2 @ h + b2      # 5 -> 3 scores   #@m2
        W1.shape  # (5, 4): (H, D)         #@W1
        b1.shape  # (5,): one per output   #@b1
        4 * 5 + 5        # 25              #@c1
        W2.shape  # (3, 5): (C, H)         #@W2
        5 * 3 + 3        # 18              #@c2
        25 + 18          # 43              #@sum
      `,
      beats: [
        { id: 'map', say: 'Look again at W x plus b: it turns D numbers into C. A rule that carries each input to an output is called a map, and this one, weights times inputs plus a bias, is a linear map.', code: 'one' },
        { id: 'chain', say: 'Its outputs need not be class scores. As with matrices in a chain, one map can hand its outputs to the next: a first map turns the four inputs into numbers in the middle, and a second turns those into the three scores.', code: ['m1', 'm2'] },
        { id: 'H', say: 'How many numbers sit in the middle is up to whoever builds it. Call that H: here, five.', code: 'm1' },
        { id: 'W1', say: 'The first map has its own weights, {W₁|W one}: one row per output and one column per input, so H by D, five by four.', code: 'W1' },
        { id: 'b1', say: 'And its own biases, {b₁|b one}: one per output, so five.', code: 'b1' },
        { id: 'c1', say: 'So the first map holds four times five weights, plus five biases: twenty five parameters.', code: 'c1' },
        { id: 'W2', say: 'The second map counts the same way. Its weights, {W₂|W two}, are C by H: three by five.', code: 'W2' },
        { id: 'c2', say: 'Its biases, {b₂|b two}, are one per class. Fifteen weights plus three biases: eighteen.', code: 'c2' },
        { id: 'sum', say: 'Add the two maps: forty three. Each one counts as inputs times outputs, plus one bias per output.', code: 'sum' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
