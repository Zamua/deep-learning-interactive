import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-reward-model',
  title: 'Training a reward model',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Christiano, Leike, Brown, Martic, Legg & Amodei', year: 2017, title: 'Deep reinforcement learning from human preferences', url: 'https://arxiv.org/abs/1706.03741', scene: 'learn' },
  ],
  scenes: [
    {
      id: 'learn',
      title: 'What one pick teaches',
      codeTitle: 'reward_model.py',
      code: `
        # 2017: pairs of robot clips     #@clips
        # 900 picks: backflips           #@flip
        z = r_w - r_l     # the gap      #@z
        loss = -np.log(sigmoid(z))       #@z
        # z = 3: ranked right, flat      #@right
        # z = -2: ranked wrong, steep    #@wrong
      `,
      beats: [
        { id: 'clips', say: 'A reward model learns from people\'s picks, and people\'s time is scarce. In 2017, Paul Christiano and colleagues showed people pairs of clips of a simulated robot, each a second or two long, and asked which they preferred.', code: 'clips' },
        { id: 'flip', say: 'Their reward model learned from those picks with the loss from before. From only {900|nine hundred} picks, made in under an hour, the robot learned to do backflips.', code: 'flip' },
        { id: 'train', say: 'Training a model means changing it, step by step, so that its loss goes down. So what does one pick do to the two scores?', code: 'z' },
        { id: 'curve', say: 'Here is that loss, against the gap between the winner\'s score and the loser\'s. Call the gap z.', code: 'z' },
        { id: 'right', say: 'A pair the model already ranks right, by a gap of three, sits where the curve is nearly flat: little slope, so little to learn.', code: 'right' },
        { id: 'wrong', say: 'A pair it ranks wrong, by two, sits where the curve is steep: a big slope, so a big push. How big, exactly? Walk back through the loss.', code: 'wrong' },
      ],
    },
    {
      id: 'back',
      title: 'Which way each score moves',
      codeTitle: 'backward.py',
      code: `
        z = r_w - r_l          # 1.0     #@z
        p = sigmoid(z)         # 0.73    #@fwd
        loss = -np.log(p)      # 0.31    #@fwd
        dp = -1 / p            # -1.37   #@dlog
        dz = dp * p * (1 - p)  # -0.27   #@dsig
        # = -(1 - p)                     #@cancel
        dr_w = dz * 1          # -0.27   #@drw
        dr_l = dz * -1         # +0.27   #@drl
      `,
      beats: [
        { id: 'graph', say: 'Draw the loss as a graph. The two scores meet at a subtract node, which makes the gap, z.', code: 'z' },
        { id: 'chain', say: 'z goes into a sigmoid node, and a minus ln node turns that into the loss, L.', code: 'fwd' },
        { id: 'fwd', say: 'Run it forward on the pair from before, scored two and one: z is one. As before, sigma is about {0.73|zero point seven three}, and the loss about {0.31|zero point three one}.', code: ['z', 'fwd'] },
        { id: 'ln', say: 'Now walk back from L, one local slope at a time. Minus ln has slope minus one over its input: at {0.73|zero point seven three}, about minus {1.37|one point three seven}.', code: 'dlog' },
        { id: 'sig', say: 'The sigmoid\'s local slope is sigma times one minus sigma: {0.73|zero point seven three} times {0.27|zero point two seven}, about {0.20|zero point two}.', code: 'dsig' },
        { id: 'times', say: 'Times the minus {1.37|one point three seven} arriving from above, z gets about minus {0.27|zero point two seven}.', code: 'dsig' },
        { id: 'cancel', say: 'That is no coincidence. Minus one over sigma, times sigma times one minus sigma: the sigma on top cancels the one below.', code: 'cancel' },
        { id: 'rule', say: 'That leaves {−(1 − σ)|minus, one minus sigma}: one minus {0.73|zero point seven three}, made negative.', code: 'cancel' },
        { id: 'win', say: 'Last, the subtract node. z rises one for one with the winner\'s score, so {r_w|r w} gets the same minus {0.27|zero point two seven}.', code: 'drw' },
        { id: 'lose', say: 'But z falls as the loser\'s score rises, so {r_l|r l} gets it with the sign flipped: plus {0.27|zero point two seven}.', code: 'drl' },
        { id: 'step', say: 'Step against those slopes, as with any gradient, and the winner\'s score rises while the loser\'s falls, by the same amount.', code: ['drw', 'drl'] },
      ],
    },
    {
      id: 'agree',
      title: 'Which picks teach most',
      codeTitle: 'backward.py',
      code: `
        push = 1 - sigmoid(z)  # per score #@push
        1 - sigmoid(1)    # 0.27           #@one
        1 - sigmoid(-1)   # 0.73           #@neg
        1 - sigmoid(3)    # 0.05           #@far
      `,
      beats: [
        { id: 'push', say: 'So one pick pushes the two scores apart, each by one minus sigma of the gap. Plot that push against z.', code: 'push' },
        { id: 'one', say: 'The pair from before, ranked right by one, moves each score {0.27|zero point two seven}.', code: 'one' },
        { id: 'neg', say: 'Now say the labeler had picked b. The scores are the same, but z is minus one: the model ranks this pair wrong.', code: 'neg' },
        { id: 'neg2', say: 'Sigma of minus one is about {0.27|zero point two seven}, so the push is {0.73|zero point seven three}: nearly three times as big. The slope on {r_l|r l} is plus {0.73|zero point seven three}.', code: 'neg' },
        { id: 'far', say: 'A pair ranked right by three moves only about {0.05|zero point zero five}. Still, it moves: sigma never quite reaches one.', code: 'far' },
        { id: 'most', say: 'So the model learns most from the picks it gets wrong, and least from the ones it already agrees with.', code: 'push' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
