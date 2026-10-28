import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-speculative',
  title: 'Speculative decoding',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Stern, Shazeer & Uszkoreit', year: 2018, title: 'Blockwise Parallel Decoding for Deep Autoregressive Models', url: 'https://arxiv.org/abs/1811.03115', scene: 'check' },
    { who: 'Leviathan, Kalman & Matias', year: 2022, title: 'Fast Inference from Transformers via Speculative Decoding', url: 'https://arxiv.org/abs/2211.17192', scene: 'check' },
    { who: 'Chen, Borgeaud, Irving, Lespiau, Sifre & Jumper', year: 2023, title: 'Accelerating Large Language Model Decoding with Speculative Sampling', url: 'https://arxiv.org/abs/2302.01318', scene: 'sample' },
  ],
  scenes: [
    {
      id: 'wait',
      title: 'One pass, one token',
      codeTitle: 'decode.py',
      code: `
        # 4 new tokens: 4 large passes   #@loop
        # each reads every weight        #@read
        # prefill: known tokens share    #@share
        #   a single read of the weights #@share
        # next tokens: not known yet     #@catch
        guess = draft(text, k=4)         #@guess
      `,
      beats: [
        { id: 'loop', say: 'A large model writes one token per pass, each pass waiting for the one before: four tokens, four passes.', code: 'loop' },
        { id: 'read', say: 'And each pass is mostly waiting on memory, carrying every weight to the arithmetic, all for a single token.', code: 'read' },
        { id: 'share', say: 'A prefill does better. Its tokens are all known, so they share one pass, and one read of the weights serves them all.', code: 'share' },
        { id: 'catch', say: 'But tokens still being written are not known yet: each depends on the one before.', code: 'catch' },
        { id: 'guess', say: 'Unless you guess them. A small model guesses the next four, quickly, and the large model checks them all in one pass, like a prefill.', code: 'guess' },
      ],
    },
    {
      id: 'check',
      title: 'Draft, then check',
      codeTitle: 'speculate.py',
      code: `
        text = 'The cat sat'             #@text
        guess = draft(text, k=4)         #@draft
        picks = large(text, guess)       #@check
        # on ✓  the ✓  red ✗ (soft)      #@compare
        text += ' on the soft'           #@keep
        # mat: after red, thrown away    #@mat
      `,
      beats: [
        { id: 'draft', say: 'Say the text so far is: the cat sat. The small model is called the draft model: like a first draft, it is written fast, to be checked. One cheap pass per token, it guesses: on, the, red, mat.', code: ['text', 'draft'] },
        { id: 'check', say: 'Then the large model runs once over the text and all four guesses. At every position it gives its own next pick, plus one more after the last guess.', code: 'check' },
        { id: 'compare', say: 'Compare in order. The large model\'s first pick is on, and the guess agrees. Its second, the word the, agrees too. Its third is soft, not red, so red is rejected.', code: 'compare' },
        { id: 'keep', say: 'Keep the agreeing prefix, the guesses before the first wrong one: on, the. Add the large model\'s own pick, soft. Three tokens, from one large pass.', code: 'keep' },
        { id: 'mat', say: 'Mat is thrown away, even though the large model picked mat too. It was guessed after red, and everything after a rejection goes.', code: 'mat' },
        { id: 'stern', say: 'In 2018, Mitchell Stern, at Berkeley, and colleagues at Google had a model propose several tokens at once, then keep the longest prefix it confirmed, for greedy decoding.', code: 'compare' },
        { id: 'name', say: 'In 2022, Yaniv Leviathan, Matan Kalman and Yossi Matias at Google handed the guessing to a smaller model. They named it after speculative execution, where a processor runs ahead on a guess, and throws the work away if the guess was wrong.', code: 'draft' },
      ],
    },
    {
      id: 'count',
      title: 'The prefix, plus one',
      codeTitle: 'speculate.py',
      code: `
        # per pass: prefix + 1           #@rule
        # all 4 accepted: 4 + 1 = 5      #@all
        yields = [3, 5, 1, 3]  # 12      #@speed
        12 / 4   # 3x fewer passes       #@fewer
        # greedy: the large model's text #@same
      `,
      beats: [
        { id: 'rule', say: 'So every pass yields its accepted prefix, plus one token of the large model\'s own. Even if the first guess is wrong, the pass still writes one token, as plain decoding would.', code: 'rule' },
        { id: 'all', say: 'If all four are accepted, the large model\'s pick after the last one comes free: five tokens from one pass.', code: 'all' },
        { id: 'speed', say: 'Say four passes yield three, five, one and three tokens: twelve in all.', code: 'speed' },
        { id: 'fewer', say: 'Plain decoding would need twelve large passes for those, and this took four. Twelve over four: three times fewer.', code: 'fewer' },
        { id: 'same', say: 'And with greedy decoding, every kept token is exactly the one the large model would pick alone. The draft changes how fast, never what.', code: 'same' },
      ],
    },
    {
      id: 'sample',
      title: 'Sampling, exactly',
      codeTitle: 'accept.py',
      code: `
        # draft: p_small(red) = 0.6      #@probs
        # large: p_large(red) = 0.3      #@probs
        # keep red: 0.3 / 0.6 = 0.5      #@red
        # keep: min(1, p_large/p_small)  #@cap
        # kept: up to the draft's share  #@kept
        # rejected: draw from the gaps   #@gap
      `,
      beats: [
        { id: 'sample', say: 'With sampling, there is no single pick to match, only probabilities. Say the draft gave its guess, red, {0.6|zero point six}, and the large model gives red only {0.3|zero point three}.', code: 'probs' },
        { id: 'red', say: 'Then red is kept with chance {0.3 / 0.6|zero point three over zero point six}: one half.', code: 'red' },
        { id: 'cap', say: 'In general, a guess is kept with chance {min(1, p_large / p_small)|the smaller of one, and the large model\'s probability over the draft\'s}. If the large model likes it at least as much as the draft, it is always kept.', code: 'cap' },
        { id: 'bars', say: 'Now picture three tokens the draft might guess: red, soft and rug. Blue bars are the large model\'s probabilities, and purple lines the draft\'s.', code: 'probs' },
        { id: 'kept', say: 'Kept guesses fill each blue bar up to the purple line, never past it. Red, offered six times in ten and kept half of those, fills its bar exactly: three in ten.', code: 'kept' },
        { id: 'gap', say: 'Soft and rug are left with gaps, where the large model wants more than the draft offered. After a rejection, the replacement is drawn from the gaps alone, in proportion to their sizes, so it fills them exactly.', code: 'gap' },
        { id: 'who', say: 'So every token comes out with exactly the large model\'s probabilities. Leviathan\'s team found this rule, and so, independently, did Charlie Chen and colleagues at DeepMind, in 2023.', code: ['kept', 'gap'] },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
