import type { LectureScript } from '../../../lecture/types';

const code = `
  def block(x):
      out = relu(layer1(x))               #@F
      out = layer2(out)                   #@F
      return x + out    # y = x + F(x)    #@add
  # backward: x gets g * (1 + F')         #@grad
  h = block1(x); y = block2(h)            #@stack
  # x gets g * (1 + F2') * (1 + F1')      #@chain
`;

export const script: LectureScript = {
  id: 'atlas-residual',
  title: 'Residual connections',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'gradient',
      title: 'Add the input back',
      codeTitle: 'block.py',
      code,
      beats: [
        { id: 'plain', say: 'A plain layer replaces its input with something new. A residual block keeps its input, x, and adds a change to it.', code: 'F' },
        { id: 'add', say: 'The layers inside, a linear layer, a ReLU and another linear layer, compute a function of x, written {F(x)|F of x}. A shortcut carries x around them, and the two are added: {y = x + F(x)|y equals x plus F of x}.', code: 'add' },
        { id: 'example', say: 'With x at two and F of x at a half, y is two and a half. And to leave its input alone, a block only has to make F zero, so an extra block need not make the network worse.', code: 'add' },
        { id: 'split', say: 'Going backward, the sum is an add gate: it hands the gradient arriving at y, g, to both of its inputs.', code: 'grad' },
        { id: 'paths', say: 'Along the shortcut, g reaches x unchanged. Through F, it gets multiplied by F\'s slope, {F′|F prime}.', code: 'grad' },
        { id: 'formula', say: 'The two paths add up at x: g times one plus F prime. With g equal to two and a slope of a half, that is three.', code: 'grad' },
        { id: 'stack', say: 'Now stack two blocks. The first turns x into h, through layers {F₁|F one}. The second turns h into y, through layers {F₂|F two}.', code: 'stack' },
        { id: 'back2', say: 'Walking back, each block multiplies the gradient by one plus its slope. Say g is one, and {F₂′|F two prime} is one: block two hands h one times two, which is two.', code: 'chain' },
        { id: 'back1', say: 'Block one, with {F₁′|F one prime} at minus a half, hands x two times a half: one. The blocks are in a chain, so their factors multiply.', code: 'chain' },
        { id: 'deep', say: 'Now stack fifty layers. If each one halves the gradient, almost nothing reaches the first. With shortcuts, each block multiplies by one plus a slope, so the gradient arrives intact.', code: 'grad' },
      ],
    },
    {
      id: 'try',
      title: 'Try two',
      codeTitle: 'try.py',
      code: `
        g, dF = 2, 3                     #@p1
        g * 1 + g * dF      # 2 + 6 = 8  #@a1
        g, dF1, dF2 = 4, 1, -0.5         #@p2
        dh = g * (1 + dF2)  # 2          #@b2
        dx = dh * (1 + dF1) # 4          #@b1
      `,
      beats: [
        { id: 'p1', say: 'Try one: at the current value, F prime of x is three, and the gradient arriving at y, g, is two. What gradient reaches x?', code: 'p1' },
        { id: 'a1', say: 'The shortcut hands x two, unchanged. Through F, it is two times three: six. The paths add: two plus six, eight.', code: 'a1' },
        { id: 'p2', say: 'Now two stacked blocks: {F₁′|F one prime} is one, {F₂′|F two prime} is minus a half, and g is four. What reaches x?', code: 'p2' },
        { id: 'a2', say: 'Block two hands h four times one minus a half: two. Block one hands x two times one plus one: four.', code: ['b2', 'b1'] },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
