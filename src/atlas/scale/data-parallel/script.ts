import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-data-parallel',
  title: 'Data parallelism',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'split',
      title: 'One copy per GPU',
      codeTitle: 'data_parallel.py',
      code: `
        G, per_gpu = 4, 32                      #@gpus
        B = G * per_gpu          # 128           #@B
        lo, hi = i * per_gpu, (i + 1) * per_gpu  #@slice
        x_i = batch[lo:hi]      # GPU i's slice  #@slice
        # GPU i: gradient of the loss on x_i     #@grad
      `,
      beats: [
        { id: 'copies', say: 'To train on several GPUs at once, give each one a full copy of the weights, w.', code: 'gpus' },
        { id: 'slice', say: 'Every step, split the batch into slices, one per GPU. Four GPUs with thirty two examples each make a batch of a hundred and twenty eight.', code: ['B', 'slice'] },
        { id: 'grad', say: 'Each GPU computes the gradient on its own slice: the average over its own thirty two examples, all four at the same time.', code: 'grad' },
      ],
    },
    {
      id: 'average',
      title: 'Average, then step together',
      codeTitle: 'data_parallel.py',
      code: `
        g_all = [2.0, -1.0, 3.0, 0.0]  # one weight  #@per
        g = np.mean(g_all)       # 1.0           #@mean
        w = w - lr * g           # same on all   #@step
      `,
      beats: [
        { id: 'per', say: 'For one weight, the four GPUs might find gradients of two, minus one, three and zero.', code: 'per' },
        { id: 'mean', say: 'They send them to each other and average: four over four, one. With equal slices, that is exactly the gradient of the whole batch of a hundred and twenty eight.', code: 'mean' },
        { id: 'step', say: 'Every GPU then takes the same step, with the same gradient, so the copies stay identical.', code: 'step' },
        { id: 'send', say: 'So each step, what travels between the GPUs is gradients: one number per parameter, from every GPU. The examples stay where they are.' },
      ],
    },
    {
      id: 'epoch',
      title: 'Steps per epoch',
      codeTitle: 'epoch.py',
      code: `
        N = 12_800                               #@N
        steps = N // (G * per_gpu)   # 100       #@steps
        # 8 GPUs: 12_800 // 256 = 50             #@more
      `,
      beats: [
        { id: 'epoch', say: 'An epoch is still one pass through all N examples, and each step uses one whole batch, across all the GPUs.', code: 'N' },
        { id: 'steps', say: 'So an epoch takes N over B steps. Twelve thousand eight hundred examples, in batches of a hundred and twenty eight: a hundred steps.', code: 'steps' },
        { id: 'more', say: 'With eight GPUs at thirty two each, the batch is two hundred and fifty six: fifty steps, each covering twice the data.', code: 'more' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
