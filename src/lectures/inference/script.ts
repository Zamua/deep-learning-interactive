import type { LectureScript } from '../../lecture/types';

export const script: LectureScript = {
  id: 'inference',
  title: 'Fast inference',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'intro',
      title: 'Serving a model',
      codeTitle: 'serve.py',
      code: `
        # trained once:
        model = train(data)               #@train

        # served for every token, forever:
        while True:                       #@serve
            request = queue.get()         #@serve
            for tok in generate(request): #@gen
                stream(tok)               #@gen
      `,
      beats: [
        { id: 'hello', say: 'This lecture is about what comes after training: serving a model to people, fast and cheaply.' },
        { id: 'once', say: 'A model is trained once.', code: 'train' },
        { id: 'forever', say: 'But it is served every time anyone uses it: every token of every answer is another forward pass.', code: 'serve' },
        { id: 'surprise', say: 'The surprise at its center: generating text is slow for a reason that has little to do with arithmetic.', code: 'gen' },
        { id: 'wait', say: 'Generating a token for one user, a GPU spends almost all its time waiting for memory.', code: 'gen' },
        { id: 'plan', say: 'Once you see that, the tricks follow: batching, paged attention, quantization, and speculative decoding.' },
        { id: 'distill', say: 'We end with distillation, and with the tradeoff between latency and throughput.' },
        { id: 'example', say: 'Our running example is {Llama 3 8B|Llama three, eight B}, eight billion parameters, on one {H100|H one hundred} GPU.' },
      ],
    },
    {
      id: 'prefill',
      title: 'Prefill and decode',
      codeTitle: 'generate.py',
      code: `
        prompt = tokenize(text)    # T tokens
        logits, cache = model(prompt)   #@prefill
        tok = sample(logits[-1])        #@prefill
        for step in range(max_new):     #@decode
            logits, cache = model([tok], cache)  #@decode
            tok = sample(logits[-1])    #@decode

        # FLOPs per token: about 2 * N  #@flops
      `,
      beats: [
        { id: 'loop', say: 'A language model writes one token at a time: run the model, sample a token, append it, repeat.', code: 'decode' },
        { id: 'cache', say: 'A server keeps the keys and values of earlier tokens in the {KV|K V} cache, so each step computes only the newest token.', code: 'decode' },
        { id: 'prefill', say: 'First, prefill. The whole prompt is known, so all its tokens go through the model in one pass.', code: 'prefill' },
        { id: 'ttft', say: 'Prefill fills the cache and gives the first new token. Its duration is the time to first token.', code: 'prefill' },
        { id: 'decode', say: 'Then, decode. Each new token depends on the last, so each needs a pass of its own, with one token in it.', code: 'decode' },
        { id: 'tpot', say: 'Its duration, the time per output token, is how fast the answer streams onto the screen.', code: 'decode' },
        { id: 'flops', say: 'How much arithmetic is a pass? Each weight does a multiply and an add per token: about two N operations for N parameters.', code: 'flops' },
        { id: 'fast', say: 'For our model, sixteen billion per token. An {H100|H one hundred} could do that in sixteen microseconds.', code: 'flops' },
        { id: 'slow', say: 'In fact, a decode step takes about five milliseconds: three hundred times longer. Where does the time go?' },
      ],
    },
    {
      id: 'roofline',
      title: 'Why decode is memory-bound',
      codeTitle: 'roofline.py',
      code: `
        peak = 989e12   # FLOP/s, bf16   #@peak
        bw = 3.35e12    # bytes/s, HBM   #@bw
        ridge = peak / bw   # 295        #@ridge

        def step_time(flops, nbytes):
            return max(flops / peak,     #@max
                       nbytes / bw)      #@max

        N = 8.03e9
        step_time(2 * N, 2 * N)  # 4.8 ms   #@decode
      `,
      beats: [
        { id: 'two', say: 'An {H100|H one hundred} has two speeds, and they are very different.' },
        { id: 'peak', say: 'Its compute: nearly a thousand trillion operations per second, on sixteen-bit numbers.', code: 'peak' },
        { id: 'bw', say: 'Its memory bandwidth: three point three five trillion bytes per second.', code: 'bw' },
        { id: 'ratio', say: 'Divide the two: the chip does about two hundred and ninety five operations in the time it takes to fetch one byte.', code: 'ridge' },
        { id: 'intensity', say: "What matters is an operation's arithmetic intensity, I: operations per byte moved." },
        { id: 'matmul', say: 'When a weight matrix multiplies B token vectors, each weight fetched is used once per token. The intensity is about B.' },
        { id: 'roof', say: 'The roofline model: the time is the larger of operations over peak, and bytes over bandwidth.', code: 'max' },
        { id: 'plot', say: 'On log axes, that is a rising slope, limited by memory, meeting a flat roof, limited by compute, at the ridge.', code: 'max' },
        { id: 'decode', say: 'A decode step for one user has B equal to one. It fetches every weight to use it exactly once.', code: 'decode' },
        { id: 'slope', say: 'That puts it far down the slope, at one operation per byte. A long prefill sits past the ridge.' },
        { id: 'answer', say: 'Sixteen gigabytes at {3.35|three point three five} terabytes per second take {4.8|four point eight} milliseconds, with the arithmetic units over ninety nine percent idle.', code: 'decode' },
      ],
    },
    {
      id: 'batching',
      title: 'Batching',
      codeTitle: 'throughput.py',
      code: `
        def tokens_per_s(B, ctx):
            flops = B * 2 * N              #@flops
            nbytes = (2 * N                #@w
                      + B * ctx * kv_tok)  #@kv
            t = max(flops / peak, nbytes / bw)
            return B / t                   #@tps

        tokens_per_s(1, 1024)    # 207     #@one
        tokens_per_s(64, 1024)   # 8,700   #@many
        tokens_per_s(64, 8192)   # 2,530   #@long
      `,
      beats: [
        { id: 'idea', say: 'If each fetch of the weights serves only one token, the cure is to make it serve many.' },
        { id: 'batch', say: 'A server decodes the next token for B users in one step. Every weight matrix now multiplies B rows instead of one.', code: 'flops' },
        { id: 'once', say: 'The weights still cross the bus once per step, so the step costs about the same, and yields B tokens.', code: 'w' },
        { id: 'one', say: 'At batch one, our model makes about two hundred tokens per second.', code: 'one' },
        { id: 'many', say: 'At batch sixty four, about eight thousand seven hundred: forty two times more, for one and a half times the time.', code: 'many' },
        { id: 'user', say: "Each user's tokens slow only a little. Total throughput is what the operator pays for: this is the first lever.", code: 'tps' },
        { id: 'cache', say: 'One part does not batch: every sequence reads its own {KV|K V} cache, and nobody else can reuse it.', code: 'kv' },
        { id: 'long', say: 'With eight thousand tokens of context, the caches outweigh the weights, throughput falls to two and a half thousand, and the batch no longer fits.', code: 'long' },
        { id: 'gqa', say: 'That is why shrinking the cache, with grouped-query attention or eight-bit caches, matters so much.' },
      ],
    },
    {
      id: 'continuous',
      title: 'Continuous batching',
      codeTitle: 'scheduler.py',
      code: `
        slots = [None] * B
        while queue or any(slots):
            for i in range(B):                #@join
                if slots[i] is None and queue:   #@join
                    slots[i] = queue.pop(0)   #@join
            decode_step(slots)                #@step
            for i in range(B):                #@leave
                if slots[i] and slots[i].done:   #@leave
                    slots[i] = None           #@leave
      `,
      beats: [
        { id: 'real', say: 'Real requests arrive at random, wanting answers of very different lengths.' },
        { id: 'static', say: 'Static batching groups requests, and runs each group until its last member finishes.' },
        { id: 'idle', say: 'Every request that finishes early leaves its slot idle, while newcomers wait.' },
        { id: 'picture', say: 'Here are thirty requests in six slots. The red hatching is wasted time; the work takes a hundred and twenty six steps.' },
        { id: 'cont', say: 'Continuous batching decides the batch again at every single step.', code: 'step' },
        { id: 'leave', say: 'When a sequence finishes, it leaves.', code: 'leave' },
        { id: 'join', say: 'And a waiting request takes its slot on the very next step, after its prefill.', code: 'join' },
        { id: 'result', say: 'The same thirty requests finish in sixty four steps, about half the time.' },
        { id: 'orca', say: 'This is iteration-level scheduling, from the Orca system in 2022, now standard in serving engines.' },
      ],
    },
    {
      id: 'paged',
      title: 'Paged attention',
      codeTitle: 'paged_kv.py',
      code: `
        BLOCK = 16          # tokens per block  #@block
        free = list(range(64))                  #@block
        table = {}          # seq -> its blocks #@table

        def append_token(seq):
            blocks = table[seq.id]
            if seq.len == BLOCK * len(blocks):  #@grow
                blocks.append(free.pop())       #@grow
            seq.len += 1

        def finish(seq):
            free.extend(table.pop(seq.id))      #@free
      `,
      beats: [
        { id: 'grow', say: "Batching wants many sequences in memory, but each one's cache grows every step, to a length nobody knows in advance." },
        { id: 'reserve', say: 'Early servers reserved one contiguous slab per request, big enough for its longest possible answer.' },
        { id: 'waste', say: 'Most answers stop far short, so most of each slab sits empty: real systems used only twenty to forty percent of it.' },
        { id: 'paged', say: "Paged attention, the heart of the {vLLM|V L L M} server, borrowed the operating system's fix: virtual memory." },
        { id: 'blocks', say: 'Split the cache into small blocks of sixteen tokens.', code: 'block' },
        { id: 'ondemand', say: 'A sequence takes one more block, from anywhere in memory, only when its last block fills up.', code: 'grow' },
        { id: 'table', say: "A block table records where each sequence's blocks live, and the attention kernel follows it.", code: 'table' },
        { id: 'free', say: 'When a sequence finishes, its blocks go straight back to the pool.', code: 'free' },
        { id: 'tail', say: "The only waste is the unfilled tail of each sequence's last block." },
        { id: 'result', say: 'Here, three times as many sequences run at once, and three times as many finish. The paper reported two to four times the throughput.' },
      ],
    },
    {
      id: 'quant',
      title: 'Quantization',
      codeTitle: 'quantize.py',
      code: `
        # absmax (symmetric), b bits
        qmax = 2 ** (b - 1) - 1   # 127 at 8 bits  #@qmax
        s = np.abs(w).max() / qmax     #@scale
        w_int = np.round(w / s)        #@round
        w_hat = s * w_int              #@deq

        # zero point (asymmetric), 8 bits
        s = (w.max() - w.min()) / 255  #@zs
        z = np.round(-w.min() / s)     #@zz
        w_int = np.round(w / s) + z    #@zz
        w_hat = s * (w_int - z)        #@zz
      `,
      beats: [
        { id: 'bytes', say: 'If decode time is bytes over bandwidth, the most direct speedup is fewer bytes.' },
        { id: 'idea', say: 'Quantization stores each weight in eight bits, or four, instead of sixteen: half the bytes, or a quarter.' },
        { id: 'grid', say: 'An integer format has evenly spaced values. So we choose a scale, s: what one integer step is worth.', code: 'scale' },
        { id: 'absmax', say: 'The simplest is absmax: the largest weight lands on the largest integer, a hundred and twenty seven in int eight, or seven at four bits.', code: ['qmax', 'scale'] },
        { id: 'round', say: 'Then divide every weight by s, and round to the nearest whole number. That integer is what we store.', code: 'round' },
        { id: 'back', say: 'To use it, multiply back by s. Each weight is now off by at most half a step.', code: 'deq' },
        { id: 'catch', say: 'The catch: one single large weight sets the step size for every other weight.', code: 'scale' },
        { id: 'relu', say: 'Absmax also wastes codes on lopsided values, like {ReLU|ray-loo} outputs, which are never negative.' },
        { id: 'zp', say: 'Zero-point quantization maps the actual range, from min to max, onto every code.', code: 'zs' },
        { id: 'z', say: 'And it stores one more number, the zero point z: the integer that stands for exactly zero.', code: 'zz' },
        { id: 'bits', say: 'Each extra bit halves the step and the error: about six decibels per bit.' },
      ],
    },
    {
      id: 'outliers',
      title: 'Scales and outliers',
      codeTitle: 'granularity.py',
      code: `
        # per tensor: one scale
        s = abs(W).max() / 7                  #@tensor
        # per channel: a scale per row
        s = abs(W).max(1, keepdims=True) / 7  #@chan
        # per group: a scale per 32 weights
        G = W.reshape(-1, 32)                 #@group
        s = abs(G).max(1, keepdims=True) / 7  #@group

        # LLM.int8(): split off outlier features
        big = abs(X).max(0) >= 6.0            #@find
        Y = X[:, big] @ W[big]   # 16 bits    #@hi
        Y += int8_mm(X[:, ~big], W[~big])     #@lo
      `,
      beats: [
        { id: 'share', say: 'How many weights should share one scale?' },
        { id: 'tensor', say: 'Per-tensor quantization uses one scale for a whole matrix. Cheap, but its largest weight sets the step everywhere.', code: 'tensor' },
        { id: 'crush', say: 'Here, at four bits, a row of small weights collapses onto just three values.', code: 'tensor' },
        { id: 'chan', say: 'Per-channel quantization gives every row its own scale, so small rows get a fine grid of their own.', code: 'chan' },
        { id: 'group', say: 'At four bits, the norm is a scale per group of a few dozen weights, for a fraction of a bit extra.', code: 'group' },
        { id: 'acts', say: 'Activations are harder. From about seven billion parameters up, a few features carry values up to twenty times larger than the rest.' },
        { id: 'break', say: 'Quantize them together, and the scale they force on each token crushes the ordinary features.' },
        { id: 'int8', say: '{LLM.int8()|L L M int eight} finds the few features that ever reach magnitude six, and multiplies just those in sixteen bits.', code: ['find', 'hi'] },
        { id: 'rest', say: 'Everything else runs in int eight: more than ninety nine point nine percent of the multiplications.', code: 'lo' },
        { id: 'int4', say: "At four bits, plain rounding loses too much. {GPTQ|G P T Q} corrects for each column's rounding as it goes, and {AWQ|A W Q} protects the channels that meet the largest activations." },
        { id: 'fp8', say: 'Newer GPUs also compute in eight-bit floats, {fp8|F P eight}, which shrinks activations too, and speeds up compute-bound work.' },
      ],
    },
    {
      id: 'specidea',
      title: 'Speculative decoding',
      codeTitle: 'speculative.py',
      code: `
        def speculative_pass(p, q, k):
            out = []
            for i in range(k):
                x = sample(q)             #@draft
                if rand() < min(1, p[x] / q[x]):   #@accept
                    out.append(x)         #@accept
                    continue
                r = np.maximum(p - q, 0)  #@resid
                out.append(sample(r / r.sum()))    #@resid
                return out
            out.append(sample(p))  # bonus   #@bonus
            return out
      `,
      beats: [
        { id: 'single', say: 'Batching serves more users. It does nothing for one user waiting on a long answer.' },
        { id: 'spec', say: 'Speculative decoding speeds up that one user, without changing the output distribution at all.' },
        { id: 'roof', say: 'It rests on the roofline: checking five tokens in one pass costs about as much as making one.' },
        { id: 'draft', say: 'So a small, fast draft model, with distribution q, guesses k tokens, one at a time. Each guess is cheap.', code: 'draft' },
        { id: 'verify', say: 'Then the big target model, with distribution p, runs once on all k guesses together, like a tiny prefill.' },
        { id: 'positions', say: 'That one pass gives p at every guessed position, and at one more after them.' },
        { id: 'walk', say: 'Now walk left to right, keeping or rejecting each guess.', code: 'accept' },
        { id: 'reject', say: 'At the first rejection, a corrected token is drawn, and the rest of the guesses are thrown away.', code: 'resid' },
        { id: 'bonus', say: "If all k survive, the target's distribution at the end gives a bonus token for free.", code: 'bonus' },
        { id: 'range', say: 'So every pass of the big model yields at least one token, and up to k plus one.' },
      ],
    },
    {
      id: 'specrule',
      title: 'The accept rule',
      codeTitle: 'accept.py',
      code: `
        x = sample(q)              # the guess
        if rand() < min(1, p[x] / q[x]):   #@accept
            token = x                      #@accept
        else:
            r = np.maximum(p - q, 0)       #@resid
            token = sample(r / r.sum())    #@resid

        # why the output is exactly p:
        kept = np.minimum(p, q)            #@kept
        alpha = kept.sum()                 #@alpha
        out = kept + (1 - alpha) * r / r.sum()   #@sum
        np.allclose(out, p)   # True       #@sum
      `,
      beats: [
        { id: 'rule', say: "Here is the rule. Keep the draft's token x with probability p of x over q of x, capped at one.", code: 'accept' },
        { id: 'like', say: 'If the target likes the token at least as much as the draft did, always keep it.', code: 'accept' },
        { id: 'over', say: 'If the draft was overconfident, keep it only part of the time, in proportion.', code: 'accept' },
        { id: 'resid', say: 'On a rejection, sample from the residual: the part of p that sticks out above q, renormalized.', code: 'resid' },
        { id: 'under', say: 'Rejections take probability away where q is too high; the residual puts it back where q is too low.', code: 'resid' },
        { id: 'proof', say: 'Why exactly p? The draft proposes x and keeps it with probability q times p over q, capped: the smaller of p and q.', code: 'kept' },
        { id: 'alpha', say: 'Add that up over all tokens, and you get alpha, the overall chance a guess is kept.', code: 'alpha' },
        { id: 'left', say: "A rejection happens with probability one minus alpha, and the residual's total is also one minus alpha. They cancel." },
        { id: 'sum', say: 'So the rejected path adds back exactly what the kept path is missing: the two add up to p, for every token, with no approximation.', code: 'sum' },
        { id: 'check', say: 'You can check it by brute force: run thousands of passes, and the output frequencies settle onto p.' },
      ],
    },
    {
      id: 'specspeed',
      title: 'How much it buys',
      codeTitle: 'expected.py',
      code: `
        def expected_tokens(alpha, k):
            # 1 + alpha + ... + alpha**k  #@series
            top = 1 - alpha ** (k + 1)    #@closed
            return top / (1 - alpha)      #@closed

        def speedup(alpha, k, c):
            n = expected_tokens(alpha, k)
            return n / (k * c + 1)        #@cost

        expected_tokens(0.8, 4)   # 3.36  #@ex
        speedup(0.8, 8, 0.05)     # 3.09  #@best
      `,
      beats: [
        { id: 'one', say: 'Suppose each guess survives with probability alpha. A pass always yields one token.', code: 'series' },
        { id: 'two', say: 'It yields a second if the first guess survives: probability alpha.', code: 'series' },
        { id: 'three', say: 'A third if the first two survive: alpha squared. And so on, up to k plus one.', code: 'series' },
        { id: 'sum', say: 'The expected count is a geometric series, with a short closed form.', code: 'closed' },
        { id: 'eg', say: 'With alpha at {0.8|zero point eight} and four guesses, that is about {3.4|three point four} tokens per pass, with a cap of five.', code: 'ex' },
        { id: 'cost', say: 'Guesses are not free. If a draft step costs c of a target step, a pass costs k times c, plus one.', code: 'cost' },
        { id: 'best', say: 'With a draft twenty times faster than the target, the best gain is about three times.', code: 'best' },
        { id: 'fit', say: 'A draft that agrees with its target beats a fast one. The papers reported two to three times faster decoding, with identical outputs.' },
      ],
    },
    {
      id: 'distill',
      title: 'Distillation and the tradeoff',
      codeTitle: 'distill.py',
      code: `
        def distill(t_logits, s_logits, tau=2):
            p = softmax(t_logits / tau)  # teacher  #@soft
            q = softmax(s_logits / tau)  # student  #@soft
            kl = (p * np.log(p / q)).sum(-1)          #@kl
            return tau ** 2 * kl.mean()

        # what a server is judged by
        ttft = wait + prefill_time        #@ttft
        tpot = step_time(B)               #@tpot
        throughput = B / step_time(B)     #@thr
      `,
      beats: [
        { id: 'change', say: 'Everything so far serves a fixed model more efficiently. The bluntest tool changes the model.' },
        { id: 'student', say: 'Distillation trains a small student to imitate a big teacher, and serves the student.' },
        { id: 'soft', say: "The student learns to match the teacher's whole distribution, softened by a temperature, tau.", code: 'soft' },
        { id: 'why', say: 'That says far more than the one token that came next: which words were likely, and which absurd.', code: 'soft' },
        { id: 'kl', say: 'The loss is the {KL|K L} divergence from teacher to student: zero when they agree on every token.', code: 'kl' },
        { id: 'llm', say: "For language models, the teacher often just writes text for the student to learn from. That is how DeepSeek distilled {R1|R one} into small models." },
        { id: 'tradeoff', say: 'Finally, the numbers a server is judged by pull against each other.' },
        { id: 'ttft', say: 'Time to first token, set by waiting and by the prefill.', code: 'ttft' },
        { id: 'tpot', say: 'Time per output token, set by the decode step.', code: 'tpot' },
        { id: 'thr', say: 'And throughput: tokens per second per GPU, which sets the cost of every token.', code: 'thr' },
        { id: 'pick', say: 'Bigger batches raise throughput and slow each user. A server picks the point on this curve that still meets its latency target.' },
      ],
    },
    {
      id: 'outro',
      title: 'Recap',
      codeTitle: 'recap.py',
      code: `
        # decode reads every weight per token   #@mem
        batch = B                # per step     #@batch
        schedule = "continuous"                 #@cont
        kv_cache = "paged, 16-token blocks"     #@paged
        weights = "int8, int4 or fp8"           #@quant
        draft, k = small_model, 4               #@spec
        student = distill(teacher)              #@distill
      `,
      beats: [
        { id: 'mem', say: 'To sum up: decode is memory-bound, reading every weight to use it once.', code: 'mem' },
        { id: 'batch', say: 'Batching shares each weight read among many users.', code: 'batch' },
        { id: 'cont', say: 'Continuous batching refills a slot the moment it frees.', code: 'cont' },
        { id: 'paged', say: 'Paged attention stores caches in small blocks, so more sequences fit.', code: 'paged' },
        { id: 'quant', say: 'Quantization shrinks the bytes, with finer scales and care for outliers.', code: 'quant' },
        { id: 'spec', say: 'Speculative decoding drafts and verifies, and the accept rule keeps the output exactly p.', code: 'spec' },
        { id: 'distill', say: 'And distillation makes a smaller model to serve.', code: 'distill' },
        { id: 'next', say: 'The thread through all of it: a token costs bytes, not arithmetic. Every trick moves fewer bytes, or gets more from each one.', code: 'mem' },
      ],
    },
  ],
};
