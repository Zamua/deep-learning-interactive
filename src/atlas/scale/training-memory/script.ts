import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-training-memory',
  title: 'Where training memory goes',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'bytes',
      title: 'Sixteen bytes per parameter',
      codeTitle: 'memory.py',
      code: `
        bytes_per_param = (
            2      # 16-bit weights      #@w
            + 2    # 16-bit gradients    #@g
            + 4    # 32-bit master copy  #@master
            + 4    # Adam's m            #@mv
            + 4    # Adam's v            #@mv
        )          # 16                  #@total
      `,
      beats: [
        { id: 'byte', say: 'Memory is counted in bytes, eight bits each. A 32-bit number takes four bytes, and a 16-bit number takes two.' },
        { id: 'w', say: 'Training with Adam keeps several numbers for every parameter. First the weights, in 16 bits for fast arithmetic: two bytes.', code: 'w' },
        { id: 'g', say: 'Then one gradient per weight, also in 16 bits: two more.', code: 'g' },
        { id: 'master', say: 'Small updates would get lost in 16 bits, so each step updates a 32-bit master copy of the weights: four bytes.', code: 'master' },
        { id: 'mv', say: 'And Adam\'s two running averages, m and v, kept in 32 bits: four bytes each.', code: 'mv' },
        { id: 'total', say: 'That is sixteen bytes of training state per parameter. Only two of them are the weights the model computes with.', code: 'total' },
      ],
    },
    {
      id: 'model',
      title: 'A whole model',
      codeTitle: 'memory.py',
      code: `
        n_params = 7e9                          #@n
        total = 16 * n_params   # 1.12e11 bytes  #@gb
        gb = total / 1e9        # 112            #@gb
        gpus = np.ceil(gb / 80)  # 2             #@gpu
        # 70e9 parameters: 1,120 GB, 14 GPUs     #@big
      `,
      beats: [
        { id: 'n', say: 'Now multiply by the number of parameters, N: the training state takes sixteen N bytes. A 7 billion parameter model needs sixteen times 7 billion.', code: 'n' },
        { id: 'gb', say: 'That is 112 billion bytes: 112 gigabytes, or GB, where a gigabyte is a billion bytes.', code: 'gb' },
        { id: 'gpu', say: 'A large GPU holds 80 gigabytes. This training state alone fills one and spills into a second.', code: 'gpu' },
        { id: 'big', say: 'Ten times the parameters is ten times the memory: a 70 billion parameter model needs 1,120 gigabytes, fourteen such GPUs.', code: 'big' },
        { id: 'batch', say: 'The batch never enters this count. It is sixteen bytes per parameter, whether a step sees one example or a thousand.' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
