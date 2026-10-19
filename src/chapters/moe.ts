import type { ChapterDef } from './index';
import { MOE_SYMBOLS } from '../lib/moe-symbols';
import { figAuxBars, figParams, figRouter, figTrainer, installCss } from '../lib/moe-figs';
import { figAllToAll, figCapacity, figFineGrained } from '../lib/moe-figs2';

const chapter: ChapterDef = {
  symbols: MOE_SYMBOLS,

  render(p) {
    installCss(p.root);

    p.prose(`
In a dense transformer, every parameter works on every token. Double the parameters and you double the compute per token, and [the scaling-laws chapter](#/scaling-laws) showed that a training run costs about $6ND$ operations. So a model's knowledge (how many parameters it has) and its price (how many it runs per token) are welded together.

A **mixture of experts** (MoE) cuts the weld. It replaces the feed-forward block of a layer with $\\symE$ copies of it, the **experts**, each with its own weights, and adds a tiny **router** that looks at each token and sends it to only $\\symk$ of them, usually one or two. The layer now holds $\\symE$ times the feed-forward parameters, but each token pays for only $\\symk$. Mixtral 8x7B, for example, holds about 47 billion parameters and runs about 13 billion per token.

The idea is old, and the hard part was never the forward pass. It was making the router *share*: left alone, a router sends almost everything to a few favorite experts and the rest never learn. Most of the progress since has been about that problem: a balancing loss, fixed-size expert buffers, finer and shared experts, and bias terms that balance without a loss. And because experts usually live on different GPUs, the distributed-systems side matters as much as the math.`);

    p.h2('Why experts', 'why');
    p.prose(`
Count where a transformer block's parameters live ([the Transformer chapter](#/transformer/parameters)): about $4d^2$ in attention and $8d^2$ in the feed-forward network (FFN), its two-layer MLP. Two thirds of the model is FFN, applied to each token on its own, with no interaction between tokens. That makes it the natural place to add capacity: attention keeps mixing information across positions as before, while the per-token computation gets a choice of specialists.

The bet is **conditional computation**: not every token needs every parameter. A token of Python code and a token of French poetry might be better served by different weights, and if the model can pick which weights to use per token, it can hold far more of them than it can afford to run.

### A short history

- **1991.** Jacobs, Jordan, Nowlan and Hinton's *adaptive mixtures of local experts*: several small networks and a gating network that learns which one to trust for each input. The gate was soft; every expert ran on every input.
- **2017.** Shazeer and colleagues' *sparsely-gated mixture of experts* made the gate sparse (only the top $\\symk$ experts run), put thousands of experts between LSTM layers, and trained models of up to 137 billion parameters. It also named the central problem: the router keeps choosing the same few experts.
- **2020.** GShard brought MoE into the Transformer, with top-2 routing, fixed expert capacity, an auxiliary balancing loss and experts sharded across devices, training a 600-billion-parameter translation model.
- **2021.** The Switch Transformer simplified routing to a single expert per token ($\\symk = 1$) and scaled to 1.6 trillion parameters.
- **2023 to 2025.** Mixtral 8x7B made sparse models practical in the open, and DeepSeekMoE, DeepSeek-V2 and DeepSeek-V3 refined the recipe with many small experts, shared experts and loss-free balancing. Many of the largest open-weight models since then are mixtures of experts.`);

    p.h2('The layer: a router and E experts', 'layer');
    p.prose(`
An MoE layer has two parts. The **experts** are $\\symE$ ordinary feed-forward networks with the same shape and separate weights, written $\\operatorname{FFN}_1, \\dots, \\operatorname{FFN}_{\\symE}$; in a modern model each one is a [SwiGLU block](#/modern-transformer/swiglu). The **router** is a single linear layer that gives every expert a score for the current token. The layer runs the $\\symk$ best-scoring experts and adds up their outputs, each weighted by a **gate** $\\symg_i$:`);

    p.math({
      label: 'A mixture-of-experts layer',
      tex: String.raw`\begin{aligned} y &= \sum_{i \in \mathcal{T}} \symg_i(\symx)\,\operatorname{FFN}_i(\symx) \\ \mathcal{T} &= \operatorname{TopK}\big(\symp(\symx), \symk\big) \end{aligned}`,
      code: `
        def moe_layer(x):              # x: (d,) one token
            probs = softmax(x @ W_r)   # (E,) router
            top = np.argsort(probs)[-k:]   # k best
            gates = probs[top] / probs[top].sum()
            return sum(g * experts[i](x)
                       for g, i in zip(gates, top))
      `,
      codeTitle: 'moe_layer.py',
      terms: [
        [String.raw`\symx`, "the token's vector coming into the layer, $d$ numbers"],
        [String.raw`\operatorname{FFN}_i(\symx)`, 'expert $i$: a feed-forward block with its own weights, applied to the token. Output: $d$ numbers'],
        [String.raw`\mathcal{T}`, 'the set of $\\symk$ chosen experts: the ones with the highest router probabilities $\\symp_i(\\symx)$. The other $\\symE - \\symk$ experts do not run at all for this token'],
        [String.raw`\symg_i(\symx)`, 'the gate: how much expert $i$ counts in the sum. It depends on the token, through the router'],
        [String.raw`\sum_{i \in \mathcal{T}}`, 'add up the weighted outputs of the chosen experts only'],
      ],
      explain: `With $\\symk = \\symE$ and soft gates this would be the 1991 mixture: every expert runs and the router just blends them, so compute grows with $\\symE$. The sparsity is the whole point: the sum runs over $\\symk$ terms, so compute depends on $\\symk$, not on $\\symE$. The output replaces the FFN's output in the block, so the residual connection around it is unchanged: $\\symx + y$ goes on to the next layer. GShard swapped every other feed-forward layer for an MoE layer; Mixtral swaps all of them.`,
    });

    p.h2('The router: softmax, then top-k', 'router');
    p.prose(`
The router is the smallest part of the model and the most interesting. It is a matrix $\\symWr$ with one column per expert, $d \\times \\symE$ numbers in all. Multiply the token by it and you get $\\symE$ logits, one per expert; a softmax turns them into probabilities $\\symp$. Then three things happen in order: keep the $\\symk$ largest, throw the rest away, and decide what weights the kept ones get.`);

    p.math({
      label: 'Top-k routing',
      tex: String.raw`\begin{aligned} \symp &= \operatorname{softmax}(\symx\,\symWr) \\ \mathcal{T} &= \operatorname{TopK}(\symp, \symk) \\ \symg_i &= \frac{\symp_i}{\sum_{j \in \mathcal{T}} \symp_j} \quad \text{for } i \in \mathcal{T} \end{aligned}`,
      code: `
        logits = x @ W_r                 # (E,)
        probs = np.exp(logits - logits.max())
        probs /= probs.sum()             # softmax
        top = np.argsort(probs)[::-1][:k]
        gates = probs[top] / probs[top].sum()
        # same gates: a softmax over the kept logits
        np.allclose(gates, softmax(logits[top]))  # True
      `,
      codeTitle: 'topk.py',
      terms: [
        [String.raw`\symx\,\symWr`, 'the router logits: the dot product of the token with each expert\'s column. A big logit means "this token looks like what expert $i$ handles"'],
        [String.raw`\operatorname{softmax}`, 'exponentiate and divide by the total, so the $\\symE$ scores become probabilities that add up to 1'],
        [String.raw`\operatorname{TopK}(\symp, \symk)`, 'the indices of the $\\symk$ largest probabilities'],
        [String.raw`\symg_i = \symp_i / \textstyle\sum_{j \in \mathcal{T}} \symp_j`, '**renormalization**: rescale the kept probabilities so they add up to 1 again'],
      ],
      explain: `Renormalizing the kept probabilities gives exactly the same gates as a softmax over only the kept logits, because the dropped experts' terms cancel from top and bottom. Mixtral writes its router that way: $\\operatorname{softmax}(\\operatorname{TopK}(\\symx\\symWr))$. Not every design renormalizes. With $\\symk = 1$ a renormalized gate would always be exactly 1, and the router would get no gradient from the task, so the Switch Transformer keeps the raw probability: the chosen expert's output is multiplied by $\\symp_i$, and the router learns by making that number larger when the expert helps. Shazeer's 2017 router also added learned random noise to the logits before the top-k, so that tokens near a border would sometimes try the neighboring expert.`,
    });

    figRouter(p);

    p.callout('intuition', `The router is the [linear classifier from CS231n](#/linear-classification), with experts as the classes. Each column of $\\symWr$ is a template, the logits are template matches, and the plane is carved into regions by straight borders. The difference is what it is trained for. Nobody labels which expert a token "should" go to. The router learns only from the task loss, through the gates: if raising a gate would have lowered the loss, the gradient raises it, and the border moves.`, 'The router is a linear classifier');

    p.h2('Total versus active parameters', 'params');
    p.prose(`
An MoE model has two parameter counts, and both matter. **Total parameters** are everything that must be stored: every expert of every layer. They set the memory needed to hold the model, and they are its capacity to know things. **Active parameters** are the ones a single token actually runs through: the shared parts (embeddings and attention) plus $\\symk$ experts per layer. They set the compute per token, and so the cost of training and serving. In the scaling law's $6ND$, the $N$ is the active count.`);

    p.math({
      label: 'Total and active parameters',
      tex: String.raw`\begin{aligned} N_{\text{total}} &= N_{\text{shared}} + L\,\symE\,N_{\text{expert}} \\ N_{\text{active}} &= N_{\text{shared}} + L\,\symk\,N_{\text{expert}} \end{aligned}`,
      code: `
        d, d_ff, L, V = 4096, 14336, 32, 32000  # Mixtral
        expert = 3 * d * d_ff        # 176M: one SwiGLU
        attn = 2*d*d + 2*d*1024      # 42M: GQA, 8 kv heads
        shared = L * attn + 2 * V * d
        total = shared + L * 8 * expert    # 46.7B
        active = shared + L * 2 * expert   # 12.9B
      `,
      codeTitle: 'mixtral_params.py',
      terms: [
        [String.raw`N_{\text{shared}}`, 'parameters every token uses: the embedding tables, attention in every layer, the norms and the routers'],
        [String.raw`L`, 'the number of layers, each with its own set of experts'],
        [String.raw`N_{\text{expert}}`, 'the size of one expert: three $d \\times d_{ff}$ matrices for a SwiGLU block'],
        [String.raw`\symE`, 'experts per layer, all stored'],
        [String.raw`\symk`, 'experts per layer that one token runs'],
      ],
      explain: `The name 8x7B suggests $8 \\times 7 = 56$ billion, but only the feed-forward blocks are copied eight times; attention and the embeddings are shared, so the total is 46.7 billion. Each token uses two of the eight experts per layer, which comes to 12.9 billion. So Mixtral needs the memory of a 47B model and spends the compute of a 13B one. Its paper reports it matching or beating the dense Llama 2 70B on most of the benchmarks it tried, with about a fifth of the active parameters.`,
    });

    figParams(p);

    p.callout('warning', `"Active" is about compute, not memory. All $\\symE$ experts must sit in GPU memory, because the next token might need any of them. And while a single token reads only $\\symk$ experts per layer, a batch of tokens spreads across nearly all of them: with uniform routing, 16 tokens choosing 2 of 8 experts leave each expert unused with probability $(6/8)^{16} \\approx 1\\%$. So at large batch sizes an MoE model reads almost all its weights at every decoding step, like a dense model of its total size, while doing the arithmetic of its active size. [Fast inference](#/inference) explains why reading weights is often the real cost when decoding.`, 'Memory is paid in full');

    p.h2('Who gets the tokens: imbalance and collapse', 'collapse');
    p.prose(`
So far the router may do anything. Two things go wrong if it is left alone.

**Imbalance wastes hardware.** In a big model the experts live on different GPUs (more on that at the end). If one expert gets half of a batch's tokens, its GPU works while the others wait, and the whole layer runs at the speed of the busiest expert. Worse, the work per expert has to fit in a buffer of fixed size, so an overloaded expert has to turn tokens away.

**Imbalance feeds itself.** An expert that receives more tokens receives more gradient, so it improves faster, so the router, which learns to prefer whatever lowers the loss, sends it even more. Experts that receive few tokens barely train and fall further behind. The end point is **expert collapse**: a handful of experts do all the work, the rest sit idle, and the model has paid for parameters it does not use. Shazeer and colleagues described exactly this self-reinforcing loop in 2017.

The fix that made MoE practical is to add a small term to the loss that is lowest when the load is even.`);

    p.h2('The load-balancing loss', 'aux-loss');
    p.prose(`
Here is the version from the Switch Transformer, used with small changes in most MoE models since. Over a batch of $T$ tokens, measure two things for each expert $i$: the fraction of tokens actually sent to it, $\\symf_i$, and the average probability the router gave it, $\\symP_i$. Then penalize their products:`);

    p.math({
      label: 'Switch Transformer auxiliary loss',
      tex: String.raw`\begin{aligned} \symL &= \alpha\,\symE \sum_{i=1}^{\symE} \symf_i\,\symP_i \\ \symf_i &= \frac{1}{T}\sum_{t=1}^{T} \mathbf{1}\big\{\operatorname{argmax} \symp(\symx_t) = i\big\} \\ \symP_i &= \frac{1}{T}\sum_{t=1}^{T} \symp_i(\symx_t) \end{aligned}`,
      code: `
        # probs: (T, E) router probabilities for a batch
        choice = probs.argmax(axis=1)            # (T,)
        f = np.bincount(choice, minlength=E) / T  # (E,)
        P = probs.mean(axis=0)                    # (E,)
        aux_loss = E * np.sum(f * P)
        loss = task_loss + alpha * aux_loss   # alpha = 0.01
      `,
      codeTitle: 'switch_aux_loss.py',
      terms: [
        [String.raw`\symf_i`, 'the share of the batch\'s tokens dispatched to expert $i$. $\\mathbf{1}\\{\\cdot\\}$ is 1 when the condition holds and 0 otherwise, so the sum counts tokens'],
        [String.raw`\symP_i`, 'the average router probability for expert $i$ over the same tokens'],
        [String.raw`\symf_i\,\symP_i`, 'large when an expert both gets many tokens and is given high probability'],
        [String.raw`\symE`, 'multiplying by the number of experts (which the Switch paper calls $N$) makes the balanced value exactly 1, whatever $\\symE$ is'],
        [String.raw`\alpha`, 'the strength: a small number such as 0.01, so balance never outweighs the task'],
      ],
      explain: `Why a product of two things instead of just $\\symf$? Because $\\symf_i$ comes from an argmax, a count of hard choices, and has no gradient: nudging the router a little does not change any count. $\\symP_i$ is a smooth average of softmax outputs, so it does. The loss uses $\\symf$ as a *weight* and $\\symP$ as the thing that moves: its gradient with respect to $\\symP_i$ is $\\alpha\\symE\\symf_i$, so the router lowers its probabilities fastest for the experts that are busiest right now. When the load is even, every $\\symf_i$ and $\\symP_i$ is $1/\\symE$, and the sum is $\\symE \\cdot \\symE \\cdot \\tfrac{1}{\\symE} \\cdot \\tfrac{1}{\\symE} = 1$. When every token goes to one expert with full confidence it is $\\symE$.`,
    });

    p.callout('math', `If the router's probabilities track its choices ($\\symP_i = \\symf_i$), the loss is $\\symE \\sum_i \\symf_i^2$. Among shares that add up to 1, the sum of squares is smallest when they are all equal: spreading a fixed total evenly always lowers the sum of squares (it is the same reason the L2 penalty in [linear classifiers](#/linear-classification/regularization) prefers spread-out weights). So the loss is at its minimum of 1 exactly at a balanced load.`, 'Why balance is the minimum');

    figAuxBars(p);

    p.prose(`
Here is collapse and its cure on a tiny mixture of experts trained from scratch: four linear experts, a top-1 router with Switch-style gates, and a regression task that rewards specialization, because the target has four flat faces and one linear expert can fit only one.`);

    figTrainer(p);

    p.prose(`
Two more tools come up in most MoE recipes. ST-MoE (Zoph and colleagues, 2022) added a **router z-loss**, a small penalty on the size of the router's logits, because very large logits make the softmax brittle and were a source of training instability. And the router is usually computed in full 32-bit precision even when the rest of the model runs in bf16, for the same reason (the Switch paper calls this selective precision).`);

    p.h2('Capacity and dropped tokens', 'capacity');
    p.prose(`
Accelerators like arrays whose shapes are known in advance. So the classic MoE implementation gives every expert a buffer of fixed size, its **capacity**, before it knows how the batch will be routed. A token that arrives at a full expert is **dropped**: it skips the expert computation and passes to the next layer unchanged through the residual connection. The capacity is set by a **capacity factor**, a multiplier on the perfectly even share:`);

    p.math({
      label: 'Expert capacity',
      tex: String.raw`C = \left\lceil \text{cf} \cdot \frac{\symk\,T}{\symE} \right\rceil`,
      code: `
        C = int(np.ceil(cf * k * T / E))   # slots per expert
        onehot = np.eye(E)[choice]         # (T, E), top-1
        pos = np.cumsum(onehot, axis=0) * onehot
        keep = (pos > 0) & (pos <= C)      # (T, E)
      `,
      codeTitle: 'capacity.py',
      terms: [
        [String.raw`\symk\,T / \symE`, 'the even share: $T$ tokens each make $\\symk$ assignments, spread over $\\symE$ experts'],
        [String.raw`\text{cf}`, 'the capacity factor. 1.0 leaves no slack; the Switch paper trained with values such as 1.0 and 1.25'],
        [String.raw`\lceil \cdot \rceil`, 'round up to a whole number of slots'],
      ],
      explain: `The \`cumsum\` line is the standard trick for filling the buffers without a loop: running down the batch, it counts how many tokens before this one (and including it) chose the same expert, which is the token's place in that expert's line. Tokens whose place is beyond $C$ are dropped. The capacity factor is a trade. Too low, and tokens get dropped, which hurts quality, since a dropped token gets no expert at all in that layer. Too high, and the buffers are padded with empty slots: computation, memory and communication spent on nothing.`,
    });

    figCapacity(p);

    p.prose(`
Dropping tokens is not a law of nature; it is a consequence of fixed shapes. Later systems avoided it. MegaBlocks (Gale and colleagues, 2022) rewrote expert computation as block-sparse matrix multiplication, so each expert processes however many tokens it gets ("dropless" MoE). DeepSeek-V3 reports dropping no tokens in training or inference, relying on good balance instead. Serving systems for models like Mixtral generally run every token through its chosen experts, too. Balance still matters in a dropless system, because the busiest expert still sets the pace.`);

    p.h2('Fine-grained and shared experts', 'deepseekmoe');
    p.prose(`
DeepSeekMoE (Dai and colleagues, 2024) asked what an expert should be. With 8 or 16 big experts and top-2 routing, each expert must cover a lot of ground, so knowledge that many tokens need gets copied into several of them. The paper made two changes, both of which keep total parameters and compute per token the same.

**Fine-grained experts.** Split every expert into $m$ narrower ones (each with $1/m$ of the hidden width $d_{ff}$) and route each token to $m$ times as many. The arithmetic per token is unchanged, but the number of possible combinations of experts explodes:`);

    p.math({
      label: 'How many expert combinations',
      tex: String.raw`\begin{gathered} \binom{\symE}{\symk} = \frac{\symE!}{\symk!\,(\symE - \symk)!} \\ \binom{16}{2} = 120 \\ \binom{64}{8} = 4{,}426{,}165{,}368 \end{gathered}`,
      code: `
        from math import comb
        comb(16, 2)   # 120: 16 experts, top-2
        comb(64, 8)   # 4426165368: each split in 4
      `,
      terms: [
        [String.raw`\binom{\symE}{\symk}`, '"$\\symE$ choose $\\symk$": the number of different sets of $\\symk$ experts out of $\\symE$'],
        [String.raw`\symE!`, 'the factorial, $1 \\times 2 \\times \\dots \\times \\symE$'],
        [String.raw`\binom{64}{8}`, 'the same parameters and compute as 16 experts with top-2, cut into pieces four times smaller'],
      ],
      explain: `Each token now assembles its feed-forward computation from eight small specialists out of 64, instead of two big generalists out of 16. With billions of possible teams, experts can afford to specialize narrowly, because any token can still be covered by a combination. This is the example the DeepSeekMoE paper uses.`,
    });

    p.prose(`**Shared experts.** Set aside $K_s$ of the experts as **shared**: every token goes through them, with no routing at all. To keep compute fixed, each token is routed to $K_s$ fewer experts.`);

    p.math({
      label: 'Shared plus routed experts',
      tex: String.raw`\begin{aligned} y = &\underbrace{\sum_{i=1}^{K_s} \operatorname{FFN}_i(\symx)}_{\text{shared: always on}} \\ + &\underbrace{\sum_{i \in \mathcal{T}} \symg_i(\symx)\,\operatorname{FFN}_i(\symx)}_{\text{routed: top } \symk - K_s} \end{aligned}`,
      code: `
        y = sum(ffn(x) for ffn in shared)      # every token
        probs = softmax(x @ W_r)               # routed only
        top = np.argsort(probs)[-(k - Ks):]
        y = y + sum(probs[i] * routed[i](x) for i in top)
      `,
      codeTitle: 'shared_experts.py',
      terms: [
        [String.raw`K_s`, 'the number of shared experts. DeepSeek-V3 uses one'],
        [String.raw`\sum_{i=1}^{K_s}`, 'the shared experts run on every token, with weight 1'],
        [String.raw`\mathcal{T}`, 'the routed experts the router picked for this token'],
      ],
      explain: `Some knowledge is useful to every token: common grammar, frequent words, the basic layout of the residual stream. Without shared experts, several routed experts each learn a copy of it. A shared expert holds it once, and frees the routed experts to hold what is specific. (The listing follows DeepSeek-V2 and leaves the routed gates unnormalized; DeepSeek-V3 normalizes them.)`,
    });

    figFineGrained(p);

    p.prose(`
These two ideas, together with a new attention variant, are the core of DeepSeek-V2 (236 billion total, 21 billion active) and DeepSeek-V3 (671 billion total, 37 billion active). Each V3 MoE layer has one shared expert and 256 routed experts, of which every token uses 8; its first three layers keep an ordinary dense FFN.`);

    p.h2('Balancing with a bias instead of a loss', 'loss-free');
    p.prose(`
An auxiliary loss is a compromise: its gradient is mixed into the same weights as the task's gradient, and a strong enough $\\alpha$ to balance well can cost some quality. DeepSeek-V3 (2024, building on work by Wang and colleagues) balances without a loss. Each expert gets a bias $b_i$ that is added to its score **only when choosing** the top $\\symk$. The gate still uses the unbiased score, and no gradient ever flows into the biases. After each training step, the bias of every overloaded expert goes down by a fixed amount $\\gamma$, and the bias of every underloaded expert goes up.`);

    p.math({
      label: 'Loss-free balancing (DeepSeek-V3)',
      tex: String.raw`\begin{aligned} \mathcal{T} &= \operatorname{TopK}\big(\{ s_i + b_i \},\, \symk\big) \\ \symg_i &= \frac{s_i}{\sum_{j \in \mathcal{T}} s_j} \\ b_i &\leftarrow b_i + \gamma\, \operatorname{sign}(\bar{c} - c_i) \end{aligned}`,
      code: `
        s = sigmoid(x @ W_r)                    # scores
        top = np.argsort(s + bias)[-k:]         # choose
        gates = s[top] / s[top].sum()           # weigh
        # after each step, with counts c for the batch:
        bias += gamma * np.sign(c.mean() - c)   # no grad
      `,
      codeTitle: 'loss_free_balancing.py',
      terms: [
        [String.raw`s_i`, "expert $i$'s score for the token. DeepSeek-V3 uses a sigmoid of the logit; the toy above uses its softmax probabilities"],
        [String.raw`s_i + b_i`, 'the biased score, used only to pick the experts'],
        [String.raw`\symg_i = s_i / \textstyle\sum s_j`, 'the gates use the unbiased scores, renormalized over the chosen experts'],
        [String.raw`c_i,\ \bar{c}`, 'how many tokens expert $i$ received in the last step, and the average over experts'],
        [String.raw`\gamma\,\operatorname{sign}(\bar{c} - c_i)`, 'a fixed nudge: up if the expert got fewer tokens than average, down if it got more'],
      ],
      explain: `The bias works like a price. An expert that is too popular becomes slightly more expensive to choose, so tokens near its border move to a neighbor; an idle expert gets cheaper. Because the bias changes only which experts are chosen, never how their outputs are weighted or how the router is trained, the task gradient stays clean. DeepSeek-V3 still keeps a very small sequence-level balance loss as a safety net. On the toy router above, the bias terms alone balance the load, with $\\alpha = 0$.`,
    });

    p.h2('Expert parallelism and all-to-all', 'expert-parallel');
    p.prose(`
A model with hundreds of billions of parameters does not fit on one GPU, and [the parallelism chapter](#/parallelism) shows the general tools for splitting one: data parallelism with all-reduce, tensor and pipeline parallelism, sharded optimizer states. Mixtures of experts add one more, and it is the natural one: **expert parallelism**. Put different experts on different GPUs. With $G$ GPUs and $\\symE$ experts, each GPU holds $\\symE / G$ of them, while the attention layers are typically replicated and trained with data parallelism.

Each GPU processes its own slice of the batch through attention. At an MoE layer, each token must travel to the GPU that holds its expert. That is an **all-to-all**: every GPU sends a different packet to every other GPU (unlike an all-reduce, where everyone ends with the same sum). The experts run, and a second all-to-all sends the results back to where their tokens came from.`);

    p.math({
      label: 'Traffic per MoE layer',
      tex: String.raw`V \approx \underbrace{2}_{\text{out, back}} \cdot\, \symk \cdot T \cdot d \cdot \Big(1 - \frac{1}{G}\Big)`,
      code: `
        k, T, d, G = 2, 4096, 4096, 8    # tokens per GPU
        values = 2 * k * T * d * (1 - 1 / G)
        values * 2 / 1e6                 # bf16: 117 MB
        # per layer, forward pass only; backward repeats it
      `,
      codeTitle: 'a2a_traffic.py',
      terms: [
        [String.raw`V`, 'the numbers one GPU sends per MoE layer, in the forward pass'],
        [String.raw`\symk \cdot T`, 'every one of the GPU\'s $T$ tokens goes to $\\symk$ experts'],
        [String.raw`d`, 'each trip carries the full token vector'],
        [String.raw`2`, 'out to the experts (dispatch) and back again (combine)'],
        [String.raw`1 - 1/G`, 'with even routing, a share $1/G$ of the experts is on the same GPU, so that traffic stays local'],
      ],
      explain: `About a hundred megabytes per layer per GPU, twice per layer once backward is counted, for every MoE layer: all-to-all traffic is a large part of the cost of training an MoE model, and it crosses the slowest links when the experts span several machines. Systems fight it by overlapping communication with computation and by limiting how far a token may travel: DeepSeek-V3 sends each token to experts on at most four nodes.`,
    });

    figAllToAll(p);

    p.prose(`
The figure makes the link between balance and hardware concrete. Expert parallelism is only as fast as its busiest GPU, and the busiest GPU is the one holding the most popular experts. The balancing loss, the capacity factor and the bias terms are all ways of keeping that bar short.`);

    p.h2('Mixture of experts in practice', 'in-practice');
    p.table(
      ['Model', 'Year', 'Experts per MoE layer', 'Used per token', 'Total', 'Active'],
      [
        ['Mixtral 8x7B', '2023', '8', '2', '46.7B', '12.9B'],
        ['Mixtral 8x22B', '2024', '8', '2', '141B', '39B'],
        ['DeepSeek-V2', '2024', '2 shared + 160 routed', '2 + 6', '236B', '21B'],
        ['DeepSeek-V3', '2024', '1 shared + 256 routed', '1 + 8', '671B', '37B'],
      ],
      { caption: 'Published configurations. The ratio of total to active parameters grew from under 4 to about 18 as experts became smaller and more numerous. Some model names now carry both numbers: Qwen3-235B-A22B has 235 billion total and 22 billion active.' },
    );
    p.prose(`
A few lessons from running these models:

- **Experts do not specialize the way you might guess.** The Mixtral paper looked for experts devoted to topics such as mathematics, biology or philosophy and found no clear pattern. The routing it did find was more syntactic: some experts took particular kinds of tokens, such as indentation in code, and consecutive tokens often went to the same experts.
- **The benefit is cheaper quality.** At a fixed compute per token, an MoE model reaches a lower loss than a dense one; the Switch paper reported reaching a dense T5 model's quality several times faster on the same hardware. At a fixed *total* parameter count, a dense model is usually better, so the comparison that matters is the one at equal cost.
- **The costs are memory and plumbing.** All experts must be stored, communication grows, and the training recipe has more knobs (balancing strength, capacity, router precision). Fine-tuning MoE models was also found to be more prone to overfitting in early work.
- **Serving favors big batches.** A server that batches many requests keeps every expert busy and amortizes reading its weights; a single user at batch size 1 gets fast tokens but needs the whole model in memory.`);

    p.callout('idea', `
- An MoE layer replaces one FFN with $\\symE$ expert FFNs and a linear **router**. Each token runs only its top $\\symk$ experts, weighted by gates $\\symg$ (renormalized over the kept experts in Mixtral, the raw probability in Switch).
- **Total parameters** set memory and capacity; **active parameters** set compute. Mixtral 8x7B: about 47B total, 13B active.
- Left alone, routing **collapses**: favored experts train faster and win even more. The Switch **auxiliary loss** $\\alpha\\symE\\sum_i \\symf_i\\symP_i$ is 1 when balanced and pushes down the probability of the busiest experts.
- Fixed buffers of **capacity** $\\lceil \\text{cf} \\cdot \\symk T / \\symE \\rceil$ drop overflow tokens to the residual; dropless kernels and good balance avoid it.
- **DeepSeekMoE** uses many fine-grained experts plus always-on **shared** experts; **DeepSeek-V3** balances with selection-only **bias terms** instead of a loss.
- **Expert parallelism** puts experts on different GPUs and moves tokens with two **all-to-alls** per layer; the busiest GPU sets the pace.`, 'Takeaways');

    p.h2('Build it yourself', 'exercises');
    p.prose(`
1. **A router in NumPy (10 minutes).** For a batch \`X\` of shape (T, d) and a random \`W_r\` of shape (d, E), compute the router probabilities, the top-$\\symk$ indices per token and the renormalized gates, with no Python loop over tokens. Check that your gates equal a softmax over only the kept logits. Then compute $\\symf$, $\\symP$ and the Switch loss for three routings: uniform, all to one expert, and your random router. *Success:* the loss is 1 for the uniform case, $\\symE$ for the collapsed one, and something in between for yours.
2. **Dispatch and combine.** Implement capacity-based dispatch with the \`cumsum\` trick: build a (T, E, C) dispatch tensor of zeros and ones, gather expert inputs with \`np.einsum('tec,td->ecd', ...)\`, apply a different random matrix per expert, and scatter the results back with a combine tensor that holds the gates. Compare against a slow loop over tokens. Then plot the fraction of dropped tokens against the capacity factor (0.5 to 2) for uniform and skewed routing. *Success:* the vectorized and loop versions agree for every kept token, dropped tokens come back as zeros, and you can name the capacity factor at which uniform routing stops dropping.
3. **Reproduce collapse.** Rebuild the toy router from the balancing section in PyTorch: 240 tokens in 2-D around a shared offset, the target $|u_1| + |u_2|$, four linear experts and a top-1 router with Switch gates. Train with $\\alpha$ = 0, 0.001, 0.01 and 0.1, and plot task loss and the largest expert's share over time for each. Then add DeepSeek-V3's bias update with $\\alpha = 0$. *Success:* collapse at $\\alpha = 0$, balance and a much lower task loss at the larger values, and balance from the bias terms alone.
4. **Count a real model.** Download the \`config.json\` of an open MoE model (Mixtral 8x7B is a good start) and write a function that computes its total and active parameters from the config alone: embeddings, attention with grouped-query heads, routers and experts. *Success:* within 1% of the published 46.7B and 12.9B; then report the memory needed in bf16 and at 4 bits per weight.
5. **Project: an MoE language model.** Take a small character-level GPT (from [the Transformer chapter's exercises](#/transformer/exercises)) and replace each MLP with 8 experts and top-2 routing, plus the Switch loss. Train three models for the same number of steps: the dense original, the MoE, and a dense model as wide as the MoE's *total*. Log validation loss and each layer's expert loads. *Success:* the MoE beats the dense model with the same active parameters, its loads stay near even with the loss on, and you can see what happens to them with it off.`);
  },
};

export default chapter;
