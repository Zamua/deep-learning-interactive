import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-sampling',
  title: 'Sampling and temperature',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'pick',
      title: 'Greedy, or sample',
      codeTitle: 'generate.py',
      code: `
        s = np.array([2, 1, 0])   # cat, dog, fish  #@s
        p = softmax(s)       # [0.67, 0.24, 0.09]          #@p
        p.argmax()           # 0: greedy, always cat       #@greedy
        np.random.choice(3, p=p)  # cat 67%   #@sample
      `,
      beats: [
        { id: 'scores', say: 'To generate text, the model scores every possible next token. Here there are three: cat, dog and fish, with scores two, one and zero.', code: 's' },
        { id: 'probs', say: 'Softmax turns the scores into probabilities: {0.67|zero point six seven}, {0.24|zero point two four}, and {0.09|zero point zero nine}.', code: 'p' },
        { id: 'greedy', say: 'Greedy decoding always takes the most likely token: cat, every single time. That is safe, but the text comes out dull and repetitive.', code: 'greedy' },
        { id: 'sample', say: 'Sampling draws at random with those probabilities instead: cat two times in three, dog about one in four, and now and then, fish.', code: 'sample' },
      ],
    },
    {
      id: 'temp',
      title: 'Temperature',
      codeTitle: 'generate.py',
      code: `
        p = softmax(s / T)                          #@formula
        softmax(s / 0.5)   # [0.87, 0.12, 0.02]     #@low
        softmax(s / 1.0)   # [0.67, 0.24, 0.09]     #@one
        softmax(s / 2.0)   # [0.51, 0.31, 0.19]     #@high
      `,
      beats: [
        { id: 'formula', say: 'A temperature, T, tunes how adventurous sampling is: divide every score by T before the softmax.', code: 'formula' },
        { id: 'low', say: 'With T at one half, the scores double to four, two and zero. The gaps grow, and cat takes {0.87|zero point eight seven}: sharper, closer to greedy.', code: 'low' },
        { id: 'high', say: 'With T at two, the scores halve. The gaps shrink, and the probabilities flatten: {0.51|zero point five one}, {0.31|zero point three one}, and {0.19|zero point one nine}.', code: 'high' },
        { id: 'order', say: 'Either way, the order never changes: cat stays on top. Temperature only changes how often the others get picked.', code: ['low', 'one', 'high'] },
        { id: 'limits', say: 'Push T toward zero and cat takes everything: that is greedy decoding. Push it ever higher, and every token gets the same share.' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
