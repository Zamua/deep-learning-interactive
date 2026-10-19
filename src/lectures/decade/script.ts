import type { LectureScript } from '../../lecture/types';

export const script: LectureScript = {
  id: 'decade',
  title: 'What changed after 2016',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'intro',
      title: 'A decade later',
      codeTitle: 'the_decade.py',
      code: `
        # 2016: one model per task        #@old
        cnn = ConvNet()      # images     #@old
        rnn = LSTM()         # text       #@old

        # 2026: one model, three shifts   #@new
        model = Transformer()  # any data #@arch
        model.pretrain(web_text)  # scale #@scale
        model.post_train(feedback)        #@feedback

        # underneath, still CS231n        #@same
        loss.backward(); opt.step()       #@same
      `,
      beats: [
        { id: 'hello', say: 'Welcome to {DL26|D L twenty six}: deep learning, a decade later.' },
        { id: 'where', say: '{CS231n|C S two thirty one N} taught the field as it stood in the winter of {2016|twenty sixteen}.', code: 'old' },
        { id: 'old', say: 'Images went through ConvNets, text through recurrent networks, and every task got its own model.', code: 'old' },
        { id: 'since', say: 'In the ten years since, three shifts changed the shape of the field.', code: 'new' },
        { id: 'arch', say: 'First, one architecture for everything: the transformer, built on attention.', code: 'arch' },
        { id: 'scale', say: 'Second, scale became a research direction: models pretrained on trillions of words.', code: 'scale' },
        { id: 'feedback', say: 'Third, models are finished by feedback: people comparing answers, and then programs checking them.', code: 'feedback' },
        { id: 'same', say: 'And underneath all three, most of the code is what you already know.', code: 'same' },
        { id: 'plan', say: 'Here is the story of that decade, and the map of the course that follows it.' },
      ],
    },
    {
      id: 'decade',
      title: 'Ten years at a glance',
      codeTitle: 'decade.py',
      code: `
        decade = {
            2017: ['Transformer', 'PPO'],     #@y17
            2018: ['GPT', 'BERT'],            #@y18
            2019: ['GPT-2'],                  #@y19
            2020: ['GPT-3', 'scaling laws',   #@y20
                   'ViT', 'DDPM'],            #@y20
            2021: ['CLIP', 'LoRA'],           #@y21
            2022: ['Chinchilla', 'ChatGPT'],  #@y22
            2023: ['LLaMA', 'DPO'],           #@y23
            2024: ['GRPO', 'o1', 'Muon'],     #@y24
            2025: ['DeepSeek-R1'],            #@y25
        }
      `,
      beats: [
        { id: 'start', say: 'Here is the whole decade. Each dot is a milestone, colored by its thread.' },
        { id: 'y17', say: '{2017|Twenty seventeen}: the Transformer. Attention replaces recurrence.', code: 'y17' },
        { id: 'y18', say: '{2018|Twenty eighteen}: {GPT|G P T} and BERT pretrain transformers on plain text.', code: 'y18' },
        { id: 'y19', say: '{2019|Twenty nineteen}: {GPT-2|G P T two} starts doing tasks from a prompt alone.', code: 'y19' },
        { id: 'y20', say: '{2020|Twenty twenty} is crowded: {GPT-3|G P T three}, scaling laws, the vision transformer and diffusion.', code: 'y20' },
        { id: 'y21', say: '{2021|Twenty twenty one}: {CLIP|clip} puts pictures and words in one space, and {LoRA|lora} makes fine-tuning cheap.', code: 'y21' },
        { id: 'y22', say: '{2022|Twenty twenty two} is the year of the assistant: Chinchilla, human feedback in {InstructGPT|Instruct G P T}, and in November, {ChatGPT|Chat G P T}.', code: 'y22' },
        { id: 'y23', say: '{2023|Twenty twenty three}: open weights with {LLaMA|llama}, and {DPO|D P O}, a simpler way to learn from preferences.', code: 'y23' },
        { id: 'y24', say: '{2024|Twenty twenty four}: rewards a program can check, {GRPO|G R P O}, and {o1|oh one}, which thinks before it answers.', code: 'y24' },
        { id: 'y25', say: '{2025|Twenty twenty five}: DeepSeek {R1|R one} publishes a reasoning recipe in the open.', code: 'y25' },
        { id: 'threads', say: 'Three threads run through it all: attention, scale and feedback. Let\'s take them in turn.' },
      ],
    },
    {
      id: 'attention',
      title: 'Shift one: attention',
      codeTitle: 'recurrence_vs_attention.py',
      code: `
        # 2016: an RNN reads in order
        for x_t in tokens:                  #@rnn
            h = np.tanh(Wh @ h + Wx @ x_t)  #@rnn

        # 2017: every token sees every token
        S = Q @ K.T / np.sqrt(d)  # (T, T)  #@all
        A = softmax(S, axis=1)              #@all
        X = X + A @ V      # residual       #@block
        X = X + mlp(norm(X))                #@block
      `,
      beats: [
        { id: 'rnn', say: 'In {2016|twenty sixteen}, text went through a recurrent network: one token at a time, each folded into a hidden state.', code: 'rnn' },
        { id: 'slow', say: 'That is slow: a {GPU|G P U} wants thousands of multiplications at once, but each step waits for the one before.', code: 'rnn' },
        { id: 'far', say: 'And for the last word to use the first, the information has to survive every step in between.' },
        { id: 'paper', say: 'In {2017|twenty seventeen}, a team at Google published Attention Is All You Need, and threw the recurrence away.' },
        { id: 'all', say: 'Every token scores every other token in one matrix multiply, and all positions are computed together.', code: 'all' },
        { id: 'block', say: 'Add a small network for each token, residual connections and normalization, and you have the Transformer block.', code: 'block' },
        { id: 'faster', say: 'It trained in a fraction of the time of the recurrent translators, and translated better.' },
        { id: 'spread', say: 'Within a year it was being pretrained on plain text. By {2020|twenty twenty}, it was reading images.' },
      ],
    },
    {
      id: 'softmax',
      title: 'One softmax, two jobs',
      codeTitle: 'same_softmax.py',
      code: `
        def softmax(s):
            e = np.exp(s - s.max())           #@soft
            return e / e.sum()                #@soft

        # 2016: classify an image
        p = softmax(W @ x)                    #@cls

        # 2017: attend over tokens
        a = softmax(K @ q / np.sqrt(d))       #@att
        out = a @ V                           #@out
      `,
      beats: [
        { id: 'know', say: 'Here is the surprise: at the heart of attention is an operation you wrote in {CS231n|C S two thirty one N}.' },
        { id: 'cls', say: 'A linear classifier compares an input with each row of a weight matrix: one dot product, one score, per class.', code: 'cls' },
        { id: 'soft', say: 'A softmax turns those scores into probabilities that add up to one.', code: ['cls', 'soft'] },
        { id: 'att', say: 'Attention is the same line. The rows become keys, one per token, and the input becomes a query.', code: 'att' },
        { id: 'sqrt', say: 'Divide by the square root of the width, then apply the very same softmax.', code: ['att', 'soft'] },
        { id: 'out', say: 'What changes is the job: the weights no longer name a class, they mix the tokens\' values into a new vector.', code: 'out' },
        { id: 'keys', say: 'And the keys are computed from the sentence itself, so the classes change with every input.' },
      ],
    },
    {
      id: 'images',
      title: 'Images become tokens',
      codeTitle: 'images_as_tokens.py',
      code: `
        # text: token ids -> vectors
        X = embed[ids]                        #@text
        # images: 16x16 patches -> vectors
        P = patches(img, 16)  # (196, 768)    #@img
        X = P @ W_patch                       #@img
        out = transformer(X)  # same block    #@model

        # CLIP: photo and caption, one space  #@clip
        sim = img_vec @ txt_vec               #@clip
      `,
      beats: [
        { id: 'conv', say: 'A ConvNet has assumptions built in: nearby pixels belong together, and a cat is a cat wherever it appears.' },
        { id: 'vit', say: 'In {2020|twenty twenty}, the vision transformer dropped them. Cut the image into sixteen by sixteen patches, each one a token.', code: 'img' },
        { id: 'data', say: 'It has to learn what a ConvNet is given, so it needs more data. With enough, it matched the best ConvNets.', code: 'img' },
        { id: 'same', say: 'Now text and images go through the same block.', code: ['text', 'model'] },
        { id: 'clip', say: 'In {2021|twenty twenty one}, {CLIP|clip} trained an image encoder and a text encoder together, so a photo and its caption land close together.', code: 'clip' },
        { id: 'zero', say: 'Then you can classify a photo by comparing it with sentences, like a photo of a dog.', code: 'clip' },
        { id: 'shared', say: 'One architecture for many kinds of data. And when everything is a transformer, every improvement is shared.' },
      ],
    },
    {
      id: 'pretrain',
      title: 'Shift two: text labels itself',
      codeTitle: 'next_token.py',
      code: `
        ids = tokenize("the cat sat on the mat")  #@tok
        logits = model(ids[:-1])  # (T, vocab)    #@fwd
        p = softmax(logits, axis=1)               #@fwd
        y = ids[1:]         # the next tokens     #@label
        loss = -np.log(p[range(T), y]).mean()     #@loss
      `,
      beats: [
        { id: 'labels', say: 'In {2016|twenty sixteen}, more data meant more labels, and labels cost money. ImageNet took years of crowd work.' },
        { id: 'free', say: 'Text labels itself. Hide the next word of any sentence, and ask the model to predict it.', code: ['tok', 'label'] },
        { id: 'every', say: 'Every position of every document is a training example, with its answer attached.', code: 'label' },
        { id: 'loss', say: 'And the loss is the one from Assignment one: softmax cross-entropy, with the whole vocabulary as the classes.', code: ['fwd', 'loss'] },
        { id: 'gpt2', say: '{GPT-2|G P T two}, in {2019|twenty nineteen}, had one and a half billion parameters, and could attempt tasks from a prompt alone.' },
        { id: 'gpt3', say: '{GPT-3|G P T three}, in {2020|twenty twenty}, had {175|a hundred and seventy five} billion. Show it a few examples, and it continues the pattern.' },
        { id: 'icl', say: 'No gradient step at all. It is called in-context learning.' },
      ],
    },
    {
      id: 'laws',
      title: 'Scaling laws and compute',
      codeTitle: 'scaling.py',
      code: `
        # a power law: straight on log axes
        L = (C0 / C) ** alpha                     #@law
        log_L = alpha * (np.log(C0) - np.log(C))  #@law

        # the budget, in FLOPs
        C = 6 * N * D                             #@six
        6 * 175e9 * 300e9   # GPT-3: 3.15e23      #@gpt3
        D / N    # GPT-3: 1.7; Chinchilla: 20     #@chin
      `,
      beats: [
        { id: 'kaplan', say: 'Also in {2020|twenty twenty}, Kaplan and colleagues at OpenAI measured how the loss falls as models grow.' },
        { id: 'law', say: 'Against parameters, data or compute, it follows a power law: a straight line on log axes.', code: 'law' },
        { id: 'plan', say: 'That turned scale into a plan. Train small models, fit the line, and predict where a big one will land.', code: 'law' },
        { id: 'six', say: 'The budget is one line of arithmetic: about six operations per parameter, per training token.', code: 'six' },
        { id: 'gpt3', say: 'For {GPT-3|G P T three}, that comes to about three times ten to the twenty third operations.', code: 'gpt3' },
        { id: 'chin', say: 'In {2022|twenty twenty two}, Chinchilla showed how to spend it: grow parameters and tokens together, about twenty tokens per parameter.', code: 'chin' },
        { id: 'under', say: '{GPT-3|G P T three} had used fewer than two. It was under-trained.', code: 'chin' },
        { id: 'sizes', say: 'Models grew from millions of parameters to hundreds of billions, and training them became a field of its own.' },
      ],
    },
    {
      id: 'rlhf',
      title: 'Shift three: learning from people',
      codeTitle: 'rlhf.py',
      code: `
        # 1. imitate written answers
        finetune(model, demonstrations)    #@sft
        # 2. learn what people prefer
        rm = fit_reward_model(pairs)       #@rm
        # 3. RL against that reward
        for prompt in prompts:             #@ppo
            y = model.sample(prompt)       #@ppo
            r = rm(prompt, y) - beta * kl  #@kl
            ppo_update(model, y, r)        #@ppo
      `,
      beats: [
        { id: 'predictor', say: 'A pretrained model only predicts text. Ask it a question, and it may write three more.' },
        { id: 'sft', say: 'So first it is fine-tuned on written examples of good answers.', code: 'sft' },
        { id: 'judge', say: 'But good answers are hard to write and easy to judge. So people compare two answers and pick the better one,', code: 'rm' },
        { id: 'rm', say: 'and a reward model learns to predict their choice.', code: 'rm' },
        { id: 'ppo', say: 'Then reinforcement learning, with {PPO|P P O}, pushes the model toward answers the reward model likes,', code: 'ppo' },
        { id: 'kl', say: 'while a penalty keeps it close to where it started.', code: 'kl' },
        { id: 'instruct', say: 'That is {RLHF|R L H F}. In {2022|twenty twenty two}, people preferred a small {InstructGPT|Instruct G P T} to a {GPT-3|G P T three} a hundred times its size.' },
        { id: 'chatgpt', say: 'That November, {ChatGPT|Chat G P T}, trained the same way, put it in front of everyone.' },
        { id: 'dpo', say: 'In {2023|twenty twenty three}, {DPO|D P O} did the same with one simple loss on the pairs: no reward model, no {RL|R L} loop.' },
      ],
    },
    {
      id: 'rlvr',
      title: 'Rewards a program can check',
      codeTitle: 'rlvr.py',
      code: `
        def reward(answer):                       #@check
            return float(extract(answer) == 722)  #@check

        # GRPO: sample a group, compare within it
        r = np.array([reward(y) for y in group])  #@group
        A = (r - r.mean()) / r.std()              #@adv
        # raise log p(y) in proportion to A       #@update
      `,
      beats: [
        { id: 'hack', say: 'But a reward model is a learned guess, and a model optimized hard against it finds its blind spots: reward hacking.' },
        { id: 'check', say: 'For math and code, we can do better: a program can check the answer.', code: 'check' },
        { id: 'rlvr', say: 'Use the checker as the reward, and you have reinforcement learning from verifiable rewards.', code: 'check' },
        { id: 'grpo', say: '{GRPO|G R P O}, from DeepSeek in {2024|twenty twenty four}, made it cheap. Sample a group of answers to one question,', code: 'group' },
        { id: 'adv', say: 'and score each one against the group\'s average. Better than average is pushed up, worse is pushed down.', code: ['adv', 'update'] },
        { id: 'o1', say: 'In September {2024|twenty twenty four}, OpenAI\'s {o1|oh one} was trained with {RL|R L} to reason before answering, and got better the longer it thought.' },
        { id: 'r1', say: 'In January {2025|twenty twenty five}, DeepSeek {R1|R one} published a recipe: with {RL|R L} on checkable problems, long chains of reasoning grow on their own.' },
        { id: 'grad', say: 'Under all of it is one update: the softmax gradient from {CS231n|C S two thirty one N}, weighted by the reward.', code: 'update' },
      ],
    },
    {
      id: 'carried',
      title: 'What carried over',
      codeTitle: 'train_step.py',
      code: `
        model = GPT(vocab, d, n_layers)    #@init
        opt = AdamW(model.parameters())    #@step
        for ids, targets in loader:        #@tok
            h = embed[ids]                 #@embed
            for blk in blocks:
                h = h + blk.attn(blk.norm1(h))  #@attn
                h = h + blk.mlp(blk.norm2(h))   #@mlp
            logits = norm(h) @ unembed     #@unembed
            loss = cross_entropy(logits, targets)  #@loss
            loss.backward()                #@back
            opt.step()                     #@step
      `,
      beats: [
        { id: 'left', say: 'So what is left of {CS231n|C S two thirty one N}? Almost everything underneath.' },
        { id: 'step', say: 'Here is one training step of a language model today. Blue is what you already know; orange is new.' },
        { id: 'back', say: 'Backpropagation computes every gradient, exactly as you did by hand.', code: 'back' },
        { id: 'adam', say: 'An optimizer from the Adam family takes the step. AdamW only changes how weight decay is applied.', code: 'step' },
        { id: 'loss', say: 'The loss is softmax cross-entropy, and the last layer is a linear classifier over the whole vocabulary.', code: ['unembed', 'loss'] },
        { id: 'res', say: 'Every block adds its output back to its input: the residual connection from ResNet.', code: ['attn', 'mlp'] },
        { id: 'norm', say: 'Normalization keeps the numbers in range, now per token, and weights still start small and random.', code: ['attn', 'init'] },
        { id: 'new', say: 'What is new fits on one hand: tokens, positions and attention. That is where the course begins.', code: ['tok', 'attn'] },
      ],
    },
    {
      id: 'map',
      title: 'The map of the course',
      codeTitle: 'course.py',
      code: `
        parts = {
            'attention': range(1, 5),     #@p1
            'scale':     range(5, 10),    #@p2
            'images':    range(10, 13),   #@p3
            'feedback':  range(13, 19),   #@p4
            'serving':   range(19, 21),   #@p5
        }
        spine = [1, 2, 3, 4]   # read first  #@p1
        alone = [3, 7, 8, 12]  # need only CS231n  #@alone
      `,
      beats: [
        { id: 'twenty', say: 'The course has twenty chapters after this one, in five parts that follow those threads.' },
        { id: 'p1', say: 'Attention and transformers: from recurrence to attention, the Transformer, tokens, and pretraining. Read these four first.', code: 'p1' },
        { id: 'p2', say: 'Scale: scaling laws, the modern block, optimizers, training on many {GPUs|G P Us}, and mixture of experts.', code: 'p2' },
        { id: 'p3', say: 'Seeing and generating: vision transformers, {CLIP|clip}, and diffusion.', code: 'p3' },
        { id: 'p4', say: 'Post-training: fine-tuning, policy gradients, {RLHF|R L H F}, {DPO|D P O}, {GRPO|G R P O} and reasoning, best read in order.', code: 'p4' },
        { id: 'p5', say: 'And serving and understanding: fast inference, and looking inside a model.', code: 'p5' },
        { id: 'alone', say: 'Four chapters need only {CS231n|C S two thirty one N}: tokens, optimizers, many {GPUs|G P Us}, and diffusion.', code: 'alone' },
        { id: 'recap', say: 'So: one architecture, scale as a plan, and learning from feedback, all built on tools you already have.' },
        { id: 'bet', say: 'And it all began with one bet, in {2017|twenty seventeen}: that attention was all you need. Ten years on, the bet still stands.' },
      ],
    },
  ],
};
