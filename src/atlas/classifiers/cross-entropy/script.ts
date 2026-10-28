import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-cross-entropy',
  title: 'Cross-entropy',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Shannon', year: 1948, title: 'A mathematical theory of communication', url: 'https://doi.org/10.1002/j.1538-7305.1948.tb01338.x', scene: 'name' },
  ],
  scenes: [
    {
      id: 'cost',
      title: 'What a bad guess should cost',
      codeTitle: 'loss.py',
      code: `
        p = np.array([0.7, 0.2, 0.1])  #@p
        y = 0          # right answer  #@y
        -np.log(1.0)     # 0.00        #@one
        -np.log(0.7)     # 0.36        #@mid
        -np.log(0.1)     # 2.30        #@low
        -np.log(0.001)   # 6.91        #@zero
        L = -np.log(p[y])   # 0.36     #@L
      `,
      beats: [
        { id: 'guess', say: 'Softmax turns scores into a guess: one probability for each option. Here, three options get {0.7|zero point seven}, {0.2|zero point two} and {0.1|zero point one}.', code: 'p' },
        { id: 'loss', say: 'Then the right answer is revealed, and we want one number for how bad the guess was. It is called the loss: zero for a perfect guess, and bigger the worse it was.', code: 'L' },
        { id: 'y', say: 'Say the right answer, y, is option zero. The guess gave it {0.7|zero point seven}, a lot, so the loss should be small.', code: 'y' },
        { id: 'more', say: 'Had option two been right, with only {0.1|zero point one}, the loss should be bigger. And a guess sure of a wrong option, giving the truth almost nothing, should cost the most of all.', code: 'y' },
        { id: 'axes', say: 'So draw the loss we want against {p_y|p y}, the probability the guess gave the right answer: no loss at one, and no limit as it falls toward zero.', code: 'L' },
        { id: 'curve', say: 'Minus the natural log, {−ln\u00a0p|minus ln p}, draws exactly that curve.', code: 'L' },
        { id: 'one', say: 'At one, ln one is zero, so a sure, right guess costs nothing. Below one, every log is negative, and the minus sign turns it into a positive cost.', code: 'one' },
        { id: 'mid', say: 'Our guess put {0.7|zero point seven} on the truth. {→|The arrow} reads “goes to”: {0.7|zero point seven} goes to a loss of about {0.36|zero point three six}.', code: 'mid' },
        { id: 'low', say: 'Put {0.1|zero point one} on it, and the loss is about {2.30|two point three zero}.', code: 'low' },
        { id: 'zero', say: 'As {p_y|p y} falls toward zero, the loss climbs without limit, toward {∞|infinity}: a sure, wrong guess costs the most.', code: 'zero' },
        { id: 'L', say: 'So the loss, L, is minus ln {p_y|p y}: minus the log of the probability on the right answer.', code: 'L' },
      ],
    },
    {
      id: 'name',
      title: 'Surprise, and the name',
      codeTitle: 'surprise.py',
      code: `
        -np.log(p)  # [0.36, 1.61, 2.30]   #@sup
        (p * -np.log(p)).sum()   # 0.80    #@H
        truth = np.array([1, 0, 0])        #@t
        (truth * -np.log(p)).sum() # 0.36  #@cross
      `,
      beats: [
        { id: 'surprise', say: 'Minus ln p has a simpler reading: surprise. Something you were sure of cannot surprise you, and something you gave only a tenth surprises you a lot.', code: 'sup' },
        { id: 'shannon', say: 'In 1948, Claude Shannon\'s paper, A Mathematical Theory of Communication, measured how uncertain a set of probabilities is.', code: 'H' },
        { id: 'entropy', say: 'His measure adds up each outcome\'s surprise, weighted by its own probability: an average surprise. He called it entropy, after the same formula in physics.', code: 'H' },
        { id: 'cross', say: 'Cross-entropy crosses two sets of probabilities: the surprise comes from the guess, but the weights come from the truth.', code: 't' },
        { id: 'only', say: 'The truth puts all its weight on the right answer, so only that surprise counts: our loss, minus ln {p_y|p y}.', code: 'cross' },
      ],
    },
    {
      id: 'scores',
      title: 'Straight from the scores',
      codeTitle: 'from_scores.py',
      code: `
        s = np.array([2, 1, -1])   # y = 0  #@s
        T = np.exp(s).sum()      # 10.48    #@T
        p_y = np.exp(s[y]) / T   # e**2 / T #@py
        np.log(p_y)       # 2 - ln T        #@quot
        L = -np.log(p_y)  # 2.35 - 2 = 0.35 #@flip
        L = np.log(T) - s[y]     # the same #@L
      `,
      beats: [
        { id: 's', say: 'Often you start from the scores instead: two, one and minus one, with option zero right. Softmax adds up e to each score: the total, T, is {10.48|ten point four eight}.', code: ['s', 'T'] },
        { id: 'py', say: 'The right option\'s probability is e to its score, over the total: e squared, over T.', code: 'py' },
        { id: 'quot', say: 'The log of a quotient, a top divided by a bottom, is the log of the top minus the log of the bottom.', code: 'quot' },
        { id: 'undo', say: 'ln undoes e to a power, so the log of the top, e squared, is just two: the right option\'s score.', code: 'quot' },
        { id: 'flip', say: 'The loss is minus that log, which flips the subtraction: {ln T|the log of T}, about {2.35|two point three five}, minus two, is {0.35|zero point three five}.', code: 'flip' },
        { id: 'rule', say: 'Any scores go the same way: the loss is {ln T|the log of T}, minus the right option\'s score, {s_y|s y}.', code: 'L' },
      ],
    },
    {
      id: 'uniform',
      title: 'Equal scores',
      codeTitle: 'equal.py',
      code: `
        C = 10                              #@init
        p = np.full(C, 1 / C)   # 0.1 each  #@init
        -np.log(1 / C)    # ln 10 = 2.30    #@recip
        # any C: L = ln C                   #@logC
        np.log(8)         # 3 ln 2 = 2.08   #@eight
      `,
      beats: [
        { id: 'init', say: 'When all the scores are equal, every option gets the same share: with C options, one over C. Ten options get a tenth each.', code: 'init' },
        { id: 'recip', say: 'So the loss is minus ln of a tenth. One over a number flips the sign of its log, so that is ln ten: about {2.30|two point three zero}.', code: 'recip' },
        { id: 'logC', say: 'For any C, equal scores give a loss of ln C, whichever option is right.', code: 'logC' },
        { id: 'even', say: 'That is also Shannon\'s entropy for an even split, the largest any C outcomes can have: the most uncertain guess there is.', code: 'logC' },
        { id: 'eight', say: 'With eight options, write eight as two cubed, and the power comes out in front: ln eight is three ln two.', code: 'eight' },
        { id: 'eight2', say: 'That is three times {0.693|zero point six nine three}: about {2.08|two point zero eight}.', code: 'eight' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
