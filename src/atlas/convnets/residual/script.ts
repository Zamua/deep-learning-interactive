import type { LectureScript } from '../../../lecture/types';

const code = `
  def block(x):
      out = relu(conv1(x))                #@F
      out = conv2(out)                    #@F
      return x + out    # y = x + F(x)    #@add
  # backward: x gets g * (1 + dF)         #@grad
  shortcut = nn.Conv2d(64, 128, 1, stride=2)  #@match
`;

export const script: LectureScript = {
  id: 'atlas-residual',
  title: 'Residual connections',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'block',
      title: 'Add a change to the input',
      codeTitle: 'block.py',
      code,
      beats: [
        { id: 'plain', say: 'A plain layer replaces its input with something new. A residual block keeps its input, x, and adds a change to it.', code: 'F' },
        { id: 'add', say: 'The layers inside, a conv, a ReLU and another conv, compute F of x. A shortcut carries x around them, and the two are added: y equals x plus F of x.', code: 'add' },
        { id: 'example', say: 'If x is two, minus one and three, and F gives a half, a half and minus one, then y is two and a half, minus a half, and two.', code: 'add' },
        { id: 'zero', say: 'To leave its input alone, a block only has to make F zero. So an extra block need not make the network worse.', code: 'add' },
        { id: 'match', say: 'The sum needs x and F of x in the same shape. When F shrinks the size with a stride, or changes the channels, the shortcut becomes a one by one conv with that stride, to match.', code: 'match' },
      ],
    },
    {
      id: 'gradient',
      title: 'A direct path back',
      codeTitle: 'block.py',
      code,
      beats: [
        { id: 'split', say: 'Going backward, the sum is an add gate: it hands the gradient arriving at y, g, to both of its inputs.', code: 'grad' },
        { id: 'paths', say: 'Along the shortcut, g reaches x unchanged. Through F, it gets multiplied by F\'s slope, F prime.', code: 'grad' },
        { id: 'formula', say: 'The two paths add up at x: g times one plus F prime. With g equal to two and a slope of a half, that is three.', code: 'grad' },
        { id: 'deep', say: 'Now stack fifty layers. If each one halves the gradient, almost nothing reaches the first. With shortcuts, each block multiplies by one plus a slope, so the gradient arrives intact.', code: 'grad' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
