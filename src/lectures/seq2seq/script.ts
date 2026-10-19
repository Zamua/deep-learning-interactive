import type { LectureScript } from '../../lecture/types';

export const script: LectureScript = {
  id: 'seq2seq',
  title: 'From recurrence to attention',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'intro',
      title: 'From recurrence to attention',
      codeTitle: 'translate.py',
      code: `
        src = "the black cat sees a dog"
        tgt = translate(src.split())     #@tr
        # -> le chat noir voit un chien  #@tr

        # this lecture, in order:        #@plan
        # 1. read with one RNN,          #@plan
        #    write with another          #@plan
        # 2. one vector: a bottleneck    #@plan
        # 3. attention: look back        #@plan
        # 4. a soft lookup: q, k, v      #@plan
      `,
      beats: [
        { id: 'hello', say: 'Welcome to the first chapter of the new course. It is about the one idea that everything after it is built on: attention.' },
        { id: 'y2014', say: 'In 2014, a neural network learned to translate English into French, with no grammar rules and no dictionary built in.', code: 'tr' },
        { id: 'two', say: 'One recurrent network reads the sentence. A second one writes the translation.', code: 'tr' },
        { id: 'crack', say: 'Within months, the design showed a crack. Long sentences came out badly, because everything had to squeeze through one vector.' },
        { id: 'patch', say: 'The patch for that crack was attention: let the writer look back at the sentence, one word at a time.' },
        { id: 'big', say: 'It became the most important idea in this course: the Transformer, and every large language model since, is built from it.' },
        { id: 'toy', say: 'We will tell it with real models: four tiny translators, trained for this chapter on a toy slice of English and French.' },
        { id: 'french', say: 'The French is real French, word for word, except that colors move after their nouns. The black cat becomes {le chat noir|luh shah nwar}.' },
        { id: 'plan', say: 'First the encoder and decoder, then the bottleneck, then attention, and finally what attention really is: a soft lookup, with queries, keys and values.', code: 'plan' },
      ],
    },
    {
      id: 'encdec',
      title: 'Encoder and decoder',
      codeTitle: 'encoder_decoder.py',
      code: `
        h = np.zeros(32)
        for x in src:                    #@enc
            h = gru_enc(h, emb_src[x])   #@enc
        c = h        # 32 numbers        #@c

        s, y = c, "<bos>"                #@start
        while y != "<eos>":              #@dec
            inp = np.concatenate(        #@dec
                [emb_tgt[y], c])         #@dec
            s = gru_dec(s, inp)          #@dec
            z = W_out @ np.concatenate(  #@p
                [s, c])                  #@p
            p = softmax(z + b_out)       #@p
            y = vocab_tgt[p.argmax()]    #@p
      `,
      beats: [
        { id: 'shape', say: 'The shape comes straight from the recurrent network chapter: read a whole sequence, then write another one.' },
        { id: 'enc', say: 'The encoder is an RNN that reads the English sentence, one word at a time.', code: 'enc' },
        { id: 'emb', say: 'Each word comes in as its embedding, a learned list of numbers, and the encoder folds it into its hidden state, h.', code: 'enc' },
        { id: 'grids', say: 'Each little grid is one state: {32|thirty two} numbers, after one more word.', code: 'enc' },
        { id: 'last', say: 'Nothing leaves the encoder until the very end. Its last state becomes the context vector, c.', code: 'c' },
        { id: 'only', say: 'From this moment on, the English sentence is gone. Those {32|thirty two} numbers are all the decoder will ever know about it.', code: 'c' },
        { id: 'dec', say: 'The decoder is a second RNN. It starts from c, and reads a special start token.', code: 'start' },
        { id: 'write', say: 'At each step it takes the word it wrote last, together with c, and updates its own state, s.', code: 'dec' },
        { id: 'softmax', say: 'A {softmax|soft max} turns its scores into a probability for every French word, and we take the likeliest. {Le, then chat, then noir|Luh, then shah, then nwar}.', code: 'p' },
        { id: 'feed', say: 'Each word it writes is fed back in as its next input.', code: 'dec' },
        { id: 'stop', say: 'It stops when it writes the end token, so it decides the length of the translation by itself.', code: 'p' },
      ],
    },
    {
      id: 'chain',
      title: 'One word at a time',
      codeTitle: 'loss.py',
      code: `
        # p(y|x) = p(y1) p(y2|y1) ...    #@chain
        logp = 0.0
        for y_true in tgt + ["<eos>"]:   #@loop
            p = decoder_step(y_prev)     #@loop
            logp += np.log(p[y_true])    #@log
            y_prev = y_true              #@tf
        loss = -logp   # cross-entropy   #@loss
      `,
      beats: [
        { id: 'chain', say: 'Writing one word at a time has a neat reading in probability.', code: 'chain' },
        { id: 'chain2', say: 'The chance of a whole translation is the chance of its first word, times the chance of the second given the first, and so on.', code: 'chain' },
        { id: 'name', say: 'That is the chain rule of probability. Translation is language modeling, with something to talk about.', code: 'chain' },
        { id: 'probs', say: 'For our sentence, the decoder gave every word more than {99|ninety nine} percent. Multiplied together, the whole translation still gets about {99|ninety nine} percent.', code: 'loop' },
        { id: 'log', say: 'Training adds up the log of each word\'s probability. The log turns the product into a sum.', code: 'log' },
        { id: 'loss', say: 'Flip the sign, and you have the loss: the same cross entropy as in a classifier, once per word.', code: 'loss' },
        { id: 'tf', say: 'One trick makes training work: the decoder is fed the correct previous word, not its own guess. It is called teacher forcing.', code: 'tf' },
        { id: 'why', say: 'Otherwise, one early mistake would derail every word after it.', code: 'tf' },
        { id: 'back', say: 'The loss flows backward through the decoder, through c, and into the encoder. One loss trains both networks.' },
        { id: 'greedy', say: 'At test time there is no teacher. We decode greedily; real systems keep a few of the best partial translations at once, called beam search.' },
      ],
    },
    {
      id: 'bottleneck',
      title: 'One vector for every sentence',
      codeTitle: 'bottleneck.py',
      code: `
        short = "the cat sees a dog"
        long = ("a cat eats the white wolf"
                " and the rabbit and ...")
        c1 = encode(short)   # 32 numbers  #@both
        c2 = encode(long)    # 32 numbers  #@both
        # 5 words or 40: the same size      #@both

        src = src[::-1]    # Sutskever's     #@rev
                           # reversal trick  #@rev
      `,
      beats: [
        { id: 'crack', say: 'Here is the crack. A five word sentence and a forty word sentence both reach the decoder as the same {32|thirty two} numbers.', code: 'both' },
        { id: 'pack', say: 'The encoder has to pack the whole sentence into c, in a form the decoder can unpack, in order. The longer the sentence, the more has to fit.', code: 'both' },
        { id: 'overwrite', say: 'Worse, an RNN overwrites its state a little at every step. By the time the last word arrives, the first words have been squeezed the most.' },
        { id: 'cho', say: 'In 2014, Cho and his colleagues measured this on real translation. Quality fell steadily as sentences grew longer.' },
        { id: 'sutskever', say: '{Sutskever|Soots-keh-ver}, {Vinyals|Vin-yals} and Le found that their much bigger network held up better than expected, helped by a curious trick.' },
        { id: 'reverse', say: 'Feed the English sentence in backwards. Then the first English words sit right next to the first French words the decoder writes.', code: 'rev' },
        { id: 'moved', say: 'It made training much easier, but the last words are now further apart. The trick shortens some paths; it does not remove the bottleneck.', code: 'rev' },
      ],
    },
    {
      id: 'cliff',
      title: 'The cliff, measured',
      codeTitle: 'length_test.py',
      code: `
        for L in range(5, 41):           #@loop
            tests = [random_sentence(L)  #@loop
                     for _ in range(40)] #@loop
            for m in models:             #@eval
                ok = [perfect(m, x)      #@eval
                      for x in tests]    #@eval
                acc[m][L] = np.mean(ok)  #@eval
      `,
      beats: [
        { id: 'toy', say: 'Here it is in our toy. For every length from five to forty words, we draw forty random sentences and count how many each model translates perfectly.', code: 'loop' },
        { id: 'c32', say: 'With a {32|thirty two} number context, the model is nearly flawless up to a dozen words. Then it falls off a cliff: past {25|twenty five} words, it almost never gets one right.', code: 'eval' },
        { id: 'c64', say: 'Double the context to {64|sixty four} numbers, and the cliff moves out, past thirty words. But it is still a cliff.', code: 'eval' },
        { id: 'attn', say: 'Now a model with attention. Its decoder state is also only {32|thirty two} numbers, and it is perfect at every length.', code: 'eval' },
        { id: 'why', say: 'It never has to hold the sentence in memory. It looks back at it.' },
        { id: 'fail', say: 'Here is what failure looks like. Eighteen words. The small model gets the start right, then swaps the fish and the cat near the end.' },
        { id: 'real', say: '{Bahdanau|Bah-dah-now} and his colleagues drew the same picture for real English and French: the fixed vector models faded with length, and attention held up past fifty words.' },
      ],
    },
    {
      id: 'attention',
      title: 'Looking back: Bahdanau attention',
      codeTitle: 'attention_step.py',
      code: `
        hs = encode_bidirectional(src)   #@enc
        for t in range(T):
            e = np.tanh(Wa @ s           #@e
                + hs @ Ua.T) @ va        #@e
            alpha = softmax(e)           #@a
            c = alpha @ hs               #@c
            inp = np.concatenate(        #@dec
                [emb_tgt[y], c])         #@dec
            s = gru_dec(s, inp)          #@dec
      `,
      beats: [
        { id: 'idea', say: 'In 2014, {Bahdanau|Bah-dah-now}, Cho and {Bengio|Ben-jee-oh} let the decoder look back.' },
        { id: 'keep', say: 'The idea is almost embarrassingly simple: keep every encoder state, not just the last one.' },
        { id: 'bidir', say: 'Its encoder reads in both directions, so each state, {hⱼ|h j}, describes its word in context, with what comes before and after.', code: 'enc' },
        { id: 'three', say: 'Then, before writing each word, the decoder does three small things.' },
        { id: 'score', say: 'First, it scores every English word against its own state, s. How useful does this word look, for what I am about to write?', code: 'e' },
        { id: 'net', say: 'The score is a tiny neural network: project s and {hⱼ|h j} into a shared space, add, squash with {tanh|tan h}, and read off one number. It is called additive attention.', code: 'e' },
        { id: 'soft', say: 'Second, a {softmax|soft max} turns the scores into weights, alpha, that are positive and add up to one: a budget of attention, spread over the sentence.', code: 'a' },
        { id: 'sum', say: 'Third, it reads the weighted average of the encoder states. That is a fresh context, {cₜ|c t}, made just for this word.', code: 'c' },
        { id: 'chat', say: 'Here the model is about to write {chat|shah}. The score for cat towers over the rest.', code: 'e' },
        { id: 'chat2', say: 'The {softmax|soft max} gives it {99|ninety nine} percent of the weight, so the context is almost exactly the state for cat.', code: ['a', 'c'] },
        { id: 'step', say: 'Then the decoder takes its usual step, with {cₜ|c t} in place of the one fixed c.', code: 'dec' },
        { id: 'price', say: 'The decoder no longer carries the sentence. It only tracks what it has written. The price is one score per English word, for every word it writes.' },
      ],
    },
    {
      id: 'alignment',
      title: 'The alignment matrix',
      codeTitle: 'alignment.py',
      code: `
        A = np.zeros((T, S))
        for t in range(T):               #@row
            alpha = attention_weights(t) #@row
            A[t] = alpha   # one row     #@row
        plt.imshow(A)                    #@show
      `,
      beats: [
        { id: 'rows', say: 'Stack the weights for every word the decoder writes, one row each, and you get a picture called the alignment matrix.', code: 'row' },
        { id: 'build', say: '{Le|Luh} looks at the. {Chat|Shah} looks at cat. Then {noir|nwar} looks back at black. {Voit|Vwah} looks at sees.', code: 'row' },
        { id: 'cross', say: 'Every color makes a little cross: forward to the noun, then back to the color, as the word order changes.', code: 'show' },
        { id: 'nobody', say: 'Nobody told the model which words go together; it was only trained to produce the right French. The alignment fell out on its own.', code: 'show' },
        { id: 'paper', say: 'The original paper shows the same pictures for real sentences.' },
        { id: 'eea', say: 'In its best known example, European Economic Area becomes zone économique européenne, and the attention runs backwards across the three words.' },
        { id: 'end', say: 'The last row is the end token. It has no word to look at, so its attention wanders.', code: 'show' },
        { id: 'dot', say: 'We also trained a model with a simpler, dot product score. Its alignments look almost exactly the same.' },
      ],
    },
    {
      id: 'lookup',
      title: 'A soft dictionary lookup',
      codeTitle: 'soft_lookup.py',
      code: `
        d = {"cat": "chat", "dog": "chien"}
        d["cat"]   # exact key -> value  #@dict

        e = keys @ q        # scores     #@e
        alpha = softmax(e)  # weights    #@a
        c = alpha @ values  # a blend    #@a
        c_hard = values[e.argmax()]      #@hard
      `,
      beats: [
        { id: 'strip', say: 'Now take the translation away, and look at what one attention step does all by itself.' },
        { id: 'dict', say: 'Think of a Python dictionary. You hand it a key, and if that exact key is in there, you get back its value.', code: 'dict' },
        { id: 'roles', say: 'Attention has the same three roles. A query, q: what you are looking for. Keys, k: what each entry is filed under. And values, v: what each entry holds.', code: 'e' },
        { id: 'graded', say: 'But it relaxes both halves. Matching is graded: every key gets a score against the query.', code: 'e' },
        { id: 'blend', say: 'And the answer is a blend of every value, weighted by the {softmax|soft max} of the scores.', code: 'a' },
        { id: 'picture', say: 'Here, five keys are points in a plane, and their values are colors. The background shows what the lookup returns for a query at every spot.' },
        { id: 'move', say: 'Move the query, and the answer slides smoothly from one color into the next.', code: 'a' },
        { id: 'hard', say: 'A hard lookup returns only the best match. The plane breaks into flat regions with sharp borders.', code: 'hard' },
        { id: 'sharp', say: 'Sharpen the {softmax|soft max}, and soft turns into hard.', code: 'a' },
        { id: 'qkv', say: 'In {Bahdanau|Bah-dah-now}\'s model, the query is the decoder state, and the keys and values are both the encoder states.' },
        { id: 'proj', say: 'Nothing forces them to be the same. The Transformer computes q, k and v with three separate learned projections.' },
      ],
    },
    {
      id: 'soft',
      title: 'Why soft: the gradient',
      codeTitle: 'learn_the_query.py',
      code: `
        keys = np.array([-2, -1, 0, 1, 2])
        values = np.array([0.6, 2.6, 1.4,
                           3.6, 3.0])
        e = -beta * (q - keys)**2      #@e
        alpha = softmax(e)             #@e
        c = alpha @ values             #@e
        dc_de = alpha * (values - c)   #@grad
        q -= lr * (c - target) * dc_dq #@upd
      `,
      beats: [
        { id: 'why', say: 'Why blend at all? A hard lookup is cheaper, and a trained model\'s weights are often nearly all on one word anyway.' },
        { id: 'line', say: 'Here is a lookup on a line: five keys at fixed positions, each holding a number. The query is a position too.', code: 'e' },
        { id: 'stairs', say: 'The hard lookup is a staircase. Move the query a little and the same key still wins, so nothing changes. Then, at a border, it jumps.' },
        { id: 'flat', say: 'Gradient descent needs to know which way is downhill. A flat step says nothing: the gradient is exactly zero.' },
        { id: 'ramp', say: 'The soft lookup is a smooth ramp. Nudge the query, and the output moves a little. There is always a slope to follow.', code: 'e' },
        { id: 'descend', say: 'Ask for a target value and run gradient descent on the query. The soft learner slides right to it. The hard learner never moves.', code: 'upd' },
        { id: 'formula', say: 'The gradient of a soft lookup is short enough to read. Raising one key\'s score pulls the output toward that key\'s value, in proportion to its weight.', code: 'grad' },
        { id: 'zero', say: 'It also says where learning stops. A key with almost no weight gets no gradient. And a key with all the weight already equals the output.', code: 'grad' },
        { id: 'sharp', say: 'So a {softmax|soft max} that is too sharp behaves like a hard lookup, and stops learning. Remember that. The Transformer has to guard against it.' },
      ],
    },
    {
      id: 'scores',
      title: 'Dot product versus additive',
      codeTitle: 'scores.py',
      code: `
        e_dot = keys @ q                 #@dot
        e_gen = keys @ (W @ q)           #@gen
        e_add = np.tanh(Wa @ q           #@add
            + keys @ Ua.T) @ va          #@add

        E = Q @ K.T     # every score    #@all
        A = softmax(E, axis=1)           #@all
        C = A @ V       # every context  #@all
      `,
      beats: [
        { id: 'luong', say: '{Bahdanau|Bah-dah-now}\'s score is a small network. In 2015, {Luong|Loo-ong}, Pham and Manning tried simpler ones, and in their experiments the simple ones did as well or better.', code: 'add' },
        { id: 'dot', say: 'The plainest is the dot product: multiply matching entries and add them up. It has no parameters at all.', code: 'dot' },
        { id: 'general', say: 'The general form puts one learned matrix between the query and the key.', code: 'gen' },
        { id: 'plane', say: 'For a fixed query, the dot product score over all possible keys is a tilted plane. It rises forever in the direction of the query.', code: 'dot' },
        { id: 'bump', say: 'The additive score is a little neural network, so it can bend. With the right weights, it peaks on keys near the query.', code: 'add' },
        { id: 'learned', say: 'But the vectors are learned, so the network shapes its keys and queries until dot products mean what it needs.' },
        { id: 'matmul', say: 'And the dot product has a decisive advantage. Stack the queries into a matrix, Q, and the keys into K. One matrix multiply gives every score at once.', code: 'all' },
        { id: 'three', say: 'So attention becomes {softmax|soft max} of {Q Kᵀ|Q K transpose}, times V: three matrix operations, exactly what GPUs do fastest.', code: 'all' },
        { id: 'block', say: 'The additive score must first build a block of {tanh|tan h} inputs, one for every pair.', code: 'add' },
        { id: 'size', say: 'Its one weakness: it adds one product per dimension, so with hundreds of dimensions the scores grow large and the {softmax|soft max} goes sharp. The next chapter fixes that with one division.' },
      ],
    },
    {
      id: 'costs',
      title: 'What attention costs, and what is left',
      codeTitle: 'costs.py',
      code: `
        n_scores = S * T   # per sentence  #@cost
        # x_j to y_t: one step, alpha[t,j] #@path

        for x in src:      # still one     #@seq
            h = gru_enc(h, x)  # at a time #@seq
        for t in range(T):     # and here  #@seq
            s = gru_dec(s, ...)            #@seq
      `,
      beats: [
        { id: 'cost', say: 'What does attention cost? One score per English word, for every French word. For a sentence, nothing much. For thousands of tokens, it becomes the main cost, and later chapters return to it.', code: 'cost' },
        { id: 'path', say: 'In exchange, every word the decoder writes gets a one step path back to every source word. Before, information had to crawl through both recurrences.', code: 'path' },
        { id: 'left', say: 'But attention did not remove the recurrence. The encoder still reads one word at a time, and the decoder still writes one word at a time.', code: 'seq' },
        { id: 'wait', say: 'Each step waits for the one before. A GPU cannot spread a sentence across its thousands of cores.', code: 'seq' },
        { id: 'self', say: 'The 2017 answer was to let attention do the reading too. Every word attends to every other word in its own sentence. That is called self attention.' },
        { id: 'drop', say: 'Drop the recurrence entirely, and the whole sentence is processed at once. That is the Transformer, the next chapter.' },
      ],
    },
    {
      id: 'outro',
      title: 'Recap',
      codeTitle: 'recap.py',
      code: `
        # 1. encoder -> c -> decoder       #@r1
        # 2. one c: a cliff with length    #@r2
        # 3. score, softmax, weighted sum  #@r3
        # 4. a soft lookup: q, k, v        #@r4
        # 5. soft means differentiable     #@r5
        # 6. softmax(Q K^T) V              #@r6
      `,
      beats: [
        { id: 'r1', say: 'Let\'s recap. An encoder reads the sentence into one vector, c, and a decoder writes the translation from it.', code: 'r1' },
        { id: 'r2', say: 'One vector for every sentence is a bottleneck. Quality falls off a cliff as sentences grow, and a bigger vector only moves the cliff.', code: 'r2' },
        { id: 'r3', say: 'Attention keeps every encoder state. For each word it writes, the decoder scores them all, takes a {softmax|soft max}, and reads the weighted average.', code: 'r3' },
        { id: 'r4', say: 'Stripped down, that is a soft dictionary lookup. A query is scored against keys, and the answer is a blend of values.', code: 'r4' },
        { id: 'r5', say: 'Blending, instead of picking the best match, is what makes it learnable with backprop.', code: 'r5' },
        { id: 'r6', say: 'And with dot product scores, all of it is three matrix operations: {softmax|soft max} of {Q Kᵀ|Q K transpose}, times V. That is where the Transformer begins.', code: 'r6' },
        { id: 'next', say: 'Next, open the interactive chapter. The four translators run live in your browser: step through them, break them with long sentences, and drag a query around.' },
        { id: 'bye', say: 'See you there.', pause: 0.6 },
      ],
    },
  ],
};
