import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-moe',
  title: 'Mixture of experts',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Jacobs, Jordan, Nowlan & Hinton', year: 1991, title: 'Adaptive Mixtures of Local Experts', url: 'https://doi.org/10.1162/neco.1991.3.1.79', scene: 'idea' },
    { who: 'Shazeer, Mirhoseini, Maziarz, Davis, Le, Hinton & Dean', year: 2017, title: 'Outrageously Large Neural Networks: The Sparsely-Gated Mixture-of-Experts Layer', url: 'https://arxiv.org/abs/1701.06538', scene: 'router' },
    { who: 'Lepikhin, Lee, Xu, Chen, Firat, Huang, Krikun, Shazeer & Chen', year: 2020, title: 'GShard: Scaling Giant Models with Conditional Computation and Automatic Sharding', url: 'https://arxiv.org/abs/2006.16668', scene: 'router' },
  ],
  scenes: [
    {
      id: 'idea',
      title: 'Store many, run few',
      codeTitle: 'moe_params.py',
      code: `
        E = 8                  # experts  #@E
        expert = 100_000_000   # each     #@E
        total = E * expert     # 800M     #@total
        k = 2              # run per token #@active
        active = k * expert    # 200M     #@active
      `,
      beats: [
        { id: 'mlp', say: 'In a transformer block, every token goes through the same MLP and uses all of its weights and biases, the numbers training learns, called parameters. A bigger MLP can learn more, but then every token pays for every extra parameter in work.' },
        { id: 'many', say: 'A mixture of experts, {MoE|M O E}, keeps several MLPs side by side instead, and sends each token through only a few of them.' },
        { id: 'name', say: 'Each MLP is called an expert. The name goes back to 1991, when Robert Jacobs, Michael Jordan, Steven Nowlan and Geoffrey Hinton trained separate networks that each learned to handle its own share of the training cases, an expert in its kind of case.' },
        { id: 'E', say: 'Say there are eight experts, each with a hundred million parameters. Call the number of experts E.', code: 'E' },
        { id: 'total', say: 'All of them must be stored, since the next token may need any of them: eight times a hundred million, eight hundred million. That is the total.', code: 'total' },
        { id: 'active', say: 'But a token runs only k of them. With k at two, that is two hundred million, the active count, and it sets the work per token.', code: 'active' },
        { id: 'grow', say: 'Double the number of experts, sixteen instead of eight, and the total doubles while the active count stays put: more parameters, the same work per token.', code: ['total', 'active'] },
      ],
    },
    {
      id: 'router',
      title: 'A router picks the top k',
      codeTitle: 'moe_layer.py',
      code: `
        probs = softmax(x @ W_r)  # router #@router
        top = np.argsort(probs)[-k:]       #@top
        kept = probs[top].sum()   # 0.75   #@kept
        gates = probs[top] / kept          #@gates
        out = 0                            #@sum
        for gt, i in zip(gates, top):      #@sum
            out += gt * experts[i](x)      #@sum
      `,
      beats: [
        { id: 'router', say: 'Which experts does a token run? A router decides: one linear layer and a softmax, giving each expert a probability for this token. With four experts: {0.1|zero point one}, {0.5|zero point five}, {0.15|zero point one five} and {0.25|zero point two five}.', code: 'router' },
        { id: 'top', say: 'Only the k most likely run, the top k. With k at two, that is experts one and three. The other two do no work for this token.', code: 'top' },
        { id: 'gate', say: 'Each expert that runs gets a gate. As in an LSTM, a gate is a number from zero to one that scales how much of a signal passes: here, how much of that expert\'s output counts.', code: 'gates' },
        { id: 'kept', say: 'The gates come from the kept probabilities, rescaled to add up to one. Those add up to {0.5|zero point five} plus {0.25|zero point two five}: {0.75|zero point seven five}.', code: 'kept' },
        { id: 'gates', say: 'Divide each by that total: {0.5|zero point five} over {0.75|zero point seven five} is two thirds, and the other gate is one third.', code: 'gates' },
        { id: 'sum', say: 'The layer\'s output is two thirds of expert one\'s output, plus one third of expert three\'s.', code: 'sum' },
        { id: 'shazeer', say: 'Running only the top few is what keeps it cheap. In 2017, Noam Shazeer and colleagues built such a layer with thousands of experts, between the layers of an LSTM. They called it sparsely gated: for each token, all but a few gates are zero.', code: 'top' },
        { id: 'gshard', say: 'In 2020, Dmitry Lepikhin and colleagues used it in a transformer, in place of the MLP in every other block, with k at two.' },
      ],
    },
    {
      id: 'balance',
      title: 'Keep the load even',
      codeTitle: 'balance.py',
      code: `
        share = counts / counts.sum()      #@share
        # even load: every share is 1 / E  #@even
        extra = 0.01 * balance_loss        #@loss
        loss = task_loss + extra           #@loss
      `,
      beats: [
        { id: 'favor', say: 'One danger. Early in training, the router may happen to favor one expert a little.', code: 'share' },
        { id: 'feed', say: 'That expert gets more tokens, so more gradient, so it improves fastest, and the router favors it even more. Shazeer and colleagues saw exactly this: an imbalance that feeds itself.', code: 'share' },
        { id: 'collapse', say: 'Soon one expert does most of the work. The others sit idle: parameters stored and paid for, barely trained. And since the experts work side by side, the layer waits for its busiest one.' },
        { id: 'fix', say: 'The fix is a small extra loss, added to the model\'s own loss, that is lowest when every expert gets an equal share of the tokens: one over E each. It is kept small, so balance never outweighs doing the task well.', code: ['even', 'loss'] },
      ],
    },
    {
      id: 'model',
      title: 'A whole model',
      codeTitle: 'model_params.py',
      code: `
        layers, E, k = 4, 8, 2             #@layers
        expert = 100_000_000               #@layers
        shared = 500_000_000  # attn, ...  #@shared
        run = layers * k * expert  # 800M  #@run
        active = run + shared   # 1,300M   #@active
        stored = layers * E * expert       #@stored
        total = stored + shared # 3,700M   #@total
      `,
      beats: [
        { id: 'layers', say: 'A whole model stacks many such layers, each with its own experts. Say four layers, each with eight experts of a hundred million, and k still two.', code: 'layers' },
        { id: 'shared', say: 'Everything else, attention, embeddings and the rest, is shared: every token uses it, and it is stored once. Say five hundred million.', code: 'shared' },
        { id: 'run', say: 'One token runs two experts in each of four layers: four times two times a hundred million, eight hundred million.', code: 'run' },
        { id: 'active', say: 'Add the shared five hundred million: {1,300|thirteen hundred} million active.', code: 'active' },
        { id: 'stored', say: 'The model stores all eight experts in every layer: four times eight times a hundred million, {3,200|thirty two hundred} million.', code: 'stored' },
        { id: 'total', say: 'Add the shared five hundred million again: {3,700|thirty seven hundred} million in total.', code: 'total' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
