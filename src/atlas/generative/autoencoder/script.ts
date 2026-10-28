import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-autoencoder',
  title: 'Autoencoders',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Hinton & Salakhutdinov', year: 2006, title: 'Reducing the dimensionality of data with neural networks', url: 'https://doi.org/10.1126/science.1127647', scene: 'halves' },
  ],
  scenes: [
    {
      id: 'squeeze',
      title: 'Copy it through a narrow middle',
      codeTitle: 'copy.py',
      code: `
        x = img.reshape(784)  # the digit  #@x
        # out = net(x): aim for out == x   #@copy
        # middle 784 wide: just copies x   #@wide
        # middle 16 wide: must summarize   #@narrow
      `,
      beats: [
        { id: 'digit', say: 'Here is a handwritten seven: twenty eight by twenty eight pixels, so seven hundred and eighty four numbers. Call them x.', code: 'x' },
        { id: 'strokes', say: 'Yet a seven is just two pen strokes. Most of those numbers follow from a few facts: where the strokes run, how they slant, how thick the pen was.', code: 'x' },
        { id: 'goal', say: 'Can a network learn to describe each digit in far fewer numbers, from the images alone? Alone means without labels: nobody writes down, for each image, which digit it shows.', code: 'x' },
        { id: 'copy', say: 'The trick is to ask for a copy. The network takes the image in, and must give the same image back out.', code: 'copy' },
        { id: 'wide', say: 'If every layer is seven hundred and eighty four wide, that is too easy: it can pass each pixel straight through. A perfect copy, and nothing learned about digits.', code: 'wide' },
        { id: 'narrow', say: 'So squeeze the middle down to sixteen numbers, and a copy is impossible. To rebuild the digit anyway, those sixteen must keep what matters most: the strokes, their slant, their thickness.', code: 'narrow' },
        { id: 'neck', say: 'That narrow middle is the bottleneck: like the neck of a bottle, it lets only so much through.', code: 'narrow' },
      ],
    },
    {
      id: 'halves',
      title: 'Encoder, code, decoder',
      codeTitle: 'autoencoder.py',
      code: `
        h = relu(W1 @ x + b1)    # 256  #@enc
        z = W2 @ h + b2          # 16   #@z
        x_hat = decode(z)        # 784  #@dec
        784 / 16                 # 49.0 #@ratio
        # W1: (256, 784)  W2: (16, 256) #@shape
        # W3: (256, 16)  W4: (784, 256) #@mirror
      `,
      beats: [
        { id: 'enc', say: 'The half before the bottleneck is the encoder, an ordinary network: its layers take the seven hundred and eighty four numbers of x to two hundred and fifty six hidden units, then to sixteen.', code: 'enc' },
        { id: 'z', say: 'Those sixteen numbers are the code, z: the digit, written in the network\'s own shorthand.', code: 'z' },
        { id: 'dec', say: 'The other half, the decoder, mirrors it back up to seven hundred and eighty four. Its output is the reconstruction, {x̂|x hat}: the hat marks x as the network rebuilt it.', code: 'dec' },
        { id: 'name', say: 'The whole thing is an autoencoder. Auto means self: it encodes its own input, then decodes it back.', code: ['enc', 'dec'] },
        { id: 'ratio', say: 'Each number of the code stands in for seven hundred and eighty four over sixteen: forty nine numbers of the input.', code: 'ratio' },
        { id: 'shape', say: 'Each weight matrix is outputs by inputs, one row per output. So the encoder\'s first, {W₁|W one}, is {256 by 784|two hundred fifty six by seven hundred eighty four}.', code: 'shape' },
        { id: 'mirror', say: 'The decoder\'s shapes are the encoder\'s, flipped: its last, {W₄|W four}, is {784 by 256|seven hundred eighty four by two hundred fifty six}.', code: 'mirror' },
        { id: 'deep', say: 'Deep autoencoders were hard to train: from small random weights, almost no gradient reached the early layers.', code: ['enc', 'dec'] },
        { id: 'hinton', say: 'In 2006, Geoffrey Hinton and Ruslan Salakhutdinov found a better way to start the weights. Their autoencoder squeezed each digit into thirty numbers, and rebuilt it much better than a widely used method.', code: 'z' },
      ],
    },
    {
      id: 'loss',
      title: 'The input is its own target',
      codeTitle: 'loss.py',
      code: `
        x = np.array([1, 0, 2])         #@x
        x_hat = np.array([0.5, 0, 3])   #@x
        d = x - x_hat   # [0.5, 0, -1]  #@d
        L = np.sum(d ** 2)   # 1.25     #@L
      `,
      beats: [
        { id: 'loss', say: 'To train it, we need a loss, L: one number for how far the output lands from what it should be, which gradient steps push down.', code: 'L' },
        { id: 'target', say: 'And what it should be is the input itself. x is its own target, so no labels are needed.', code: 'x' },
        { id: 'diff', say: 'Take a tiny x: one, zero and two. Say {x̂|x hat} came out as a half, zero and three. Entry by entry, the differences are a half, zero and minus one.', code: 'd' },
        { id: 'square', say: 'Square each, so a miss below costs the same as a miss above, and add: a quarter, plus zero, plus one, is {1.25|one point two five}. That is the squared error.', code: 'L' },
        { id: 'norm', say: 'It is written {‖x − x̂‖²|the norm of x minus x hat, squared}. The double bars, read “norm”, give a vector\'s size as an arrow; squared, that is just this sum of squares.', code: 'L' },
        { id: 'train', say: 'Gradient steps on this loss, back through the decoder and then the encoder, train both halves together, on any pile of images: each is its own target.', code: 'L' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
