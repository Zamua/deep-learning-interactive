import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-preference-loss',
  title: 'Scores from comparisons',
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
      id: 'try',
      title: 'Try one',
      codeTitle: 'reward_model.py',
      code: `
        r_a, r_b = 3.0, 1.0   # b was preferred  #@p1
        z = r_b - r_a         # -2               #@a1
        p = sigmoid(z)        # 0.12             #@a1
        loss = -np.log(p)     # 2.12             #@a2
      `,
      beats: [
        { id: 'p1', say: 'Try one. A labeler preferred answer b. The reward model scores a at three and b at one. What is its loss on this pair? Use {σ(−2) ≈ 0.12|sigma of minus two, about zero point one two}, and ln {0.12|zero point one two} is about minus {2.12|two point one two}.', code: 'p1' },
        { id: 'a1', say: 'The gap is the preferred score minus the other: one minus three, minus two. So the model gives b {σ(−2)|sigma of minus two}, about {0.12|zero point one two}.', code: 'a1' },
        { id: 'a2', say: 'The loss is minus the log of that: minus ln {0.12|zero point one two}, about {2.12|two point one two}. Large, because the model scored the rejected answer higher.', code: 'a2' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
