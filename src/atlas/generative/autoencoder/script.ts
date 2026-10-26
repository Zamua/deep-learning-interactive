import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-autoencoder',
  title: 'Autoencoders',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'squeeze',
      title: 'Squeeze it, then rebuild it',
      codeTitle: 'autoencoder.py',
      code: `
        x = img.reshape(784)              #@x
        h = relu(W1 @ x + b1)     # 256   #@enc
        z = W2 @ h + b2           # 16    #@enc
        x_hat = decode(z)         # 784   #@dec
        784 / 16                  # 49.0  #@ratio
      `,
      beats: [
        { id: 'input', say: 'Here is a handwritten digit, twenty eight by twenty eight pixels: seven hundred and eighty four numbers. Call them x.', code: 'x' },
        { id: 'encode', say: 'An encoder, an ordinary network of layers, maps x down: to two hundred and fifty six hidden units, then to just sixteen numbers. Those sixteen are the code, z.', code: 'enc' },
        { id: 'decode', say: 'A decoder, a second network, mirrors it: from sixteen back up to two hundred and fifty six, then to seven hundred and eighty four. Its output is the reconstruction, written {x̂|x hat}: the hat marks x as the network rebuilt it.', code: 'dec' },
        { id: 'ratio', say: 'The narrow middle is the bottleneck. Each number of the code has to stand for seven hundred and eighty four over sixteen: forty nine numbers of the input.', code: 'ratio' },
      ],
    },
    {
      id: 'loss',
      title: 'The input is the target',
      codeTitle: 'loss.py',
      code: `
        x = np.array([1, 0, 2])         #@x
        x_hat = np.array([0.5, 0, 3])   #@x
        d = x - x_hat    # [0.5, 0, -1] #@d
        loss = np.sum(d ** 2)  # 1.25   #@loss
      `,
      beats: [
        { id: 'target', say: 'How is it trained? There are no labels here. The target is the input itself: the output should come back equal to x.', code: 'x' },
        { id: 'diff', say: 'So compare them entry by entry. Say x is one, zero and two, and {x̂|x hat} is a half, zero and three. The differences are a half, zero, and minus one.', code: 'd' },
        { id: 'square', say: 'Square them and add: a quarter, plus zero, plus one, which is {1.25|one point two five}. That squared error is the loss, {L = ‖x − x̂‖²|L equals the norm of x minus x hat, squared}. The double bars, read “norm”, give a vector\'s size as an arrow, the square root of its squared entries added up, so its square is just this sum of squares.', code: 'loss' },
        { id: 'train', say: 'A miss in either direction counts. Gradient steps on this loss train the encoder and the decoder together, and any pile of unlabeled images will do.', code: 'loss' },
      ],
    },
    {
      id: 'why',
      title: 'Why the middle is narrow',
      codeTitle: 'shapes.py',
      code: `
        # W1: (256, 784)   W2: (16, 256)    #@enc
        # W3: (256, 16)    W4: (784, 256)   #@dec
        k = 784   # as wide as x: copy it   #@wide
        k = 16    # too small to copy       #@narrow
      `,
      beats: [
        { id: 'shapes', say: 'Each weight matrix is outputs by inputs. The encoder has two fifty six by seven eighty four, then sixteen by two fifty six. The decoder mirrors it: two fifty six by sixteen, then seven eighty four by two fifty six.', code: ['enc', 'dec'] },
        { id: 'wide', say: 'Why squeeze at all? Make the middle as wide as the input, and the network can simply copy x through. The loss drops to zero, and the code has learned nothing about digits.', code: 'wide' },
        { id: 'narrow', say: 'With sixteen numbers, copying is impossible. To rebuild the image anyway, the code has to keep what matters most: the shape of the stroke, its slant, its thickness.', code: 'narrow' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
