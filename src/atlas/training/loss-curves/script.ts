import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-loss-curves',
  title: 'Reading loss curves',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Bengio', year: 2012, title: 'Practical Recommendations for Gradient-Based Training of Deep Architectures', url: 'https://arxiv.org/abs/1206.5533', scene: 'rates' },
  ],
  scenes: [
    {
      id: 'watch',
      title: 'What you can see',
      codeTitle: 'train.py',
      code: `
        for step in range(5000):      #@loop
            w = w - lr * g            #@loop
            if step % 100 == 0:       #@log
                print(step, L)        #@log
      `,
      beats: [
        { id: 'walk', say: 'Training walks the weights downhill on the loss, L, one step at a time, like the ball walking down the bowl.', code: 'loop' },
        { id: 'blind', say: 'A real model has millions of weights, so there is no bowl to see. What you can see is how high the ball is: every hundred steps, training prints the loss.', code: 'log' },
        { id: 'log', say: 'That printout is the training log: log as in a ship\'s log, a record kept along the way, not a logarithm.', code: 'log' },
        { id: 'curve', say: 'Plot each reading against its step, and you have a loss curve. Its shape tells you what is wrong, and what to change.', code: 'log' },
      ],
    },
    {
      id: 'rates',
      title: 'Four learning rates',
      codeTitle: 'rates.py',
      code: `
        gentle = 0.25 * w[0]**2            #@two
        steep = w[1]**2                    #@two
        L = gentle + steep                 #@sum
        lr = 0.03  # creeps: a slow line   #@low
        lr = 0.4   # fast, keeps going     #@good
        lr = 1.0   # steep one bounces     #@high
        lr = 1.3   # steep one flies: nan  #@huge
      `,
      beats: [
        { id: 'two', say: 'Why do the shapes differ? Take a loss with just two weights, rising gently with one and steeply with the other: two bowls, each with its own ball.', code: 'two' },
        { id: 'sum', say: 'The loss is their two heights added up, so one curve tracks both balls at once.', code: 'sum' },
        { id: 'low', say: 'With a rate too low, both balls creep. The loss falls slowly, by about the same small amount each step: almost a straight line.', code: 'low' },
        { id: 'good', say: 'A good rate: the steep ball slides straight in, and the gentle one follows. The loss drops fast, then keeps creeping lower.', code: 'good' },
        { id: 'high', say: 'Too high is subtler. The gentle ball still slides in, but for the steep bowl this rate is right at the edge: each step flips its ball to the other wall, at the same height.', code: 'high' },
        { id: 'plateau', say: 'So the loss drops fast, then stalls high: a plateau, flat high ground. The steps are too big to settle into the bottom.', code: 'high' },
        { id: 'huge', say: 'Far too high, and the steep ball lands farther out every step: the walk diverges. The loss shoots up, until the arithmetic breaks down and prints nan: not a number.', code: 'huge' },
        { id: 'order', say: 'So from the lowest rate to the highest: a slow straight line, a fast drop that keeps going, a fast drop that stalls, and a blow-up.', code: ['low', 'good', 'high', 'huge'] },
        { id: 'cure', say: 'The shape names the cure. A slow line wants a bigger rate; a plateau or a blow-up wants a smaller one.', code: ['low', 'high', 'huge'] },
        { id: 'bengio', say: 'Yoshua Bengio, in 2012, called the learning rate often the single most important setting to tune. His advice when training diverges: try again with a rate three times smaller.', code: 'huge' },
      ],
    },
    {
      id: 'more',
      title: 'Noise and overfitting',
      codeTitle: 'curves.py',
      code: `
        B = 8    # few examples: noisy     #@noisy
        B = 64   # more examples: smoother #@big
        # L_train falls, L_val climbs      #@val
      `,
      beats: [
        { id: 'noisy', say: 'Another shape comes from the batch. In a small batch, each gradient comes from a few examples and scatters, so the loss jitters up and down while its trend still falls.', code: 'noisy' },
        { id: 'big', say: 'A bigger batch scatters less, and the curve smooths out.', code: 'big' },
        { id: 'val', say: 'Now add the validation loss, measured on held-back examples. If training keeps falling while validation turns and climbs, the model is overfitting.', code: 'val' },
      ],
    },
    {
      id: 'read',
      title: 'Read the numbers',
      codeTitle: 'log.py',
      code: `
        low = [2.30, 2.28, 2.26, 2.24, 2.21]   #@slow
        high = [2.30, 1.38, 1.21, 1.19, 1.22]  #@plateau
        huge = [2.30, 4.88, 11.21, 27.93, nan] #@explode
        noisy = [2.30, 2.33, 1.71, 1.95, 1.32] #@noisy
        val = [2.16, 1.58, 1.27, 1.19, 1.24]   #@val
        # every 2 epochs: 4th is epoch 8       #@epoch
      `,
      beats: [
        { id: 'list', say: 'Often the log is only numbers. Read them as a curve, one point per reading: here, every hundred steps.', code: 'slow' },
        { id: 'slow', say: 'Each reading is about two hundredths below the last: the same small drop every time, a straight line. The rate is too low.', code: 'slow' },
        { id: 'plateau', say: 'This one falls fast, from {2.30|two point three oh} to {1.38|one point three eight}, then hovers near {1.2|one point two}: a plateau. The rate is too high.', code: 'plateau' },
        { id: 'explode', say: 'This one more than doubles every reading, until it prints nan. The rate is far too high.', code: 'explode' },
        { id: 'noisy', say: 'This one goes up, down, up, down, but each low is lower than the last: noisy, and still trending down. The batch is too small.', code: 'noisy' },
        { id: 'val', say: 'To find where to stop, read the validation losses. Logged every two epochs, they bottom out at {1.19|one point one nine}, the fourth reading.', code: 'val' },
        { id: 'epoch', say: 'With two epochs between readings, the fourth one is epoch eight, not epoch four. Those are the weights to keep.', code: 'epoch' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
