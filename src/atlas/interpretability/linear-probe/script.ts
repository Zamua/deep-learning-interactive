import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-linear-probe',
  title: 'Linear probes',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'probe',
      title: 'A classifier on a frozen model',
      codeTitle: 'probe.py',
      code: `
        h = stream[layer]     # frozen activations   #@h
        s = w @ h + b         # one score            #@score
        noun = s > 0          # the probe's answer   #@pred
      `,
      beats: [
        { id: 'freeze', say: 'Does the residual stream at some layer know whether a word is a noun? Freeze the model, and collect its stream, h, for many words, each labeled noun or not.', code: 'h' },
        { id: 'fit', say: 'Then fit a linear classifier on them: a score, {w · h + b|w dot h plus b}, positive for a noun. Only w and b are trained. The model never changes.', code: ['score', 'pred'] },
        { id: 'example', say: 'Say h is two, minus one and a half, w is one, two and minus two, and b is a half. The score is two, minus two, minus one, plus a half: minus a half. The probe says: not a noun.', code: 'score' },
      ],
    },
    {
      id: 'classes',
      title: 'More than two answers',
      codeTitle: 'tense.py',
      code: `
        h = np.array([1, 2])                 #@h
        W = np.array([[1, 0],     # past     #@W
                      [-1, 2],    # present  #@W
                      [2, -1]])   # future   #@W
        b = np.array([0, -1, 1])             #@W
        s = W @ h + b    # [1, 2, 1]         #@s
        s.max()          # 2: present        #@max
      `,
      beats: [
        { id: 'rows', say: 'A probe can also decode more than yes or no, like a sentence\'s tense. Then it is a linear classifier with one weight row and one bias per class: {w₀|w zero} and {b₀|b zero} for past, {w₁|w one} and {b₁|b one} for present, {w₂|w two} and {b₂|b two} for future.', code: ['h', 'W'] },
        { id: 'scores', say: 'Here h is one, two. Past scores one times one, plus zero times two, plus zero: one. Present scores minus one, plus four, minus one: two. Future scores two, minus two, plus one: one.', code: 's' },
        { id: 'wins', say: 'As in any linear classifier, the highest score wins: the probe says present.', code: 'max' },
      ],
    },
    {
      id: 'test',
      title: 'Test on held-out words',
      codeTitle: 'accuracy.py',
      code: `
        preds = scores > 0                     #@pred
        acc = (preds == labels).mean()   # 0.75   #@acc
      `,
      beats: [
        { id: 'held', say: 'Now test the probe on words it was not fit on. A score above zero predicts noun.', code: 'pred' },
        { id: 'count', say: 'It matches the true label on six of eight: an accuracy of {0.75|zero point seven five}, where a coin flip would get {0.5|zero point five}.', code: 'acc' },
      ],
    },
    {
      id: 'meaning',
      title: 'Present, not proven used',
      codeTitle: 'meaning.py',
      code: `
        # high accuracy: the stream holds it, linearly   #@there
        # not shown: that the model uses it              #@use
        # keep probes linear, or they compute it         #@linear
      `,
      beats: [
        { id: 'there', say: 'High accuracy shows the information is in the stream, written so that one linear map can read it.', code: 'there' },
        { id: 'use', say: 'It does not show that the model uses it. Present is not the same as used, and testing use takes an experiment on the model itself.', code: 'use' },
        { id: 'linear', say: 'And the probe is kept linear on purpose. A large network could work out the answer by itself, and then its success would describe the probe, not the stream.', code: 'linear' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
