import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-score-grad',
  title: 'Softmax gradient',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'ask',
      title: 'Which way should each score move?',
      codeTitle: 'loss.py',
      code: `
        s = np.array([1.8, 1.1, 0.0])     #@s
        p = softmax(s)  # [0.6, 0.3, 0.1] #@p
        y = 1           # right answer    #@y
        L = -np.log(p[y])   # 1.208       #@L
      `,
      beats: [
        { id: 'ask', say: 'To learn, a classifier needs its scores to change so that its loss comes down. So for each score, two questions: which way should it move, and how much does the loss care?', code: 's' },
        { id: 'scores', say: 'Here are three options\' scores, drawn as bars. Softmax turns them into probabilities, p: about {0.6|zero point six}, {0.3|zero point three} and {0.1|zero point one}.', code: ['s', 'p'] },
        { id: 'right', say: 'The right answer, y, is the middle option, option one. It got only {0.3|zero point three}.', code: 'y' },
        { id: 'loss', say: 'The loss is minus the log of that: about {1.2|one point two}, this dot on the minus log curve. The less the right answer gets, the higher the dot climbs.', code: 'L' },
      ],
    },
    {
      id: 'nudge',
      title: 'Nudge one score at a time',
      codeTitle: 'nudge.py',
      code: `
        def loss(s):                       #@def
            return -np.log(softmax(s)[y])  #@def
        t = s.copy(); t[0] += 0.01         #@n0
        loss(t)    # 1.214, was 1.208      #@n0
        (1.214 - 1.208) / 0.01   # 0.6     #@slope
        # t[1] += 0.01: -0.007, so -0.7    #@n1
        # t[2] += 0.01: +0.001, so 0.1     #@n2
        ds = np.array([0.6, -0.7, 0.1])    #@ds
      `,
      beats: [
        { id: 'plain', say: 'Answer them the plain way: nudge one score a little, hold the others still, and watch the loss.', code: 'def' },
        { id: 'up0', say: 'Raise the first score, a wrong option\'s. Its share grows and the right answer\'s shrinks, so the dot climbs: the loss goes up.', code: 'n0' },
        { id: 'slope0', say: 'A nudge of {0.01|one hundredth} raises the loss by {0.006|six thousandths}, which is {0.6|zero point six} times the nudge. That rate is the slope for the first score.', code: 'slope' },
        { id: 'right1', say: 'Now raise the right answer\'s score. Its share grows, the dot slides down, and the loss falls by {0.007|seven thousandths}: a slope of {−0.7|minus zero point seven}.', code: 'n1' },
        { id: 'last2', say: 'Raise the last score, and the loss rises by only {0.001|one thousandth}: a slope of {0.1|zero point one}.', code: 'n2' },
        { id: 'grad', say: 'One slope per score, each found with the others held still: these are the partial derivatives of the loss. Stacked into a vector, they make its gradient, {∂L/∂s|partial L, partial s}, called {ds|d s} in code.', code: 'ds' },
        { id: 'read', say: 'The sign says which way. Positive means raising that score raises the loss, so lower it; negative means raise it. The size says how much the loss cares.', code: 'ds' },
      ],
    },
    {
      id: 'why',
      title: 'Why p, minus one',
      codeTitle: 'why.py',
      code: `
        p = np.array([0.6, 0.3, 0.1])      #@p
        ds = np.array([0.6, -0.7, 0.1])    #@ds
        # wrong options: ds[j] = p[j]      #@same
        # right answer: ds[y] = p[y] - 1   #@minus
        L = np.log(np.exp(s).sum()) - s[y] #@L
        # log of the total: + p[j] each    #@share
        # minus s[y]: - 1, only at y       #@one
      `,
      beats: [
        { id: 'compare', say: 'Set the slopes beside the probabilities. For the two wrong options they match exactly: {0.6|zero point six} and {0.6|zero point six}, {0.1|zero point one} and {0.1|zero point one}.', code: ['p', 'ds', 'same'] },
        { id: 'minus', say: 'The right answer\'s slope is its probability minus one: {0.3|zero point three} minus one is {−0.7|minus zero point seven}.', code: 'minus' },
        { id: 'why', say: 'Why? The same loss can be written as the log of the total, T, minus the right answer\'s score.', code: 'L' },
        { id: 'share', say: 'Raise any score a little, and T grows by e to that score, times the nudge, because e to the x is its own slope.', code: 'share' },
        { id: 'over', say: 'And the log\'s slope is one over T, so the log of T grows by that growth, divided by T: the option\'s probability, times the nudge.', code: 'share' },
        { id: 'one', say: 'The other part, minus the right score, moves only when the right score does, and by the whole nudge, the other way. That is the minus one.', code: 'one' },
      ],
    },
    {
      id: 'onehot',
      title: 'p minus one-hot',
      codeTitle: 'grad.py',
      code: `
        onehot = np.eye(3)[y]  # [0, 1, 0]  #@oh
        ds = p - onehot  # [0.6, -0.7, 0.1] #@sub
        ds.sum()         # 0.0              #@sum
        # to lower L, move s against ds     #@step
      `,
      beats: [
        { id: 'collect', say: 'So every slope is that option\'s probability, and the right answer\'s loses one more. Collect what is taken away in a vector: a one at the right answer, zeros elsewhere.', code: 'oh' },
        { id: 'name', say: 'It is called one-hot: exactly one entry is on, or hot, and the rest are off. Here it is zero, one, zero, written {onehot(y)|one-hot of y}.', code: 'oh' },
        { id: 'formula', say: 'So the gradient is p minus the one-hot vector: {∂L/∂s = p − onehot(y)|partial L, partial s, equals p minus one-hot of y}.', code: 'sub' },
        { id: 'sum', say: 'Its entries always add up to zero: p adds up to one, and the one-hot takes exactly one away. So the only negative entry is the right answer\'s.', code: 'sum' },
        { id: 'step', say: 'To lower the loss, move the scores against the gradient: the right score goes up, and the wrong ones go down, the most probable wrong option the most.', code: 'step' },
        { id: 'done', say: 'As the right answer\'s probability nears one, every entry nears zero: there is little loss left to remove.' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
