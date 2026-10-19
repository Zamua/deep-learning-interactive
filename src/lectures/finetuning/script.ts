import type { LectureScript } from '../../lecture/types';

export const script: LectureScript = {
  id: 'finetuning',
  title: 'Fine-tuning, instruction tuning and LoRA',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'intro',
      title: 'From text predictor to assistant',
      codeTitle: 'the_plan.py',
      code: `
        # a base model continues documents   #@base
        base.complete("What is the capital of")  #@base
        # France? What is the capital of     #@more
        # Spain? What is the capital of ...  #@more

        assistant = sft(base, demos)  # part 1  #@sft
        # "Paris." <end>                     #@answer
        adapter = lora(base, demos)   # part 2  #@lora
      `,
      beats: [
        { id: 'hello', say: 'This lecture is about the step that turns a language model into an assistant: fine-tuning.', code: 'base' },
        { id: 'base', say: 'Pretraining gives us a base model, one that has read a large slice of the web and can continue any text.', code: 'base' },
        { id: 'more', say: 'But ask it a question, and it may simply write more questions, because on the web, questions often come in lists.', code: 'more' },
        { id: 'doc', say: 'It is not broken. It is doing exactly what it was trained to do: continue the document.', code: 'more' },
        { id: 'sft', say: 'The first half of this lecture is supervised fine-tuning: training on written-out examples of the behavior we want.', code: 'sft' },
        { id: 'answer', say: 'Afterwards, the same question gets an answer, and the model stops when it is done.', code: 'answer' },
        { id: 'cost', say: 'The second half is about cost. Updating every weight of a large model is expensive, so we will learn {LoRA|Laura}, which trains a small low-rank correction instead.', code: 'lora' },
        { id: 'next', say: 'And all of it is the starting point for learning from rewards instead of examples.', code: 'sft' },
      ],
    },
    {
      id: 'sft',
      title: 'Demonstrations',
      codeTitle: 'sft.py',
      code: `
        demos = load("demonstrations")      #@data
        # (prompt, ideal answer) pairs      #@data
        for prompt, answer in demos:        #@loop
            lp = model.logprob(answer, prompt)  #@loss
            loss = -lp / len(answer)        #@loss
            loss.backward(); opt.step()     #@step
        # InstructGPT: ~13k prompts         #@igpt
        # LIMA: 1,000 curated examples      #@lima
      `,
      beats: [
        { id: 'what', say: 'Supervised fine-tuning, or {SFT|S F T}, starts from demonstrations: prompts, each paired with the answer we wish the model had given.', code: 'data' },
        { id: 'loss', say: 'Training uses the very same loss as pretraining, the negative log-probability of each next token, but now on the answers.', code: 'loss' },
        { id: 'step', say: 'So nothing about the machinery is new. Only the data changed.', code: 'step' },
        { id: 'sources', say: 'Demonstrations come from people writing answers, from old datasets rephrased as instructions, from stronger models, and from real conversations.', code: 'data' },
        { id: 'igpt', say: 'For InstructGPT, in {2022|twenty twenty-two}, labelers wrote answers for about thirteen thousand prompts.', code: 'igpt' },
        { id: 'pref', say: 'After that fine-tuning, plus the feedback training of later chapters, labelers preferred its {1.3 billion|one point three billion} parameter model to the {175 billion|hundred and seventy five billion} parameter {GPT-3|G P T three} it started from.', code: 'igpt' },
        { id: 'lima', say: 'And the {LIMA|Leema} paper found that just one thousand carefully chosen examples made a capable assistant.', code: 'lima' },
        { id: 'hyp', say: 'Its authors’ explanation: the knowledge comes from pretraining, and fine-tuning mostly teaches the format to use it in.', code: 'lima' },
      ],
    },
    {
      id: 'template',
      title: 'Chat templates',
      codeTitle: 'template.py',
      code: `
        messages = [
          {"role": "system", "content": sys},  #@roles
          {"role": "user", "content": q},      #@roles
        ]
        text = tok.apply_chat_template(        #@apply
            messages, add_generation_prompt=True)  #@gen
        # <|im_start|>system\\n...<|im_end|>  #@out
        # <|im_start|>user\\n...<|im_end|>    #@out
        # <|im_start|>assistant\\n            #@gen
      `,
      beats: [
        { id: 'roles', say: 'A conversation is a list of messages, each with a role: system, user, or assistant.', code: 'roles' },
        { id: 'flat', say: 'But the model reads one flat sequence of tokens. A chat template is the rule that flattens the conversation.', code: 'apply' },
        { id: 'special', say: 'It marks where each message starts, who wrote it, and where it ends, using special tokens that no typed text can produce.', code: 'out' },
        { id: 'chatml', say: 'In the {ChatML|chat M L} format, each message opens with {im_start|im-start}, then the role, and closes with {im_end|im-end}.', code: 'out' },
        { id: 'gen', say: 'At inference time, the server writes the conversation so far, plus the opening of an assistant message, and lets the model continue.', code: 'gen' },
        { id: 'stop', say: 'Generation ends when the model writes the end token itself. So the model must learn to produce it, or it will ramble on.', code: 'gen' },
        { id: 'same', say: 'And a model must be served with the same template it was trained on. A different one is a pattern it has never seen.', code: 'apply' },
      ],
    },
    {
      id: 'mask',
      title: 'Loss on the answer only',
      codeTitle: 'sft_loss.py',
      code: `
        ids, mask = render(messages)          #@render
        # mask: 1 on the assistant's tokens   #@mask
        logits = model(ids)                   #@fwd
        logp = log_softmax(logits[:-1])       #@fwd
        tok = logp[np.arange(n - 1), ids[1:]] #@fwd
        loss = -(mask[1:] * tok).sum()        #@loss
        loss = loss / mask[1:].sum()          #@avg
        # {{nl:10}} of {{nt:50}} tokens carry loss
      `,
      beats: [
        { id: 'same', say: 'Rendered through the template, a conversation is ready for the pretraining loss: at every position, predict the next token.', code: 'fwd' },
        { id: 'not', say: 'But we do not want the model to get good at writing everything here: not the system prompt, and not the user’s questions.', code: 'render' },
        { id: 'mask', say: 'So each position gets a mask, m. One for tokens the assistant wrote, zero for everything else.', code: 'mask' },
        { id: 'end', say: 'The end-of-turn token counts as the assistant’s too. That is how the model learns to stop.', code: 'mask' },
        { id: 'read', say: 'Masked-out tokens stay in the context. The model reads them; its predictions there are just never graded.', code: 'fwd' },
        { id: 'loss', say: 'The loss multiplies each token’s log-probability by its mask, and adds them up...', code: 'loss' },
        { id: 'avg', say: 'then divides by the number of ones: an average over the answer tokens only.', code: 'avg' },
        { id: 'count', say: 'In this two-turn conversation, ten of the fifty tokens carry loss.', code: 'avg' },
        { id: 'torch', say: 'In {PyTorch|pie torch}, the masked targets are usually set to minus one hundred, a value the cross-entropy function skips.', code: 'loss' },
      ],
    },
    {
      id: 'toy',
      title: 'SFT in miniature',
      codeTitle: 'sft_toy.py',
      code: `
        base = pretrain(web_pages)  # 1,200 steps  #@pre
        model = copy(base)
        for step in range(400):                   #@loop
            batch = sample(demos, 16)             #@sft
            loss = masked_xent(model, batch)      #@loss
            adam_step(model, loss, lr=0.01)       #@loss
        # step {{step:0}}: demo loss {{dl:…}}
        model.generate(prompt)                    #@gen
      `,
      beats: [
        { id: 'setup', say: 'Here is the whole recipe on a model small enough to see completely: under four thousand weights, and a forty-word vocabulary.', code: 'pre' },
        { id: 'web', say: 'Its web is six hundred made-up pages: lists of facts, quiz pages full of questions, and a few question-and-answer pages.', code: 'pre' },
        { id: 'base', say: 'Ask the base model a bare question, and it writes the next quiz question. It learned that from the quiz pages.', code: 'gen' },
        { id: 'chat', say: 'Give it the chat template, and it stumbles: it has never seen these tokens.', code: 'gen' },
        { id: 'demos', say: 'Now fine-tune on sixteen short conversations, with loss on the answers only.', code: 'sft' },
        { id: 'curve', say: 'The loss on the demonstrations, in red, collapses within a hundred steps.', code: 'loss' },
        { id: 'answers', say: 'And the chat prompts now get answers, each followed by the end token.', code: 'gen' },
        { id: 'knew', say: 'The model already knew every capital from the fact pages. The demonstrations only taught it where to put the answer, and when to stop.', code: 'gen' },
      ],
    },
    {
      id: 'forget',
      title: 'Catastrophic forgetting',
      codeTitle: 'replay.py',
      code: `
        for step in range(400):
            batch = sample(demos, 16)
            if replay:                          #@replay
                batch += sample(web_pages, 16)  #@replay
            loss = masked_xent(model, batch)    #@loss
            adam_step(model, loss, lr=lr)       #@lr
        # the loss sees only this batch,        #@why
        # so nothing rewards old skills         #@why
      `,
      beats: [
        { id: 'purple', say: 'But watch the purple curve: the loss on held-out web text. While the red one falls, it climbs.', code: 'loss' },
        { id: 'broken', say: 'And the bare question now gets nonsense. The model is forgetting the web.', code: 'loss' },
        { id: 'name', say: 'This is catastrophic forgetting: a network trained on new data loses what it learned from old data.', code: 'why' },
        { id: 'why', say: 'The loss only measures the new batch, so gradient descent has no reason to preserve anything else.', code: 'why' },
        { id: 'shared', say: 'And every weight is shared, so the weights that held the old skill get bent toward the new one.', code: 'why' },
        { id: 'gentle', say: 'The first remedy is to be gentle: a smaller learning rate, and fewer passes over the data.', code: 'lr' },
        { id: 'replay', say: 'The second is replay: mix some old data into every batch, so the old loss keeps being optimized.', code: 'replay' },
        { id: 'flat', say: 'With half of each batch from the web, the purple curve stays nearly flat, and the bare question keeps its old answer.', code: 'replay' },
        { id: 'others', say: 'Other remedies penalize moving away from the starting weights, or train far fewer of them. That second idea leads to {LoRA|Laura}.', code: 'lr' },
      ],
    },
    {
      id: 'cost',
      title: 'What full fine-tuning costs',
      codeTitle: 'memory.py',
      code: `
        N = 6.74e9               # Llama 2 7B  #@N
        weights = 2 * N          # bf16        #@w
        grads = 2 * N            # bf16        #@g
        master = 4 * N           # fp32 copy   #@m
        adam = 8 * N             # m and v     #@a
        total = weights + grads + master + adam  #@t
        total / 1e9              # 107.8 GB    #@t
      `,
      beats: [
        { id: 'full', say: 'Everything so far was full fine-tuning: every weight gets a gradient and an update.', code: 'N' },
        { id: 'bytes', say: 'With Adam in mixed precision, each parameter costs about sixteen bytes.', code: 't' },
        { id: 'wg', say: 'Two for the weight in {bfloat16|B float sixteen}, two for its gradient...', code: ['w', 'g'] },
        { id: 'ma', say: 'four for a thirty-two-bit master copy, and eight for the two running averages of Adam.', code: ['m', 'a'] },
        { id: 'total', say: 'For a seven billion parameter model, that is about a hundred and eight gigabytes before activations: more than an eighty gigabyte {GPU|G P U} holds.', code: 't' },
        { id: 'copy', say: 'And every fine-tune produces a whole new copy of the model: thirteen and a half gigabytes, per task, per customer.', code: 'w' },
        { id: 'peft', say: 'Parameter-efficient methods freeze the pretrained weights and train something small instead. The one that won is {LoRA|Laura}.', code: 'N' },
      ],
    },
    {
      id: 'rank',
      title: 'Low rank',
      codeTitle: 'low_rank.py',
      code: `
        R1 = u @ v.T         # rank 1: d x k     #@r1
        U, s, Vt = np.linalg.svd(M)              #@svd
        r = {{r:1}}
        B = U[:, :r] * s[:r]      # (d, r)       #@BA
        A = Vt[:r]                # (r, k)       #@BA
        M_r = B @ A               # best rank r  #@best
        stored = r * (d + k)      # not d * k    #@cost
        # error {{err:…}}
      `,
      beats: [
        { id: 'idea', say: 'Write the fine-tuned weights as the old ones plus a change: {W₀ + ΔW|W nought plus delta W}.', code: 'best' },
        { id: 'simple', say: 'Full fine-tuning learns every entry of delta W. But what if the change is simple, made of only a few directions?', code: 'best' },
        { id: 'r1', say: 'The simplest matrix is rank one: a column times a row. Every row is a multiple of the same row.', code: 'r1' },
        { id: 'rankr', say: 'A rank r matrix is a sum of r such pieces, and it can be stored as a tall, thin B times a short, wide A.', code: 'BA' },
        { id: 'cost', say: 'That takes r times d plus k numbers, instead of d times k. For a four-thousand-wide matrix at rank eight: sixty-five thousand, instead of sixteen million.', code: 'cost' },
        { id: 'svd', say: 'The singular value decomposition takes any matrix apart into rank-one pieces, sorted from strongest to weakest.', code: 'svd' },
        { id: 'best', say: 'Keep the first r, and you have the best rank r approximation there is. Eckart and Young proved that in {1936|nineteen thirty-six}.', code: 'best' },
        { id: 'grow', say: 'Watch the rank grow. This matrix is built like a fine-tuning update: a few strong directions, plus a little noise.', code: ['BA', 'best'] },
        { id: 'small', say: 'By rank four or five, the error is already small.', code: 'best' },
        { id: 'noise', say: 'Random noise is different. Its singular values are all alike, and every dropped piece costs as much as the last.', code: 'svd' },
        { id: 'evidence', say: 'Fine-tuning updates look like the first kind. Pretraining already built the features; adapting mostly turns a few of them up or down.', code: 'best' },
      ],
    },
    {
      id: 'lora',
      title: 'LoRA',
      codeTitle: 'lora.py',
      code: `
        W0 = layer.weight            # frozen    #@W0
        A = np.random.randn(r, k) / np.sqrt(k)   #@A
        B = np.zeros((d, r))         # zero!     #@B
        h = W0 @ x + (alpha / r) * B @ (A @ x)   #@h
        # trains r * (d + k) numbers             #@count
        dB = (alpha / r) * np.outer(g, A @ x)    #@dB
        dA = (alpha / r) * np.outer(B.T @ g, x)  #@dA
      `,
      beats: [
        { id: 'what', say: 'Low-Rank Adaptation, {LoRA|Laura}, from {2021|twenty twenty-one}, builds the low-rank idea into the model.', code: 'W0' },
        { id: 'freeze', say: 'Pick a weight matrix, W nought, and freeze it. It gets no gradient, and no optimizer state.', code: 'W0' },
        { id: 'path', say: 'Beside it, add a second path: A squeezes the input down to r numbers, and B spreads them back out.', code: ['A', 'B'] },
        { id: 'h', say: 'The two outputs are added, with the update scaled by alpha over r.', code: 'h' },
        { id: 'count', say: 'Only A and B train: at rank eight, about four tenths of one percent of the matrix.', code: 'count' },
        { id: 'gpt3', say: 'On {GPT-3|G P T three}, this cut the trainable parameters about ten-thousand-fold, and each checkpoint from {350|three hundred and fifty} gigabytes to about {35|thirty-five} megabytes.', code: 'count' },
        { id: 'zero', say: 'Now the clever detail: B starts at zero. Then B times A is zero, and step zero is exactly the pretrained model.', code: 'B' },
        { id: 'whyA', say: 'Why not A too? Look at the gradients. The gradient of B passes through A, so it is not zero.', code: 'dB' },
        { id: 'stuck', say: 'The gradient of A passes through B, so at first it is zero. B moves, then A follows. If both started at zero, neither would ever move.', code: 'dA' },
        { id: 'alpha', say: 'And alpha over r keeps the size of the update steady as you change the rank, so r can be turned without re-tuning everything else.', code: 'h' },
        { id: 'typical', say: 'Typical settings are ranks from eight to sixty-four, with alpha equal to r, or twice r.', code: 'h' },
      ],
    },
    {
      id: 'merge',
      title: 'Which matrices, and merging',
      codeTitle: 'merge.py',
      code: `
        targets = ["q", "k", "v", "o",          #@which
                   "gate", "up", "down"]        #@which
        W_merged = W0 + (alpha / r) * B @ A     #@merge
        # same shape as W0: no extra cost       #@merge
        W_back = W_merged - (alpha / r) * B @ A #@unmerge
        # q, v adapter, r = 8, 7B: 4.2M numbers #@size
        # about 8 MB, vs 13.5 GB for a copy     #@size
      `,
      beats: [
        { id: 'which', say: 'Which matrices get adapters? A transformer block has the attention projections, for query, key, value and output, and the matrices of the {MLP|M L P}.', code: 'which' },
        { id: 'paper', say: 'The original paper adapted attention only, and found that query and value together beat spending the whole budget on one matrix.', code: 'which' },
        { id: 'all', say: 'The {QLoRA|cue Laura} paper later found that matching full fine-tuning needed an adapter on every linear layer. That is the usual default now.', code: 'which' },
        { id: 'merge', say: 'After training, the adapter folds into the weights: W nought, plus alpha over r times B A. Same shape, same speed.', code: 'merge' },
        { id: 'latency', say: 'That is what set {LoRA|Laura} apart from earlier adapter layers, which added extra steps to every forward pass.', code: 'merge' },
        { id: 'many', say: 'Or keep adapters separate: one base model in memory, and a small adapter chosen per request.', code: 'size' },
        { id: 'size', say: 'A rank-eight adapter on query and value of a seven billion parameter model is about eight megabytes, against thirteen and a half gigabytes for a full copy.', code: 'size' },
        { id: 'swap', say: 'And subtracting the update restores the original, so even merged adapters can be swapped.', code: 'unmerge' },
      ],
    },
    {
      id: 'qlora',
      title: 'QLoRA and NF4',
      codeTitle: 'qlora.py',
      code: `
        c = np.abs(block).max()      # absmax    #@c
        z = block / c                # in [-1, 1] #@c
        q = np.abs(z[:, None] - NF4).argmin(1)   #@q
        w_hat = NF4[q] * c           # decode    #@deq
        # 4 bits + 32/64 for c: 4.5 bits         #@dq
        # double quantization: 4.127 bits        #@dq
        # 70B: full 1,104 GB, LoRA 138,          #@mem
        #      QLoRA 37                          #@mem
      `,
      beats: [
        { id: 'still', say: '{LoRA|Laura} removes the gradients and optimizer state of the base, but the base weights still sit in memory, two bytes each.', code: 'c' },
        { id: 'qlora', say: '{QLoRA|cue Laura}, from {2023|twenty twenty-three}, stores the frozen base in four bits, and trains sixteen-bit adapters on top.', code: 'c' },
        { id: 'dequant', say: 'Each block of weights is decoded back to sixteen bits on the fly, used, and thrown away. Only the storage is four-bit.', code: 'deq' },
        { id: 'block', say: 'To quantize, take a block of sixty-four weights and divide by the largest, so everything lands between minus one and one...', code: 'c' },
        { id: 'snap', say: 'then snap each weight to the nearest of sixteen levels, and store that level’s number: four bits.', code: 'q' },
        { id: 'nf4', say: 'Which sixteen levels? Trained weights are spread like a bell curve, crowded near zero. {NF4|N F four} puts its levels at quantiles of a normal distribution: dense where the weights are.', code: 'q' },
        { id: 'even', say: 'Evenly spaced levels waste codes on the thin tails. On these weights, the error of {NF4|N F four} is about fifteen percent lower.', code: 'q' },
        { id: 'dq', say: 'Each block also stores its scale, adding half a bit per weight. Double quantization compresses the scales too, down to about an eighth of a bit.', code: 'dq' },
        { id: 'paged', say: 'And paged optimizers move optimizer state out to {CPU|C P U} memory during spikes, instead of crashing.', code: 'dq' },
        { id: 'mem', say: 'Together: a seventy billion parameter model needs about eleven hundred gigabytes to fully fine-tune, about a hundred and forty with {LoRA|Laura}, and under forty with {QLoRA|cue Laura}.', code: 'mem' },
        { id: 'one', say: 'The paper fine-tuned a sixty-five billion parameter model on a single {GPU|G P U} with forty-eight gigabytes.', code: 'mem' },
      ],
    },
    {
      id: 'distill',
      title: 'Distillation',
      codeTitle: 'distill.py',
      code: `
        for prompt in prompts:                  #@gen
            answer = teacher.generate(prompt)   #@gen
            demos.append((prompt, answer))      #@gen
        student = sft(student, demos)           #@sft
        # or, with the teacher's logits:        #@kd
        p_t = softmax(teacher_logits)           #@kd
        kl = (p_t * (log(p_t) - log_q)).sum(-1) #@kd
        loss = (kl * mask).sum() / mask.sum()   #@kd
      `,
      beats: [
        { id: 'cost', say: 'Human-written demonstrations are the expensive part. A cheaper writer is another model.', code: 'gen' },
        { id: 'seq', say: 'In sequence-level distillation, a strong teacher answers many prompts, and a small student is fine-tuned on those answers.', code: ['gen', 'sft'] },
        { id: 'examples', say: 'Alpaca did this with fifty-two thousand answers from an Open A I model. DeepSeek’s small reasoning models came from about eight hundred thousand samples of {R1|R one}, with no reinforcement learning at all.', code: 'sft' },
        { id: 'soft', say: 'With the teacher’s weights in hand, the student can learn more: at every position, the teacher’s whole probability distribution.', code: 'kd' },
        { id: 'kl', say: 'The loss becomes a {KL|K L} divergence from teacher to student, with the same answer mask.', code: 'kd' },
        { id: 'dark', say: 'A sampled word says only: this one. The distribution also says which wrong answers were plausible. Hinton called that dark knowledge.', code: 'kd' },
        { id: 'race', say: 'Train two students on the same teacher: the one learning from samples keeps jittering, while the one learning from probabilities converges smoothly.', code: 'kd' },
        { id: 'limits', say: 'The limits: a student inherits its teacher’s mistakes, and imitators copy style far more easily than ability.', code: 'gen' },
      ],
    },
    {
      id: 'outro',
      title: 'Recap',
      codeTitle: 'recap.py',
      code: `
        assistant = sft(base, demos, mask)   #@sft
        assistant = sft(base, demos + web)   #@replay
        adapter = lora(base, r=16, alpha=32) #@lora
        adapter = qlora(nf4(base), r=16)     #@qlora
        student = sft(small, teacher_demos)  #@distill
        # imitation is capped by its examples  #@next
      `,
      beats: [
        { id: 'sft', say: 'To recap. A base model continues documents. Supervised fine-tuning on demonstrations teaches it to write an assistant’s reply, in a template, ending when it should.', code: 'sft' },
        { id: 'mask', say: 'The loss is masked to the assistant’s tokens. And narrow fine-tuning forgets, unless you replay old data or change less.', code: ['sft', 'replay'] },
        { id: 'lora', say: '{LoRA|Laura} freezes the weights and learns a low-rank update, B times A, with B starting at zero, and folds back in for free.', code: 'lora' },
        { id: 'qlora', say: '{QLoRA|cue Laura} stores the frozen base in four-bit {NF4|N F four}, putting large fine-tunes on a single {GPU|G P U}.', code: 'qlora' },
        { id: 'distill', say: 'And distillation lets a stronger model write the demonstrations.', code: 'distill' },
        { id: 'next', say: 'One idea runs through all of it: imitation can only be as good as its examples. Going beyond them takes a different signal, a reward that says which answer is better.', code: 'next' },
      ],
    },
  ],
};
