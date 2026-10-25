import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-zero',
  title: 'Sharding the optimizer',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'copies',
      title: 'Four identical copies',
      codeTitle: 'zero.py',
      code: `
        n_params, G = 7e9, 4                    #@dp
        per_gpu = 16 * n_params / 1e9   # 112 GB  #@dp
        # every GPU holds the same 112 GB         #@waste
      `,
      beats: [
        { id: 'dp', say: 'In data parallelism, every GPU keeps a full copy of the training state: the 16-bit weights and gradients, and Adam\'s 32-bit master copy, m and v. Sixteen bytes per parameter, on every GPU.', code: 'dp' },
        { id: 'waste', say: 'A 7 billion parameter model on four GPUs is 112 gigabytes on each: four identical copies.', code: 'waste' },
        { id: 'idea', say: 'Sharding keeps just one copy, spread out: each GPU holds a quarter of it. That is the idea of ZeRO, for zero redundancy.' },
      ],
    },
    {
      id: 'stages',
      title: 'Three stages',
      codeTitle: 'zero.py',
      code: `
        n, G = 7, 4          # billions, GPUs
        stage1 = 4 * n + 12 * n / G   # 49 GB    #@s1
        stage2 = 2 * n + 14 * n / G   # 38.5 GB  #@s2
        stage3 = 16 * n / G           # 28 GB    #@s3
      `,
      beats: [
        { id: 's1', say: 'Stage one shards the optimizer state, the twelve bytes of master copy, m and v. Each GPU updates only its own quarter of the weights.', code: 's1' },
        { id: 's1n', say: 'Per GPU, that is four bytes, plus twelve over four, per parameter: forty nine gigabytes instead of 112.', code: 's1' },
        { id: 's2', say: 'Stage two shards the gradients too: each GPU only needs the averaged gradient for its own quarter. That makes {38.5|thirty eight and a half} gigabytes.', code: 's2' },
        { id: 's3', say: 'Stage three shards the weights as well. Everything is split: sixteen N over G, twenty eight gigabytes each.', code: 's3' },
      ],
    },
    {
      id: 'cost',
      title: 'What it costs',
      codeTitle: 'zero.py',
      code: `
        # stage 3: gather the weights, use, drop  #@gather
        # the same averaged gradient, same step   #@same
        16 * 7 / 64     # 64 GPUs: 1.75 GB each   #@more
      `,
      beats: [
        { id: 'gather', say: 'The price is traffic. With the weights sharded, each piece of them is gathered from the other GPUs just before it is used, then dropped again.', code: 'gather' },
        { id: 'same', say: 'The training itself does not change: the same averaged gradient, and the same step, as plain data parallelism. Only where the numbers live.', code: 'same' },
        { id: 'more', say: 'And the memory per GPU keeps falling as GPUs are added: on sixty four of them, the 7 billion parameter model needs {1.75|one point seven five} gigabytes each.', code: 'more' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
