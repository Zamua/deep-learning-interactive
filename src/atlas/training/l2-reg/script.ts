import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-l2-reg',
  title: 'L2 regularization',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Hoerl & Kennard', year: 1970, title: 'Ridge regression: biased estimation for nonorthogonal problems', url: 'https://doi.org/10.1080/00401706.1970.10488634', scene: 'price' },
    { who: 'Krogh & Hertz', year: 1991, title: 'A simple weight decay can improve generalization', url: 'https://proceedings.neurips.cc/paper/1991/hash/8eefcfdf5990e441f0fb6f3fad709e21-Abstract.html', scene: 'decay' },
  ],
  scenes: [
    {
      id: 'touchy',
      title: 'Same score, touchier',
      codeTitle: 'touchy.py',
      code: `
        x = np.array([1.0, 1.0])  # train  #@x
        wa = np.array([1.0, 1.0])          #@wa
        wb = np.array([5.0, -3.0])         #@wb
        wa @ x, wb @ x     # 2.0, 2.0      #@tie
        new = np.array([1.0, 1.5])         #@new
        wa @ new, wb @ new  # 2.5, 0.5     #@new
      `,
      beats: [
        { id: 'quirk', say: 'Overfitting means fitting quirks of the training examples. Here is one that big weights can exploit: two features that happen to be equal in every training example, like one and one.', code: 'x' },
        { id: 'tie', say: 'The weights one and one, and five and minus three, both score it two. They agree on every training example, so the loss cannot tell them apart.', code: ['wa', 'wb', 'tie'] },
        { id: 'new', say: 'But take a new input, one and {1.5|one point five}: the small weights give {2.5|two point five}, and the big ones only {0.5|zero point five}.', code: 'new' },
        { id: 'slope', say: 'Each weight is how much the score moves when its feature grows by one. Big weights make the model touchy: it swings on differences the training data never showed.', code: 'wb' },
      ],
    },
    {
      id: 'price',
      title: 'A price on size',
      codeTitle: 'l2.py',
      code: `
        # w[0] + w[1] == 2: all tie        #@line
        np.sum(wa**2)     # 1 + 1 = 2      #@sa
        np.sum(wb**2)     # 25 + 9 = 34    #@sb
        lam = 0.1                          #@lam
        L = L_data + lam * np.sum(w**2)    #@L
        lam * np.sum(wb**2)    # 3.4       #@pay
      `,
      beats: [
        { id: 'plane', say: 'Picture each pair of weights as a point, and as an arrow from zero. Every point on this line adds up to two, so all of them tie on the training examples.', code: 'line' },
        { id: 'sum', say: 'L2 regularization breaks the tie with a price on size: the sum of the squared weights, {Σᵢ wᵢ²|the sum over i of w i squared}. Square each weight, then add. For one and one, that is two.', code: 'sa' },
        { id: 'sumb', say: 'For five and minus three, twenty-five plus nine: thirty-four.', code: 'sb' },
        { id: 'rings', say: 'By Pythagoras, that sum is how long the arrow is, squared, so equal prices lie on rings around zero. This measure of length is called the L2 norm, the 2 for the squares.', code: ['sa', 'sb'] },
        { id: 'lam', say: 'Scale the price by a strength, {λ|lambda}, the Greek letter lambda, chosen by trying a few on the validation split.', code: 'lam' },
        { id: 'loss', say: 'Then add it to the old loss on the examples, now called the data loss: {L = L_data + λ Σᵢ wᵢ²|L equals L data, plus lambda times the sum of the squared weights}.', code: 'L' },
        { id: 'pay', say: 'With {λ|lambda} at {0.1|zero point one}, the long arrow adds a tenth of thirty-four to the loss: {3.4|three point four}.', code: 'pay' },
        { id: 'touch', say: 'Slide along the ties. The data loss stays put, but the price falls until the line just touches a ring, at one and one, the weight spread evenly. That tie costs least, so L2 picks it.', code: 'L' },
        { id: 'regular', say: 'A calmer fit, steadier on new inputs: making a fit more regular is what regularization means.', code: 'L' },
        { id: 'history', say: 'Arthur Hoerl and Robert Kennard proposed it in 1970, for inputs that move together like these: many fits are then nearly as good as the best, and the best tends to come out too long. Their cure: among those, take the shortest.', code: 'L' },
      ],
    },
    {
      id: 'decay',
      title: 'Weight decay',
      codeTitle: 'decay.py',
      code: `
        w = np.array([2.0, -1.0])          #@w
        2 * lam * w      # [0.4, -0.2]     #@grad
        w = w - lr * (g + 2 * lam * w)     #@step
        # g = 0: w *= 1 - 2 * lr * lam     #@decay
        # lr = 0.5: 2 -> 1.8 -> 1.62       #@shrink
        # g = [1, 0]: w -> [1.3, -0.9]     #@both
      `,
      beats: [
        { id: 'grad', say: 'What does the price do to training? Each weight adds {λw²|lambda w squared}, whose slope is {2λw|two lambda w}: a gradient pointing straight away from zero, up the bowl.', code: 'grad' },
        { id: 'out', say: 'For weights two and minus one, with {λ|lambda} at {0.1|zero point one}, it is {0.4|zero point four} and minus {0.2|zero point two}.', code: ['w', 'grad'] },
        { id: 'step', say: 'A gradient step goes against it plus the data gradient, g: {w ← w − η(g + 2λw)|w gets w, minus eta, times g plus two lambda w}. So the penalty pulls w toward zero.', code: 'step' },
        { id: 'factor', say: 'Where g is zero, each step just multiplies w by {1 − 2ηλ|one minus two eta lambda}: the step factor of a bowl, with {λ|lambda} as its steepness. With {η|eta} at a half, it is {0.9|zero point nine}.', code: 'decay' },
        { id: 'shrink', say: 'So two becomes {1.8|one point eight}, then {1.62|one point six two}: a little closer to zero every step.', code: 'shrink' },
        { id: 'both', say: 'Add a data gradient of one on that first weight, and its full gradient is one plus {0.4|zero point four}: {1.4|one point four}.', code: ['step', 'both'] },
        { id: 'land', say: 'With {η|eta} at a half, the step is {0.7|zero point seven}, and the weight lands at {1.3|one point three}.', code: 'both' },
        { id: 'lamup', say: 'Turn {λ|lambda} up, and the pull grows. Only the data gradient pulls back, so the weights settle where the two pulls balance.', code: ['step', 'decay'] },
        { id: 'name', say: 'That steady shrinking is why L2 is also called weight decay. In 1991, Anders Krogh and John Hertz proved it picks the smallest weights that still fit, quieting the inputs that do not matter.', code: 'decay' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
