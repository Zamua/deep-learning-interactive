import type { LectureScript } from '../../lecture/types';

export const script: LectureScript = {
  id: 'image-classification',
  title: 'Image classification and nearest neighbors',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'intro',
      title: 'From pixels to a word',
      codeTitle: 'classify.py',
      code: `
        def classify(image):              #@def
            # find the most similar image   #@def
            # seen before; copy its label   #@def
            ...                             #@def

        image = load_photo()   # 32 x 32 x 3   #@image
        label = classify(image)                #@call
        print(label)           # cat           #@label
      `,
      beats: [
        { id: 'hello', say: 'Show a photo to a three year old and ask what is in it. You get an answer in under a second.' },
        { id: 'numbers', say: 'Show it to a computer, and it receives something far less friendly: a block of a few thousand numbers.', code: 'image' },
        { id: 'gap', say: 'This lecture is about the gap between those two, and about the simplest possible way to bridge it.', code: ['call', 'label'] },
        { id: 'simple', say: 'The idea: to label a new image, find the most similar image you have already seen, and copy its label.', code: 'def' },
        { id: 'habits', say: 'It beats chance, it fails in instructive ways, and it teaches habits every later chapter relies on: training, validation and test data, hyperparameters, and honest evaluation.' },
        { id: 'go', say: 'Let us start with the task itself.' },
      ],
    },
    {
      id: 'task',
      title: 'One label per image',
      codeTitle: 'image.py',
      code: `
        classes = ['plane', 'car', 'bird',   #@classes
                   'cat', 'deer', 'dog',     #@classes
                   'frog', 'horse', 'ship',  #@classes
                   'truck']                  #@classes

        img = X_train[104]   # a cat         #@img
        img.shape     # (32, 32, 3)          #@shape
        img.dtype     # uint8: 0 to 255      #@dtype
        img[17, 15]   # [42, 44, 25]: one pixel  #@px
        img[15:20, 13:18, 0]   # 25 reds      #@patch
        img.size      # 3072                 #@size
      `,
      beats: [
        { id: 'task', say: 'Image classification means: given an image, pick one label from a fixed list of categories.', code: 'classes' },
        { id: 'built', say: 'Plane, car, cat, and so on. It sounds narrow, but finding objects, outlining them, and describing scenes are all built on top of it.', code: 'classes' },
        { id: 'grid', say: 'To a computer, an image is a grid of pixels.', code: 'img' },
        { id: 'pixel', say: 'Each pixel is three numbers: how much red, green and blue light it has.', code: 'px' },
        { id: 'byte', say: 'Each is a whole number, from zero for none, to two hundred and fifty five for full. One byte.', code: 'dtype' },
        { id: 'zoom', say: 'Zoom into a patch of the red channel, and this is all that is really there.', code: 'patch' },
        { id: 'shape', say: 'Thirty two pixels wide, thirty two tall, three colors each: {3,072|three thousand and seventy two} numbers.', code: ['shape', 'size'] },
        { id: 'job', say: 'A classifier must turn them into one word. Yet nothing in the numbers says cat. The meaning lives only in how they are arranged.' },
      ],
    },
    {
      id: 'hard',
      title: 'Why it is hard',
      codeTitle: 'semantic_gap.py',
      code: `
        # one label, very different numbers
        cats = X_train[[55, 189, 9,       #@cats
                        20, 268, 299]]    #@cats

        # early vision: hand-written rules
        def is_cat(img):                  #@rules
            edges = find_edges(img)       #@edges
            shapes = group(edges)         #@shapes
            return looks_like_cat(shapes) #@rules
      `,
      beats: [
        { id: 'gap', say: 'Recognizing a cat is effortless for you, so it is easy to underestimate. The difficulty has a name: the semantic gap, between raw pixels and the meaning we want.' },
        { id: 'each', say: 'Here are six real cats from the dataset. Each changes the numbers a lot, while the answer stays the same.', code: 'cats' },
        { id: 'view', say: 'Viewpoint. Move the camera, and nearly every pixel changes.', code: 'cats' },
        { id: 'scale', say: 'Scale. It can fill the frame, or be a few pixels across.', code: 'cats' },
        { id: 'deform', say: 'Deformation. Cats stretch, curl up, and sprawl.', code: 'cats' },
        { id: 'occl', say: 'Occlusion. Part of it hides behind a window frame.', code: 'cats' },
        { id: 'light', say: 'Illumination. In a dark room, only the eyes are left.', code: 'cats' },
        { id: 'clutter', say: 'Background clutter. An orange cat, among orange fruit.', code: 'cats' },
        { id: 'intra', say: 'And intra class variation: one label, every size, color and breed.' },
        { id: 'inv', say: 'A good classifier must be invariant to all of this, while staying sensitive to what does matter, like a house cat versus a lynx.' },
        { id: 'rules', say: 'Nobody knows how to write that down as rules. Early computer vision tried: find edges, then describe a cat as an arrangement of shapes.', code: ['rules', 'edges', 'shapes'] },
        { id: 'brittle', say: 'It was brittle, and every new category meant starting over.', code: 'rules' },
      ],
    },
    {
      id: 'data',
      title: 'Learning from data',
      codeTitle: 'classifier_api.py',
      code: `
        def train(images, labels):
            model = ...    # learning      #@train
            return model                   #@train

        def predict(model, test_images):
            test_labels = ...              #@predict
            return test_labels             #@predict

        # CIFAR-10, 10 classes             #@cifar
        X_train.shape  # (50000, 32, 32, 3)   #@split
        X_test.shape   # (10000, 32, 32, 3)   #@split
      `,
      beats: [
        { id: 'learn', say: 'So we do what you would do with a child: show lots of examples. Collect labeled images, and let an algorithm learn the look of each class. This is the data driven approach.' },
        { id: 'input', say: 'It has three steps. First, the input: a training set of N images, each labeled with one of K classes.' },
        { id: 'training', say: 'Second, learning: build a model from them. This is called training.', code: 'train' },
        { id: 'eval', say: 'Third, evaluation: have it label new images, the test set, and compare with the true labels. In code, that is two functions: train, and predict.', code: ['train', 'predict'] },
        { id: 'cifar', say: 'Our dataset is {CIFAR-10|see-far ten}: sixty thousand tiny color images in ten classes, split into fifty thousand for training and ten thousand for testing.', code: ['cifar', 'split'] },
        { id: 'sample', say: 'From here on, we work with a balanced sample of it: a thousand training images, and two hundred test images.' },
        { id: 'rows', say: 'Read along any row, and the challenges show up at once: front and side, near and far, on carpet and on grass.' },
      ],
    },
    {
      id: 'l1',
      title: 'Comparing two images',
      codeTitle: 'l1.py',
      code: `
        I1 = X_test[45].astype(np.int32)    #@I1
        I2 = X_train[9].astype(np.int32)    #@I2
        diff = np.abs(I1 - I2)   # gaps     #@diff
        diff[18:22, 0:4, 0]      # 16 reds  #@win
        d1 = np.sum(diff)     # {{d1:…}}      #@d1

        np.uint8(10) - np.uint8(20)  # 246   #@wrap
      `,
      beats: [
        { id: 'rule', say: 'Now, the simplest classifier there is. Training: memorize every image and its label. Prediction: find the most similar training image, and answer with its label.' },
        { id: 'number', say: 'But most similar has to become a number. The direct way compares two images position by position.' },
        { id: 'two', say: 'Here is a test image, I one, and a training image, I two.', code: ['I1', 'I2'] },
        { id: 'sub', say: 'At each of the {3,072|three thousand and seventy two} positions, subtract one number from the other.', code: 'diff' },
        { id: 'abs', say: 'Then drop the sign, so minus thirty counts as thirty. That is the absolute value.', code: 'diff' },
        { id: 'pic', say: 'The gaps form a third picture: dark where the images agree, bright where they differ.', code: 'diff' },
        { id: 'win', say: 'Here are sixteen of them, from one window of the red channel.', code: 'win' },
        { id: 'sum', say: 'Add up every gap, and you get one number: the {L1|L one} distance. Zero means identical; bigger means more different.', code: 'd1' },
        { id: 'wrap', say: 'One trap. Images arrive as unsigned bytes, which cannot go negative: ten minus twenty wraps around to two hundred and forty six.', code: 'wrap' },
        { id: 'astype', say: 'That silently wrecks every distance, so convert to signed integers first, with {astype|as type}.', code: ['I1', 'I2'] },
      ],
    },
    {
      id: 'nn',
      title: 'The nearest neighbor classifier',
      codeTitle: 'nearest_neighbor.py',
      code: `
        class NearestNeighbor:
            def train(self, X, y):              #@train
                self.Xtr = X.astype(np.int32)   #@train
                self.ytr = y                    #@train

            def predict(self, X):                     #@predict
                M = X.shape[0]                        #@predict
                y_pred = np.zeros(M, dtype=int)       #@predict
                for i in range(M):                    #@loop
                    d = np.sum(np.abs(self.Xtr - X[i]), axis=1)   #@dist
                    j = np.argmin(d)    # {{j:…}}        #@argmin
                    y_pred[i] = self.ytr[j]  # {{lab:…}}   #@label
                return y_pred

        accuracy = np.mean(y_pred == y_test)   #@acc
      `,
      beats: [
        { id: 'wrap', say: 'Wrap that distance in train and predict, and we have a complete classifier.' },
        { id: 'train', say: 'Training just memorizes everything. All the work happens at prediction time, one test image at a time.', code: ['train', 'predict', 'loop'] },
        { id: 'broad', say: 'Subtract the test image from every row of the training matrix at once. NumPy calls this broadcasting.', code: 'dist' },
        { id: 'axis', say: 'Sum along each row, with {axis=1|axis equals one}, and you have one distance per training image.', code: 'dist' },
        { id: 'argmin', say: 'Find the smallest. Not its value, but its position: that is {argmin|arg min}.', code: 'argmin' },
        { id: 'label', say: 'The label stored there is the prediction. Here, a cat, which is right.', code: 'label' },
        { id: 'acc', say: 'To score it, compare every guess with the true label. Each comparison is true or false, and their mean is the accuracy.', code: 'acc' },
        { id: 'result', say: 'On the full {CIFAR-10|see-far ten}, this classifier gets about {38.6%|thirty eight point six percent} of the test images right.', code: 'acc' },
        { id: 'compare', say: 'Far better than the ten percent of guessing. Far worse than people, at about ninety four, or the convolutional networks of {2016|twenty sixteen}, at about ninety five.' },
      ],
    },
    {
      id: 'l2',
      title: 'The L2 distance',
      codeTitle: 'l2.py',
      code: `
        d1 = np.sum(np.abs(I1 - I2))           #@l1
        d2 = np.sqrt(np.sum((I1 - I2) ** 2))   #@l2

        # one test image against all 1,000
        diff = Xtr - I1                        #@all
        d = {{dline:np.sqrt(np.sum(diff ** 2, axis=1))}}   #@all
        nearest = np.argsort(d)[:10]           #@sort
        ytr[nearest]   # {{labs:…}}            #@labs
      `,
      beats: [
        { id: 'other', say: 'The other common distance is {L2|L two}: the ordinary, straight line distance.' },
        { id: 'recipe', say: 'Square each difference instead of dropping its sign. Add the squares up, then take the square root.', code: 'l2' },
        { id: 'two', say: 'In two dimensions, that is Pythagoras. Go three across and four up. {L1|L one} walks the grid and gets seven. {L2|L two} cuts straight across and gets five. Images just have {3,072|three thousand and seventy two} directions instead of two.', code: ['l1', 'l2'] },
        { id: 'squares', say: 'The squaring is what sets it apart. A gap of ten counts a hundred, a gap of a hundred counts ten thousand. So {L2|L two} hates one big difference far more than many small ones.', code: 'l2' },
        { id: 'acc', say: 'With the same classifier, {L2|L two} gets about {35.4%|thirty five point four percent}, a little below {L1|L one}.' },
        { id: 'real', say: 'Here is a real test image, a white cat, with its ten nearest training images by {L2|L two}.', code: ['all', 'sort'] },
        { id: 'none', say: 'Not one of them is a cat: six planes, three ships and a deer.', code: 'labs' },
        { id: 'why', say: 'What they share is a pale blue gray color. Pixel distances see color and layout far more than content.' },
        { id: 'swap', say: 'Switch to {L1|L one}, and the order shuffles. But the story stays the same.', code: ['all', 'labs'] },
      ],
    },
    {
      id: 'noloops',
      title: 'Every distance at once',
      codeTitle: 'no_loops.py',
      code: `
        Xte = X_test.reshape(200, -1).astype(float)
        Xtr = X_train.reshape(1000, -1).astype(float)
        te = np.sum(Xte ** 2, axis=1)   # (200,)    #@te
        tr = np.sum(Xtr ** 2, axis=1)   # (1000,)   #@tr
        cross = Xte.dot(Xtr.T)    # (200, 1000)     #@cross
        dists = np.sqrt(te[:, None] + tr[None, :]   #@dists
                        - 2 * cross)                #@dists
      `,
      beats: [
        { id: 'slow', say: 'Comparing every test image with every training image, pair by pair, is slow in Python. Assignment one asks for it with no loops at all.' },
        { id: 'expand', say: 'The trick is school algebra: {(a − b)² = a² + b² − 2ab|A minus B, squared, equals A squared, plus B squared, minus two A B}. Summed over every position, a distance splits into three parts.' },
        { id: 'own', say: 'Each image\'s own sum of squares: one per test image, and one per training image.', code: ['te', 'tr'] },
        { id: 'cross', say: 'And the cross term, a dot product. For every pair at once, those form one matrix product, which NumPy hands to a heavily optimized library.', code: 'cross' },
        { id: 'broad', say: 'Broadcasting adds a column to a row to fill the whole table. Typically, that is a hundred times faster than two nested loops, or more.', code: 'dists' },
      ],
    },
    {
      id: 'knn',
      title: 'k-nearest neighbors',
      codeTitle: 'knn_2d.py',
      code: `
        def knn_predict(q, X, y, k={{k:1}}):
            d = {{dist:np.sqrt(np.sum((X - q) ** 2, axis=1))}}   #@dist
            nearest = np.argsort(d)[:k]                  #@sort
            votes = np.bincount(y[nearest], minlength=3)  #@vote
            if np.sum(votes == votes.max()) > 1:   #@tie
                return -1     # a tie: no color    #@tie
            return np.argmax(votes)                #@pred

        # color every spot of the plane            #@grid
        regions = [knn_predict(g, X, y) for g in grid]   #@grid
      `,
      beats: [
        { id: 'fragile', say: 'Copying the label of the single closest image is fragile.' },
        { id: 'odd', say: 'If that one image is odd, say mislabeled, or a cat on a blue blanket like a ship on water, the answer is wrong.' },
        { id: 'vote', say: 'So ask more neighbors. k nearest neighbors finds the k closest training images, and lets them vote.', code: ['sort', 'vote'] },
        { id: 'win', say: 'The most common label wins. With k equal to one, it is nearest neighbor again.', code: 'pred' },
        { id: 'plane', say: 'In two dimensions, we can watch it. Color every spot of the plane by the label it would get. These are decision regions, and their borders, decision boundaries.', code: 'grid' },
        { id: 'islands', say: 'At k equals one, every point claims the area nearest to it, so these three outliers carve out islands of the wrong color.' },
        { id: 'five', say: 'Raise k to five, and they are outvoted. The islands vanish, and the boundaries smooth out.', code: ['sort', 'vote', 'pred'] },
        { id: 'ties', say: 'Blank patches are ties, where no class has a majority.', code: 'tie' },
        { id: 'metric', say: 'The distance matters too. At k equals one under {L1|L one}, every boundary runs across, up and down, or on a diagonal.', code: 'dist' },
        { id: 'howbig', say: 'In practice you want k above one. But how far? Too large, and small classes get outvoted. You cannot settle that by thinking.' },
      ],
    },
    {
      id: 'validation',
      title: 'Hyperparameters and the test set',
      codeTitle: 'validation_split.py',
      code: `
        # hold out 1,000 training images
        X_val, y_val = X_train[:1000], y_train[:1000]   #@split
        X_tr, y_tr = X_train[1000:], y_train[1000:]     #@split

        results = {}
        for k in [1, 3, 5, 10, 20, 50, 100]:      #@loop
            knn = KNearestNeighbor()              #@loop
            knn.train(X_tr, y_tr)                 #@loop
            y_pred = knn.predict(X_val, k=k)      #@val
            results[k] = np.mean(y_pred == y_val) #@val

        best_k = max(results, key=results.get)    #@best
        # then the test set, exactly once         #@test
      `,
      beats: [
        { id: 'hyper', say: '{k|K} is a hyperparameter: a setting of the learning algorithm itself, as opposed to something learned from the data.' },
        { id: 'more', say: 'The distance is another. You rarely know good values in advance, so you try several, and keep what works best.', code: 'loop' },
        { id: 'onwhat', say: 'But best on what? The tempting answer is the test set, and it is a serious mistake.' },
        { id: 'tuned', say: 'Keep whichever k scores best on the test set, and you have quietly tuned to those test images. The number you report is now too optimistic.' },
        { id: 'exam', say: 'Treat the test set like a sealed exam. Make every choice without it, then open it exactly once, at the end.', code: 'test' },
        { id: 'carve', say: 'Instead, carve a validation set out of the training data: of fifty thousand images, train on forty nine thousand, and hold back one thousand.', code: 'split' },
        { id: 'loop', say: 'Train with each candidate k, score it on the validation images, and keep the best.', code: ['loop', 'val', 'best'] },
        { id: 'practice', say: 'It is a practice test you may look at as often as you like.', code: 'val' },
      ],
    },
    {
      id: 'crossval',
      title: 'Cross-validation',
      codeTitle: 'cross_validate.py',
      code: `
        X_folds = np.array_split(X_train, 5)    #@split
        y_folds = np.array_split(y_train, 5)    #@split
        acc = {k: [] for k in k_choices}
        for f in range(5):                                   #@fold
            X_val, y_val = X_folds[f], y_folds[f]            #@hold
            X_tr = np.concatenate(X_folds[:f] + X_folds[f+1:])   #@rest
            y_tr = np.concatenate(y_folds[:f] + y_folds[f+1:])   #@rest
            for k in k_choices:                              #@k
                y_pred = knn(X_tr, y_tr, X_val, k, 'L1')     #@k
                acc[k].append(np.mean(y_pred == y_val))      #@k
        means = {k: np.mean(acc[k]) for k in k_choices}      #@mean
        best_k = max(means, key=means.get)   # {{best:…}}    #@best
        # then, once, on the test set: {{test:…}}            #@test
      `,
      beats: [
        { id: 'noisy', say: 'With little data, one validation set is a noisy judge: a few lucky images can make one k look better than it is.' },
        { id: 'folds', say: 'Cross validation buys a steadier verdict with more computation. Split the training data into five equal folds.', code: 'split' },
        { id: 'rotate', say: 'Train on four, and validate on the fifth. Then rotate, so every fold takes one turn as validation.', code: ['fold', 'hold', 'rest'] },
        { id: 'avg', say: 'Average the five scores. Every image validates once, and trains four times.', code: 'mean' },
        { id: 'run', say: 'Here it is on our thousand training images, with {L1|L one}. Each faint dot is one fold. The line is their average, and the bars show how much the folds disagree.', code: ['k', 'mean'] },
        { id: 'flat', say: 'With so few images, the curve is low and nearly flat, and the folds disagree by several points. Exactly when averaging earns its keep.' },
        { id: 'best', say: 'The best average is at k equals five. On the full {CIFAR-10|see-far ten}, the course notes found about seven.', code: 'best' },
        { id: 'test', say: 'Only now, once, the test set: thirty one percent. That is the number to report.', code: 'test' },
        { id: 'practice', say: 'Folds multiply the cost of every experiment, so with big datasets and slow networks, people use one split, training on half to ninety percent of the data.' },
      ],
    },
    {
      id: 'limits',
      title: 'Where pixel distances fail',
      codeTitle: 'fooled.py',
      code: `
        knn.train(X, y)    # instant: stores X        #@train
        knn.predict(x)     # compares x with all of X #@predict

        I = X_train[990].astype(float)   # a dog     #@I
        shifted = np.roll(I, 4, axis=1)  # 4 px      #@shift
        darker = I * 0.6                             #@dark
        boxed = I.copy()                             #@box
        boxed[10:22, 10:22] = 0      # black square  #@box
        other = X_train[{{o:446}}]   # a {{oc:frog}}   #@other

        for J in [shifted, darker, boxed, other]:    #@loop
            print(np.linalg.norm(I - J))             #@loop
        # {{ds:…}}  {{dd:…}}  {{db:…}}  {{dot:…}}    #@out
      `,
      beats: [
        { id: 'pros', say: 'A verdict. Nearest neighbors is simple, and takes no time to train. It pays at prediction, comparing each image with every stored one.', code: ['train', 'predict'] },
        { id: 'backwards', say: 'That is backwards. Training happens once, and may take days. Prediction happens every time, often on a phone, and must be fast.' },
        { id: 'ann', say: 'Approximate search libraries, such as {FLANN|flan}, help a lot. But they cannot fix a deeper problem.' },
        { id: 'deeper', say: 'Pixel distances ask whether two images have similar colors in the same places. That is only loosely tied to what they show.' },
        { id: 'edits', say: 'Take this dog, and make three edits that keep it a dog. Shift it four pixels. Dim it to sixty percent. Black out its middle.', code: ['I', 'shift', 'dark', 'box'] },
        { id: 'frog', say: 'Now find the closest image of another class. A frog, on a white background, just like the dog.', code: 'other' },
        { id: 'bars', say: 'Measure the {L2|L two} distance from the dog to each. Every edited copy is farther away than the frog.', code: ['loop', 'out'] },
        { id: 'fluke', say: 'No fluke: across our thousand images, a four pixel shift lands farther than the nearest other class almost half the time.' },
        { id: 'tsne', say: 'Lay the dataset out with {t-SNE|tee snee}, so images close in {L2|L two} sit together, and neighbors share backgrounds far more often than a class.' },
      ],
    },
    {
      id: 'curse',
      title: 'The curse of dimensionality',
      codeTitle: 'curse.py',
      code: `
        m = 10            # samples per axis
        for D in [1, 2, 3, 3072]:               #@grid
            print(D, m ** D)   # examples needed   #@grid

        D = {{D:2}}                                #@D
        X = np.random.rand(500, D)   # 500 points  #@pts
        q = np.random.rand(D)        # one query   #@pts
        d = np.sqrt(np.sum((X - q) ** 2, axis=1))  #@dist
        d.min() / d.max()      # {{ratio:…}}       #@ratio
      `,
      beats: [
        { id: 'size', say: 'There is also a problem of size. Nearest neighbors needs examples that cover the space densely, so every new image has a similar one nearby.' },
        { id: 'line', say: 'A line, with one example every tenth of the way, needs ten. A square needs a hundred. A cube, a thousand. Each dimension multiplies the bill by ten.', code: 'grid' },
        { id: 'pixels', say: 'An image has {3,072|three thousand and seventy two} dimensions. Ten to that power has {3,073|three thousand and seventy three} digits. No dataset comes close.', code: 'grid' },
        { id: 'strange', say: 'And something stranger. Scatter five hundred random points in a cube, and measure their distances to one more.', code: ['D', 'pts', 'dist'] },
        { id: 'two', say: 'In two dimensions, the distances spread out. Some points really are near, others really far.', code: 'ratio' },
        { id: 'up', say: 'Now raise the number of dimensions. Ten. A hundred. A thousand.', code: 'D' },
        { id: 'spike', say: 'The distances bunch into a narrow spike. The nearest point is barely closer than the farthest, and nearest loses its meaning.', code: 'ratio' },
        { id: 'real', say: 'Real images are not random, which is why nearest neighbors beats chance at all. But every method on raw pixels fights this bunching.' },
      ],
    },
    {
      id: 'closing',
      title: 'Where this leads',
      codeTitle: 'knn_recipe.py',
      code: `
        # 1. preprocess: zero mean, unit variance   #@pre
        X = (X - X.mean(axis=0)) / X.std(axis=0)   #@pre
        # 2. reduce dimensions, e.g. with PCA       #@dims
        # 3. split off validation data, or folds    #@split
        # 4. tune k and the distance on it          #@tune
        # 5. too slow? approximate NN, e.g. FLANN   #@ann
        # 6. evaluate on the test set, once         #@once

        scores = W.dot(x)   # next: one multiply    #@next
      `,
      beats: [
        { id: 'practice', say: 'If you do use {kNN|K N N}, on good features rather than raw pixels, here is the recipe.' },
        { id: 'pre', say: 'Normalize each feature to zero mean and unit variance, and reduce the dimensions if there are many, for example with {PCA|P C A}.', code: ['pre', 'dims'] },
        { id: 'tune', say: 'Tune k and the distance on validation data. Switch to approximate search if it is slow. Then test once, and report that number.', code: ['split', 'tune', 'ann', 'once'] },
        { id: 'recap', say: 'To recap. Image classification turns {3,072|three thousand and seventy two} numbers into one label, across a wide semantic gap, by learning from examples instead of rules.' },
        { id: 'recap2', say: '{kNN|K N N} lets the k most similar training images vote. It trains instantly, predicts slowly, and its pixel distances track color more than content. Hyperparameters are tuned on validation data, never the test set.' },
        { id: 'next', say: 'The next chapter flips the trade. A linear classifier distills the training set into one template per class, and throws the images away. Prediction becomes a single matrix multiply.', code: 'next', pause: 0.6 },
      ],
    },
  ],
};
