import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-perplexity',
  title: 'Perplexity',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'undo',
      title: 'Undo the log',
      codeTitle: 'perplexity.py',
      code: `
        p_y = np.array([1/2, 1/4, 1/2, 1/8])  #@probs
        losses = -np.log(p_y)                 #@losses
        # [0.69, 1.39, 0.69, 2.08]            #@losses
        L = losses.mean()       # 1.21        #@mean
        ppl = np.exp(L)         # 3.36        #@ppl
      `,
      beats: [
        { id: 'probs', say: 'A language model reads four tokens of text. At each step, it gave the right next token a probability of one half, then one quarter, one half, and one eighth.', code: 'probs' },
        { id: 'losses', say: 'Each step\'s loss is minus the log of that probability: {0.69|zero point six nine}, {1.39|one point three nine}, {0.69|zero point six nine} and {2.08|two point zero eight}.', code: 'losses' },
        { id: 'mean', say: 'Averaged over the four tokens, the loss, L, is about {1.21|one point two one} per token. True, but hard to picture.', code: 'mean' },
        { id: 'exp', say: 'Perplexity undoes the log: it is {eᴸ|e to the L}, e to the average loss. e to the {1.21|one point two one} is about {3.36|three point three six}.', code: 'ppl' },
      ],
    },
    {
      id: 'count',
      title: 'A number of choices',
      codeTitle: 'perplexity.py',
      code: `
        k = 4                                     #@uniform
        np.exp(np.log(k))    # 4.0               #@uniform
        # always right: 1    knows nothing: V    #@bounds
        # A: 12.0   B: 30.0   A is better         #@compare
      `,
      beats: [
        { id: 'uniform', say: 'Why that is a count: picture a model that spreads its probability evenly over four tokens. It gives the right one a quarter, every time.', code: 'uniform' },
        { id: 'k', say: 'Its loss is the log of four on every token, and e to the log of four is four. Its perplexity is exactly four.', code: 'uniform' },
        { id: 'means', say: 'So a perplexity of {3.36|three point three six} means the model is, on average, as unsure as a fair pick among about {3.4|three point four} tokens.', code: 'uniform' },
        { id: 'bounds', say: 'A model that is always sure and always right scores one, the best possible. One that spreads evenly over a vocabulary of V tokens scores V.', code: 'bounds' },
        { id: 'compare', say: 'Since e to the loss rises with the loss, lower perplexity means lower loss. On the same text and vocabulary, a model at twelve beats a model at thirty.', code: 'compare' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
