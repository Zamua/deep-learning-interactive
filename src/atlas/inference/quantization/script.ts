import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-quantization',
  title: 'Quantization',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Jacob et al.', year: 2017, title: 'Quantization and training of neural networks for efficient integer-arithmetic-only inference', url: 'https://arxiv.org/abs/1712.05877', scene: 'steps' },
    { who: 'Dettmers, Lewis, Belkada & Zettlemoyer', year: 2022, title: 'LLM.int8(): 8-bit matrix multiplication for transformers at scale', url: 'https://arxiv.org/abs/2208.07339', scene: 'price' },
    { who: 'Frantar, Ashkboos, Hoefler & Alistarh', year: 2022, title: 'GPTQ: accurate post-training quantization for generative pre-trained transformers', url: 'https://arxiv.org/abs/2210.17323', scene: 'price' },
  ],
  scenes: [
    {
      id: 'fit',
      title: 'Too big for the chip',
      codeTitle: 'size.py',
      code: `
        n_params = 7e9                     #@n
        n_params * 2 / 1e9   # 16 bits: 14 #@b16
        gpu = 8              # GB          #@gpu
        n_params * 1 / 1e9   # 8 bits: 7   #@b8
        n_params * 0.5 / 1e9 # 4 bits: 3.5 #@b4
        2 ** 16              # 65,536      #@v16
        2 ** 4               # 16          #@v4
      `,
      beats: [
        { id: 'big', say: 'Take a model of seven billion parameters, each weight in sixteen bits, two bytes: fourteen gigabytes.', code: ['n', 'b16'] },
        { id: 'gpu', say: 'A smaller GPU, with eight gigabytes, cannot hold it.', code: 'gpu' },
        { id: 'b8', say: 'In eight bits, one byte each, it takes seven, and fits.', code: 'b8' },
        { id: 'b4', say: 'In four bits, half a byte, it takes three and a half.', code: 'b4' },
        { id: 'v16', say: 'The catch: each bit doubles how many values a number can take, so sixteen bits allow {65,536|sixty five thousand, five hundred and thirty six}.', code: 'v16' },
        { id: 'v4', say: 'Four bits allow just sixteen. Which sixteen should a weight get?', code: 'v4' },
      ],
    },
    {
      id: 'steps',
      title: 'Evenly spaced steps',
      codeTitle: 'quantize.py',
      code: `
        w = np.array([0.7, -0.33, 0.18])   #@w
        scale = 0.1  # one step's worth    #@scale
        scale * np.arange(-7, 8)  # steps  #@steps
        q = np.round(w / scale)  # 7 -3 2  #@q
        back = q * scale  # 0.7 -0.3 0.2   #@back
        np.abs(w - back)  # <= scale / 2   #@err
      `,
      beats: [
        { id: 'line', say: 'Here are three weights. In sixteen bits, each can sit almost anywhere on the line.', code: 'w' },
        { id: 'grid', say: 'With four bits, allow only evenly spaced steps, numbered from minus seven to seven: fifteen of the sixteen patterns, the same on both sides of zero.', code: 'steps' },
        { id: 'scale', say: 'Each step is worth the same amount, the scale, s. With s at {0.1|zero point one}, the steps run from minus {0.7|zero point seven} to {0.7|zero point seven}.', code: 'scale' },
        { id: 'name', say: 'Forcing values onto fixed steps is called quantization, from quantum, Latin for how much: a fixed amount. Music software quantizes too, snapping each note to the nearest beat.', code: 'steps' },
        { id: 'divide', say: 'To store a weight, count its steps: divide by s, and round to the nearest whole number, q. {0.7|Zero point seven} over {0.1|zero point one} is exactly seven.', code: 'q' },
        { id: 'round', say: 'Minus {0.33|zero point three three} is minus {3.3|three point three} steps, which rounds to minus three. And {0.18|zero point one eight} rounds to two.', code: 'q' },
        { id: 'back', say: 'To use a weight, multiply back: q times s. Seven gives {0.7|zero point seven} again, but minus three gives minus {0.3|zero point three}, not minus {0.33|zero point three three}.', code: 'back' },
        { id: 'error', say: 'That gap is the rounding error. Every weight is within half a step of the nearest step, so the error is at most s over two, whatever the bits: here, {0.05|zero point zero five}.', code: 'err' },
        { id: 'jacob', say: 'In 2017, {Benoit Jacob|Benoît Jacob} and colleagues at Google ran image networks on phones this way: eight bit integers, with one scale for a whole array of weights. Shared like that, the scales cost almost nothing.', code: ['q', 'scale'] },
      ],
    },
    {
      id: 'price',
      title: 'The price of fewer bits',
      codeTitle: 'bits.py',
      code: `
        7 * 0.1   # reach: 0.7               #@reach
        7 * 0.2   # reach 1.4, error to 0.1  #@wider
        2 ** 8    # 256: -127 to 127         #@b8
        127 / 7   # 4-bit steps: 18x wider   #@b4
      `,
      beats: [
        { id: 'reach', say: 'The scale sets the step, and the bits set how many steps there are, so together they set the reach: seven steps of {0.1|zero point one} reach {0.7|zero point seven}. A weight beyond that does not fit.', code: 'reach' },
        { id: 'wider', say: 'Double s, to {0.2|zero point two}, and the reach doubles. But so does every step, and the largest error with it: now {0.1|zero point one}.', code: 'wider' },
        { id: 'b8', say: 'More bits give finer steps. Eight bits make two hundred and fifty six patterns: minus {127|a hundred and twenty seven} to {127|a hundred and twenty seven}.', code: 'b8' },
        { id: 'b4', say: 'To reach as far with four bits, each step must be about eighteen times as wide: {127|a hundred and twenty seven} over seven. So is the largest error.', code: 'b4' },
        { id: 'dettmers', say: 'Is that error small enough? In 2022, Tim Dettmers and colleagues ran models of up to {175|a hundred and seventy five} billion parameters with almost every multiplication in eight bits: half the memory, with no loss in accuracy.', code: 'b8' },
        { id: 'frantar', say: 'Four bits took more care. Later that year, Elias Frantar and colleagues rounded one column of weights at a time, adjusting the rest to make up for the error, and took models that size to four bits, or even three, with little loss.', code: 'b4' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
