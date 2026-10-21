import type { LectureScript } from '../../lecture/types';

export const script: LectureScript = {
  id: 'rnn',
  title: 'Recurrent networks and image captioning',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'intro',
      title: 'Networks with memory',
      codeTitle: 'memory.py',
      code: `
        scores = net(image)  # fixed shape   #@fixed

        h = np.zeros(H)      # empty memory  #@mem
        for x in sequence:   # any length    #@loop
            h = step(h, x)   # fold x in     #@step
        y = out(h)           # read it out   #@out
      `,
      beats: [
        { id: 'hello', say: 'Every network so far has had a fixed shape.' },
        { id: 'fixed', say: 'One image in, one set of class scores out.', code: 'fixed' },
        { id: 'world', say: 'But much of the world arrives as a sequence: the words of a sentence, the frames of a video, the characters of a program.' },
        { id: 'length', say: 'A sentence can be four words long, or forty. To read one, a network needs memory.', code: 'mem' },
        { id: 'trick', say: 'A recurrent network reads one element at a time, and folds each into a running summary: its hidden state.', code: ['loop', 'step'] },
        { id: 'hidden', say: 'Hidden, because nothing outside sees or supervises it directly: the network learns what to keep there.', code: ['loop', 'step'] },
        { id: 'same', say: 'The same weights do the folding at every step, so it can read a sequence of any length, and we read answers off the memory.', code: ['step', 'out'] },
        { id: 'karpathy', say: "This chapter follows Andrej Karpathy's 2016 lecture, and the tiny script that made these models famous." },
        { id: 'plan', say: 'We will teach a model to write fake Shakespeare, see why it forgets, meet the {LSTM|L S T M} that fixes it, and have a network describe photos in words.' },
      ],
    },
    {
      id: 'shapes',
      title: 'Sequences in, sequences out',
      codeTitle: 'shapes.py',
      code: `
        y = out(step(zeros, x))  # one to one  #@one
        h = step(zeros, image)   # one to many #@cap
        for t in range(T):                     #@cap
            y[t] = out(h)                      #@cap
            h = step(h, y[t])    # feed back   #@cap
        for x in words:          # many to one #@sent
            h = step(h, x)                     #@sent
        y = out(h)                             #@sent
        for x in source:        # many to many #@mt
            h = step(h, x)       # read it all #@mt
        for t in range(T_out):                 #@mt
            h = step(h, y[t-1])  # then write  #@mt
            y[t] = out(h)                      #@mt
        for t, x in enumerate(frames):         #@vid
            h = step(h, x)       # in step     #@vid
            y[t] = out(h)                      #@vid
        for t in range(n_glimpses):            #@seq
            h = step(h, look(image, h))        #@seq
      `,
      beats: [
        { id: 'cols', say: 'Draw each time step as a column: input x at the bottom, hidden state h in the middle, output y on top.' },
        { id: 'arrows', say: 'Arrows between the hidden states carry memory forward, and every column shares the same weights.' },
        { id: 'one', say: 'One to one is no sequence at all: the image classifiers so far.', code: 'one' },
        { id: 'cap', say: 'One to many is image captioning: one image in, then a word per step, each fed back in as the next input.', code: 'cap' },
        { id: 'sent', say: 'Many to one reads a review word by word, then judges its mood: sentiment classification.', code: 'sent' },
        { id: 'mt', say: 'Many to many reads a whole English sentence, then writes it in French, with its own length and word order: translation.', code: 'mt' },
        { id: 'vid', say: 'And in step, one output per input: labeling each frame of a video, with memory of the frames before it.', code: 'vid' },
        { id: 'glimpse', say: 'Even a fixed size input can be read in pieces. One model reads house numbers by steering a small glimpse around the image. Another paints digits, stroke by stroke.', code: 'seq' },
      ],
    },
    {
      id: 'recurrence',
      title: 'One rule, every step',
      codeTitle: 'recurrence.py',
      code: `
        h = np.zeros(hidden_size)  # empty     #@init
        for x in sequence:                     #@loop
            h = f(h, x, W)   # same f, same W  #@f

        total = 0            # an accumulator  #@acc
        for x in numbers:                      #@acc
            total = total + x                  #@acc

        # unrolled: one copy of f per step     #@unroll
        h1 = f(h0, x1, W)                      #@unroll
        h2 = f(h1, x2, W)                      #@unroll
        h3 = f(h2, x3, W)                      #@unroll
        dW = dW1 + dW2 + dW3   # shared: add   #@grad
      `,
      beats: [
        { id: 'rule', say: 'At the heart of every recurrent network is one update rule, applied at every time step.' },
        { id: 'read', say: 'Take the old memory, h from the step before, and the new input, x.', code: 'f' },
        { id: 'f', say: 'Feed both to a function f with weights W, and out comes the new memory.', code: 'f' },
        { id: 'same', say: 'And it is the same function, with the same weights, at every step.', code: ['loop', 'f'] },
        { id: 'acc', say: 'If you program, you know this shape: a loop with a running total, folding in one more input per pass.', code: 'acc' },
        { id: 'learn', say: 'Only here, f is a small layer with learned weights, so the network learns what is worth remembering.', code: 'f' },
        { id: 'unroll', say: 'To see it as an ordinary network, unroll the loop: one copy of f per step, wired head to tail.', code: 'unroll' },
        { id: 'deep', say: 'That is a deep network with one layer per step, and one twist: every layer shares the same weights.', code: 'unroll' },
        { id: 'grad', say: 'So in training, the weights collect a gradient from every copy, and those gradients simply add up.', code: 'grad' },
      ],
    },
    {
      id: 'vanilla',
      title: 'The vanilla RNN',
      codeTitle: 'rnn_step.py',
      code: `
        def rnn_step(h, x):
            a = np.dot(Whh, h)    # old memory  #@whh
            a += np.dot(Wxh, x)   # new input   #@wxh
            a += bh               # bias        #@b
            h = np.tanh(a)        # squash      #@tanh
            y = np.dot(Why, h) + by  # scores   #@y
            return h, y

        z = np.linspace(-4, 4, 9)
        np.tanh(z)           # from -1 to 1     #@curve
        1 - np.tanh(z)**2    # its slope        #@slope
      `,
      beats: [
        { id: 'simple', say: 'The simplest f is one fully connected layer and a {tanh|tan h}: the vanilla {RNN|R N N}.' },
        { id: 'whh', say: 'The matrix {Whh|W h h} mixes the old memory: each new number is a weighted sum of all the old ones.', code: 'whh' },
        { id: 'wxh', say: '{Wxh|W x h} mixes in the new input, with weights of its own, and a bias is added.', code: ['wxh', 'b'] },
        { id: 'squash', say: 'Then {tanh|tan h} squashes every entry to between minus one and one, so the memory stays bounded.', code: '{tanh|tan h}' },
        { id: 'why', say: 'A third matrix, {Why|W h y}, reads output scores off the new memory. Three matrices, and nothing else.', code: 'y' },
        { id: 'curve', say: '{tanh|Tan h} is an S shaped curve: steep in the middle, flat far away.', code: 'curve' },
        { id: 'slope', say: 'Its slope, one minus {tanh²|tan h squared}, is one at the center and nearly zero in the flat parts. Remember those flat parts.', code: 'slope' },
        { id: 'shared', say: 'And remember {Whh|W h h}. Shared by every step, it lets one small network read text of any length, and it is what makes training hard.', code: 'whh' },
      ],
    },
    {
      id: 'hello',
      title: 'A character model learns "hello"',
      codeTitle: 'hello.py',
      code: `
        vocab = ['h', 'e', 'l', 'o']           #@vocab
        inputs  = [0, 1, 2, 2]   # h e l l     #@in
        targets = [1, 2, 2, 3]   # e l l o     #@tg
        h, loss = np.zeros((3, 1)), 0          #@h0
        for t in range(4):
            x = np.zeros((4, 1))               #@x
            x[inputs[t]] = 1     # one-hot     #@x
            h = np.tanh(np.dot(Wxh, x)         #@h
                 + np.dot(Whh, h) + bh)        #@h
            y = np.dot(Why, h) + by  # scores  #@y
            p = np.exp(y) / np.sum(np.exp(y))  #@p
            loss += -np.log(p[targets[t]])     #@loss
        # loss = {{loss:…}}
      `,
      beats: [
        { id: 'model', say: 'Now a concrete example: a model of text, which predicts the next character from the ones so far.' },
        { id: 'tiny', say: 'Shrink the world to four letters, h, e, l and o, and one training word: hello.', code: 'vocab' },
        { id: 'onehot', say: 'Each letter goes in as a one hot vector: all zeros, except a one in its own slot.', code: 'x' },
        { id: 'targets', say: 'The targets are the input shifted by one: after h comes e, then l, then l, then o.', code: ['in', 'tg'] },
        { id: 'trap', say: 'Look at the last two. The input is l both times, but the answers differ. Only memory can tell the first l from the second.', code: ['tg', 'h0'] },
        { id: 'step', say: 'So run it. At each step, the input and the memory mix through {tanh|tan h} into three hidden numbers.', code: 'h' },
        { id: 'scores', say: '{Why|W h y} reads four scores off the memory, one per letter, and a softmax turns them into probabilities.', code: ['y', 'p'] },
        { id: 'loss', say: 'The loss at each step is minus the log of the probability given to the true next letter: zero if certain, large if surprised.', code: 'loss' },
        { id: 'sum', say: 'Summed over the word, blind guessing would cost about {5.5|five and a half}. These random weights do a little worse: {5.82|five point eight two}.', code: 'loss' },
        { id: 'trained', say: 'After three hundred small training steps, the loss falls to {0.06|zero point zero six}. Same input l, two different answers: the memory works.', code: 'loss' },
      ],
    },
    {
      id: 'sampling',
      title: 'Letting the model write',
      codeTitle: 'sample.py',
      code: `
        def sample(h, ix, n, temperature={{T:1.0}}):
            out = []
            for t in range(n):
                x = np.zeros((vocab_size, 1))      #@x
                x[ix] = 1                          #@x
                h = np.tanh(np.dot(Wxh, x)         #@h
                     + np.dot(Whh, h) + bh)        #@h
                y = np.dot(Why, h) + by            #@y
                z = y / temperature                #@temp
                p = np.exp(z) / np.sum(np.exp(z))  #@p
                ix = np.random.choice(             #@pick
                    vocab_size, p=p.ravel())       #@pick
                out.append(ix)   # feed it back    #@feed
            return out
      `,
      beats: [
        { id: 'gen', say: 'Once trained, the model can write. Give it a few characters to start from.', code: ['x', 'h'] },
        { id: 'probs', say: 'It scores every possible next character, and the softmax turns scores into probabilities.', code: ['y', 'p'] },
        { id: 'draw', say: 'Draw one at random, according to those probabilities. That is sampling.', code: 'pick' },
        { id: 'feed', say: 'Then feed it back in as the next input, so everything it writes becomes context.', code: ['feed', 'x'] },
        { id: 'repeat', say: 'Repeat as long as you like. Here, a model trained on a few pages of Shakespeare writes on its own.', code: ['h', 'y', 'p', 'pick', 'feed'] },
        { id: 'why', say: 'Always taking the top character instead gives the same text every time, and tends to get stuck repeating itself.', code: 'pick' },
        { id: 'temp', say: 'A dial called temperature sets how bold the draws are: divide every score by T before the softmax.', code: 'temp' },
        { id: 'low', say: 'Below one, the favorite grows even more likely: safe, repetitive text.', code: ['temp', 'p'] },
        { id: 'high', say: 'Above one, the odds even out: adventurous text, then nonsense.', code: ['temp', 'p'] },
        { id: 'same', say: 'The model never changes. Only how boldly we read it.', code: 'temp' },
      ],
    },
    {
      id: 'bptt',
      title: 'Backpropagation through time',
      codeTitle: 'bptt.py',
      code: `
        dhnext = np.zeros_like(hs[0])
        for t in reversed(range(len(inputs))):  #@rev
            dy = np.copy(ps[t])                 #@dy
            dy[targets[t]] -= 1   # p - target  #@dy
            dh = np.dot(Why.T, dy) + dhnext     #@dh
            dhraw = (1 - hs[t]**2) * dh         #@raw
            dWhh += np.dot(dhraw, hs[t-1].T)    #@acc
            dhnext = np.dot(Whh.T, dhraw)       #@next

        for pos in range(0, len(data), 25):     #@chunk
            loss, *grads, hprev = lossFun(      #@chunk
                inputs, targets, hprev)         #@chunk
            # hprev carries on; its gradient    #@carry
            # does not                          #@carry
      `,
      beats: [
        { id: 'graph', say: 'Training an {RNN|R N N} is ordinary backprop on the unrolled graph. Here it has a grand name: backpropagation through time.' },
        { id: 'fwd', say: 'Run forward through the sequence, adding up the losses.' },
        { id: 'bwd', say: 'Then run backward, from the last step to the first.', code: 'rev' },
        { id: 'two', say: "A hidden state's gradient says how much the loss would move if we nudged it. This one reached the loss two ways: through its own output, and through the next hidden state.", code: 'dh' },
        { id: 'own', say: 'So its gradient has two parts. One is the score gradient, probabilities minus the one hot target, pushed back through {Why|W h y}.', code: ['dy', 'dh'] },
        { id: 'next', say: "The other arrives from the future as {dhnext|d h next}, through {tanh|tan h}'s slope and {Whh|W h h}, transposed.", code: ['raw', 'next'] },
        { id: 'acc', say: 'Each weight was used at every step, so its gradients from all the steps add up.', code: 'acc' },
        { id: 'remember', say: 'Remember this: every step back multiplies the gradient by the same matrix.', code: 'next' },
        { id: 'truncate', say: 'A whole book per update would be slow. So we truncate: forward and backward through one chunk of twenty five characters at a time.', code: 'chunk' },
        { id: 'carry', say: 'The hidden state carries on into the next chunk, so the model still reads continuous text. The gradient stops at the chunk boundary.', code: 'carry' },
        { id: 'price', say: 'The price: no direct learning signal about anything longer than a chunk.', code: 'carry' },
      ],
    },
    {
      id: 'minchar',
      title: 'min-char-rnn learns to write',
      codeTitle: 'min_char_rnn.py',
      code: `
        H, seq_length = 64, 25   # gist: 100   #@hyper
        Wxh = np.random.randn(H, V) * 0.01     #@params
        Whh = np.random.randn(H, H) * 0.01     #@params
        Why = np.random.randn(V, H) * 0.01     #@params
        while True:
            loss, *ds, hprev = lossFun(        #@loss
                inputs, targets, hprev)        #@loss
            for d in ds:
                np.clip(d, -5, 5, out=d)       #@clip
            for w, d, m in zip(params, ds, mem):
                m += d * d                     #@ada
                w -= 0.1 * d / np.sqrt(m+1e-8) #@ada
            if n % 100 == 0:                   #@sample
                ix = sample(hprev, inputs[0], 200)  #@sample
            n += 1   # n = {{n:0}}
      `,
      beats: [
        { id: 'gist', say: 'Karpathy wrote this whole model as one {NumPy|num pie} file of about a hundred and twelve lines, with no framework.' },
        { id: 'parts', say: 'The vocabulary is the distinct characters of a text file, and the model is three small random matrices.', code: ['hyper', 'params'] },
        { id: 'loop', say: 'It loops: take the next twenty five characters, run the loss forward and backward, and update.', code: 'loss' },
        { id: 'clip', say: "Gradients are clipped to plus or minus five, and the update is {Adagrad|ada grad}: each weight's step is divided by the root of its own running sum of squared gradients.", code: ['clip', 'ada'] },
        { id: 'run', say: "Here it learns from the opening of Shakespeare's Coriolanus, three thousand characters, printing samples as it goes.", code: 'sample' },
        { id: 'i0', say: 'At first: random characters, and a loss right where blind guessing would put it.', code: 'sample' },
        { id: 'i100', say: 'Within a hundred steps it knows which characters are common: lowercase letters and spaces.', code: 'sample' },
        { id: 'i1000', say: 'By a thousand, short real words appear, like and, we and the, and lines begin to break.', code: 'sample' },
        { id: 'i3000', say: 'By three thousand the loss has nearly halved, and a half spelled citizen ends in a colon and a new line, like a speaker in a play.', code: 'sample' },
        { id: 'long', say: 'Ten times longer, it writes in the shape of a play. With only three pages to learn from, though, it soon starts reciting them.' },
      ],
    },
    {
      id: 'learns',
      title: 'What char-rnn learns',
      codeTitle: 'read_along.py',
      code: `
        h = np.zeros((hidden_size, 1))
        for ch in text:
            x = np.zeros((vocab_size, 1))
            x[char_to_ix[ch]] = 1
            h = np.tanh(np.dot(Wxh, x)         #@h
                 + np.dot(Whh, h) + bh)        #@h
            shade = h[unit, 0]  # cell color   #@shade
      `,
      beats: [
        { id: 'scale', say: 'Scale this up to a few layers of {LSTMs|L S T Ms}, hundreds of units each, and the results get eerie.' },
        { id: 'shakes', say: 'On all of Shakespeare, it writes speaker names and archaic speeches: Shakespeare from across the room, nonsense up close.' },
        { id: 'wiki', say: 'On Wikipedia: headings, links and invented citations. On the {LaTeX|lay tech} source of a geometry book: proofs that nearly compile.' },
        { id: 'linux', say: 'On the Linux kernel: C code with balanced braces and comments. It was only ever given characters.' },
        { id: 'watch', say: "Why does it work? Karpathy, Johnson and Fei-Fei watched single memory cells as a network read, coloring each character by a cell's value.", code: ['h', 'shade'] },
        { id: 'quote', say: 'Most cells were a jumble. But one switched on at an opening quote, and stayed on until the closing one.', code: 'shade' },
        { id: 'more', say: 'Another counted along each line. In C code, cells tracked if statements, comments, and how deeply the code was nested.', code: 'shade' },
        { id: 'ours', say: 'Nobody asked for these trackers: they helped predict the next character, so gradient descent built them. Our tiny model shows a faint version: its best unit loosely follows spaces.', code: 'shade' },
      ],
    },
    {
      id: 'captioning',
      title: 'Image captioning',
      codeTitle: 'caption.py',
      code: `
        v = cnn(image)        # (4096,) features  #@v
        h = np.zeros(H)
        word, caption = START, []                 #@start
        while True:
            x = W_embed[word]    # a word vector  #@embed
            h = np.tanh(np.dot(Whh, h)            #@h
                + np.dot(Wxh, x) + np.dot(Wih, v))  #@h
            scores = np.dot(Why, h) + by          #@scores
            word = sample(softmax(scores))        #@pick
            if word == END:                       #@end
                break                             #@end
            caption.append(word)                  #@append
      `,
      beats: [
        { id: 'halves', say: 'Now join the two halves of the course. A {ConvNet|conv net} turns an image into a vector, and an {RNN|R N N} turns a vector into a sentence.' },
        { id: 'cnn', say: 'In 2015, several groups did exactly that. Run the image through a {ConvNet|conv net} trained on ImageNet, and cut off its last layer.', code: 'v' },
        { id: 'v', say: 'Instead of a thousand class scores, keep the {4,096|four thousand and ninety six} numbers before them: the vector v.', code: 'v' },
        { id: 'cond', say: 'v enters the recurrence as one extra term, with its own weight matrix. Assignment 3 uses it to set the first hidden state instead.', code: 'h' },
        { id: 'start', say: 'Feed in a start token. Words go in as learned vectors, and the output scores every word in the vocabulary.', code: ['start', 'embed', 'scores'] },
        { id: 'sample', say: 'Sample a word, feed it back, and stop when the network says end. In this toy, a small table plays the trained network.', code: ['pick', 'end', 'append'] },
        { id: 'coco', say: 'Train it end to end on Microsoft {COCO|Coco}: about a hundred and twenty thousand images, each captioned by five people.' },
        { id: 'good', say: 'Results are often startlingly good: a surfer riding a wave. But a captioner may add a frisbee that is not there, because frisbees go with parks.' },
        { id: 'glance', say: 'It knows captions better than images, and it glances at the image only once. Next chapter, attention lets it look again for every word.' },
      ],
    },
    {
      id: 'vanishing',
      title: 'Vanishing and exploding gradients',
      codeTitle: 'vanishing.py',
      code: `
        dh = dh_t      # the gradient at step t
        for j in reversed(range(t - k, t)):    #@loop
            dh = (1 - hs[j]**2) * dh  # tanh  #@tanh
            dh = np.dot(Whh.T, dh)    # Whh   #@whh

        1.1 ** 50      # 117                   #@up
        0.9 ** 50      # 0.005                 #@down

        norm = np.linalg.norm(grad)            #@clip
        if norm > 5:                           #@clip
            grad *= 5 / norm  # same direction #@clip
      `,
      beats: [
        { id: 'principle', say: 'In principle, a vanilla {RNN|R N N} can remember across hundreds of steps. In practice, it struggles beyond a dozen or so.' },
        { id: 'loop', say: "The reason is in the backward loop: to go k steps back, the gradient is multiplied by {tanh|tan h}'s slope and by {Whh|W h h} transposed, k times over.", code: ['loop', '{tanh|tan h}', 'whh'] },
        { id: 'numbers', say: 'Plain numbers first. {1.1|One point one} to the fiftieth power is a hundred and seventeen. {0.9|Zero point nine} to the fiftieth is five thousandths.', code: ['up', 'down'] },
        { id: 'sigma', say: 'A matrix does the same along its strongest direction. The stretch there is its largest singular value, sigma.', code: 'whh' },
        { id: 'explode', say: 'Above one, the gradient can grow exponentially as it travels back: exploding gradients, and absurdly large updates.', code: 'whh' },
        { id: 'vanish', say: "Below one, it shrinks exponentially, and {tanh|tan h}'s slopes only shrink it more: vanishing gradients. The early steps learn almost nothing.", code: ['{tanh|tan h}', 'whh'] },
        { id: 'clip', say: "For exploding gradients, clip: if the gradient's size passes a threshold, scale it down, keeping its direction. Our script clips each entry to five.", code: 'clip' },
        { id: 'arch', say: 'Vanishing needs a new architecture: a path back through time with no matrix multiply at every step.' },
      ],
    },
    {
      id: 'lstm',
      title: 'Long short-term memory',
      codeTitle: 'lstm_step.py',
      code: `
        hx = np.concatenate([prev_h, x])
        a = np.dot(W, hx) + b     # (4H,)       #@a
        i = sigmoid(a[0:H])       # input gate  #@i
        f = sigmoid(a[H:2*H])     # forget gate #@f
        o = sigmoid(a[2*H:3*H])   # output gate #@o
        g = np.tanh(a[3*H:])      # new values  #@g
        next_c = f * prev_c + i * g             #@c
        next_h = o * np.tanh(next_c)            #@nh

        # backward, along the cell:
        dprev_c = f * dnext_c   # no matrix     #@hw
      `,
      beats: [
        { id: 'two', say: 'The {LSTM|L S T M}, from 1997, keeps two memories: the hidden state h that it shows the world, and a private cell state c.', code: ['c', 'nh'] },
        { id: 'gates', say: 'Gates control the cell: numbers between zero and one, computed fresh at every step, that act as soft switches.', code: ['i', 'f', 'o'] },
        { id: 'one', say: 'One matrix multiply on the old hidden state and the new input gives four pieces. Three pass through a sigmoid: the input, forget and output gates.', code: ['a', 'i', 'f', 'o'] },
        { id: 'g', say: 'The fourth, g, passes through {tanh|tan h}: the candidate values to write.', code: 'g' },
        { id: 'update', say: 'The update: multiply the old cell by the forget gate, to erase, then add the input gate times g, to write.', code: 'c' },
        { id: 'reveal', say: 'The hidden state is a squashed view of the cell, filtered by the output gate.', code: 'nh' },
        { id: 'store', say: 'In this one unit {LSTM|L S T M} with hand set weights, a store flag opens the input gate and shuts the forget gate, writing a new value.', code: ['i', 'f', 'c'] },
        { id: 'hold', say: 'Otherwise the cell holds its value, losing under one percent a step. A trained {LSTM|L S T M} learns weights like these by itself.', code: ['f', 'c'] },
        { id: 'highway', say: 'Now go backward along the cell. The new cell is the forget gate times the old one, plus a term, so the gradient is just multiplied by the forget gate.', code: 'hw' },
        { id: 'nomat', say: "No matrix and no {tanh|tan h} slope, and the network can hold that gate near one for as long as it must. Like {ResNet|res net}'s skip connections, it is an additive highway.", code: 'hw' },
        { id: 'gru', say: 'Its cousin, the {GRU|G R U}, merges cell and hidden state and uses two gates. Searches over thousands of variants found nothing clearly better.' },
      ],
    },
    {
      id: 'outro',
      title: 'Recap',
      codeTitle: 'summary.py',
      code: `
        for x in sequence:                      #@loop
            h = np.tanh(np.dot(Whh, h)          #@loop
                 + np.dot(Wxh, x) + bh)         #@loop
            y = np.dot(Why, h) + by             #@y
        ix = np.random.choice(V, p=softmax(y))  #@sample
        np.clip(d, -5, 5, out=d)     # explode  #@clip
        next_c = f * prev_c + i * g  # vanish   #@lstm
        h = np.dot(W_proj, cnn(image))  # caption  #@cap
      `,
      beats: [
        { id: 'loop', say: 'To recap: a recurrent network is a loop, with a hidden state and the same weights at every step.', code: 'loop' },
        { id: 'gen', say: 'Trained to predict what comes next, it writes: sample, feed back, repeat.', code: ['y', 'sample'] },
        { id: 'bptt', say: 'It trains with backprop through time, in chunks, with the memory carried forward.', code: 'loop' },
        { id: 'forget', say: "Multiplying by {Whh|W h h} at every step makes plain {RNNs|R N Ns} explode or forget: clipping fixes the first, the {LSTM|L S T M}'s additive cell the second.", code: ['clip', 'lstm'] },
        { id: 'cap', say: 'And a {ConvNet|conv net} feeding an {RNN|R N N} writes captions, which you will build in Assignment 3.', code: 'cap' },
        { id: 'next', say: 'Next, attention. Instead of one glance at the image, the network chooses where to look, and looks again for every word it writes.', pause: 0.6 },
      ],
    },
  ],
};
