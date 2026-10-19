import type { LectureScript } from '../../lecture/types';

export const script: LectureScript = {
  id: 'moe',
  title: 'Mixture of experts',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'intro',
      title: 'More parameters, same cost',
      codeTitle: 'the_idea.py',
      code: `
        # dense: every weight, every token   #@dense
        y = ffn(x)                           #@dense

        # mixture of experts                 #@moe
        experts = [FFN() for _ in range(E)]  #@moe
        probs = softmax(x @ W_r)  # router   #@router
        top = np.argsort(probs)[-k:]         #@router
        y = sum(gates[j] * experts[i](x)     #@combine
                for j, i in enumerate(top))  #@combine
      `,
      beats: [
        { id: 'hello', say: 'This lecture is about mixtures of experts: how to give a model far more parameters without making each token any more expensive.' },
        { id: 'dense', say: 'In a dense transformer, every parameter works on every token.', code: 'dense' },
        { id: 'price', say: 'So the size of a model and its price are welded together: double the parameters, and every token costs twice as much.', code: 'dense' },
        { id: 'ffn', say: 'Two thirds of each block sits in one place: the feed-forward network, or {FFN|F F N}, which works on each token alone.', code: 'dense' },
        { id: 'copies', say: 'A mixture of experts makes many copies of that block, called experts, each with its own weights.', code: 'moe' },
        { id: 'router', say: 'And it adds a tiny router, which looks at each token and picks just a few experts to run.', code: 'router' },
        { id: 'active', say: 'The layer now holds eight times the parameters, but each token pays for only two of the eight.', code: 'combine' },
        { id: 'mixtral', say: '{Mixtral 8x7B|Mixtral eight by seven B}, for example, stores about {47|forty seven} billion parameters, and runs about {13|thirteen} billion for each token.' },
        { id: 'catch', say: 'The catch is sharing. Left alone, a router sends almost everything to a few favorite experts.' },
        { id: 'plan', say: 'So after the layer itself, the story is about balance: a loss, fixed buffers, smarter experts, and bias terms. And then, how experts spread across many {GPUs|G P Us}.' },
      ],
    },
    {
      id: 'layer',
      title: 'The layer: a router and E experts',
      codeTitle: 'moe_layer.py',
      code: `
        def moe_layer(x):        # one token  #@def
            logits = x @ W_r     # (E,)       #@logits
            probs = softmax(logits)           #@probs
            top = np.argsort(probs)[-k:]      #@top
            gates = probs[top] / probs[top].sum()  #@gates
            return sum(g * experts[i](x)      #@sum
                for g, i in zip(gates, top))  #@sum

        x = x + moe_layer(x)     # residual   #@res
      `,
      beats: [
        { id: 'token', say: 'Follow one token through the layer. It arrives as a vector, x, of d numbers.', code: 'def' },
        { id: 'logits', say: 'The router is a single matrix, {W_r|W r}, with one column per expert. Multiplying by it gives one score per expert: the logits.', code: 'logits' },
        { id: 'softmax', say: 'A softmax turns those scores into probabilities, p, that add up to one.', code: 'probs' },
        { id: 'topk', say: 'Then {top-k|top k}: keep the k largest, here two, and drop the rest. The dropped experts never run for this token.', code: 'top' },
        { id: 'gates', say: 'The two kept probabilities become the gates, g: how much each chosen expert counts.', code: 'gates' },
        { id: 'run', say: 'Only the two chosen experts run. Each one is an ordinary feed-forward block, with its own weights.', code: 'sum' },
        { id: 'sum', say: 'Their outputs are added up, each one weighted by its gate.', code: 'sum' },
        { id: 'residual', say: 'And the result joins the residual stream, exactly where a dense {FFN|F F N} output would go.', code: 'res' },
        { id: 'cost', say: 'So the compute depends on k, not on E. Add more experts, and each token still costs the same.', code: ['top', 'sum'] },
        { id: 'every', say: '{GShard|G shard} replaced every other feed-forward layer this way. Mixtral replaces all of them.' },
      ],
    },
    {
      id: 'router',
      title: 'The router: softmax, then top-k',
      codeTitle: 'route_one.py',
      code: `
        logits = x @ W_r        # (8,)       #@logits
        probs = np.exp(logits - logits.max())  #@soft
        probs /= probs.sum()    # softmax    #@soft
        top = np.argsort(probs)[::-1][:k]    #@top
        gates = probs[top]      # [.37, .32] #@raw
        gates /= gates.sum()    # [.54, .46] #@renorm
        # = softmax(logits[top])             #@same
      `,
      beats: [
        { id: 'classifier', say: 'Look closer at the router. It is the linear classifier from the start of {CS231n|C S two thirty one N}, with experts in place of classes.' },
        { id: 'arrows', say: 'Each column of {W_r|W r} is an arrow in token space. A token\'s logit for an expert is how well it lines up with that arrow.', code: 'logits' },
        { id: 'regions', say: 'So the router carves the space into regions, one per expert, with straight borders.', code: 'logits' },
        { id: 'probs', say: 'This token lands between experts one and zero: probabilities of {0.37|zero point three seven} and {0.32|zero point three two}, and small ones for the rest.', code: 'soft' },
        { id: 'topk', say: 'Keep the top two. Their probabilities add up to only {0.70|zero point seven}.', code: ['top', 'raw'] },
        { id: 'renorm', say: 'Many designs renormalize: divide by that sum, and the gates become {0.54|zero point five four} and {0.46|zero point four six}, adding up to one.', code: 'renorm' },
        { id: 'same', say: 'That is exactly a softmax over the kept logits alone, which is how Mixtral writes its router.', code: 'same' },
        { id: 'switch', say: 'Not every design does this. With top one, a renormalized gate would always be exactly one, and the router would get no signal from the task.', code: 'raw' },
        { id: 'switch2', say: 'So the Switch Transformer keeps the raw probability, and scales the chosen expert\'s output by it.', code: 'raw' },
        { id: 'learn', say: 'Nobody labels which expert a token should use. The router learns only through its gates: if a bigger gate would have lowered the loss, the border moves.' },
      ],
    },
    {
      id: 'params',
      title: 'Total versus active parameters',
      codeTitle: 'mixtral_params.py',
      code: `
        d, d_ff, L, V = 4096, 14336, 32, 32000
        expert = 3 * d * d_ff       # 176M   #@expert
        attn = 2*d*d + 2*d*1024     # 42M    #@attn
        shared = L * attn + 2 * V * d        #@shared
        total = shared + L * 8 * expert      #@total
        active = shared + L * 2 * expert     #@active
        # total 46.7B, active 12.9B          #@result
      `,
      beats: [
        { id: 'two', say: 'An expert model has two parameter counts, and both of them matter.' },
        { id: 'total', say: 'Total parameters are everything stored: every expert in every layer. They set the memory, and the room for knowledge.', code: 'total' },
        { id: 'active', say: 'Active parameters are the ones a token actually runs through: the shared parts, plus k experts per layer. They set the compute.', code: 'active' },
        { id: 'name', say: 'Take {Mixtral 8x7B|Mixtral eight by seven B}. The name suggests eight times seven, or {56|fifty six} billion.' },
        { id: 'shared', say: 'But only the feed-forward blocks are copied. Attention and the embeddings are shared: about {1.6|one point six} billion parameters.', code: ['attn', 'shared'] },
        { id: 'expert', say: 'Each expert is three matrices, four thousand by fourteen thousand: {176|a hundred and seventy six} million numbers, in each of {32|thirty two} layers.', code: 'expert' },
        { id: 'sum', say: 'Eight experts per layer gives {46.7|forty six point seven} billion in total. Two per token gives {12.9|twelve point nine} billion active.', code: ['total', 'active', 'result'] },
        { id: 'price', say: 'So Mixtral needs the memory of a {47B|forty seven billion} parameter model, and spends the compute of a {13B|thirteen billion} one.', code: 'result' },
        { id: 'sixnd', say: 'In the scaling law\'s six N D, the N is the active count.', code: 'active' },
        { id: 'batch', say: 'One warning. A single token reads two experts per layer, but a batch of sixteen tokens touches nearly all eight.' },
        { id: 'memory', say: 'So every expert must sit in memory, and with big batches, every one of them is read at every step.' },
      ],
    },
    {
      id: 'collapse',
      title: 'Who gets the tokens',
      codeTitle: 'train_router.py',
      code: `
        for step in range(2000):
            probs = (X @ W_r + b_r).softmax(-1)  #@route
            choice = probs.argmax(-1)  # top-1   #@route
            y = probs[range(N), choice] * out    #@gate
            loss = ((y - t) ** 2).mean()         #@loss
            loss.backward(); opt.step()          #@step
        # step {{step:0}}, load {{load:...}}
      `,
      beats: [
        { id: 'free', say: 'So far, the router may do whatever it likes. Two things go wrong.' },
        { id: 'hardware', say: 'First, hardware. Experts usually live on different {GPUs|G P Us}, and if one expert gets half the batch, its {GPU|G P U} works while the others wait.' },
        { id: 'pace', say: 'The whole layer runs at the speed of its busiest expert.' },
        { id: 'feeds', say: 'Second, and worse, imbalance feeds itself. An expert that gets more tokens gets more gradient, so it improves faster...' },
        { id: 'more', say: 'and the router, which learns to prefer whatever lowers the loss, sends it even more.' },
        { id: 'toy', say: 'Here is a real run: two hundred and forty tokens of two numbers each, four linear experts, and a {top-1|top one} router.', code: 'route' },
        { id: 'task', say: 'Each token carries a target, shaped like a square funnel with four flat faces. One linear expert can fit only one face.', code: 'loss' },
        { id: 'start', say: 'The tokens share an offset, the way real token vectors share directions. So from the start, blue wins most of them.', code: 'gate' },
        { id: 'run', say: 'Train with no balancing. Blue takes the rest. The other three experts receive nothing, and never learn.', code: 'step' },
        { id: 'collapse', say: 'That is expert collapse. One expert does all the work, and the model has paid for parameters it never uses.' },
        { id: 'shazeer', say: 'Shazeer and his colleagues described exactly this self-reinforcing loop in {2017|twenty seventeen}.' },
      ],
    },
    {
      id: 'auxloss',
      title: 'The load-balancing loss',
      codeTitle: 'switch_aux_loss.py',
      code: `
        choice = probs.argmax(axis=1)   # (T,)  #@choice
        f = np.bincount(choice, minlength=E) / T  #@f
        P = probs.mean(axis=0)          # (E,)  #@P
        aux_loss = E * np.sum(f * P)            #@loss
        loss = task_loss + alpha * aux_loss     #@total
      `,
      beats: [
        { id: 'fix', say: 'The fix that made experts practical is a small extra loss, lowest when the load is even.' },
        { id: 'f', say: 'For each expert, measure {f_i|f i}: the share of the batch\'s tokens actually sent to it.', code: ['choice', 'f'] },
        { id: 'P', say: 'And {P_i|capital P i}: the average probability the router gave it, over the same tokens.', code: 'P' },
        { id: 'loss', say: 'The Switch Transformer multiplies the two, adds them up over the experts, and multiplies by E, the number of experts.', code: 'loss' },
        { id: 'one', say: 'When the load is even, every f and every P is one over E, and the loss is exactly one.', code: 'loss' },
        { id: 'E', say: 'When every token goes to one expert with full confidence, the loss is E: four, here.', code: 'loss' },
        { id: 'grad', say: 'Why two factors? The share f comes from an argmax, a count. Nudge the router a little, and no count changes, so f has no gradient.', code: 'f' },
        { id: 'P2', say: 'P is a smooth average of softmax outputs, so it does. The loss uses f as a weight, and moves P.', code: 'P' },
        { id: 'push', say: 'The gradient on each P is proportional to its f, so the busiest expert\'s probability is pushed down hardest.' },
        { id: 'alpha', say: 'A small coefficient, alpha, {0.01|zero point zero one} in the Switch paper, keeps balance from outweighing the task.', code: 'total' },
      ],
    },
    {
      id: 'balance',
      title: 'Balance, switched on',
      codeTitle: 'train_router.py',
      code: `
        alpha = 0.1          # it was 0     #@alpha
        for step in range(2000):
            ...                             #@route
            f = choice.bincount(minlength=E) / N  #@aux
            P = probs.mean(0)                     #@aux
            aux_loss = E * (f * P).sum()          #@aux
            loss = task + alpha * aux_loss        #@loss
            loss.backward(); opt.step()           #@step
        # step {{step:0}}, task {{task:...}}
      `,
      beats: [
        { id: 'resume', say: 'Back to the collapsed run. Keep the weights exactly as they are, and switch the loss on.', code: 'alpha' },
        { id: 'borders', say: 'The router\'s borders start to move. Tokens at the edge of blue\'s region are pushed toward the idle experts.', code: ['aux', 'loss'] },
        { id: 'train', say: 'Now those experts receive tokens, so at last they get gradient, and they start to fit their part of the funnel.', code: 'step' },
        { id: 'quarter', say: 'Within a few hundred steps, every expert has about a quarter of the tokens.' },
        { id: 'faces', say: 'And the regions line up with the four faces of the target.' },
        { id: 'better', say: 'The task loss falls by a factor of about twenty. Balance was not only for the hardware: it is what put the idle parameters to work.', code: 'loss' },
        { id: 'weak', say: 'Too small an alpha, like {0.001|zero point zero zero one} in this toy, is not enough to pull the router out.', code: 'alpha' },
        { id: 'zloss', say: 'Two more habits came later. {ST-MoE|S T M o E} added a router z loss: a small penalty on large router logits, which keeps training stable.' },
        { id: 'precision', say: 'And routers are usually computed in full {32-bit|thirty two bit} precision, even when the rest of the model runs in {bf16|B F sixteen}.' },
      ],
    },
    {
      id: 'capacity',
      title: 'Capacity and dropped tokens',
      codeTitle: 'dispatch.py',
      code: `
        C = int(np.ceil(cf * k * T / E))     #@cap
        onehot = np.eye(E)[choice]  # (T, E) #@onehot
        pos = np.cumsum(onehot, axis=0) * onehot  #@pos
        keep = (pos > 0) & (pos <= C)        #@keep
        dropped = T - keep.sum()             #@drop
        # cf = {{cf:1.25}}, C = {{C:10}}, dropped {{dropped:0}}
      `,
      beats: [
        { id: 'shapes', say: 'Accelerators like arrays whose shapes are known in advance.' },
        { id: 'buffer', say: 'So the classic implementation gives each expert a buffer of fixed size, its capacity, C, before it sees the batch.', code: 'cap' },
        { id: 'factor', say: 'C is the even share, k times T over E, times a capacity factor: say, {1.25|one point two five}.', code: 'cap' },
        { id: 'line', say: 'Tokens claim slots in arrival order. A running count down the batch gives each token its place in its expert\'s line.', code: ['onehot', 'pos'] },
        { id: 'full', say: 'A token whose expert is already full is dropped.', code: 'keep' },
        { id: 'residual', say: 'It skips the experts entirely, and passes to the next layer unchanged, through the residual connection.', code: 'drop' },
        { id: 'fluct', say: 'Even with perfectly fair odds, random fluctuations overfill some buffer at a factor of one.', code: 'keep' },
        { id: 'tradeoff', say: 'Raise the factor and the drops vanish, but every empty slot is compute and memory reserved for nothing.', code: 'cap' },
        { id: 'skew', say: 'And with a skewed router, no reasonable factor saves you. Balance has to come first.', code: 'drop' },
        { id: 'dropless', say: 'Later systems stopped dropping. {MegaBlocks|Mega blocks} handles any number of tokens per expert with block sparse kernels, and {DeepSeek-V3|DeepSeek V three} reports dropping no tokens at all.' },
      ],
    },
    {
      id: 'deepseek',
      title: 'Fine-grained and shared experts',
      codeTitle: 'deepseekmoe.py',
      code: `
        from math import comb
        comb(16, 2)   # 120                 #@coarse
        comb(64, 8)   # 4,426,165,368       #@fine

        y = sum(ffn(x) for ffn in shared)   #@shared
        y += sum(g * routed[i](x)           #@routed
                 for g, i in zip(gates, top))  #@routed
      `,
      beats: [
        { id: 'what', say: '{DeepSeekMoE|DeepSeek M o E}, in {2024|twenty twenty four}, asked what an expert should be.' },
        { id: 'big', say: 'With sixteen big experts and top two routing, each expert covers a lot of ground, so common knowledge gets copied into several of them.' },
        { id: 'split', say: 'The first change: split every expert into four narrower ones, and route each token to four times as many.' },
        { id: 'same', say: 'The parameters stay the same, and so does the compute per token.' },
        { id: 'combos', say: 'But the number of possible teams explodes: from {120|a hundred and twenty} ways to pick two experts out of sixteen...', code: 'coarse' },
        { id: 'billions', say: 'to over four billion ways to pick eight out of sixty four.', code: 'fine' },
        { id: 'special', say: 'With that many combinations, each expert can afford to specialize narrowly.' },
        { id: 'shared', say: 'The second change: shared experts. A few experts run on every token, with no routing at all.', code: 'shared' },
        { id: 'why', say: 'They hold what every token needs, so the routed experts need not each relearn it. Each token is routed to one fewer expert, so the compute stays fixed.', code: 'routed' },
        { id: 'v3', say: '{DeepSeek-V3|DeepSeek V three} uses one shared expert and {256|two hundred and fifty six} routed ones, eight per token: {671|six hundred and seventy one} billion parameters in total, {37|thirty seven} billion active.' },
      ],
    },
    {
      id: 'bias',
      title: 'Balancing with a bias',
      codeTitle: 'loss_free_balancing.py',
      code: `
        s = sigmoid(x @ W_r)             # scores  #@score
        top = np.argsort(s + bias)[-k:]  # choose  #@choose
        gates = s[top] / s[top].sum()    # weigh   #@weigh
        # after each step, c = tokens per expert
        bias += gamma * np.sign(c.mean() - c)      #@update
      `,
      beats: [
        { id: 'compromise', say: 'An auxiliary loss is a compromise. Its gradient lands in the same weights as the task\'s, and a strong one can cost some quality.' },
        { id: 'v3', say: '{DeepSeek-V3|DeepSeek V three} balances without a loss.', code: 'score' },
        { id: 'bias', say: 'Each expert gets a bias, b, that is added to its score only when choosing the top k.', code: 'choose' },
        { id: 'weigh', say: 'The gates still use the unbiased score, and no gradient ever reaches the biases.', code: 'weigh' },
        { id: 'update', say: 'After every step, an overloaded expert\'s bias goes down by a small fixed amount, gamma, and an underloaded expert\'s bias goes up.', code: 'update' },
        { id: 'price', say: 'It works like a price. A popular expert gets slightly more expensive, so tokens near its border move to a neighbor.', code: 'update' },
        { id: 'toy', say: 'Here is the collapsed toy again, with alpha at zero, and the biases switched on.', code: 'choose' },
        { id: 'even', say: 'The idle experts\' biases climb, and the load evens out, without touching the task gradient.', code: 'update' },
        { id: 'safety', say: '{DeepSeek-V3|DeepSeek V three} still keeps a tiny balance loss as a safety net, but the biases do the work.' },
      ],
    },
    {
      id: 'parallel',
      title: 'Expert parallelism and all-to-all',
      codeTitle: 'expert_parallel.py',
      code: `
        # every GPU at once; GPU g holds 2g, 2g+1
        expert = probs.argmax(-1)            #@route
        order = expert.argsort()             #@route
        recv = all_to_all(x[order], counts)  #@dispatch
        out = local_experts(recv)            #@compute
        back = all_to_all(out, counts)       #@combine
        y = torch.empty_like(back)           #@combine
        y[order] = back                      #@combine
        x = x + gate * y                     #@residual
      `,
      beats: [
        { id: 'big', say: 'A model with hundreds of billions of parameters does not fit on one {GPU|G P U}.' },
        { id: 'ep', say: 'Expert parallelism is the natural split: put different experts on different {GPUs|G P Us}. Here, four of them, with two experts each.' },
        { id: 'tokens', say: 'Each {GPU|G P U} runs attention on its own slice of the batch. At an expert layer, the router picks a destination for every token.', code: 'route' },
        { id: 'dispatch', say: 'Then comes an {all-to-all|all to all}: every {GPU|G P U} sends a different packet to every other one, so each token lands where its expert lives.', code: 'dispatch' },
        { id: 'compute', say: 'The experts run on whatever arrived.', code: 'compute' },
        { id: 'combine', say: 'A second {all-to-all|all to all} sends each result back home, where it is scaled by its gate and added to the residual stream.', code: ['combine', 'residual'] },
        { id: 'traffic', say: 'That is two trips per token per layer, each carrying its full vector: for four thousand tokens at Mixtral\'s width, about a hundred megabytes per {GPU|G P U}, per layer.' },
        { id: 'skew', say: 'And here balance shows up in the hardware. If two popular experts sit on one {GPU|G P U}, it receives twice its share...', code: 'dispatch' },
        { id: 'wait', say: 'and since no one can start the next layer until the combine finishes, everyone waits for it.', code: 'combine' },
        { id: 'limits', say: 'Systems overlap this traffic with computation, and limit how far a token may travel: {DeepSeek-V3|DeepSeek V three} sends each token to at most four machines.' },
      ],
    },
    {
      id: 'outro',
      title: 'What to remember',
      codeTitle: 'recap.py',
      code: `
        y = sum(g * experts[i](x)               #@layer
                for g, i in zip(gates, top))    #@layer
        # memory: total, compute: active        #@counts
        loss = task + alpha * aux_loss          #@aux
        keep = (pos > 0) & (pos <= C)           #@cap
        bias += gamma * np.sign(c.mean() - c)   #@bias
        recv = all_to_all(x[order], counts)     #@a2a
      `,
      beats: [
        { id: 'layer', say: 'To sum up. A mixture of experts swaps one feed-forward block for many, and a router runs only the top k for each token.', code: 'layer' },
        { id: 'counts', say: 'Total parameters set the memory. Active parameters set the compute.', code: 'counts' },
        { id: 'collapse', say: 'Left alone, routing collapses onto favorites. The Switch loss, E times the sum of f times P, is one when balanced, and pushes the busiest experts down.', code: 'aux' },
        { id: 'capacity', say: 'Fixed buffers drop the overflow onto the residual stream. Dropless kernels and good balance avoid it.', code: 'cap' },
        { id: 'deepseek', say: '{DeepSeekMoE|DeepSeek M o E} uses many small experts plus shared ones, and {DeepSeek-V3|DeepSeek V three} balances with bias terms instead of a loss.', code: 'bias' },
        { id: 'a2a', say: 'And expert parallelism moves tokens with two {all-to-alls|all to alls} per layer, at the pace of the busiest {GPU|G P U}.', code: 'a2a' },
        { id: 'idea', say: 'Underneath it all is one idea: how much a model knows, and how much each token costs, no longer have to grow together.' },
        { id: 'end', say: 'Store a lot, run a little, and keep the load even.' },
      ],
    },
  ],
};
