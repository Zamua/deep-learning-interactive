import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-rope-scaling',
  title: 'Stretching rotary positions',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Chen, Wong, Chen & Tian', year: 2023, title: 'Extending Context Window of Large Language Models via Positional Interpolation', url: 'https://arxiv.org/abs/2306.15595', scene: 'squeeze' },
  ],
  scenes: [
    {
      id: 'seen',
      title: 'Angles training never made',
      codeTitle: 'trained.py',
      code: `
        # trained on texts of up to 1,000  #@train
        theta = 0.1   # degrees per step   #@theta
        999 * theta   # 99.9: the most     #@theta
        3000 * theta  # 300: never seen    #@past
        train_len = 1000                   #@L
      `,
      beats: [
        { id: 'problem', say: 'A model with rotary positions learns from texts of up to a thousand tokens. Hand it one of four thousand, and past the first thousand, its predictions can get as bad as an untrained model\'s. Why?', code: 'train' },
        { id: 'slow', say: 'Follow one slow pair, which turns a tenth of a degree per position. In all of training, its arrow only swept this shaded slice, between zero and {99.9°|ninety nine point nine degrees}.', code: 'theta' },
        { id: 'past', say: 'At position three thousand it has turned {300°|three hundred degrees}, into a part of the circle training never showed it.', code: 'past' },
        { id: 'fail', say: 'Queries and keys arrive turned in ways the model never learned to read, and the attention scores go wildly wrong.', code: 'past' },
        { id: 'fast', say: 'Fast pairs are fine: they went round many times in training and met every angle. It is the slow ones that are pushed somewhere new.', code: 'theta' },
        { id: 'L', say: 'Write {L_train|L train} for the trained length, here a thousand: every position training saw was below it.', code: 'L' },
      ],
    },
    {
      id: 'squeeze',
      title: 'Divide every position',
      codeTitle: 'interpolate.py',
      code: `
        new_len = 4000                    #@scale
        scale = new_len / train_len  # 4  #@scale
        3000 / scale * theta  # 75 deg    #@angle
        3999 / scale          # 999.75    #@last
        3001 / scale          # 750.25    #@between
        theta / scale     # 0.025 apart   #@close
      `,
      beats: [
        { id: 'idea', say: 'In 2023, Shouyuan Chen and colleagues at Meta turned this around. Instead of letting positions run past the trained range, squeeze the long text into it: divide every position by the same number.', code: 'scale' },
        { id: 's', say: 'That number is the stretch, s: the new length over {L_train|L train}. Here, four thousand over a thousand: four.', code: 'scale' },
        { id: 'angle', say: 'So position three thousand turns as if it sat at {750|seven hundred fifty}: {75°|seventy five degrees}, an angle training made.', code: 'angle' },
        { id: 'last', say: 'Even the last token, at {3,999|three thousand nine hundred ninety nine}, turns as if at {999.75|nine hundred ninety nine point seven five}: still below {L_train|L train}.', code: 'last' },
        { id: 'between', say: 'Most positions now land between two whole ones: three thousand and one turns as if at {750.25|seven hundred fifty point two five}. Filling in between known points is called interpolation, which names the method: position interpolation. Running past them is extrapolation.', code: 'between' },
        { id: 'close', say: 'The price: neighbors now sit a quarter step apart, turning {0.025°|zero point zero two five degrees} apart instead of a tenth. So the model gets a fine-tune: a short extra round of training, on long texts, to read the finer spacing.', code: 'close' },
        { id: 'llama', say: 'That is how they stretched {LLaMA|Llama} models, trained on {2,048|two thousand and forty eight} tokens, to read up to {32,768|thirty two thousand seven hundred sixty eight}: an s of sixteen.' },
        { id: 'steps', say: 'The fine-tune took at most a thousand steps.' },
      ],
    },
    {
      id: 'try',
      title: 'Try one',
      codeTitle: 'try.py',
      code: `
        train_len, new_len = 2048, 8192   #@p
        theta = 0.1                       #@p
        scale = new_len / train_len  # 4  #@s
        6000 * theta     # 600: unseen    #@raw
        6000 / scale * theta  # 150       #@scaled
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
