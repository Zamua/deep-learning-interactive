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
        # d loss / d r_a = 0.73 - 1 = -0.27  #@grad
        # d loss / d r_b = +0.27             #@grad
      `,
      beats: [
        { id: 'pairs', say: 'The training data is pairs of answers to the same prompt, where a person picked the winner. Call the winner\'s score {r_w|r w} and the loser\'s {r_l|r l}.', code: 'w' },
        { id: 'loss', say: 'The loss, L, is cross-entropy on that choice: minus the log of {σ(r_w − r_l)|sigma of r w minus r l}, the probability the model gave the winner. With a preferred, minus the log of {0.73|zero point seven three}: {0.31|zero point three one}.', code: 'loss' },
        { id: 'flip', say: 'Had the person picked b, the model would have given that only {0.27|zero point two seven}, and the loss would be {1.31|one point three one}.', code: 'flip' },
        { id: 'push', say: 'The loss\'s slope is {σ|sigma} minus one for the winner\'s score, and one minus {σ|sigma} for the loser\'s. So lowering the loss raises the winner and lowers the loser, by {0.27|zero point two seven} each.', code: 'grad' },
        { id: 'agree', say: 'A pair the model already ranks right, with {σ|sigma} near one, barely moves it. A pair it gets wrong moves it the most.', code: 'grad' },
        { id: 'rank', say: 'So the model learns to rank answers the way people do. A score alone means nothing; only its gap to another answer\'s score does.' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
