import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-res-block',
  title: 'Residual blocks',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'He, Zhang, Ren & Sun', year: 2015, title: 'Deep residual learning for image recognition', url: 'https://arxiv.org/abs/1512.03385', scene: 'block' },
  ],
  scenes: [
    {
      id: 'block',
      title: 'A block of convs',
      codeTitle: 'block.py',
      code: `
        def block(x):
            out = relu(conv1(x))        #@F
            out = conv2(out)   # F(x)   #@F
            out = x + out    # x + F(x) #@add
            return relu(out)  # then ReLU #@relu
      `,
      beats: [
        { id: 'recap', say: 'A residual block adds its input back: {y = x + F(x)|y equals x plus F of x}. Its layers, F, only learn the change, what is left over: the residual.', code: 'add' },
        { id: 'conv', say: 'In a ConvNet, x is a stack of channels, and F is two convs with a ReLU between. Here F names the layers, not a filter size.', code: 'F' },
        { id: 'entries', say: 'The sum goes entry by entry, at every channel and position. Take three of x\'s numbers: two plus a half is two and a half, and so on down.', code: 'add' },
        { id: 'relu', say: 'In the first residual networks, from Kaiming He and colleagues in 2015, a ReLU follows the sum. So the minus a half becomes zero, while the two and a half and the two stay.', code: 'relu' },
      ],
    },
    {
      id: 'clash',
      title: 'When F changes the shape',
      codeTitle: 'shapes.py',
      code: `
        x.shape            # (64, 8, 8)  #@x
        conv1 = nn.Conv2d(64, 128, 3,    #@c1
                stride=2, padding=1)     #@c1
        # (8 - 3 + 2) / 2 + 1 = 4.5 -> 4 #@round
        conv2 = nn.Conv2d(128, 128, 3,   #@c2
                padding=1)               #@c2
        out.shape          # (128, 4, 4) #@F
        x + out   # shapes clash: error  #@clash
      `,
      beats: [
        { id: 'stages', say: 'But a ConvNet changes shape as it goes: stage by stage, fewer positions and more channels. So some residual blocks have to change the shape themselves.', code: 'c1' },
        { id: 'x', say: 'Take an x with sixty four channels, eight by eight: {(64, 8, 8)|sixty four by eight by eight}.', code: 'x' },
        { id: 'first', say: 'This block\'s first conv, with a hundred and twenty eight filters, makes a hundred and twenty eight channels. And its stride is two, so it lands on every other position.', code: 'c1' },
        { id: 'round', say: 'Its width: eight minus three, plus two for the padding, over two, plus one, is four and a half, rounded down to four.', code: 'round' },
        { id: 'second', say: 'The second conv, stride one and padding one, keeps four by four. So F of x is {(128, 4, 4)|a hundred and twenty eight by four by four}.', code: ['c2', 'F'] },
        { id: 'clash', say: 'Now try the sum. F of x is twice as deep as x, and half as wide. Their entries do not pair up one to one, so the two cannot be added.', code: 'clash' },
      ],
    },
    {
      id: 'fit',
      title: 'A 1 × 1 conv on the shortcut',
      codeTitle: 'shortcut.py',
      code: `
        cut = nn.Conv2d(64, 128, 1,      #@cut
                        stride=2)        #@stride
        # (8 - 1) / 2 + 1 = 4.5 -> 4     #@stride
        cut(x).shape    # (128, 4, 4)    #@sum
        out = cut(x) + out   # it adds   #@sum
        # same shape: the shortcut is x  #@same
      `,
      beats: [
        { id: 'need', say: 'So the shortcut has to reshape x the same way, while changing as little else as it can. It gets a conv of its own, with filters one position wide: a one by one conv.', code: 'cut' },
        { id: 'mix', say: 'A one by one filter still reaches through every channel. At each position, it mixes the sixty four numbers there into one, and looks at nothing around them.', code: 'cut' },
        { id: 'filters', say: 'A hundred and twenty eight such filters make a hundred and twenty eight channels, as many as F makes.', code: 'cut' },
        { id: 'stride', say: 'Stride two, with no padding, lands on every other position, the very positions F\'s first conv was centered on. Eight minus one, over two, plus one, is four and a half: four.', code: 'stride' },
        { id: 'sum', say: 'So the shortcut gives {(128, 4, 4)|a hundred and twenty eight by four by four}, the shape of F of x, and the sum works.', code: 'sum' },
        { id: 'proj', say: 'The 2015 paper matched shapes this way in its deepest networks, and called it a projection shortcut: it carries x over into F\'s shape.', code: 'cut' },
        { id: 'same', say: 'In every block that keeps the shape, the shortcut stays x itself, with nothing to learn.', code: 'same' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
