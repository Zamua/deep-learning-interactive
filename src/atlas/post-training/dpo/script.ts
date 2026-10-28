import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-dpo',
  title: 'Direct preference optimization',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Rafailov, Sharma, Mitchell, Ermon, Manning & Finn', year: 2023, title: 'Direct Preference Optimization: Your Language Model is Secretly a Reward Model', url: 'https://arxiv.org/abs/2305.18290', scene: 'route' },
  ],
  scenes: [
    {
      id: 'route',
      title: 'Two trainings and a loop',
      codeTitle: 'route.py',
      code: `
        # 1: fit a reward model, rm,     #@rm
        #    to the preference pairs     #@rm
        # 2: loop: sample y from pi,     #@loop
        #    score it with rm,           #@loop
        R = r - beta * kl  # its reward  #@loop
        #    policy gradient step on R   #@loop
        # DPO: pi on the pairs directly  #@dpo
      `,
      beats: [
        { id: 'rm', say: 'Teaching a model from people\'s picks has so far taken two trainings. First, fit a reward model to the preference pairs.', code: 'rm' },
        { id: 'loop', say: 'Then, in a loop, sample an answer, score it, subtract the {KL|K L} penalty, Kullback and Leibler\'s charge for drifting from the reference, and take a policy gradient step.', code: 'loop' },
        { id: 'cost', say: 'That is a lot of machinery: a second model to train, and a loop that keeps sampling and scoring new answers.', code: ['rm', 'loop'] },
        { id: 'dpo', say: 'In {2023|twenty twenty three}, Rafael Rafailov, Archit Sharma, Eric Mitchell and colleagues at Stanford cut out the middle. Their method trains on the pairs directly: direct preference optimization, {DPO|D P O}.', code: 'dpo' },
        { id: 'title', say: 'Their paper\'s title says how: your language model is secretly a reward model.', code: 'dpo' },
      ],
    },
    {
      id: 'settle',
      title: 'Where the penalty settles',
      codeTitle: 'settle.py',
      code: `
        r = np.array([2, 1])  # rewards  #@r
        p_ref = np.array([.5, .5])       #@ref
        beta = 1                         #@ref
        p = np.array([{{p:.5, .5}}])     #@p
        ch = beta * np.log(p / p_ref)    #@ch
        # ch: {{ch:0, 0}}                #@ch
        r - ch     # {{net:2, 1}}        #@net
      `,
      beats: [
        { id: 'charge', say: 'Start from the {KL|K L} penalty\'s charge for one answer: {β|beta} times its log-ratio, summed over its tokens. The more the model favors an answer over the reference, the more it pays.', code: 'ch' },
        { id: 'two', say: 'Take two answers to one prompt. The reference gives each a half. The reward is two for the first answer and one for the second, and {β|beta} is one.', code: ['r', 'ref'] },
        { id: 'shift', say: 'Train on reward minus charge. The model shifts toward the first answer, which pays more, and as it does, that answer\'s charge rises.', code: ['p', 'ch'] },
        { id: 'level', say: 'It stops when reward minus charge is the same for both answers: if one still paid more, moving probability to it would gain.', code: 'net' },
        { id: 'nums', say: 'Here, that happens at about {0.73|zero point seven three} and {0.27|zero point two seven}. The charges are about {0.38|zero point three eight}, and minus {0.62|zero point six two}.', code: ['p', 'ch'] },
        { id: 'net', say: 'For the first answer, reward minus charge is two minus {0.38|zero point three eight}: {1.62|one point six two}.', code: 'net' },
        { id: 'net2', say: 'For the second, it is one plus {0.62|zero point six two}: {1.62|one point six two} again. Level.', code: 'net' },
        { id: 'flip', say: 'Turn that around. Each reward is its answer\'s charge, plus one number shared by both answers.', code: ['ch', 'net'] },
        { id: 'gap', say: 'And a shared number is what a pick never sees: as with the reward model, only the gap matters. The charges are one apart, just as the rewards are.', code: 'ch' },
        { id: 'secret', say: 'So, as far as any pick can tell, {β|beta} times the log-ratio is the reward. That is the secret in the title.', code: 'ch' },
        { id: 'rhat', say: 'It is called the implicit reward, {r̂|r hat}: the hat marks a reward that is implied, with no reward model behind it.', code: 'ch' },
      ],
    },
    {
      id: 'pairs',
      title: 'Reward-model loss, on the model',
      codeTitle: 'dpo.py',
      code: `
        lp, lp_ref = -12.0, -15.0        #@lp
        r_hat = beta * (lp - lp_ref)     #@imp
        # beta = 0.1: 0.1 * 3 = 0.3      #@imp
        lr_w, lr_l = 3.0, -1.0           #@pair
        margin = beta * (lr_w - lr_l)    #@m
        loss = -np.log(sigmoid(margin))  #@loss
        # sigmoid(0.4) = 0.60: 0.51      #@loss
      `,
      beats: [
        { id: 'back', say: '{DPO|D P O} runs this backwards. It never trains a reward model: it trains the model until its own implicit reward predicts the labelers\' picks.' },
        { id: 'lp', say: 'First, one answer. A whole answer\'s log-probability is its tokens\', added up. Say the model gives an answer a log-probability of minus twelve, and the reference, minus fifteen.', code: 'lp' },
        { id: 'imp', say: 'The log-ratio is the difference: three. With {β|beta} at {0.1|zero point one}, the implicit reward is {0.3|zero point three}.', code: 'imp' },
        { id: 'pair', say: 'Now a pair: the chosen answer, {y_w|y w}, w for winner, and the rejected one, {y_l|y l}, l for loser. Their log-ratios are three and minus one.', code: 'pair' },
        { id: 'loss', say: 'Put their implicit rewards into the reward model\'s loss: minus ln sigma of the winner\'s reward minus the loser\'s.', code: 'loss' },
        { id: 'm', say: 'The log-ratios are four apart, and {β|beta} times that gap, {0.4|zero point four}, is called the margin: how far the chosen answer leads.', code: 'm' },
        { id: 'val', say: '{σ(0.4)|Sigma of zero point four} is about {0.60|zero point six}, and minus its log is about {0.51|zero point five one}.', code: 'loss' },
      ],
    },
    {
      id: 'moves',
      title: 'What a step moves',
      codeTitle: 'dpo.py',
      code: `
        lr_w = lp_w - lp_ref_w  # rises  #@w
        lr_l = lp_l - lp_ref_l  # falls  #@l
        # lp_ref_w, lp_ref_l: frozen     #@ref
        # needs: pairs, pi, frozen pi_ref #@needs
      `,
      beats: [
        { id: 'step', say: 'Each step that lowers the loss widens the margin: the chosen answer grows more likely, relative to the reference, and the rejected one less likely.', code: ['w', 'l'] },
        { id: 'ref', say: 'The reference never moves. It is frozen, and every log-ratio is measured against it.', code: 'ref' },
        { id: 'wrong', say: 'As with the reward model, the push is biggest on pairs the model ranks the wrong way round.', code: ['w', 'l'] },
        { id: 'needs', say: 'So all it needs is the pairs, the model being trained, and a frozen reference: no reward model, and no sampling.', code: 'needs' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
