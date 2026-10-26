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
        # sampled, red: keep with chance 0.3 / 0.6 #@red
        # keep: min(1, p_large / p_small)         #@cap
      `,
      beats: [
        { id: 'rule', say: 'So every pass yields its accepted prefix, plus one token of the large model\'s own. Even when the first guess is wrong, the pass still writes one token, as plain decoding would.', code: 'rule' },
        { id: 'all', say: 'When all four guesses are accepted, the extra pick after the last one comes free: five tokens from a single pass.', code: 'all' },
        { id: 'speed', say: 'Say four passes yield three, five, one and three tokens. Twelve tokens took four large passes instead of twelve: three times fewer.', code: 'speed' },
        { id: 'same', say: 'And the text is still the large model\'s own. With greedy decoding, every kept token is exactly the one it would have picked.' },
        { id: 'sample', say: 'With sampling, there is no single pick to match. Take the guess red: say the draft gave it a probability of {0.6|zero point six}, and the large model gives it {0.3|zero point three}. Red is kept with chance {0.3 / 0.6|zero point three over zero point six}: one half.', code: 'red' },
        { id: 'cap', say: 'In general, a guess is kept with chance {min(1, p_large / p_small)|the smaller of one, and the large model\'s probability over the small model\'s}. When the large model likes a guess at least as much as the draft does, it is always kept.', code: 'cap' },
        { id: 'resid', say: 'After a rejection, the large model draws a replacement from what is left over: its own probabilities, with the share the draft already offered taken out. Balanced that way, every token comes out with exactly the large model\'s probabilities.' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
