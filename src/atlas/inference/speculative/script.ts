import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-speculative',
  title: 'Speculative decoding',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'check',
      title: 'Draft cheaply, check in one pass',
      codeTitle: 'speculate.py',
      code: `
        text = 'The cat sat'                   #@text
        guess = draft(text, k=4)  # on the red mat  #@draft
        picks = large(text, guess)  # 1 pass        #@check
        # on ✓   the ✓   red ✗ (soft)               #@compare
        text += ' on the soft'   # 3 tokens         #@keep
      `,
      beats: [
        { id: 'slow', say: 'Decoding writes one token per pass of the large model, and each of those passes mostly waits on memory.', code: 'text' },
        { id: 'draft', say: 'Speculative decoding adds a small, fast draft model. It guesses the next four tokens, one at a time, cheaply: on, the, red, mat.', code: 'draft' },
        { id: 'check', say: 'Then the large model runs once on all four guesses together, like a prefill. That one pass gives its own pick at every position, plus one more after the last.', code: 'check' },
        { id: 'compare', say: 'Compare them in order. On: the large model agrees. The: agrees. Red: it wanted soft, so red is rejected.', code: 'compare' },
        { id: 'keep', say: 'Keep the agreeing prefix, on the, and add the large model\'s own pick, soft. Mat is thrown away, since it was guessed after red. Three tokens, from one pass of the large model.', code: 'keep' },
      ],
    },
    {
      id: 'count',
      title: 'The prefix, plus one',
      codeTitle: 'speculate.py',
      code: `
        # tokens per pass: accepted prefix + 1    #@rule
        # all 4 accepted: 4 + 1 = 5               #@all
        yields = [3, 5, 1, 3]   # 12 tokens       #@speed
        sum(yields) / len(yields)  # 3x fewer     #@speed
      `,
      beats: [
        { id: 'rule', say: 'So every pass yields its accepted prefix, plus one token of the large model\'s own. Even when the first guess is wrong, the pass still writes one token, as plain decoding would.', code: 'rule' },
        { id: 'all', say: 'When all four guesses are accepted, the extra pick after the last one comes free: five tokens from a single pass.', code: 'all' },
        { id: 'speed', say: 'Say four passes yield three, five, one and three tokens. Twelve tokens took four large passes instead of twelve: three times fewer.', code: 'speed' },
        { id: 'same', say: 'And the text is still the large model\'s own. With greedy decoding, every kept token is exactly the one it would have picked.' },
        { id: 'sample', say: 'With sampling, it keeps each guess with a chance set by how much it agrees: the large model\'s probability for that token over the small model\'s, capped at one. After a rejection it draws from what is left. Every token then comes out with exactly the large model\'s probabilities.' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
