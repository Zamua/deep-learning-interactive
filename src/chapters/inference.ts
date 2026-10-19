import type { ChapterDef } from './index';
import { figBatching, figGenerate, figPaged, figRoofline } from '../lib/inference-figs-a';
import { figChooseK, figOutliers, figQuant, figSpeculative } from '../lib/inference-figs-b';
import { INFERENCE_SYMBOLS } from '../lib/inference-symbols';

const chapter: ChapterDef = {
  symbols: INFERENCE_SYMBOLS,

  render(p) {
    p.prose(`
A model is trained once. It is served every time anyone uses it: every token of every answer to every user is another forward pass, for as long as the model is deployed. For a popular model, that bill can outgrow the training run, which is why [Chapter 5](#/scaling-laws/beyond) ended with labs training smaller models for longer than compute-optimal. This chapter is about the other half of that bargain: making each forward pass cheaper and faster once the model exists.

The surprise at its center is that generating text is slow for a reason that has little to do with arithmetic. A GPU can do about a thousand trillion floating-point operations per second, yet producing one token for one user keeps it busy for well under one percent of that. It spends nearly all its time waiting for memory. Almost every technique in the chapter follows from taking that seriously:

- **batching** many users into one step, so the weights fetched from memory are used many times, and doing it **continuously**, so no slot waits for a slow request;
- **paged attention**, which stores the growing KV cache in small blocks so that many more sequences fit at once;
- **quantization**, which stores the weights in 8 or 4 bits instead of 16, so there are fewer bytes to fetch;
- **speculative decoding**, which lets a small model guess several tokens and the big model check them all in one pass, without changing what the big model would have said;
- **distillation**, which trains a smaller model to stand in for a big one.

Throughout, the running example is Llama 3 8B (8 billion parameters, 32 layers) on one NVIDIA H100, with numbers from the datasheet. Real servers reach a good fraction of those peaks, never all of them, so read every time below as a best case.`);

    // ------------------------------------------------------------------ prefill and decode
    p.h2('Two phases: prefill and decode', 'prefill-decode');
    p.prose(`
A language model generates text one token at a time ([Chapter 4](#/pretraining/decoding)): run the model on the text so far, sample the next token, append it, repeat. Done naively, step 500 would recompute the keys and values of all 499 earlier tokens. Instead, a server keeps them in the **KV cache**: since a causal model's earlier tokens never look forward, their keys and values never change, so each new token computes only its own and attends over the stored ones. [The modern transformer](#/modern-transformer) covers the cache's size (for Llama 3 8B, 128 KiB per token, thanks to grouped-query attention); here what matters is what it does to the shape of the work. A request splits into two phases that behave completely differently.

**Prefill.** The prompt is known in full, so all $T$ of its tokens go through the model in one pass, exactly like a training forward pass with a causal mask. Every weight matrix multiplies a $T$-row matrix of token vectors. The pass fills the KV cache with the prompt's keys and values and produces the distribution of the first new token. How long it takes is the **time to first token**.

**Decode.** Every later token depends on the one before it, so each needs a pass of its own, and that pass has exactly one token in it. Every weight matrix now multiplies a single row. The pass reads the whole cache, appends one key and one value per layer, and yields one token. Its duration, the **time per output token**, is how fast the answer streams onto the screen.

How much arithmetic is in a pass? Each weight takes part in one multiply and one add per token that passes through it:`);

    p.math({
      label: 'Floating-point operations per token',
      tex: String.raw`\text{FLOPs per token} \approx 2N, \qquad \text{FLOPs to prefill } T \text{ tokens} \approx 2NT`,
      codeTitle: 'flops.py',
      code: `
        N = 8.03e9                # Llama 3 8B
        per_token = 2 * N         # 16 GFLOP
        prefill = 2 * N * 1000    # a 1,000-token prompt
        peak = 989e12             # H100, bf16, FLOP/s
        prefill / peak            # 0.016 s at full speed
        per_token / peak          # 16 µs ... if compute mattered
      `,
      terms: [
        [String.raw`N`, 'the number of parameters, almost all of them entries of weight matrices'],
        [String.raw`2N`, 'a matrix times a vector does one multiply and one add per matrix entry, so two floating-point operations (FLOPs) per weight per token. This is the "2" in the $6ND$ of [training compute](#/scaling-laws/flops): the forward pass'],
        [String.raw`T`, 'the number of prompt tokens prefilled together'],
      ],
      explain: `Attention adds a little on top: each token's query meets every cached key, about $4 \\times$ layers $\\times$ heads $\\times$ head width $\\times$ context FLOPs, half a billion for Llama 3 8B at a 1,000-token context, small next to its 16 billion. By this count, one H100 should produce a token in 16 microseconds. It actually takes about 5 milliseconds, three hundred times longer. The figure shows where the time goes; the next section explains why.`,
    });

    figGenerate(p);

    // ------------------------------------------------------------------ roofline
    p.h2('Why decoding is memory-bound', 'roofline');
    p.prose(`
A GPU has two speeds, and they are very different. Its **compute** speed is how many floating-point operations per second its arithmetic units can do: for an H100, about 989 trillion (989 TFLOP/s) on 16-bit numbers. Its **memory bandwidth** is how many bytes per second it can move from its main memory (HBM, the 80 GB that hold the weights) into those units: 3.35 trillion (3.35 TB/s). Every number an operation uses has to make that trip first.

Divide one by the other: the H100 can do about 295 operations in the time it takes to fetch one byte. An operation that does fewer than 295 FLOPs per byte it fetches will leave the arithmetic units waiting on memory. The ratio of work to traffic is a property of the operation, its **arithmetic intensity** $\\symI$, and for a matrix multiply it is easy to work out:`);

    p.math({
      label: 'Arithmetic intensity of a layer',
      tex: String.raw`\symI = \frac{\text{FLOPs}}{\text{bytes moved}} = \frac{2\,\symB\, d^2}{2d^2 + 4\,\symB\, d} \;\approx\; \symB \qquad (\symB \ll d)`,
      codeTitle: 'intensity.py',
      code: `
        def intensity(B, d, nbytes=2):
            flops = 2 * B * d * d     # (B, d) @ (d, d)
            moved = nbytes * (d * d + 2 * B * d)  # W, in, out
            return flops / moved
        intensity(1, 4096)      # 1.0: one token
        intensity(64, 4096)     # 62
        intensity(4096, 4096)   # 1365: a long prompt
      `,
      terms: [
        [String.raw`\symB`, 'how many token vectors go through the layer together: 1 in a decode step for one user, $T$ in a prefill'],
        [String.raw`d`, 'the width of the layer: a $d \\times d$ weight matrix, $d = 4{,}096$ for Llama 3 8B'],
        [String.raw`2\,\symB\,d^2`, 'each of the $B$ rows meets each of the $d^2$ weights once: a multiply and an add'],
        [String.raw`2d^2`, 'bytes to read the weights once, at 2 bytes each in bf16'],
        [String.raw`4\,\symB\,d`, 'bytes to read the $B$ input vectors and write the $B$ outputs'],
        [String.raw`\approx \symB`, 'while $B$ is much smaller than $d$, the weights dominate the traffic and the 2s cancel: one FLOP per byte per token in the batch'],
      ],
      explain: `The weights are the expensive thing to move, and each weight fetched is used once per token in the batch. A decode step for one user brings in every weight of the model to use it exactly once: about **1 FLOP per byte**. A prefill uses each weight $T$ times. So prefill, past a few hundred tokens, is limited by compute, and decode is limited by memory, by a factor of almost 300.`,
    });

    p.prose(`
The **roofline model** (Williams, Waterman and Patterson, 2009) turns that into a speed limit. An operation can finish no sooner than its arithmetic allows and no sooner than its memory traffic allows; whichever is slower sets the time:`);

    p.math({
      label: 'The roofline',
      tex: String.raw`t = \max\!\left(\frac{\text{FLOPs}}{\text{peak}},\ \frac{\text{bytes}}{\text{bandwidth}}\right), \qquad \sym{I}{I^{\ast}} = \frac{\text{peak}}{\text{bandwidth}} \approx \frac{989 \times 10^{12}}{3.35 \times 10^{12}} \approx 295`,
      codeTitle: 'roofline.py',
      code: `
        peak, bw = 989e12, 3.35e12   # H100 SXM
        ridge = peak / bw            # 295 FLOP per byte

        def step_time(flops, nbytes):
            return max(flops / peak, nbytes / bw)

        N = 8.03e9
        step_time(2 * N, 2 * N)      # decode, B = 1: 4.8 ms
        1 / step_time(2 * N, 2 * N)  # at most 209 tokens/s
      `,
      terms: [
        [String.raw`\frac{\text{FLOPs}}{\text{peak}}`, 'the time if only arithmetic mattered'],
        [String.raw`\frac{\text{bytes}}{\text{bandwidth}}`, 'the time if only memory traffic mattered'],
        [String.raw`\max`, 'the GPU overlaps the two, so the slower one is the time. Below the ridge, memory is the slower one'],
        [String.raw`\sym{I}{I^{\ast}}`, 'the ridge point: the intensity at which both take equally long. Below it an operation is **memory-bound**, above it **compute-bound**. For an A100 it is $312 / 2.04 \\approx 153$'],
      ],
      explain: `For a decode step at batch 1, the bytes are the 16 GB of weights (plus a little cache), and moving them takes 4.8 ms however fast the arithmetic is. That caps one user at about 209 tokens per second on an H100, and the arithmetic units are busy for about a third of one percent of the step. On a log-log plot (intensity across, achieved FLOP/s up) the two limits are a rising line and a flat roof, hence the name.`,
    });

    p.callout('math', `A **log scale** spaces 1, 10, 100 and 1,000 equally far apart, so each step along the axis multiplies by ten. Two things become easy to see on log-log axes. A quantity proportional to another (like attainable speed $= I \\times$ bandwidth) is a straight line at 45 degrees, and a factor of 300 is just a fixed distance. The roofline figure below uses log axes for both of those reasons; [scaling laws](#/scaling-laws/power-laws) introduced them.`, 'Math help: log axes');

    // ------------------------------------------------------------------ batching
    p.h2('Batching: fetch the weights once, use them many times', 'batching');
    p.prose(`
If the weights are the expensive part and each fetch serves one token, the cure is to make each fetch serve many tokens. A server takes $\\symB$ users' sequences and decodes the next token of all of them in one step: every weight matrix multiplies a $\\symB$-row matrix instead of a single row. The weights cross the memory bus once per step whatever $\\symB$ is, so up to the ridge the step takes about as long as it did for one user, and it produces $\\symB$ tokens.

One part of the step does not batch. Each sequence attends over *its own* KV cache, and no other sequence can reuse those bytes. So the bytes per step are the weights once plus every sequence's cache:`);

    p.math({
      label: 'Decode throughput at batch size B',
      tex: String.raw`\text{tokens/s} = \frac{\symB}{t}, \qquad t \approx \max\!\left(\frac{\symB \cdot 2N}{\text{peak}},\ \frac{2N + \symB \cdot n_{\text{ctx}} \cdot c_{\text{kv}}}{\text{bandwidth}}\right)`,
      codeTitle: 'throughput.py',
      code: `
        def tokens_per_s(B, ctx, N=8.03e9, kv_tok=131072):
            t = max(B * 2 * N / peak,
                    (2 * N + B * ctx * kv_tok) / bw)
            return B / t

        tokens_per_s(1, 1024)     # 207
        tokens_per_s(64, 1024)    # 8,700: 42 times more
        tokens_per_s(64, 8192)    # 2,530: the cache dominates
      `,
      terms: [
        [String.raw`\symB \cdot 2N`, 'the arithmetic: $2N$ FLOPs for each of the $B$ tokens'],
        [String.raw`2N`, 'the weights: $N$ numbers at 2 bytes each, read once per step'],
        [String.raw`\symB \cdot n_{\text{ctx}} \cdot c_{\text{kv}}`, 'the caches: each of the $B$ sequences reads its own $n_{\\text{ctx}}$ cached tokens at $c_{\\text{kv}}$ bytes each (128 KiB for Llama 3 8B)'],
        [String.raw`\frac{\symB}{t}`, 'one token per sequence per step'],
      ],
      explain: `At batch 64 and 1,024 tokens of context, the step reads 16 GB of weights plus 8.6 GB of caches and takes 7.4 ms instead of 4.8: 42 times the tokens for 1.5 times the time. Push the context to 8,192 tokens and the caches (69 GB at batch 64) swamp the weights, the step slows to 25 ms, and the batch no longer fits in 80 GB anyway. Long contexts make decode memory-bound in a way batching cannot fix.`,
    });

    figRoofline(p);

    p.prose(`
This is why the KV cache's size, the subject of grouped-query attention in [the modern transformer](#/modern-transformer), is a serving problem as much as a memory problem: every byte of cache is read on every decode step. Multi-query and grouped-query attention shrink it by sharing key and value heads; storing it in 8 bits halves it again. The other attention optimization from that chapter, **FlashAttention**, computes attention in tiles so that the $T \\times T$ score matrix never has to be written to slow memory; it matters most in prefill and training, where that matrix is large. Decode-specific kernels apply the same tiling idea to a single query against a long cache.

The figure also shows the bargain every server strikes. Throughput, tokens per second per GPU, is what the operator pays for. But each user sees one token per step, and steps get longer as the batch grows: the dashed line in the bottom plot. Choosing $\\symB$ is choosing a point on that tradeoff, a theme the last section returns to.`);

    // ------------------------------------------------------------------ continuous batching
    p.h2('Continuous batching', 'continuous-batching');
    p.prose(`
Batching assumed $\\symB$ sequences were ready to go together. Real requests arrive at random moments and want answers of wildly different lengths: a yes-or-no next to a two-page essay. The simplest scheme, **static batching**, groups requests, runs the group until its *last* member finishes, and only then starts the next group. Every request that finishes early leaves its slot idle (or, in many implementations, computing padding) until the longest one is done, and a new request waits for the whole group.

**Continuous batching** decides the batch again at every decode step: when a sequence produces its end token, it leaves, and a waiting request takes its slot on the very next step. The idea was introduced as *iteration-level scheduling* in the Orca serving system (Yu et al., OSDI 2022) and is now standard in vLLM, TensorRT-LLM, SGLang and Hugging Face's TGI. A newly joined request needs its prefill, which the scheduler runs in the same step alongside everyone else's decode; the operations that do not care which sequence a token belongs to (all the weight matrices) treat the step as one big batch, while attention runs per sequence.`);

    figBatching(p);

    p.callout('intuition', `Static batching is a bus that leaves only when every seat is filled and returns only when the last passenger has reached the end of the line. Continuous batching is a train that stops at every station: anyone who has arrived gets off, anyone waiting gets on. The train carries more people per hour, and nobody waits for a stranger's long ride.`, 'A bus or a train');

    // ------------------------------------------------------------------ paged attention
    p.h2('The growing cache and paged attention', 'paged-attention');
    p.prose(`
Batching wants as many sequences in memory as possible, and each one brings a KV cache that grows by one token's worth (128 KiB for our model) on every step, to a length nobody knows in advance. Early serving systems handled the uncertainty the way a C programmer might: allocate one contiguous array per request, big enough for the prompt plus the maximum number of tokens it may generate. Most requests stop far short of that maximum, so most of each reservation is never written. Reservations of different sizes also leave unusable gaps between them as requests come and go. Kwon et al. measured that existing systems used only about 20 to 40 percent of their KV-cache memory for actual tokens.

**PagedAttention**, the core of the vLLM server (Kwon et al., SOSP 2023), borrows the fix operating systems found decades ago for the same problem: virtual memory. Split the cache into fixed-size **blocks** of, say, 16 tokens. A sequence starts with just enough blocks for its prompt and takes one more, from anywhere in memory, each time it fills its last one. A per-sequence **block table** maps its logical blocks (tokens 0 to 15, 16 to 31, ...) to physical ones, and the attention kernel follows the table when it reads keys and values. The only waste is the unfilled tail of each sequence's last block: fewer than 16 tokens, instead of everything between its actual and its maximum length.`);

    figPaged(p);

    p.prose(`
Fitting more sequences means bigger batches, and bigger batches mean more tokens per second: the paper reported 2 to 4 times the throughput of the best earlier systems at the same latency. Blocks bring a second benefit. Two sequences can point their tables at the same physical block, so a long system prompt shared by thousands of requests, or the common prefix of several samples drawn from one prompt, is stored once (a block is copied only when one of its sharers needs to write into it). Serving systems use this for **prefix caching**: a request that begins with text the server has already prefilled skips that part of its prefill entirely.`);

    // ------------------------------------------------------------------ quantization
    p.h2('Quantization: fewer bytes per weight', 'quantization');
    p.prose(`
If decode time is bytes divided by bandwidth, the most direct speedup is fewer bytes. **Quantization** stores each weight in fewer bits than the 16 of bf16: 8 bits halves the model, 4 bits quarters it. A batch-1 decode step then reads half or a quarter as much, and in the best case runs nearly that much faster; the model also fits on smaller or fewer GPUs, leaving room for more KV cache.`);

    p.table(
      ['Format', 'Bytes per weight', 'Llama 3 8B weights', 'Decode step on an H100, batch 1 (ideal)'],
      [
        ['bf16', '2', '16 GB', '4.8 ms'],
        ['int8 or fp8', '1', '8 GB', '2.4 ms'],
        ['int4, one scale per 32 weights', 'about 0.56', '4.5 GB', '1.3 ms'],
      ],
      { caption: 'Bytes divided by 3.35 TB/s. Real kernels must also unpack the integers, so they get part of this ideal, not all of it.' },
    );

    p.prose(`
An integer format has a fixed set of evenly spaced values, so quantizing means choosing a **scale** $\\syms$, the real-number size of one integer step, and rounding every weight to the nearest step. The simplest choice is **absmax** (symmetric) quantization: make the largest weight land on the largest integer.`);

    p.math({
      label: 'Absmax int8 quantization',
      tex: String.raw`\syms = \frac{\max_i |\symW_i|}{127}, \qquad q_i = \operatorname{round}\!\left(\frac{\symW_i}{\syms}\right), \qquad \hat{\symW}_i = \syms\, q_i`,
      codeTitle: 'absmax.py',
      code: `
        w = 0.02 * np.random.randn(4096)
        s = np.abs(w).max() / 127          # one scale
        w_int = np.round(w / s).astype(np.int8)   # -127..127
        w_hat = s * w_int                  # dequantize
        np.abs(w - w_hat).max() <= s / 2   # True
      `,
      terms: [
        [String.raw`\max_i |\symW_i|`, 'the largest weight, ignoring its sign'],
        [String.raw`127`, 'the largest 8-bit integer used. A signed byte runs from $-128$ to $127$; symmetric schemes use $-127$ to $127$ so that zero sits exactly in the middle. For $b$ bits it is $2^{b-1} - 1$: 7 for 4 bits'],
        [String.raw`\syms`, 'the scale: what one integer step is worth. One number, stored next to the integers in 16 bits'],
        [String.raw`q_i`, 'the stored integer, one byte per weight'],
        [String.raw`\hat{\symW}_i = \syms\, q_i`, 'the dequantized weight the matrix multiply actually uses. It is off from the true weight by at most half a step, $\\syms / 2$'],
      ],
      explain: `Every weight is replaced by the nearest of 255 evenly spaced values, from $-\\max|W|$ to $+\\max|W|$. The catch is in the first fraction: the single largest weight sets the step size for all the others. One weight ten times larger than the rest makes the step ten times coarser for everyone.`,
    });

    p.prose(`
Absmax wastes codes when the values are lopsided. The outputs of a ReLU are never negative, so half of absmax's integers would never be used. **Zero-point** (asymmetric, or affine) quantization maps the actual range $[\\min, \\max]$ onto all 256 codes of an unsigned byte, and stores one more number, the **zero point** $\\symz$, the integer that stands for the real value 0:`);

    p.math({
      label: 'Zero-point (asymmetric) quantization',
      tex: String.raw`\begin{aligned} \syms &= \frac{\max \symW - \min \symW}{255}, \qquad \symz = \operatorname{round}\!\Big(\!-\frac{\min \symW}{\syms}\Big) \\ q_i &= \operatorname{clip}\!\Big(\operatorname{round}\big(\symW_i / \syms\big) + \symz,\; 0,\; 255\Big), \qquad \hat{\symW}_i = \syms\,(q_i - \symz) \end{aligned}`,
      codeTitle: 'zero_point.py',
      code: `
        x = np.maximum(0, np.random.randn(4096))  # ReLU out
        s = (x.max() - x.min()) / 255
        z = np.round(-x.min() / s)       # the code for 0.0
        x_int = np.clip(np.round(x / s) + z, 0, 255)
        x_int = x_int.astype(np.uint8)
        x_hat = s * (x_int - z)
      `,
      terms: [
        [String.raw`\max \symW - \min \symW`, 'the full range of the values, split into 255 equal steps'],
        [String.raw`\symz`, 'the zero point: the integer code that means exactly 0.0. Subtracting it on the way back shifts every code to the right place'],
        [String.raw`\operatorname{clip}(\cdot, 0, 255)`, 'clamp into the range of an unsigned byte'],
        [String.raw`\syms\,(q_i - \symz)`, 'dequantize: shift, then scale'],
      ],
      explain: `Zero-point spends every code on values that actually occur, which roughly halves the step for one-sided data. Keeping 0.0 exactly representable matters: zero padding and the many exact zeros after a ReLU stay exactly zero. Weights are usually close to symmetric around zero, so absmax is common for them; activations are where the zero point earns its keep.`,
    });

    p.prose(`
### One scale for what?

The equations leave open how many weights share one scale. **Per-tensor** quantization uses one scale for a whole matrix: cheapest, but the matrix's single largest weight sets the step everywhere. **Per-channel** quantization gives each output channel (each row of $\\symW$) its own scale, so a row of small weights gets a fine grid of its own. **Group-wise** quantization goes further and gives every block of, say, 32 or 128 consecutive weights its own scale, the standard choice at 4 bits. Each extra scale costs 16 bits of storage: half a bit per weight for groups of 32, an eighth of a bit for groups of 128.`);

    figQuant(p);

    p.prose(`
### Outlier features: LLM.int8()

Weights are tame next to activations, the vectors flowing between layers. Dettmers et al. (2022) found that in transformers of about 6.7 billion parameters and up, a handful of hidden dimensions carry values up to about 20 times larger than the rest, consistently, in almost every layer and token. Remove them and the model falls apart; quantize them with everything else, and the scale they force on each token crushes the ordinary features into a few integer steps. Their method, **LLM.int8()**, splits every matrix multiply in two: the few feature dimensions where any value reaches magnitude 6 are multiplied in 16 bits, and everything else in int8, with one scale per row of the activations and one per column of the weights. More than 99.9% of the multiplications stay 8-bit, and the paper showed models up to 175 billion parameters running in int8 with no measurable loss.`);

    figOutliers(p);

    p.prose(`
### Weight-only int4: GPTQ and AWQ

For decode, only the bytes that cross the memory bus matter, and those are mostly weights. **Weight-only** quantization stores the weights in 4 bits (with a scale per group) and leaves activations in 16 bits; the kernel loads the small integers, expands them to 16-bit numbers inside the chip, and multiplies as usual. Rounding each weight to its nearest 4-bit value works poorly at this precision, and two methods made 4 bits practical for large models:

- **GPTQ** (Frantar et al., 2022) quantizes a layer one column at a time and, after each column, adjusts the not-yet-quantized weights to cancel the error it just made, using the layer's inputs on a small calibration set (a second-order method, in the family of Optimal Brain Surgeon). It quantized a 175-billion-parameter model to 3 or 4 bits in about four GPU hours with little loss in perplexity.
- **AWQ** (Lin et al., 2023) observes that about 1% of weight channels matter most: those that meet the largest activations. It scales those channels up before quantizing (and the matching activations down, which leaves the product unchanged), so their rounding error shrinks relative to their size. No retraining and no per-weight updates are needed.

Both are post-training methods: minutes to hours on a GPU, never a training run. Fine-tuning on top of a 4-bit base model is [QLoRA](#/finetuning).

### fp8

The H100 brought tensor cores for **8-bit floating point**, at twice its bf16 speed. An fp8 number spends its 8 bits on a sign, an exponent and a few mantissa bits, so its steps are spaced logarithmically like any float ([mixed precision](#/optimizers/mixed-precision) explains the layout): **E4M3** (4 exponent and 3 mantissa bits, largest value 448) for weights and activations, and **E5M2** (largest value 57,344) where range matters more, mostly for gradients in training. Unlike int4 weights, fp8 quantizes the activations too, so the matrix multiplies themselves run at 8-bit speed. That helps the compute-bound side, prefill and large batches, as well as decode, and fp8 KV caches halve the cache's bytes. A per-tensor scale still maps each tensor's range into fp8's.`);

    p.callout('warning', `Quantization error is not free, and not uniform. Smaller models, lower bit widths, and some tasks (long reasoning chains, code, math) degrade first, and average perplexity can hide it. Every serious deployment re-runs its evaluations on the quantized model. A rough consensus from published comparisons: 8-bit weights (int8 or fp8) are close to lossless for large models; 4-bit weights with a good method cost a little; 3 bits and below cost more.`, 'Measure, do not assume');

    // ------------------------------------------------------------------ speculative decoding
    p.h2('Speculative decoding', 'speculative');
    p.prose(`
Batching makes a GPU serve more users. It does nothing for a single user waiting on a long answer, whose tokens still arrive one decode step apart. **Speculative decoding** (Leviathan, Kalman and Matias, 2022; Chen et al., 2023, independently) speeds up that one user, and it does so without changing the output distribution at all.

The trick rests on the roofline. A decode step that verifies five positions costs about the same as one that generates one, because the cost is reading the weights, not the arithmetic. So:

1. A small, fast **draft model** with distribution $\\symq$ generates $\\symk$ tokens the ordinary way, one at a time. Each of its steps is cheap.
2. The big **target model**, with distribution $\\symp$, runs *once* on all $\\symk$ guessed tokens together, like a tiny prefill. That one pass gives $\\symp$ at every one of the $\\symk$ positions, and at one more after them.
3. Walking left to right, each guess is accepted or rejected by a rule that compares $\\symp$ and $\\symq$. At the first rejection, a corrected token is drawn and the rest of the guesses are thrown away. If all $\\symk$ survive, the target's distribution at the end supplies a bonus token for free.

Every pass of the big model produces at least one token (the correction or the bonus) and up to $\\symk + 1$. The draft and target must share a tokenizer, and the draft is usually a much smaller model from the same family.`);

    p.math({
      label: 'The accept rule and the residual',
      tex: String.raw`\begin{aligned} &\text{keep the draft's token } x \text{ with probability } \min\!\left(1,\ \frac{\symp(x)}{\symq(x)}\right) \\ &\text{if rejected, sample from } r(x) = \frac{\max\!\big(0,\ \symp(x) - \symq(x)\big)}{\sum_{x'} \max\!\big(0,\ \symp(x') - \symq(x')\big)} \end{aligned}`,
      codeTitle: 'accept.py',
      code: `
        x = rng.choice(V, p=q)                  # draft's guess
        if rng.random() < min(1, p[x] / q[x]):  # keep it
            token = x
        else:                                   # replace it
            r = np.maximum(p - q, 0)            # residual
            token = rng.choice(V, p=r / r.sum())
      `,
      terms: [
        [String.raw`\symq(x)`, 'how likely the draft thought its own guess was'],
        [String.raw`\symp(x)`, 'how likely the target finds the same token, from the one verification pass'],
        [String.raw`\min(1, \symp/\symq)`, 'if the target likes the token at least as much as the draft did, always keep it. If the draft was overconfident, keep it only part of the time, in proportion'],
        [String.raw`\max(0, \symp - \symq)`, 'the **residual**: where the target puts more probability than the draft did. Those are the tokens the draft under-proposes'],
        [String.raw`\sum_{x'}`, 'divide by the total so the residual becomes a distribution (adds up to 1)'],
      ],
      explain: `When the draft over-proposes a token, some of those proposals are rejected; when it under-proposes one, the rejections are refilled from exactly the tokens it under-proposes. The two corrections are sized to cancel. With greedy decoding (temperature 0) the rule collapses to something simpler: keep the guess if and only if it is the target's top token, and otherwise emit the target's top token.`,
    });

    p.prose(`That the two corrections cancel exactly is short to prove. Write $\\symalpha = \\sum_x \\min(\\symp(x), \\symq(x))$, the overall chance a guess is kept.`);

    p.math({
      label: 'Why the output is exactly p',
      tex: String.raw`\begin{aligned} P(\text{out} = x) &= \underbrace{\symq(x)\,\min\!\Big(1, \tfrac{\symp(x)}{\symq(x)}\Big)}_{\text{guessed and kept}} \;+\; \underbrace{(1 - \symalpha)\; r(x)}_{\text{rejected, then resampled}} \\[2pt] &= \min\!\big(\symp(x), \symq(x)\big) \;+\; \Big(\symp(x) - \min\!\big(\symp(x), \symq(x)\big)\Big) \;=\; \symp(x) \end{aligned}`,
      codeTitle: 'exact.py',
      code: `
        p = np.array([.32, .24, .16, .13, .09, .06])
        q = np.array([.20, .17, .23, .125, .185, .09])
        alpha = np.minimum(p, q).sum()          # 0.805
        r = np.maximum(p - q, 0) / (1 - alpha)  # residual
        out = np.minimum(p, q) + (1 - alpha) * r
        np.allclose(out, p)                     # True
      `,
      terms: [
        [String.raw`\symq(x)\min(1, \symp(x)/\symq(x))`, 'the draft proposes $x$ with probability $\\symq(x)$ and it survives with probability $\\min(1, \\symp/\\symq)$. Multiplying through gives $\\min(\\symq, \\symp)$: if $\\symq \\le \\symp$ it is $\\symq \\cdot 1$, and if $\\symq > \\symp$ it is $\\symq \\cdot \\symp/\\symq = \\symp$'],
        [String.raw`1 - \symalpha`, 'the chance of a rejection, whatever was guessed: one minus the chance of a keep'],
        [String.raw`(1 - \symalpha)\, r(x)`, "the residual's normalizer is $\\sum_x (\\symp - \\min(\\symp, \\symq)) = 1 - \\symalpha$, because $\\symp$ adds up to 1. So this term is just $\\symp(x) - \\min(\\symp(x), \\symq(x))$"],
        [String.raw`= \symp(x)`, 'the two parts add up to the target probability, for every token $x$'],
      ],
      explain: `Each emitted token is an exact sample from $\\symp$ given the tokens before it. A rejection discards the later guesses, which were conditioned on a token that is no longer there, and the next pass starts from the corrected text, so by the same argument every token of the output is distributed exactly as if the target had generated it alone. No approximation anywhere: the speedup comes for free in quality. The figure checks this by brute force.`,
    });

    figSpeculative(p);

    p.prose(`
How much does it buy? If every guess is kept with probability $\\symalpha$, independently, a pass yields one token for sure, a second if the first guess survives (probability $\\symalpha$), a third if the first two survive ($\\symalpha^2$), and so on up to $\\symk + 1$:`);

    p.math({
      label: 'Expected tokens per pass, and the speedup',
      tex: String.raw`\mathbb{E}[\text{tokens per pass}] = 1 + \symalpha + \symalpha^2 + \dots + \symalpha^{\symk} = \frac{1 - \symalpha^{\symk + 1}}{1 - \symalpha}, \qquad \text{speedup} = \frac{1 - \symalpha^{\symk + 1}}{(1 - \symalpha)\,(\symk\, c + 1)}`,
      codeTitle: 'expected.py',
      code: `
        def expected_tokens(alpha, k):
            return (1 - alpha ** (k + 1)) / (1 - alpha)

        def speedup(alpha, k, c):
            return expected_tokens(alpha, k) / (k * c + 1)

        expected_tokens(0.8, 4)    # 3.36 per big pass
        expected_tokens(0.8, 100)  # 5.0: the cap, 1/(1-alpha)
        speedup(0.8, 4, 0.05)      # 2.8
      `,
      terms: [
        [String.raw`\mathbb{E}[\cdot]`, 'the **expected value**: the average over many passes ([math kit](#/math-kit))'],
        [String.raw`\symalpha^j`, 'the chance that the first $j$ guesses all survive, which is when the pass yields more than $j$ tokens'],
        [String.raw`\frac{1 - \symalpha^{\symk+1}}{1 - \symalpha}`, 'the sum of that geometric series, in closed form. As $\\symk$ grows it approaches $1/(1 - \\symalpha)$: 5 tokens at $\\symalpha = 0.8$'],
        [String.raw`c`, "the cost of one draft step as a fraction of one target step. The pass costs $\\symk$ draft steps plus one target pass, $\\symk c + 1$ in target-step units, assuming verifying $\\symk + 1$ positions costs about one decode step, which holds while decode is memory-bound"],
      ],
      explain: `Leviathan et al. define $\\symalpha$ as the expected value of $\\sum_x \\min(\\symp(x), \\symq(x))$ over the contexts that come up, one minus the average total variation distance between the two models, so a draft that agrees closely with its target is worth more than a fast one. They reported 2 to 3 times faster decoding of T5-XXL with identical outputs, and Chen et al. reported 2 to 2.5 times on the 70-billion-parameter Chinchilla.`,
    });

    figChooseK(p);

    p.prose(`
Later variants change where the guesses come from. **Medusa** (Cai et al., 2024) attaches a few extra output heads to the target model itself, each predicting a token further ahead, and verifies a small tree of their guesses in one pass; **EAGLE** (Li et al., 2024) drafts with a light model that reads the target's own hidden features. All of them keep the same verify-in-one-pass structure, and the sampling variants keep the same accept rule. One caution: speculation spends extra compute (every rejected guess was verified for nothing) to save memory-bound steps, so its gains shrink when the server is already running large, compute-bound batches.`);

    // ------------------------------------------------------------------ distillation
    p.h2('Distillation: a smaller model that imitates', 'distillation');
    p.prose(`
Every technique so far serves a fixed model more efficiently. The bluntest tool changes the model: train a small **student** to imitate a big **teacher**, and serve the student. Imitation beats training the small model from scratch on the same text because the teacher's full output distribution carries far more information per example than the one token that actually came next: that *the* was likely, *a* nearly as likely, and *banana* absurd. Hinton, Vinyals and Dean (2015) named this **distillation** and trained the student to match the teacher's distribution, both softened by a temperature $\\tau$ ([sampling with temperature](#/pretraining/decoding)). Here the teacher plays the role of $\\symp$ and the student of $\\symq$:`);

    p.math({
      label: 'Distillation loss',
      tex: String.raw`\mathcal{L} = \tau^2\, \mathrm{KL}\big(\symp_\tau \,\Vert\, \symq_\tau\big) = \tau^2 \sum_x \symp_\tau(x) \log\frac{\symp_\tau(x)}{\symq_\tau(x)}, \qquad \symp_\tau = \operatorname{softmax}\!\Big(\frac{\text{teacher logits}}{\tau}\Big)`,
      codeTitle: 'distill.py',
      code: `
        def distill_loss(teacher_logits, student_logits, tau=2.0):
            p = softmax(teacher_logits / tau)   # soft targets
            q = softmax(student_logits / tau)
            kl = (p * (np.log(p) - np.log(q))).sum(axis=-1)
            return tau ** 2 * kl.mean()
      `,
      terms: [
        [String.raw`\symp_\tau, \symq_\tau`, "teacher's and student's next-token distributions, each computed from its logits divided by $\\tau$. A temperature above 1 flattens them, so the small probabilities (the teacher's opinion of the unlikely tokens) carry more weight"],
        [String.raw`\mathrm{KL}(\symp \Vert \symq)`, 'the **KL divergence**: a measure of how far $\\symq$ is from $\\symp$. It is 0 when the two agree on every token and grows as they differ, weighted by how likely $\\symp$ finds each token'],
        [String.raw`\log\frac{\symp_\tau}{\symq_\tau}`, 'per token, how much less likely the student finds it than the teacher'],
        [String.raw`\tau^2`, 'dividing logits by $\\tau$ shrinks the gradients by about $\\tau^2$; multiplying back keeps them comparable to the ordinary loss, which distillation is often mixed with'],
      ],
      explain: `Minimizing the KL divergence over the student's parameters is the same as minimizing cross-entropy against the teacher's soft targets instead of the one-hot true token. DistilBERT (Sanh et al., 2019) used it to make BERT 40% smaller and 60% faster while keeping 97% of its scores on language-understanding benchmarks.`,
    });

    p.prose(`
For large language models a cheaper variant is common: **sequence-level** distillation, where the teacher simply generates text and the student is fine-tuned on it with the ordinary next-token loss, no logits needed. DeepSeek distilled R1's reasoning this way into small Qwen and Llama models, fine-tuning them on about 800,000 samples curated with R1 ([Chapter 17](#/grpo/r1)); in their comparison, distilling into a 32-billion-parameter Qwen model beat training that same model with large-scale RL. Distillation also feeds speculative decoding: a draft distilled from its own target agrees with it more often, which raises $\\symalpha$.`);

    // ------------------------------------------------------------------ latency vs throughput
    p.h2('Latency versus throughput', 'latency-throughput');
    p.prose(`
A server is judged by numbers that pull against each other:

- **Time to first token** (TTFT): how long until anything appears. Set by queueing and by the prefill.
- **Time per output token** (TPOT, or inter-token latency): how fast the answer streams. Set by the decode step.
- **Throughput**: tokens per second per GPU, summed over all users. Set by how many sequences share each step, and it sets the cost per token.

Batching raises throughput and lowers each user's speed. Long prompts make it worse: a 4,000-token prefill entering the batch takes about 70 ms on our H100, and every user in the batch waits that long for their next token. **Chunked prefill** (Sarathi, Agrawal et al., 2023) cuts long prompts into pieces that ride along with ordinary decode steps, trading a little TTFT for smooth streaming. **Disaggregated serving** (DistServe and Splitwise, 2024) goes further and runs prefill and decode on separate GPUs, each tuned for its own bottleneck, shipping the KV cache from one to the other. Production systems set targets for both latencies and maximize the throughput that meets them, sometimes called *goodput*.`);

    p.table(
      ['Technique', 'Mainly helps', 'What it costs'],
      [
        ['Batching', 'throughput: weights read once for $B$ tokens', "each user's speed; memory for $B$ caches"],
        ['Continuous batching', 'throughput, and waiting time: no request waits for a batch', 'a scheduler that rebuilds the batch every step'],
        ['Paged KV cache', 'memory, hence bigger batches, hence throughput', 'one indirection (the block table) in the attention kernel'],
        ['Quantization', 'memory and decode speed: fewer bytes per weight', 'some accuracy; kernels that unpack the integers'],
        ['Speculative decoding', "one user's latency: several tokens per pass", 'a draft model and wasted verification compute; little gain at large batch'],
        ['Distillation', 'everything at once: a smaller model to serve', 'a training run, and some quality'],
      ],
    );

    p.callout('idea', `
- **Prefill** processes the prompt in one pass and is compute-bound; **decode** makes one token per pass and is memory-bound, because each pass reads every weight to use it once: an arithmetic intensity of about 1 FLOP per byte against a ridge near 300.
- **Batching** shares each weight read among $B$ sequences, so throughput rises almost $B$-fold until the step turns compute-bound or the KV caches, which do not batch, take over the memory traffic.
- **Continuous batching** refills a slot as soon as a sequence finishes; **paged attention** stores caches in 16-token blocks through a block table, so memory goes to real tokens and many more sequences fit.
- **Quantization** shrinks the bytes: absmax or zero-point integers with scales per channel or per group; LLM.int8() keeps outlier features in 16 bits; GPTQ and AWQ make 4-bit weights work; fp8 cuts compute as well as memory.
- **Speculative decoding** lets a draft guess $k$ tokens and the target verify them in one pass. Keeping a guess with probability $\\min(1, p/q)$ and resampling rejections from $\\max(0, p - q)$ leaves the output exactly $p$; a pass yields $(1 - \\alpha^{k+1})/(1 - \\alpha)$ tokens on average.
- **Distillation** trains a small model on a big one's distributions or outputs, the most permanent speedup of all.`, 'Takeaways');

    // ------------------------------------------------------------------ exercises
    p.h2('Build it yourself', 'exercises');
    p.prose(`
1. **Warm-up: quantize a matrix (15 minutes).** Make a 256 by 1,024 NumPy matrix whose rows have standard deviations spread over a factor of ten. Implement absmax and zero-point quantization with one scale per tensor, per row, and per group of 64, at 8, 4 and 3 bits, and print the SQNR $10\\log_{10}(\\sum w^2 / \\sum (w - \\hat w)^2)$ of each. Then set one weight to 50 times the typical size. *Success:* per-row and per-group beat per-tensor by a wide margin, each extra bit adds roughly 6 dB at the higher widths, and the single outlier wrecks per-tensor but barely touches per-group.
2. **Measure your own roofline (30 minutes).** Time \`X @ W\` for a 4,096 by 4,096 \`W\` and \`X\` of shape (B, 4,096), for B from 1 to 4,096, in NumPy on your CPU or PyTorch on a GPU (call \`torch.cuda.synchronize()\` before reading the clock). Plot achieved FLOP/s against the intensity from the formula above, on log-log axes. *Success:* a rising line at small B that bends into a flat roof, with the ridge near your machine's peak FLOP/s divided by its memory bandwidth.
3. **Speculative sampling, checked (an evening).** Train two character-level bigram models on different texts, or use one bigram model and a smoothed copy of it, as target and draft. Implement speculative sampling with $\\symk = 4$, generate 200,000 characters, and compare the frequency of every character pair against plain sampling from the target. *Success:* the pair frequencies agree within sampling noise, the measured tokens per pass matches $(1 - \\alpha^{k+1})/(1 - \\alpha)$ with $\\alpha$ measured as the acceptance rate, and replacing the residual with the target distribution produces a visible bias.
4. **A paged KV cache (an evening).** Write attention for one query over a cache stored as a pool of 16-token blocks plus a block table, gathering keys and values block by block, and check it against attention over one contiguous array. Then simulate a stream of requests with random lengths and compare how many fit in a fixed pool with paging versus reserving the maximum length. *Success:* identical outputs to about \`1e-12\`, and two to four times as many concurrent sequences with paging.
5. **Project: a tiny inference server (a weekend).** Take a small GPT (GPT-2 small from \`transformers\`, or the one from the [transformer exercises](#/transformer/exercises)) and write the decode loop yourself: prefill, a KV cache, then continuous batching of a queue of prompts with mixed lengths. Measure time to first token, time per output token and total tokens per second as you vary the batch size. Then add greedy speculative decoding with an even smaller model as the draft. *Success:* throughput rises steeply with batch size while time per token rises slowly, and speculation speeds up a single stream while producing exactly the same text as plain greedy decoding.`);
  },
};

export default chapter;
