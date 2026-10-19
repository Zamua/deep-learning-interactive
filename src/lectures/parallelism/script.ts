import type { LectureScript } from '../../lecture/types';

export const script: LectureScript = {
  id: 'parallelism',
  title: 'Training across many GPUs',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'intro',
      title: 'One GPU is not enough',
      codeTitle: 'the_bill.py',
      code: `
        n_params = 70e9       # a 70B model     #@model
        tokens = 15e12        # 15T tokens      #@model
        flops = 6 * n_params * tokens  # 6.3e24 #@flops
        F = 0.4 * 989e12      # one H100        #@gpu
        flops / F / 3.15e7    # ~500 years      #@years
        16 * n_params / 80e9  # 14 GPUs         #@mem
      `,
      beats: [
        { id: 'hello', say: 'How do you spread one training run across thousands of {GPUs|G P Us}?' },
        { id: 'budget', say: 'Start with the bill. Training costs about six operations per parameter, per token.', code: 'flops' },
        { id: 'model', say: 'Take a {70B|seventy B} model and fifteen trillion tokens, roughly the budget of Llama three, seventy B.', code: 'model' },
        { id: 'total', say: 'Six, times seventy billion, times fifteen trillion: about six times ten to the twenty-four operations.', code: 'flops' },
        { id: 'gpu', say: 'An {H100|H one hundred} manages about four hundred trillion of those per second, in practice.', code: 'gpu' },
        { id: 'years', say: 'So a single {GPU|G P U} would take about five hundred years.', code: 'years' },
        { id: 'mem', say: "Memory is no kinder: this model's training state is over a trillion bytes.", code: 'mem' },
        { id: 'many', say: 'So big models train on thousands of {GPUs|G P Us} at once. The question is how to split the work.' },
        { id: 'moves', say: 'There are only a few moves. Copy the model and split the data. Stop keeping copies. Split the matrices. Split the layers.' },
        { id: 'plan', say: 'Each one trades memory for communication. We start by counting where the memory goes.' },
      ],
    },
    {
      id: 'memory',
      title: 'Sixteen bytes per parameter',
      codeTitle: 'model_state.py',
      code: `
        weights = 2 * n_params   # bf16         #@w
        grads   = 2 * n_params   # bf16         #@g
        master  = 4 * n_params   # fp32 copy    #@master
        adam_m  = 4 * n_params   # fp32         #@adam
        adam_v  = 4 * n_params   # fp32         #@adam
        total = 16 * n_params                   #@total
      `,
      beats: [
        { id: 'recap', say: 'Training with Adam, in mixed precision, keeps five numbers for every parameter.' },
        { id: 'w', say: 'The weights, in sixteen-bit {bf16|B F sixteen}: two bytes.', code: 'w' },
        { id: 'g', say: 'The gradients, also two bytes.', code: 'g' },
        { id: 'master', say: 'A thirty-two-bit master copy of the weights, four bytes, so tiny updates do not round away.', code: 'master' },
        { id: 'adam', say: "And Adam's two running averages, m and v, four bytes each.", code: 'adam' },
        { id: 'total', say: 'That is sixteen bytes per parameter, before a single activation is stored.', code: 'total' },
        { id: 'big', say: 'For a seventy billion parameter model, that is {1.12|one point one two} terabytes: fourteen {GPUs|G P Us} of eighty gigabytes each, just to hold it.', code: 'total' },
        { id: 'share', say: 'Look at the split. Only two of the sixteen bytes are the weights the forward pass uses. Twelve are optimizer state.', code: ['master', 'adam'] },
        { id: 'fp32', say: 'Mixed precision does not shrink this: pure thirty-two-bit Adam is also sixteen bytes. It saves compute and activations instead.' },
      ],
    },
    {
      id: 'activations',
      title: 'Activations and checkpointing',
      codeTitle: 'activations.py',
      code: `
        per_layer = 34 * s * b * d   # bytes   #@act
        acts = L * per_layer   # GPT-3: 82 GB  #@act

        # checkpointing: keep block inputs
        acts = 2 * s * b * d * L + per_layer   #@ckpt
        x = checkpoint(block, x)  # rerun     #@redo
        cost = (2 + 4 + 2) / (2 + 4)   # 1.33  #@cost
      `,
      beats: [
        { id: 'need', say: "Backprop needs every layer's inputs from the forward pass, so the forward pass has to keep them." },
        { id: 'grows', say: 'Those saved values are the activations, and they grow with the tokens each {GPU|G P U} processes.' },
        { id: 'count', say: 'A {GPT|G P T} style block saves about thirty-four bytes, per token, per unit of model width.', code: 'act' },
        { id: 'gpt3', say: 'For {GPT-3|G P T three}, one two-thousand-token sequence needs about eighty-two gigabytes: more than a whole {GPU|G P U}.', code: 'act' },
        { id: 'forward', say: 'Here are eight layers. As the forward pass runs, each one fills up with saved activations.' },
        { id: 'backward', say: 'The backward pass frees them, last layer first. The peak comes right at the turn.' },
        { id: 'ckpt', say: "Activation checkpointing keeps only each block's input, a thin sliver, and throws the rest away.", code: 'ckpt' },
        { id: 'redo', say: "When the backward pass reaches a block, it reruns that block's forward pass, then backpropagates through it.", code: 'redo' },
        { id: 'peak', say: 'The peak drops from a hundred and thirty-six units to twenty-four.', code: 'ckpt' },
        { id: 'cost', say: 'The price is one extra forward pass: about a third more compute, for over ten times less memory.', code: 'cost' },
      ],
    },
    {
      id: 'data',
      title: 'Data parallelism',
      codeTitle: 'data_parallel.py',
      code: `
        x_i, y_i = x[i::N], y[i::N]  # slice i  #@slice
        model(x_i, y_i).backward()   # G_i      #@grad
        for w in model.parameters():
            dist.all_reduce(w.grad)  # sum      #@ar
            w.grad /= N              # average  #@ar
        opt.step()                   # same step #@step
      `,
      beats: [
        { id: 'copies', say: 'The simplest split is data parallelism. Put a full copy of the model on every {GPU|G P U}.' },
        { id: 'slice', say: 'Cut each batch into N slices, and give each {GPU|G P U} its own.', code: 'slice' },
        { id: 'grad', say: 'Each {GPU|G P U} runs forward and backward on its slice, and gets its own gradient.', code: 'grad' },
        { id: 'avg', say: 'Now average the gradients across {GPUs|G P Us}, and hand every {GPU|G P U} the average.', code: 'ar' },
        { id: 'same', say: 'Every copy takes the identical step, so the copies stay identical forever.', code: 'step' },
        { id: 'exact', say: "Because the loss is an average over the batch, this is exactly the whole batch's gradient. The math does not change." },
        { id: 'allreduce', say: 'The one new operation is called {all-reduce|all reduce}. Everyone contributes an array, and everyone gets back the sum.', code: 'ar' },
        { id: 'size', say: 'Here the array is the whole gradient: fourteen gigabytes for a seven billion parameter model, every step.', code: 'ar' },
      ],
    },
    {
      id: 'ring',
      title: 'Ring all-reduce',
      codeTitle: 'ring_allreduce.py',
      code: `
        # reduce-scatter                         #@rs
        for step in range(N - 1):                #@rs
            for i in range(N):
                c = (i - step) % N               #@rs
                grads[(i+1) % N][c] += grads[i][c]  #@rs
        # all-gather                             #@ag
        for step in range(N - 1):                #@ag
            for i in range(N):
                c = (i + 1 - step) % N           #@ag
                grads[(i+1) % N][c] = grads[i][c]   #@ag
        # sent per GPU: 2(N-1)/N * size          #@cost
      `,
      beats: [
        { id: 'naive', say: 'The obvious {all-reduce|all reduce} sends every gradient to one {GPU|G P U}, which adds them up and sends the sum back.' },
        { id: 'bottleneck', say: "That {GPU|G P U}'s link carries N minus one gradients in, and N minus one out. Add {GPUs|G P Us}, and it only gets worse." },
        { id: 'ring', say: 'The ring {all-reduce|all reduce} keeps every link equally busy. Arrange the {GPUs|G P Us} in a ring, and cut each gradient into N chunks.' },
        { id: 'rs', say: 'First, reduce-scatter. In each step, every {GPU|G P U} passes one chunk to its neighbor, who adds it to its own.', code: 'rs' },
        { id: 'own', say: 'After N minus one steps, each {GPU|G P U} holds the complete sum of one chunk.', code: 'rs' },
        { id: 'ag', say: 'Then all-gather: pass the finished chunks around the ring for N minus one more steps, until everyone has all of them.', code: 'ag' },
        { id: 'cost', say: 'Every step moves one N-th of the gradient per {GPU|G P U}. In total, each sends {2(N − 1)/N|two times N minus one, over N}, times the gradient.', code: 'cost' },
        { id: 'flat', say: 'That climbs from one toward two, and stops. Doubling the {GPUs|G P Us} barely changes the time. This is why data parallelism scales.', code: 'cost' },
        { id: 'latency', say: 'What does grow is the number of steps, each with a small fixed delay, so gradients travel in big buckets.' },
        { id: 'halves', say: 'Remember the two halves, reduce-scatter and all-gather. Sharding is built from them.' },
      ],
    },
    {
      id: 'overlap',
      title: 'Communication versus compute',
      codeTitle: 'ddp.py',
      code: `
        model = DDP(model)   # 25 MB buckets
        loss = model(x, y)                    #@fwd
        loss.backward()  # each bucket's      #@bwd
                         # all-reduce starts  #@bwd
                         # once it is ready   #@bwd
        opt.step()
        # talk / compute = 2F / (3 T bw)      #@ratio
      `,
      beats: [
        { id: 'hide', say: 'An {all-reduce|all reduce} only costs time if the {GPUs|G P Us} sit waiting for it.', code: 'fwd' },
        { id: 'buckets', say: "The backward pass produces gradients from the last layer to the first. PyTorch's {DDP|D D P} groups them into buckets.", code: 'bwd' },
        { id: 'overlap', say: "Each bucket's {all-reduce|all reduce} starts as soon as its gradients are ready, while the backward pass carries on with earlier layers.", code: 'bwd' },
        { id: 'ratio', say: 'Will the network keep up? Sending takes about four bytes per parameter over the link speed. Computing takes six operations per parameter per token.', code: 'ratio' },
        { id: 'cancel', say: 'Divide one by the other, and the model size cancels. What is left is two F, over three T B.', code: 'ratio' },
        { id: 'tokens', say: 'T is the number of tokens each {GPU|G P U} handles per step. Over InfiniBand, it needs to be well above five thousand.', code: 'ratio' },
        { id: 'shrink', say: 'Cut the tokens per {GPU|G P U}, and compute shrinks, but the gradient to send does not. The waiting grows.' },
        { id: 'limit', say: 'And the global batch is N times T. Past a critical batch size, bigger batches stop helping, so you cannot just keep adding {GPUs|G P Us}.' },
        { id: 'memory', say: 'Data parallelism has a second limit. Every {GPU|G P U} still holds all sixteen bytes per parameter.' },
      ],
    },
    {
      id: 'zero',
      title: 'ZeRO and FSDP',
      codeTitle: 'zero.py',
      code: `
        w, g = 2 * n_params, 2 * n_params
        opt = 12 * n_params
        if stage >= 1: opt /= N  # optimizer   #@s1
        if stage >= 2: g /= N    # gradients   #@s2
        if stage >= 3: w /= N    # weights     #@s3
        # 7.5B on 64 GPUs: 120 GB each,        #@nums
        #   then 31.4, 16.6 and 1.9 GB         #@nums
      `,
      beats: [
        { id: 'copies', say: 'With N data-parallel {GPUs|G P Us}, there are N identical copies of everything, most of them needed only briefly.' },
        { id: 'zero', say: '{ZeRO|Zero}, the zero redundancy optimizer, from Microsoft in 2019, removes the copies in three stages.' },
        { id: 's1', say: "Stage one shards the optimizer state. Each {GPU|G P U} keeps Adam's state for one N-th of the parameters, and updates only that slice.", code: 's1' },
        { id: 'rs', say: 'Gradients are reduce-scattered, so each {GPU|G P U} gets the averaged gradient for exactly its slice. Then an all-gather shares the new weights.', code: 's1' },
        { id: 'free', say: 'Reduce-scatter plus all-gather is an {all-reduce|all reduce}: the same traffic as before. And twelve of the sixteen bytes are now divided by N.', code: 's1' },
        { id: 's2', say: 'Stage two also drops the gradients a {GPU|G P U} does not own. Same traffic again.', code: 's2' },
        { id: 's3', say: "Stage three shards the weights too. Each layer's weights are gathered just before it runs, and freed right after.", code: 's3' },
        { id: 'cost3', say: 'That is one and a half times the traffic, but every byte of state lives on exactly one {GPU|G P U}.', code: 's3' },
        { id: 'nums', say: "The {ZeRO|Zero} paper's example: seven and a half billion parameters on sixty-four {GPUs|G P Us}. A hundred and twenty gigabytes each drops to thirty-one, seventeen, and under two.", code: 'nums' },
        { id: 'fsdp', say: "PyTorch's {FSDP|F S D P}, fully sharded data parallel, is stage three, wrapped around each block." },
        { id: 'acts', say: 'Sharding does not touch the activations, and each layer must still fit on one {GPU|G P U}. For that, we split the model itself.' },
      ],
    },
    {
      id: 'tensor',
      title: 'Tensor parallelism',
      codeTitle: 'megatron_mlp.py',
      code: `
        # GPU i: columns i of W1, rows i of W2
        Y_i = gelu(X @ W1_i)    # no communication  #@col
        Z_i = Y_i @ W2_i        # a partial sum     #@row
        Z = all_reduce(Z_i)     # sum over GPUs     #@ar
        # per block: 2 all-reduces fwd, 2 bwd       #@attn
      `,
      beats: [
        { id: 'inside', say: '{Megatron-LM|Megatron L M}, from {NVIDIA|Nvidia} in 2019, splits the work inside each layer.' },
        { id: 'mlp', say: "Take the transformer's {MLP|M L P}. X times {W₁|W one}, a {GeLU|gell you}, then times {W₂|W two}." },
        { id: 'cols', say: 'A matrix product can be split by columns. Each column of the output needs only the matching column of {W₁|W one}.', code: 'col' },
        { id: 'split1', say: "So give each {GPU|G P U} a block of {W₁|W one}'s columns. It computes its block of the hidden layer on its own.", code: 'col' },
        { id: 'gelu', say: 'The {GeLU|gell you} works on each number separately, so it never needs the other block.', code: 'col' },
        { id: 'rows', say: "Then split {W₂|W two} by rows, matching the blocks. Each {GPU|G P U}'s product is a partial sum of the output.", code: 'row' },
        { id: 'ar', say: 'One {all-reduce|all reduce} adds the partial sums, and the result matches the one-{GPU|G P U} answer.', code: 'ar' },
        { id: 'wrong', say: 'The order matters. Split {W₁|W one} by rows instead, and the {GeLU|gell you} lands on partial sums, which is simply wrong without an extra {all-reduce|all reduce}.' },
        { id: 'attn', say: 'Attention splits the same way, by heads. So each block costs two {all-reduces|all reduces} forward, and two backward.', code: 'attn' },
        { id: 'ratio', say: 'But these carry activations, and the next step waits for them. Over InfiniBand, they would take longer than the math.' },
        { id: 'nvlink', say: 'So tensor parallelism stays inside one server, usually eight ways, on {NVLink|N V link}.' },
      ],
    },
    {
      id: 'pipeline',
      title: 'Pipeline parallelism',
      codeTitle: 'pipeline.py',
      code: `
        p, m = 4, 8   # stages, micro-batches  #@pm
        # stage i: forward j after stage i-1  #@fwd
        #   sends its activations             #@fwd
        # backward j after stage i+1          #@bwd
        #   sends back the gradient           #@bwd
        bubble = (p - 1) / (m + p - 1)  # 0.27  #@bubble
      `,
      beats: [
        { id: 'depth', say: 'To reach beyond one server, split the model by depth. Cut the layers into p stages, one per {GPU|G P U}.' },
        { id: 'send', say: 'Activations flow forward to the next stage, and gradients flow back. These are small messages between neighbors, fine across servers.', code: ['fwd', 'bwd'] },
        { id: 'idle', say: 'The problem is idleness. With one batch, only one {GPU|G P U} works at a time.' },
        { id: 'micro', say: '{GPipe|G pipe}, from Google in 2018, splits each batch into m micro-batches, and streams them through.', code: 'pm' },
        { id: 'fill', say: 'Now different stages work on different micro-batches at the same time.' },
        { id: 'bubble', say: 'What stays idle is the ramp at the start and the end of every step. That is the pipeline bubble.', code: 'bubble' },
        { id: 'formula', say: 'Its share of the time is {(p − 1)/(m + p − 1)|p minus one, over m plus p minus one}.', code: 'bubble' },
        { id: 'numbers', say: 'With four stages and one micro-batch, three quarters idle. With eight, about a quarter. With thirty-two, under nine percent.', code: 'bubble' },
        { id: 'onef', say: '{1F1B|One F one B}, one forward then one backward, starts each backward pass as early as it can.' },
        { id: 'memory', say: "The bubble is the same, but a stage now holds at most p micro-batches' activations, instead of all m." },
        { id: 'later', say: 'Interleaved and zero-bubble schedules shrink it further, for more messages.' },
      ],
    },
    {
      id: 'sequence',
      title: 'Sequence, context, experts',
      codeTitle: 'more_splits.py',
      code: `
        # sequence: norms and dropouts,     #@seq
        #   split by token                  #@seq
        # context: one sequence across      #@ctx
        #   GPUs; keys, values in a ring    #@ctx
        # expert: experts on many GPUs;     #@ep
        #   all-to-all routes each token    #@ep
      `,
      beats: [
        { id: 'intro', say: 'Three more splits complete the toolbox.' },
        { id: 'seq', say: 'Sequence parallelism helps tensor parallelism. Layer norms and dropouts are copied across a tensor group, so split them by token instead.', code: 'seq' },
        { id: 'free', say: 'The {all-reduce|all reduce} becomes a reduce-scatter and an all-gather: the same traffic, and those activations shrink for free.', code: 'seq' },
        { id: 'ctx', say: "Context parallelism is for very long sequences. Split one sequence's tokens across {GPUs|G P Us}.", code: 'ctx' },
        { id: 'ringattn', say: 'Attention needs every key and value, so they travel around a ring in blocks, while each {GPU|G P U} works on its own queries. That is ring attention.', code: 'ctx' },
        { id: 'ep', say: 'And a mixture-of-experts model puts different experts on different {GPUs|G P Us}, with an all-to-all sending each token to its expert. That is expert parallelism.', code: 'ep' },
      ],
    },
    {
      id: 'threed',
      title: 'Putting it together',
      codeTitle: 'layout.py',
      code: `
        GPUs = TP * PP * DP     # times CP, EP     #@prod
        # TP: inside a server, every layer         #@tp
        # PP: across servers, neighbors only       #@pp
        # DP: outermost, once per step             #@dp
        # Llama 3 405B: TP 8, PP 16, DP 128        #@llama
        #   = 16,384 H100s                          #@llama
      `,
      beats: [
        { id: 'compose', say: 'Each method splits something different, so they compose. Arrange the {GPUs|G P Us} as a grid, one axis per method.', code: 'prod' },
        { id: 'tp', say: 'Tensor parallelism has the heaviest traffic, so it gets the fastest wire: the {GPUs|G P Us} inside one server.', code: 'tp' },
        { id: 'pp', say: 'Pipeline stages span servers. They only talk to their neighbors, with small messages.', code: 'pp' },
        { id: 'dp', say: 'Data parallelism, with {ZeRO|Zero} or {FSDP|F S D P}, wraps around the outside. Its gradients move once per step, hidden behind the backward pass.', code: 'dp' },
        { id: 'llama', say: "Meta's {Llama 3 405B|Llama three, four oh five B} trained on up to {16K|sixteen thousand} {H100s|H one hundreds}: tensor eight, pipeline sixteen, data one hundred and twenty-eight.", code: 'llama' },
        { id: 'deepseek', say: '{DeepSeek-V3|DeepSeek V three} went another way: no tensor parallelism at all, sixteen pipeline stages, sixty-four-way expert parallelism, and {ZeRO|Zero} stage one.' },
        { id: 'mfu', say: 'The score for all this engineering is model {FLOPs|flops} utilization: the share of peak arithmetic that goes into the model itself.' },
        { id: 'forty', say: 'Every bubble, exposed {all-reduce|all reduce} and recomputed forward pass lowers it. Forty percent, at this scale, is doing well.' },
      ],
    },
    {
      id: 'outro',
      title: 'The whole picture',
      codeTitle: 'recap.py',
      code: `
        # memory: 16 bytes/param + activations  #@mem
        # checkpointing: +1/3 compute            #@ckpt
        # data: ring all-reduce, 2(N-1)/N        #@dp
        # ZeRO / FSDP: shard the state           #@zero
        # tensor: columns, then rows, NVLink     #@tp
        # pipeline: bubble (p-1)/(m+p-1)         #@pp
      `,
      beats: [
        { id: 'recap', say: 'So, the whole picture.' },
        { id: 'mem', say: 'Training stores sixteen bytes per parameter, plus activations that grow with the tokens on each {GPU|G P U}.', code: 'mem' },
        { id: 'ckpt', say: 'Checkpointing trades a third more compute for most of the activation memory.', code: 'ckpt' },
        { id: 'dp', say: 'Data parallelism copies the model and averages gradients, with a ring {all-reduce|all reduce} whose cost barely grows with the {GPUs|G P Us}.', code: 'dp' },
        { id: 'zero', say: '{ZeRO|Zero} and {FSDP|F S D P} stop keeping copies, using reduce-scatter and all-gather.', code: 'zero' },
        { id: 'tp', say: 'Tensor parallelism splits each layer by columns, then rows, and lives inside a server.', code: 'tp' },
        { id: 'pp', say: 'Pipeline parallelism splits the layers, and micro-batches shrink the bubble.', code: 'pp' },
        { id: 'wire', say: 'Underneath all of it is one rule: the heavier and less hideable the traffic, the faster the wire it gets.' },
        { id: 'bye', say: 'Memory decides what must be split. Bandwidth decides where each split can live.' },
      ],
    },
  ],
};
