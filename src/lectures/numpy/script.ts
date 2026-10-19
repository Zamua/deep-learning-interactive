import type { LectureScript } from '../../lecture/types';

export const script: LectureScript = {
  id: 'numpy',
  title: 'Python and NumPy',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'intro',
      title: 'Thinking in arrays',
      codeTitle: 'the_goal.py',
      code: `
        # Python: the language of the assignments   #@py
        # NumPy: its library for arrays             #@np

        for i in range(N):          # loops:        #@loop
            for j in range(D):      # one number    #@loop
                X[i, j] -= mean[j]  # at a time     #@loop

        X -= X.mean(axis=0)         # whole arrays  #@array

        correct = scores[np.arange(N), y]           #@goal
        correct.shape               # (N,)          #@shape
      `,
      beats: [
        { id: 'hello', say: 'Welcome to Python and NumPy, the language of every assignment in this course.', code: 'py' },
        { id: 'python', say: 'Python is the easy part: if you already program, an afternoon is enough.', code: 'py' },
        { id: 'numpy', say: 'NumPy, its library for arrays of numbers, takes longer, and every line that does real work goes through it.', code: 'np' },
        { id: 'loops', say: 'It asks you to stop thinking in loops, which visit one number at a time...', code: 'loop' },
        { id: 'whole', say: 'and to think in whole arrays instead, where one line touches every number at once.', code: 'array' },
        { id: 'goal', say: 'By the end, a line like this one, which picks the correct class score for every example, should read as easily as a for loop.', code: 'goal' },
        { id: 'shape', say: 'And you should be able to predict the shape of every array before you print it.', code: 'shape' },
      ],
    },
    {
      id: 'python',
      title: 'Python in a hurry',
      codeTitle: 'basics.py',
      code: `
        x = 3              # no declarations    #@x
        7 / 2              # 3.5   a float      #@div
        7 // 2             # 3     rounds down  #@div
        2 ** 10            # 1024  power        #@pow
        7 % 3              # 1     remainder    #@pow

        if x > 2:                               #@indent
            print('big')   # the block          #@indent

        nums = [3, 1, 4, 1, 5, 9]               #@list
        nums[0], nums[-1]  # (3, 9)             #@idx
        nums[1:4]          # [1, 4, 1]          #@slice
        nums[:2], nums[3:] # ([3, 1], [1, 5, 9])  #@open
        nums[::2]          # [3, 4, 5]          #@step
        sq = [n ** 2 for n in nums if n > 2]    #@comp
        # sq == [9, 16, 25, 81]                 #@comp
      `,
      beats: [
        { id: 'x', say: 'Python has no type declarations. Write x equals three, and Python works out that x is a whole number.', code: 'x' },
        { id: 'div', say: 'One trap: a single slash always gives a decimal, so seven over two is {3.5|three point five}. Two slashes round down, to three.', code: 'div' },
        { id: 'pow', say: 'Two stars mean power, and the percent sign gives the remainder.', code: 'pow' },
        { id: 'indent', say: 'There are no curly braces: the indentation is the block, and a colon starts one.', code: 'indent' },
        { id: 'list', say: 'The workhorse container is the list, an ordered row of values, and counting starts at zero.', code: ['list', 'idx'] },
        { id: 'neg', say: 'Negative indices count back from the end: minus one is the last item.', code: 'idx' },
        { id: 'slice', say: 'A slice picks a range. Picture indices as fence posts between items: {1:4|one colon four} takes what lies between posts one and four.', code: 'slice' },
        { id: 'open', say: 'Leave out the start, and it begins at zero. Leave out the stop, and it runs to the end.', code: 'open' },
        { id: 'step', say: 'A third number is the step: two colons and a two take every second item.', code: 'step' },
        { id: 'comp', say: 'And a list comprehension builds a new list in one line: square each n, keeping only those above two.', code: 'comp' },
      ],
    },
    {
      id: 'python2',
      title: 'Tuples, dicts, functions, classes',
      codeTitle: 'containers.py',
      code: `
        point = (3, 4)         # a tuple        #@tuple
        px, py = point         # unpacking      #@tuple
        counts = {'cat': 3, 'dog': 5}           #@dict
        counts['cat']          # 3              #@dict
        results[(lr, reg)] = (train, val)       #@results

        def relu(v, leak=0.0):                  #@def
            return v if v > 0 else leak * v     #@def
        relu(-2.0, leak=0.1)   # -0.2           #@kw

        class NearestNeighbor:                  #@cls
            def train(self, X, y):              #@cls
                self.X_train = X   # keep it    #@self
        clf = NearestNeighbor()    # no "new"   #@new
        clf.train(X_train, y_train)             #@new

        alias = nums       # not a copy!        #@alias
        alias[0] = 99      # nums[0] is 99 too  #@alias
      `,
      beats: [
        { id: 'tuple', say: 'A tuple is a list in round brackets that cannot be changed. Unpack one into names, and px gets three, py gets four.', code: 'tuple' },
        { id: 'dict', say: 'A dictionary maps keys to values. Ask for cat, and you get three.', code: 'dict' },
        { id: 'results', say: 'Assignment one stores its tuning results this way: a pair of settings as the key, a pair of accuracies as the value.', code: 'results' },
        { id: 'def', say: 'Functions start with def, and an argument can have a default, like a leak of zero.', code: 'def' },
        { id: 'kw', say: 'You can also pass arguments by name: a {ReLU|ray-loo} of minus two, with a leak of {0.1|zero point one}, gives minus {0.2|zero point two}.', code: 'kw' },
        { id: 'cls', say: 'A class bundles data with the functions that use it. Every method takes self first: the object itself.', code: ['cls', 'self'] },
        { id: 'new', say: 'Calling the class makes one, with no new keyword, and train just stores the data inside it.', code: ['new', 'self'] },
        { id: 'alias', say: 'Last, the habit that trips people up most: giving a list a second name does not copy it.', code: 'alias' },
        { id: 'same', say: 'Both names point at one list, so a change through either shows up in both. NumPy has its own version.', code: 'alias' },
      ],
    },
    {
      id: 'arrays',
      title: 'NumPy arrays',
      codeTitle: 'arrays.py',
      code: `
        import numpy as np
        v = np.array([1, 2, 3])          #@v
        v.shape, v.ndim, v.dtype         #@vinfo
        # ((3,), 1, int64)               #@vinfo

        M = np.array([[1., 2., 3.],      #@M
                      [4., 5., 6.]])     #@M
        M.shape, M.ndim, M.dtype         #@Minfo
        # ((2, 3), 2, float64)           #@Minfo

        A = {{make:np.zeros((2, 3))}}    #@make

        v.shape                # (3,)   flat    #@flat
        v.reshape(3, 1).shape  # (3, 1) column  #@col
        v.reshape(1, 3).shape  # (1, 3) row     #@col
      `,
      beats: [
        { id: 'what', say: 'A NumPy array is a grid of numbers that all share one type, stored side by side in one block of memory.' },
        { id: 'fast', say: 'That is what makes it fast. A Python list points to objects scattered around memory, but an array is one tight block that NumPy loops over in compiled C.' },
        { id: 'v', say: 'Every array knows three things. Its shape is a tuple with one size per axis: this one has one axis, of length three.', code: ['v', 'vinfo'] },
        { id: 'ndim', say: 'Its ndim counts the axes. Its dtype is the type of every entry: here, whole numbers, int sixty four.', code: 'vinfo' },
        { id: 'M', say: 'Rows of decimals make a two dimensional array. Axis zero runs down the rows, axis one across the columns.', code: 'M' },
        { id: 'Minfo', say: 'So its shape is two comma three, its ndim is two, and its dtype is float sixty four.', code: 'Minfo' },
        { id: 'dtypes', say: 'Two more dtypes matter here: uint eight, for raw pixel values, and bool, for True and False.' },
        { id: 'make', say: 'NumPy also builds arrays for you: all zeros, all sevens, the identity, a range, evenly spaced points, or bell curve samples.', code: 'make' },
        { id: 'comma', say: 'One warning: the shape {(3,)|three comma}, with its trailing comma, is a flat array. It is not a column, and not a row.', code: 'flat' },
        { id: 'col', say: 'Three by one is a column and one by three is a row, both two dimensional. Mixing these up causes the most confusing bugs.', code: 'col' },
      ],
    },
    {
      id: 'indexing',
      title: 'Indexing and slicing',
      codeTitle: 'slicing.py',
      code: `
        a = np.arange(24).reshape(4, 6)       #@a

        a[1, 3]      # 9: row 1, column 3     #@one
        a[2]         # row 2: shape (6,)      #@row
        a[:, 0]      # column 0: shape (4,)   #@col
        a[:, 0:1]    # shape (4, 1)           #@keep
        a[1:3, 2:5]  # block: shape (2, 3)    #@block
        a[::2, ::3]  # shape (2, 2)           #@step
        a[-1]        # the last row           #@last

        s = a[1:3, 2:5]   # a view            #@view
        s[0, 0] = 99      # a[1, 2] is 99!    #@write
      `,
      beats: [
        { id: 'grid', say: 'Let us practice on a grid: the numbers zero to twenty three, poured into four rows of six.', code: 'a' },
        { id: 'one', say: 'Indexing takes one index per axis, separated by commas. Row one, column three, is the number nine.', code: 'one' },
        { id: 'row', say: 'An axis you leave out means all of it, so a single index, two, gives the whole of row two.', code: 'row' },
        { id: 'col', say: 'For a column, write a bare colon for the rows, meaning all of them, then zero.', code: 'col' },
        { id: 'flat', say: 'But what comes back is a flat row of four numbers, shape {(4,)|four comma}. Not a column.', code: 'col' },
        { id: 'drop', say: 'That is the rule: an integer index removes its axis, a slice keeps it. Columns zero up to one give four by one.', code: ['col', 'keep'] },
        { id: 'block', say: 'Slices on both axes cut out a block: rows one up to three, columns two up to five, a two by three piece.', code: 'block' },
        { id: 'step', say: 'Steps work too, like every second row and every third column. And minus one is the last row.', code: ['step', 'last'] },
        { id: 'view', say: 'One more thing: a slice copies nothing. It is a view, a window onto the same memory.', code: 'view' },
        { id: 'write', say: 'So writing into the view writes into the original: the alias trap again, and why slicing is so fast.', code: 'write' },
      ],
    },
    {
      id: 'picking',
      title: 'Integer arrays and masks',
      codeTitle: 'pick.py',
      code: `
        # scores: (5, 4), one row per example   #@scores
        y = np.array([2, 0, 3, 1, 0])  # labels #@y
        N = scores.shape[0]            # 5      #@y
        rows = np.arange(N)  # [0 1 2 3 4]      #@rows
        correct = scores[rows, y]               #@pick
        # [3.1, 2.8, 2.6, 3.3, 1.9]             #@pick
        scores[:, y]         # (5, 5): wrong!   #@wrong
        margins[rows, y] = 0 # writes, too      #@write

        mask = a > 15            # (4, 6) bools #@mask
        a[mask]                  # [16 ... 23]  #@sel
        a[(a > 3) & (a < 10)]    # [4 ... 9]    #@and
        hidden[hidden < 0] = 0   # a ReLU       #@relu
        acc = np.mean(y_pred == y)              #@acc
      `,
      beats: [
        { id: 'ints', say: 'Now a power move: you can index an axis with a whole array of integers.' },
        { id: 'setup', say: 'Here is why. Scores has a row per example and a column per class, and the loss needs one cell per row: the correct class, which y holds.', code: ['scores', 'y'] },
        { id: 'rows', say: '{np.arange(N)|n p dot arange of N} gives the row numbers, and y gives one column for each row.', code: 'rows' },
        { id: 'pick', say: 'Index with both, and NumPy pairs them up like zip: row zero with column two, row one with column zero, and so on.', code: 'pick' },
        { id: 'one', say: 'One score per example, in one line. The vectorized SVM and softmax losses both lean on it.', code: 'pick' },
        { id: 'wrong', say: 'The classic mistake is a colon for the rows: it takes every row at every label, a five by five array, and gives a silently wrong loss.', code: 'wrong' },
        { id: 'write', say: 'The same trick writes, too: this zeroes every row\'s correct-class entry at once.', code: 'write' },
        { id: 'mask', say: 'Masks are the other fancy index. Compare an array with something, and you get booleans of the same shape.', code: 'mask' },
        { id: 'sel', say: 'Index with the mask, and you get the True entries, as a flat copy.', code: 'sel' },
        { id: 'and', say: 'Combine conditions with ampersand, bar and tilde, wrapping each comparison in parentheses; and, or and not fail on arrays.', code: 'and' },
        { id: 'relu', say: 'Assigning through a mask changes only those positions: zeroing every negative entry is a {ReLU|ray-loo}.', code: 'relu' },
        { id: 'acc', say: 'And the mean of a boolean array is the fraction that are True: accuracy.', code: 'acc' },
      ],
    },
    {
      id: 'math',
      title: 'Elementwise math and reductions',
      codeTitle: 'math.py',
      code: `
        A = np.array([[1, 2],
                      [3, 4]])
        A * A     # [[1, 4], [9, 16]]           #@mul
        np.sqrt(A), np.exp(A)   # per entry     #@ufunc
        A @ A     # [[7, 10], [15, 22]]         #@mat
        dx = dout * (x > 0)   # ReLU backward   #@relu

        A = np.array([[1, 5, 2, 0],             #@A
                      [4, 3, 6, 1],             #@A
                      [2, 7, 1, 3]])  # (3, 4)  #@A
        A.sum()             # 35                #@all
        A.sum(axis=0)       # [ 7 15  9  4]     #@ax0
        A.sum(axis=1)       # [ 8 14 13]        #@ax1
        A.sum(axis=1, keepdims=True)  # (3, 1)  #@keep
        A.argmax(axis=1)    # [1 2 1]           #@argmax
      `,
      beats: [
        { id: 'elem', say: 'Arithmetic on arrays works entry by entry: plus, times, even greater than all pair up matching entries.', code: 'mul' },
        { id: 'mul', say: 'So A times A squares every entry: one, four, nine, sixteen.', code: 'mul' },
        { id: 'ufunc', say: 'NumPy\'s math functions, like square root, exp and log, also run on every entry at once.', code: 'ufunc' },
        { id: 'mat', say: 'The matrix product is different, spelled with the at sign: each entry is a row dotted with a column. One times one, plus two times three, is seven.', code: 'mat' },
        { id: 'bug', say: 'Mixing them up is a classic bug that often does not crash: for square matrices, both are legal.', code: ['mul', 'mat'] },
        { id: 'relu', say: 'The course uses both: X dot W for scores, and the star to zero a {ReLU|ray-loo}\'s gradient wherever its input was negative.', code: 'relu' },
        { id: 'reduce', say: 'Reductions collapse an array: sum, mean, max, argmax. With no arguments they collapse everything: this grid sums to thirty five.', code: ['A', 'all'] },
        { id: 'ax0', say: 'With axis equals zero, the rows collapse: each column slides down into one number.', code: 'ax0' },
        { id: 'ax1', say: 'With axis equals one, the columns collapse, leaving one number per row.', code: 'ax1' },
        { id: 'rule', say: 'So, the axis you name is the one that disappears: three by four, summed over axis one, is {(3,)|three comma}.', code: 'ax1' },
        { id: 'keep', say: 'With keepdims equals True, the collapsed axis stays, with size one: three by one, still lined up with the original.', code: 'keep' },
        { id: 'argmax', say: 'And argmax reports where each winner sits: the column of each row\'s biggest score, which is how a classifier picks its label.', code: 'argmax' },
      ],
    },
    {
      id: 'broadcasting',
      title: 'Broadcasting',
      codeTitle: 'broadcast.py',
      code: `
        A = np.arange(12).reshape(3, 4)   #@A
        B = np.array([10, 20, 30, 40])    #@B
        C = A + B           # (3, 4)      #@C
        # A: (3, 4)                       #@rules
        # B:    (4,) -> (1, 4) -> (3, 4)  #@rules

        col = np.array([[1], [2], [3]])   #@outer
        row = np.array([[1, 2, 3, 4]])    #@outer
        table = col * row   # (3, 4)      #@outer

        A + np.array([1, 2, 3])  # error  #@bad

        scores = X.dot(W) + b    # + (C,) #@bias
        X -= X.mean(axis=0)      # - (D,) #@center
        probs /= probs.sum(axis=1, keepdims=True)   #@norm
      `,
      beats: [
        { id: 'q', say: 'What happens when you add two arrays of different shapes? Often, exactly what you meant.', code: ['A', 'B'] },
        { id: 'ex', say: 'Add a row of four numbers to a three by four grid, and the row is added to every row of the grid.', code: ['A', 'B', 'C'] },
        { id: 'stretch', say: 'This is broadcasting: NumPy acts as if the smaller array were stretched to match, copying nothing.', code: 'C' },
        { id: 'r1', say: 'The rules: line the shapes up from the right, and pad the shorter one on the left with ones.', code: 'rules' },
        { id: 'r2', say: 'Then, axis by axis, equal sizes are fine, and a size of one is stretched to match.', code: 'rules' },
        { id: 'outer', say: 'Both can stretch at once: a column of three times a row of four makes a whole multiplication table.', code: 'outer' },
        { id: 'bad', say: 'Anything else fails. Three numbers against a three by four grid: from the right, three meets four, and NumPy refuses.', code: 'bad' },
        { id: 'bias', say: 'The course uses this everywhere. Scores are N by C, the biases just C, so every example gets the same biases.', code: 'bias' },
        { id: 'center', say: 'Centering subtracts the mean image, shape D, from each of the N images.', code: 'center' },
        { id: 'norm', say: 'And dividing each row by its sum makes probabilities: with keepdims, the sums are N by one, so each stretches across its row.', code: 'norm' },
      ],
    },
    {
      id: 'distances',
      title: 'The distance trick',
      codeTitle: 'distances.py',
      code: `
        # X: (N, D) test,  Xtr: (M, D) train
        x2 = (X ** 2).sum(axis=1,                #@x2
                          keepdims=True)  # (N, 1)   #@x2
        t2 = (Xtr ** 2).sum(axis=1)       # (M,)     #@t2
        cross = X.dot(Xtr.T)              # (N, M)   #@cross
        d2 = x2 - 2 * cross + t2          # (N, M)   #@sum
        dists = np.sqrt(np.maximum(d2, 0))           #@sqrt
      `,
      beats: [
        { id: 'task', say: 'Now broadcasting does real work: the distance from every test image to every training image, with no loops.' },
        { id: 'table', say: 'With N test images and M training images, that is an N by M table, one distance per pair.', code: 1 },
        { id: 'square', say: 'The trick is school algebra: x minus t, squared, is x squared, minus two x t, plus t squared.' },
        { id: 'vec', say: 'For vectors it reads: the squared length of x, minus twice x dot t, plus the squared length of t.' },
        { id: 'x2', say: 'Each term works for all pairs at once. The test images\' squared lengths form a column, N by one.', code: 'x2' },
        { id: 't2', say: 'The training images\' squared lengths form a row of M.', code: 't2' },
        { id: 'cross', say: 'And every test image dotted with every training image is one matrix product, N by M.', code: 'cross' },
        { id: 'glue', say: 'Broadcasting glues them: the column stretches across, the row stretches down, and all three line up as N by M.', code: 'sum' },
        { id: 'clip', say: 'Rounding can push a tiny squared distance below zero, so clip at zero before the square root.', code: 'sqrt' },
      ],
    },
    {
      id: 'reshape',
      title: 'Reshape and image layouts',
      codeTitle: 'reshape.py',
      code: `
        v = np.arange(6)       # [0 1 2 3 4 5]    #@v
        M = v.reshape(2, 3)    # [[0 1 2]         #@M
                               #  [3 4 5]]        #@M
        v.reshape(3, -1)       # shape (3, 2)     #@minus
        M.T                    # shape (3, 2)     #@T

        img.shape         # (32, 32, 3): HWC      #@hwc
        img[r, c]         # [red, green, blue]    #@px
        x = img.reshape(3072)  # r g b r g b ...  #@flat
        k = (r * 32 + c) * 3 + ch                 #@k
        chw = img.transpose(2, 0, 1)  # CHW       #@chw
        k = ch * 1024 + r * 32 + c                #@chw
        X = X_train.reshape(N, -1)  # (N, 3072)   #@batch
      `,
      beats: [
        { id: 'reshape', say: 'Reshape gives the same numbers a new shape. Nothing moves in memory; only the reading changes.', code: ['v', 'M'] },
        { id: 'order', say: 'NumPy reads in row-major order, along each row and then down, like a book, and pours into the new shape the same way.', code: 'M' },
        { id: 'minus', say: 'The count cannot change, so minus one means work it out: six numbers in three rows makes two columns.', code: 'minus' },
        { id: 'T', say: 'Transpose is different: it swaps the axes, so rows become columns.', code: 'T' },
        { id: 'img', say: 'Now images. The assignments load each {CIFAR-10|see-far ten} image as {32 × 32 × 3|thirty two by thirty two by three}: height, width, channels, called {HWC|H W C}.', code: 'hwc' },
        { id: 'px', say: 'A row and a column pick out one pixel: its red, green and blue values.', code: 'px' },
        { id: 'flat', say: 'A linear classifier wants each image as one long vector, and row-major order decides where each value lands.', code: ['flat', 'k'] },
        { id: 'hwc', say: 'The last axis changes fastest. In {HWC|H W C} that is the channel, so the vector runs red, green, blue, red, green, blue.', code: 'k' },
        { id: 'chw', say: 'Assignment two\'s convolution layers put channels first, {CHW|C H W}. Flattened, that gives all the reds, then all the greens, then all the blues.', code: 'chw' },
        { id: 'same', say: 'Either works if every image uses the same one; mixing them scrambles your data. A batch becomes one N by {3,072|three thousand and seventy two} matrix.', code: 'batch' },
      ],
    },
    {
      id: 'vectorize',
      title: 'Keep the loops out of Python',
      codeTitle: 'vectorize.py',
      code: `
        v = np.random.randn(1_000_000)
        total = 0.0                          #@loop
        for value in v:                      #@loop
            total += value    # ~50 ms       #@loop
        total = np.sum(v)     # ~0.15 ms     #@np

        for i in range(N):                     #@two
            for j in range(M):                 #@two
                diff = X[i] - Xtr[j]           #@two
                dists[i, j] = np.linalg.norm(diff)   #@two
        for i in range(N):                     #@one
            diff = Xtr - X[i]     # (M, D)     #@one
            dists[i] = np.linalg.norm(diff, axis=1)  #@one
        d2 = x2 - 2 * X.dot(Xtr.T) + t2        #@zero
        dists = np.sqrt(d2)    # no loops      #@zero
        # Python steps: {{steps:0}}
        np.allclose(dists, dists_loop)  # True #@check
      `,
      beats: [
        { id: 'speed', say: 'Why think in whole arrays? Speed. Python is interpreted, and every pass through a loop pays for bookkeeping.', code: 'loop' },
        { id: 'loop', say: 'Adding up a million numbers in a Python loop takes about fifty milliseconds.', code: 'loop' },
        { id: 'np', say: '{np.sum|n p dot sum} hands the whole loop to compiled code: about {0.15|zero point one five} milliseconds, over three hundred times faster.', code: 'np' },
        { id: 'rule', say: 'So the rule for fast code is short: keep the loops out of Python.' },
        { id: 'two', say: 'Assignment one makes you feel it. With two loops, Python takes one step per pair of images.', code: 'two' },
        { id: 'one', say: 'With one loop, each step fills a whole row.', code: 'one' },
        { id: 'zero', say: 'With no loops, there is one step: the distance trick, its work in one matrix multiply.', code: 'zero' },
        { id: 'sizes', say: 'At the assignment\'s sizes: two and a half million steps, five hundred, or one. About six seconds, five seconds, and four hundredths of a second.' },
        { id: 'why', say: 'One loop barely helps, because each step still builds a huge temporary array.', code: 'one' },
        { id: 'how', say: 'To vectorize, think in shapes, not indices: write down every input\'s shape and the answer\'s, then find the operations that connect them.' },
        { id: 'check', say: 'And check the fast version against the slow loop on a small input, with {np.allclose|n p dot all close}.', code: 'check' },
      ],
    },
    {
      id: 'pitfalls',
      title: 'Common pitfalls',
      codeTitle: 'pitfalls.py',
      code: `
        a = np.arange(6)
        s = a[1:4]        # a view            #@view
        s[0] = 99         # a[1] is 99 too!   #@view
        c = a[1:4].copy() # independent       #@copy

        z = np.zeros(3, dtype=np.int64)       #@int
        z[0] = 0.9        # stored as 0       #@int
        px = np.array([200, 100], np.uint8)   #@u8
        px + px           # [144 200]!        #@u8
        px.astype(float) + px  # [400. 200.]  #@fix

        v = np.array([1, 2, 3])   # (3,)      #@v
        v.T.shape                 # (3,)      #@v
        (v + v[:, None]).shape    # (3, 3)!   #@trap
        assert scores.shape == (N, C)         #@assert
      `,
      beats: [
        { id: 'three', say: 'Before we wrap up, three pitfalls that catch almost everyone. First, views.' },
        { id: 'view', say: 'A slice is a window, so writing into the slice writes into the original.', code: 'view' },
        { id: 'copy', say: 'To change an array you were handed, copy it first. Integer and mask indexing always copy.', code: 'copy' },
        { id: 'int', say: 'Second, dtypes. Store {0.9|zero point nine} in an integer array, and it silently becomes zero.', code: 'int' },
        { id: 'u8', say: 'Images arrive as uint eight, whole numbers up to {255|two hundred and fifty five}: two hundred plus two hundred wraps, like an odometer, to one hundred and forty four.', code: 'u8' },
        { id: 'fix', say: 'So convert to floats before any arithmetic, as the assignment\'s loader does.', code: 'fix' },
        { id: 'flat', say: 'Third, the nastiest: a flat shape, {(3,)|three comma}, against a column, three by one. Transposing the flat one does nothing.', code: 'v' },
        { id: 'trap', say: 'Add them, and broadcasting stretches both: you expected three numbers and got a three by three table, with no error.', code: 'trap' },
        { id: 'assert', say: 'The cure is cheap: when a shape surprises you, print it, and assert shapes throughout your code.', code: 'assert' },
      ],
    },
    {
      id: 'outro',
      title: 'Plotting, and the takeaways',
      codeTitle: 'plotting.py',
      code: `
        import matplotlib.pyplot as plt

        xs = np.linspace(-3, 3, 100)              #@plot
        plt.plot(xs, np.maximum(0, xs))           #@plot
        plt.plot(xs, np.tanh(xs))                 #@plot
        plt.plot(loss_history)                    #@loss
        plt.imshow(X_train[0].astype('uint8'))    #@img
        for i in range(10):                       #@grid
            plt.subplot(2, 5, i + 1)              #@grid
            plt.imshow(X_train[i].astype('uint8'))   #@grid
            plt.axis('off')                       #@grid
        plt.show()
      `,
      beats: [
        { id: 'plt', say: 'One last tool: matplotlib, which draws the assignments\' loss curves and image grids.' },
        { id: 'plot', say: 'plt dot plot draws a curve through x and y values: here a {ReLU|ray-loo} and a {tanh|tan h}.', code: 'plot' },
        { id: 'loss', say: 'Give it one array, and it plots each value against its position: a training curve.', code: 'loss' },
        { id: 'img', say: '{imshow|im show} draws an {HWC|H W C} image with whole numbers up to {255|two hundred and fifty five}, hence the cast to uint eight. And subplot makes a grid.', code: ['img', 'grid'] },
        { id: 'recap1', say: 'That is the toolkit. Every array has a shape: predict it. Integers drop their axis, slices keep it, and slices are views.' },
        { id: 'recap2', say: 'Star is elementwise, at is the matrix product, the axis you name disappears, and broadcasting stretches the ones.' },
        { id: 'recap3', say: 'And Python loops are slow: vectorize, then check against the loop.' },
        { id: 'next', say: 'Next, open the interactive chapter, where every idea is a figure you can poke, with its code running beside it.' },
        { id: 'bye', say: 'See you there.', pause: 0.6 },
      ],
    },
  ],
};
