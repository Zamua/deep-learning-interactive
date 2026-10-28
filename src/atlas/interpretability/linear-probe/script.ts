import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-linear-probe',
  title: 'Linear probes',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Alain & Bengio', year: 2016, title: 'Understanding intermediate layers using linear classifier probes', url: 'https://arxiv.org/abs/1610.01644', scene: 'probe' },
    { who: 'Hewitt & Liang', year: 2019, title: 'Designing and Interpreting Probes with Control Tasks', url: 'https://arxiv.org/abs/1909.03368', scene: 'meaning' },
  ],
  scenes: [
    {
      id: 'probe',
      title: 'Ask the stream a question',
      codeTitle: 'probe.py',
      code: `
        h = stream[layer]   # model frozen  #@h
        y = labels          # noun or not   #@y
        s = w @ h + b       # one score     #@score
        noun = s > 0        # the answer    #@pred
      `,
      beats: [
        { id: 'ask', say: 'Halfway up a model, a word\'s residual stream is hundreds of numbers. Does it know whether the word is a noun? Reading the numbers by eye will not tell you.', code: 'h' },
        { id: 'points', say: 'Collect the stream at that layer, h, for many words, and pretend it holds just two numbers: each word is a point.', code: 'h' },
        { id: 'labels', say: 'Each word comes with its right answer, noun or not, called its label, y. Color the points by label.', code: 'y' },
        { id: 'line', say: 'Train a linear classifier on these points, as before: weights, w, turn its line, and a bias, b, slides it, until it splits the colors as well as it can.', code: 'score' },
        { id: 'score', say: 'Its score, {w · h + b|w dot h plus b}, is positive on the noun side. If the line splits the colors well, the stream holds the answer where a linear classifier can read it.', code: ['score', 'pred'] },
        { id: 'frozen', say: 'Only w and b are trained; the model stays frozen. That is why this is called a probe: an instrument that measures a system without changing it, like a thermometer.', code: 'h' },
        { id: 'history', say: 'Guillaume Alain and Yoshua Bengio named these linear classifiers probes in 2016, and fit one on every layer of trained image networks.', code: 'score' },
      ],
    },
    {
      id: 'score',
      title: 'Read one score',
      codeTitle: 'score.py',
      code: `
        w = np.array([1, 2])    # trained  #@w
        b = -1                  # trained  #@b
        w @ [1, 1] + b   # 1 + 2 - 1 = 2   #@yes
        w @ [0, -1] + b  # 0 - 2 - 1 = -3  #@no
      `,
      beats: [
        { id: 'wb', say: 'Say training gave w as one and two, and b as minus one.', code: ['w', 'b'] },
        { id: 'yes', say: 'Take a word at the point one, one. Its score is one, plus two, minus one: two. Positive, so the probe says noun.', code: 'yes' },
        { id: 'no', say: 'Another word sits at zero and minus one. Its score is zero, minus two, minus one: minus three. Negative: not a noun.', code: 'no' },
        { id: 'dir', say: 'Exactly zero sits on the line. And w is a direction: the probe weighs every number in the stream, not just one.', code: 'w' },
      ],
    },
    {
      id: 'classes',
      title: 'More than two answers',
      codeTitle: 'tense.py',
      code: `
        h = np.array([1, 2])                 #@h
        W = np.array([[2, 0],     # past     #@W
                      [-2, 2],    # present  #@W
                      [-1, -1]])  # future   #@W
        b = np.array([-1, 0, 1])             #@W
        W[0] @ h + b[0]   # 1: past          #@row
        s = W @ h + b     # [1, 2, -2]       #@s
      `,
      beats: [
        { id: 'three', say: 'A probe can read out more than yes or no: say, a sentence\'s tense, past, present or future. Each point now has one of three labels.', code: 'W' },
        { id: 'regions', say: 'Each class gets its own weights and bias, as in any linear classifier, and the highest score wins: three regions with straight borders.', code: 'W' },
        { id: 'h', say: 'A new word\'s stream, h, is one and two. It lands in the present region.', code: 'h' },
        { id: 'W', say: 'Stack the weight rows into a matrix, W, and the biases into b: one row and one bias per class.', code: 'W' },
        { id: 'row', say: 'Row zero, {w₀|w zero}, is past\'s. Dot it with h and add its bias: two times one, plus zero times two, minus one, is one.', code: 'row' },
        { id: 'all', say: 'Present\'s row gives two, and future\'s minus two. Two is the highest, so the probe says present: the region h landed in.', code: 's' },
      ],
    },
    {
      id: 'test',
      title: 'Test on held-out words',
      codeTitle: 'test.py',
      code: `
        pred = s > 0               # noun?  #@pred
        acc = (pred == y).mean()   # 0.75   #@acc
      `,
      beats: [
        { id: 'held', say: 'Then test the probe on held-out words: words kept aside, never trained on. A score above zero predicts noun.', code: 'pred' },
        { id: 'count', say: 'It matches their labels on six of eight: an accuracy of {0.75|zero point seven five}, where a coin flip gets a half.', code: 'acc' },
      ],
    },
    {
      id: 'meaning',
      title: 'What a probe can and cannot show',
      codeTitle: 'meaning.py',
      code: `
        # accurate: it is there, linearly   #@there
        # not shown: that the model uses it #@use
        # random labels: a big probe learns #@random
        # keep the probe linear             #@linear
      `,
      beats: [
        { id: 'there', say: 'High accuracy shows the answer is in the stream, readable by one linear map: a weighted sum, like the probe\'s score.', code: 'there' },
        { id: 'use', say: 'It does not show that the model uses it. Being there is not being used: testing use takes changing the stream and watching the model.', code: 'use' },
        { id: 'random', say: 'The probe must also stay simple. In 2019, John Hewitt and Percy Liang gave each word a random label, one no stream could know. An MLP probe still got about {93|ninety three} percent right, by memorizing.', code: 'random' },
        { id: 'linear', say: 'A linear probe got only about {71|seventy one}, though both got about {97|ninety seven} on the real labels. A line can barely memorize, so its success describes the stream. If only a big probe succeeds, the big probe may be doing the work.', code: 'linear' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
