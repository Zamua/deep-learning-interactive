import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-reward-model',
  title: 'Reward models',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'compare',
      title: 'Scores from comparisons',
      codeTitle: 'reward_model.py',
      code: `
        r_a, r_b = rm(ans_a), rm(ans_b)  # 2, 1 #@r
        prob = sigmoid(r_a - r_b)  # 0.73      #@P
        # = e^r_a / (e^r_a + e^r_b)            #@soft
        sigmoid(12.0 - 11.0)       # 0.73      #@shift
      `,
      beats: [
        { id: 'hard', say: 'Grading an answer on a scale is hard for people. Saying which of two answers is better is easy.' },
        { id: 'score', say: 'A reward model reads an answer and gives it one number, a score, r. Answer a\'s score, {r_a|r a}, is two, and answer b\'s, {r_b|r b}, is one.', code: 'r' },
        { id: 'sigma', say: 'Its prediction that people prefer a is the sigmoid of the gap: {σ(2 − 1)|sigma of two minus one}, which is sigma of one, about {0.73|zero point seven three}.', code: 'P' },
        { id: 'soft', say: 'That is softmax over the two scores: e to the score of a, over the sum for both. Divide through, and it is the same sigmoid.', code: 'soft' },
        { id: 'gap', say: 'Only the gap matters. Add ten to both scores, and the prediction does not move.', code: 'shift' },
      ],
    },
    {
      id: 'loss',
      title: 'Learning from a choice',
      codeTitle: 'reward_model.py',
      code: `
        # a person preferred answer a        #@w
        loss = -np.log(sigmoid(r_a - r_b))   #@loss
        # -ln 0.73 = 0.31                    #@loss
        # had b won: -ln 0.27 = 1.31         #@flip
      `,
      beats: [
        { id: 'pairs', say: 'The training data is pairs of answers to the same prompt, where a person picked the winner. Call the winner\'s score {r_w|r w} and the loser\'s {r_l|r l}.', code: 'w' },
        { id: 'loss', say: 'The loss, L, is cross-entropy on that choice: minus the log of {σ(r_w − r_l)|sigma of r w minus r l}, the probability the model gave the winner. With a preferred, minus the log of {0.73|zero point seven three}: {0.31|zero point three one}.', code: 'loss' },
        { id: 'flip', say: 'Had the person picked b, the model would have given that only {0.27|zero point two seven}, and the loss would be {1.31|one point three one}.', code: 'flip' },
      ],
    },
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
        { id: 'chain', say: 'How does one choice move the two scores? Call the gap z: {r_w − r_l|r w minus r l}. The loss is a chain: z feeds the sigmoid, and the sigmoid feeds minus ln. With a preferred, z is one, sigma is {0.73|zero point seven three}, and the loss {0.31|zero point three one}.', code: 'z' },
        { id: 'back', say: 'Walk back from the loss, multiplying local slopes. Minus ln has slope minus one over its input. At {0.73|zero point seven three}, that is about minus {1.37|one point three seven}.', code: 'dlog' },
        { id: 'sig', say: 'The sigmoid\'s slope is sigma times one minus sigma: {0.73|zero point seven three} times {0.27|zero point two seven}, about {0.20|zero point two}. So the slope on z is minus {1.37|one point three seven} times {0.20|zero point two}: minus {0.27|zero point two seven}.', code: 'dsig' },
        { id: 'cancel', say: 'In symbols, that is minus one over sigma, times sigma times one minus sigma. The sigmas cancel, leaving {−(1 − σ)|minus, one minus sigma}: one minus {0.73|zero point seven three}, made negative. The same minus {0.27|zero point two seven}.', code: 'cancel' },
        { id: 'scores', say: 'Last, z rises one for one with the winner\'s score, and falls one for one as the loser\'s rises. So the slope on {r_w|r w} is {σ − 1|sigma minus one}, minus {0.27|zero point two seven}, and on {r_l|r l} it is {1 − σ|one minus sigma}, plus {0.27|zero point two seven}.', code: 'dr' },
        { id: 'push', say: 'Lowering the loss steps against those slopes: it raises the winner and lowers the loser, by {0.27|zero point two seven} each.', code: 'dr' },
        { id: 'agree', say: 'A pair the model already ranks right, with {σ|sigma} near one, barely moves it. A pair it gets wrong moves it the most.', code: 'cancel' },
        { id: 'rank', say: 'So the model learns to rank answers the way people do. A score alone means nothing; only its gap to another answer\'s score does.' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
