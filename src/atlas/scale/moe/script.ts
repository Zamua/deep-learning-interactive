import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-moe',
  title: 'Mixture of experts',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'router',
      title: 'A router picks k of E experts',
      codeTitle: 'moe_layer.py',
      code: `
        probs = softmax(x @ W_r)       # (E,) router  #@router
        top = np.argsort(probs)[-k:]   # k best       #@top
        gates = probs[top] / probs[top].sum()         #@gates
        out = sum(gt * experts[i](x)                  #@sum
                  for gt, i in zip(gates, top))       #@sum
      `,
      beats: [
        { id: 'swap', say: 'In a transformer block, every token runs through the same MLP. A mixture of experts, or {MoE|M O E}, keeps several MLPs instead, called experts. Call their number E: here, four.' },
        { id: 'router', say: 'A router, one small linear layer and a softmax, gives each expert a probability for the current token: {0.1|zero point one}, {0.5|zero point five}, {0.15|zero point one five} and {0.25|zero point two five}.', code: 'router' },
        { id: 'top', say: 'Only the k most likely experts run, the top k. With k at two, that is experts one and three. The other two do no work for this token.', code: 'top' },
        { id: 'gates', say: 'Their probabilities add up to {0.75|zero point seven five}. Divide each by that total, and the gates become two thirds and one third, adding up to one again.', code: 'gates' },
        { id: 'sum', say: 'The layer\'s output is two thirds of expert one\'s output, plus one third of expert three\'s.', code: 'sum' },
      ],
    },
    {
      id: 'balance',
      title: 'Keep the load even',
      codeTitle: 'balance.py',
      code: `
        share = counts / counts.sum()  # per expert  #@share
        # even load: every share is 1 / E            #@even
        loss = task_loss + 0.01 * balance_loss       #@loss
      `,
      beats: [
        { id: 'favor', say: 'One danger. Early in training, the router may happen to favor one expert.', code: 'share' },
        { id: 'feed', say: 'That expert gets more tokens, so more gradient, so it improves fastest, and the router favors it even more.', code: 'share' },
        { id: 'collapse', say: 'Soon one expert does most of the work. The others sit idle: parameters stored and paid for, barely trained. And the busy one makes the whole layer wait.' },
        { id: 'fix', say: 'The fix is a small extra loss that is lowest when every expert gets an equal share of the tokens: one over E each.', code: ['even', 'loss'] },
      ],
    },
    {
      id: 'params',
      title: 'Total versus active',
      codeTitle: 'moe_params.py',
      code: `
        E, k = 8, 2                                #@ek
        expert = 100_000_000   # one expert's size  #@ek
        total = E * expert     # 800M, all stored  #@total
        active = k * expert    # 200M per token    #@active
      `,
      beats: [
        { id: 'count', say: 'Now count parameters. Say a layer has eight experts of a hundred million parameters each, and k is two.', code: 'ek' },
        { id: 'total', say: 'All eight must be stored, since the next token might need any of them: eight hundred million. That is the total.', code: 'total' },
        { id: 'active', say: 'But one token runs only two of them: two hundred million. That is the active count, and it sets the compute per token.', code: 'active' },
        { id: 'grow', say: 'Double the experts to sixteen, and the total doubles while the active count stays put. The model can store more, at the same work per token.', code: ['total', 'active'] },
      ],
    },
    {
      id: 'model',
      title: 'A whole model',
      codeTitle: 'model_params.py',
      code: `
        layers, E, k = 4, 8, 2                     #@layers
        expert = 100_000_000                       #@layers
        shared = 500_000_000   # attention, ...    #@shared
        active = layers * k * expert + shared  # 1,300M  #@active
        total = layers * E * expert + shared   # 3,700M  #@total
      `,
      beats: [
        { id: 'layers', say: 'A whole model stacks many such layers, each with its own experts. Say four layers, each with eight experts of a hundred million, and k still two.', code: 'layers' },
        { id: 'shared', say: 'Everything else, attention, embeddings and the rest, is shared: every token uses it, and it is stored once. Say five hundred million.', code: 'shared' },
        { id: 'active', say: 'One token runs two experts in each of four layers: four times two times a hundred million, eight hundred million. Add the shared five hundred: {1,300|thirteen hundred} million active.', code: 'active' },
        { id: 'total', say: 'The model stores all eight in every layer: four times eight times a hundred million, {3,200|thirty two hundred} million. Plus the shared five hundred: {3,700|thirty seven hundred} million in total.', code: 'total' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
