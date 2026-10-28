import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-neuron',
  title: 'A neuron',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'McCulloch & Pitts', year: 1943, title: 'A logical calculus of the ideas immanent in nervous activity', url: 'https://doi.org/10.1007/BF02478259', scene: 'fire' },
  ],
  scenes: [
    {
      id: 'fire',
      title: 'Silent or firing',
      codeTitle: 'neuron.py',
      code: `
        score = w @ x + b    # linear      #@score
        # > 0 ships' side, < 0 cats' side   #@side
        # a cell: fire, or stay silent      #@cell
        out = max(0, score)  # a neuron     #@out
        # 0 on the whole cats' side         #@flat
      `,
      beats: [
        { id: 'plane', say: 'Here are the linear classifier\'s cats and ships, and the line between them. The score, w dot x plus b, is positive on the ships\' side, negative on the cats\' side, and grows with the distance from the line.', code: ['score', 'side'] },
        { id: 'cell', say: 'A brain cell, called a neuron, works differently. It adds up the signals arriving from other cells, and either fires or stays silent.', code: 'cell' },
        { id: 'mp', say: 'In 1943, Warren McCulloch and Walter Pitts turned that into a precise model: a cell fires, all or nothing, once enough of its inputs fire together. That cutoff is its threshold.', code: 'cell' },
        { id: 'flat', say: 'An artificial neuron borrows the idea, and the name. It computes the same score, but outputs zero wherever the score is zero or below: the whole cats\' side goes silent.', code: ['out', 'flat'] },
        { id: 'slice', say: 'Walk straight across the line. The score was a straight ramp, dipping below zero. Now it lies flat at zero, then climbs past the line: a ramp with a bend.', code: 'out' },
        { id: 'detector', say: 'So this neuron detects ships. It is silent for every cat, however cat-like, and fires for ships, more strongly the farther they are from the line.', code: 'flat' },
      ],
    },
    {
      id: 'bend',
      title: 'The bend: a ReLU',
      codeTitle: 'relu.py',
      code: `
        z = w @ x + b   # pre-activation    #@z
        a = max(0, z)   # activation        #@a
        max(0, -2)      # 0                 #@neg
        # rectified: negatives cut to 0     #@rect
        # linear: z > 0 passes unchanged    #@lin
        # unit: a neuron                    #@unit
      `,
      beats: [
        { id: 'z', say: 'Give the score a name, z: {z = w · x + b|z equals w dot x plus b}. It is the pre-activation: the number before the bend.', code: 'z' },
        { id: 'a', say: 'What comes out is the neuron\'s activation, written {a|A}: how strongly it fires. Below zero, {a|A} is zero. Above zero, {a|A} is z itself.', code: 'a' },
        { id: 'max', say: 'As a formula, {a = max(0, z)|A equals the max of zero and z}: the larger of zero and z. So a z of minus two gives zero.', code: ['a', 'neg'] },
        { id: 'relu', say: 'This bend is called the ReLU, short for rectified linear unit, and each word of the name means something.', code: 'a' },
        { id: 'rect', say: 'In electronics, a rectifier lets current through in one direction only. Feed it a wave, and the negative halves are cut off at zero, just as the ReLU cuts off negative z.', code: 'rect' },
        { id: 'linear', say: 'Linear, because what passes, passes unchanged: above zero, the graph is the straight line where {a|A} equals z.', code: 'lin' },
        { id: 'unit', say: 'And unit is another word for a neuron. Strictly, a rectified linear unit is a neuron with this bend, though today ReLU names the bend itself, too.', code: 'unit' },
      ],
    },
    {
      id: 'inside',
      title: 'Weigh, add, bend',
      codeTitle: 'neuron.py',
      code: `
        x = np.array([2, 1])          #@x
        w = np.array([1, -3])         #@w
        w @ x          # 2 - 3 = -1   #@wx
        b = 2                         #@b
        z = w @ x + b  # -1 + 2 = 1   #@z
        a = max(0, z)  # 1: fires     #@a
        # x = [1, 2]: z = -3, a = 0   #@neg
        # fires if w @ x > -b = -2    #@thr
      `,
      beats: [
        { id: 'x', say: 'Now in numbers, inside one neuron. It takes an input, x, with two entries: two and one.', code: 'x' },
        { id: 'w', say: 'Each entry has its own weight in w: one, and minus three. A negative weight pulls the sum down, so that input argues against firing.', code: 'w' },
        { id: 'sum', say: 'Multiply and add: two times one, plus one times minus three, is minus one.', code: 'wx' },
        { id: 'b', say: 'Then add the bias, two, and z comes out as one.', code: ['b', 'z'] },
        { id: 'a', say: 'One is above zero, so the ReLU passes it unchanged. The activation is one, and the neuron fires.', code: 'a' },
        { id: 'neg', say: 'Feed it one and two instead. One, minus six, plus two is minus three, and the ReLU turns that into zero. The neuron stays silent.', code: 'neg' },
        { id: 'thr', say: 'Here is the threshold again. z is above zero exactly when w dot x is above minus b, here minus two. Minus one clears it; minus five does not.', code: 'thr' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
