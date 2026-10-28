import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-char-lm',
  title: 'Next-token prediction',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Shannon', year: 1951, title: 'Prediction and entropy of printed English', url: 'https://doi.org/10.1002/j.1538-7305.1951.tb01366.x', scene: 'game' },
    { who: 'Elman', year: 1990, title: 'Finding structure in time', url: 'https://doi.org/10.1207/s15516709cog1402_1', scene: 'loss' },
  ],
  scenes: [
    {
      id: 'game',
      title: 'Guess the next letter',
      codeTitle: 'char_lm.py',
      code: `
        text = 'hello'                    #@text
        # before each letter, guess it    #@game
        vocab = ['h', 'e', 'l', 'o']      #@vocab
        V = len(vocab)        # 4         #@vocab
      `,
      beats: [
        { id: 'game', say: 'Here is a game. Read a text one letter at a time, and before each new letter, guess what it will be. After h, e, l, l, most people would guess o.', code: ['text', 'game'] },
        { id: 'shannon', say: 'In 1951, Claude Shannon played this game with people, in a paper called Prediction and Entropy of Printed English. How well they guessed measured how predictable English is: its entropy, the average surprise per letter.', code: 'game' },
        { id: 'free', say: 'The game needs nobody to grade it. A classifier needs someone to label every image, cat or ship. Text holds its own answers: each letter is the right answer for the letters before it.', code: 'text' },
        { id: 'lm', say: 'So any text at all can teach a model to play. A model that plays is called a language model: a model of how a language goes, of which pieces tend to follow which.', code: 'game' },
        { id: 'vocab', say: 'The pieces it reads are tokens, here single characters. Its vocabulary, every token it knows, is just h, e, l and o, with ids zero to three. Its size, V, is four.', code: 'vocab' },
      ],
    },
    {
      id: 'shift',
      title: 'The text is the answer key',
      codeTitle: 'char_lm.py',
      code: `
        xs = text[:-1]   # h e l l        #@xs
        ys = text[1:]    # e l l o        #@ys
        # step t reads xs[t], predicts ys[t]  #@t
      `,
      beats: [
        { id: 'inputs', say: 'Feed hello in, one character at a time. The inputs are h, e, l, l: every letter but the last, since nothing follows the o.', code: 'xs' },
        { id: 'shift', say: 'The targets are the same text, shifted by one place: e, l, l, o. Each step\'s target is the letter that comes next.', code: 'ys' },
        { id: 'y', say: 'Number the steps with t, from zero, and call step t\'s target {yₜ|y of t}, written as its id. At step zero, after h, the target is e: id one.', code: 't' },
        { id: 'memory', say: 'Steps two and three both read an l, but one must predict l, and the other o. The input alone cannot tell them apart. The memory, h, can: it knows whether one l has come, or two.', code: ['xs', 'ys'] },
      ],
    },
    {
      id: 'guess',
      title: 'A guess over the vocabulary',
      codeTitle: 'char_lm.py',
      code: `
        s = W_hy @ h     # V = 4 scores   #@s
        p = softmax(s)   # .1 .5 .3 .1    #@p
        p[1]             # 0.5: e         #@py
      `,
      beats: [
        { id: 'scores', say: 'At each step, the network reads its memory, h, through one more matrix of weights, {W_hy|W h y}: hidden to output. Out comes one score for every token in the vocabulary.', code: 's' },
        { id: 'V', say: 'That is V scores, four here, however big the memory and however long the text: the next letter could be any token, so every token gets a score.', code: 's' },
        { id: 'softmax', say: 'Softmax turns the scores into probabilities for the next letter. After reading h, this model gives the target, e, {0.5|zero point five}.', code: 'p' },
        { id: 'id', say: 'To find the target in p, use its id. e is token one, so its probability is entry one: {p[1]|p of one}.', code: 'py' },
        { id: 'every', say: 'Every step makes a guess like this, over the whole vocabulary, against its own target: the one bar that should be tall.', code: 'p' },
      ],
    },
    {
      id: 'loss',
      title: 'Add up the surprise',
      codeTitle: 'char_lm.py',
      code: `
        p_y = [0.5, 0.4, 0.6, 0.8]  # e l l o  #@py
        L_t = -np.log(p_y)  # .69 .92 .51 .22  #@Lt
        L = L_t.sum()       # 2.34             #@L
        L / 4               # 0.59 a step      #@mean
      `,
      beats: [
        { id: 'step', say: 'Each guess is a classification over the vocabulary, so its loss, {Lₜ|L of t}, is cross-entropy: minus the log of the target\'s probability. At step zero, minus ln {0.5|zero point five} is {0.69|zero point six nine}.', code: ['py', 'Lt'] },
        { id: 'all', say: 'Every step pays for its own target the same way. The surer the guess, the less it pays: the last step, which gave its target {0.8|zero point eight}, pays only {0.22|zero point two two}.', code: 'Lt' },
        { id: 'elman', say: 'Shannon\'s guessers missed most often at the beginnings of words. In 1990, Jeffrey Elman saw the same in a network trained to predict the next letter of text with no spaces: its error was high at each word\'s first letter, and fell as the word went on.', code: 'Lt' },
        { id: 'total', say: 'The loss for the whole text, L, adds up every step\'s: {2.34|two point three four}.', code: 'L' },
        { id: 'sum', say: 'In symbols, {L = Σₜ −ln pₜ[yₜ]|L is the sum, over the steps t, of minus ln p t, at y t}: at each step, minus the log of the probability it gave its target.', code: 'L' },
        { id: 'mean', say: 'Divide by the four steps for the average: about {0.59|zero point five nine} a step, a number that does not grow just because the text is longer.', code: 'mean' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
