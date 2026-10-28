import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-preference-loss',
  title: 'Scores from comparisons',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Zermelo', year: 1929, title: 'Die Berechnung der Turnier-Ergebnisse als ein Maximumproblem der Wahrscheinlichkeitsrechnung', url: 'https://doi.org/10.1007/BF01180541', scene: 'chance' },
    { who: 'Bradley & Terry', year: 1952, title: 'Rank analysis of incomplete block designs: I. The method of paired comparisons', url: 'https://doi.org/10.1093/biomet/39.3-4.324', scene: 'chance' },
  ],
  scenes: [
    {
      id: 'pick',
      title: 'Which answer is better?',
      codeTitle: 'reward_model.py',
      code: `
        prompt = 'Why is the sky blue?'  #@prompt
        ans_a = 'Air scatters blue...'   #@ans
        ans_b = 'It reflects the ocean.' #@ans
        pick = 'a'   # the labeler's     #@pick
        r_a = rm(prompt, ans_a)  # 2.0   #@r
        r_b = rm(prompt, ans_b)  # 1.0   #@r
      `,
      beats: [
        { id: 'hard', say: 'Ask a person to grade an answer from one to ten, and they have to invent a scale as they go. Ask which of two answers is better, and they just pick.', code: 'ans' },
        { id: 'prompt', say: 'These two reply to the same question: why is the sky blue? The question is called the prompt, because it prompts the answers.', code: 'prompt' },
        { id: 'labeler', say: 'A person reads both and picks {a|A}, the one with the physics right. That person is called a labeler: they label each pair with its winner.', code: 'pick' },
        { id: 'want', say: 'From many such picks, we want a program that can score any answer to any prompt, even answers no labeler has read.', code: 'r' },
        { id: 'model', say: 'It is called a reward model, {rm|R M} in the code. A model, because it imitates something: here, the labelers\' judgment.', code: 'r' },
        { id: 'reward', say: 'And its score for an answer is called a reward, because a better answer earns a higher one. Call it r. Here, {a|A} gets two, and b gets one.', code: 'r' },
        { id: 'ask', say: 'For those scores to mean anything, they must predict the picks. So what chance should a gap of one give {a|A}?', code: 'r' },
      ],
    },
    {
      id: 'chance',
      title: 'A share of strength',
      codeTitle: 'chance.py',
      code: `
        # chess: player 1 vs player 2   #@chess
        # strengths: 3 and 1            #@s
        3 / (3 + 1)   # 0.75: 1 wins    #@share
        ea = np.exp(r_a)  # e^2: 7.39   #@ea
        eb = np.exp(r_b)  # e^1: 2.72   #@eb
        ea / (ea + eb)    # 0.73        #@total
      `,
      beats: [
        { id: 'chess', say: 'Chess met this problem long ago: from who beat whom, say how strong each player is.', code: 'chess' },
        { id: 'zermelo', say: 'In 1929, the German mathematician Ernst Zermelo tackled it, for a New York chess tournament. He gave each player a strength, a positive number.', code: 's' },
        { id: 'share', say: 'The chance one player beats the other is their share of the two strengths. Strength three against one: three over four, a {0.75|zero point seven five} chance.', code: 'share' },
        { id: 'bt', say: 'In 1952, Ralph Bradley and Milton Terry found the same rule again, for comparing any two things. It carries their names: the {Bradley–Terry|Bradley Terry} model.', code: 'share' },
        { id: 'exp', say: 'Answers have scores, and a score can be negative, so turn each into a strength the way softmax does: e to the score. For {a|A}, e squared, about {7.39|seven point three nine}.', code: 'ea' },
        { id: 'eb', say: 'For b, e to the one, about {2.72|two point seven two}.', code: 'eb' },
        { id: 'total', say: 'So {a|A}\'s chance is {7.39|seven point three nine} over the total, {10.11|ten point one one}: about {0.73|zero point seven three}. That is softmax, over just two answers.', code: 'total' },
      ],
    },
    {
      id: 'gap',
      title: 'Only the gap matters',
      codeTitle: 'chance.py',
      code: `
        ea / (ea + eb)       # 0.73      #@total
        1 / (1 + eb / ea)    # same      #@div
        eb / ea   # e^(1 - 2): 0.37      #@minus
        sigmoid(r_a - r_b)   # 0.73: a   #@sig
        sigmoid(r_b - r_a)   # 0.27: b   #@b
        sigmoid(12 - 11)     # 0.73      #@shift
      `,
      beats: [
        { id: 'div', say: 'Divide the top and the bottom of that fraction by {a|A}\'s strength. The top becomes one, and the bottom, one plus b\'s strength over {a|A}\'s.', code: 'div' },
        { id: 'minus', say: 'To divide powers of e, subtract the powers: e to the one, over e squared, is e to minus one, about {0.37|zero point three seven}.', code: 'minus' },
        { id: 'sig', say: 'One over one plus e to minus something is the sigmoid of that something. So {a|A}\'s chance is {σ(r_a − r_b)|sigma of r a minus r b}: the sigmoid of the gap.', code: 'sig' },
        { id: 'b', say: 'And b\'s chance is the sigmoid of the gap taken the other way, {σ(−1)|sigma of minus one}: about {0.27|zero point two seven}, the rest.', code: 'b' },
        { id: 'shift', say: 'Raise both scores by ten. They slide along together, the gap stays one, and the chance holds at {0.73|zero point seven three}.', code: 'shift' },
        { id: 'zero', say: 'As with softmax, only the gaps matter. So a score alone says little: only its gap to another answer for the same prompt means anything.', code: 'shift' },
      ],
    },
    {
      id: 'loss',
      title: 'Learning from a pick',
      codeTitle: 'reward_model.py',
      code: `
        # the labeler picked a           #@w
        r_w, r_l = r_a, r_b   # 2, 1     #@w
        p = sigmoid(r_w - r_l)  # 0.73   #@l
        loss = -np.log(p)       # 0.31   #@loss
        # had b won: -ln 0.27 = 1.31     #@flip
      `,
      beats: [
        { id: 'w', say: 'The reward model learns from many pairs like this one, each with its pick. Call the picked answer\'s score {r_w|r w}, w for winner.', code: 'w' },
        { id: 'l', say: 'The other\'s is {r_l|r l}, l for loser. The model\'s chance for the pick is {σ(r_w − r_l)|sigma of r w minus r l}.', code: 'l' },
        { id: 'ce', say: 'To score that chance against the pick, use cross-entropy: the loss, L, is minus ln of the probability given to the right answer.', code: 'loss' },
        { id: 'a', say: 'The labeler picked {a|A}, which the model gave {0.73|zero point seven three}. Minus ln {0.73|zero point seven three} is about {0.31|zero point three one}: a small loss.', code: 'loss' },
        { id: 'flip', say: 'Had they picked b, the model gave that only {0.27|zero point two seven}, and the loss would be about {1.31|one point three one}.', code: 'flip' },
        { id: 'curve', say: 'Plot the loss against the gap, {r_w − r_l|r w minus r l}. When the pick scores well above the other, the loss is near zero. When the model ranks the pair the wrong way round, it climbs steeply.', code: 'loss' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
