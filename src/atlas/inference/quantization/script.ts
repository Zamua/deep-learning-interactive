import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-quantization',
  title: 'Quantization',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'round',
      title: 'An integer and a scale',
      codeTitle: 'quantize.py',
      code: `
        w = np.array([0.7, -0.33, 0.18, -0.52])  #@w
        scale = 0.1          # one integer step   #@scale
        q = np.round(w / scale)  # [7, -3, 2, -5] #@q
        back = q * scale  # [0.7, -0.3, 0.2, -0.5] #@back
        np.abs(w - back)  # at most scale / 2     #@err
      `,
      beats: [
        { id: 'weights', say: 'A model\'s weights are usually stored as sixteen bit numbers, two bytes each. Here are four of them.', code: 'w' },
        { id: 'grid', say: 'Quantization stores small integers instead, plus one scale, s: what one integer step is worth. Four bits hold the integers from minus seven to seven, so with s at {0.1|zero point one} they cover minus {0.7|zero point seven} to {0.7|zero point seven}.', code: 'scale' },
        { id: 'divide', say: 'To store a weight, divide by s and round to the nearest integer, q. {0.7|Zero point seven} becomes seven. Minus {0.33|zero point three three} becomes minus {3.3|three point three}, which rounds to minus three.', code: 'q' },
        { id: 'back', say: 'To use it, multiply q back by s. Seven gives {0.7|zero point seven} again, but minus three gives minus {0.3|zero point three}, not minus {0.33|zero point three three}.', code: 'back' },
        { id: 'error', say: 'That gap is the rounding error. Rounding moves a weight at most half a step, so the error is never more than s over two: here, {0.05|zero point zero five}.', code: 'err' },
      ],
    },
    {
      id: 'bytes',
      title: 'Fewer bits, fewer bytes',
      codeTitle: 'model_size.py',
      code: `
        params = 7e9                          #@params
        params * 2      # 16 bits: 14 GB      #@b16
        params * 1      # 8 bits: 7 GB        #@b8
        params * 0.5    # 4 bits: 3.5 GB      #@b4
        # 8 bits: -127 to 127; 4 bits: -7 to 7 #@steps
      `,
      beats: [
        { id: 'b16', say: 'Why bother? Memory. A model of seven billion parameters at sixteen bits takes fourteen gigabytes.', code: ['params', 'b16'] },
        { id: 'b8', say: 'At eight bits, one byte each, it takes seven.', code: 'b8' },
        { id: 'b4', say: 'At four bits, half a byte each, three and a half: small enough for a much smaller GPU. The scales add almost nothing, since one scale is shared by many weights.', code: 'b4' },
        { id: 'coarse', say: 'The price is precision. Eight bits run from minus {127|one hundred and twenty seven} to {127|one hundred and twenty seven}, four bits only from minus seven to seven. Over the same range, each step is about eighteen times as wide, and so is the largest error.', code: 'steps' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
