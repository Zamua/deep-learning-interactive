import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-masked-lm',
  title: 'Masked language models',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'hide',
      title: 'Hide, then recover',
      codeTitle: 'masked.py',
      code: `
        toks = 'the cat sat on a mat'.split()   #@causal
        # causal: 'sat' from 'the cat'          #@causal
        toks[2] = '[MASK]'     # hide 15%        #@mask
        # masked: 'sat' from both sides          #@both
        int(0.15 * 200)        # 30 losses       #@count
      `,
      beats: [
        { id: 'causal', say: 'A causal model like GPT predicts each token from the ones before it. To predict sat, it may use the and cat, and nothing after.', code: 'causal' },
        { id: 'mask', say: 'A masked language model, like BERT, is trained differently. Pick about fifteen percent of the tokens, hide each behind a mask token, and train the model to recover them.', code: 'mask' },
        { id: 'both', say: 'It has no causal mask: every position attends to every other. So to recover sat, it reads the and cat on the left, and on, a, mat on the right.', code: 'both' },
        { id: 'count', say: 'Only the hidden tokens are scored. In a sequence of two hundred tokens, fifteen percent is thirty: thirty losses, where a causal model gets two hundred.', code: 'count' },
      ],
    },
    {
      id: 'jobs',
      title: 'Which one for which job',
      codeTitle: 'masked.py',
      code: `
        # position 2 of 6 attends to:    #@attend
        causal = 3     # 0, 1 and 2      #@attend
        masked = 6     # all six         #@attend
        # write left to right: causal    #@generate
        # fill a blank: masked           #@fill
      `,
      beats: [
        { id: 'attend', say: 'In attention terms: in a sequence of six, position two of a causal model attends to three positions, itself and the two before it. In a masked model, it attends to all six.', code: 'attend' },
        { id: 'generate', say: 'Generating text means writing one token at a time, with nothing yet on the right. That is exactly the causal model\'s training task, so causal models are the ones that write.', code: 'generate' },
        { id: 'fill', say: 'Filling in a blank in the middle of a sentence, with words on both sides, is the masked model\'s task.', code: 'fill' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
