import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-rmsnorm',
  title: 'RMSNorm',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Zhang & Sennrich', year: 2019, title: 'Root Mean Square Layer Normalization', url: 'https://arxiv.org/abs/1910.07467', scene: 'jobs' },
  ],
  scenes: [
    {
      id: 'jobs',
      title: 'Two jobs, or one?',
      codeTitle: 'norms.py',
      code: `
        x = np.array([1, -5, 5, 7])     #@x
        x - x.mean()   # re-center     #@center
        (x - x.mean()) / x.std()       #@scale
        # RMSNorm: re-scale only       #@rms
      `,
      beats: [
        { id: 'x', say: 'Layer norm runs on every token\'s vector, in every layer. Here is one token\'s four features as bars: one, minus five, five and seven.', code: 'x' },
        { id: 'center', say: 'Its first job is to re-center. Subtract the mean, two, and every bar slides down, until they balance on zero.', code: 'center' },
        { id: 'scale', say: 'Its second job is to re-scale. Divide by the standard deviation, and the bars shrink, or stretch, to a standard spread of one.', code: 'scale' },
        { id: 'cost', say: 'Both jobs cost arithmetic on every token, and that slows the whole network down.', code: ['center', 'scale'] },
        { id: 'bet', say: 'In 2019, Biao Zhang and Rico Sennrich bet that only the re-scaling matters. They dropped the re-centering, and divided by a root mean square instead. They called it {RMSNorm|R M S Norm}: {RMS|R M S}, for root mean square.', code: 'rms' },
        { id: 'result', say: 'In their tests, it did about as well as layer norm, and cut running time by between seven and sixty four percent, depending on the model.', code: 'rms' },
      ],
    },
    {
      id: 'rms',
      title: 'The root mean square',
      codeTitle: 'rms.py',
      code: `
        x = np.array([1, -5, 5, 7])    #@x
        x.mean()       # 2: signs cancel #@cancel
        x**2           # [1, 25, 25, 49] #@sq
        (x**2).mean()  # 100 / 4 = 25  #@mean
        rms = np.sqrt(25)   # 5.0      #@root
        x / rms   # [0.2, -1, 1, 1.4]  #@out
      `,
      beats: [
        { id: 'size', say: 'To re-scale, you need one number for how big the entries are. Their mean will not do: the signs cancel, and one, minus five, five and seven average just two.', code: 'cancel' },
        { id: 'socket', say: 'Electricians met this long ago. An American wall socket swings between about plus and minus {170|a hundred and seventy} volts, so its average is zero. The {120|hundred and twenty} volts it is rated at is a root mean square.', code: 'cancel' },
        { id: 'sq', say: 'The name is the recipe, read backwards. Square every entry: one, twenty five, twenty five, forty nine. A square is never negative, so nothing cancels.', code: 'sq' },
        { id: 'mean', say: 'Take the mean of the squares: a hundred over four, twenty five.', code: 'mean' },
        { id: 'root', say: 'Then the root: five. It undoes the squaring, so the answer is back in the entries\' own units. That is the root mean square of x, written {rms(x)|R M S of x}: the size of a typical entry.', code: 'root' },
        { id: 'out', say: 'Divide by it: {0.2|zero point two}, minus one, one, and {1.4|one point four}. Now the root mean square is exactly one.', code: 'out' },
        { id: 'gain', say: 'Last, each feature is multiplied by its own learned gain, {γ|gamma}, which starts at one.', code: 'out' },
        { id: 'params', say: 'There is no shift, {β|beta}, so with d features, {RMSNorm|R M S Norm} learns d numbers, where layer norm learns two d.', code: 'out' },
      ],
    },
    {
      id: 'shift',
      title: 'Scale cancels, a shift does not',
      codeTitle: 'invariance.py',
      code: `
        rms_norm(3 * x)    # = rms_norm(x)  #@scale
        rms_norm(x + 3)    # changes        #@shift
        layer_norm(x + 3)  # = layer_norm(x)  #@ln
      `,
      beats: [
        { id: 'scale', say: 'Triple the vector, and its root mean square triples as well: fifteen. Divide, and the output is exactly the same as before.', code: 'scale' },
        { id: 'shift', say: 'But shift every entry up by three. {RMSNorm|R M S Norm} never subtracts the mean, so its output moves.', code: 'shift' },
        { id: 'ln', say: 'Layer norm would subtract the new mean, and the shift would vanish. That is the whole price of dropping the mean: blind to scale, but not to a shift.', code: 'ln' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
