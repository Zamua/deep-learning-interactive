import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-linear-recurrence',
  title: 'Linear recurrences',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'drop',
      title: 'Drop the tanh',
      codeTitle: 'linear_rnn.py',
      code: `
        a, b, c = 0.5, 2, 2            #@abc
        h = 0                # h_0     #@h0
        for x in [3, 1, 2]:            #@loop
            h = a * h + b * x          #@step
            # 6, then 5, then 6.5      #@vals
        y = c * h            # 13      #@y
      `,
      beats: [
        { id: 'recall', say: 'Take the recurrence with one unit, so every weight is a single number, and drop the tanh and the bias.', code: 'step' },
        { id: 'linear', say: 'What is left is {hₜ = a hₜ₋₁ + b xₜ|h t equals a times h t minus one, plus b times x t}: a linear recurrence. a, the decay, scales the old state. b, the input weight, scales the input.', code: 'step' },
        { id: 'out', say: 'An output weight, c, reads out the output: {yₜ = c hₜ|y t equals c times h t}. Here a is a half, and b and c are two.', code: ['abc', 'y'] },
        { id: 'h1', say: 'From {h₀|h zero} at zero, read three, one, two. Step one: half of zero, plus two times three: six.', code: ['h0', 'loop', 'step'] },
        { id: 'h23', say: 'Step two: half of six, plus two, is five. Step three: half of five, plus four, is {6.5|six point five}, and {y₃|y three} is two times that: thirteen.', code: ['vals', 'y'] },
      ],
    },
    {
      id: 'unroll',
      title: 'A sum of past inputs',
      codeTitle: 'unroll.py',
      code: `
        # h3 = b*x3 + a*h2                       #@open
        #    = b*x3 + a*b*x2 + a**2*b*x1         #@open
        w = [c * a**k * b for k in range(3)]     #@w
        w                    # [4.0, 2.0, 1.0]   #@w
        4*2 + 2*1 + 1*3      # 13, as before     #@check
        # a = 0.5: 1, 0.5, 0.25, ...  fades      #@fade
        # a = 1:   1, 1, 1, ...       holds      #@blow
        # a = 2:   1, 2, 4, ...       blows up   #@blow
      `,
      beats: [
        { id: 'open', say: 'Now open the loop: put {h₂|h two} into {h₃|h three}, then {h₁|h one}, and the state becomes a sum of past inputs.', code: 'open' },
        { id: 'weights', say: 'Each input enters times b, then is multiplied by a for each step it waits. So the input k steps back weighs {c aᵏ b|c, times a to the k, times b}: four, two, one. Four times two, plus two, plus three: thirteen.', code: ['w', 'check'] },
        { id: 'fade', say: 'Those weights are powers of a. With a at a half, they halve at every step back: old inputs fade.', code: 'fade' },
        { id: 'blow', say: 'At one they hold; at two they double, and the state blows up. The size of a, written {\\|a\\||a between bars}, decides: below one fades, above one blows up. A negative a only flips the sign.', code: 'blow' },
      ],
    },
    {
      id: 'parallel',
      title: 'Every output at once',
      codeTitle: 'parallel.py',
      code: `
        # tanh RNN: h1, then h2, then h3     #@seq
        x = np.array([3, 1, 2])              #@all
        W = np.array([[4, 0, 0],             #@all
                      [2, 4, 0],             #@all
                      [1, 2, 4]])            #@all
        y = W @ x          # [12, 10, 13]    #@all
      `,
      beats: [
        { id: 'seq', say: 'The tanh recurrence cannot open like that: with a tanh between steps, {h₂|h two} must wait for {h₁|h one}, and {h₃|h three} for {h₂|h two}.', code: 'seq' },
        { id: 'all', say: 'Here, the weights are known before any input arrives. Every output is a weighted sum of the inputs, so all of them can be computed at once.', code: 'all' },
        { id: 'slide', say: 'Each row is the same weights, slid one step along: a convolution. That is why it trains in parallel, and why state space models such as S4 build on it.', code: 'all' },
      ],
    },
    {
      id: 'try',
      title: 'Try two',
      codeTitle: 'try.py',
      code: `
        a, b = 0.5, 4          #@p1
        h = 0                  #@p1
        for x in [2, 1, 3]:    #@p1
            h = a * h + b * x  #@a1
            # 8, 8, 16         #@a1
        a, b, c = 0.5, 3, 2    #@p2
        c * a**2 * b   # 1.5   #@a2
      `,
      beats: [
        { id: 'p1', say: 'Try one: a is a half, b is four, from zero. Inputs two, one, three. What is {h₃|h three}?', code: 'p1' },
        { id: 'a1', say: 'Eight. Then four plus four, eight. Then four plus twelve: sixteen.', code: 'a1' },
        { id: 'p2', say: 'Now a is a half, b three, c two. What weight does {yₜ|y t} give {xₜ₋₂|x t minus two}?', code: 'p2' },
        { id: 'a2', say: 'Two steps back: c, times a squared, times b. Two times a quarter times three: {1.5|one point five}.', code: 'a2' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
