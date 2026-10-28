import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-sgd-linear',
  title: 'SGD step',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Widrow & Hoff', year: 1960, title: 'Adaptive switching circuits', url: 'https://isl.stanford.edu/~widrow/papers/c1960adaptiveswitching.pdf', scene: 'swing' },
  ],
  scenes: [
    {
      id: 'swing',
      title: 'One step',
      codeTitle: 'sgd.py',
      code: `
        x, y = np.array([2, 1]), 0  # cat   #@x
        ds = p - np.eye(2)[y]  # [-0.7, 0.7] #@grad
        dW, db = np.outer(ds, x), ds         #@grad
        eta = 0.2                            #@eta
        W = W - eta * dW                     #@step
        b = b - eta * db                     #@step
        W @ x + b   # [1.84, 1.01]           #@s
      `,
      beats: [
        { id: 'wrong', say: 'Here is the cat from before, x, at two, one. The border between cat and ship is in the wrong place: the cat lands on the ship side, and softmax gives cat only {0.3|zero point three}.', code: 'x' },
        { id: 'label', say: 'Its label, the class it really belongs to, is cat: y is zero.', code: 'x' },
        { id: 'grad', say: 'The gradient already says which way everything should move. Each weight\'s gradient is its class\'s error times its input, and each bias\'s gradient is just its class\'s error.', code: 'grad' },
        { id: 'step', say: 'So take the step: every weight and every bias moves against its own gradient, all at once, by {η|eta} times it. Here {η|eta}, the step size, is {0.2|zero point two}.', code: ['eta', 'step'] },
        { id: 'move', say: 'Watch the border. It turns and slides, sweeps past the cat, and leaves it on the cat side.', code: 'step' },
        { id: 'scores', say: 'Cat\'s score climbs by {0.84|zero point eight four}, and ship\'s falls by the same amount. Now cat wins, and softmax gives it about {0.7|zero point seven}.', code: 's' },
        { id: 'descent', say: 'Taking steps like this, each one downhill on the loss, is called gradient descent.', code: 'step' },
        { id: 'sgd', say: 'This step used one example, this cat. Take the examples one at a time, in a random order, and it is stochastic gradient descent, {SGD|S G D} for short: stochastic means random.', code: 'x' },
        { id: 'widrow', say: 'Bernard Widrow and Marcian Hoff\'s Adaline learned one pattern at a time like this, in 1960, with the patterns picked in a random sequence. Each gradient was easy to measure, and the machine had to store nothing but its weights.', code: 'step' },
      ],
    },
    {
      id: 'rows',
      title: 'The right row moves toward x',
      codeTitle: 'rows.py',
      code: `
        W[0] -= 0.2 * -0.7 * x  # +0.14 x   #@row0
        W[0] @ x   # up 0.14 * 5 = 0.7      #@up
        b[0] -= 0.2 * -0.7      # +0.14     #@bias
        W[1] -= 0.2 * 0.7 * x   # -0.14 x   #@row1
        # correct: p - 1 < 0, toward x      #@rule
        # others: p > 0, away from x        #@rule
      `,
      beats: [
        { id: 'row0', say: 'Look at the step one row at a time. Cat\'s row of weights moves against its gradient, which is minus {0.7|zero point seven} times x.', code: 'row0' },
        { id: 'gain', say: 'Moving against a minus means adding: the row gains {0.2|zero point two} times {0.7|zero point seven}, which is {0.14|zero point one four}, times x.', code: 'row0' },
        { id: 'toward', say: 'Adding a bit of x moves the row toward x, and raises its dot product with x: by {0.14|zero point one four} times x dot x, which is five. That makes {0.7|zero point seven}.', code: 'up' },
        { id: 'bias', say: 'Cat\'s bias also rises, by {0.14|zero point one four}. Together, that is the {0.84|zero point eight four} that cat\'s score climbed.', code: 'bias' },
        { id: 'away', say: 'Ship\'s error is plus {0.7|zero point seven}, so its row loses {0.14|zero point one four} times x. It moves away from x, and ship\'s score falls.', code: 'row1' },
        { id: 'rule', say: 'That holds for any input. The correct class\'s error is its p minus one, which is negative, so its row moves toward x. Every other class\'s error is its p, which is positive, so those rows move away.', code: 'rule' },
      ],
    },
    {
      id: 'try',
      title: 'Try one',
      codeTitle: 'try.py',
      code: `
        W = np.array([[1, 2], [2, -1]])   #@p1
        x, y = np.array([3, 1]), 1        #@p1
        p = np.array([0.4, 0.6])          #@q1
        ds = p - np.eye(2)[y]  # [0.4, -0.4]  #@ds
        dW10 = ds[1] * x[0]    # -1.2     #@dw
        W[1,0] - 0.5 * dW10    # 2.6      #@step
        b = np.array([-0.2, 0.2])         #@p2
        b - 0.5 * ds    # [-0.4, 0.4]     #@a2
      `,
      beats: [
        { id: 'p1', say: 'Try one. W has rows one, two, and two, minus one. The input x is three, one, and its label is class one.', code: 'p1' },
        { id: 'q1', say: 'Softmax gives {0.4|zero point four} and {0.6|zero point six}. After one {SGD|S G D} step with {η|eta} one half, what is {W₁₀|W one zero}?', code: 'q1' },
        { id: 'ds', say: 'First the score gradient: take one away at the label, class one. {0.4|zero point four}, and {0.6|zero point six} minus one, which is minus {0.4|zero point four}.', code: 'ds' },
        { id: 'dw', say: '{W₁₀|W one zero} sits in row one, so it takes {ds₁|d s one}, minus {0.4|zero point four}. Column zero takes {x₀|x zero}, three. Its gradient is minus {0.4|zero point four} times three: minus {1.2|one point two}.', code: 'dw' },
        { id: 'step', say: 'Step against it: two, minus one half times minus {1.2|one point two}. Subtracting a negative adds, so two plus {0.6|zero point six}: {2.6|two point six}.', code: 'step' },
        { id: 'p2', say: 'Now the biases, minus {0.2|zero point two} and {0.2|zero point two}. After the same step, what is b?', code: 'p2' },
        { id: 'a2', say: 'A bias\'s gradient is just {ds|d s}: {0.4|zero point four} and minus {0.4|zero point four}. Half of each comes off.', code: 'a2' },
        { id: 'b0', say: 'Minus {0.2|zero point two}, minus {0.2|zero point two}, is minus {0.4|zero point four}.', code: 'a2' },
        { id: 'b1', say: 'The second takes away minus {0.2|zero point two}, which adds it: {0.2|zero point two} plus {0.2|zero point two} is {0.4|zero point four}.', code: 'a2' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
