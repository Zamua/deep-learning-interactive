import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-chain-of-thought',
  title: 'Chain of thought',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'depth',
      title: 'One pass, so many steps',
      codeTitle: 'steps.py',
      code: `
        q = 'What is 17 × 24?'                   #@q
        generate(q)         # '418': wrong        #@direct
        generate(q + ' Work it out step by step.')  #@cot
        # 17 × 20 = 340                           #@s1
        # 17 × 4 = 68                             #@s2
        # 340 + 68 = 408                          #@s3
      `,
      beats: [
        { id: 'pass', say: 'A language model writes one token per pass, and every pass runs through the same fixed stack of layers. So one pass can take only so many steps, one after another.', code: 'q' },
        { id: 'direct', say: 'Ask for {17 × 24|seventeen times twenty four} and make it answer at once. The whole calculation has to fit in that one pass, and here it does not: {418|four hundred and eighteen}, wrong.', code: 'direct' },
        { id: 'step1', say: 'Now let it write its steps first. The first pass only has one small step to do: {17 × 20 = 340|seventeen times twenty is three hundred and forty}.', code: ['cot', 's1'] },
        { id: 'feed', say: 'That token goes back in as input. The next pass reads {340|three hundred and forty} instead of working it out again, and takes the next step: {17 × 4 = 68|seventeen times four is sixty eight}.', code: 's2' },
        { id: 'answer', say: 'The third pass adds them: {408|four hundred and eight}, right. No pass had to do more than one small step, because each started from the steps written before it.', code: 's3' },
      ],
    },
    {
      id: 'cost',
      title: 'The price is tokens',
      codeTitle: 'cost.py',
      code: `
        at_once = 2          # tokens     #@once
        with_steps = 30 + 2  # tokens     #@steps
        ms = 20              # per token  #@ms
        at_once * ms         # 40 ms      #@t
        with_steps * ms      # 640 ms     #@t
        2000 * ms / 1000     # 40 s       #@long
      `,
      beats: [
        { id: 'tokens', say: 'The price is tokens. Answering at once took two. With its steps, the model wrote thirty more before the same two-token answer.', code: ['once', 'steps'] },
        { id: 'time', say: 'Every token is one more pass. At twenty milliseconds a token, that is forty milliseconds against six hundred and forty: sixteen times as long.', code: ['ms', 't'] },
        { id: 'long', say: 'A long chain of two thousand tokens takes forty seconds before the answer even begins.', code: 'long' },
        { id: 'helps', say: 'So the steps pay off when the answer is built from steps: arithmetic, a word problem, anything where each step needs the one before.' },
        { id: 'recall', say: 'Ask for the capital of France, and there is nothing to build on. The model knows it or it does not, and the steps only cost time.' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
