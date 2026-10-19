import type { ChapterDef } from './index';
import { FINETUNING_SYMBOLS } from '../lib/finetuning-symbols';
import { figLowRank, figTemplate, figToySFT } from '../lib/finetuning-figs';
import { figDistill, figLoraTrain, figMemory, figNF4 } from '../lib/finetuning-figs2';
import { installCss } from '../lib/finetuning-ui';

const chapter: ChapterDef = {
  symbols: FINETUNING_SYMBOLS,

  render(p) {
    installCss(p.root);

    p.prose(`
[Pretraining](#/pretraining) leaves us with a remarkable object: a model that has read a large slice of the internet and can continue any text in a plausible way. It is not yet something you can talk to. Type a question into a raw pretrained model, a **base model**, and it may answer, or it may write three more questions, or a forum reply, or the rest of a homework sheet. It is doing exactly what it was trained to do: continue the document.

This chapter opens the post-training part of the course. Its first half is about **supervised fine-tuning** (SFT): training the base model on written-out examples of the behavior we want, until it acts like an assistant. That needs three things: example conversations, a way to turn a conversation into tokens (a *chat template*), and a loss that grades only the assistant's words (*loss masking*). Its second half is about cost. Updating every weight of a large model needs many GPUs and a full copy of the model per task, and **LoRA** and **QLoRA** cut both, by training a small low-rank correction instead. The chapters after this one ([policy gradients](#/policy-gradients), [RLHF](#/rlhf), [DPO](#/dpo), [GRPO](#/grpo)) improve the fine-tuned model further with rewards and preferences instead of demonstrations.`);

    p.h2('A base model is not an assistant', 'base-model');
    p.prose(`
Pretraining minimizes one loss: the negative log-probability of the next token of real text. The model that does this best is the one that best imitates *the text it was trained on*, and that text is the web. So the model treats a prompt as the opening of some document and asks, in effect, "what kind of page starts like this, and how does it go on?"

A line like *What is the capital of France?* appears on the web in quiz lists, in homework sheets, in search-engine spam, and only sometimes right before its answer. A faithful continuation is often another question. With care you can steer a base model into the right kind of document, for instance by framing the question as an FAQ page (*Q: ... A:*) or by giving a few worked examples, as GPT-3's few-shot prompts did ([Chapter 4](#/pretraining)). But that is brittle, and it does not give the behaviors an assistant needs: answer the question that was actually asked, in a consistent voice, follow formatting instructions, stop when done, and decline requests it should not help with. All of these occur in web text, but rarely and mixed with everything else.

**Supervised fine-tuning** fixes this directly. Collect *demonstrations*: prompts, each paired with the response we would like the model to give. Keep training with the same next-token loss, but now on those responses. The model already knows grammar, facts and much of how to reason; the demonstrations teach it which of the many kinds of text it can write is the one we want.`);

    p.table(
      ['Where demonstrations come from', 'Examples', 'Trade-off'],
      [
        ['People write them', 'InstructGPT (2022): labelers wrote answers, about 13,000 prompts for SFT. LIMA (2023): 1,000 hand-picked examples', 'high quality, slow and expensive'],
        ['Existing datasets, rephrased as instructions', 'FLAN (2021): over 60 NLP datasets turned into instructions; T0 (2021)', 'cheap and large, but answers are short and the style is narrow'],
        ['A stronger model writes them', 'Self-Instruct (2022); Alpaca (2023): 52,000 answers from an OpenAI model; DeepSeek-R1 distillation (2025)', 'cheap and fluent, but capped by the teacher (see the last section)'],
        ['Real conversations', 'Vicuna (2023): about 70,000 user-shared ChatGPT conversations; OpenAssistant (2023)', 'realistic prompts, uneven quality'],
      ],
      { caption: 'Most modern pipelines mix all four, then filter hard for quality.' },
    );

    p.prose(`
The InstructGPT paper (Ouyang et al., 2022) made the payoff vivid: labelers preferred the answers of a 1.3-billion-parameter model fine-tuned this way (with RLHF on top) over those of the 175-billion-parameter GPT-3 it started from. And the LIMA paper (Zhou et al., 2023) found that just 1,000 carefully chosen examples turned a 65-billion-parameter LLaMA into a capable assistant. Its authors proposed the *superficial alignment hypothesis*: nearly all knowledge and skill comes from pretraining, and fine-tuning mostly teaches the format and style in which to use it. It is a hypothesis, not a law, and production models use far larger SFT sets, but it captures why a small amount of data goes so far.`);

    p.callout('history', `Instruction tuning grew out of multitask learning. **FLAN** (Wei et al., 2021) rewrote dozens of existing NLP datasets (translation, sentiment, question answering) as natural-language instructions and fine-tuned a 137B model on them; it then did better on *unseen* tasks given only an instruction, which showed that following instructions is itself a skill that transfers. **InstructGPT** (2022) moved to open-ended prompts from real users with answers written by people, and added RLHF, the recipe behind ChatGPT later that year.`, 'From FLAN to InstructGPT');

    p.h2('Chat templates', 'templates');
    p.prose(`
A conversation is a list of messages, each with a **role**: *system* (standing instructions from whoever deploys the model), *user*, *assistant*, and in many systems *tool* for the results of tool calls. The model, though, reads one flat sequence of tokens. A **chat template** is the rule that flattens a conversation into that sequence, and it has to mark three things unambiguously: where each message starts, who wrote it, and where it ends.

Templates do this with **special tokens** ([Chapter 3](#/tokenization)): single vocabulary ids that no ordinary text encodes to, so a user cannot forge them by typing. The **ChatML** format, which OpenAI introduced in 2023 and many open models such as Qwen use, wraps each message in \`<|im_start|>\` and \`<|im_end|>\`, with the role name as plain text right after the start token. Llama 3 uses \`<|start_header_id|>\`, \`<|end_header_id|>\` and \`<|eot_id|>\` ("end of turn") instead. The template ships with the model; in the Hugging Face library it is stored with the tokenizer and applied like this:`);

    p.code(`
      messages = [
          {"role": "system", "content": "You are a helpful assistant."},
          {"role": "user", "content": "What is the capital of France?"},
      ]
      text = tok.apply_chat_template(messages, tokenize=False,
                                     add_generation_prompt=True)
      # <|im_start|>system\\nYou are a helpful assistant.<|im_end|>\\n
      # <|im_start|>user\\nWhat is the capital of France?<|im_end|>\\n
      # <|im_start|>assistant\\n
    `, { title: 'apply_template.py' });

    p.prose(`
Two details matter for training.

- **The generation prompt.** At inference time, the server renders the conversation so far *plus the opening of an assistant message* (\`<|im_start|>assistant\\n\`, the \`add_generation_prompt=True\` above) and lets the model continue from there. Generation ends when the model emits the end-of-turn token. So the model must learn to produce \`<|im_end|>\` at the right moment, or it will ramble on and start writing the user's next message itself.
- **One template, used consistently.** A model fine-tuned on one template and prompted with another sees token patterns it was never trained on, and quality drops. And if the template adds tokens the base model never saw, their embedding rows start out untrained: they must be added to the vocabulary and trained along with everything else.`);

    p.h2('Loss on the answer only', 'masking');
    p.prose(`
Render a conversation through the template and you have one token sequence $y_1, \\dots, y_n$, ready for the same loss as pretraining: at every position, the negative log-probability of the next token. But we do not want the model to learn to write *everything* in that sequence. It does not need to get good at writing system prompts or at imitating users; it needs to get good at the assistant's replies. So SFT multiplies each position's loss by a **mask** $\\symm_t$: 1 for tokens the assistant wrote (including the end-of-turn token, so it learns to stop), 0 for everything else. Masked-out tokens still sit in the context, where the model reads them. Their predictions are just never graded.`);

    p.math({
      label: 'The SFT loss: cross-entropy with a mask',
      tex: String.raw`\symL(\theta) = -\frac{1}{\sum_t \symm_t} \sum_{t=1}^{n} \symm_t \,\log p_\theta\!\left(y_t \mid y_{<t}\right)`,
      code: `
        logits = model(ids)                    # (n, V)
        logp = log_softmax(logits[:-1])        # predicts ids[1:]
        tok_logp = logp[np.arange(n - 1), ids[1:]]
        loss = -(mask[1:] * tok_logp).sum() / mask[1:].sum()
      `,
      codeTitle: 'sft_loss.py',
      terms: [
        [String.raw`y_t`, 'the token at position $t$ of the rendered conversation'],
        [String.raw`p_\theta(y_t \mid y_{<t})`, 'the probability the model, with weights $\\theta$, gives to that token after reading everything before it'],
        [String.raw`\log p_\theta`, 'its logarithm: 0 for a certain, correct prediction, very negative for a surprised one'],
        [String.raw`\symm_t`, 'the mask: 1 if this token is part of an assistant reply, 0 if it belongs to the system prompt, a user message or a role header'],
        [String.raw`\frac{1}{\sum_t \symm_t}\sum_t`, 'add up the masked-in terms and divide by how many there are: an average over answer tokens only'],
      ],
      explain: `This is exactly the pretraining loss from [Chapter 4](#/pretraining), with most of its terms switched off. For one prompt $x$ and one answer $y$ it is the average of $-\\log p_\\theta(y_t \\mid x, y_{<t})$ over the answer's tokens: "make the demonstrated answer likely, given the prompt". In PyTorch the mask is usually written by replacing masked-out targets with $-100$, which \`cross_entropy\` skips. One subtlety: averaging over all answer tokens in a batch gives long answers more weight than short ones; some trainers average per example first. Masking the prompt is the common default rather than a law; one 2024 study found that also training on the instructions can help when answers are short and examples few.`,
    });

    figTemplate(p);

    p.h2('SFT in miniature', 'toy');
    p.prose(`
To see all of this happen at once, here is a language model small enough to watch completely, trained twice: once as a base model, once as an assistant. It looks at the last four tokens, has 3,807 weights, and knows 40 words. Its "web" is 600 generated pages of three kinds: pages of facts (*the capital of japan is tokyo .*), quiz pages that list questions without answers, and a few FAQ pages with *q :* and *a :*. Its demonstrations are 16 short conversations in a chat template with two roles, \`<user>\` and \`<bot>\`, and an \`<end>\` token, with loss on the replies only.`);

    figToySFT(p);

    p.prose(`
The base model's behavior is the web's: it continues a bare question with more questions, because quiz pages taught it that; it answers the FAQ framing correctly but keeps going; and after \`<bot>\`, a token it has never seen, it stumbles and never stops. A few dozen fine-tuning steps on 16 conversations fix the chat prompts completely, including the stopping. The knowledge was already there: the base model learned every capital from the fact pages, and the demonstrations only taught it where to put the answer and when to stop.`);

    p.h2('Catastrophic forgetting', 'forgetting');
    p.prose(`
The purple curve in that figure tells a second story. While the demonstration loss drops to nearly zero, the loss on held-out web text climbs, and the first two rows show why: at a high learning rate the fine-tuned model starts ending web pages with \`<end>\`, a token that never occurs on the web, and its quiz pages turn into nonsense. This is **catastrophic forgetting** (McCloskey and Cohen, 1989): a network trained on new data loses what it learned from old data.

The cause is simple. The loss only measures the new data, so gradient descent has no reason to preserve anything else, and every weight is shared between the old skills and the new ones. Weights that encoded "after a question on a quiz page comes another question" get bent toward "after a question comes \`<bot>\`". Nothing pushes back.

In large models the effect is milder but real: fine-tuning on a narrow task can erode general knowledge, other languages, or coding ability. The InstructGPT authors measured an *alignment tax*, regressions on public benchmarks after their RLHF stage. The remedies all add a reason to stay close to where the model started:

- **Be gentle.** A small learning rate and few passes over the data move the weights less.
- **Replay.** Mix some of the original kind of data into every batch, so the old loss keeps being optimized. InstructGPT did this during RLHF, mixing in pretraining gradients ("PPO-ptx"). In the toy above, making half of each batch web text keeps the web loss nearly flat while the chat prompts still learn.
- **Penalize moving.** Elastic weight consolidation (Kirkpatrick et al., 2017) penalizes changes to the weights that mattered most for old tasks. The RL chapters use a cousin of this idea: a [KL penalty](#/policy-gradients) that charges the model for drifting from a frozen reference copy.
- **Change less.** Train far fewer degrees of freedom. Biderman et al. (2024) titled their comparison *LoRA Learns Less and Forgets Less*: on code and math, LoRA lagged full fine-tuning on the target domain but kept more of the base model's other abilities. Which brings us to LoRA.`);

    p.h2('What full fine-tuning costs', 'full-cost');
    p.prose(`
Everything so far was **full fine-tuning**: every weight of the model receives a gradient and an update. For a large model that is as expensive as pretraining, per step. Training with Adam in mixed precision keeps four things per parameter ([Chapter 8](#/parallelism) has the full accounting):`);

    p.math({
      label: 'Memory for full fine-tuning with Adam',
      tex: String.raw`\text{bytes} \approx \underbrace{2N}_{\text{bf16 weights}} + \underbrace{2N}_{\text{bf16 gradients}} + \underbrace{4N}_{\text{fp32 master copy}} + \underbrace{8N}_{\text{Adam } m,\ v} = 16N`,
      code: `
        N = 6.74e9                  # Llama 2 7B
        weights, grads = 2 * N, 2 * N
        master, adam = 4 * N, 8 * N
        (weights + grads + master + adam) / 1e9   # 107.8 GB
      `,
      codeTitle: 'full_ft_memory.py',
      terms: [
        [String.raw`N`, 'the number of parameters'],
        [String.raw`2N`, 'two bytes per number in bfloat16, a 16-bit format: once for the weights, once for their gradients'],
        [String.raw`4N`, 'a 32-bit copy of the weights, so that tiny updates are not rounded away'],
        [String.raw`8N`, "Adam's two running averages per weight, the momentum $m$ and the squared-gradient average $v$, in 32 bits each"],
      ],
      explain: `About 16 bytes per parameter, before counting activations (the intermediate values saved for the backward pass). A 7B model needs about 108 GB: more than an 80 GB GPU holds, so even a modest fine-tune needs several GPUs and the sharding machinery of [Chapter 8](#/parallelism). And the result is a complete new copy of the model, 13.5 GB in bf16, for every task or customer you fine-tune for, each of which has to be stored and loaded onto a GPU to serve.`,
    });

    p.prose(`
This motivated **parameter-efficient fine-tuning**: freeze the pretrained weights and train something small. Early versions inserted small *adapter* layers into every block (Houlsby et al., 2019), learned a few trainable "virtual token" vectors placed in front of the real ones (prefix tuning and prompt tuning, 2021), or trained only the biases (BitFit, 2021). Adapters add layers that run one after another, which slows inference slightly; virtual tokens use up context. **LoRA** (Hu et al., 2021) became the default because it does neither: after training, it can be folded back into the original weights at zero cost. It rests on one observation about the shape of fine-tuning updates.`);

    p.h2('Why a small update can be enough: low rank', 'low-rank');
    p.prose(`
Write the fine-tuned weight matrix as the pretrained one plus a change: $\\symW + \\symdW$. Full fine-tuning learns every entry of $\\symdW$ freely, $d \\times k$ numbers for a $d$ by $k$ matrix. But what if the change, though large as a grid of numbers, is *simple*: made of only a few independent directions? Then it can be stored, and learned, with far fewer numbers. The precise word for "made of few directions" is **rank**.`);

    p.callout('math', `A matrix maps input vectors to output vectors. Its **rank** is the number of independent directions its outputs can point in. A **rank-1** matrix is the simplest kind: a column times a row, $\\boldsymbol u \\boldsymbol v^{\\top}$, where every row is a multiple of the same row $\\boldsymbol v^\\top$. Whatever you feed it, the output points along $\\boldsymbol u$; only its length changes. A rank-$\\symr$ matrix is a sum of $\\symr$ such pieces, and any $d \\times k$ matrix of rank $\\symr$ can be written as a product $\\symB\\symA$ of a $d \\times \\symr$ matrix and an $\\symr \\times k$ matrix. Storing $\\symB$ and $\\symA$ takes $\\symr(d + k)$ numbers instead of $dk$: for $d = k = 4096$ and $\\symr = 8$, that is 65,536 instead of 16.8 million.`, 'Math help: the rank of a matrix');

    p.prose(`
Every matrix, low rank or not, can be taken apart into rank-1 pieces, sorted from strongest to weakest. This is the **singular value decomposition** (SVD), and it answers the natural question: if we may keep only $\\symr$ pieces, which $\\symr$, and how much is lost?`);

    p.math({
      label: 'The best rank-r approximation (Eckart and Young, 1936)',
      tex: String.raw`M = \sum_{i=1}^{\min(n, m)} \sigma_i\, \boldsymbol u_i \boldsymbol v_i^{\top}, \qquad M_{\symr} = \sum_{i=1}^{\symr} \sigma_i\, \boldsymbol u_i \boldsymbol v_i^{\top} = \symB\symA, \qquad \lVert M - M_{\symr} \rVert = \sqrt{\textstyle\sum_{i > \symr} \sigma_i^2}`,
      code: `
        U, s, Vt = np.linalg.svd(M)        # s sorted, largest first
        B = U[:, :r] * s[:r]               # (n, r)
        A = Vt[:r]                         # (r, m)
        err = np.linalg.norm(M - B @ A)    # Frobenius norm
        np.isclose(err, np.sqrt((s[r:] ** 2).sum()))   # True
      `,
      codeTitle: 'svd_truncate.py',
      terms: [
        [String.raw`\sigma_i`, 'the singular values: how strong each piece is, sorted so $\\sigma_1 \\ge \\sigma_2 \\ge \\dots \\ge 0$'],
        [String.raw`\boldsymbol u_i \boldsymbol v_i^{\top}`, 'a rank-1 piece: an output direction $\\boldsymbol u_i$ times an input direction $\\boldsymbol v_i$. The $\\boldsymbol u$s are perpendicular to each other, and so are the $\\boldsymbol v$s'],
        [String.raw`M_{\symr}`, 'keep only the $\\symr$ strongest pieces. Grouped as $\\symB\\symA$, it is a product of a tall thin and a short wide matrix'],
        [String.raw`\lVert M - M_{\symr}\rVert`, 'the error, measured as the square root of the sum of squared entries (the *Frobenius norm*): exactly the size of the pieces dropped'],
      ],
      explain: `Eckart and Young proved in 1936 that no rank-$\\symr$ matrix comes closer to $M$ than this truncation. So "can $M$ be compressed to rank $\\symr$?" has a precise answer: look at how fast its singular values fall. If a few are large and the rest tiny, a low-rank version loses almost nothing. If they are all similar, as for random noise, every dropped piece costs the same.`,
    });

    figLowRank(p);

    p.prose(`
Do fine-tuning updates look like the first matrix or like noise? The evidence says the first. Aghajanyan, Zettlemoyer and Gupta (2020) found that a pretrained RoBERTa could be fine-tuned to 90% of its full-fine-tuning score on a paraphrase task while training only 200 numbers, mapped into the full weight space by a fixed random projection: the *intrinsic dimension* of fine-tuning is tiny. Pretraining has already built the features; adapting to a new task mostly means turning up a few of them and turning down others. LoRA's authors measured the same thing directly in GPT-3: a rank of 1 or 2 on the attention matrices was nearly as good as rank 64, and the directions learned at rank 8 and at rank 64 largely shared their strongest few.`);

    p.h2('LoRA: train B and A, freeze W₀', 'lora');
    p.prose(`
**Low-Rank Adaptation** (Hu et al., 2021) builds the low-rank assumption into the model. For a chosen weight matrix $\\symW$ (say the query projection of an attention layer), freeze it, and add two small trainable matrices whose product is the update:`);

    p.math({
      label: 'A LoRA layer',
      tex: String.raw`\boldsymbol h = \symW\boldsymbol x + \symdW\boldsymbol x = \symW\boldsymbol x + \frac{\symalpha}{\symr}\,\symB\symA\boldsymbol x`,
      code: `
        W0 = layer.weight                   # (d, k), frozen
        A = np.random.randn(r, k) / np.sqrt(k)   # trained
        B = np.zeros((d, r))                # trained
        h = W0 @ x + (alpha / r) * (B @ (A @ x))
      `,
      codeTitle: 'lora_layer.py',
      terms: [
        [String.raw`\boldsymbol x,\ \boldsymbol h`, 'the layer\'s input (length $k$) and output (length $d$)'],
        [String.raw`\symW`, 'the pretrained weights. They never change, and need no gradient or optimizer state'],
        [String.raw`\symA`, 'the *down-projection*, $\\symr \\times k$: squeezes the input into $\\symr$ numbers'],
        [String.raw`\symB`, 'the *up-projection*, $d \\times \\symr$: spreads those $\\symr$ numbers back out to the output size'],
        [String.raw`\frac{\symalpha}{\symr}`, 'a fixed scale on the update, set by the hyperparameter $\\symalpha$ (see below)'],
      ],
      explain: `The new path runs beside the old one: squeeze $\\boldsymbol x$ to $\\symr$ numbers, expand back, scale, and add. Computing it as $\\symB(\\symA\\boldsymbol x)$ costs only $\\symr(d + k)$ multiply-adds and never forms the full $d \\times k$ update. During training, backpropagation flows through the frozen $\\symW$ (it still has to pass gradients to earlier layers) but stores nothing for it, so the optimizer only keeps state for $\\symB$ and $\\symA$.`,
    });

    p.math({
      label: 'Trainable parameters per matrix',
      tex: String.raw`\underbrace{\symr\,(d + k)}_{\symB \text{ and } \symA} \;\ll\; \underbrace{d\,k}_{\text{all of } \symdW}`,
      code: `
        d = k = 4096; r = 8      # one attention matrix, Llama 2 7B
        full = d * k             # 16,777,216
        lora = r * (d + k)       # 65,536
        lora / full              # 0.0039: about 0.4%
      `,
      terms: [
        [String.raw`\symr(d + k)`, '$d\\symr$ numbers in $\\symB$ plus $\\symr k$ in $\\symA$'],
        [String.raw`dk`, 'the number of entries in the matrix being adapted'],
        [String.raw`\ll`, '"much less than": with $\\symr$ in the single or double digits and $d, k$ in the thousands, tens to hundreds of times less'],
      ],
      explain: `On GPT-3 175B, the LoRA paper cut the trainable parameters by a factor of about 10,000 and training memory by about 3, and shrank each fine-tuned checkpoint from 350 GB to about 35 MB. Quality matched or beat full fine-tuning on the benchmarks they tried.`,
    });

    p.prose(`
### Why B starts at zero

At the start of training we want the model to be *exactly* the pretrained model: it is good, and any random change could only damage it. So LoRA initializes $\\symB$ to zero. Then $\\symB\\symA = 0$, the extra path adds nothing, and step 0 reproduces the base model perfectly.

Why not set $\\symA$ to zero too? Look at the gradients. With $\\boldsymbol g$ the gradient of the loss with respect to the layer's output $\\boldsymbol h$ (what backpropagation delivers to this layer), the chain rule gives:`);

    p.math({
      label: 'The gradients of B and A',
      tex: String.raw`\frac{\partial \symL}{\partial \symB} = \frac{\symalpha}{\symr}\,\boldsymbol g\,(\symA\boldsymbol x)^{\top}, \qquad \frac{\partial \symL}{\partial \symA} = \frac{\symalpha}{\symr}\,\symB^{\top}\boldsymbol g\,\boldsymbol x^{\top}`,
      code: `
        g = dloss_dh                              # (d,), from backprop
        dB = (alpha / r) * np.outer(g, A @ x)     # nonzero at step 0
        dA = (alpha / r) * np.outer(B.T @ g, x)   # zero while B == 0
      `,
      codeTitle: 'lora_grads.py',
      terms: [
        [String.raw`\boldsymbol g`, 'how the loss would change if each output number changed: $\\partial \\symL / \\partial \\boldsymbol h$'],
        [String.raw`\boldsymbol g\,(\symA\boldsymbol x)^{\top}`, "an outer product: one column per entry of the squeezed input $\\symA\\boldsymbol x$. Nonzero as long as $\\symA$ is not zero"],
        [String.raw`\symB^{\top}\boldsymbol g\,\boldsymbol x^{\top}`, 'the gradient for $\\symA$ passes through $\\symB$ first, so it is exactly zero while $\\symB$ is zero'],
      ],
      explain: `With $\\symA$ random and $\\symB$ zero, the first step moves $\\symB$ (its gradient is not zero), and from then on $\\symA$ moves too. With both at zero, both gradients are zero forever: the adapter is stuck at a saddle point and never learns anything. With both random, training works but starts from a damaged model. Exactly one of the two must start at zero, and by convention it is $\\symB$.`,
    });

    p.prose(`
### The scale α / r

The update is multiplied by $\\symalpha / \\symr$. The point is to make the rank a knob you can turn without re-tuning everything else: a larger $\\symr$ means more terms summed in $\\symB\\symA$, and dividing by $\\symr$ keeps the update's size roughly steady. With Adam, raising $\\symalpha$ acts much like raising the learning rate, so the LoRA paper simply set $\\symalpha$ to the first $\\symr$ it tried and never tuned it. Common settings today are $\\symr$ between 8 and 64 with $\\symalpha$ equal to $\\symr$ or $2\\symr$, and a learning rate several times higher than full fine-tuning would use. (Later work, *rank-stabilized* LoRA in 2023, argued that $\\symalpha / \\sqrt{\\symr}$ behaves better at large ranks.)`);

    figLoraTrain(p);

    p.prose(`
### Which matrices to adapt

A transformer block has several weight matrices: the query, key, value and output projections of attention ($W_q, W_k, W_v, W_o$), and the two or three matrices of the MLP. LoRA can be applied to any subset. The original paper adapted only attention: on GPT-3 with a fixed budget of trainable parameters, adapting $W_q$ and $W_v$ at rank 4, or all four attention matrices at rank 2, beat putting the whole budget into one matrix. The QLoRA paper (next section) found that to match full fine-tuning it was necessary to adapt *every* linear layer, MLP included, and that is the usual default now. Spreading a small rank over many matrices tends to beat a large rank on a few.

### Merging

After training, the adapter can be folded into the frozen weights. The merged matrix has the same shape as the original, so the model runs at exactly the original speed, with no extra layers:`);

    p.math({
      label: 'Merging an adapter into the base weights',
      tex: String.raw`W' = \symW + \frac{\symalpha}{\symr}\,\symB\symA \quad\Longrightarrow\quad W'\boldsymbol x = \symW\boldsymbol x + \frac{\symalpha}{\symr}\,\symB\symA\boldsymbol x`,
      code: `
        W_merged = W0 + (alpha / r) * B @ A    # (d, k), like W0
        np.allclose(W_merged @ x,
                    W0 @ x + (alpha / r) * B @ (A @ x))   # True
        W_back = W_merged - (alpha / r) * B @ A   # unmerge
      `,
      codeTitle: 'merge.py',
      terms: [
        [String.raw`W'`, 'one ordinary weight matrix that already includes the update'],
        [String.raw`\Longrightarrow`, 'by the distributive law, multiplying by $W\'$ gives the same output as the two-path LoRA layer'],
      ],
      explain: `Merging is what sets LoRA apart from adapter layers: zero extra inference cost. Or you can *not* merge, and keep one base model in GPU memory with many small adapters beside it, choosing an adapter per request. A rank-8 adapter on $W_q$ and $W_v$ of a 7B model is 4.2 million numbers, about 8 MB in bf16, against 13.5 GB for a full copy, so serving a hundred fine-tuned variants costs barely more than serving one. Subtracting the update restores the original weights (up to rounding), which lets a server swap merged adapters too.`,
    });

    p.h2('QLoRA: a 4-bit base model', 'qlora');
    p.prose(`
LoRA removes the gradients and optimizer state of the base weights, but the base weights themselves still sit in GPU memory: 2 bytes per parameter, 13.5 GB for 7B, 140 GB for 70B. **QLoRA** (Dettmers et al., 2023) shrinks them to about half a byte. The base model is *quantized*, stored as 4-bit codes, and frozen; LoRA adapters in bf16 are trained on top. In every forward and backward pass, each block of weights is *dequantized* back to bf16 on the fly, multiplied, and thrown away, so all arithmetic still happens in 16 bits; only storage is 4-bit. Gradients flow through the dequantized weights into the adapters.

The paper made three contributions:

- **NF4** ("4-bit NormalFloat"), a set of 16 levels shaped for the bell-curve distribution of trained weights, below.
- **Double quantization.** Each block of 64 weights needs its own 32-bit scale, which adds $32/64 = 0.5$ bits per weight. QLoRA quantizes those scales too, to 8 bits in blocks of 256, bringing the overhead down to about 0.127 bits per weight.
- **Paged optimizers.** Memory use spikes on long sequences; instead of crashing, optimizer state is moved automatically to CPU memory and back (using NVIDIA's unified memory), like an operating system paging to disk.

Together they made it possible to fine-tune a 65-billion-parameter model on a single 48 GB GPU, and the paper's Guanaco models, trained that way in about a day, were competitive with ChatGPT on its chatbot benchmark.`);

    p.math({
      label: 'Blockwise 4-bit quantization',
      tex: String.raw`c = \max_{i \in \text{block}} |w_i|, \qquad q(w) = \arg\min_{j} \left| \frac{w}{c} - \ell_j \right|, \qquad \hat w = c\,\ell_{q(w)}`,
      code: `
        c = np.abs(block).max()          # one scale per 64 weights
        q = np.abs(block[:, None] / c - NF4).argmin(1)   # codes 0-15
        w_hat = NF4[q] * c               # dequantized, in bf16
      `,
      codeTitle: 'quantize_block.py',
      terms: [
        [String.raw`c`, "the block's *absmax*: the largest absolute weight among its 64. Dividing by it puts every weight in $[-1, 1]$"],
        [String.raw`\ell_0, \dots, \ell_{15}`, 'the 16 levels a 4-bit code can name. For NF4 they are fixed numbers between $-1$ and $1$'],
        [String.raw`\arg\min_j |\cdot|`, 'pick the nearest level; its index $j$, from 0 to 15, is the 4-bit code that gets stored'],
        [String.raw`\hat w`, 'dequantization: look the level up and scale it back. The difference $\\hat w - w$ is the quantization error'],
      ],
      explain: `Weights in a trained layer are spread roughly like a bell curve: many near zero, few large. Evenly spaced levels waste codes on the sparse tails. NF4's levels are instead **quantiles** of a normal distribution, rescaled to $[-1, 1]$: points chosen so that roughly equal shares of a bell curve's values fall near each one, with an exact zero kept. Each block gets its own scale $c$, so one large outlier only coarsens its own 64 neighbors rather than the whole matrix.`,
    });

    figNF4(p);

    p.prose(`
Put the pieces together and the memory picture changes by an order of magnitude at each step. The calculator below uses the same per-parameter accounting as above; the parameter counts come from the published shapes of three Llama models.`);

    figMemory(p);

    p.callout('warning', `A QLoRA adapter was trained against the *quantized* base. Merging it means dequantizing the base to 16 bits and adding $\\symB\\symA$, which gives a 16-bit model slightly different from the one the adapter was trained with; re-quantizing the merged model changes it again. Both usually cost little, but evaluate the model you will actually serve.`, 'Merging after QLoRA');

    p.h2('Distillation: demonstrations from a stronger model', 'distillation');
    p.prose(`
Human-written demonstrations are the most expensive part of SFT. A cheaper source is another model. **Knowledge distillation** (Hinton, Vinyals and Dean, 2015) trains a small *student* to imitate a large *teacher*. For language models it most often takes the simplest form, *sequence-level* distillation (Kim and Rush, 2016): have the teacher write answers to many prompts, then fine-tune the student on them with the ordinary SFT loss. Alpaca (2023) fine-tuned a 7B LLaMA on 52,000 answers written by an OpenAI model; Vicuna used conversations people had shared from ChatGPT. DeepSeek-R1's small models were made this way too: about 800,000 samples from the large reasoning model, used to fine-tune Qwen and Llama models from 1.5B to 70B with no RL at all ([Chapter 17](#/grpo)).

If the teacher's weights are available, and it shares the student's tokenizer, the student can learn from more than the teacher's chosen words. At every position the teacher has a full probability distribution over the next token, and the student can be trained to match it:`);

    p.math({
      label: 'Token-level distillation: match the teacher’s distribution',
      tex: String.raw`\symL_{\text{KD}} = \frac{1}{\sum_t \symm_t}\sum_t \symm_t \sum_{v} p_T(v \mid y_{<t}) \log \frac{p_T(v \mid y_{<t})}{p_\theta(v \mid y_{<t})}`,
      code: `
        p_t = softmax(teacher_logits)        # (n, V), teacher
        log_q = log_softmax(student_logits)  # (n, V), student
        kl = (p_t * (np.log(p_t) - log_q)).sum(-1)   # per token
        loss = (kl * mask).sum() / mask.sum()
      `,
      codeTitle: 'distill_loss.py',
      terms: [
        [String.raw`p_T(v \mid y_{<t})`, 'the teacher\'s probability for each possible next token $v$, after the same context'],
        [String.raw`p_\theta(v \mid y_{<t})`, "the student's probability for the same token"],
        [String.raw`\sum_v p_T \log \frac{p_T}{p_\theta}`, 'the **KL divergence** from teacher to student: zero when the two distributions agree, larger the more probability the student puts in the wrong places'],
        [String.raw`\symm_t`, 'the same answer-only mask as in SFT'],
      ],
      explain: `This is SFT with a softer target. The SFT loss says "the next token is *Canberra*"; this loss says "*Canberra* with 55%, *Sydney* 18%, ...". Expanding the log, it equals the cross-entropy against the teacher's probabilities minus the teacher's own entropy, a constant, so minimizing it is fine-tuning on soft labels. Hinton and colleagues called the information in those small probabilities "dark knowledge": which wrong answers are plausible, and which are absurd.`,
    });

    figDistill(p);

    p.prose(`
Distillation has limits worth knowing. A student trained on a teacher's text inherits the teacher's mistakes along with its style, and style is the easy part: Gudibande et al. (2023), in *The False Promise of Imitating Proprietary LLMs*, found that imitation models sounded like ChatGPT to human raters while closing little of the gap on factual accuracy and harder tasks. A second gap is subtler: the student is trained on the teacher's text but at test time reads its own, which drifts somewhere the teacher never went. *On-policy* distillation (Agarwal et al., 2023) closes it by letting the student write and the teacher grade every token, a step toward the reinforcement learning of the next chapters. And the terms of service of many commercial models forbid using their outputs to train competing models.`);

    p.callout('idea', `
- A **base model** continues documents; **SFT** on demonstrations teaches it which document to write: an assistant's reply, in a fixed format, ending when it should.
- A **chat template** turns a conversation into one token sequence, with special tokens marking each message's start, role and end. Train and serve with the same template.
- **Loss masking** grades only the assistant's tokens, including the end-of-turn token: $\\symm_t = 1$ there, 0 elsewhere.
- Fine-tuning on narrow data causes **catastrophic forgetting**; small learning rates, replay of old data, penalties on drift and parameter-efficient methods reduce it.
- **LoRA** freezes $\\symW$ and learns $\\symdW = \\frac{\\symalpha}{\\symr}\\symB\\symA$ of rank $\\symr$: it works because fine-tuning updates are close to low rank. $\\symB$ starts at zero so training starts from the base model, and the adapter can be merged for free.
- **QLoRA** stores the frozen base in 4-bit NF4 with double-quantized scales and trains LoRA adapters through it, putting a 65B fine-tune on one GPU.
- **Distillation** uses a stronger model's outputs (or its full distributions) as SFT data: cheap and effective, but capped by the teacher.`, 'Takeaways');

    p.h2('Build it yourself', 'exercises');
    p.prose(`
1. **Low rank in NumPy (10 minutes).** Build $M$ = (a 64 × 64 rank-4 matrix) + 0.01 × noise, and a pure-noise matrix of the same size. For $\\symr$ = 1 to 64, compute the rank-$\\symr$ SVD truncation and its relative error, and plot both curves. Check numerically that the error equals $\\sqrt{\\sum_{i>\\symr}\\sigma_i^2}$, and that a random rank-$\\symr$ product of your own (random $\\symB$, $\\symA$ fitted by least squares) never beats the truncation. *Success:* one curve drops to the noise floor at $\\symr = 4$, the other falls almost linearly.
2. **A LoRA layer, forward and backward.** Write \`LoRALinear\` in NumPy with a frozen \`W0\` and trainable \`A\`, \`B\`. Implement the backward pass from this chapter's gradient equations and check it against numerical gradients ([the optimization chapter](#/optimization)). Verify that with \`B = 0\` the layer's output equals \`W0 @ x\` and \`dA\` is exactly zero, then merge the adapter and check the outputs match. *Success:* the gradient check passes to about 1e-6, and the merged and unmerged layers agree.
3. **Masks from a template.** Write \`render(messages)\` that produces ChatML token pieces and a mask, using any tokenizer (the BPE from [Chapter 3](#/tokenization) works). Handle multi-turn conversations and the generation prompt. Unit-test that the mask is 1 exactly on the assistants' content and \`<|im_end|>\` tokens. *Success:* your output matches \`tokenizer.apply_chat_template\` from Hugging Face for a Qwen model on ten conversations with a system prompt, token for token.
4. **NF4 versus int4.** Implement blockwise absmax quantization with the 16 NF4 levels and with symmetric int4. Quantize the weight matrices of any small pretrained model (GPT-2 small is easy to download), and report the error per layer for block sizes 32, 64, 256 and a whole matrix. Then add double quantization of the scales and compute the bits per weight. *Success:* NF4 beats int4 on every layer, and you can explain which layers suffer most and why (look at their outliers).
5. **Project: LoRA versus full fine-tuning, and what it forgets.** With PyTorch and the \`peft\` library, fine-tune a small base model (a few hundred million parameters, such as SmolLM2-360M or Qwen2.5-0.5B) on a few thousand examples of an open instruction dataset, once with full fine-tuning and once with LoRA on all linear layers ($\\symr$ = 16). Before and after, measure (a) the loss on held-out demonstrations and (b) the perplexity on held-out web text such as a slice of Wikipedia. Then repeat the LoRA run with 4-bit loading (QLoRA) and record peak GPU memory for all three. *Success:* a small table showing which method learned the task best, which forgot the least, and what each cost in memory.`);
  },
};

export default chapter;
