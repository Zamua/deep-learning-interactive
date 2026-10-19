import type { ChapterDef } from './index';
import { CONTRASTIVE_SYMBOLS } from '../lib/contrastive-symbols';
import { figInfoNCE, figMoCo, figTrain, figViews } from '../lib/contrastive-figs';
import { figClip, figDino, figMAE, figZeroShot } from '../lib/contrastive-figs2';

const chapter: ChapterDef = {
  symbols: CONTRASTIVE_SYMBOLS,

  render(p) {
    p.prose(`
Every image classifier in CS231n learned from labels: a million ImageNet photos, each tagged by a person. Labels are the expensive part, and they are thin: one word per image says nothing about the pose of the cat, the texture of the sofa or the light in the room. The last CS231n chapter ([video and unsupervised learning](#/unsupervised)) asked whether a network could learn from images alone, and answered with autoencoders, VAEs and GANs, which learn by rebuilding or generating pixels. Those models made pictures, but their features were never a match for supervised ImageNet features.

Between 2018 and 2021 that changed. A family of methods learned features from unlabeled images that matched, then beat, supervised pretraining, and one of them, CLIP, learned from 400 million images with captions instead of labels and could classify images it had never been trained to classify. This chapter covers the ideas behind them:

- **contrastive learning**: two random views of one image should map to nearby vectors, and views of different images should not. The loss, **InfoNCE**, is the softmax cross-entropy you already know, applied to a batch;
- why the "should not" part (the **negatives**) matters, and what **collapse** is;
- **SimCLR** and **MoCo**, two ways to get enough negatives;
- **CLIP**, the same loss between images and text, and **zero-shot** classification by writing a prompt;
- the two other families: **masked autoencoders** (hide 75% of an image and rebuild it) and **DINO** (a network distilling a slowly moving copy of itself).

The models here are mostly [vision transformers](#/vit) or ResNets; their embeddings later became the conditioning signal for image generators, the subject of [the next chapter](#/diffusion).`);

    p.h2('Learning without labels, and how to grade it', 'pretext');
    p.prose(`
**Self-supervised learning** means making up a training task whose answers come from the data itself, so no person has to label anything. Language models were already doing it: [next-token prediction](#/pretraining) turns every sentence on the web into training examples, and BERT hides words and predicts them. For images, the early tasks were puzzles:

- predict where one patch of an image sits relative to another (Doersch, Gupta and Efros, 2015);
- color a grayscale photo (Zhang, Isola and Efros, 2016);
- solve a jigsaw of shuffled tiles (Noroozi and Favaro, 2016);
- guess which of four rotations, 0, 90, 180 or 270 degrees, was applied (Gidaris, Singh and Komodakis, 2018).

To solve these, a network has to notice something about objects: you cannot tell which way is up without knowing what skies and feet look like. But each puzzle also has shortcuts (chromatic aberration at the lens edge gives away a patch's position), and the features stayed well behind supervised ones.

Whatever the task, nobody cares about the puzzle itself. The goal is an encoder $\\symf$ whose output, a vector of features for each image, is useful for *other* tasks later. So we need a way to grade features. The standard one is the **linear probe**: freeze the encoder, and train only a linear classifier on top of its features, using the labeled training set. If one matrix multiply can read the class off the features, the encoder has made the class information explicit.`);

    p.math({
      label: 'Linear probe',
      tex: String.raw`\hat{y} = \operatorname{softmax}\!\big(W\,\symf(\symx) + b\big), \qquad \symf \text{ frozen}`,
      code: `
        feats = f(X_train)        # (N, D), f frozen
        W, b = train_softmax(feats, y_train)  # only these
        scores = f(X_test) @ W + b
        acc = (scores.argmax(1) == y_test).mean()
      `,
      codeTitle: 'linear_probe.py',
      terms: [
        [String.raw`\symf(\symx)`, 'the frozen encoder applied to image `x`: a vector of $D$ features (2,048 for a ResNet-50)'],
        [String.raw`W,\, b`, 'the only trained parameters: one row of weights and one bias per class'],
        [String.raw`\operatorname{softmax}`, 'turns the class scores into probabilities, exactly as in the [softmax classifier](#/linear-classification)'],
        [String.raw`\hat{y}`, "the probe's prediction; its accuracy on the test set is the grade"],
      ],
      explain: `It is the linear classifier of CS231n chapter 4, trained on features instead of pixels. On raw CIFAR-10 pixels it reaches about 40 percent; on good features, far more. Two other grades are common: **fine-tuning** (unfreeze the encoder and train everything, which measures how good a starting point the features are) and **k-nearest neighbors** in feature space (no training at all). When papers below say "76.5% on ImageNet", they mean linear-probe top-1 accuracy unless they say otherwise.`,
    });

    p.h2('Two views of one image', 'views');
    p.prose(`
Here is the idea that won. Take an image and make two random versions of it, two **views**: crop a different region of each, flip one, shift its colors. The views look different pixel by pixel, but they show the same thing. Now train the encoder so that the two views of the same image land close together, and views of *different* images land far apart. Nobody says what a cat is. The network only learns which images are which, and to do that across random crops and color shifts it has to describe each image by what stays the same: its content.

This framing, each image as its own class, goes back to exemplar networks (Dosovitskiy and colleagues, 2014) and instance discrimination (Wu and colleagues, 2018). The augmentations are the same ones you met for supervised training in [ConvNets in practice](#/convnets-practice), but here they carry the whole learning signal.`);

    figViews(p);

    p.callout('intuition', `The augmentations decide what the network learns to ignore. Random crops teach it that position and scale do not change identity; color jitter teaches it to ignore lighting and white balance. Leave color jitter out and SimCLR's accuracy drops sharply: two crops of one photo share its overall color, so the network matches views by their color histograms and learns little else. Change the augmentations and you change the features.`, 'Augmentations are the teacher');

    p.prose(`
To measure "close together", the encoder's output is first scaled to length 1 (divided by its own length), and two embeddings are compared by their dot product. For unit vectors, the dot product is the cosine of the angle between them: 1 when they point the same way, 0 at a right angle, $-1$ when opposite. So every embedding $\\symz$ lives on the surface of a sphere, and similarity is just angle.`);

    p.math({
      label: 'Cosine similarity',
      tex: String.raw`\operatorname{sim}(\symz_i, \symz'_j) = \frac{\symz_i \cdot \symz'_j}{\lVert \symz_i \rVert\, \lVert \symz'_j \rVert}`,
      code: `
        h1, h2 = f(x1), f(x2)      # (N, d) each
        z1 = h1 / np.linalg.norm(h1, axis=1)[:, None]
        z2 = h2 / np.linalg.norm(h2, axis=1)[:, None]
        sim = z1 @ z2.T            # (N, N), in [-1, 1]
      `,
      codeTitle: 'cosine.py',
      terms: [
        [String.raw`\symz_i,\ \symz'_j`, 'the embedding of view 1 of image $i$, and of view 2 of image $j$'],
        [String.raw`\symz_i \cdot \symz'_j`, 'dot product: multiply matching entries and add them up'],
        [String.raw`\lVert \symz \rVert`, 'the length of a vector: the square root of the sum of its squared entries'],
        [String.raw`\operatorname{sim}`, 'the cosine of the angle between the two vectors, from $-1$ to $1$'],
      ],
      explain: `Dividing by the lengths throws away how long the vectors are and keeps only their direction, so the network cannot make a similarity large just by making vectors long. In code the normalization happens once, and then a single matrix product compares every view-1 embedding with every view-2 embedding: an $N \\times N$ table of cosines for a batch of $N$ images.`,
    });

    p.h2('InfoNCE: a softmax over the batch', 'infonce');
    p.prose(`
Now the loss. Lay the batch out as a table: row $i$ is view 1 of image $i$, column $j$ is view 2 of image $j$, and the entry is their similarity divided by a temperature $\\symtau$. Call this table $\\symS$. For row $i$, exactly one column is right, column $i$, the other view of the same image. The other $N - 1$ columns are wrong.

That is a classification problem with $N$ classes, and you already know its loss: softmax over the row, then minus the log of the probability on the right answer. Do it for every row and average. The targets $\\symy$ are simply $0, 1, \\ldots, N - 1$: the diagonal. This is **InfoNCE**, the name given by van den Oord, Li and Vinyals (2018) in contrastive predictive coding.`);

    p.math({
      label: 'InfoNCE loss',
      tex: String.raw`\symL = -\frac{1}{N}\sum_{i=1}^{N} \log \frac{e^{\symS_{ii}}}{\sum_{j=1}^{N} e^{\symS_{ij}}}, \qquad \symS_{ij} = \frac{\symz_i \cdot \symz'_j}{\symtau}`,
      code: `
        S = z1 @ z2.T / tau        # (N, N)
        labels = np.arange(N)      # row i: column i
        S = S - S.max(1)[:, None]  # stability
        log_P = S - np.log(np.exp(S).sum(1))[:, None]
        loss = -log_P[labels, labels].mean()
      `,
      codeTitle: 'info_nce.py',
      terms: [
        [String.raw`\symS_{ij}`, 'how similar view 1 of image $i$ is to view 2 of image $j$, divided by the temperature'],
        [String.raw`e^{\symS_{ii}}`, 'the exponentiated score of the right answer, the positive pair'],
        [String.raw`\sum_{j} e^{\symS_{ij}}`, 'the same for every candidate in the row: the positive and the $N - 1$ negatives'],
        [String.raw`-\log(\cdot)`, 'cross-entropy: 0 if all the probability is on the positive, large if little is'],
        [String.raw`\frac{1}{N}\sum_i`, 'average over the rows: every image in the batch takes its turn as the anchor'],
      ],
      explain: `Read row $i$ as a [softmax classifier](#/linear-classification) whose class weights are the view-2 embeddings of the batch: its job is to pick out its own partner among $N$ candidates. The loss rewards making $\\symz_i$ point toward $\\symz'_i$ (the numerator) and away from everyone else (the denominator), and only the second part prevents the trivial answer of mapping everything to one point, as the next section shows. With all embeddings equal, every row is a uniform guess and the loss is exactly $\\log N$. Van den Oord and colleagues showed that $\\log N - \\symL$ is a lower bound on the mutual information between the two views (how much one tells you about the other), so a bigger batch allows a higher bound: one reason these methods like large batches.`,
    });

    figInfoNCE(p);

    p.prose(`
### The temperature

Dividing by $\\symtau$ before the softmax stretches the scores. Cosines live between $-1$ and $1$, which is too narrow a range for a softmax to be confident: with $\\symtau = 1$, even a perfect positive and a perfectly opposite negative differ by only 2 in score, a probability ratio of about 7. With $\\symtau = 0.1$ they differ by 20. Typical values are small: MoCo used 0.07, and CLIP starts at 0.07 and learns it.

The temperature does more than set confidence. It decides *which negatives the loss cares about*. Differentiate the loss of one row with respect to its similarities and the softmax gives back something simple:`);

    p.math({
      label: 'Gradient on each similarity',
      tex: String.raw`\frac{\partial \symL_i}{\partial\, (\symz_i \cdot \symz'_j)} = \frac{1}{\symtau}\Big(P_{ij} - \mathbf{1}[\,j = i\,]\Big), \qquad P_{ij} = \frac{e^{\symS_{ij}}}{\sum_k e^{\symS_{ik}}}`,
      code: `
        P = softmax(S, axis=1)     # (N, N)
        dS = P - np.eye(N)  # pull the partner, push the rest
        d_sim = dS / tau    # gradient on every cosine
        # negative j is pushed with strength P[i, j] / tau
      `,
      codeTitle: 'info_nce_grad.py',
      terms: [
        [String.raw`P_{ij}`, 'the softmax probability that row $i$ gives to candidate $j$'],
        [String.raw`\mathbf{1}[\,j = i\,]`, '1 for the positive, 0 for every negative'],
        [String.raw`P_{ii} - 1`, 'negative: gradient descent increases the positive similarity, until $P_{ii}$ reaches 1'],
        [String.raw`P_{ij},\ j \ne i`, 'positive: each negative is pushed away in proportion to its own probability'],
      ],
      explain: `This is the same "probabilities minus one-hot" gradient as every softmax classifier. The interesting part is what it means here: a negative is pushed away in proportion to how much the row currently confuses it with the positive. A negative that is already far away has a tiny $P_{ij}$ and is ignored. With a small $\\symtau$ the softmax is sharp, so nearly all the push goes to the few closest negatives, the **hard negatives**; with a large $\\symtau$ every negative is pushed about equally. Wang and Liu (2021) showed that this balance matters: too small and the loss tears apart images that are genuinely similar, too large and it stops separating anything finely. In the figure above, the bars under the matrix are exactly these weights.`,
    });

    p.h2('Why negatives matter', 'negatives');
    p.prose(`
Why not drop the denominator and just pull positive pairs together? Because there is a perfect solution that learns nothing: map every image to the same vector. Every pair then matches exactly, and the loss is at its minimum. This is **collapse**, and every self-supervised method has to prevent it somehow. Contrastive methods prevent it with negatives: the denominator gets large when everything is bunched up, so the cheapest way to lower the loss is to spread the batch out.

Wang and Isola (2020) named the two forces at work: **alignment** (positive pairs close) and **uniformity** (embeddings spread evenly over the sphere). InfoNCE asks for both. The figure below trains an encoder on toy data with both forces, and then with the negatives removed.`);

    figTrain(p);

    p.callout('warning', `Negatives are not checked: they are simply "every other image in the batch". If the batch holds two photos of dogs, each is the other's negative, and the loss pushes them apart. With 1,000 ImageNet classes and a random batch these **false negatives** are a small fraction, and the encoder's own smoothness keeps similar images nearby anyway (the 2 by 2 blocks along the diagonal in the figure). In the toy CLIP below, every caption in a batch is different for exactly this reason.`, 'False negatives');

    p.callout('aside', `Negatives are not the only fix for collapse. **BYOL** (Grill and colleagues, 2020) and **SimSiam** (Chen and He, 2020) use positives only, and avoid the constant solution with an asymmetry: one branch has an extra small predictor network and the other branch gets no gradient (a stop-gradient), so the two sides cannot simply agree on a constant. Why this works was debated for a while; empirically, it does. DINO, at the end of this chapter, belongs to this family.`, 'Learning without negatives');

    p.h2('SimCLR', 'simclr');
    p.prose(`
**SimCLR** (Chen, Kornblith, Norouzi and Hinton, 2020) put the pieces together in the simplest possible form and showed how far they go. Each image in a batch of $N$ gets two views, so there are $2N$ views. A ResNet-50 encoder $\\symf$ turns each view into a representation $h$ of 2,048 numbers, and a small **projection head** $g$ (an MLP with one hidden layer) maps $h$ to the 128-number $\\symz$ that the loss sees. Every view has one positive (its partner) and $2(N - 1)$ negatives (all other views, from both halves of the batch).`);

    p.math({
      label: 'SimCLR loss (NT-Xent), for view i of 2N',
      tex: String.raw`\ell_i = -\log \frac{\exp\!\big(\operatorname{sim}(\symz_i, \symz_{p(i)}) / \symtau\big)}{\sum_{k \ne i} \exp\!\big(\operatorname{sim}(\symz_i, \symz_k) / \symtau\big)}, \qquad \symL = \frac{1}{2N}\sum_{i=1}^{2N} \ell_i`,
      code: `
        x = np.concatenate([x1, x2])  # (2N, ...) views
        z = normalize(g(f(x)))        # (2N, 128)
        S = z @ z.T / tau             # (2N, 2N)
        np.fill_diagonal(S, -np.inf)  # not itself
        labels = np.r_[np.arange(N, 2 * N), np.arange(N)]
        loss = cross_entropy(S, labels)  # the partner
      `,
      codeTitle: 'nt_xent.py',
      terms: [
        [String.raw`p(i)`, 'the index of view $i$\'s partner: the other augmentation of the same image'],
        [String.raw`\sum_{k \ne i}`, 'every other view in the batch, including the partner: $2N - 1$ candidates'],
        [String.raw`\symtau`, 'the temperature, a small number tuned per setting'],
        [String.raw`\frac{1}{2N}\sum_i`, 'every one of the $2N$ views takes a turn as the anchor'],
      ],
      explain: `"NT-Xent" stands for normalized, temperature-scaled cross-entropy: the InfoNCE of the last section, with both views of every image used as anchors and as candidates. Setting the diagonal of $\\symS$ to minus infinity removes each view's similarity with itself, which would otherwise be a trivial 1. The labels say: the partner of view $i$ in the first half is view $i + N$, and the other way around.`,
    });

    p.prose(`
SimCLR's lessons, from careful ablations:

1. **The composition of augmentations matters most.** No single augmentation is enough; random crop plus strong color distortion stood out. For ImageNet, Gaussian blur helped too.
2. **The projection head helps, and is then thrown away.** The loss is computed on $\\symz$, but the features used afterward are $h$, the layer *before* the head, and they were better by more than 10 points in linear evaluation. The head can discard information the loss does not need (such as color or orientation, which the augmentations made irrelevant), leaving $h$ richer.
3. **Contrastive learning wants big batches and long training,** more than supervised learning does: more negatives per step. SimCLR used batches of 4,096 images, so 8,190 negatives per positive, on up to 128 TPU cores.

The result: a linear probe on a ResNet-50 trained this way reached 69.3% top-1 on ImageNet, and with a ResNet-50 four times as wide, 76.5%, the accuracy of a fully supervised ResNet-50.`);

    p.h2('MoCo: a queue and a momentum encoder', 'moco');
    p.prose(`
Batches of 4,096 need a lot of hardware. **MoCo** (He, Fan, Wu, Xie and Girshick, 2019) gets its negatives elsewhere: it keeps a **queue** of embeddings from recent batches. Each step, the current batch's keys go in and the oldest batch's keys come out, so a query is compared against tens of thousands of negatives (MoCo used 65,536) while the batch itself stays at 256.

The catch is consistency. A key that entered the queue 200 steps ago was computed by the encoder as it was 200 steps ago. If the encoder changes quickly, old keys and new queries are measured with different rulers, and the comparison is meaningless. MoCo's answer is a second encoder for the keys, $f_k$, that is not trained by gradient descent at all: after every step it moves a small fraction of the way toward the trained query encoder $f_q$.`);

    p.math({
      label: 'Momentum update of the key encoder',
      tex: String.raw`\theta_k \;\leftarrow\; \symm\,\theta_k + (1 - \symm)\,\theta_q`,
      code: `
        m = 0.999
        for p_k, p_q in zip(f_k.params, f_q.params):
            p_k[:] = m * p_k + (1 - m) * p_q  # no grad
      `,
      codeTitle: 'momentum_update.py',
      terms: [
        [String.raw`\theta_q`, 'all the weights of the query encoder $f_q$, trained by backprop as usual'],
        [String.raw`\theta_k`, 'the weights of the key encoder $f_k$, same architecture'],
        [String.raw`\symm`, 'the momentum, just below 1: how much of its old self the key encoder keeps each step'],
        [String.raw`(1 - \symm)\,\theta_q`, 'the small step toward the current query encoder: 0.1% per step for $\\symm = 0.999$'],
      ],
      explain: `This is an **exponential moving average** of the query encoder's weights over training. It follows the query encoder, but smoothly and with a lag, so the keys in the queue all come from nearly the same network. MoCo found that copying the encoder outright ($\\symm = 0$) made training fail (the loss oscillated), while $\\symm$ between 0.99 and 0.9999 worked well.`,
    });

    p.callout('math', `An **exponential moving average** keeps a running value $a$ and updates it with each new observation $v$ as $a \\leftarrow \\symm\\,a + (1 - \\symm)\\,v$. Unrolled, $a$ is a weighted average of all past observations, with weights that shrink by a factor $\\symm$ for each step back in time. It "remembers" roughly the last $1/(1 - \\symm)$ steps: about 100 steps for $\\symm = 0.99$, about 1,000 for 0.999. You met the same formula in momentum and Adam ([training chapter](#/nn-learning)) and in batch normalization's running statistics ([chapter 8](#/nn-data-loss)).`, 'Math help: moving averages');

    figMoCo(p);

    p.prose(`
**MoCo v2** (Chen, Fan, Girshick and He, 2020) then borrowed SimCLR's projection head and stronger augmentations, and with a batch of only 256 it outperformed SimCLR. The momentum encoder outlived the queue: BYOL and DINO both use a moving-average copy of the network as a slow, stable target.`);

    p.h2('CLIP: images and text in one space', 'clip');
    p.prose(`
Contrastive learning needs pairs that "should match". So far they were two crops of one image. **CLIP** (Radford and colleagues, OpenAI, 2021) used a different kind of pair, already plentiful on the internet: an image and the text written next to it. Its training set was 400 million (image, text) pairs.

CLIP has two encoders: an image encoder (ResNets and [vision transformers](#/vit), up to ViT-L/14) and a text encoder (a [transformer](#/transformer) over byte-pair tokens). Each ends in a linear projection into the *same* embedding space, followed by normalization. In a batch of $N$ pairs, image $i$ should be most similar to caption $i$ among all $N$ captions, and caption $i$ most similar to image $i$ among all $N$ images. That is InfoNCE in both directions: across the rows of $\\symS$ and down its columns.`);

    p.math({
      label: "CLIP's symmetric loss",
      tex: String.raw`\symL = \tfrac{1}{2}\Big[\operatorname{CE}(\symS, \symy) + \operatorname{CE}(\symS^{\top}, \symy)\Big], \qquad \symS_{ij} = \frac{\symz_i \cdot \symt_j}{\symtau}`,
      code: `
        z = normalize(image_encoder(images) @ W_img)
        t = normalize(text_encoder(texts) @ W_txt)
        S = z @ t.T * np.exp(log_scale)  # 1/tau, learned
        labels = np.arange(N)
        loss = (cross_entropy(S, labels)
                + cross_entropy(S.T, labels)) / 2
      `,
      codeTitle: 'clip_loss.py',
      terms: [
        [String.raw`\symz_i`, 'the embedding of image $i$, unit length'],
        [String.raw`\symt_j`, 'the embedding of caption $j$, unit length, in the same space'],
        [String.raw`\operatorname{CE}(\symS, \symy)`, 'cross-entropy over each row: for each image, which caption is its own?'],
        [String.raw`\operatorname{CE}(\symS^{\top}, \symy)`, 'the same over each column: for each caption, which image is its own?'],
        [String.raw`\symtau`, 'the temperature, learned as a parameter (as $\\log(1/\\symtau)$), starting at 0.07'],
      ],
      explain: `This follows the pseudocode in the CLIP paper almost line for line. CLIP's batch was 32,768 pairs, so each image chose its caption out of 32,768. The temperature is learned rather than tuned, and clipped so that $1/\\symtau$ never exceeds 100. CLIP's authors first tried predicting the exact caption with a language model; it learned to recognize ImageNet classes three times more slowly than predicting a bag of the caption's words, and the contrastive loss was four times more efficient again. Matching is easier than generating, and it is what classification needs.`,
    });

    const clip = figClip(p);

    p.prose(`
### Zero-shot classification

Once images and text share a space, a classifier needs no training. To sort images into classes, write one sentence per class, "a photo of a dog", "a photo of a cat", embed the sentences with the text encoder, and give each image the class whose sentence is most similar. The text embeddings play the role of the weight rows $W$ of a [linear classifier](#/linear-classification); you just wrote the weights in English.`);

    p.math({
      label: 'Zero-shot classification',
      tex: String.raw`\hat{c} = \arg\max_{c}\; \symz \cdot \symt_c, \qquad \symt_c = \text{text\_enc}(\text{"a photo of a } c\text{."})`,
      code: `
        classes = ["plane", "car", "bird", "cat", "deer"]
        prompts = ["a photo of a %s." % c for c in classes]
        t = normalize(text_encoder(prompts))  # (5, d)
        z = normalize(image_encoder(image))   # (d,)
        pred = classes[np.argmax(t @ z)]      # nearest
      `,
      codeTitle: 'zero_shot.py',
      terms: [
        [String.raw`\symt_c`, 'the embedding of a sentence describing class $c$'],
        [String.raw`\symz \cdot \symt_c`, 'how well the image matches that sentence (a cosine, since both have length 1)'],
        [String.raw`\arg\max_c`, 'pick the class with the highest score'],
      ],
      explain: `"Zero-shot" means zero training examples of these classes: the classifier is assembled from text at test time, for any list of classes you can name. CLIP's best model classified ImageNet this way at 76.2% top-1, matching the original supervised ResNet-50 without using any of ImageNet's 1.28 million labeled training images.`,
    });

    figZeroShot(p, clip);

    p.prose(`
Real prompts are sensitive to wording, because captions on the web are rarely a bare word. On ImageNet, the template "a photo of a {label}." beat the bare class name by 1.3 points, and averaging the text embeddings of 80 different templates ("a bad photo of a {label}.", "a sculpture of a {label}.", and so on) gained another 3.5. This **prompt engineering** is the text-side version of choosing a classifier's features.

Zero-shot CLIP also degraded far less than ImageNet-trained models on shifted test sets such as sketches and renditions of the same classes, presumably because its training text described images of every style. And its embeddings became infrastructure. DALL-E 2 (2022) generates images from CLIP image embeddings, Stable Diffusion conditions its denoiser on CLIP's text encoder ([diffusion](#/diffusion)), and many vision-language chat models feed a CLIP image encoder's output into a language model. Later variants changed the data (ALIGN, 2021, with 1.8 billion noisier pairs) and the loss (SigLIP, 2023, which replaces the batch softmax with an independent yes-or-no sigmoid for every image-caption pair, so no all-to-all normalization is needed).`);

    p.h2('Masked autoencoders', 'mae');
    p.prose(`
Contrastive learning describes images by what survives augmentation. The second family goes back to the autoencoder idea of [CS231n](#/unsupervised), reconstruct the input, and borrows a trick from BERT: hide part of the input and predict it.

**MAE** (He, Chen, Xie, Li, Dollár and Girshick, 2021) cuts the image into patches, as a [ViT](#/vit) does, and hides a random **75%** of them. A ViT **encoder** sees only the visible quarter: no placeholders, just those patches with their position embeddings. A small **decoder** then gets the encoded visible patches plus a shared, learned "mask token" at every hidden position, and predicts the pixels of every hidden patch. The loss is the mean squared error on the hidden patches only.

Why so much? BERT hides 15% of words, but a word carries a lot of meaning and is hard to guess. Images are highly redundant: a hidden patch usually looks like its neighbors, so with little masked the task can be solved by interpolation, which teaches nothing about objects. At 75%, it cannot.`);

    p.math({
      label: 'MAE loss: error on the hidden patches only',
      tex: String.raw`\symL = \frac{1}{|M|} \sum_{p \in M} \big\lVert \hat{\symx}_p - \symx_p \big\rVert^2`,
      code: `
        ids = np.argsort(np.random.rand(196))  # shuffle
        keep, masked = ids[:49], ids[49:]   # 25% visible
        h = encoder(patches[keep] + pos[keep])  # 49 tokens
        pred = decoder(h, ids)    # mask tokens fill gaps
        err = (pred[masked] - patches[masked]) ** 2
        loss = err.mean()
      `,
      codeTitle: 'mae.py',
      terms: [
        [String.raw`M`, 'the set of hidden patches: 147 of the 196 patches of a 224 × 224 image'],
        [String.raw`\symx_p`, 'the true pixels of patch $p$ (16 × 16 × 3 = 768 numbers); MAE works better when each patch is normalized to mean 0 and variance 1 first'],
        [String.raw`\hat{\symx}_p`, "the decoder's prediction for patch $p$"],
        [String.raw`\lVert\cdot\rVert^2`, 'squared error, summed over the pixels of the patch'],
      ],
      explain: `Visible patches get no loss: copying them is trivial. The design also saves compute: the encoder, which is the big network, processes only a quarter of the tokens, and [attention's](#/transformer) cost grows with the square of the token count, so MAE trained about three times faster or more. After pretraining the decoder is discarded and the encoder is kept.`,
    });

    figMAE(p);

    p.prose(`
MAE's features are a different flavor from contrastive ones. Under a plain linear probe they are weaker: nothing in the loss asks for categories to be linearly separable. But fine-tuned, they are excellent, and they scale well with model size: a ViT-Huge pretrained with MAE reached 87.8% on ImageNet after fine-tuning, the best result at the time among methods using only ImageNet's own images. BEiT (2021) had taken the BERT analogy more literally, predicting discrete visual tokens instead of pixels; MAE showed that plain pixels work.`);

    p.h2('DINO: self-distillation without labels', 'dino');
    p.prose(`
The third family has no negatives and no reconstruction. **DINO** (Caron and colleagues, 2021; the name comes from *self-distillation with no labels*) trains a **student** network to match the output of a **teacher** network on a different view of the same image. The teacher has the same architecture, and its weights are a momentum moving average of the student's, as in MoCo. Nobody provides a correct output: the teacher is just a slower, smoother version of the student, and the student learns to agree with it.

Both networks end in a head with $K$ outputs (65,536 in the paper), turned into a probability distribution by a softmax. Think of the outputs as soft cluster assignments that the method invents. DINO also uses **multi-crop**: two large "global" crops and several small "local" crops of each image. The teacher sees only the global crops; the student sees all of them, so it has to recognize the whole from a part.

With nothing like the InfoNCE denominator, what stops collapse? Two cheap operations on the teacher's output:

- **Centering**: subtract a running average $c$ of the teacher's outputs. If one output dimension starts to win for every image, its average grows and centering cancels the advantage.
- **Sharpening**: use a low temperature for the teacher ($\\symtau_t$ around 0.04 to 0.07) and a higher one for the student ($\\symtau_s = 0.1$), so the teacher's targets are always more decisive than the student's guesses.`);

    p.callout('math', `For two probability distributions $P$ and $Q$ over the same $K$ outcomes, the **cross-entropy** $H(P, Q) = -\\sum_k P_k \\log Q_k$ is the loss you get for predicting $Q$ when the truth is distributed as $P$. With a one-hot $P$ (a label) it is the familiar $-\\log Q_{\\text{label}}$. The **entropy** $H(P, P)$ measures how spread out $P$ is: 0 for a one-hot distribution, $\\log K$ for a uniform one. DINO's loss is a cross-entropy whose "truth" is the teacher's soft output.`, 'Math help: cross-entropy and entropy');

    p.math({
      label: 'DINO loss with centering and sharpening',
      tex: String.raw`\symL = -\sum_{k=1}^{K} P_t^{(k)} \log P_s^{(k)}, \quad P_t = \operatorname{softmax}\!\Big(\frac{g_t(\symx_1) - c}{\symtau_t}\Big), \quad P_s = \operatorname{softmax}\!\Big(\frac{g_s(\symx_2)}{\symtau_s}\Big)`,
      code: `
        pt = softmax((gt(x1) - center) / 0.04)   # teacher
        ps = softmax(gs(x2) / 0.1)               # student
        loss = -(pt * np.log(ps)).sum(axis=1).mean()
        # after the step: gt = m * gt + (1 - m) * gs  (EMA)
        center = 0.9 * center + 0.1 * gt(x1).mean(axis=0)
      `,
      codeTitle: 'dino_loss.py',
      terms: [
        [String.raw`g_t,\ g_s`, 'teacher and student: the same network, the teacher\'s weights a moving average of the student\'s'],
        [String.raw`\symx_1,\ \symx_2`, 'two views of the same image; the teacher gets a global one'],
        [String.raw`c`, 'the center: a running mean of the teacher\'s outputs over batches, subtracted before the softmax'],
        [String.raw`\symtau_t < \symtau_s`, 'sharpening: the teacher\'s softmax is more peaked than the student\'s'],
        [String.raw`-\sum_k P_t^{(k)} \log P_s^{(k)}`, "cross-entropy: the student is graded against the teacher's distribution"],
      ],
      explain: `No gradient flows into the teacher; it changes only through the moving average, which (unusually) makes the teacher the *better* network during training, like an ensemble of recent students. The two tricks pull in opposite directions. Centering alone pushes every output toward uniform, which carries no information. Sharpening alone lets one dimension win everywhere. Balanced, they leave the teacher confident about each image but using all its dimensions across images.`,
    });

    figDino(p);

    p.prose(`
DINO's ViTs had a striking property: the attention maps of the class token in the last layer outline the main object in an image, foreground against background, although no segmentation, box or label was ever used. Its features also work unusually well with nearest neighbors, and a ViT-Base trained with DINO reached 80.1% on ImageNet with a linear probe. **DINOv2** (Oquab and colleagues, 2023) scaled the recipe to a curated set of 142 million images and produced general-purpose image features that are used frozen, the way CLIP's are, for depth estimation, segmentation and retrieval.`);

    p.h2('The families side by side', 'families');
    p.table(
      ['Method', 'Learns by', 'Prevents collapse with', 'Headline result'],
      [
        ['SimCLR (2020)', 'matching two augmented views', 'negatives from a batch of 4,096', '76.5% linear probe on ImageNet (ResNet-50, 4× wide)'],
        ['MoCo (2019), v2 (2020)', 'matching a query to its key', 'negatives from a queue of 65,536, momentum encoder', 'v2 beat SimCLR with batches of 256'],
        ['CLIP (2021)', 'matching images to their captions', 'negatives from a batch of 32,768', '76.2% zero-shot on ImageNet'],
        ['MAE (2021)', 'rebuilding the hidden 75% of patches', 'nothing to collapse: pixels are the target', '87.8% on ImageNet after fine-tuning (ViT-Huge)'],
        ['DINO (2021)', 'matching a moving-average teacher', 'centering and sharpening', '80.1% linear probe on ImageNet (ViT-Base)'],
      ],
      { caption: 'Results are the headline numbers reported in each paper\'s abstract or main results. MoCo appeared on arXiv in late 2019 and at CVPR in 2020.' },
    );

    p.prose(`
The families also produce different features. Contrastive and distillation methods learn features in which categories are already linearly separable, good for probes, retrieval and nearest neighbors. Masked modeling learns features that need fine-tuning but transfer well to dense tasks and grow with model size. CLIP adds the thing the others lack: a connection to language, which turns its features into classifiers, search engines and the conditioning signal of image generators. Later systems often combine them (iBOT and DINOv2 mix masking into self-distillation).`);

    p.callout('idea', `
- Self-supervised learning makes its own targets. Its features are graded with a **linear probe**: freeze the encoder, train only a linear classifier.
- Contrastive learning treats every image as its own class. Two augmented views should match; the augmentations decide what the features ignore.
- **InfoNCE** is softmax cross-entropy over the batch similarity matrix $\\symS$, with the diagonal as targets $\\symy$. The temperature $\\symtau$ decides how much the hardest negatives dominate.
- Without negatives (or another trick), the loss is minimized by **collapse**: one point for every input.
- **SimCLR** gets negatives from huge batches and adds a projection head; **MoCo** keeps a queue of keys from a slowly moving encoder ($\\symm$ near 1).
- **CLIP** applies the symmetric InfoNCE to 400 million image-text pairs. A shared space makes **zero-shot** classification possible: the class prompts are the classifier.
- **MAE** hides 75% of patches and reconstructs pixels; **DINO** distills a moving-average teacher and avoids collapse by centering and sharpening.`, 'Takeaways');

    p.h2('Build it yourself', 'exercises');
    p.prose(`
1. **InfoNCE in NumPy (10 minutes).** Write \`info_nce(z1, z2, tau)\` from the equation above, with the max-subtraction for stability. Check three cases: all embeddings identical (the loss should be exactly $\\log N$), \`z2 = z1\` with orthogonal rows and $\\symtau$ = 0.05 (near 0), and \`z2\` a random permutation of \`z1\` (large). Then check the gradient formula numerically. *Success:* all three values match your predictions and the analytic gradient agrees with finite differences to 5 digits.
2. **Temperature and hard negatives.** Fix one anchor and 63 negatives on the unit sphere in 16 dimensions, at a spread of cosine similarities. For $\\symtau$ in 0.02, 0.07, 0.2, 0.5 and 1, plot the share of the total push (the softmax weights of the negatives) received by the 5 most similar ones. *Success:* a plot showing the push concentrating on the hardest negatives as $\\symtau$ shrinks, and a sentence on what too small a $\\symtau$ would do to two genuinely similar images.
3. **SimCLR on CIFAR-10 (a project, needs a GPU).** In PyTorch, train a ResNet-18 with the NT-Xent loss, the augmentations of the first figure, a 2-layer projection head, a batch of 256 to 512 and $\\symtau$ = 0.5, for 100 epochs. Then fit a linear probe on the frozen features, before the head, and on the features after it. Retrain once without color jitter. *Success:* the probe beats the same probe on a randomly initialized ResNet-18 by a wide margin, the features before the head beat those after it, and removing color jitter costs accuracy.
4. **Zero-shot with a real CLIP.** With the \`open_clip\` or Hugging Face \`transformers\` package and a public CLIP checkpoint, classify the CIFAR-10 test set zero-shot with three prompt sets: the bare class names, "a photo of a {c}.", and the average embedding of five templates of your choice. *Success:* a table of three accuracies, plus the confusion matrix of the best one and an explanation of its most common mistake.
5. **Masking, patchify and a tiny MAE.** Write \`patchify\` and \`unpatchify\` for 32 × 32 images with 4 × 4 patches and check that they round-trip exactly; implement random masking with \`argsort\` as in the MAE listing. Then, in PyTorch, train a 4-block ViT encoder with a 2-block decoder on CIFAR-10 at mask ratios 0.25 and 0.75, and compare their encoders by fine-tuning or a linear probe. *Success:* reconstructions that are blurry but recognizable at 75%, and a measured answer to which ratio gave the better encoder at your scale.`);
  },
};

export default chapter;
