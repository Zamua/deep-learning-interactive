import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-grad-check',
  title: 'Gradient checking',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'numeric',
      title: 'Measure the slope directly',
      codeTitle: 'numeric.py',
      code: `
        def f(x): return x**2                      #@f
        h = 0.1                                    #@h
        (f(3 + h) - f(3 - h)) / (2 * h)   # 6.0    #@c
        (f(3 + h) - f(3)) / h             # 6.1    #@one
      `,
      beats: [
        { id: 'why', say: 'Backprop code is easy to get subtly wrong. So check it against a slope measured directly, from f itself. Here f is x squared, at x equals three.', code: 'f' },
        { id: 'sides', say: 'Step a small h to each side, here a tenth, and evaluate f at both points: {8.41|eight point four one} and {9.61|nine point six one}.', code: ['h', 'c'] },
        { id: 'divide', say: 'Rise over run: their difference, {1.2|one point two}, over the distance between them, two h. That gives six: the centered difference.', code: 'c' },
        { id: 'one', say: 'A one-sided step, from three to {3.1|three point one}, gives {6.1|six point one}: a tenth too high. Here the centered difference is exactly right.', code: 'one' },
      ],
    },
    {
      id: 'error',
      title: 'Why centered is closer',
      codeTitle: 'error.py',
      code: `
        def f(x): return x**3       # slope at 1: 3  #@f
        (f(1.1) - f(1)) / 0.1       # 3.31           #@ten
        (f(1.1) - f(0.9)) / 0.2     # 3.01           #@ten
        (f(1.01) - f(1)) / 0.01     # 3.0301         #@hund
        (f(1.01) - f(0.99)) / 0.02  # 3.0001         #@hund
        (f(1) - f(0.9)) / 0.1       # 2.71           #@left
        (3.31 + 2.71) / 2           # 3.01           #@cancel
      `,
      beats: [
        { id: 'cube', say: 'That exactness is special to x squared. Take x cubed instead, at x equals one. Its slope there is three x squared: three.', code: 'f' },
        { id: 'ten', say: 'With h a tenth, the one-sided difference gives {3.31|three point three one}, off by {0.31|zero point three one}. The centered one gives {3.01|three point zero one}, off by only {0.01|zero point zero one}.', code: 'ten' },
        { id: 'hund', say: 'Now shrink h ten times, to a hundredth. The one-sided error shrinks about ten times, to {0.0301|zero point zero three zero one}. The centered error shrinks a hundred times, to {0.0001|zero point zero zero zero one}.', code: 'hund' },
        { id: 'order', say: 'So the one-sided error shrinks like h, and the centered error like h squared. A tenth of the step, a hundredth of the error.', code: ['ten', 'hund'] },
        { id: 'left', say: 'Why? Step to the left instead, from {0.9|zero point nine} to one. That gives {2.71|two point seven one}: too low by {0.29|zero point two nine}, about as much as the right step was too high.', code: 'left' },
        { id: 'cancel', say: 'The centered difference is the average of the two steps, {3.01|three point zero one}. One overshoots, the other undershoots, and their errors nearly cancel.', code: 'cancel' },
      ],
    },
    {
      id: 'compare',
      title: 'Relative error',
      codeTitle: 'check.py',
      code: `
        a = backprop_grad      # analytic       #@a
        n = centered_diff      # numerical      #@a
        rel = abs(a - n) / max(abs(a), abs(n))  #@rel
        # 1e-7 right, 1e-4 suspicious, 1e-2 bug #@bands
        # bug: a = 3, n = 6 -> rel = 0.5        #@bug
      `,
      beats: [
        { id: 'diff', say: 'Now compare backprop\'s answer, a, with the measured one, n. Their raw difference is not enough: off by one ten-thousandth is nothing next to a thousand, but huge next to two ten-thousandths.', code: 'a' },
        { id: 'rel', say: 'So divide the size of the difference, {\\|a − n\\||the absolute value of a minus n}, by the larger of the two sizes. That is the relative error. The bars mean absolute value: a number\'s size, with its sign dropped.', code: 'rel' },
        { id: 'bands', say: 'Around {10⁻⁷|ten to the minus seven} or smaller, written {1e-7|one e minus seven} in code, the two agree, and the gradient is right. Around {10⁻⁴|ten to the minus four}, be suspicious. Around {10⁻²|ten to the minus two} or more, there is a bug.', code: 'bands' },
        { id: 'bug', say: 'Say backprop used x where it should have used two x. It gives three where the slope is six: a relative error of a half. Clearly a bug.', code: 'bug' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
