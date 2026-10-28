import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-transformer-block',
  title: 'The transformer block',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Vaswani, Shazeer, Parmar, Uszkoreit, Jones, Gomez, Kaiser & Polosukhin', year: 2017, title: 'Attention Is All You Need', url: 'https://arxiv.org/abs/1706.03762', scene: 'why' },
    { who: 'Xiong, Yang, He, Zheng, Zheng, Xing, Zhang, Lan, Wang & Liu', year: 2020, title: 'On Layer Normalization in the Transformer Architecture', url: 'https://arxiv.org/abs/2002.04745', scene: 'norms' },
  ],
  scenes: [
    {
      id: 'why',
      title: 'Gather, then think',
      codeTitle: 'block.py',
      code: `
        def block(x):         # (T, d)   #@io
            x = attention(x)  # gather   #@gather
            x = mlp(x)        # alone    #@mlp
            return x          # (T, d)   #@io
      `,
      beats: [
        { id: 'gather', say: 'Self-attention lets every token gather from the others. In the sentence, cats like fish, fish comes out as a blend of their values: half from cats, a quarter from like, and a quarter from itself.', code: 'gather' },
        { id: 'alone', say: 'A blend moves information between tokens. To work on what it gathered, each token then goes through a small network on its own: the two-layer network, with a ReLU between its layers.', code: 'mlp' },
        { id: 'mlp', say: 'This network is called an MLP, for multilayer perceptron: neurons in layers, named after Rosenblatt\'s perceptron, though they bend with a ReLU rather than a step.', code: 'mlp' },
        { id: 'paper', say: 'In 2017, Ashish Vaswani and colleagues built a translation model around this pair: attention, then one MLP, applied to each token separately and identically. They called it the Transformer.', code: ['gather', 'mlp'] },
        { id: 'stack', say: 'One attention and one MLP make a block, and the model stacks identical blocks, six in the paper. So a block must hand back what it takes in: T tokens, each a vector of d numbers.', code: 'io' },
      ],
    },
    {
      id: 'parts',
      title: 'Two branches, two adds',
      codeTitle: 'block.py',
      code: `
        def block(x):              # (T, d)  #@io
            a = attention(ln1(x))            #@attn
            x = x + a                        #@add1
            m = mlp(ln2(x))                  #@mlp
            x = x + m                        #@add2
            return x               # (T, d)  #@io

        def mlp(u):           # one token
            h = relu(W1 @ u)  # 4d numbers   #@width
            return W2 @ h     # back to d    #@width
      `,
      beats: [
        { id: 'path', say: 'Now the block as it is really built. Draw a token\'s path straight down through it, from the input, x, to the output.', code: 'io' },
        { id: 'branch', say: 'Attention sits on a branch beside the path. The branch first runs layer norm, so attention reads every token on the same scale, then multi-head attention.', code: 'attn' },
        { id: 'add', say: 'Its output is added back onto the path: a residual connection, {x + Attn(LN(x))|x plus attention of layer norm of x}. So the branch only has to learn a change to x.', code: 'add1' },
        { id: 'grid', say: 'Inside, attention builds a T by T grid of weights, but it hands back one vector of d numbers per token: the shape of x. That is what lets the add line up.', code: 'attn' },
        { id: 'mlp', say: 'Then a second branch, built the same way: layer norm, the MLP, and another add.', code: ['mlp', 'add2'] },
        { id: 'width', say: 'The MLP widens each token to four d numbers, applies the ReLU there, and brings it back down to d. In the paper, d was {512|five hundred twelve}, so the middle was {2,048|two thousand and forty eight} wide.', code: 'width' },
        { id: 'out', say: 'Out comes T by d, the shape that went in, ready for the next block.', code: 'io' },
      ],
    },
    {
      id: 'norms',
      title: 'Where the norm goes',
      codeTitle: 'norms.py',
      code: `
        # 2017: add, then norm
        x = ln1(x + attention(x))   #@post
        x = ln2(x + mlp(x))         #@post
        # pre-norm: norm, then branch
        x = x + attention(ln1(x))   #@pre
        x = x + mlp(ln2(x))         #@pre
      `,
      beats: [
        { id: 'post', say: 'The 2017 paper put each layer norm somewhere else: after its add, right on the path.', code: 'post' },
        { id: 'road', say: 'Then the path itself runs through a norm in every block, and so does every gradient flowing back along it.', code: 'post' },
        { id: 'xiong', say: 'In 2020, Ruibin Xiong and colleagues showed what that costs. With the norms on the path, the gradients near the output start out large, so training has to begin with a small step size and raise it slowly.', code: 'post' },
        { id: 'pre', say: 'Move each norm to the start of its branch, and the path is bare: from input to output, only adds, like a residual network\'s shortcut. This is the pre-norm block.', code: 'pre' },
        { id: 'calm', say: 'There, they found, the gradients start out well behaved, and pre-norm blocks trained well with no slow start.', code: 'pre' },
      ],
    },
    {
      id: 'flow',
      title: 'Following one token',
      codeTitle: 'flow.py',
      code: `
        x = [1, 2]      # one token, d = 2   #@x
        a = [0.5, -1]   # attention branch   #@a
        x = x + a       # [1.5, 1]           #@a
        m = [-0.5, 2]   # MLP branch         #@m
        x = x + m       # [1, 3]             #@m
      `,
      beats: [
        { id: 'x', say: 'Follow one token through, with d of two, so it is an arrow on a page. It enters as one and two.', code: 'x' },
        { id: 'a', say: 'The attention branch hands back a change: {0.5|zero point five} and minus one. Added tip to tail, the arrow now ends at {1.5|one point five} and one.', code: 'a' },
        { id: 'm', say: 'The MLP branch reads that sum, normalized, and hands back minus {0.5|zero point five} and two. Added on, the arrow ends at one and three: the block\'s output.', code: 'm' },
        { id: 'path', say: 'The token is never replaced, only nudged, once by each branch, while x itself runs straight through both adds.', code: ['a', 'm'] },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
