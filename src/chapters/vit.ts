import type { ChapterDef } from './index';
import { VIT_SYMBOLS } from '../lib/vit-symbols';
import { installCss } from '../lib/vit-draw';
import { figClsAttention, figPatches, figPosSimilarity, figTokens } from '../lib/vit-figs';
import { figDistance, figShift, figShuffle, figSwin } from '../lib/vit-figs2';

const chapter: ChapterDef = {
  symbols: VIT_SYMBOLS,

  render(p) {
    installCss(p.root);

    p.prose(`
In [the ConvNets chapter](#/convnets), every design choice encoded a belief about images. A filter looks at a small neighborhood, because nearby pixels belong together. The same filter slides over every position, because a cat's ear is a cat's ear wherever it appears. Those beliefs made ConvNets the default for vision from 2012 on. Meanwhile [the Transformer](#/transformer) took over language with one generic operation, self-attention, that assumes almost nothing about its input.

In October 2020, Alexey Dosovitskiy and colleagues at Google asked the blunt question: what happens if you feed an image to a standard Transformer, changing as little as possible? Their **Vision Transformer** (ViT) answers in its title, *An Image is Worth 16x16 Words*: cut the image into 16 × 16 squares, treat each square as a word, and run the same encoder BERT uses. Given enough training data, it matched or beat the best ConvNets of the time.

This chapter builds ViT piece by piece on real CIFAR-10 images and looks inside a tiny trained one. Then it asks the question that makes the story interesting: what did ViT give up by throwing away the ConvNet's beliefs, and how did later work (DeiT, Swin) win some of it back?`);

    // -------------------------------------------------------------------------------
    p.h2('From pixels to patches', 'patches');
    p.prose(`
A transformer reads a sequence of vectors. The most literal way to turn an image into a sequence is to make every pixel a token. That fails on cost: self-attention compares every token with every other one, so its work grows with the *square* of the sequence length. A 224 × 224 photo has 50,176 pixels, which makes about 2.5 billion pairs per layer. Pixel-level transformers were tried, but only on small images (Image GPT, also 2020, worked at 64 × 64 and below).

ViT groups the pixels first. Cut the image into a grid of non-overlapping $\\symP \\times \\symP$ squares, the **patches**, read them in order like words on a page, and unroll each one into a single row of numbers.`);

    p.math({
      label: 'Patches: how many, and how long',
      tex: String.raw`N = \frac{H\,W}{\symP^{2}}, \qquad \symxp \in \mathbb{R}^{N \times (\symP^{2} \cdot C)}`,
      code: `
        H, W, C, P = 224, 224, 3, 16
        N = (H * W) // P**2      # 196 patches, a 14 x 14 grid
        patch_len = P * P * C    # 768 numbers per patch
        N * N                    # 38,416 attention pairs
        (H * W) ** 2             # 2,517,630,976 with pixels
      `,
      codeTitle: 'patch_count.py',
      terms: [
        [String.raw`H, W`, 'the image height and width in pixels'],
        [String.raw`\symP^{2}`, 'pixels in one patch: a $\\symP \\times \\symP$ square'],
        [String.raw`N`, 'how many patches fit: the length of the sequence the transformer reads'],
        [String.raw`\symP^{2} \cdot C`, 'numbers in one patch: every pixel brings $C$ = 3 color values'],
        [String.raw`\symxp \in \mathbb{R}^{N \times (\symP^2 C)}`, '$\\mathbb{R}^{a \\times b}$ means a grid of real numbers with $a$ rows and $b$ columns. So the patches form a matrix with one row per patch'],
      ],
      explain: `With 16 × 16 patches, a 224 × 224 image becomes 196 tokens of 768 numbers each, a sequence as long as a long paragraph of text, and attention costs 65,000 times less than with pixels. The patch size is a dial. Halving it quadruples $N$ and multiplies the attention work by 16, but each token sees finer detail. Model names record the choice: ViT-B/16 is the Base model with $\\symP$ = 16, ViT-H/14 the Huge model with $\\symP$ = 14 (256 patches).`,
    });

    figPatches(p);

    // -------------------------------------------------------------------------------
    p.h2('Patches become tokens', 'tokens');
    p.prose(`
A patch is now a row of $\\symP^2 C$ numbers, but the transformer wants rows of its own width $\\symD$. One learned matrix $\\symE$, of shape $(\\symP^2 C) \\times \\symD$, maps every patch to a $\\symD$-long vector: its **token** (the paper says *patch embedding*). Two more learned pieces complete the input.

- A **class token** $\\symcls$ goes in front of the patches. It is borrowed from BERT's \`[CLS]\` token ([pretraining](#/pretraining)): it has no pixels of its own, and its state after the last layer will hold the answer.
- **Position embeddings** $\\symEpos$, one learned vector per slot, are added to the tokens, because attention by itself has no idea where a patch came from (more on that below).`);

    p.math({
      label: 'The input sequence (ViT, equation 1)',
      tex: String.raw`\symz_0 = \big[\,\symcls;\; \symxp^{1}\symE;\; \symxp^{2}\symE;\; \dots;\; \symxp^{N}\symE\,\big] + \symEpos`,
      code: `
        tokens = patches @ E          # (N, P*P*C) @ (P*P*C, D)
        z0 = np.vstack([cls, tokens]) # (N + 1, D), class first
        z0 = z0 + E_pos               # (N + 1, D)
      `,
      codeTitle: 'vit_input.py',
      terms: [
        [String.raw`\symxp^{j}`, 'patch $j$, flattened into one row of $\\symP^2 C$ numbers'],
        [String.raw`\symxp^{j}\symE`, 'that row times the matrix $\\symE$: $\\symD$ numbers, the token for patch $j$. Every patch uses the same $\\symE$'],
        [String.raw`\symcls`, 'the class token: $\\symD$ learned numbers, identical for every image'],
        [String.raw`[\,a;\; b;\; \dots]`, 'stack the vectors as the rows of one matrix, here $N + 1$ rows'],
        [String.raw`\symEpos`, '$N + 1$ learned rows, one per slot, added element by element'],
        [String.raw`\symz_0`, 'the sequence the encoder reads; the 0 means "before layer 1"'],
      ],
      explain: `Nothing here knows it is looking at an image, apart from the cutting. The class token and the position embeddings start as random numbers and are trained by backpropagation like any other weight. For ViT-Base, a patch has $16 \\cdot 16 \\cdot 3 = 768$ numbers and the model width is also 768, so $\\symE$ happens to be square.`,
    });

    p.prose(`Multiplying every patch by the same matrix is an operation you have met before. Each column of $\\symE$ has one weight per pixel value of a patch, so it can be folded back into a $\\symP \\times \\symP \\times C$ filter, and the token's numbers are those filters' responses to the patch:`);

    p.math({
      label: 'The patch embedding is a convolution',
      tex: String.raw`\symxp\,\symE \;=\; \operatorname{conv}\!\big(x;\ \text{filters} = \symE,\ \text{size} = \symP,\ \text{stride} = \symP\big)`,
      code: `
        filt = E.T.reshape(D, P, P, C)  # column k -> filter k
        out = np.zeros((H // P, W // P, D))
        for r in range(H // P):
            for s in range(W // P):
                win = img[r*P:(r+1)*P, s*P:(s+1)*P]  # one patch
                out[r, s] = np.tensordot(filt, win, 3)
        np.allclose(out.reshape(N, D), patches @ E)  # True
      `,
      codeTitle: 'patch_conv.py',
      terms: [
        [String.raw`\text{filters} = \symE`, '$\\symD$ filters, each one column of $\\symE$ reshaped to $\\symP \\times \\symP \\times C$'],
        [String.raw`\text{size} = \symP`, 'each filter covers exactly one patch'],
        [String.raw`\text{stride} = \symP`, 'it jumps a whole patch at a time, so the windows never overlap ([output sizes](#/convnets/arrangement))'],
      ],
      explain: `This is why ViT code builds the patch embedding as \`Conv2d(3, D, kernel_size=P, stride=P)\`. It also shows how little ViT keeps from ConvNets: a single convolution, with no overlap, at the very bottom. Everything above it is attention and per-token MLPs.`,
    });

    figTokens(p);

    // -------------------------------------------------------------------------------
    p.h2('A standard transformer encoder', 'encoder');
    p.prose(`
From here on, ViT is the encoder from [the Transformer chapter](#/transformer), unchanged. Recall what one self-attention layer does: every token computes a query, a key and a value, and each token's output is an average of all the values, weighted by a softmax over how well its query matches each key. Several heads do this in parallel with their own projections, and their outputs are concatenated and projected back to width $\\symD$.

The block wraps attention and a small MLP in residual connections, with layer norm *before* each one (the pre-norm arrangement of [the modern block](#/modern-transformer)), and the MLP uses the GELU nonlinearity, a smooth cousin of ReLU.`);

    p.math({
      label: 'The encoder block (ViT, equations 2 and 3)',
      tex: String.raw`\begin{aligned} \sym{z}{z'_{\ell}} &= \operatorname{MSA}\big(\operatorname{LN}(\sym{z}{z_{\ell-1}})\big) + \sym{z}{z_{\ell-1}} \\ \sym{z}{z_{\ell}} &= \operatorname{MLP}\big(\operatorname{LN}(\sym{z}{z'_{\ell}})\big) + \sym{z}{z'_{\ell}} \end{aligned}`,
      code: `
        def block(z):                     # z: (N + 1, D)
            z = z + msa(layer_norm(z))    # tokens exchange info
            z = z + mlp(layer_norm(z))    # each token on its own
            return z

        z = z0
        for l in range(L):                # L = 12 for ViT-Base
            z = block(z)
      `,
      codeTitle: 'encoder.py',
      terms: [
        [String.raw`\ell`, 'the layer number, from 1 to $L$'],
        [String.raw`\operatorname{LN}`, 'layer norm: shift and rescale each token to mean 0 and spread 1, then apply a learned scale and shift'],
        [String.raw`\operatorname{MSA}`, 'multi-head self-attention: the only step where tokens read from each other'],
        [String.raw`\operatorname{MLP}`, 'two linear layers with a GELU between them, applied to each token separately'],
        [String.raw`+\,\sym{z}{z_{\ell-1}}`, 'the residual connection: the block adds a correction to its input instead of replacing it'],
      ],
      explain: `Two facts matter for images. Attention is the only place where patches interact, and from layer 1 on it can connect any two patches, however far apart they are. Everything else, the layer norms and the MLP, treats each token alone and identically, whatever slot it sits in.`,
    });

    p.math({
      label: 'Reading out the class (ViT, equation 4)',
      tex: String.raw`y = \operatorname{LN}\big(\sym{z}{z_{L}^{0}}\big), \qquad \text{scores} = y\,W_{\text{head}}`,
      code: `
        y = layer_norm(z[0])     # the class token, after layer L
        scores = y @ W_head      # (D,) @ (D, 10): 10 scores
        loss = softmax_loss(scores, label)
      `,
      codeTitle: 'head.py',
      terms: [
        [String.raw`\sym{z}{z_{L}^{0}}`, 'row 0, the class token, after the last layer $L$'],
        [String.raw`y`, 'the image representation: one vector of $\\symD$ numbers'],
        [String.raw`W_{\text{head}}`, 'a [linear classifier](#/linear-classification) on top, trained with the usual softmax cross-entropy'],
      ],
      explain: `The class token starts as the same vector for every image and, layer by layer, reads from the patches through attention, until it holds whatever the classifier needs. Averaging all the patch tokens instead works about as well (the ViT paper found the two similar, once each had its own learning rate); the class token is the BERT habit.`,
    });

    p.table(
      ['Model', 'Layers $L$', 'Width $\\symD$', 'MLP width', 'Heads', 'Parameters'],
      [
        ['ViT-Base', '12', '768', '3,072', '12', '86 M'],
        ['ViT-Large', '24', '1,024', '4,096', '16', '307 M'],
        ['ViT-Huge', '32', '1,280', '5,120', '16', '632 M'],
        ['this chapter\'s tiny ViT', '6', '64', '256', '4', '0.3 M'],
      ],
      { caption: 'The ViT family (Dosovitskiy et al., 2020). Base and Large copy BERT\'s sizes. The patch size is chosen separately: ViT-L/16 is the Large model on 16 × 16 patches.' },
    );

    p.callout('aside', `The figures from here on use a tiny ViT: equations 1 to 4 with $\\symP$ = 4 (so a 32 × 32 CIFAR-10 image becomes 64 patches of 48 numbers), $\\symD$ = 64, six blocks of four heads, about 300,000 parameters. It was trained for 60 epochs on CIFAR-10's 50,000 training images, with random shifts of up to 4 pixels and random horizontal flips, and classifies **81%** of CIFAR-10's 10,000 test images correctly. A second copy, identical except that it never had position embeddings, gets **73%**. The images shown come from CIFAR-10's test set, which neither model saw during training.`, 'The tiny ViT in these figures');

    // -------------------------------------------------------------------------------
    p.h2('Where the class token looks', 'cls-attention');
    p.prose(`
Each layer's attention weights $\\symA$ form a $(N + 1) \\times (N + 1)$ table: row $i$ says how much token $i$ takes from each token, and every row adds up to 1. Row 0 belongs to the class token, so laying its 64 patch entries back on the 8 × 8 grid shows where, in that layer, the class token gathered its information.

One layer tells only part of the story, because what a patch token hands over in layer 5 has itself been mixed from other patches in layers 1 to 4. **Attention rollout** (Abnar and Zuidema, 2020) estimates the total flow by multiplying the layers' attention tables together, counting the residual connection as half of every step. It is the method the ViT paper used for its attention pictures.`);

    figClsAttention(p);

    p.callout('warning', `Attention maps are evidence, not explanations. They show where information was read from, not what the network did with it, and the half-identity in rollout is a rule of thumb rather than a derivation. Treat a map that lands on the object as a sanity check, and a map that does not as a puzzle, not as proof of anything.`, 'Reading attention maps');

    // -------------------------------------------------------------------------------
    p.h2('Positions are learned, not given', 'positions');
    p.prose(`
Here is a strange property of the encoder. Attention computes its weights from dot products between tokens, and the MLP and layer norms treat every token alike. Nothing in that computation looks at *which slot* a token is in. Shuffle the patch tokens, and every output is shuffled the same way, but otherwise unchanged; the class token, which never moved, comes out exactly the same.`);

    p.math({
      label: 'Without positions, the encoder sees a set',
      tex: String.raw`\operatorname{Enc}\big(\Pi\,\symz_0\big) = \Pi\,\operatorname{Enc}(\symz_0)`,
      code: `
        perm = np.random.permutation(N)
        out1 = encoder(z0)[1:][perm]      # encode, then shuffle
        z0s = np.vstack([z0[:1], z0[1:][perm]])
        out2 = encoder(z0s)[1:]           # shuffle, then encode
        np.allclose(out1, out2)           # True without E_pos
        np.allclose(encoder(z0)[0], encoder(z0s)[0])  # cls: True
      `,
      codeTitle: 'permutation.py',
      terms: [
        [String.raw`\Pi`, 'any reordering (a *permutation*) of the patch tokens; the class token stays in front'],
        [String.raw`\operatorname{Enc}`, 'the whole stack of encoder blocks'],
        [String.raw`\Pi\,\operatorname{Enc}(\symz_0)`, 'encode first, then apply the same reordering to the outputs'],
      ],
      explain: `"Reorder, then encode" equals "encode, then reorder": the encoder is *permutation equivariant*. So without $\\symEpos$, a ViT is a bag-of-patches model. It can still learn a lot from which colors and textures are present, but nothing about where they are. The position embeddings break the symmetry: each slot adds its own vector, so the same patch in two slots becomes two different tokens.`,
    });

    figShuffle(p);

    p.prose(`
ViT's position embeddings are just one learned vector per slot. They start random, and the model is never told that slot 9 sits right below slot 1. Whatever the vectors end up encoding about the grid, training had to discover. Comparing them with each other shows what it found.`);

    figPosSimilarity(p);

    p.prose(`
The ViT paper reported the same picture for its large models, and also tried telling the model about the grid directly, with 2-D embeddings (a row vector plus a column vector) or embeddings of relative offsets. Neither did measurably better than plain learned 1-D embeddings, while having no position embeddings at all cost a few points of accuracy. Learned positions have one practical wrinkle: they exist only for the grid size used in training. To fine-tune at a higher resolution, ViT keeps the patch size, so the grid grows, and fills in the new slots by 2-D interpolation of the trained embeddings, one of only two places where the model is told the patches form a 2-D grid. (The first is cutting the image into patches.)`);

    // -------------------------------------------------------------------------------
    p.h2('Inductive bias: what ViT gives up', 'inductive-bias');
    p.prose(`
Every learning algorithm prefers some solutions over others before it has seen any data. That preference is its **inductive bias**. A ConvNet's is strong and specific to images, built into every layer:

- **Locality.** A 3 × 3 filter sees a 3 × 3 neighborhood. Distant pixels can only interact after many layers ([receptive fields](#/convnets/architectures)).
- **Weight sharing.** One filter is reused at every position, so a feature learned in one corner works everywhere.
- **Translation equivariance.** As a consequence: shift the image, and the feature maps shift with it.

ViT keeps almost none of this. Its MLP is shared across positions, but attention is global from the first layer, and the position embeddings start out knowing nothing about the grid. Locality, nearness and the meaning of a shift all have to be learned from data.`);

    p.math({
      label: 'Translation equivariance',
      tex: String.raw`\operatorname{conv}\big(\operatorname{shift}_s(x)\big) = \operatorname{shift}_s\big(\operatorname{conv}(x)\big)`,
      code: `
        x2 = np.roll(img, s, axis=1)        # slide right by s px
        f1 = conv(gray(img), w)             # wrap-around padding
        f2 = conv(gray(x2), w)
        np.allclose(f2, np.roll(f1, s, axis=1))   # True, any s
      `,
      codeTitle: 'equivariance.py',
      terms: [
        [String.raw`\operatorname{shift}_s(x)`, 'the image moved $s$ pixels to the right; here it wraps around, so nothing falls off the edge'],
        [String.raw`\operatorname{conv}`, 'a convolution with one fixed filter, the same at every position'],
        [String.raw`=`, 'shifting first and filtering second gives the same result as filtering first and shifting second'],
      ],
      explain: `Because the filter is the same everywhere, moving the input just moves where each response appears. Equivariance holds for every conv layer, so it holds for a stack of them, and pooling then turns it into approximate *invariance*: the class does not change when the object moves. ViT has it only in a weak form: a shift by an exact multiple of $\\symP$ moves whole patches to new slots, and even then the new slots add different position embeddings.`,
    });

    figShift(p);

    p.prose(`
Locality is the other thing ViT must learn. A useful measurement, introduced in the ViT paper, is each head's **mean attention distance**: how far, in pixels, a head typically reaches. It plays the role of a receptive field.`);

    p.math({
      label: 'Mean attention distance of one head',
      tex: String.raw`\bar d_{\ell,h} = \frac{1}{N}\sum_{i=1}^{N}\sum_{j=1}^{N} \tilde{\symA}_{ij}\,\big\lVert c_i - c_j \big\rVert`,
      code: `
        W = A[l, h, 1:, 1:]       # patch queries, patch keys
        W = W / W.sum(axis=1, keepdims=True)  # rows sum to 1
        dist = np.linalg.norm(c[:, None] - c[None], axis=2)
        d = (W * dist).sum(axis=1).mean()     # pixels
      `,
      codeTitle: 'distance.py',
      terms: [
        [String.raw`\tilde{\symA}_{ij}`, 'how much patch $i$ takes from patch $j$ in layer $\\ell$, head $h$ (class token left out, each row rescaled to sum to 1)'],
        [String.raw`c_i`, 'the pixel coordinates of the center of patch $i$'],
        [String.raw`\lVert c_i - c_j \rVert`, 'the straight-line distance between two patch centers, in pixels'],
        [String.raw`\frac{1}{N}\sum_i`, 'average over all $N$ patches as the query'],
      ],
      explain: `A head that attends only to its own patch scores 0; one that spreads attention evenly over the image scores the average distance between two patches. The paper averages this over many images, for every head in every layer.`,
    });

    figDistance(p);

    p.prose(`
In the ViT paper's analysis of ViT-L/16, the lowest layers held a mix: some heads already attended across most of the image, showing that the global reach is really used, while others stayed consistently local, much like a ConvNet's early filters. Such local heads were less common in hybrid models with a ResNet in front, which suggests they do the job early convolutions would otherwise do. And attention distance grew with depth, the way receptive fields grow in a ConvNet. The tiny model above shows only a faint version of this. Its most local heads sit in layer 2, and from there the distance grows layer by layer, but every head stays fairly close to the uniform line: it never learned sharply local heads. Its size and its 32 × 32 images play a part, and so, plausibly, does its training set of only 50,000 images, the data-hungry side of a weak inductive bias.`);

    // -------------------------------------------------------------------------------
    p.h2('Bias against data', 'data');
    p.prose(`
A strong inductive bias is a head start. If the assumptions are right, the model does not have to learn them, so it needs less data. If they are slightly wrong, they become a ceiling: a model that cannot express something will never learn it, however much data arrives. A weak bias reverses both: more data is needed, and more can be gained from it.

ViT made this trade visible. The paper pretrained models of each size on three datasets of growing size, then fine-tuned and tested them on ImageNet, comparing against Big Transfer (BiT) ResNets trained the same way:`);

    p.table(
      ['Pretraining data', 'Images', 'Classes', 'What happened'],
      [
        ['ImageNet', '1.3 M', '1,000', 'ResNets ahead; ViT-Large did *worse* than ViT-Base despite regularization'],
        ['ImageNet-21k', '14 M', '21,000', 'roughly level; the larger ViTs catch up with the smaller'],
        ['JFT-300M', '303 M', '18,000', 'ViT ahead, and the biggest ViTs gain the most'],
      ],
      { caption: 'Qualitative results from Dosovitskiy et al. (2020), figures 3 and 4. JFT-300M is Google\'s internal dataset. Subsets of it (9, 30, 90 and 300 million images) told the same story: ResNets better on the smaller subsets, ViT better on the larger.' },
    );

    p.prose(`
At the top of that curve, ViT-H/14 pretrained on JFT-300M reached 88.55% top-1 accuracy on ImageNet, level with the best ConvNets of the time, using substantially less compute to pretrain. The paper's conclusion was that convolution's built-in bias is useful for smaller datasets, but for larger ones, learning the relevant patterns directly from data is enough, and even better.

### DeiT: ViT on ImageNet alone

That conclusion left a practical problem: few people have 300 million labeled images. Two months later, Touvron and colleagues at Facebook AI showed with **DeiT** (*data-efficient image transformers*, December 2020) that a ViT trained on ImageNet-1k alone, on a single 8-GPU machine in under three days, could compete with ConvNets of similar speed. The architecture was essentially ViT-B (plus smaller versions). What changed was the training:

- **heavy data augmentation**: RandAugment, Mixup and CutMix (blending images and their labels), random erasing, and repeated augmentation;
- **regularization**: stochastic depth (randomly skipping blocks during training), label smoothing, and AdamW with weight decay, for 300 epochs;
- **distillation through attention**: a second learned token beside the class token, trained to agree with a teacher network.

Augmentation is inductive bias delivered through data instead of architecture. Training on shifted, flipped and recolored copies tells the model that those changes do not alter the class, which is exactly what a ConvNet's design assumes. (A 2021 study by Steiner and colleagues found that ViTs trained with the right augmentation and regularization, and enough compute, can match ViTs trained on about ten times more data.)`);

    p.math({
      label: 'DeiT hard-label distillation',
      tex: String.raw`\begin{aligned} \mathcal{L} &= \tfrac{1}{2}\,\mathcal{L}_{\text{CE}}\big(\operatorname{softmax}(s_{\text{cls}}),\ y\big) \\ &+ \tfrac{1}{2}\,\mathcal{L}_{\text{CE}}\big(\operatorname{softmax}(s_{\text{dist}}),\ y_t\big) \end{aligned}`,
      code: `
        s_cls = z[0] @ W_cls          # class token's scores
        s_dist = z[1] @ W_dist        # distillation token's
        y_t = teacher(img).argmax()   # the teacher's guess
        loss = 0.5 * ce(s_cls, y) + 0.5 * ce(s_dist, y_t)
        # at test time: average the two heads' softmaxes
      `,
      codeTitle: 'deit_loss.py',
      terms: [
        [String.raw`s_{\text{cls}}`, 'scores read from the class token, trained on the true label $y$'],
        [String.raw`s_{\text{dist}}`, 'scores read from the distillation token, a second learned token that sits in the sequence beside the class token'],
        [String.raw`y_t = \arg\max_c s^{\text{teacher}}_c`, 'the teacher\'s top guess for this (augmented) image, used as a hard label'],
        [String.raw`\mathcal{L}_{\text{CE}}`, 'the usual softmax cross-entropy loss'],
      ],
      explain: `The student learns half from the dataset's labels and half from what a trained teacher says about each augmented image, which is often more informative: after a crop cuts away the dog, the teacher may rightly say "cat". Taking the teacher's top guess (hard labels) worked better than matching its full probabilities. ConvNet teachers (RegNets) worked better than a transformer teacher, which the authors attributed to the student inheriting the ConvNet's inductive bias through distillation.`,
    });

    // -------------------------------------------------------------------------------
    p.h2('Putting locality back: hybrids and Swin', 'swin');
    p.prose(`
The other route to data efficiency is to put some image structure back into the architecture.

The ViT paper itself tested a **hybrid**: run a ResNet for a few stages and feed its feature map to the transformer, one token per feature-map position. Hybrids did slightly better than plain ViT at small compute budgets; the difference vanished for larger models.

The most influential design of this kind is the **Swin Transformer** (Liu et al., Microsoft Research Asia, 2021), which makes two changes:

- **Windows.** Attention runs only inside non-overlapping windows of $M \\times M$ patches ($M$ = 7). Locality is back, and the cost grows linearly with the number of patches instead of quadratically. To let information cross window borders, every second block **shifts** the window grid by half a window.
- **Hierarchy.** Start from small 4 × 4 patches and, between stages, **merge** each 2 × 2 group of neighboring tokens into one (concatenate their vectors, then a linear layer halves the width). Four stages see the image at 1/4, 1/8, 1/16 and 1/32 resolution, like a ConvNet's pyramid, so Swin slots into detectors and segmenters built for ConvNet backbones ([detection](#/detection)).`);

    p.math({
      label: 'The cost of global and windowed attention (Swin)',
      tex: String.raw`\begin{aligned} \Omega(\text{MSA}) &= 4\,hwC^{2} + 2\,(hw)^{2}C \\ \Omega(\text{W-MSA}) &= 4\,hwC^{2} + 2\,M^{2}\,hwC \end{aligned}`,
      code: `
        h = w = 56; C = 96; M = 7      # Swin-T, first stage
        proj = 4 * h * w * C**2        # 1.2e8: q, k, v, output
        msa = proj + 2 * (h * w)**2 * C      # + 1.9e9, global
        wmsa = proj + 2 * M**2 * h * w * C   # + 3.0e7, windows
      `,
      codeTitle: 'swin_cost.py',
      terms: [
        [String.raw`h\,w`, 'the number of patch tokens: a grid $h$ high and $w$ wide'],
        [String.raw`C`, 'the width of each token (Swin writes $C$ where ViT writes $\\symD$)'],
        [String.raw`4\,hwC^2`, 'the four projections (query, key, value, output): linear in the number of tokens'],
        [String.raw`2\,(hw)^2 C`, 'global attention: every token against every token, so quadratic in the number of tokens'],
        [String.raw`2\,M^2\,hwC`, 'windowed attention: every token against the $M^2$ tokens of its window, so linear'],
      ],
      explain: `These count multiply-adds for one attention layer. At Swin-T's first stage (a 224 × 224 image in 4 × 4 patches: a 56 × 56 grid of 96-wide tokens), global attention would cost 16 times as much as the four projections together; inside windows it costs a quarter of them. The real win comes at high resolution: double the image side and $hw$ quadruples, so global attention costs 16 times more while windowed attention costs 4 times more.`,
    });

    figSwin(p);

    p.prose(`
Swin set new results on COCO object detection and ADE20K segmentation in 2021, and hierarchical, windowed transformers became a standard backbone for dense prediction. The traffic went both ways. In *A ConvNet for the 2020s* (2022), Liu and colleagues at Meta modernized a ResNet step by step with design choices borrowed from transformers (a 4 × 4 patchify stem, large 7 × 7 depthwise filters, layer norm, GELU, fewer normalization and activation layers), and the resulting **ConvNeXt** matched Swin. Much of the original gap, it turned out, came from training recipes and design details rather than from attention itself.

Plain ViTs did not go away either. Given enough data, or a good self-supervised objective, their lack of built-in assumptions is an asset, and the same backbone now appears across vision: as the image encoder in CLIP and masked autoencoders ([self-supervised learning](#/contrastive)) and inside diffusion models ([diffusion transformers](#/diffusion)).`);

    p.callout('idea', `
- **ViT reads an image as a sequence**: cut it into $\\symP \\times \\symP$ patches, project each with one matrix $\\symE$ (a stride-$\\symP$ convolution), put a learned class token $\\symcls$ in front, add learned position embeddings $\\symEpos$, and run an unchanged transformer encoder. The class token's final state is classified.
- **Without $\\symEpos$ the encoder sees a set**: it is permutation equivariant, and all knowledge of the 2-D layout must come from the learned positions.
- **ViT trades inductive bias for flexibility.** ConvNets build in locality, weight sharing and translation equivariance; ViT must learn them, and attention distance growing with depth shows it does. That costs data: ViT beat ResNets only after pretraining on very large datasets such as JFT-300M.
- **The gap can be closed** with augmentation, regularization and distillation from a ConvNet teacher (DeiT), or by putting locality back into the architecture with windows and a hierarchy (Swin).`, 'Takeaways');

    // -------------------------------------------------------------------------------
    p.h2('Build it yourself', 'exercises');
    p.prose(`
1. **Patchify in NumPy (10 minutes).** Write \`patchify(img, P)\` with one \`reshape\`, one \`transpose\` and one more \`reshape\`, and \`unpatchify\` that inverts it. Check that \`unpatchify(patchify(x)) == x\` for a random 32 × 32 × 3 array and $\\symP$ = 4, 8 and 16, and that \`patchify(x, 16)[j]\` equals \`x[r*16:(r+1)*16, s*16:(s+1)*16].ravel()\`. *Success:* both checks pass, and you can say what the transpose is for (try leaving it out).
2. **The embedding is a convolution.** With a random \`E\` of shape (48, 64), compute \`patchify(x, 4) @ E\` and the stride-4 convolution of the patch-conv listing above, and check they agree. Then look at what changes if the stride is smaller than the filter (overlapping patches). *Success:* \`np.allclose\` is True, and you can count how many tokens overlapping patches with stride 2 would produce.
3. **A set, then a sequence.** Write a one-block encoder in NumPy (layer norm, 2-head attention, MLP, residuals) with random weights. Verify the permutation identity from this chapter: shuffle the patch tokens and the class token's output does not change, to float precision. Then add a random $\\symEpos$ and show that it does. *Success:* differences around $10^{-7}$ without positions and of order 1 with them.
4. **Attention distance of a real ViT.** In PyTorch, load a pretrained ViT-B/16 (for example from the \`timm\` library), record the attention weights of every head in every layer for 100 ImageNet-style photos, and compute the mean attention distance with the formula above. *Success:* a plot like the one in this chapter, showing the spread of distances in early layers and the rise with depth that the ViT paper reported.
5. **Project: bias against data.** Train a tiny ViT ($\\symP$ = 4, $\\symD$ = 64, 6 layers) and a small ResNet with a similar number of parameters on CIFAR-10 subsets of 5,000, 20,000 and 50,000 images, with and without random-crop and flip augmentation. *Success:* a table of test accuracies in which the ConvNet's lead is largest with little data and no augmentation, and you can say how much of the gap augmentation closes.`);
  },
};

export default chapter;
