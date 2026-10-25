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
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
