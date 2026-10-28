import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-clip',
  title: 'CLIP',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Radford, Kim, Hallacy, Ramesh, Goh, Agarwal, Sastry, Askell, Mishkin, Clark, Krueger & Sutskever', year: 2021, title: 'Learning transferable visual models from natural language supervision', url: 'https://arxiv.org/abs/2103.00020', scene: 'train' },
  ],
  scenes: [
    {
      id: 'rows',
      title: 'A row of weights per class',
      codeTitle: 'classifier.py',
      code: `
        # W: a row per class: tree,     #@W
        #   boat and sunset             #@W
        scores = W @ x   # one per class  #@score
        # W: learned from labeled photos  #@labels
        # kite? new row, new photos       #@kite
        w_kite = txt_enc('a photo of a kite')  #@words
      `,
      beats: [
        { id: 'rows', say: 'A classifier scores an image, x, with one row of weights per class: W times x, one dot product per row. Here, the rows are tree, boat and sunset.', code: ['W', 'score'] },
        { id: 'labels', say: 'The rows are learned from photos, each with its label: the right answer, written down by a person.', code: 'labels' },
        { id: 'kite', say: 'A new class, kite, needs a new row, and that row needs labeled kite photos, and more training.', code: 'kite' },
        { id: 'words', say: 'What if the row were written from the class\'s name instead? Turn the words, a photo of a kite, into a vector, and use it as the row. That is the idea behind CLIP.', code: 'words' },
      ],
    },
    {
      id: 'space',
      title: 'One space for both',
      codeTitle: 'encode.py',
      code: `
        z = unit(img_enc(img))  # [0.6, 0.8] #@img
        t = unit(txt_enc(cap))  # [0.8, 0.6] #@txt
        z @ t                   # 0.96       #@sim
      `,
      beats: [
        { id: 'img', say: 'CLIP has two encoders, networks that turn their input into a vector: one reads a photo, the other a caption\'s tokens, through their embeddings.', code: ['img', 'txt'] },
        { id: 'unit', say: 'Both vectors have the same size, and are scaled to length one: every tip lands on one circle, and only the direction counts.', code: ['img', 'txt'] },
        { id: 'sim', say: 'Their similarity is the dot product. This photo of a tree and the caption, a tree on a hill, point nearly the same way: {0.96|zero point nine six}. Training must turn every photo toward its own caption, and away from the rest.', code: 'sim' },
      ],
    },
    {
      id: 'train',
      title: 'Each image picks its caption',
      codeTitle: 'clip_loss.py',
      code: `
        z = unit(img_enc(imgs))  # (N, d)    #@enc
        t = unit(txt_enc(caps))  # (N, d)    #@enc
        sim = z @ t.T            # (N, N)    #@sim
        labels = np.arange(N)    # 0, 1, 2   #@diag
        loss_i = cross_entropy(sim, labels)  #@rows
        loss_t = cross_entropy(sim.T, labels) #@cols
        loss = (loss_i + loss_t) / 2         #@cols
      `,
      beats: [
        { id: 'web', say: 'For that, it needs pairs, and the web is full of them: images posted with text beside them. In 2021, Alec Radford and colleagues at OpenAI gathered {400 million|four hundred million} such pairs.', code: 'enc' },
        { id: 'batch', say: 'Training takes a batch of them at a time: N images and their N captions, each turned into a unit vector of d numbers.', code: 'enc' },
        { id: 'sim', say: 'One matrix product dots every image with every caption: an N by N grid of similarities.', code: 'sim' },
        { id: 'diag', say: 'Image i was posted with caption i, so the right pairs lie on the diagonal. For row i, the label, the right answer, is column i.', code: 'diag' },
        { id: 'rows', say: 'Each row is then a contrastive loss: a softmax over the captions, with a cross-entropy that wants image i to pick caption i. The other N minus one captions in the row are its negatives.', code: 'rows' },
        { id: 'cols', say: 'Each column gets the same: every caption should pick its own image. The loss averages the two directions.', code: 'cols' },
        { id: 'count', say: 'With three pairs, the grid holds nine similarities. The three right pairs are pushed up, and the six negatives down, whatever their values now.', code: ['rows', 'cols'] },
        { id: 'big', say: 'CLIP trained on batches of {32,768|thirty two thousand, seven hundred and sixty eight} pairs, so every row had {32,767|thirty two thousand, seven hundred and sixty seven} negatives.', code: 'rows' },
        { id: 'name', say: 'Hence the name: contrastive language-image pre-training. Pre-training, because it is trained first, before any one use.', code: 'cols' },
      ],
    },
    {
      id: 'zeroshot',
      title: 'Classes written in words',
      codeTitle: 'zero_shot.py',
      code: `
        names = ['tree', 'boat', 'sunset']   #@names
        caps = ['a photo of a ' + n          #@names
                for n in names]              #@names
        t = unit(txt_enc(caps))  # (3, d)    #@embed
        z = unit(img_enc(img))   # [0.6, 0.8] #@embed
        scores = t @ z  # [0.96, 0.6, -0.8]  #@pick
        names[np.argmax(scores)]  # 'tree'   #@pick
        zs @ t.T   # (M, 3): M images        #@many
      `,
      beats: [
        { id: 'names', say: 'Now build a classifier with no labeled photos at all. Write one caption per class: a photo of a tree, a photo of a boat, a photo of a sunset.', code: 'names' },
        { id: 'prompt', say: 'Why a sentence, and not just tree? Radford\'s team found that web text beside an image is rarely a single word.', code: 'names' },
        { id: 'embed', say: 'Embed the captions and the photo. In two numbers, to fit the circle, the photo points to {0.6|zero point six}, {0.8|zero point eight}.', code: 'embed' },
        { id: 'tree', say: 'The tree caption points to {0.8|zero point eight}, {0.6|zero point six}. Their dot product: {0.6|zero point six} times {0.8|zero point eight}, plus {0.8|zero point eight} times {0.6|zero point six}, is {0.96|zero point nine six}.', code: 'pick' },
        { id: 'rest', say: 'Boat points to one, zero, and scores {0.6|zero point six}. Sunset points straight down, and scores {−0.8|minus zero point eight}. The arg max picks the highest: tree.', code: 'pick' },
        { id: 'W', say: 'The caption vectors are the rows of W, with no bias: written from words, not learned from labeled photos.', code: ['embed', 'pick'] },
        { id: 'many', say: 'Stack many images as rows, and images times captions transposed gives one row per image, one column per class.', code: 'many' },
        { id: 'zero', say: 'No labeled photo of a tree was used: zero examples, or zero shots. Hence the name, zero-shot classification.', code: 'pick' },
        { id: 'imagenet', say: 'On ImageNet, a benchmark of a thousand classes, zero-shot CLIP matched a standard network trained on all {1.28|one point two eight} million of its labeled photos.', code: 'pick' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};
