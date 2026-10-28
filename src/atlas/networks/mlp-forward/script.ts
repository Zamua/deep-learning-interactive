import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-mlp-forward',
  title: 'Two-layer forward pass',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Minsky & Papert', year: 1969, title: 'Perceptrons: An Introduction to Computational Geometry', url: 'https://doi.org/10.7551/mitpress/11301.001.0001', scene: 'straight' },
    { who: 'Rumelhart, Hinton & Williams', year: 1986, title: 'Learning representations by back-propagating errors', url: 'https://doi.org/10.1038/323533a0', scene: 'lines' },
  ],
  scenes: [
    {
      id: 'straight',
      title: 'A line is not enough',
      codeTitle: 'line.py',
      code: `
        # each point: two features      #@data
        # class 1: inside the V         #@data
        # class 0: around it            #@data
        s = W @ x + b  # linear scores  #@line
        # its border: one straight line #@line
        # any line: some points wrong   #@fail
      `,
      beats: [
        { id: 'data', say: 'Here are two classes, each point placed by two features, x zero and x one. Class one fills a {V|vee}, and class zero wraps around it.', code: 'data' },
        { id: 'line', say: 'A linear classifier draws one straight border. Turn it and slide it however you like: some points always land on the wrong side.', code: ['line', 'fail'] },
        { id: 'book', say: 'In 1969, Marvin Minsky and Seymour Papert\'s book, Perceptrons, mapped out limits like this one: many patterns are out of reach when the inputs feed straight into the outputs.', code: 'fail' },
        { id: 'fix', say: 'They also pointed out the way around it: a layer of units in between, which recodes the input before anything is scored.' },
      ],
    },
    {
      id: 'lines',
      title: 'Each neuron draws a line',
      codeTitle: 'layers.py',
      code: `
        # unit 0: on below one line     #@n0
        # unit 1: on below another      #@n1
        h = relu(z)  # both outputs     #@h
        s = W2 @ h + b2  # scores h     #@s
        # class 0: h[0] + h[1]          #@s0
        # class 1: 1 - h[0] - h[1]      #@s1
        # border: where the two tie     #@bent
      `,
      beats: [
        { id: 'n0', say: 'So put a layer in between. Its first unit is a neuron, which draws a line: silent on one side, and rising with the distance on the other.', code: 'n0' },
        { id: 'n1', say: 'A second neuron draws its own line, tilted the other way.', code: 'n1' },
        { id: 'layer', say: 'Neurons side by side, reading the same input, form a layer. Their outputs make a vector, h, one number per neuron.', code: 'h' },
        { id: 'hidden', say: 'In their 1986 backprop paper, Rumelhart, Hinton and Williams call such units hidden: they are part of neither the input nor the output. The data never shows their values.', code: 'h' },
        { id: 'score', say: 'On top sits a linear classifier that scores h instead of x. Class zero\'s score adds the two outputs: zero inside the {V|vee}, where both neurons are silent, and growing outside it.', code: ['s', 's0'] },
        { id: 'one', say: 'Class one\'s score is one, minus that same sum, so it is highest inside the {V|vee}.', code: 's1' },
        { id: 'bent', say: 'The border sits where the two scores tie. It is made of straight pieces, yet it bends around the {V|vee}, and splits what no single line could.', code: 'bent' },
      ],
    },
    {
      id: 'numbers',
      title: 'Layer by layer, in numbers',
      codeTitle: 'forward.py',
      code: `
        x = np.array([2, 1])                #@x
        W1 = np.array([[1, -1], [-1, -1]])  #@W1
        b1 = np.array([1, 1])               #@b1
        z = W1 @ x + b1       # [2, -2]     #@z
        h = np.maximum(0, z)  # [2, 0]      #@h
        W2 = np.array([[1, 1], [-1, -1]])   #@W2
        b2 = np.array([0, 1])               #@b2
        s = W2 @ h + b2       # [2, -1]     #@s
        W2 @ z + b2           # [0, 1]      #@noRelu
      `,
      beats: [
        { id: 'x', say: 'Now in numbers. Take the point x with entries two and one, out on the right arm, where class zero lives.', code: 'x' },
        { id: 'W1', say: 'The hidden neurons\' weights are the rows of a matrix, {W₁|W one}: one row per hidden unit.', code: 'W1' },
        { id: 'z0', say: 'Unit zero dots its row with x, and adds its bias from {b₁|b one}: two, minus one, plus one, is two.', code: ['b1', 'z'] },
        { id: 'z1', say: 'Unit one: minus two, minus one, plus one, is minus two.', code: 'z' },
        { id: 'h', say: 'The ReLU keeps the two, and turns the minus two into zero. So h is two and zero: {h = ReLU(W₁x + b₁)|h is the ReLU of W one x, plus b one}.', code: 'h' },
        { id: 'W2', say: 'The second layer scores h with its own weights, {W₂|W two}: one row per class.', code: 'W2' },
        { id: 's0', say: 'Class zero: one times two, plus one times zero, plus a bias of zero from {b₂|b two}: two.', code: ['b2', 's'] },
        { id: 's1', say: 'Class one: minus two, plus zero, plus one, is minus one. Class zero wins, as the picture said.', code: 's' },
        { id: 'forget', say: 'Skip the ReLU, and the second layer reads minus two where it read zero. Class zero now scores zero, class one scores one, and the answer flips.', code: 'noRelu' },
      ],
    },
    {
      id: 'collapse',
      title: 'Why the bend matters',
      codeTitle: 'collapse.py',
      code: `
        # x: (D,)   h: (H,)   s: (C,)     #@D
        # W1: (H, D)   b1: (H,)           #@W1
        # W2: (C, H)   b2: (C,)           #@W2
        s = W2 @ (W1 @ x + b1) + b2       #@sub
        s = (W2 @ W1) @ x + W2 @ b1 + b2  #@mult
        W = W2 @ W1      # (C, D)         #@one
      `,
      beats: [
        { id: 'D', say: 'Real inputs are bigger: an image of {3,072|three thousand and seventy two} numbers, say. Write D for that count, the number of input features.', code: 'D' },
        { id: 'H', say: 'With H hidden units, {W₁|W one} has a row for each unit and a column for each input: H by D. Its bias, {b₁|b one}, has H entries.', code: 'W1' },
        { id: 'C', say: 'With C classes, {W₂|W two} has a row per class and a column per hidden unit: C by H. Its bias, {b₂|b two}, has C entries.', code: 'W2' },
        { id: 'sub', say: 'Now take the ReLU out, and put the first layer inside the second: {W₂(W₁x + b₁) + b₂|W two, times the bracket W one x plus b one, then plus b two}.', code: 'sub' },
        { id: 'mult', say: 'Multiply it out: {W₂W₁|W two W one} times x, plus a constant. C by H, times H by D, is a single C by D matrix.', code: ['mult', 'one'] },
        { id: 'one', say: 'So without the bend, the two layers collapse into one linear classifier, however many hidden units there are. On the {V|vee}, the same weights give one flat border, straight through the classes.', code: 'one' },
        { id: 'bend', say: 'The ReLU between the layers stops the collapse. It is what lets the border bend.' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
