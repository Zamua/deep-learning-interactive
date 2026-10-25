import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-rmsnorm',
  title: 'RMSNorm',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'jobs',
      title: 'Layer norm does two jobs',
      codeTitle: 'norms.py',
      code: `
        def layer_norm(x, gamma, beta):
            mu, sd = x.mean(), x.std()     #@ln
            return (x - mu) / sd * gamma + beta   #@ln

        def rms_norm(x, gamma):
            rms = np.sqrt((x**2).mean())   #@rms
            return x / rms * gamma         #@rms
      `,
      beats: [
        { id: 'ln', say: 'Layer norm does two jobs on a token\'s vector. It re-centers: subtract the mean. And it re-scales: divide by the standard deviation. Then come a learned gain, {γ|gamma}, and shift, {β|beta}.', code: 'ln' },
        { id: 'rms', say: 'RMSNorm keeps only the re-scaling. No mean and no shift: it divides by the root mean square, then multiplies by {γ|gamma}.', code: 'rms' },
        { id: 'why', say: 'The re-scaling turned out to be the part that matters, and skipping the mean saves work on every token.' },
      ],
    },
    {
      id: 'rms',
      title: 'The root mean square',
      codeTitle: 'rms.py',
      code: `
        x = np.array([1, -5, 5, 7])          #@x
        x**2           # [1, 25, 25, 49]     #@sq
        (x**2).mean()  # 100 / 4 = 25        #@mean
        rms = 5.0      # sqrt(25)            #@root
        x / rms        # [0.2, -1, 1, 1.4]   #@out
      `,
      beats: [
        { id: 'x', say: 'Take a token\'s vector: one, minus five, five and seven.', code: 'x' },
        { id: 'sq', say: 'Square every entry: one, twenty five, twenty five, forty nine.', code: 'sq' },
        { id: 'mean', say: 'Their mean is a hundred over four: twenty five.', code: 'mean' },
        { id: 'root', say: 'Its square root is five. That is the root mean square, the size of a typical entry.', code: 'root' },
        { id: 'out', say: 'Divide by it: {0.2|zero point two}, minus one, one, and {1.4|one point four}. Now the root mean square is exactly one.', code: 'out' },
        { id: 'gain', say: 'Last, each feature is multiplied by its own learned gain {γ|gamma}, which starts at one. That is d parameters, where layer norm has two d.', code: 'out' },
      ],
    },
    {
      id: 'shift',
      title: 'Scale cancels, a shift does not',
      codeTitle: 'invariance.py',
      code: `
        rms_norm(3 * x)    # same as rms_norm(x)   #@scale
        rms_norm(x + 3)    # changes               #@shift
        layer_norm(x + 3)  # same as layer_norm(x) #@ln
      `,
      beats: [
        { id: 'scale', say: 'Multiply x by three, and its root mean square triples too. The output does not change.', code: 'scale' },
        { id: 'shift', say: 'But add three to every entry, and RMSNorm\'s output moves, because it never subtracts the mean. Layer norm would not notice. That is the whole price of dropping the mean.', code: ['shift', 'ln'] },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
