import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-perplexity',
  title: 'Perplexity',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Jelinek, Mercer, Bahl & Baker', year: 1977, title: 'Perplexity: a measure of the difficulty of speech recognition tasks', url: 'https://doi.org/10.1121/1.2016299', scene: 'torn' },
  ],
  scenes: [
    {
      id: 'torn',
      title: 'Torn between choices',
      codeTitle: 'perplexity.py',
      code: `
        loss = 1.39   # per token: good?   #@q
        p = np.full(4, 1/4)   # even bet   #@p
        -np.log(1/4)   # ln 4 = 1.39       #@loss
        np.exp(1.39)   # 4.0: four ways    #@ppl
        np.exp(np.log(2))    # 2.0         #@k
        np.exp(np.log(10))   # 10.0        #@k
        # right token 1/10 each step: 10   #@q10
      `,
      beats: [
        { id: 'problem', say: 'Train a language model, and its loss on a text, averaged over the tokens, comes out at, say, {1.39|one point three nine}. Is that good? On its own, the number is hard to picture.', code: 'q' },
        { id: 'even', say: 'So take a model that is easy to picture. At every step, it spreads its bet evenly over four tokens, a quarter each, like rolling a fair four-sided die.', code: 'p' },
        { id: 'loss', say: 'Whichever token is right got a quarter, so every step\'s loss is minus ln of a quarter. One over four flips the sign of the log: ln four, about {1.39|one point three nine}.', code: 'loss' },
        { id: 'same', say: 'That is our number. A loss of {1.39|one point three nine} per token is exactly as unsure as a fair pick among four.', code: ['q', 'loss'] },
        { id: 'undo', say: 'To get the four back, undo the log: e to the {1.39|one point three nine} is four. That is the perplexity: e to the average loss, L.', code: 'ppl' },
        { id: 'k', say: 'Spread the bet evenly over two tokens, and the perplexity is two. Over ten, it is ten. Perplexity counts the tokens a model is, in effect, torn between.', code: 'k' },
        { id: 'q', say: 'Only the right token\'s share counts. Give it a tenth at every step, however the rest is spread, and the loss is ln ten each time: a perplexity of ten.', code: 'q10' },
        { id: 'name', say: 'Hence the name. To be perplexed is to be puzzled, torn between ways to go, and the perplexity says how many ways.', code: 'ppl' },
        { id: 'history', say: 'Frederick Jelinek, Robert Mercer, Lalit Bahl and James Baker, at IBM, proposed it in 1977, to measure how hard a speech recognition task is. The size of the vocabulary, they showed, is not a fair measure; perplexity counts the equally likely choices a task amounts to.', code: 'ppl' },
      ],
    },
    {
      id: 'uneven',
      title: 'Uneven bets',
      codeTitle: 'perplexity.py',
      code: `
        p_y = np.array([1/2, 1/4, 1/2, 1/8])  #@py
        losses = -np.log(p_y)                 #@losses
        # 0.69, 1.39, 0.69, 2.08              #@losses
        L = losses.mean()   # 1.21            #@L
        np.exp(L)           # 3.36            #@ppl
        np.exp(4.85)   # total: 128, no       #@sum
      `,
      beats: [
        { id: 'real', say: 'A real model bets unevenly, and differently at every step. Reading four tokens of text, this one gave the right next token a half, then a quarter, a half, and an eighth.', code: 'py' },
        { id: 'loss', say: 'Each step\'s loss is minus ln of its share. The eighth costs the most: ln eight, about {2.08|two point zero eight}.', code: 'losses' },
        { id: 'mean', say: 'Average the four losses, and L is about {1.21|one point two one} per token.', code: 'L' },
        { id: 'exp', say: 'Undo the log: e to the {1.21|one point two one} is about {3.36|three point three six}.', code: 'ppl' },
        { id: 'means', say: 'So on average, this model is as torn as a fair pick among about three and a third tokens.', code: 'ppl' },
        { id: 'order', say: 'Average first, then undo the log. Undo it on the total loss instead, and you count the choices for the whole text at once: a number that grows the longer the text runs.', code: 'sum' },
      ],
    },
    {
      id: 'scale',
      title: 'From one to V',
      codeTitle: 'perplexity.py',
      code: `
        np.exp(0)          # always right: 1  #@one
        np.exp(np.log(V))  # even over V: V   #@V
        np.log(20)         # ppl 20: loss 3.0 #@back
        # A: 12, B: 30, so A is better        #@compare
        np.exp(2)          # loss 2: ppl 7.39 #@units
      `,
      beats: [
        { id: 'one', say: 'Perplexity has a floor. A model that gives the right token all of its probability, every time, has a loss of minus ln one at each step: zero. And e to the zero is one: one choice, the right one.', code: 'one' },
        { id: 'V', say: 'A model that has learned nothing spreads its bet evenly over its whole vocabulary of V tokens, so its perplexity is V: with fifty thousand tokens, fifty thousand.', code: 'V' },
        { id: 'back', say: 'Read it backwards, and the loss is the log of the perplexity. A perplexity of twenty is an average loss of ln twenty, about three.', code: 'back' },
        { id: 'compare', say: 'e to the loss climbs whenever the loss does, so the two always rank models the same way. On the same text and vocabulary, a model at twelve beats a model at thirty: it is torn between fewer tokens.', code: 'compare' },
        { id: 'units', say: 'To set a loss against a perplexity, put both in the same units first. A loss of two is a perplexity of e squared, about {7.39|seven point three nine}.', code: 'units' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
