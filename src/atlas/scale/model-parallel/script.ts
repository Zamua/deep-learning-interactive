import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-model-parallel',
  title: 'Tensor and pipeline parallelism',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Shoeybi, Patwary, Puri, LeGresley, Casper & Catanzaro', year: 2019, title: 'Megatron-LM: training multi-billion parameter language models using model parallelism', url: 'https://arxiv.org/abs/1909.08053', scene: 'rows' },
    { who: 'Huang et al.', year: 2018, title: 'GPipe: efficient training of giant neural networks using pipeline parallelism', url: 'https://arxiv.org/abs/1811.06965', scene: 'pipeline' },
  ],
  scenes: [
    {
      id: 'problem',
      title: 'Too big for one GPU',
      codeTitle: 'split.py',
      code: `
        # data parallel: a full copy each
        gpus = [w, w, w, w]          #@copy
        # w too big for one GPU      #@big
        gpus = [w0, w1, w2, w3]      #@cut
      `,
      beats: [
        { id: 'gpu', say: 'Training runs on GPUs, short for graphics processing units: chips first built to draw graphics, which do thousands of multiplications at once. Each has only so much memory.' },
        { id: 'copy', say: 'Data parallelism gives every GPU a full copy of the weights, w, and its own slice of the batch.', code: 'copy' },
        { id: 'big', say: 'But the biggest models have more weights than one GPU can hold: not even one copy fits.', code: 'big' },
        { id: 'cut', say: 'So cut the model itself into pieces, one per GPU: inside each layer\'s matrix, or between the layers.', code: 'cut' },
      ],
    },
    {
      id: 'columns',
      title: 'Split a matrix by its columns',
      codeTitle: 'tensor.py',
      code: `
        x = np.array([1, 2])        # d = 2  #@x
        W1 = np.array([[1, 0, 2, -1],        #@W
                       [1, 1, 0, 1]])        #@W
        W1.shape    # (2, 4): d by 4d        #@wide
        h = relu(x @ W1)   # [3, 2, 2, 1]    #@cols
        h0 = relu(x @ W1[:, :2])  # [3, 2]   #@own
        h1 = relu(x @ W1[:, 2:])  # [2, 1]   #@own
        # k GPUs: each piece (d, 4d / k)     #@shape
      `,
      beats: [
        { id: 'x', say: 'Take one layer. Its input, x, is a list of numbers; call its length d. Here d is two, and x is one and two.', code: 'x' },
        { id: 'W', say: 'Big models usually write the layer with x on the left, times the weights, {W₁|W one}: one row per input, and one column per output.', code: 'W' },
        { id: 'wide', say: 'This layer widens to four times d outputs, so {W₁|W one} is d by four d: here, two by four.', code: 'wide' },
        { id: 'cols', say: 'Each output is x dotted with one column. Output zero: one times one, plus two times one: three.', code: 'cols' },
        { id: 'split', say: 'So cut {W₁|W one} between its columns: GPU zero keeps columns zero and one, and GPU one keeps columns two and three.', code: 'own' },
        { id: 'own', say: 'Each GPU computes its own outputs: three and two on GPU zero, two and one on GPU one. The ReLU works entry by entry, so each applies it to its own part.', code: 'own' },
        { id: 'shape', say: 'With k GPUs, the columns are shared k ways: each GPU\'s piece is d by four d over k.', code: 'shape' },
      ],
    },
    {
      id: 'rows',
      title: 'The next matrix by its rows',
      codeTitle: 'tensor.py',
      code: `
        W2 = np.array([[1, 0], [0, 1],     #@W2
                       [1, 1], [-1, 0]])   #@W2
        W2.shape    # (4, 2): 4d by d      #@W2
        y0 = h0 @ W2[:2]    # [3, 2]       #@part
        y1 = h1 @ W2[2:]    # [1, 2]       #@part
        out = y0 + y1       # [4, 4]       #@sum
        # k GPUs: each piece (4d / k, d)   #@rshape
      `,
      beats: [
        { id: 'w2', say: 'The next matrix, {W₂|W two}, is four d by d: it takes the four d values back down to d. Cut it by rows to match: GPU zero gets the two rows that read its own outputs.', code: 'W2' },
        { id: 'rshape', say: 'With k GPUs, each piece is four d over k, by d.', code: 'rshape' },
        { id: 'part', say: 'Now each GPU\'s product is only part of the answer: three and two on GPU zero, one and two on GPU one. These are partial sums.', code: 'part' },
        { id: 'sum', say: 'Add them across the GPUs for the real output: four and four. That exchange happens inside every layer, every step, so this split needs very fast links between GPUs.', code: 'sum' },
        { id: 'megatron', say: 'Mohammad Shoeybi and colleagues at NVIDIA split their models this way in 2019, in Megatron-LM, and trained a model of {8.3|eight point three} billion parameters across {512|five hundred and twelve} GPUs.', code: ['part', 'sum'] },
        { id: 'tensor', say: 'Tensor is the word for any array of numbers, such as a vector or a matrix. Cutting the weight matrices themselves is called tensor parallelism.', code: 'W2' },
      ],
    },
    {
      id: 'pipeline',
      title: 'Split the stack by layers',
      codeTitle: 'pipeline.py',
      code: `
        n_layers, n_stages = 24, 4             #@layers
        per_stage = n_layers // n_stages  # 6  #@layers
        stage = 13 // per_stage    # 2         #@which
        # stage 0 sends its output to stage 1  #@send
        # micro-batches keep all stages busy   #@pipe
      `,
      beats: [
        { id: 'layers', say: 'Or cut between whole layers. Twenty four layers on four GPUs: six consecutive layers each, called a stage.', code: 'layers' },
        { id: 'which', say: 'Counting from zero, stage zero holds layers zero to five, so layer thirteen lands on stage two: thirteen over six, rounded down.', code: 'which' },
        { id: 'send', say: 'Each stage hands its output to the next, and during backprop, the gradient on that output comes back. Nothing else crosses.', code: 'send' },
        { id: 'gpipe', say: 'But one batch at a time keeps only one stage busy. In 2018, Yanping Huang and colleagues at Google fixed that in GPipe: cut the batch into micro-batches, and feed them in one after another.', code: 'pipe' },
        { id: 'name', say: 'While stage one works on the first, stage zero starts the second, like an assembly line. That flow is a pipeline, hence pipeline parallelism.', code: 'pipe' },
        { id: 'compare', say: 'So the column split talks inside every layer, the layer split only at its cuts, and data parallelism once per step.' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
