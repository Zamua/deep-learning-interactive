import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-model-parallel',
  title: 'Tensor and pipeline parallelism',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'columns',
      title: 'Split a matrix by its columns',
      codeTitle: 'tensor.py',
      code: `
        x = np.array([1, 2])              # d = 2  #@x
        W1 = np.array([[1, 0, 2, -1],
                       [1, 1, 0, 1]])    # (2, 4)  #@W
        h = relu(x @ W1)        # [3, 2, 2, 1]     #@cols
        h0 = relu(x @ W1[:, :2])   # GPU 0: [3, 2]  #@own
        h1 = relu(x @ W1[:, 2:])   # GPU 1: [2, 1]  #@own
      `,
      beats: [
        { id: 'layer', say: 'Here is one layer, written the way code often writes it: the input x is a row of d numbers, and the weight matrix {W₁|W one} has d rows and four d columns, one column per output.', code: ['x', 'W'] },
        { id: 'cols', say: 'Each output is x dotted with one column. Output zero: one times one, plus two times one: three.', code: 'cols' },
        { id: 'split', say: 'So split the columns: GPU zero keeps columns zero and one, and GPU one keeps columns two and three.' },
        { id: 'own', say: 'Each GPU computes its own outputs: three and two on GPU zero, two and one on GPU one, neither waiting for the other. The ReLU works entry by entry, so each applies it to its own part.', code: 'own' },
        { id: 'shape', say: 'With k GPUs, each piece is d by four d over k: on four GPUs, every GPU holds a quarter of the columns.' },
      ],
    },
    {
      id: 'rows',
      title: 'The next matrix by its rows',
      codeTitle: 'tensor.py',
      code: `
        W2 = np.array([[1, 0], [0, 1],
                       [1, 1], [-1, 0]])  # (4, 2)  #@W2
        y0 = h0 @ W2[:2]     # GPU 0: [3, 2]  #@part
        y1 = h1 @ W2[2:]     # GPU 1: [1, 2]  #@part
        out = y0 + y1        # [4, 4]         #@sum
      `,
      beats: [
        { id: 'w2', say: 'The next matrix, {W₂|W two}, takes the four d outputs back down to d. Split it by rows to match: GPU zero gets the rows that read its own two outputs.', code: 'W2' },
        { id: 'part', say: 'Now each GPU\'s product is only part of the answer. GPU zero gets three and two, GPU one gets one and two: partial sums.', code: 'part' },
        { id: 'sum', say: 'Adding them across the GPUs gives the real output, four and four. That exchange happens inside every layer, every step, so this split, tensor parallelism, needs very fast links between its GPUs.', code: 'sum' },
      ],
    },
    {
      id: 'pipeline',
      title: 'Split the stack by layers',
      codeTitle: 'pipeline.py',
      code: `
        n_layers, n_stages = 24, 4                 #@layers
        per_stage = n_layers // n_stages   # 6     #@layers
        stage = 13 // per_stage    # 2          #@which
        # stage 0 sends its output to stage 1      #@send
      `,
      beats: [
        { id: 'layers', say: 'Or cut the network the other way, between layers. Twenty four layers on four GPUs: six consecutive layers each, called a stage.', code: 'layers' },
        { id: 'which', say: 'Counting from zero, stage zero holds layers zero to five, so layer thirteen lands on stage two: thirteen over six, rounded down.', code: 'which' },
        { id: 'send', say: 'Each stage runs its layers, then hands its output to the next stage, and the gradient on that output comes back. Nothing else crosses: once per cut, not inside every layer.', code: 'send' },
        { id: 'compare', say: 'That is pipeline parallelism. The column split talks inside every layer; the layer split only at its cuts.' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
