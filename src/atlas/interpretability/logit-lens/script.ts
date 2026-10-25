import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-logit-lens',
  title: 'The logit lens',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'idea',
      title: 'Decode the stream partway up',
      codeTitle: 'lens.py',
      code: `
        scores = W_U @ x_top      # one per token     #@top
        for l, x in enumerate(stream):  # every x_l   #@loop
            print(l, vocab[np.argmax(W_U @ x)])       #@lens
      `,
      beats: [
        { id: 'top', say: 'At the top, the model scores every token by multiplying the final stream by the unembedding: one row per token, one dot product each.', code: 'top' },
        { id: 'sum', say: 'But the final stream is just {x₀|x zero} plus every block\'s write, and a partial sum is the same kind of vector.' },
        { id: 'lens', say: 'So multiply the stream partway up by the same unembedding. That is the logit lens: what the model would predict if it stopped there.', code: ['loop', 'lens'] },
      ],
    },
    {
      id: 'example',
      title: 'Watch a prediction form',
      codeTitle: 'example.py',
      code: `
        W_U = [[2, 0], [0, 2], [1, 1]]   # Paris, Rome, the  #@wu
        x0 = [1, 0]         # scores 2, 0, 1: Paris   #@x0
        x1 = x0 + [-1, 2]   # [0, 2]: scores 0, 4, 2  #@x1
      `,
      beats: [
        { id: 'setup', say: 'A tiny model reads "the capital of Italy is". Its stream is two numbers wide, and three tokens matter: Paris, Rome, and "the". Here is each token\'s row of the unembedding.', code: 'wu' },
        { id: 'x0', say: 'The stream starts at one, zero. Dot it with each row: Paris scores two, Rome zero, "the" one. The lens says Paris.', code: 'x0' },
        { id: 'x1', say: 'Block zero writes minus one, two, so the stream becomes zero, two. Now Paris scores zero, Rome four, and "the" two. After block zero, the lens says Rome.', code: 'x1' },
        { id: 'story', say: 'Read block by block, the lens shows the answer forming. Early blocks also write notes for later ones that the unembedding cannot read, so early guesses are often noisy.' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
