import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-mixed-precision',
  title: 'Mixed precision',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Micikevicius et al.', year: 2017, title: 'Mixed precision training', url: 'https://arxiv.org/abs/1710.03740', scene: 'master' },
  ],
  scenes: [
    {
      id: 'why',
      title: 'Half the bytes',
      codeTitle: 'memory.py',
      code: `
        n = 7e9          # weights           #@n
        n * 4 / 1e9      # 32-bit: 28 GB     #@fp32
        n * 2 / 1e9      # 16-bit: 14 GB     #@half
        2 ** 32          # 4.3 billion       #@count
        2 ** 16          # 65,536            #@count
      `,
      beats: [
        { id: 'gpu', say: 'Training runs on GPUs, short for graphics processing units: chips first built to draw graphics, which do thousands of multiplications at once. Each has only so much memory.', code: 'n' },
        { id: 'fp32', say: 'As 32-bit numbers, four bytes each, a 7 billion parameter model\'s weights take twenty eight gigabytes of it.', code: 'fp32' },
        { id: 'half', say: 'In 16 bits, two bytes each, that halves to fourteen, and GPUs do 16-bit arithmetic several times faster.', code: 'half' },
        { id: 'catch', say: 'The catch: sixteen bits, each a zero or a one, can be set in only {65,536|sixty five thousand five hundred and thirty six} ways. So a 16-bit number has far fewer values to choose from.', code: 'count' },
      ],
    },
    {
      id: 'float',
      title: 'Digits times a power',
      codeTitle: 'float.py',
      code: `
        0.00000002 == 2 * 10**-8   #@sci
        12.0 == 1.5 * 2**3         #@two
        # 1.5: mantissa, 3: exponent #@two
        # sign, exponent, mantissa
        fp32 = (1, 8, 23)  # 4 bytes #@fp32
      `,
      beats: [
        { id: 'sci', say: 'Which values? Scientists write a tiny number like this one as {2 × 10⁻⁸|two times ten to the minus eight}: a few digits, times a power of ten.', code: 'sci' },
        { id: 'float', say: 'Change the power, and the point moves while the digits stay put: the point floats. Hence the name floating point numbers, or floats.', code: 'sci' },
        { id: 'two', say: 'A computer stores them with powers of two: twelve is {1.5 × 2³|one point five times two cubed}, one point five times eight.', code: 'two' },
        { id: 'mantissa', say: 'The digits, here {1.5|one point five}, are the mantissa: more bits for it keep more digits, more precision.', code: 'two' },
        { id: 'exponent', say: 'The power, here three, is the exponent: more bits for it reach bigger and tinier numbers, more range.', code: 'two' },
        { id: 'fp32', say: 'The standard 32-bit float, fp32, for floating point, gives one bit to the sign, eight to the exponent, and twenty three to the mantissa: about seven digits.', code: 'fp32' },
      ],
    },
    {
      id: 'formats',
      title: 'Two ways to spend 16 bits',
      codeTitle: 'formats.py',
      code: `
        bits = {  # sign, exponent, mantissa
            'fp32': (1, 8, 23),   # 4 bytes  #@fp32
            'bf16': (1, 8, 7),    # 2 bytes  #@bf16
            'fp16': (1, 5, 10),   # 2 bytes  #@fp16
            'fp8': (1, 4, 3),     # 1 byte   #@fp8
        }
      `,
      beats: [
        { id: 'bf16', say: 'Sixteen bits must give something up. bf16 keeps all eight exponent bits and cuts the mantissa to seven: fp32\'s whole range, but only about three digits.', code: 'bf16' },
        { id: 'brain', say: 'The b is for Google Brain, the research group at Google where the format was conceived.', code: 'bf16' },
        { id: 'fp16', say: 'fp16 keeps ten mantissa bits, so more digits, but only five exponent bits, so far less range.', code: 'fp16' },
        { id: 'range', say: 'Above {65,504|sixty five thousand five hundred and four}, a number in fp16 becomes infinity, and below about {6 × 10⁻⁸|six times ten to the minus eight}, zero.', code: 'fp16' },
        { id: 'fp8', say: 'And fp8 fits a number in a single byte.', code: 'fp8' },
      ],
    },
    {
      id: 'master',
      title: '16 bits for the math, 32 for the step',
      codeTitle: 'mixed.py',
      code: `
        # bf16 near 1: 1.0, 1.0078   #@grid
        1.0 + 0.0001   # bf16: 1.0   #@lost
        w32 -= lr * update  # kept   #@copy
        w16 = w32.astype(bf16)       #@fresh
      `,
      beats: [
        { id: 'grid', say: 'Now see what three digits cost. Near one, bf16 steps by about {0.008|zero point zero zero eight}: after one comes {1.0078|one point zero zero seven eight}.', code: 'grid' },
        { id: 'lost', say: 'Add an update of {0.0001|zero point zero zero zero one} to a weight of one, and the sum rounds straight back to one: the update is lost.', code: 'lost' },
        { id: 'copy', say: 'Paulius Micikevicius and colleagues, at NVIDIA and Baidu, fixed this in 2017: keep a 32-bit master copy of the weights, and take each step there.', code: 'copy' },
        { id: 'fresh', say: 'Round that copy to 16 bits for the arithmetic. Small updates pile up in the master copy until, together, they move the 16-bit weight too.', code: 'fresh' },
        { id: 'name', say: 'Sixteen bits for the math, thirty two for the step: that mix is mixed precision.', code: ['copy', 'fresh'] },
      ],
    },
    {
      id: 'scaling',
      title: 'Loss scaling',
      codeTitle: 'scaling.py',
      code: `
        scale = 1024                  #@scale
        scaled_loss = loss * scale    #@scale
        # grads x 1024: 2e-8 -> 2e-5  #@safe
        grad = grad / scale  # fp32   #@safe
        # bf16: no scaling needed   #@bf16
      `,
      beats: [
        { id: 'tiny', say: 'fp16\'s range brought them a second problem. A gradient of {2 × 10⁻⁸|two times ten to the minus eight}, stored in fp16, becomes zero, and its weight stops learning.' },
        { id: 'scale', say: 'Their fix was loss scaling: multiply the loss by a large number, S, say {1,024|one thousand and twenty four}, before backprop. A constant factor carries through every derivative, so every gradient comes out S times larger.', code: 'scale' },
        { id: 'safe', say: 'That gradient becomes about {2 × 10⁻⁵|two times ten to the minus five}, safely inside the range. Before the step, divide by S again, in 32 bits.', code: 'safe' },
        { id: 'bf16', say: 'bf16 keeps fp32\'s eight exponent bits, so it reaches down to about {10⁻³⁸|ten to the minus thirty eight}, and the same gradient survives with no scaling at all.', code: 'bf16' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
