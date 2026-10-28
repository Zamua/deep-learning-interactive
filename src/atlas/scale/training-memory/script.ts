import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-training-memory',
  title: 'Where training memory goes',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Kingma & Ba', year: 2014, title: 'Adam: A Method for Stochastic Optimization', url: 'https://arxiv.org/abs/1412.6980', scene: 'model' },
  ],
  scenes: [
    {
      id: 'fit',
      title: 'The weights fit',
      codeTitle: 'memory.py',
      code: `
        gpu = 80e9        # bytes: 80 GB   #@gpu
        n_params = 7e9                     #@n
        weights = 2 * n_params  # bytes    #@w
        weights / 1e9           # 14 GB    #@w
        # with Adam: more than 80 GB       #@train
      `,
      beats: [
        { id: 'gpu', say: 'Training runs on a GPU, short for graphics processing unit: a chip first built to draw graphics, which does thousands of multiplications at once. Everything training keeps must fit in its memory.', code: 'gpu' },
        { id: 'bytes', say: 'Memory is counted in bytes. A bit is a single zero or one, and a byte is eight bits.', code: 'gpu' },
        { id: 'gb', say: 'A billion bytes make a gigabyte, or {GB|G B}, and a large GPU holds eighty of them.', code: 'gpu' },
        { id: 'w', say: 'Take a model of seven billion parameters, each weight stored in sixteen bits: two bytes. Its weights take fourteen gigabytes. They fit, with room to spare.', code: ['n', 'w'] },
        { id: 'train', say: 'Yet training that same model with Adam needs more than this whole GPU. Where does the memory go?', code: 'train' },
      ],
    },
    {
      id: 'param',
      title: 'Sixteen bytes per parameter',
      codeTitle: 'memory.py',
      code: `
        bytes_per_param = (
            2      # 16-bit weight       #@w
            + 2    # 16-bit gradient     #@g
            + 4    # 32-bit master copy  #@master
            + 4    # Adam's m            #@mv
            + 4    # Adam's v            #@mv
        )          # 16                  #@total
      `,
      beats: [
        { id: 'one', say: 'Follow a single parameter. Its weight is a 16-bit number, sixteen zeros and ones: two bytes.', code: 'w' },
        { id: 'g', say: 'Each step computes its gradient, the slope that says which way to move it. That is also kept in 16 bits: two more bytes.', code: 'g' },
        { id: 'mix', say: 'Large models usually train with a mix. Sixteen bits for the numbers the arithmetic uses: they take half the memory, and a GPU computes with them faster. Thirty two bits, which take four bytes, for the optimizer\'s own numbers, which hold more digits.', code: ['w', 'g', 'master'] },
        { id: 'master', say: 'So the optimizer keeps a 32-bit copy of every weight, called the master copy. Each step updates it, and the 16-bit weight is copied from it: four bytes.', code: 'master' },
        { id: 'mv', say: 'Then Adam\'s two running averages, m and v, also in 32 bits: four bytes each.', code: 'mv' },
        { id: 'total', say: 'Two, plus two, plus four, plus four, plus four: sixteen bytes per parameter, called its training state. Only two of them are the weight the model computes with.', code: 'total' },
        { id: 'plain', say: 'Plain gradient descent keeps no running averages. Without m and v, it needs eight bytes.', code: ['w', 'g', 'master'] },
      ],
    },
    {
      id: 'model',
      title: 'A whole model',
      codeTitle: 'memory.py',
      code: `
        n_params = 7e9                     #@n
        state = 16 * n_params  # bytes     #@n
        state / 1e9            # 112 GB    #@gb
        np.ceil(112 / 80)      # 2 GPUs    #@gpu
        8 * 7                  # m, v: 56 GB #@adam
        16 * 70                # 1,120 GB  #@big
        np.ceil(1120 / 80)     # 14 GPUs   #@many
      `,
      beats: [
        { id: 'n', say: 'Every parameter keeps its own sixteen bytes. Write N for the number of parameters: the model needs sixteen N bytes.', code: 'n' },
        { id: 'gb', say: 'For seven billion, sixteen times seven is a hundred and twelve: a hundred and twelve gigabytes.', code: 'gb' },
        { id: 'gpu', say: 'One GPU holds eighty, so that is {1.4|one point four} GPUs\' worth. A GPU does not come in parts, so round up: it takes two.', code: 'gpu' },
        { id: 'adam', say: 'In 2014, Diederik Kingma and Jimmy Ba wrote that Adam has little memory requirements, and per parameter it is little: m and v, eight bytes. But eight times seven billion is fifty six gigabytes, half the total.', code: 'adam' },
        { id: 'big', say: 'Ten times the parameters is ten times the memory: a model of seventy billion parameters needs {1,120|eleven hundred and twenty} gigabytes.', code: 'big' },
        { id: 'many', say: 'At eighty per GPU, that is fourteen GPUs, just to hold the training state.', code: 'many' },
        { id: 'batch', say: 'Each step learns from a group of examples, called a batch. Its size never enters this count: one example or a thousand, each parameter keeps the same five numbers.', code: 'n' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
