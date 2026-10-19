import type { LectureScript } from '../../lecture/types';

export const script: LectureScript = {
  id: 'contrastive',
  title: 'Self-supervised learning and CLIP',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'intro',
      title: 'Learning without labels',
      codeTitle: 'the_plan.py',
      code: `
        # self-supervised learning, 2018 to 2021
        x = unlabeled_images            #@data
        z = f(x)              # embeddings  #@data
        loss = agree(z1, z2)  # two views   #@nce
        # families: contrastive, CLIP,      #@fam
        #   masked autoencoders, DINO       #@fam
        acc = linear_probe(f, labeled)  #@probe
      `,
      beats: [
        { id: 'hello', say: 'This is chapter eleven: self-supervised learning and CLIP.' },
        { id: 'labels', say: 'Every classifier in the first course learned from labels: a million photos, each tagged by a person.' },
        { id: 'thin', say: 'Labels are expensive, and thin: one word per image says nothing about pose, texture or light.' },
        { id: 'before', say: 'CS231n ended with autoencoders and GANs, which learn from images alone by rebuilding pixels. Their features never matched supervised ones.' },
        { id: 'changed', say: 'Between {2018|twenty eighteen} and {2021|twenty twenty-one}, that changed: networks trained on unlabeled images matched supervised pretraining, then beat it.', code: 'data' },
        { id: 'clip', say: 'And {CLIP|clip} learned from {400 million|four hundred million} captioned images, and could classify things it was never trained to classify.' },
        { id: 'plan', say: 'We will build the central idea, the contrastive loss, and see why it needs negatives.', code: 'nce' },
        { id: 'plan2', say: 'Then {SimCLR|sim C L R}, {MoCo|moe co} and {CLIP|clip}, and finally the two other families: masked autoencoders, and {DINO|dee no}.', code: 'fam' },
        { id: 'grade', say: 'But first: with no labels, how do we know the features are any good?', code: 'probe' },
      ],
    },
    {
      id: 'probe',
      title: 'Make up a task, then grade it',
      codeTitle: 'pretext_and_probe.py',
      code: `
        # a pretext task: guess the rotation
        k = np.random.randint(4)        #@rot
        x_rot = np.rot90(x, k)          #@rot
        loss = ce(head(f(x_rot)), k)    #@rot

        # the grade: a linear probe
        feats = f(X_train)   # f frozen #@probe
        W, b = fit_softmax(feats, y_train) #@fit
        acc = accuracy(f(X_test) @ W + b)  #@acc
      `,
      beats: [
        { id: 'self', say: 'Self-supervised learning means inventing a task whose answers come from the data itself.' },
        { id: 'lm', say: 'Language models already do this: predicting the next word turns any sentence into training data.' },
        { id: 'rot', say: 'For images, the early tasks were puzzles. Rotate a photo by a quarter turn, a half, or three quarters, and ask the network which.', code: 'rot' },
        { id: 'why', say: 'To tell which way is up, it has to know something about skies, legs and wheels.', code: 'rot' },
        { id: 'point', say: 'The puzzle itself never matters. We want an encoder, f, whose features are useful later.' },
        { id: 'probe', say: 'So we grade them with a linear probe: freeze the encoder, and train only a linear classifier on top, with labels.', code: ['probe', 'fit'] },
        { id: 'meaning', say: 'If a single matrix multiply can read the class off the features, the encoder has made the class explicit.', code: 'fit' },
        { id: 'acc', say: 'Its test accuracy is the grade. When a paper reports {76.5|seventy six point five} percent on ImageNet, it usually means this.', code: 'acc' },
      ],
    },
    {
      id: 'views',
      title: 'Two views of one image',
      codeTitle: 'two_views.py',
      code: `
        def augment(img):
            img = random_crop(img, (0.25, 1)) #@crop
            img = maybe_flip(img)             #@crop
            img = color_jitter(img)  # p=0.8  #@color
            img = maybe_gray(img)    # p=0.2  #@color
            return img

        x1, x2 = augment(x), augment(x)       #@views
        z1 = normalize(f(x1))   # length 1    #@z
        z2 = normalize(f(x2))                 #@z
        sim = z1 @ z2           # a cosine    #@sim
      `,
      beats: [
        { id: 'idea', say: 'Here is the idea that won. Make two random versions of an image: two views. They differ pixel by pixel, but show the same thing.', code: 'views' },
        { id: 'crop', say: 'Crop a different region for each, maybe flip one,', code: 'crop' },
        { id: 'color', say: 'then shift the colors, or drop them to gray.', code: 'color' },
        { id: 'rule', say: 'Now train the encoder so that two views of one image land close together, and views of different images far apart.', code: 'views' },
        { id: 'nolabel', say: 'Nobody says what a cat is. To match views across crops and color shifts, the network must describe each image by what stays the same: its content.' },
        { id: 'teacher', say: 'So the augmentations are the real teacher. Without color jitter, two crops share their colors, and the network cheats by matching color.', code: 'color' },
        { id: 'norm', say: 'To measure close, each embedding, z, is first scaled to length one.', code: 'z' },
        { id: 'cos', say: 'Then the dot product of two embeddings is the cosine of their angle: one when they point the same way, minus one when opposite.', code: 'sim' },
        { id: 'sphere', say: 'Every embedding lives on a sphere, and similarity is just an angle.' },
      ],
    },
    {
      id: 'infonce',
      title: 'InfoNCE: a softmax over the batch',
      codeTitle: 'info_nce.py',
      code: `
        S = z1 @ z2.T / tau       # (N, N)   #@S
        labels = np.arange(N)     # diagonal #@y
        P = softmax(S, axis=1)               #@P
        L = -np.log(P[labels, labels])       #@loss
        loss = L.mean()                      #@loss
      `,
      beats: [
        { id: 'table', say: 'Take a batch of N images. Put view one of each image down the rows, and view two across the columns.', code: 'S' },
        { id: 'S', say: 'Each cell is a similarity, divided by a temperature, {tau|tau}. Call this table S.', code: 'S' },
        { id: 'right', say: 'In row i, exactly one column is right: column i, the other view of the same image. The other N minus one are wrong.', code: 'y' },
        { id: 'softmax', say: 'That is classification with N classes. A softmax along each row turns scores into probabilities.', code: 'P' },
        { id: 'ce', say: 'Then take minus the log of the probability on the diagonal, and average over the rows.', code: 'loss' },
        { id: 'name', say: 'This is {InfoNCE|info N C E}, named in {2018|twenty eighteen} by van den Oord and colleagues.' },
        { id: 'weights', say: 'Row i is a softmax classifier whose class weights are the other view\'s embeddings. Every image is its own class.', code: 'S' },
        { id: 'pull', say: 'The top of the fraction pulls the partner closer. The bottom pushes every other image away.', code: 'loss' },
        { id: 'logN', say: 'If every embedding were the same, every row would be a uniform guess, and the loss would be exactly log N.', code: 'loss' },
      ],
    },
    {
      id: 'temperature',
      title: 'Temperature and hard negatives',
      codeTitle: 'temperature.py',
      code: `
        tau = {{tau:1.0}}                     #@tau
        S = sim / tau          # one row     #@tau
        P = softmax(S)                       #@grad
        dS = P - onehot(partner)             #@grad
        # each negative is pushed by P[j]   #@push
      `,
      beats: [
        { id: 'narrow', say: 'Why divide by {tau|tau}? Cosines only range from minus one to one, which is too narrow for a confident softmax.' },
        { id: 'small', say: 'With {tau|tau} at {0.1|zero point one}, a gap of one in cosine becomes a gap of ten in the score.', code: 'tau' },
        { id: 'grad', say: '{tau|tau} also decides which negatives matter. The gradient of one row\'s loss is simple: the probabilities, minus the one-hot target.', code: 'grad' },
        { id: 'push', say: 'So each negative is pushed away in proportion to its probability: how much the row confuses it with the partner.', code: 'push' },
        { id: 'large', say: 'With a large {tau|tau}, the probabilities are flat, and every negative gets about the same push.', code: 'tau' },
        { id: 'lower', say: 'Lower {tau|tau}, and the softmax sharpens. Nearly all of the push goes to the few closest negatives: the hard negatives.', code: 'tau' },
        { id: 'values', say: 'In practice {tau|tau} is small: {MoCo|moe co} used {0.07|zero point zero seven}, and {CLIP|clip} starts there and learns it.' },
      ],
    },
    {
      id: 'collapse',
      title: 'Why negatives matter',
      codeTitle: 'train_toy.py',
      code: `
        for step in range(1500):
            x1, x2 = augment(X), augment(X) #@aug
            z1, z2 = embed(x1), embed(x2)   #@aug
            S = z1 @ z2.T / tau             #@S
            if mode == {{mode:"infonce"}}:   #@nce
                loss = ce(S, labels)        #@nce
            else:   # positives only        #@pos
                loss = -np.diag(S).mean()   #@pos
            f.step(grad(loss))
        # step {{step:0}}  probe {{probe:54%}}
      `,
      beats: [
        { id: 'why', say: 'Why not drop the bottom of the fraction, and just pull matching views together?', code: 'pos' },
        { id: 'trivial', say: 'Because a perfect answer learns nothing: map every image to the same point. Every pair matches, and the loss is as low as it goes.', code: 'pos' },
        { id: 'name', say: 'That is collapse, and every self-supervised method has to prevent it somehow.' },
        { id: 'toy', say: 'Here is a toy. Each item has two numbers of content and four of style. A view keeps the content and redraws the style.', code: 'aug' },
        { id: 'init', say: 'The circle shows each item\'s embedding, colored by a hidden class. At first the classes are mixed, and a linear probe gets about half right.', code: 'nce' },
        { id: 'train', say: 'Train with {InfoNCE|info N C E}. The classes gather into arcs, the batch matrix lights up along its diagonal, and the probe passes ninety percent.', code: ['S', 'nce'] },
        { id: 'forces', say: 'Two forces are at work: alignment pulls matching views together, and uniformity spreads everything around the circle.' },
        { id: 'pos', say: 'Now train with positives only. At first it learns to ignore style, and looks fine.', code: 'pos' },
        { id: 'fall', say: 'Then nothing stops the drift. Every point slides to one spot, the matrix goes flat, and the probe falls toward chance. The loss never complained.', code: 'pos' },
      ],
    },
    {
      id: 'simclr',
      title: 'SimCLR',
      codeTitle: 'simclr.py',
      code: `
        x = np.concatenate([x1, x2])  # 2N   #@views
        h = f(x)              # 2048 each    #@f
        z = normalize(g(h))   # 128 each     #@g
        S = z @ z.T / tau     # (2N, 2N)     #@S
        np.fill_diagonal(S, -np.inf)         #@S
        loss = ce(S, partner)                #@S
        # keep f and h, throw g away         #@keep
      `,
      beats: [
        { id: 'who', say: '{SimCLR|sim C L R}, from Chen and colleagues in {2020|twenty twenty}, put these pieces together in the simplest form.' },
        { id: 'views', say: 'Every image in a batch of N gets two views, so there are two N views in all.', code: 'views' },
        { id: 'f', say: 'A ResNet encoder, f, turns each view into a representation, h, of {2,048|two thousand and forty eight} numbers.', code: 'f' },
        { id: 'g', say: 'A small projection head, g, maps h to the {128|one hundred and twenty eight} numbers, z, that the loss sees.', code: 'g' },
        { id: 'S', say: 'Every view is compared with every other. Its similarity with itself is removed, and its partner is the one right answer among two N minus one.', code: 'S' },
        { id: 'keep', say: 'After training, the head is thrown away and h is kept: it beat z by more than ten points.', code: 'keep' },
        { id: 'aug', say: 'The mix of augmentations mattered most: random crops, plus strong color distortion.' },
        { id: 'batch', say: 'And it wants big batches: {4,096|four thousand and ninety six} images, so {8,190|eight thousand one hundred and ninety} negatives for every positive pair.' },
        { id: 'result', say: 'A linear probe on a ResNet fifty, four times as wide, reached {76.5|seventy six point five} percent on ImageNet, as good as a supervised ResNet fifty.' },
      ],
    },
    {
      id: 'moco',
      title: 'MoCo: a queue and a momentum encoder',
      codeTitle: 'moco.py',
      code: `
        m = {{m:0.99}}
        q = normalize(f_q(aug(x)))          #@q
        k = normalize(f_k(aug(x)))  # no grad #@q
        l_neg = q @ queue.T                 #@neg
        f_q.step(grad(loss))                #@upd
        f_k.params = (m * f_k.params        #@ema
                      + (1 - m) * f_q.params) #@ema
        queue = push(queue, k)  # drop old  #@queue
      `,
      beats: [
        { id: 'cost', say: 'Batches of four thousand need a lot of hardware. {MoCo|moe co}, from He and colleagues in {2019|twenty nineteen}, found negatives elsewhere.' },
        { id: 'queue', say: 'It keeps a queue of embeddings from recent batches. Every step, new keys go in, and the oldest come out.', code: 'queue' },
        { id: 'many', say: 'So each query meets {65,536|sixty five thousand} negatives, while the batch stays at {256|two hundred and fifty six}.', code: 'neg' },
        { id: 'catch', say: 'The catch is consistency: an old key was made by an older encoder, so old keys and new queries use different rulers.' },
        { id: 'two', say: 'So {MoCo|moe co} uses two encoders. The query encoder, {f_q|f q}, is trained by backprop.', code: ['q', 'upd'] },
        { id: 'ema', say: 'The key encoder, {f_k|f k}, gets no gradient at all. After every step, it moves a small fraction of the way toward {f_q|f q}.', code: 'ema' },
        { id: 'avg', say: 'That is a moving average with momentum m. At {0.999|zero point nine nine nine}, the key encoder remembers roughly the last thousand steps.', code: 'ema' },
        { id: 'smooth', say: 'It follows the query encoder smoothly, with a lag, so every key in the queue comes from nearly the same network.' },
        { id: 'fail', say: 'Copying the encoder outright, m at zero, made training fail. And the momentum encoder outlived the queue: {DINO|dee no} still uses one.', code: 'ema' },
      ],
    },
    {
      id: 'clip',
      title: 'CLIP: images and text in one space',
      codeTitle: 'clip_loss.py',
      code: `
        z = normalize(image_encoder(images)) #@img
        t = normalize(text_encoder(texts))   #@txt
        S = z @ t.T / tau        # (N, N)    #@S
        labels = np.arange(N)                #@S
        loss = (ce(S, labels)                #@loss
                + ce(S.T, labels)) / 2       #@loss
        # tau is learned; starts at 0.07     #@tau
      `,
      beats: [
        { id: 'pairs', say: 'Contrastive learning needs pairs that should match. {CLIP|clip}, from OpenAI in {2021|twenty twenty-one}, used pairs the internet already had: an image, and the text next to it.' },
        { id: 'data', say: 'Its training set was {400 million|four hundred million} image and text pairs.' },
        { id: 'towers', say: 'There are two encoders: for images, a ResNet or a vision transformer; for text, a transformer.', code: ['img', 'txt'] },
        { id: 'shared', say: 'Both project into the same space, normalized, so an image and a sentence can be compared with a dot product.', code: ['img', 'txt'] },
        { id: 'matrix', say: 'In a batch of N pairs, image i should pick caption i out of all N captions,', code: 'S' },
        { id: 'sym', say: 'and caption i should pick image i out of all N images. That is {InfoNCE|info N C E} in both directions: along the rows, and down the columns.', code: 'loss' },
        { id: 'toy', say: 'Here is a toy {CLIP|clip}: pictures of colored shapes, with captions like, a big red circle. Watch the diagonal sharpen.', code: 'loss' },
        { id: 'order', say: 'Color is learned first. Telling a circle from a square takes longest, and those cells are the last to fade.' },
        { id: 'tau', say: 'The temperature is learned, starting at {0.07|zero point zero seven}. And the real batch held {32,768|thirty two thousand} pairs.', code: 'tau' },
        { id: 'why', say: 'Predicting each caption word for word was tried first. Matching was several times more efficient, and it is exactly what classification needs.' },
      ],
    },
    {
      id: 'zeroshot',
      title: 'Zero-shot: a classifier in words',
      codeTitle: 'zero_shot.py',
      code: `
        prompts = ["a circle", "a square", #@prompts
                   "a triangle"]           #@prompts
        t = normalize(text_encoder(prompts)) #@txt
        z = normalize(image_encoder(images)) #@img
        pred = (z @ t.T).argmax(axis=1)      #@pred
      `,
      beats: [
        { id: 'free', say: 'Once images and text share a space, a classifier needs no training at all.' },
        { id: 'prompts', say: 'Write one sentence per class. In the toy: a circle, a square, a triangle. For real photos: a photo of a dog, a photo of a cat.', code: 'prompts' },
        { id: 'embed', say: 'Embed the sentences with the text encoder. Those vectors are the weights of the classifier.', code: 'txt' },
        { id: 'image', say: 'Then embed each image, compare it with every sentence, and pick the most similar.', code: ['img', 'pred'] },
        { id: 'linear', say: 'It is a linear classifier, like those of the first course, except that you wrote its weights in English.' },
        { id: 'zero', say: 'This is zero-shot: zero training examples of these classes. Any list of classes you can name will do.' },
        { id: 'result', say: '{CLIP|clip}\'s best model classified ImageNet this way at {76.2|seventy six point two} percent, matching a supervised ResNet fifty without any of its labeled images.' },
        { id: 'wording', say: 'The wording matters. The template, a photo of a label, beat the bare class name by {1.3|one point three} points, and averaging eighty templates added {3.5|three point five} more.', code: 'prompts' },
        { id: 'uses', say: '{CLIP|clip}\'s embeddings became infrastructure: Stable Diffusion listens to its text encoder, and many vision-language models see through its image encoder.' },
      ],
    },
    {
      id: 'mae',
      title: 'Masked autoencoders',
      codeTitle: 'mae.py',
      code: `
        ids = np.argsort(np.random.rand(64)) #@shuffle
        keep = ids[:16]        # 25% visible #@shuffle
        masked = ids[16:]                    #@shuffle
        h = encoder(patches[keep])   # ViT   #@enc
        pred = decoder(h, ids)  # fills gaps #@dec
        err = (pred - patches)[masked] ** 2  #@loss
        loss = err.mean()      # hidden only #@loss
      `,
      beats: [
        { id: 'back', say: 'The second family goes back to the autoencoder, and borrows a trick from BERT: hide part of the input, then rebuild it.' },
        { id: 'mae', say: '{MAE|M A E}, from He and colleagues in {2021|twenty twenty-one}, cuts an image into patches and hides a random seventy five percent of them.', code: 'shuffle' },
        { id: 'enc', say: 'The encoder, a {ViT|vit}, sees only the visible quarter: no placeholders, just those patches and their positions.', code: 'enc' },
        { id: 'dec', say: 'A small decoder adds a learned mask token in every gap, and predicts the missing pixels.', code: 'dec' },
        { id: 'loss', say: 'The loss is the squared error on the hidden patches only. Copying the visible ones would be trivial.', code: 'loss' },
        { id: 'why', say: 'Why so much? BERT hides fifteen percent of words, but images are redundant: a hidden patch usually looks like its neighbors.' },
        { id: 'naive', say: 'Here the holes are filled with no learning at all, by averaging nearby pixels. With a quarter hidden, that works well.' },
        { id: 'hard', say: 'At seventy five percent, it smears every edge. To do better, a network has to know what birds and wheels look like.' },
        { id: 'cheap', say: 'A bonus: the big encoder sees only a quarter of the tokens, so training ran about three times faster.', code: 'enc' },
        { id: 'result', say: '{MAE|M A E} features are weaker under a linear probe, but excellent after fine-tuning: a {ViT|vit} Huge reached {87.8|eighty seven point eight} percent on ImageNet.' },
      ],
    },
    {
      id: 'dino',
      title: 'DINO: self-distillation',
      codeTitle: 'dino.py',
      code: `
        pt = softmax((gt(x1) - center) / 0.04) #@sharp
        ps = softmax(gs(x2) / 0.1)            #@student
        loss = -(pt * np.log(ps)).sum(1)       #@student
        gs.step(grad(loss.mean()))             #@student
        gt = m * gt + (1 - m) * gs   # EMA     #@ema
        center = 0.9 * center + 0.1 * mean_t   #@center
      `,
      beats: [
        { id: 'third', say: 'The third family has no negatives and no pixels. {DINO|dee no}, from Caron and colleagues in {2021|twenty twenty-one}, trains a student to match a teacher.' },
        { id: 'teacher', say: 'The teacher is the same network, with weights that are a moving average of the student\'s, as in {MoCo|moe co}. Nobody provides the right answer.', code: 'ema' },
        { id: 'outputs', say: 'Both end in a softmax over many outputs, soft clusters it invents. The student matches the teacher\'s distribution on another view.', code: 'student' },
        { id: 'crops', say: 'The teacher sees large crops; the student also sees small ones, so it must recognize the whole from a part.' },
        { id: 'collapse', say: 'With no negatives, what stops collapse? Two cheap operations on the teacher\'s output.' },
        { id: 'center', say: 'Centering subtracts a running average of the outputs, so no single output can win for every image.', code: 'center' },
        { id: 'sharpen', say: 'Sharpening gives the teacher a lower temperature than the student, so its targets are always more decisive.', code: 'sharp' },
        { id: 'nocenter', say: 'On the toy data: drop centering, and one output swallows everything.', code: 'center' },
        { id: 'nosharpen', say: 'Drop sharpening instead, and every output flattens toward uniform.', code: 'sharp' },
        { id: 'both', say: 'Together, they balance: outputs that split along the hidden groups, without ever seeing a label.' },
        { id: 'emerge', say: 'Its vision transformers also learned attention that outlines the main object, with no segmentation labels. A {ViT|vit} Base reached {80.1|eighty point one} percent with a linear probe.' },
      ],
    },
    {
      id: 'outro',
      title: 'The families side by side',
      codeTitle: 'families.py',
      code: `
        # contrastive: match two views    #@con
        #   SimCLR: big batches            #@con
        #   MoCo: a queue, momentum        #@con
        # CLIP: match images and text      #@clip
        # MAE: rebuild hidden patches      #@mae
        # DINO: match a moving teacher     #@dino
        acc = linear_probe(f, labeled)     #@probe
      `,
      beats: [
        { id: 'con', say: 'Contrastive learning matches two views against a batch of negatives: {SimCLR|sim C L R} gets them from huge batches, {MoCo|moe co} from a queue.', code: 'con' },
        { id: 'clip', say: '{CLIP|clip} applies the same loss to images and captions, and its shared space turns prompts into classifiers.', code: 'clip' },
        { id: 'mae', say: '{MAE|M A E} hides three quarters of an image and rebuilds the pixels.', code: 'mae' },
        { id: 'dino', say: '{DINO|dee no} matches a moving-average teacher, kept alive by centering and sharpening.', code: 'dino' },
        { id: 'probe', say: 'And all of them are graded the same way: freeze the encoder, and see what a linear probe can read.', code: 'probe' },
        { id: 'flavors', say: 'Contrastive and {DINO|dee no} features are ready for probes and nearest neighbors; {MAE|M A E} features want fine-tuning, and improve with size.' },
        { id: 'thread', say: 'The common thread: the data supplies its own targets. Two views of a photo, a caption, a hidden patch, or a slower copy of the network itself.' },
        { id: 'close', say: 'Labels are still needed, but only a few, at the very end, to read the answer off features that were learned without them.', code: 'probe' },
      ],
    },
  ],
};
