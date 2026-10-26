import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-loss-curves',
  title: 'Reading loss curves',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'rates',
      title: 'Four learning rates',
      codeTitle: 'curves.py',
      code: `
        # the same model, four learning rates   #@axes
        lr = 1e-6   # slow, almost a line       #@low
        lr = 1e-1   # drops, then stalls high   #@high
        lr = 1.0    # shoots up to nan          #@huge
        lr = 1e-3   # fast, then keeps going    #@good
      `,
      beats: [
        { id: 'axes', say: 'A loss curve plots the training loss, L, as training goes on. Its shape says what is wrong.', code: 'axes' },
        { id: 'low', say: 'A learning rate too low: the loss falls, but slowly, in an almost straight line.', code: 'low' },
        { id: 'high', say: 'Too high: it drops fast at first, then stalls at a high level, its steps too big to settle into the valley.', code: 'high' },
        { id: 'huge', say: 'Far too high: the loss shoots up, and soon prints nan, not a number.', code: 'huge' },
        { id: 'good', say: 'A good rate drops quickly, then keeps creeping lower.', code: 'good' },
      ],
    },
    {
      id: 'more',
      title: 'Noise and overfitting',
      codeTitle: 'curves.py',
      code: `
        # batch of 8: noisy, but trending down     #@noisy
        # L_train falls while L_val climbs         #@val
        best = np.argmin(val_losses)   # epoch 12  #@bottom
      `,
      beats: [
        { id: 'noisy', say: 'A curve that jumps up and down but still trends lower means each gradient is noisy, usually because the batch is small. A bigger batch smooths it.', code: 'noisy' },
        { id: 'val', say: 'Now add the validation loss. If the training loss keeps falling while validation turns and climbs, the model is overfitting.', code: 'val' },
        { id: 'gap', say: 'A small, steady gap between the two is normal. A gap that keeps widening is the warning sign.', code: 'val' },
        { id: 'bottom', say: 'The best weights are where validation bottomed out, here at epoch twelve. Keep those, and stop there.', code: 'bottom' },
      ],
    },
    {
      id: 'read',
      title: 'Read the numbers',
      codeTitle: 'logs.py',
      code: `
        low = [2.30, 2.28, 2.26, 2.24, 2.21, 2.19]     #@slow
        high = [2.30, 1.38, 1.21, 1.19, 1.22, 1.20]    #@plateau
        huge = [2.30, 4.88, 11.21, 27.93, 69.10, nan]  #@explode
        noisy = [2.30, 2.33, 1.71, 1.95,               #@noisy
                 1.32, 1.55, 0.92, 1.16]               #@noisy
      `,
      beats: [
        { id: 'list', say: 'Often the log is just numbers. Read them as a curve, one point per reading. Here, every hundred steps: {2.30|two point three oh}, {2.28|two point two eight}, {2.26|two point two six}, {2.24|two point two four}.', code: 'slow' },
        { id: 'slow', say: 'Each reading is about two hundredths lower than the last: the same small drop every time, an almost straight line. The learning rate is too low.', code: 'slow' },
        { id: 'plateau', say: 'This one falls from {2.30|two point three oh} to {1.38|one point three eight}, then hovers near {1.2|one point two}: a fast drop, then flat at a high level. The rate is too high to settle.', code: 'plateau' },
        { id: 'explode', say: 'This one more than doubles every reading, {4.88|four point eight eight}, {11.21|eleven point two one}, until it prints nan. The rate is far too high.', code: 'explode' },
        { id: 'noisy', say: 'And this one goes up, down, up, down, but each low is lower than the one before: a noisy curve that still trends down. The batch is too small.', code: 'noisy' },
      ],
    },
    {
      id: 'try',
      title: 'Try one',
      codeTitle: 'runs.py',
      code: `
        A = [2.30, 1.39, 1.06, 0.83, 0.67]    #@p
        B = [2.30, 4.88, 11.21, 27.93, nan]   #@p
        C = [2.30, 2.28, 2.26, 2.23, 2.21]    #@p
        # C: same tiny drop: lowest rate      #@lowest
        # A: fast, keeps going: in between    #@middle
        # B: blows up: highest rate           #@highest
      `,
      beats: [
        { id: 'p', say: 'Try one. Three runs train the same model, differing only in the learning rate. Order them from the lowest rate to the highest.', code: 'p' },
        { id: 'lowest', say: 'Run C drops by the same tiny amount each time: the lowest rate.', code: 'lowest' },
        { id: 'middle', say: 'Run A drops fast and keeps going lower: a good rate, in between.', code: 'middle' },
        { id: 'highest', say: 'Run B blows up to nan: the highest. So C, then A, then B.', code: 'highest' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
