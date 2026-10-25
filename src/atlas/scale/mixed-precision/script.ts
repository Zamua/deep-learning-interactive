import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-mixed-precision',
  title: 'Mixed precision',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'formats',
      title: 'Exponent and mantissa',
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
        { id: 'fp32', say: 'A 32-bit float, fp32, spends one bit on the sign, eight on the exponent, and twenty three on the mantissa: four bytes in all.', code: 'fp32' },
        { id: 'parts', say: 'The exponent sets the range: how huge or how tiny a number can be. The mantissa sets the precision: how many digits it keeps, about seven for fp32.', code: 'fp32' },
        { id: 'bf16', say: 'bf16 keeps all eight exponent bits and cuts the mantissa to seven. Half the bytes and the same range as fp32, but only about three significant digits.', code: 'bf16' },
        { id: 'fp16', say: 'fp16 splits its sixteen bits differently: five for the exponent and ten for the mantissa. More precise than bf16, but its range ends near sixty five thousand, and below about six times ten to the minus eight, numbers become zero.', code: 'fp16' },
        { id: 'fp8', say: 'And fp8 squeezes a number into a single byte.', code: 'fp8' },
      ],
    },
    {
      id: 'master',
      title: '16 bits for the math, 32 for the step',
      codeTitle: 'mixed.py',
      code: `
        w16 = w32.astype(bf16)   # 14 GB, not 28  #@math
        # bf16 near 1: 1.0, 1.0078, 1.0156  #@grid
        1.0 + 0.0001   # bf16: 1.0, lost     #@lost
        w32 -= lr * update   # fp32 keeps it  #@copy
        w16 = w32.astype(bf16)   # fresh copy  #@copy
      `,
      beats: [
        { id: 'math', say: 'Mixed precision does the heavy arithmetic in 16 bits. A 7 billion parameter model\'s weights take 14 gigabytes in bf16, against 28 in fp32, and the math runs faster.', code: 'math' },
        { id: 'grid', say: 'But near one, bf16 can only step in jumps of about {0.008|zero point zero zero eight}: the next number after one is {1.0078|one point zero zero seven eight}.', code: 'grid' },
        { id: 'lost', say: 'So adding an update of {0.0001|zero point zero zero zero one} to a weight of one rounds straight back to one. The update is lost.', code: 'lost' },
        { id: 'copy', say: 'That is why the step goes to a 32-bit master copy, which keeps about seven digits, and a fresh 16-bit copy is made from it for the next step.', code: 'copy' },
      ],
    },
    {
      id: 'scaling',
      title: 'Loss scaling',
      codeTitle: 'scaling.py',
      code: `
        scale = 1024                           #@scale
        scaled_loss = loss * scale             #@scale
        # gradients 1024x: 2e-8 -> 2e-5       #@safe
        grad = grad / scale     # in fp32      #@safe
        # bf16: no scaling needed              #@bf16
      `,
      beats: [
        { id: 'tiny', say: 'Gradients are often tiny. One of {2 × 10⁻⁸|two times ten to the minus eight} is below fp16\'s range: stored in fp16, it becomes zero, and its weight stops learning.' },
        { id: 'scale', say: 'The fix is loss scaling: multiply the loss by a large number S, say {1,024|one thousand and twenty four}, before computing the gradients. A constant factor carries through every derivative, so every gradient comes out S times larger.', code: 'scale' },
        { id: 'safe', say: 'That gradient becomes about {2 × 10⁻⁵|two times ten to the minus five}, safely inside the range. Before the step, divide by S again, in 32 bits.', code: 'safe' },
        { id: 'bf16', say: 'bf16 has fp32\'s exponent bits, so its range reaches down to about {10⁻³⁸|ten to the minus thirty eight}, and the same gradient survives with no scaling at all. That is why bf16 became the usual choice.', code: 'bf16' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
