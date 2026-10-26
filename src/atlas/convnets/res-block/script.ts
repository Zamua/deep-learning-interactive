import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-res-block',
  title: 'Residual blocks',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'block',
      title: 'Add a change to the input',
      codeTitle: 'block.py',
      code: `
        def block(x):
            out = relu(conv1(x))                #@F
            out = conv2(out)                    #@F
            return x + out    # y = x + F(x)    #@add
      `,
      beats: [
        { id: 'plain', say: 'A plain layer replaces its input with something new. A residual block keeps its input, x, and adds a change to it.', code: 'F' },
        { id: 'add', say: 'The layers inside, a conv, a ReLU and another conv, compute a function of x, written {F(x)|F of x}. Here F names that function, not a filter size. A shortcut carries x around them, and the two are added: {y = x + F(x)|y equals x plus F of x}.', code: 'add' },
        { id: 'example', say: 'If x is two, minus one and three, and F gives a half, a half and minus one, then y is two and a half, minus a half, and two.', code: 'add' },
        { id: 'zero', say: 'To leave its input alone, a block only has to make F zero. So an extra block need not make the network worse.', code: 'add' },
      ],
    },
    {
      id: 'match',
      title: 'Match the shapes',
      codeTitle: 'shapes.py',
      code: `
        x.shape          # (64, 8, 8)             #@x
        conv1 = nn.Conv2d(64, 128, 3,             #@c1
                          stride=2, padding=1)    #@c1
        # (8 - 3 + 2) / 2 + 1 = 4.5, down to 4    #@round
        conv2 = nn.Conv2d(128, 128, 3, padding=1) #@c2
        F(x).shape       # (128, 4, 4)            #@F
        cut = nn.Conv2d(64, 128, 1, stride=2)     #@cut
        # (8 - 1) / 2 + 1 = 4.5, down to 4        #@check
        y = cut(x) + F(x)  # (128, 4, 4)          #@check
      `,
      beats: [
        { id: 'need', say: 'The sum needs x and F of x in the same shape. Take an x with sixty four channels, eight by eight: {(64, 8, 8)|sixty four by eight by eight}.', code: 'x' },
        { id: 'keep', say: 'If F\'s convs have sixty four filters, stride one and padding one, F of x has that shape too, and the shortcut is x itself.', code: 'x' },
        { id: 'first', say: 'Now give F\'s first conv a hundred and twenty eight filters, and stride two. A hundred and twenty eight filters make a hundred and twenty eight channels.', code: 'c1' },
        { id: 'round', say: 'Its width: eight minus three, plus two for the padding, over two, plus one. That is four and a half. It is not whole, so it rounds down: four.', code: 'round' },
        { id: 'second', say: 'The second conv, stride one and padding one, keeps four by four. So F of x is {(128, 4, 4)|a hundred and twenty eight by four by four}, and x cannot be added to it.', code: ['c2', 'F'] },
        { id: 'cut', say: 'So the shortcut becomes a one by one conv, with F\'s channels, a hundred and twenty eight filters, and F\'s stride, two.', code: 'cut' },
        { id: 'check', say: 'Its width, with no padding: eight minus one, over two, plus one, is four and a half again, so four. The shortcut gives {(128, 4, 4)|a hundred and twenty eight by four by four}, and the sum works.', code: 'check' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
