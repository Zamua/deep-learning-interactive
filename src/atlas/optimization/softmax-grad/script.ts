import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-softmax-grad',
  title: 'Deriving the softmax gradient',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'derive',
      title: 'Why p, minus one',
      codeTitle: 'derive.py',
      code: `
        # L = -s[y] + log(T), T = sum(exp(s))  #@expand
        # T moves exp(s[j]) times as fast     #@dT
        # log(T) moves 1 / T times as fast    #@dlog
        # exp(s[j]) / T = p[j]                #@pj
        # d/ds[j] (-s[y]) = -1 if j == y      #@minus
        ds = p.copy()                         #@together
        ds[y] -= 1                            #@together
      `,
      beats: [
        { id: 'recap', say: 'Nudging the scores measured the gradient: {0.6|zero point six}, minus {0.7|zero point seven} and {0.1|zero point one}. That is p, minus one at the correct option. Here is why.', code: 'together' },
        { id: 'expand', say: 'Write the loss out. Minus the log of a fraction is minus the log of the top, plus the log of the bottom: minus {s_y|s y}, the correct option\'s score, plus the log of the total, T.', code: 'expand' },
        { id: 'dT', say: 'Log T reaches {s₀|s zero} through a chain: {s₀|s zero} feeds T, and T feeds log T. T adds up e to every score, and only one of those terms holds {s₀|s zero}. e to the x is its own derivative, so T moves e to the {1.8|one point eight}, about six, times as fast as {s₀|s zero}.', code: 'dT' },
        { id: 'dlog', say: 'And log T, the natural log, has slope one over T. T is about ten, so log T moves a tenth as fast as T. A nudge of {0.01|zero point zero one} grows to {0.06|zero point zero six}, then shrinks to {0.006|zero point zero zero six}.', code: 'dlog' },
        { id: 'pj', say: 'The chain rule multiplies the two: six times a tenth is {0.6|zero point six}, the slope measured before. For any score {sⱼ|s j}, it is e to the {sⱼ|s j}, over the total. That is exactly {pⱼ|p j}.', code: 'pj' },
        { id: 'minus', say: 'Minus {s_y|s y} depends only on the correct score: its derivative is minus one when j is y, and zero when {j ≠ y|j is not y}, the slashed equals sign reading “is not”.', code: 'minus' },
        { id: 'together', say: 'Add the two: {pⱼ − [j = y]|p j, minus the bracket j equals y}. The bracket is one when j is y and zero otherwise, so it is {pⱼ|p j} with one taken away at the correct option. Just the pattern the nudges found.', code: 'together' },
      ],
    },
    {
      id: 'try',
      title: 'Try one',
      codeTitle: 'try.py',
      code: `
        s, y = np.array([2.0, 0.0, 0.0]), 0   #@p1
        T = 7.39 + 1 + 1        # 9.39        #@total
        np.exp(s[0]) / T        # 0.79        #@slope
        ds0 = 0.79 - 1          # -0.21       #@minus
        np.exp(s[1]) / T        # 0.11        #@other
      `,
      beats: [
        { id: 'p1', say: 'Try one: scores two, zero and zero, with option zero correct. Use e to the two, about {7.39|seven point three nine}. What is {∂L/∂s₀|partial L, partial s zero}?', code: 'p1' },
        { id: 'total', say: 'T is {7.39|seven point three nine}, plus one, plus one: {9.39|nine point three nine}.', code: 'total' },
        { id: 'slope', say: 'Through log T: e to the {s₀|s zero}, over T, is {7.39|seven point three nine} over {9.39|nine point three nine}, about {0.79|zero point seven nine}.', code: 'slope' },
        { id: 'minus', say: 'Zero is the correct option, so minus {s_y|s y} adds minus one: {0.79|zero point seven nine} minus one, minus {0.21|zero point two one}.', code: 'minus' },
        { id: 'other', say: 'For {s₁|s one}, the slope is one over {9.39|nine point three nine}, about {0.11|zero point one one}, and nothing more: {s₁|s one} is not the correct score.', code: 'other' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
