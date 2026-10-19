import type { LectureScript } from '../../lecture/types';

export const script: LectureScript = {
  id: 'vit',
  title: 'Vision transformers',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'intro',
      title: 'An image is worth 16 × 16 words',
      codeTitle: 'vit.py',
      code: `
        img = load_image()           #@img
        # a ConvNet assumes:
        #   look locally, share filters  #@conv
        # a transformer assumes:
        #   almost nothing              #@tf
        patches = cut(img, P=16)     #@cut
        tokens = embed(patches)      #@emb
        label = transformer(tokens)  #@run
      `,
      beats: [
        { id: 'hello', say: 'This lecture is about the vision transformer, {ViT|V I T} for short, from Google, in {2020|twenty twenty}.', code: 'img' },
        { id: 'convs', say: 'In the ConvNets chapter, every design choice encoded a belief about images.', code: 'conv' },
        { id: 'beliefs', say: 'A filter looks only at a small neighborhood, and the same filter slides over every position.', code: 'conv' },
        { id: 'tf', say: 'The transformer, meanwhile, took over language with one generic operation, self-attention, that assumes almost nothing.', code: 'tf' },
        { id: 'question', say: 'So the {ViT|V I T} paper asked a blunt question. What if we feed an image to a standard transformer, and change as little as possible?' },
        { id: 'answer', say: 'The answer is in its title: an image is worth {16 × 16|sixteen by sixteen} words. Cut the image into squares, and treat each square as a word.', code: ['cut', 'emb'] },
        { id: 'result', say: 'With enough training data, this matched or beat the best ConvNets of the time.', code: 'run' },
        { id: 'plan', say: 'We will build it piece by piece, look inside a tiny trained one, and ask what it gave up by dropping those beliefs.' },
      ],
    },
    {
      id: 'patches',
      title: 'From pixels to patches',
      codeTitle: 'patchify.py',
      code: `
        H, W, C = 224, 224, 3
        pixels = H * W        # 50,176       #@pix
        pixels ** 2           # 2.5 billion  #@pairs
        P = 16                               #@P
        N = (H * W) // P**2   # 196          #@N
        patch_len = P * P * C # 768          #@len
        patches = (img                       #@cut
          .reshape(14, P, 14, P, C)          #@cut
          .transpose(0, 2, 1, 3, 4)          #@cut
          .reshape(N, P * P * C))            #@cut
      `,
      beats: [
        { id: 'seq', say: 'A transformer reads a sequence. The most literal way to make an image a sequence is to make every pixel a token.', code: 'pix' },
        { id: 'count', say: 'A {224|two hundred and twenty four} by {224|two hundred and twenty four} photo has about fifty thousand pixels.', code: 'pix' },
        { id: 'square', say: 'But attention compares every pair of tokens, so its work grows with the square of the length: two and a half billion pairs per layer.', code: 'pairs' },
        { id: 'group', say: 'So {ViT|V I T} groups the pixels first. Cut the image into a grid of squares, {P|P} pixels on a side. These are the patches.', code: 'P' },
        { id: 'cifar', say: 'Here is a real {CIFAR-10|see-far ten} image, {32|thirty two} pixels square. With eight pixel patches, it becomes a four by four grid.', code: 'cut' },
        { id: 'order', say: 'Read the patches left to right, top to bottom, like words on a page. That is the sequence.', code: 'cut' },
        { id: 'unroll', say: 'Then unroll each patch into one long row of numbers: every pixel, three colors each.', code: 'cut' },
        { id: 'vit', say: 'A full size photo with sixteen pixel patches makes {196|a hundred and ninety six} patches, each {768|seven hundred and sixty eight} numbers long.', code: ['N', 'len'] },
        { id: 'cheap', say: 'That is a long paragraph, not a book. Attention gets sixty five thousand times cheaper than with pixels.', code: 'N' },
        { id: 'dial', say: 'The patch size is a dial. Halve it: four times the patches, sixteen times the attention work, but finer detail in every token.', code: 'P' },
        { id: 'names', say: 'Model names record the choice. {ViT-B/16|V I T, B sixteen} is the base model, on sixteen pixel patches.', code: 'P' },
      ],
    },
    {
      id: 'tokens',
      title: 'Patches become tokens',
      codeTitle: 'embed.py',
      code: `
        tokens = patches @ E   # (N, D)     #@E
        # E = filters of a stride-P conv    #@conv
        z0 = np.vstack([cls, tokens])       #@cls
        z0 = z0 + E_pos   # (N + 1, D)      #@pos
      `,
      beats: [
        { id: 'width', say: 'A patch is now a row of {768|seven hundred and sixty eight} numbers. But the transformer wants rows of its own width, which we call D.', code: 'E' },
        { id: 'E', say: 'One learned matrix, E, maps every patch to a vector of length D. That vector is the patch\'s token.', code: 'E' },
        { id: 'filters', say: 'Each column of E has one weight per number in a patch, so it folds back into a little color picture: a filter.', code: 'conv' },
        { id: 'conv', say: 'In fact, multiplying every patch by E is a convolution, with a filter the size of a patch, jumping a whole patch at a time.', code: 'conv' },
        { id: 'little', say: 'That single convolution at the bottom, with no overlap, is almost all {ViT|V I T} keeps from ConvNets.', code: 'conv' },
        { id: 'cls', say: 'Next, a class token goes in front, borrowed from {BERT|bert}. It has no pixels of its own, and its final state will hold the answer.', code: 'cls' },
        { id: 'pos', say: 'Last, every slot gets a learned position vector, added to its token, because attention by itself has no idea where a patch came from.', code: 'pos' },
        { id: 'learned', say: 'The class token and the position vectors start as random numbers, and backpropagation trains them like any other weight.', code: ['cls', 'pos'] },
        { id: 'z0', say: 'The result, z zero, has one row for the class token and one for each patch. That is the sequence the encoder reads.', code: 'pos' },
      ],
    },
    {
      id: 'encoder',
      title: 'A standard encoder',
      codeTitle: 'encoder.py',
      code: `
        def block(z):
            z = z + msa(layer_norm(z))  #@msa
            z = z + mlp(layer_norm(z))  #@mlp
            return z

        for l in range(L):              #@loop
            z = block(z)                #@loop
        y = layer_norm(z[0])  # class   #@head
        scores = y @ W_head             #@head
      `,
      beats: [
        { id: 'same', say: 'From here on, {ViT|V I T} is the transformer encoder, unchanged.' },
        { id: 'recap', say: 'Recall self-attention. Every token makes a query, a key and a value.', code: 'msa' },
        { id: 'recap2', say: 'Each token\'s output is an average of all the values, weighted by how well its query matches each key.', code: 'msa' },
        { id: 'block', say: 'A block wraps attention and a small {MLP|M L P} in residual connections, with a layer norm in front of each.', code: ['msa', 'mlp'] },
        { id: 'only', say: 'Attention is the only place where patches see each other. And from the first layer, any patch can read from any other, however far apart.', code: 'msa' },
        { id: 'mlp', say: 'Everything else treats each token on its own, the same way in every slot.', code: 'mlp' },
        { id: 'stack', say: 'Stack the block L times. The base model has twelve layers, each {768|seven hundred and sixty eight} wide: about {86|eighty six} million parameters.', code: 'loop' },
        { id: 'head', say: 'At the top, the class token\'s final vector goes through a linear classifier, trained with the usual softmax loss.', code: 'head' },
        { id: 'reads', say: 'The class token starts as the same vector for every image. Layer by layer, it reads what it needs from the patches.', code: 'head' },
        { id: 'tiny', say: 'To look inside, we will use a tiny {ViT|V I T}: four pixel patches, six layers, trained on {CIFAR-10|see-far ten}, and right eighty one percent of the time.' },
      ],
    },
    {
      id: 'cls',
      title: 'Where the class token looks',
      codeTitle: 'cls_attention.py',
      code: `
        probs, A = vit(img)             #@fwd
        # A[l, h]: (65, 65), rows sum to 1
        a = A[l, h, 0, 1:]  # class row #@row
        amap = a.reshape(8, 8)          #@row

        R = np.eye(65)                  #@roll
        for A_l in A.mean(axis=1):      #@roll
            R = (A_l + I) / 2 @ R       #@roll
        amap = R[0, 1:].reshape(8, 8)   #@roll
      `,
      beats: [
        { id: 'table', say: 'Each layer\'s attention weights form a table. Row i says how much token i takes from every token, and each row adds up to one.', code: 'fwd' },
        { id: 'row0', say: 'Row zero belongs to the class token. Lay its {64|sixty four} patch weights back on the grid, and you see where it looked.', code: 'row' },
        { id: 'image', say: 'Here is a test image the model never saw. Bright patches got more of the class token\'s attention, and dark ones got less.', code: 'row' },
        { id: 'layers', say: 'Every layer and every head makes its own map. Early on, the class token has nothing to read but the raw patches.', code: 'row' },
        { id: 'deeper', say: 'Deeper layers read from patches that have already mixed with their neighbors, so a single map is hard to interpret.', code: 'row' },
        { id: 'chain', say: 'Attention rollout chains the layers: it multiplies their tables, counting the residual path as half of every step.', code: 'roll' },
        { id: 'object', say: 'It estimates how much of the final class token traces back to each input patch. Often, it lands on the object.', code: 'roll' },
        { id: 'others', say: 'Here are a few more test images, each with the model\'s guess.', code: 'roll' },
        { id: 'caution', say: 'Treat these maps as evidence, not explanation. They show where information was read from, not what the network did with it.' },
      ],
    },
    {
      id: 'set',
      title: 'Without positions, a set',
      codeTitle: 'bag_of_patches.py',
      code: `
        order = rng.permutation(64)    #@shuf
        x = patches[order]             #@shuf
        p1 = vit(x)        # with E_pos  #@p1
        p2 = vit_nopos(x)  # without     #@p2
        # p2 never changes              #@p2
      `,
      beats: [
        { id: 'strange', say: 'Here is a strange property of the encoder. Nothing in it looks at which slot a token sits in.' },
        { id: 'why', say: 'Attention weights come from dot products between tokens, and everything else treats every token alike.' },
        { id: 'shuffle', say: 'Shuffle the patch tokens, and the outputs shuffle the same way, otherwise unchanged. The class token comes out exactly the same.', code: 'shuf' },
        { id: 'bag', say: 'Without positions, the encoder sees a set, not a sequence: a bag of patches.' },
        { id: 'two', say: 'To see this, two tiny models were trained the same way: one with position embeddings, and one without.', code: ['p1', 'p2'] },
        { id: 'scramble', say: 'Shuffle the patches. The model with positions sees a scrambled picture, and changes its mind.', code: 'p1' },
        { id: 'same', say: 'The model without positions gives exactly the same answer, for every one of the sixty four factorial orderings.', code: 'p2' },
        { id: 'still', say: 'And it still gets seventy three percent of test images right, from colors and textures alone.', code: 'p2' },
        { id: 'break', say: 'Position embeddings break the symmetry. The same patch in two slots becomes two different tokens.', code: 'p1' },
      ],
    },
    {
      id: 'positions',
      title: 'Positions are learned',
      codeTitle: 'pos_similarity.py',
      code: `
        E_pos = vit.E_pos[1:]    # (64, 64)
        U = E_pos / norm(E_pos, axis=1)   #@norm
        sim = U @ U.T            # cosine #@sim
        tile = sim[i].reshape(8, 8)       #@tile
      `,
      beats: [
        { id: 'random', say: 'The position embeddings are one learned vector per slot. They start random, and nobody says the slots form a grid.' },
        { id: 'compare', say: 'So compare them: for each slot, how similar is its vector to every other slot\'s?', code: ['norm', 'sim'] },
        { id: 'grid', say: 'Draw one slot\'s similarities as a little map, and put all the little maps on the grid.', code: 'tile' },
        { id: 'init', say: 'At initialization there is nothing to see. Each vector resembles only itself.', code: 'tile' },
        { id: 'trained', say: 'After training, neighboring slots have similar vectors, and each slot resembles its own row and column.', code: 'tile' },
        { id: 'found', say: 'The model found the two dimensional layout of the image from data alone.' },
        { id: 'paper', say: 'The {ViT|V I T} paper saw the same thing, and found that building two dimensional positions in did no better than plain learned ones.' },
        { id: 'resize', say: 'One catch: they exist only for the training grid, so to fine-tune on bigger images, {ViT|V I T} interpolates them onto a bigger grid.' },
      ],
    },
    {
      id: 'bias',
      title: 'Inductive bias',
      codeTitle: 'shift.py',
      code: `
        x2 = np.roll(img, s, axis=1)   #@shift
        f1 = conv(gray(img), w)        #@conv
        f2 = conv(gray(x2), w)         #@conv
        np.allclose(f2,                #@eq
            np.roll(f1, s, axis=1))    #@eq
        # True, for every shift s      #@eq
        patches(x2)  # unless s % P == 0,  #@vit
        # every patch holds new pixels     #@vit
      `,
      beats: [
        { id: 'define', say: 'Every learning algorithm prefers some solutions before it sees any data. That preference is called its inductive bias.' },
        { id: 'local', say: 'A ConvNet\'s bias is strong, and made for images. Locality: a small filter sees only a small neighborhood.', code: 'conv' },
        { id: 'share', say: 'Weight sharing: one filter is reused everywhere, so a feature learned in one corner works in every corner.', code: 'conv' },
        { id: 'equi', say: 'And as a consequence, translation equivariance. Slide the image, and the feature maps slide along with it.', code: ['shift', 'conv'] },
        { id: 'exact', say: 'Filter then shift, or shift then filter: the same answer, for every shift.', code: 'eq' },
        { id: 'vit', say: '{ViT|V I T} keeps almost none of this. Slide the image by one pixel, and every patch now holds a different mix of pixels.', code: 'vit' },
        { id: 'four', say: 'Slide it by a whole patch, and the patches come back, but in new slots, with new position vectors added.', code: 'vit' },
        { id: 'global', say: 'And attention is global from the first layer. Nothing says that nearby patches should matter more.' },
        { id: 'learn', say: 'So locality, nearness and the meaning of a shift all have to be learned, from data.' },
      ],
    },
    {
      id: 'distance',
      title: 'Learning to look locally',
      codeTitle: 'attention_distance.py',
      code: `
        W = A[l, h, 1:, 1:]   # patches  #@w
        W = W / W.sum(1, keepdims=True)  #@w
        d = (W * dist).sum(1).mean()     #@d
        # dist: pixels between centers   #@d
      `,
      beats: [
        { id: 'measure', say: 'Did the model learn to look locally? The {ViT|V I T} paper measured each head\'s mean attention distance.' },
        { id: 'how', say: 'For each patch, weight every patch it attends to by its distance in pixels, and average.', code: ['w', 'd'] },
        { id: 'rf', say: 'It plays the role of a receptive field. A head that looks only at its own patch scores zero.', code: 'd' },
        { id: 'chart', say: 'Here is every head of the tiny model, layer by layer. The dashed line is what evenly spread attention would give.', code: 'd' },
        { id: 'ours', say: 'In the tiny model, layer two is the most local, and from there the distance grows with depth. But every head stays near the even spread.', code: 'd' },
        { id: 'paper', say: 'The paper found the same pattern in its large models: low layers mixing local and global heads, and distance growing with depth.' },
        { id: 'learned', say: 'In the large model, many early heads learned to look locally, like a ConvNet\'s first filters. Nobody built that in.' },
        { id: 'hybrid', say: 'Those local heads were rarer when a ResNet ran first, as if they did the job of early convolutions.' },
      ],
    },
    {
      id: 'data',
      title: 'Bias against data',
      codeTitle: 'pretrain.py',
      code: `
        # pretrain, then test on ImageNet
        for data in ["ImageNet",       #@in1k
                     "ImageNet-21k",   #@in21k
                     "JFT-300M"]:      #@jft
            vit = pretrain(ViT(), data)
            cnn = pretrain(ResNet(), data)
      `,
      beats: [
        { id: 'head', say: 'A strong inductive bias is a head start. If the assumptions are right, the model does not have to learn them, so it needs less data.' },
        { id: 'ceiling', say: 'If they are slightly wrong, they become a ceiling. A weak bias is the reverse: it needs more data, and it can gain more from it.' },
        { id: 'exp', say: 'The {ViT|V I T} paper made this trade visible, pretraining transformers and ResNets on three ever larger datasets, then testing on ImageNet.' },
        { id: 'in1k', say: 'With ImageNet alone, about a million images, the ResNets won. The large {ViT|V I T} even did worse than the small one.', code: 'in1k' },
        { id: 'in21k', say: 'With ImageNet {21k|twenty one K}, fourteen million images, they were roughly level.', code: 'in21k' },
        { id: 'jft', say: 'With {JFT-300M|J F T three hundred M}, Google\'s internal set of three hundred million images, {ViT|V I T} pulled ahead.', code: 'jft' },
        { id: 'top', say: 'At the top, the huge {ViT|V I T} reached about {88.5|eighty eight and a half} percent on ImageNet, level with the best ConvNets, for less compute.', code: 'jft' },
        { id: 'lesson', say: 'Convolution\'s bias helps when data is scarce. With enough data, learning the patterns directly is enough, and even better.' },
      ],
    },
    {
      id: 'deit',
      title: 'DeiT: less data, more recipe',
      codeTitle: 'deit.py',
      code: `
        img = augment(img)  # crop, mix  #@aug
        z = vit(img)   # z[1]: dist token
        s_cls = z[0] @ W_cls             #@cls
        s_dist = z[1] @ W_dist           #@dist
        y_t = teacher(img).argmax()      #@teacher
        loss = (0.5 * ce(s_cls, y)       #@loss
                + 0.5 * ce(s_dist, y_t)) #@loss
      `,
      beats: [
        { id: 'problem', say: 'That left a practical problem. Few people have three hundred million labeled images.' },
        { id: 'deit', say: 'Two months later, {DeiT|D E I T}, from Facebook AI, trained a {ViT|V I T} on ImageNet alone, on one machine with eight {GPUs|G P Us}, in under three days.' },
        { id: 'recipe', say: 'The architecture was the same. What changed was the recipe.' },
        { id: 'aug', say: 'First, heavy augmentation: random crops, color changes, and blending images and labels together, with {Mixup|mix up} and {CutMix|cut mix}.', code: 'aug' },
        { id: 'biasdata', say: 'Augmentation is inductive bias, delivered through data. A flipped copy with the same label says: flips do not change the class.', code: 'aug' },
        { id: 'reg', say: 'Second, strong regularization, and long training.' },
        { id: 'token', say: 'Third, distillation. A second learned token sits beside the class token, and its job is to agree with a teacher network.', code: 'dist' },
        { id: 'loss', say: 'The loss is half the usual cross entropy with the true label, and half cross entropy with the teacher\'s top guess.', code: ['teacher', 'loss'] },
        { id: 'teacher', say: 'The best teachers were ConvNets. The student, it seems, inherits some of the teacher\'s inductive bias.', code: 'teacher' },
        { id: 'result', say: 'The result competed with ConvNets of similar speed, trained on the same data.' },
      ],
    },
    {
      id: 'swin',
      title: 'Swin: windows and a pyramid',
      codeTitle: 'swin.py',
      code: `
        M = 7                 # window side  #@M
        w = windows(x, M)     # (4, 49, D)   #@win
        w = attention(w)      # inside each  #@win
        x = np.roll(x, (-3, -3))  # shift    #@shift
        x = merge_2x2(x)      # 14x14 -> 7x7 #@merge
        # global: N * N
        # windows: N * M * M                 #@cost
      `,
      beats: [
        { id: 'other', say: 'The other route is to put some image structure back into the architecture.' },
        { id: 'hybrid', say: 'The {ViT|V I T} paper itself tried a hybrid: a ResNet first, then the transformer on its feature map.' },
        { id: 'swin', say: 'The most influential design is the {Swin|swin} transformer, from Microsoft Research Asia, in {2021|twenty twenty one}.' },
        { id: 'windows', say: 'First, windows. Attention runs only inside small windows of seven by seven patches, so a token sees only its neighborhood.', code: ['M', 'win'] },
        { id: 'cost', say: 'Locality is back, and the cost grows with the number of patches, not with its square.', code: 'cost' },
        { id: 'shift', say: 'To let information cross window borders, every second block shifts the windows by half a window.', code: 'shift' },
        { id: 'merge', say: 'Second, a hierarchy. Between stages, each two by two group of tokens merges into one, so each window covers four times as much.', code: 'merge' },
        { id: 'pyramid', say: 'That builds a pyramid of feature maps, like a ConvNet\'s, so {Swin|swin} slots straight into detectors and segmenters.', code: 'merge' },
        { id: 'convnext', say: 'The traffic went both ways. In {2022|twenty twenty two}, ConvNeXt modernized a ResNet with ideas borrowed from transformers, and matched {Swin|swin}.' },
        { id: 'lesson', say: 'Much of the gap, it turned out, came from training recipes and design details, not from attention itself.' },
      ],
    },
    {
      id: 'outro',
      title: 'What to remember',
      codeTitle: 'vit.py',
      code: `
        patches = cut(img, P)             #@cut
        tokens = patches @ E              #@emb
        z0 = stack(cls, tokens) + E_pos   #@emb
        z = encoder(z0)                   #@enc
        label = head(layer_norm(z[0]))    #@head
      `,
      beats: [
        { id: 'recap', say: 'To sum up: {ViT|V I T} cuts an image into patches, projects each one, adds a class token and learned positions, and runs a standard encoder.', code: ['cut', 'emb', 'enc', 'head'] },
        { id: 'set', say: 'Without positions, the encoder sees a set, and all knowledge of the layout has to be learned.', code: 'emb' },
        { id: 'bias', say: '{ViT|V I T} trades inductive bias for flexibility. It has to learn locality, and it does, but that costs data.', code: 'enc' },
        { id: 'close', say: 'With enough data, it wins. With less, a better recipe closes the gap, as in {DeiT|D E I T}, or windows put locality back, as in {Swin|swin}.' },
        { id: 'today', say: 'Today the plain {ViT|V I T} is everywhere: inside {CLIP|clip}, masked autoencoders, and diffusion models.' },
        { id: 'end', say: 'The lesson reaches beyond images. The less a model assumes, the more it has to learn from data, and the more it can learn.' },
      ],
    },
  ],
};
