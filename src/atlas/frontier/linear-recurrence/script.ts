import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-linear-recurrence',
  title: 'Linear recurrences',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Martin & Cundy', year: 2018, title: 'Parallelizing linear recurrent neural nets over sequence length', url: 'https://arxiv.org/abs/1709.04057', scene: 'wait' },
  ],
  scenes: [
    {
      id: 'wait',
      title: 'One step at a time',
      codeTitle: 'rnn.py',
      code: `
        for x in xs:    # in order       #@loop
            z = Whh @ h + Wxh @ x        #@mix
            h = np.tanh(z)   # bend      #@tanh
        # step 2 waits for step 1,       #@wait
        # step 3 for step 2, ...         #@wait
      `,
      beats: [
        { id: 'read', say: 'A recurrent network reads a text one token at a time: each step mixes its hidden state with the next token, and bends the sum with a tanh.', code: ['loop', 'mix', 'tanh'] },
        { id: 'wait', say: 'So the steps stand in line: {h₂|h two} waits for {h₁|h one}, and {h₃|h three} for {h₂|h two}. A thousand tokens, a thousand steps in a row.', code: 'wait' },
        { id: 'idle', say: 'The chips that train networks do thousands of multiplications at once, in parallel, but this chain feeds them one small step at a time.', code: 'wait' },
        { id: 'blame', say: 'The tanh is what holds the line. Take it out, and every state can be written straight from the inputs, all at once.', code: 'tanh' },
        { id: 'history', say: 'In 2018, Eric Martin and Chris Cundy showed how to train recurrences like that in parallel along the whole sequence, making several networks up to nine times faster.' },
      ],
    },
    {
      id: 'drop',
      title: 'Drop the tanh',
      codeTitle: 'linear_rnn.py',
      code: `
        a, b, c = 0.5, 2, 2              #@abc
        h = 0                # h_0       #@h0
        for x in [3, 1, 2]:              #@loop
            h = a * h + b * x            #@step
            # 6, then 5, then 6.5        #@vals
        y = c * h            # 13        #@y
      `,
      beats: [
        { id: 'one', say: 'Shrink the network to one unit, so the state and every weight are single numbers. Then drop the tanh, and the bias: the old state times one weight, plus the input times another.', code: 'step' },
        { id: 'a', say: 'Call the first weight a. It multiplies the whole state at every step, so below one, the past shrinks each time: a is the decay.', code: 'step' },
        { id: 'b', say: 'Call the second b, the input weight, which scales each input as it arrives: a weight, not the old bias.', code: 'step' },
        { id: 'linear', say: 'Nothing bends the sum now, just weights times numbers, added up. So it is a linear recurrence: one linear rule, recurring at every step.', code: 'step' },
        { id: 'c', say: 'A third weight, c, the output weight, reads the state out: {yₜ = c hₜ|y t equals c times h t}.', code: 'y' },
        { id: 'h1', say: 'Say a is a half, and b and c are two. From {h₀|h zero} at zero, read three, one, two. Step one: half of zero, plus two times three: six.', code: ['abc', 'h0', 'loop', 'step'] },
        { id: 'h2', say: 'Step two: half of six, plus two times one: five.', code: ['step', 'vals'] },
        { id: 'h3', say: 'Step three: half of five, plus two times two: {6.5|six point five}.', code: ['step', 'vals'] },
        { id: 'y', say: 'And {y₃|y three} is two times that: thirteen.', code: 'y' },
      ],
    },
    {
      id: 'unroll',
      title: 'A sum of past inputs',
      codeTitle: 'unroll.py',
      code: `
        # h3 = b*x3 + a*b*x2 + a*a*b*x1    #@open
        w = [c * a**k * b                  #@w
             for k in range(3)]            #@w
        w            # [4.0, 2.0, 1.0]     #@bars
        4*2 + 2*1 + 1*3   # 13, as before  #@bars
        # a = 0.5:  1, 0.5, 0.25: fades    #@fade
        # a = 1:    1, 1, 1: holds         #@move
        # a = 2:    1, 2, 4: blows up      #@move
        # a = -0.5: 1, -0.5, 0.25: flips   #@size
      `,
      beats: [
        { id: 'open', say: 'Now open the loop: put {h₂|h two} into {h₃|h three}, then {h₁|h one}, and {h₃|h three} becomes a sum of the inputs alone.', code: 'open' },
        { id: 'k', say: 'Follow one input: it enters times b, then is multiplied by a for every step it waits. The input k steps back reaches the output times {c aᵏ b|c, times a to the k, times b}.', code: 'w' },
        { id: 'bars', say: 'Here: four for the newest input, which has not waited, then two, then one. Four times two, plus two times one, plus one times three: thirteen, as before.', code: 'bars' },
        { id: 'fade', say: 'Those are powers of a. At a half, each step back halves the weight: old inputs fade, like an echo.', code: 'fade' },
        { id: 'move', say: 'Turn a up to one, and nothing fades. Turn it to two, and each step back doubles the weight: the state blows up.', code: 'move' },
        { id: 'size', say: 'So the size of a decides, written {\\|a\\||a between bars}: below one, the past fades; above one, it blows up. A negative a just flips the sign at every step.', code: ['fade', 'move', 'size'] },
      ],
    },
    {
      id: 'parallel',
      title: 'Every output at once',
      codeTitle: 'parallel.py',
      code: `
        x = np.array([3, 1, 2])          #@x
        W = np.array([[4, 0, 0],         #@W
                      [2, 4, 0],         #@W
                      [1, 2, 4]])        #@W
        y = W @ x     # [12, 10, 13]     #@y
        # tanh: h1, then h2, then h3     #@seq
      `,
      beats: [
        { id: 'known', say: 'And here is the payoff. Those weights depend only on a, b and c, never on the inputs, so they are known before any token arrives.', code: 'W' },
        { id: 'rows', say: 'So each output is the inputs times those weights, added up. {y₂|y two} is four times one, plus two times three: ten.', code: ['x', 'W'] },
        { id: 'all', say: 'Stack them as the rows of a matrix, and one matrix times the inputs gives every output at once: no row waits for another.', code: 'y' },
        { id: 'tanh', say: 'The tanh network has no such shortcut: the tanh bends each state before the next step uses it, so its states never become fixed weighted sums of the inputs.', code: 'seq' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
