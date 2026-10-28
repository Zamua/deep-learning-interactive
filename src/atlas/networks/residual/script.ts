import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-residual',
  title: 'Residual connections',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'He, Zhang, Ren & Sun', year: 2015, title: 'Deep residual learning for image recognition', url: 'https://arxiv.org/abs/1512.03385', scene: 'deep' },
    { who: 'He, Zhang, Ren & Sun', year: 2016, title: 'Identity mappings in deep residual networks', url: 'https://arxiv.org/abs/1603.05027', scene: 'back' },
  ],
  scenes: [
    {
      id: 'deep',
      title: 'Deeper should be better',
      codeTitle: 'plain.py',
      code: `
        # x -> 10 layers -> output        #@stack
        g = 1.0            # at the output #@g
        for layer in range(10):           #@fade
            g = g * 0.5    # its slope    #@fade
        print(g)     # 0.00098: about 0.001 #@fade
        # plain, 20 layers: trains well   #@deep
        # plain, 56 layers: trains worse  #@deep
        # 56 = the 20, + 36 that copy x   #@copy
      `,
      beats: [
        { id: 'stack', say: 'Here is a plain network: a stack of layers, each one feeding the next. More layers can compute more, so a deeper stack ought to do at least as well as a shallow one.', code: 'stack' },
        { id: 'train', say: 'Training it means taking gradient steps: every weight moves against its own gradient. Backprop finds those gradients by walking back from the output, where the gradient, g, starts at one.', code: 'g' },
        { id: 'fade', say: 'Each layer it passes through multiplies g by that layer\'s local slope. Say every slope is a half. After ten layers, about a thousandth is left, so the first layers hardly learn at all.', code: 'fade' },
        { id: 'deeper', say: 'Careful starting weights, and layers that rescale the numbers in between, let networks tens of layers deep start to learn. But in 2015, Kaiming He, Xiangyu Zhang, Shaoqing Ren and Jian Sun found that going deeper still made things worse.', code: 'deep' },
        { id: 'worse', say: 'On small photos in ten classes, a plain network fifty six layers deep did worse than one with twenty. Worse even on the very images it was trained on, its training data: the deeper network was simply harder to train.', code: 'deep' },
        { id: 'copy', say: 'That is strange, because the deep one could copy the shallow one: the same twenty layers, plus thirty six that pass their input along unchanged. Training just never found that.', code: 'copy' },
      ],
    },
    {
      id: 'add',
      title: 'Add the input back',
      codeTitle: 'block.py',
      code: `
        def block(x):
            out = relu(layer1(x))         #@F
            out = layer2(out)  # F(x)     #@F
            return x + out   # y = x + F(x) #@add
        # all of F at 0: block(x) is x  #@zero
        # F learns y - x: the residual    #@name
      `,
      beats: [
        { id: 'fix', say: 'Their fix was to group the layers into blocks: here, two layers with a ReLU between, like a two layer network. Call what a block\'s layers compute from x, {F(x)|F of x}.', code: 'F' },
        { id: 'shortcut', say: 'Then give the block a shortcut: a wire with no weights at all, carrying x around the layers, untouched, to meet their output.', code: 'add' },
        { id: 'sum', say: 'There the two are added: {y = x + F(x)|y equals x plus F of x}. With x at two, and F of x at a half, y is two and a half.', code: 'add' },
        { id: 'zero', say: 'Now passing x along is easy. Set everything F learns to zero, and F gives zero, so y is just x. A block with nothing to add can leave its input alone, so an extra block need not make things worse.', code: 'zero' },
        { id: 'name', say: 'That is where the name comes from. The layers no longer have to make y, only the change from x to y, {y − x|y minus x}: what is left over, called the residual.', code: 'name' },
        { id: 'won', say: 'With shortcuts, depth paid off. The fifty six layer network now beat the twenty layer one, and residual networks up to a hundred and fifty two layers deep won the 2015 ImageNet contest in recognizing photos.', code: 'add' },
      ],
    },
    {
      id: 'back',
      title: 'The gradient takes the shortcut',
      codeTitle: 'backward.py',
      code: `
        # y = x + F(x): an add gate       #@split
        # shortcut: g reaches x unchanged #@paths
        # through F: g * dF (dF is F')   #@paths
        g * (1 + dF)    # 2 * 1.5 = 3     #@formula
        # x -> block1 -> h -> block2 -> y #@stack
        g * (1 + dF2) * (1 + dF1)         #@chain
        # 1 * 2 * 0.5 = 1                 #@chain
      `,
      beats: [
        { id: 'split', say: 'Going backward, the sum is an add gate: it hands the gradient arriving at y, g, to both of its inputs.', code: 'split' },
        { id: 'paths', say: 'Along the shortcut, g reaches x unchanged. Through F, it gets multiplied by F\'s slope, {F′|F prime}.', code: 'paths' },
        { id: 'formula', say: 'The two paths add up at x: g times one plus F prime. With g equal to two and a slope of a half, that is three.', code: 'formula' },
        { id: 'stack', say: 'Now stack two blocks: the first turns x into h, and the second turns h into y.', code: 'stack' },
        { id: 'names', say: 'Each has its own layers, numbered by block: {F₁|F one} in the first, and {F₂|F two} in the second.', code: 'stack' },
        { id: 'back2', say: 'Walking back, each block multiplies the gradient by one plus its slope. Say g is one, and {F₂′|F two prime} is one: block two hands h one times two, which is two.', code: 'chain' },
        { id: 'back1', say: 'Block one, with {F₁′|F one prime} at minus a half, hands x two times a half: one. The blocks are in a chain, so their factors multiply.', code: 'chain' },
        { id: 'deep', say: 'Back to the deep stack. Plain, every layer kept only half, and almost nothing reached the first. With shortcuts, one path back runs only along shortcuts, with no slopes to multiply, so g reaches the first block whole, and the paths through the layers add to it.', code: 'chain' },
        { id: 'proof', say: 'The same four authors spelled this out in 2016: through shortcuts that pass x unchanged, the gradient goes straight from any block back to any earlier one.', code: 'chain' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
