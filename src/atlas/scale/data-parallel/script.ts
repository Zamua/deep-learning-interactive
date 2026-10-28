import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-data-parallel',
  title: 'Data parallelism',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Goyal, Dollár, Girshick, Noordhuis, Wesolowski, Kyrola, Tulloch, Jia & He', year: 2017, title: 'Accurate, Large Minibatch SGD: Training ImageNet in 1 Hour', url: 'https://arxiv.org/abs/1706.02677', scene: 'why' },
  ],
  scenes: [
    {
      id: 'why',
      title: 'Too much for one GPU',
      codeTitle: 'data_parallel.py',
      code: `
        B = 128          # one batch      #@one
        # 1 GPU: all 128, every step     #@one
        G = 4            # GPUs           #@gpus
        per_gpu = B // G     # 32         #@slice
        lo = i * per_gpu     # GPU i      #@slice
        x_i = batch[lo:lo + per_gpu]      #@slice
        B = G * per_gpu      # 128        #@B
      `,
      beats: [
        { id: 'slow', say: 'Training a model takes many gradient steps, and every step needs the gradients of a whole batch of examples. One chip working through them all alone, step after step, is slow.', code: 'one' },
        { id: 'gpu', say: 'That chip is a GPU, a graphics processing unit: first built to draw graphics, it does many multiplications at once.', code: 'one' },
        { id: 'copies', say: 'So share the work. Give each of several GPUs a full copy of the weights, w: every one of its numbers, called the parameters.', code: 'gpus' },
        { id: 'slice', say: 'And give each its own slice of the batch: a hundred and twenty eight examples, split four ways, is thirty two each.', code: 'slice' },
        { id: 'G', say: 'Call the number of GPUs G. Turned around, G slices of thirty two make the batch: four times thirty two, a hundred and twenty eight.', code: 'B' },
        { id: 'name', say: 'The data is split, the weights are copied, and the GPUs work in parallel, at the same time. That is data parallelism. Each GPU has a quarter of the work.', code: ['slice', 'B'] },
        { id: 'goyal', say: 'In 2017, Priya Goyal and colleagues trained on over a million images this way, with two hundred and fifty six GPUs at thirty two images each. Training that had taken twenty nine hours on eight GPUs took one hour.' },
      ],
    },
    {
      id: 'average',
      title: 'Average, then step together',
      codeTitle: 'data_parallel.py',
      code: `
        # GPU i: loss gradient on x_i    #@grad
        g_all = [2, -1, 3, 0]  # 1 weight #@per
        g = np.mean(g_all)     # 1.0     #@mean
        # each entry of g: the same      #@vec
        w = w - lr * g   # on every GPU  #@step
      `,
      beats: [
        { id: 'loss', say: 'Training makes a function, f, small: f measures how badly the weights do on the examples, and is called the loss.', code: 'grad' },
        { id: 'grad', say: 'Each GPU works out the gradient of the loss on its own slice, the average over its thirty two examples, all four at once. GPU zero\'s is written {g₀|g zero}, GPU one\'s {g₁|g one}, and so on.', code: 'grad' },
        { id: 'per', say: 'For one weight, the four might find two, minus one, three and zero. Different slices give different gradients.', code: 'per' },
        { id: 'mean', say: 'So they send them to each other and average: they add up to four, and four over four is one.', code: 'mean' },
        { id: 'whole', say: 'The slices are the same size, so this average of four averages is the average over all a hundred and twenty eight examples: exactly the gradient of the whole batch.', code: 'mean' },
        { id: 'vec', say: 'Every other weight is averaged the same way, entry by entry: its own four gradients, one from each GPU.', code: 'vec' },
        { id: 'step', say: 'Then every GPU takes the same step with that same average, so the copies stay identical. With their own gradients, they would drift apart.', code: 'step' },
        { id: 'send', say: 'So each step, what travels between the GPUs is gradients: one number per parameter, from every GPU. The examples stay put, and the loss, a single number, could not say which way to move each weight.' },
      ],
    },
    {
      id: 'epoch',
      title: 'Steps per epoch',
      codeTitle: 'epoch.py',
      code: `
        N = 12_800                       #@N
        B = 4 * 32        # 128          #@B
        steps = N // B    # 100          #@steps
        B = 8 * 32        # 256          #@more
        steps = N // B    # 50           #@more
      `,
      beats: [
        { id: 'epoch', say: 'An epoch is still one pass through all N examples: here, twelve thousand eight hundred.', code: 'N' },
        { id: 'step', say: 'And a step still takes one whole batch, all four slices at once: a hundred and twenty eight examples.', code: 'B' },
        { id: 'steps', say: 'So an epoch takes N over B steps: twelve thousand eight hundred over a hundred and twenty eight is a hundred.', code: 'steps' },
        { id: 'not', say: 'Not four hundred. The four slices are worked at the same time, so together they make one step, not four.', code: 'steps' },
        { id: 'more', say: 'With eight GPUs at thirty two each, the batch is two hundred and fifty six: fifty steps, each covering twice the data.', code: 'more' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
