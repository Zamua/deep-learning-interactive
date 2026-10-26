import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-reward-model',
  title: 'Training a reward model',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'slope',
      title: 'Which way each score moves',
      codeTitle: 'backward.py',
      code: `
        z = r_w - r_l          # 1.0       #@z
        p = sigmoid(z)         # 0.73      #@z
        loss = -np.log(p)      # 0.31      #@z
        dp = -1 / p            # -1.37     #@dlog
        dz = dp * p * (1 - p)  # -0.27     #@dsig
        # = -(1 - p)                       #@cancel
        dr_w = dz * 1          # -0.27     #@dr
        dr_l = dz * -1         # +0.27     #@dr
      `,
      beats: [
        { id: 'chain', say: 'How does one choice move the two scores? Call the gap z: {r_w − r_l|r w minus r l}. The loss is a chain: z feeds the sigmoid, and the sigmoid feeds minus ln. People preferred an answer scored two over one scored one, so z is one, sigma is {0.73|zero point seven three}, and the loss {0.31|zero point three one}.', code: 'z' },
        { id: 'back', say: 'Walk back from the loss, multiplying local slopes. Minus ln has slope minus one over its input. At {0.73|zero point seven three}, that is about minus {1.37|one point three seven}.', code: 'dlog' },
        { id: 'sig', say: 'The sigmoid\'s slope is sigma times one minus sigma: {0.73|zero point seven three} times {0.27|zero point two seven}, about {0.20|zero point two}. So the slope on z is minus {1.37|one point three seven} times {0.20|zero point two}: minus {0.27|zero point two seven}.', code: 'dsig' },
        { id: 'cancel', say: 'In symbols, that is minus one over sigma, times sigma times one minus sigma. The sigmas cancel, leaving {−(1 − σ)|minus, one minus sigma}: one minus {0.73|zero point seven three}, made negative. The same minus {0.27|zero point two seven}.', code: 'cancel' },
        { id: 'scores', say: 'Last, z rises one for one with the winner\'s score, and falls one for one as the loser\'s rises. So the slope on {r_w|r w} is {σ − 1|sigma minus one}, minus {0.27|zero point two seven}, and on {r_l|r l} it is {1 − σ|one minus sigma}, plus {0.27|zero point two seven}.', code: 'dr' },
        { id: 'push', say: 'Lowering the loss steps against those slopes: it raises the winner and lowers the loser, by {0.27|zero point two seven} each.', code: 'dr' },
        { id: 'agree', say: 'A pair the model already ranks right, with {σ|sigma} near one, barely moves it. A pair it gets wrong moves it the most.', code: 'cancel' },
      ],
    },
    {
      id: 'try',
      title: 'Try one',
      codeTitle: 'backward.py',
      code: `
        z = r_w - r_l          # -1        #@p1
        p = sigmoid(z)         # 0.27      #@p1
        dz = -(1 - p)          # -0.73     #@a1
        dr_l = dz * -1         # +0.73     #@a2
      `,
      beats: [
        { id: 'p1', say: 'Try one. A pair has {r_w − r_l|r w minus r l} of minus one: the model scored the rejected answer higher. {σ(−1)|sigma of minus one} is about {0.27|zero point two seven}. What is the loss\'s slope on {r_l|r l}?', code: 'p1' },
        { id: 'a1', say: 'The slope on z is {−(1 − σ)|minus, one minus sigma}: one minus {0.27|zero point two seven} is {0.73|zero point seven three}, made negative.', code: 'a1' },
        { id: 'a2', say: 'z falls as {r_l|r l} rises, so multiply by minus one: plus {0.73|zero point seven three}. Far more than the {0.27|zero point two seven} of the pair it ranked right.', code: 'a2' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
