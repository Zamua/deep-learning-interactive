import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-rope-scaling',
  title: 'Stretching rotary positions',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'seen',
      title: 'Angles training never made',
      codeTitle: 'trained.py',
      code: `
        train_len = 1000    # positions 0 to 999         #@train
        theta = 0.1         # degrees per position       #@theta
        999 * theta         # 99.9: the largest seen     #@theta
        3000 * theta        # 300: never seen            #@past
      `,
      beats: [
        { id: 'train', say: 'A model with rotary positions is trained on texts of up to a thousand tokens. Write {L_train|L train} for that trained length: every position it saw was below it, from zero to {999|nine hundred ninety nine}.', code: 'train' },
        { id: 'slow', say: 'Follow one slow pair, with {θ|theta} of a tenth of a degree per position. At position m it turns by {mθ|m theta}, so in training its angle only ran from zero to {99.9°|ninety nine point nine degrees}.', code: 'theta' },
        { id: 'past', say: 'Now give it a text of four thousand tokens. At position three thousand, the pair turns {300°|three hundred degrees}: an angle it never had in training.', code: 'past' },
        { id: 'fail', say: 'Queries and keys arrive turned in ways the model never learned to read. The scores go wrong, and past the trained length, quality collapses.', code: 'past' },
        { id: 'fast', say: 'Fast pairs are fine: they went round many times in training and met every angle. The slow ones are pushed somewhere new.', code: 'theta' },
      ],
    },
    {
      id: 'squeeze',
      title: 'Divide every position',
      codeTitle: 'interpolate.py',
      code: `
        new_len = 4000                                #@scale
        scale = new_len / train_len    # s = 4        #@scale
        3000 / scale * theta           # 75 degrees   #@angle
        3999 / scale                   # 999.75       #@last
        theta / scale        # 0.025 degrees per step #@close
      `,
      beats: [
        { id: 'idea', say: 'Position interpolation, from Chen and others at Meta in 2023, squeezes the long text into the trained range. It divides every position by s, the stretch: the new length over {L_train|L train}.', code: 'scale' },
        { id: 'scale', say: 'Here s is four thousand over a thousand: four.', code: 'scale' },
        { id: 'angle', say: 'So position three thousand turns as if it sat at {750|seven hundred fifty}: {75°|seventy five degrees}, an angle training made.', code: 'angle' },
        { id: 'last', say: 'Even the last token, at {3,999|three thousand nine hundred ninety nine}, turns as if at {999.75|nine hundred ninety nine point seven five}, below {L_train|L train}. Every angle stays in the trained range.', code: 'last' },
        { id: 'close', say: 'The price: neighbors sit closer, turning {0.025°|zero point zero two five degrees} apart instead of a tenth. A short fine-tune on long texts teaches the model the finer spacing.', code: 'close' },
        { id: 'llama', say: 'That is how LLaMA, trained on {2,048|two thousand and forty eight} tokens, was stretched to {32,768|thirty two thousand seven hundred sixty eight}: s of sixteen, with at most a thousand steps of fine-tuning.' },
      ],
    },
    {
      id: 'try',
      title: 'Try one',
      codeTitle: 'try.py',
      code: `
        train_len, new_len = 2048, 8192         #@p
        theta = 0.1                             #@p
        scale = new_len / train_len   # 4       #@s
        6000 * theta          # 600: unseen     #@raw
        6000 / scale * theta  # 150             #@scaled
      `,
      beats: [
        { id: 'p', say: 'Try one. A model trained on {2,048|two thousand and forty eight} positions should read {8,192|eight thousand one hundred ninety two}. A pair turns a tenth of a degree per position. How far does it turn at position six thousand?', code: 'p' },
        { id: 's', say: 'First the stretch: {8,192|eight thousand one hundred ninety two} over {2,048|two thousand and forty eight} is four.', code: 's' },
        { id: 'raw', say: 'Without it, six thousand times a tenth is {600°|six hundred degrees}, far past the {204.7°|two hundred and four point seven} training reached.', code: 'raw' },
        { id: 'scaled', say: 'With it, six thousand over four is {1,500|fifteen hundred}, times a tenth: {150°|a hundred and fifty degrees}.', code: 'scaled' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
