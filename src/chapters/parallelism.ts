import type { ChapterDef } from './index';
import { PARALLELISM_SYMBOLS } from '../lib/parallelism-symbols';
import { fig3d, figCheckpoint, figMemory, figOverlap, figPipeline, figRing, figTensor, figZero } from '../lib/parallelism-figs';

const chapter: ChapterDef = {
  symbols: PARALLELISM_SYMBOLS,

  render(p) {
    p.prose(`
[Chapter 5](#/scaling-laws) put a price on training: about $6ND$ floating-point operations for $N$ parameters and $D$ tokens. Take a 70-billion-parameter model and 15 trillion tokens, roughly the budget of Llama 3 70B: $6 \\times 70 \\times 10^9 \\times 15 \\times 10^{12} \\approx 6.3 \\times 10^{24}$ operations. An NVIDIA H100 peaks at about 989 trillion 16-bit operations per second, and a well-tuned training run gets about 40% of that. At that pace, one GPU would need about **500 years**.

Memory is no kinder. In 16-bit numbers the weights alone are 140 GB, and an H100 holds 80 GB. As the first section shows, training needs about eight times more than the weights. So a model like this is trained on thousands of GPUs at once, and the question of this chapter is *how to split one training run across them*.

There are only a few basic moves, and every large run combines them:

- **Data parallelism:** copy the model onto every GPU, give each a different slice of the batch, and average the gradients.
- **ZeRO and FSDP:** the same, but stop storing $\\symN$ identical copies of everything; shard them and pass pieces around on demand.
- **Tensor parallelism:** split each layer's weight matrices across GPUs.
- **Pipeline parallelism:** split the stack of layers into stages, one per GPU, and stream micro-batches through.

Each move trades memory for communication in a different way, and the art is in matching each kind of traffic to the right wire. We start by counting where the memory goes.`);

    // ------------------------------------------------------------------ memory
    p.h2('Where the memory goes: 16 bytes per parameter', 'memory');
    p.prose(`
Training with Adam in mixed precision (from [the optimizers chapter](#/optimizers/mixed-precision)) keeps five numbers for every parameter. The forward and backward passes run in bf16, so they need the **weights** and the **gradients** in 2 bytes each. The optimizer works in fp32: a **master copy** of the weights (4 bytes), because small updates would round away in bf16, and Adam's two running averages, the **first moment** $m$ and the **second moment** $v$ (4 bytes each). Add them up:`);

    p.math({
      label: 'Model state for mixed-precision Adam',
      tex: String.raw`\begin{aligned} \text{bytes} &= \underbrace{2\symPsi}_{\text{weights}} + \underbrace{2\symPsi}_{\text{gradients}} + \underbrace{4\symPsi}_{\text{fp32 master}} \\ &\quad + \underbrace{4\symPsi + 4\symPsi}_{\text{Adam's } m,\ v} \;=\; 16\,\symPsi \end{aligned}`,
      code: `
        n_params = 70e9
        weights = 2 * n_params    # bf16, read by forward and backward
        grads   = 2 * n_params    # bf16, written by backward
        master  = 4 * n_params    # fp32 copy the optimizer updates
        adam_m  = 4 * n_params    # fp32 first moment
        adam_v  = 4 * n_params    # fp32 second moment
        total = weights + grads + master + adam_m + adam_v
        print(total / 1e9)        # 1120.0 GB: 14 H100s of 80 GB
      `,
      codeTitle: 'model_state.py',
      terms: [
        [String.raw`\symPsi`, 'the number of parameters (the Greek capital *psi*, as in the ZeRO paper)'],
        [String.raw`2\symPsi`, '2 bytes for each parameter: one bf16 number apiece. Weights and gradients each cost this'],
        [String.raw`4\symPsi`, '4 bytes for each parameter: one fp32 number apiece. The master weights and both Adam moments each cost this'],
        [String.raw`16\,\symPsi`, 'the total, before a single activation is stored'],
      ],
      explain: 'A byte is 8 bits; a GB is a billion bytes. For a 70-billion-parameter model, 16 bytes each is 1.12 trillion bytes, 1.12 TB: fourteen 80 GB GPUs just to hold the training state, and none of it is optional with plain Adam. Exact counts vary a little between frameworks (some keep gradients in fp32, for 18 bytes), but 16 is the standard estimate. Notice the split: only 2 of the 16 bytes are the weights the forward pass uses. The optimizer state, 12 bytes, is three quarters of the total, and that will be the first thing worth sharding.',
    });

    p.callout('aside', `Mixed precision does not shrink this number. Pure fp32 training with Adam stores weights, gradients, $m$ and $v$ at 4 bytes each: also 16 bytes per parameter. What 16-bit arithmetic saves is compute (tensor cores run it many times faster) and activation memory, which is the other half of the story.`, 'Why mixed precision is not a memory saving here');

    p.h2('Activations, and checkpointing', 'activations');
    p.prose(`
Backpropagation needs, at every layer, the values that flowed *into* it during the forward pass. The gradient of a weight matrix is its input times the gradient arriving from above (the [backprop chapter](#/backprop) derives this), so the forward pass must keep each layer's inputs, and every intermediate value inside a layer, until the backward pass reaches it. Those stored values are the **activations** $\\symX$.

Unlike the model state, activations grow with how much data a GPU processes at once: the number of sequences $b$ and the tokens per sequence $s$. Korthikanti et al. (2022) counted every tensor a GPT-style block saves for its backward pass:`);

    p.math({
      label: 'Activation memory for one micro-batch',
      tex: String.raw`\text{acts} \approx L \cdot 34\, s\, b\, d \ \text{bytes}`,
      code: `
        L, d = 96, 12288          # GPT-3 175B: layers, width
        s, b = 2048, 1            # tokens per sequence, sequences
        per_layer = 34 * s * b * d
        acts = L * per_layer
        print(acts / 1e9)         # 82.1 GB, for ONE sequence
      `,
      codeTitle: 'activations.py',
      terms: [
        [String.raw`L`, 'the number of transformer blocks (layers)'],
        [String.raw`s\, b\, d`, 'the size of one activation tensor: $s$ tokens per sequence, times $b$ sequences, times the model width $d$'],
        [String.raw`34`, 'how many bytes per entry of that tensor a block stores: its inputs, the queries, keys and values, the 4x-wide MLP hidden layer before and after the GeLU, and a few more, mostly in 2-byte bf16'],
      ],
      explain: 'For GPT-3 175B and a single 2,048-token sequence that is 82 GB, more than an H100 holds, on top of the 2.8 TB of model state. The formula assumes the attention matrix itself ($s$ by $s$ per head) is not stored; FlashAttention ([the modern block](#/modern-transformer)) recomputes it in the backward pass, which removes a term of $5\\,a s^2 b$ bytes per layer for $a$ heads. Without that, long sequences would be far worse.',
    });

    p.prose(`
**Activation checkpointing** (Chen et al., 2016, after older ideas from automatic differentiation) trades compute for this memory. During the forward pass, keep only a few tensors, the *checkpoints*, typically the input to each block, and throw the rest away. During the backward pass, when you reach a block, run its forward pass again from the checkpoint to rebuild what was thrown away, then backpropagate through it. The block's input is only $2\\,s b d$ bytes of its $34\\,s b d$, so memory drops by more than ten times.`);

    p.math({
      label: 'Checkpointing: memory for compute',
      tex: String.raw`\begin{aligned} \text{acts}_{\text{ckpt}} &\approx \underbrace{2\, s b d\, L}_{\text{block inputs}} + \underbrace{34\, s b d}_{\text{one rebuilt block}} \\[10pt] \frac{\text{compute}_{\text{ckpt}}}{\text{compute}} &= \frac{2 + 4 + 2}{2 + 4} = \frac{4}{3} \end{aligned}`,
      code: `
        acts_ckpt = 2 * s * b * d * L + 34 * s * b * d
        print(acts_ckpt / 1e9)    # 5.7 GB instead of 82.1

        flops = 2 + 4             # per parameter per token: fwd, bwd
        flops_ckpt = 2 + 4 + 2    # plus a second forward pass
        print(flops_ckpt / flops) # 1.333...
      `,
      codeTitle: 'checkpoint_cost.py',
      terms: [
        [String.raw`2\, s b d\, L`, 'one stored input per block, 2 bytes per entry'],
        [String.raw`34\, s b d`, 'the full activations of the one block being rebuilt right now'],
        [String.raw`2 + 4`, 'the usual cost per parameter per token: 2 operations forward, 4 backward (the $6ND$ of Chapter 5)'],
        [String.raw`+\,2`, 'one more forward pass, to rebuild each block during the backward pass'],
      ],
      explain: 'Rebuilding costs one extra forward pass, and the forward pass is a third of training, so checkpointing every block costs about a third more compute. Korthikanti et al. also showed a cheaper middle ground, **selective recomputation**: recompute only the parts that are large to store but cheap to compute (the attention softmax and its neighbors), which saves most of the memory for a few percent of compute.',
    });

    figMemory(p);
    figCheckpoint(p);

    // ------------------------------------------------------------------ data parallel
    p.h2('Data parallelism: same model, different data', 'data-parallel');
    p.prose(`
The simplest way to use $\\symN$ GPUs: put a full copy of the model on each, split every batch into $\\symN$ slices, and let each GPU run forward and backward on its own slice. Each GPU ends up with a gradient $\\symG_i$ computed from different examples. Average them, give every GPU the average, and every copy takes the identical optimizer step, so the copies stay identical forever.`);

    p.math({
      label: 'Data parallelism averages gradients',
      tex: String.raw`\symG = \frac{1}{\symN} \sum_{i=1}^{\symN} \symG_i`,
      code: `
        x_i, y_i = x[i::N], y[i::N]     # GPU i's slice of the batch
        model(x_i, y_i).backward()      # G_i, in every w.grad
        for w in model.parameters():
            dist.all_reduce(w.grad)     # sum over all N GPUs
            w.grad /= N                 # the average, G
        opt.step()                      # the same step everywhere
      `,
      codeTitle: 'data_parallel.py',
      terms: [
        [String.raw`\symG_i`, 'the gradient GPU $i$ computed from its own slice of the batch'],
        [String.raw`\sum_{i=1}^{\symN}`, 'add up over all $\\symN$ GPUs'],
        [String.raw`\frac{1}{\symN}`, 'divide by $\\symN$: an average'],
      ],
      explain: 'Because the loss is an average over the batch, and the gradient of an average is the average of the gradients, this is *exactly* the gradient of the whole batch: data parallelism changes nothing about the math of training, only where it happens. The one new operation is **all-reduce**: every GPU contributes an array, and every GPU ends up with the sum of all of them. The gradient has as many entries as the model has parameters, so in bf16 that is $2\\symPsi$ bytes per GPU per step, 14 GB for a 7B model. How fast can that be done?',
    });

    p.callout('math', `Two numbers describe a link between GPUs. **Bandwidth** $\\symB$ is how many bytes per second it carries once data is flowing; sending $S$ bytes takes $S/\\symB$ seconds. **Latency** $\\alpha$ is the fixed delay before anything arrives, a few microseconds, paid once per message. Inside one server, H100s talk over **NVLink** at about 450 GB/s in each direction. Between servers, each GPU typically gets one **InfiniBand** link of 400 gigabits per second, 50 GB/s: about nine times slower. Compute is measured in FLOP/s, floating-point operations per second.`, 'Math help: bandwidth and latency');

    // ------------------------------------------------------------------ all-reduce
    p.h2('All-reduce around a ring', 'all-reduce');
    p.prose(`
The obvious all-reduce sends every gradient to one GPU, adds them up there, and sends the sum back. That GPU must receive $\\symN - 1$ gradients and send out $\\symN - 1$ copies, so its link carries more traffic every time you add a GPU. With 64 GPUs it is the bottleneck for everything.

The **ring all-reduce**, known in high-performance computing for years (Patarasuk and Yuan, 2009) and brought to deep learning by Baidu in 2017 and Uber's Horovod library in 2018, keeps every link equally busy instead. Arrange the GPUs in a ring and cut each gradient into $\\symN$ chunks. Then run two phases:

1. **Reduce-scatter**, $\\symN - 1$ steps. In each step, every GPU sends one chunk to its right-hand neighbor, which adds it to its own copy of that chunk. The chunks rotate so that after $\\symN - 1$ steps each GPU holds the complete sum of one chunk.
2. **All-gather**, $\\symN - 1$ more steps. Pass the finished chunks around the ring until every GPU has all of them.

Every step moves one chunk, $1/\\symN$ of the gradient, across every link at once.`);

    p.math({
      label: 'Time for a ring all-reduce of S bytes',
      tex: String.raw`T_{\text{ring}} = \underbrace{\frac{2(\symN - 1)}{\symN}\cdot\frac{S}{\symB}}_{\text{bandwidth}} \;+\; \underbrace{2(\symN - 1)\,\alpha}_{\text{latency}}`,
      code: `
        def ring_time(S, N, bw, alpha=10e-6):
            steps = 2 * (N - 1)             # reduce-scatter + all-gather
            per_step = S / N / bw + alpha   # one chunk to the neighbor
            return steps * per_step

        S = 2 * 7e9                         # bf16 gradients of a 7B model
        for N in [2, 8, 64, 1024]:
            print(N, ring_time(S, N, bw=50e9))
        # 0.28 s, 0.49 s, 0.55 s, 0.58 s: nearly flat in N
      `,
      codeTitle: 'ring_time.py',
      terms: [
        [String.raw`S`, 'the size of the array being all-reduced, in bytes'],
        [String.raw`2(\symN - 1)`, 'the number of steps: $\\symN - 1$ to reduce-scatter, $\\symN - 1$ to all-gather'],
        [String.raw`\frac{S}{\symN}`, 'the chunk each GPU sends per step'],
        [String.raw`\frac{2(\symN-1)}{\symN}`, 'the total each GPU sends, in units of $S$: 1 for two GPUs, 1.5 for four, and never more than 2'],
        [String.raw`\alpha`, 'the latency of one message, paid once per step'],
      ],
      explain: 'The bandwidth term is the insight. Each GPU sends $2(\\symN-1)/\\symN$ times the gradient, which climbs from 1 toward 2 and then stops: doubling the number of GPUs barely changes how long an all-reduce takes. That is what makes data parallelism scale to thousands of GPUs. The latency term does grow with $\\symN$, which is why libraries such as NVIDIA\'s NCCL switch to tree-shaped algorithms for small messages and very large rings, and why gradients are sent in large buckets rather than one tensor at a time.',
    });

    figRing(p);

    p.prose(`
Remember the two halves. **Reduce-scatter** leaves each GPU with the sum of one $1/\\symN$ slice; **all-gather** collects slices from everyone. An all-reduce is just the two in a row, and the sharding methods below are built from them separately.`);

    // ------------------------------------------------------------------ overlap
    p.h2('Communication versus compute', 'overlap');
    p.prose(`
An all-reduce only costs time if the GPUs sit idle waiting for it. PyTorch's \`DistributedDataParallel\` (Li et al., 2020) avoids most of that wait. The backward pass produces gradients from the last layer to the first, so DDP groups them into **buckets** of about 25 MB and starts each bucket's all-reduce as soon as its gradients are complete, while the backward pass carries on with earlier layers. If the network keeps up, the communication hides entirely behind the math. Whether it keeps up is a ratio worth computing.`);

    p.math({
      label: 'The data-parallel ratio of talking to computing',
      tex: String.raw`\begin{aligned} \frac{\text{communication}}{\text{compute}} &\approx \frac{2 \cdot 2\symPsi \,/\, \symB}{6\,\symPsi\, T \,/\, F} \\[4pt] &= \frac{2F}{3\,T\,\symB} \end{aligned}`,
      code: `
        F  = 0.4 * 989e12     # achieved bf16 FLOP/s on an H100
        bw = 50e9             # InfiniBand, bytes/s per GPU
        for T in [1024, 4096, 16384, 65536]:  # tokens per GPU per step
            print(T, 2 * F / (3 * T * bw))
        # 5.2, 1.3, 0.32, 0.08: talk shrinks as T grows
      `,
      codeTitle: 'dp_ratio.py',
      terms: [
        [String.raw`2 \cdot 2\symPsi`, 'bytes each GPU sends per step: about twice the gradient (the ring factor), and the gradient is $2\\symPsi$ bytes in bf16'],
        [String.raw`\symB`, 'the bandwidth of each GPU\'s link'],
        [String.raw`6\,\symPsi\,T`, 'operations per GPU per step: 6 per parameter per token, for the $T$ tokens this GPU processes'],
        [String.raw`F`, 'the operations per second the GPU actually achieves'],
      ],
      explain: 'The model size $\\symPsi$ cancels. A bigger model means bigger gradients to send but proportionally more math to hide them behind, so data parallelism is equally efficient at every size. What matters is $T$, the tokens each GPU processes per step: with InfiniBand, it needs to be well above about 5,000 for the communication to fit inside the compute. That points at data parallelism\'s real limit. The global batch is $\\symN \\times T$ tokens, and past a model-dependent **critical batch size** (McCandlish et al., 2018), bigger batches stop making training faster per token. So you cannot add GPUs forever just by adding data.',
    });

    figOverlap(p);

    p.prose(`
Data parallelism has a second limit: every GPU holds all 16 bytes per parameter. A 65B model's training state alone is ten times an H100. The next section removes that limit without giving up the simplicity.`);

    // ------------------------------------------------------------------ ZeRO
    p.h2('ZeRO and FSDP: stop keeping copies', 'zero');
    p.prose(`
With $\\symN$ data-parallel GPUs there are $\\symN$ identical copies of the weights, the gradients and the optimizer state, and most of them are needed only briefly. **ZeRO**, the Zero Redundancy Optimizer (Rajbhandari et al., Microsoft, 2019), removes that redundancy in three stages, each one sharding more:

- **Stage 1: shard the optimizer state.** GPU $i$ keeps the fp32 master weights and Adam moments for only its $1/\\symN$ slice of the parameters, and updates only that slice. Instead of an all-reduce, gradients are **reduce-scattered**, so each GPU receives the averaged gradient for exactly its own slice. After the update, an **all-gather** gives every GPU the new bf16 weights. Reduce-scatter plus all-gather is an all-reduce, so the traffic is the same as plain data parallelism, while the largest part of memory, 12 of the 16 bytes, is divided by $\\symN$.
- **Stage 2: shard the gradients too.** After the reduce-scatter, a GPU drops the gradient entries it does not own. Same traffic again.
- **Stage 3: shard the weights too.** No GPU holds the whole model. Just before a layer runs, its weights are all-gathered from everyone; right after, they are freed. The backward pass gathers them a second time. That is 1.5 times the traffic of plain data parallelism, in exchange for dividing *everything* by $\\symN$.`);

    p.math({
      label: 'ZeRO memory per GPU',
      tex: String.raw`\begin{aligned}
        \text{DDP:}\quad & 16\,\symPsi \\
        \text{ZeRO-1:}\quad & 2\symPsi + 2\symPsi + 12\symPsi/\symN \\
        \text{ZeRO-2:}\quad & 2\symPsi + (2\symPsi + 12\symPsi)/\symN \\
        \text{ZeRO-3:}\quad & 16\,\symPsi/\symN
      \end{aligned}`,
      code: `
        n_params, N = 7.5e9, 64         # the ZeRO paper's example
        print(16 * n_params / 1e9)                       # DDP    120
        print((4 * n_params + 12 * n_params / N) / 1e9)  # ZeRO-1 31.4
        print((2 * n_params + 14 * n_params / N) / 1e9)  # ZeRO-2 16.6
        print(16 * n_params / N / 1e9)                   # ZeRO-3  1.9
      `,
      codeTitle: 'zero.py',
      terms: [
        [String.raw`12\symPsi/\symN`, 'the optimizer state (fp32 master, Adam $m$ and $v$), split $\\symN$ ways'],
        [String.raw`2\symPsi/\symN`, 'gradients split $\\symN$ ways (stage 2) or weights split $\\symN$ ways (stage 3)'],
        [String.raw`16\,\symPsi/\symN`, 'stage 3: every byte of model state lives on exactly one GPU'],
      ],
      explain: 'With 64 GPUs, stage 1 already cuts 120 GB to 31 GB per GPU at no extra communication cost, which is why some form of it is used almost everywhere. Stage 3 makes the per-GPU state shrink without limit as GPUs are added: the memory problem of data parallelism is solved, and what is left is the cost of moving the weights around.',
    });

    figZero(p);

    p.prose(`
**FSDP**, PyTorch's Fully Sharded Data Parallel (first in Meta's FairScale library, in PyTorch since 2022, described by Zhao et al., 2023), is the ZeRO-3 idea as a wrapper. You wrap each transformer block as a unit; FSDP all-gathers a unit's weights just before it runs, frees them right after, does the same again in the backward pass, and reduce-scatters its gradients. It prefetches the next unit's weights while the current one computes, so the gathering overlaps with compute the same way DDP's buckets do.`);

    p.code(`
      from torch.distributed.fsdp import fully_shard

      model = Transformer(cfg)
      for block in model.layers:
          fully_shard(block)      # one unit: gathered, run, freed
      fully_shard(model)          # embeddings, final norm, head
      opt = torch.optim.AdamW(model.parameters(), lr=3e-4)

      for x, y in loader:         # each rank: its own slice of data
          loss = model(x, y)      # all-gather each block's weights
          loss.backward()         # gather again, reduce-scatter grads
          opt.step()              # each rank updates only its shard
          opt.zero_grad()
    `, { title: 'fsdp.py' });

    p.callout('warning', `ZeRO and FSDP shard the *model state*, not the activations: each GPU still stores the activations of its own micro-batch, and a single layer still has to fit on one GPU while it runs. Both limits call for splitting the model itself, which is what the next two methods do. (ZeRO-Offload and ZeRO-Infinity, 2021, go the other way and park state in CPU memory or on SSDs.)`, 'What sharding does not fix');

    // ------------------------------------------------------------------ tensor parallel
    p.h2('Tensor parallelism: split the matrices', 'tensor');
    p.prose(`
**Megatron-LM** (Shoeybi et al., NVIDIA, 2019) split the work *inside* each layer. Recall the transformer's MLP ([the Transformer chapter](#/transformer)), with the GeLU that GPT models use, a smooth version of ReLU: $\\text{GeLU}(\\symX \\symW_1)\\,\\symW_2$, where $\\symW_1$ widens each token from $d$ to $4d$ and $\\symW_2$ narrows it back.

A matrix product can be split by **columns**: column $j$ of $\\symX\\symW_1$ depends only on column $j$ of $\\symW_1$. So give GPU $i$ a block of $\\symW_1$'s columns, and it computes a block of the hidden layer by itself. GeLU works on each number separately, so it can be applied to each block without seeing the others. Then split $\\symW_2$ by **rows**, matching the blocks: each GPU multiplies its hidden block by its rows, which gives a *partial sum* of the output. One all-reduce adds the partial sums.`);

    p.math({
      label: 'The Megatron split of an MLP',
      tex: String.raw`\begin{aligned} &\mathrm{GeLU}(\symX \symW_1)\,\symW_2 \\ &\quad = \sum_{i=1}^{\symN} \mathrm{GeLU}\big(\symX\, \symW_1^{(i)}\big)\,\symW_2^{(i)} \end{aligned}`,
      code: `
        k = W1.shape[1] // N                 # hidden columns per GPU
        Z = 0
        for i in range(N):                   # GPU i, all in parallel
            W1_i = W1[:, i * k:(i + 1) * k]  # a block of columns
            W2_i = W2[i * k:(i + 1) * k, :]  # the matching rows
            Z = Z + gelu(X @ W1_i) @ W2_i    # partial sum on GPU i
        # the sum over GPUs is one all-reduce
      `,
      codeTitle: 'megatron_mlp.py',
      terms: [
        [String.raw`\symW_1^{(i)}`, 'the $i$-th block of columns of $\\symW_1$, stored only on GPU $i$'],
        [String.raw`\symW_2^{(i)}`, 'the $i$-th block of rows of $\\symW_2$, also only on GPU $i$'],
        [String.raw`\mathrm{GeLU}(\symX\symW_1^{(i)})`, 'GPU $i$\'s slice of the hidden layer, computed with no communication'],
        [String.raw`\sum_{i=1}^{\symN}`, 'add the partial outputs: the all-reduce'],
      ],
      explain: 'Each GPU stores $1/\\symN$ of the MLP\'s weights (and their gradients and optimizer state) and does $1/\\symN$ of its arithmetic. Attention splits the same way: give each GPU a subset of the heads (columns of $W_Q$, $W_K$, $W_V$, so every head\'s attention runs locally) and the matching rows of $W_O$, then all-reduce. So a transformer block costs two all-reduces in the forward pass and two in the backward pass. Megatron trained an 8.3-billion-parameter GPT-2-style model this way in 2019.',
    });

    figTensor(p);

    p.prose(`
The catch is in what gets all-reduced: activations, of size $s \\times b \\times d$, four times per block per step, and none of it can be hidden behind other work because the next operation needs the result. Run the same arithmetic as for data parallelism:`);

    p.math({
      label: 'The tensor-parallel ratio of talking to computing',
      tex: String.raw`\begin{aligned} \frac{\text{communication}}{\text{compute}} &\approx \frac{16\,\frac{\symN-1}{\symN}\, s b d \,/\, \symB}{72\, s b d^2 \,/\, (\symN F)} \\[4pt] &= \frac{2(\symN-1)\,F}{9\,\symB\, d} \end{aligned}`,
      code: `
        F, d, N = 0.4 * 989e12, 8192, 8
        for name, bw in [("NVLink", 450e9), ("InfiniBand", 50e9)]:
            print(name, 2 * (N - 1) * F / (9 * bw * d))
        # NVLink 0.17, InfiniBand 1.5
      `,
      codeTitle: 'tp_ratio.py',
      terms: [
        [String.raw`16\,\frac{\symN-1}{\symN}\, s b d`, 'bytes sent per block: four all-reduces of a $2 s b d$-byte tensor, each costing $2(\\symN-1)/\\symN$ times its size'],
        [String.raw`72\, s b d^2`, 'operations per block: about $12 d^2$ weights, 2 operations each per token forward, times 3 for forward plus backward'],
        [String.raw`\symN F`, 'the block\'s work is shared by $\\symN$ GPUs'],
      ],
      explain: 'This time the batch cancels: more tokens means more math but proportionally bigger activations to send, so no batch size rescues a slow link. With 8 GPUs on NVLink, communication is under a fifth of compute; over InfiniBand it would take longer than the math itself. That is the rule every large run follows: **tensor parallelism stays inside one server**, usually 8-way, on NVLink.',
    });

    // ------------------------------------------------------------------ pipeline
    p.h2('Pipeline parallelism: split the layers', 'pipeline');
    p.prose(`
To go beyond one server, split the model the other way: by depth. Cut the stack of layers into $\\symp$ **stages** and give each stage to a GPU (or a tensor-parallel group). The forward pass flows down the stages, each sending its output activations to the next; the backward pass flows back up, each sending the gradient with respect to its input to the previous one. These are point-to-point messages between neighbors, one activation tensor per micro-batch per stage boundary, much lighter than tensor parallelism's all-reduces, so they work fine across servers.

The problem is idleness. With one batch, stage 2 cannot start until stage 1 finishes, and in the backward pass the order reverses: at any moment only one GPU is working. **GPipe** (Huang et al., Google, 2018) fixed this by splitting each batch into $\\symm$ **micro-batches** and streaming them through, so different stages work on different micro-batches at the same time. Gradients from all micro-batches accumulate and the optimizer steps once at the end. What remains idle is the ramp-up at the start and the ramp-down at the end: the **pipeline bubble**.`);

    p.math({
      label: 'The pipeline bubble',
      tex: String.raw`\text{bubble} = \frac{\symp - 1}{\symm + \symp - 1}`,
      code: `
        def bubble(p, m, t_f=1, t_b=2):
            total = (m + p - 1) * (t_f + t_b)   # first F to last B
            busy = m * (t_f + t_b)              # each stage's work
            return 1 - busy / total             # (p - 1)/(m + p - 1)

        bubble(4, 1), bubble(4, 8), bubble(4, 32)  # 0.75, 0.27, 0.086
      `,
      codeTitle: 'bubble.py',
      terms: [
        [String.raw`\symp`, 'the number of pipeline stages'],
        [String.raw`\symm`, 'the number of micro-batches per optimizer step'],
        [String.raw`\symm + \symp - 1`, 'the length of the schedule in micro-batch slots: $\\symm$ slots of real work, plus $\\symp - 1$ slots for the first micro-batch to reach the last stage (and the last to come back)'],
        [String.raw`\symp - 1`, 'the slots each GPU spends idle'],
      ],
      explain: 'With one micro-batch and 4 stages, each GPU is idle three quarters of the time. With $\\symm = 32$, under 9%. So pipelines want many micro-batches, $\\symm$ several times $\\symp$; but micro-batches are slices of a global batch that cannot grow forever, which caps how many stages are worth having.',
    });

    figPipeline(p);

    p.prose(`
GPipe runs all forward passes, then all backward passes, so each stage must store the activations of all $\\symm$ micro-batches at once. **1F1B** (one forward, one backward), from the PipeDream work of Narayanan et al. (2019) and used in Megatron in its synchronous form, starts each micro-batch's backward pass as soon as possible and then alternates one forward with one backward. The bubble is the same, but a stage never holds more than $\\symp$ micro-batches in flight, a large saving when $\\symm \\gg \\symp$.

Later schedules shrink the bubble itself. **Interleaved 1F1B** (Narayanan et al., 2021) gives each GPU several smaller, non-adjacent chunks of layers, cutting the bubble by that factor at the price of more messages. Zero-bubble schedules (Qi et al., 2023) split the backward pass into its input-gradient and weight-gradient halves and use the weight half to fill the gaps; DeepSeek-V3's DualPipe (2024) also overlaps its expert communication inside the schedule.`);

    // ------------------------------------------------------------------ sequence and context
    p.h2('Sequence and context parallelism', 'sequence');
    p.prose(`
Two more splits, along the sequence, round out the toolbox.

**Sequence parallelism** (Korthikanti et al., 2022) is a companion to tensor parallelism. Inside a tensor-parallel group, the matrix multiplies are split, but the layer norms and dropouts between them are not: every GPU computes them on the whole $s \\times b \\times d$ tensor and stores identical copies of their activations. Sequence parallelism splits those regions along the tokens instead, and replaces each all-reduce with a reduce-scatter (into token slices) followed later by an all-gather (back to full), which costs exactly the same traffic. The replicated activations are now divided by the tensor-parallel size, for free.

**Context parallelism** is for long sequences, where one sequence's activations swamp a GPU even at $b = 1$. Every operation except attention treats tokens independently, so split the sequence itself across GPUs. Attention needs every key and value, so they are passed around a ring in blocks while each GPU computes attention for its own queries, the communication overlapping the math (**Ring Attention**, Liu et al., 2023). Another design, DeepSpeed-Ulysses (2023), uses an all-to-all to switch from splitting tokens to splitting heads for the attention step. Llama 3's long-context training stage used context parallelism.

A mixture-of-experts model adds a fifth split, **expert parallelism**: different experts live on different GPUs, and an all-to-all sends each token to the GPU holding its chosen expert. That is the subject of [the next chapter](#/moe).`);

    // ------------------------------------------------------------------ 3-D
    p.h2('3-D parallelism: how big runs combine them', 'three-d');
    p.prose(`
Each method splits something different and talks over a different pattern, so they compose. A large run arranges its GPUs as a grid with one axis per method, and the total is the product: $\\text{GPUs} = \\text{TP} \\times \\text{PP} \\times \\text{DP}$ (times context and expert parallelism when used). Narayanan et al. (2021) called this **PTD-P** and trained a trillion-parameter GPT on 3,072 A100s at 52% of peak. Each GPU then holds about $16\\symPsi / (\\text{TP} \\cdot \\text{PP})$ bytes of model state, divided further by DP for whatever ZeRO shards.

The placement rule follows from the traffic. The heaviest, least hideable traffic goes on the fastest wire.`);

    p.table(
      ['Method', 'Splits', 'Sends', 'How often', 'Usually over'],
      [
        ['tensor (+ sequence)', 'each layer\'s matrices', 'activations, all-reduce', '4 times per block per step, on the critical path', 'NVLink, inside one server'],
        ['context', 'the tokens of a sequence', 'keys and values, around a ring', 'every attention layer, overlapped', 'NVLink, or nearby servers'],
        ['pipeline', 'the stack of layers', 'activations to the next stage only', 'once per micro-batch per boundary', 'InfiniBand, between servers'],
        ['data (ZeRO / FSDP)', 'the batch, and the model state', 'gradients (and weights for ZeRO-3)', 'once per step, overlapped with backward', 'InfiniBand, outermost'],
        ['expert', 'the experts of an MoE layer', 'tokens, all-to-all', 'twice per MoE layer', 'InfiniBand ([#/moe](#/moe))'],
      ],
      { caption: 'Who talks to whom. Each row\'s communication pattern decides where its GPUs should sit.' },
    );

    fig3d(p);

    p.prose(`
Two real examples show the range. Meta's **Llama 3 405B** (2024) trained on up to 16,384 H100s with tensor parallelism 8 inside each server, pipeline parallelism 16, and data parallelism 128 with FSDP-style sharding, adding context parallelism for its long-context stage; they report about 40% of peak throughput. **DeepSeek-V3** (December 2024), a mixture-of-experts model, trained on 2,048 H800s with *no* tensor parallelism at all: 16-way pipeline parallelism with its DualPipe schedule, 64-way expert parallelism across 8 servers, and ZeRO-1 data parallelism, with much of its engineering spent hiding the all-to-all traffic behind compute.

The number that sums up all of this engineering is **MFU**, model FLOPs utilization: the fraction of the GPUs' peak arithmetic that goes into the model's own $6ND$. Every bubble, every exposed all-reduce, every recomputed forward pass lowers it. A large run that sustains 40% is doing well.`);

    p.callout('history', `Activation checkpointing: Chen et al., 2016. Ring all-reduce: Patarasuk and Yuan, 2009; Baidu, 2017; Horovod, 2018. GPipe: Huang et al., 2018. PipeDream and 1F1B: Narayanan et al., 2019. Megatron-LM tensor parallelism: Shoeybi et al., 2019. ZeRO: Rajbhandari et al., 2019. PyTorch DDP: Li et al., 2020. PTD-P and interleaved pipelines: Narayanan et al., 2021. Sequence parallelism and selective recomputation: Korthikanti et al., 2022. FSDP: Zhao et al., 2023. Ring Attention: Liu et al., 2023.`, 'Where the ideas came from');

    p.callout('idea', `Training with Adam in mixed precision stores **16 bytes per parameter** (2 weights, 2 gradients, 4 master copy, 4 + 4 Adam), plus **activations** that grow with tokens per GPU; **checkpointing** keeps only each block's input and recomputes the rest for about a third more compute. **Data parallelism** copies the model and averages gradients with an **all-reduce**; the **ring** version sends $2(\\symN-1)/\\symN$ times the gradient per GPU, nearly constant in $\\symN$, and hides behind the backward pass when each GPU has enough tokens. **ZeRO** stages 1, 2 and 3 (and **FSDP**) shard the optimizer state, gradients and weights, built from reduce-scatter and all-gather. **Tensor parallelism** splits each MLP by columns then rows, one all-reduce per block half, so it stays on NVLink. **Pipeline parallelism** splits the layers and streams $\\symm$ micro-batches, leaving a bubble of $(\\symp - 1)/(\\symm + \\symp - 1)$; **1F1B** keeps the bubble but caps the stored activations. Big runs nest them: tensor inside a server, pipeline and data across servers.`, 'Takeaways');

    // ------------------------------------------------------------------ exercises
    p.h2('Build it yourself', 'exercises');
    p.prose(`
1. **Ring all-reduce in NumPy (15 minutes).** Write \`ring_allreduce(grads)\` for a list of $\\symN$ arrays, using only "send one chunk to the right-hand neighbor" steps, as in the ring figure. Count the floats each GPU sends. *Success:* for $\\symN$ from 2 to 16 and random array lengths (including ones not divisible by $\\symN$; use \`np.array_split\`), every array equals \`sum(grads)\` to within rounding, and the count per GPU is $2(\\symN - 1)/\\symN$ of the array length, give or take one chunk's rounding.
2. **A training-memory calculator (30 minutes).** Write \`train_memory(n_params, L, d, s, b, ckpt, zero_stage, N, tp, pp)\` returning bytes per GPU for model state (16 bytes per parameter, divided by tensor and pipeline size and then by ZeRO stage) and activations ($34 s b d$ per layer, $L/\\text{pp}$ layers per GPU, divided by tp). *Success:* it reproduces the ZeRO paper's 120, 31.4, 16.6 and 1.9 GB for 7.5B parameters on 64 GPUs, and it tells you the smallest tensor and pipeline sizes that fit GPT-3 175B with ZeRO-1 and 64-way data parallelism on 80 GB GPUs.
3. **Tensor-parallel MLP, forward and backward (an hour).** In NumPy, split a two-layer MLP across $k$ simulated GPUs with column-parallel $\\symW_1$ and row-parallel $\\symW_2$. Write the backward pass too: work out where the second all-reduce goes (it is on the gradient with respect to $\\symX$). *Success:* outputs and every gradient match the unsplit network to about $10^{-12}$ for $k$ = 1, 2, 4 and 8, and you can point to exactly one sum in the forward pass and one in the backward pass.
4. **A pipeline simulator (an evening).** Write a scheduler that takes per-stage op lists (GPipe and 1F1B, as in the pipeline figure's listing), enforces the dependencies (a forward needs the previous stage's forward, a backward needs the next stage's backward), and returns start times. *Success:* measured idle time equals $(\\symp - 1)/(\\symm + \\symp - 1)$ for both schedules with backward twice as long as forward, peak stored micro-batches is $\\symm$ for GPipe and at most $\\symp$ for 1F1B, and an interleaved version with 2 chunks per GPU roughly halves the bubble.
5. **Small project: data parallelism and ZeRO-1 by hand (a weekend).** With \`torch.distributed\` and the \`gloo\` backend, launch 4 processes on a CPU (\`torchrun --nproc_per_node=4\`) and train a small MLP or character-level transformer. First write data parallelism yourself: each rank takes every fourth example, then \`all_reduce\` and average the gradients. Then write ZeRO-1: each rank keeps Adam state for only a quarter of the flattened parameters, updates only that quarter, and \`all_gather\`s the result. *Success:* the loss curve matches single-process training with the same global batch to within floating-point noise, and each rank's optimizer state is a quarter of the size. If you have GPUs, compare with \`DistributedDataParallel\` and \`fully_shard\`.`);
  },
};

export default chapter;
