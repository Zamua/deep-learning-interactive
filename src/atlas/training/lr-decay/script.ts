import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-lr-decay',
  title: 'Warmup and decay',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'He, Zhang, Ren & Sun', year: 2015, title: 'Deep Residual Learning for Image Recognition', url: 'https://arxiv.org/abs/1512.03385', scene: 'steps' },
    { who: 'Goyal, Dollár, Girshick, Noordhuis, Wesolowski, Kyrola, Tulloch, Jia & He', year: 2017, title: 'Accurate, Large Minibatch SGD: Training ImageNet in 1 Hour', url: 'https://arxiv.org/abs/1706.02677', scene: 'warmup' },
  ],
  scenes: [
    {
      id: 'settle',
      title: 'Fast, then settle',
      codeTitle: 'walk.py',
      code: `
        x = x - lr * g               #@step
        lr = 0.2   # creeps down     #@small
        lr = 3.0   # fast, bounces   #@big
        # 3.0 first, then lower      #@both
      `,
      beats: [
        { id: 'valley', say: 'Picture a valley: a long, even slope down to a narrow bottom. A ball walks down it, each step the learning rate, {η|eta}, times the slope.', code: 'step' },
        { id: 'small', say: 'With a small rate, the ball creeps: after thirty steps it is still far from the bottom.', code: 'small' },
        { id: 'big', say: 'With a big rate it races down. But this slope never flattens, so the steps never shrink, and at the bottom the ball bounces side to side forever.', code: 'big' },
        { id: 'both', say: 'So start big, then lower the rate as the walk goes on: down the slope fast, then smaller and smaller bounces, until it settles.', code: 'both' },
        { id: 'name', say: 'One whole walk, first step to last, is a run. Lowering the rate over a run is called decay: it decays, the way a sound fades.', code: 'both' },
        { id: 'schedule', say: 'The rate planned for every step is the run\'s schedule: here, held high, then sloping down.', code: 'both' },
      ],
    },
    {
      id: 'steps',
      title: 'Step decay',
      codeTitle: 'step.py',
      code: `
        lr = 0.1 * 0.1 ** (t // 10000)   #@rule
        # t = 15,000: 1 drop:  0.01      #@one
        # t = 25,000: 2 drops: 0.001     #@two
        # t = 20,000: 2 drops: 0.001     #@edge
      `,
      beats: [
        { id: 'rule', say: 'The classic schedule goes in steps: hold the rate, then multiply it by a factor, often {0.1|zero point one} or a half, every so many steps. It makes a staircase.', code: 'rule' },
        { id: 'he', say: 'In 2015, {Kaiming He|Kaiming Her} and colleagues at Microsoft trained an image recognizer this way: {0.1|zero point one}, divided by ten at step thirty-two thousand, and again at forty-eight thousand.', code: 'rule' },
        { id: 'one', say: 'Say it starts at {0.1|zero point one} and drops every ten thousand steps. By step fifteen thousand, one drop has happened: {0.1|zero point one} times {0.1|zero point one}, or {0.01|zero point zero one}.', code: 'one' },
        { id: 'two', say: 'By twenty-five thousand, two drops have, each one multiplying by {0.1|zero point one} again: {0.1|zero point one} times {0.1|zero point one} squared, {0.001|zero point zero zero one}.', code: 'two' },
        { id: 'edge', say: 'The two slashes count the drops: t divided by ten thousand, with the remainder thrown away. At exactly step twenty thousand that is two: the drop there has happened.', code: ['rule', 'edge'] },
      ],
    },
    {
      id: 'linear',
      title: 'Linear decay',
      codeTitle: 'linear.py',
      code: `
        eta_max, eta_min = 0.1, 0.01    #@ends
        T = 1000                        #@T
        gap = eta_max - eta_min  # 0.09 #@gap
        lr = eta_max - gap * t / T      #@rule
        0.4 * 0.09            # 0.036   #@frac
        0.1 - 0.036           # 0.064   #@lr
      `,
      beats: [
        { id: 'top', say: 'Linear decay slides the rate down in a straight line instead. It starts at the top rate, {ηₘₐₓ|eta max}: here, the largest rate the run uses.', code: 'ends' },
        { id: 'bottom', say: 'It ends at the bottom rate, {ηₘᵢₙ|eta min},', code: 'ends' },
        { id: 'T', say: 'T steps later, falling by the same amount every step.', code: ['T', 'rule'] },
        { id: 'gap', say: 'Take {0.1|zero point one} down to {0.01|zero point zero one} over a thousand steps: the whole fall, the gap, is {0.09|zero point zero nine}.', code: 'gap' },
        { id: 'frac', say: 'At step four hundred, the run is {0.4|zero point four} of the way along, so the rate has fallen {0.4|zero point four} of the gap: {0.036|zero point zero three six}.', code: ['rule', 'frac'] },
        { id: 'lr', say: 'Take that from the top: {0.1|zero point one} minus {0.036|zero point zero three six} leaves {0.064|zero point zero six four}.', code: 'lr' },
      ],
    },
    {
      id: 'warmup',
      title: 'Warmup',
      codeTitle: 'warmup.py',
      code: `
        eta_max, k = 0.1, 1000             #@peak
        lr = eta_max  # from t = 0: blows up #@full
        lr = eta_max * min(1, t / k)       #@ramp
        # t = 250: 0.1 * 0.25 = 0.025      #@ex
        # t = 1,500: past k, so 0.1        #@hold
      `,
      beats: [
        { id: 'wall', say: 'The start has its own trouble. Far from the bottom, the walls are often steep, and the gradient is large.', code: 'peak' },
        { id: 'fly', say: 'At the full rate, the first step flies past the bottom onto the far wall, higher and steeper still. The next is bigger again: the walk blows up.', code: 'full' },
        { id: 'ramp', say: 'So ramp the rate up instead: from zero, in a straight line, to {ηₘₐₓ|eta max} over the first k steps. That is warmup.', code: 'ramp' },
        { id: 'grow', say: 'The first steps stay small while the wall is steep, and by the time the ball reaches gentler ground, the rate has grown.', code: 'ramp' },
        { id: 'formula', say: 'At step t the rate is {ηₘₐₓ|eta max} times t over k. With {ηₘₐₓ|eta max} at {0.1|zero point one} and k a thousand, step two hundred and fifty is a quarter of the way: {0.025|zero point zero two five}.', code: 'ex' },
        { id: 'hold', say: 'Once t reaches k, the rate holds at {ηₘₐₓ|eta max}: step fifteen hundred runs at the full {0.1|zero point one}.', code: 'hold' },
        { id: 'goyal', say: 'In 2017, Priya Goyal and colleagues at Facebook needed a rate of {3.2|three point two}. Jumping to it from a low rate set the run back for good; ramping up in a straight line fixed it. They called it gradual warmup.', code: 'ramp' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
