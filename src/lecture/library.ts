import type { Glossary } from './glossary';

/** Library calls shared by every lecture, keyed by `callKey`. A lecture's own glossary overrides these. */
export const LIBRARY: Glossary = {
  // Methods, keyed with a leading dot: on NumPy arrays, lists, strings, rng generators, tensors and models.
  '.all_reduce': {
    is: 'sums a tensor across all workers, in place',
    more: 'Every worker passes in its own gradient and ends up holding the same total, so every copy of the model takes the same step. The name comes from MPI: reduce (combine, here by summing), then hand the result to all.',
  },
  '.append': {
    is: 'adds one item to the end of a list',
    more: 'It changes the list in place and returns None, so write xs.append(v), not xs = xs.append(v). Collecting results in a list and converting once with np.array is the usual pattern.',
    eg: 'xs = [1, 2]; xs.append(3)   # [1, 2, 3]',
  },
  '.argmax': {
    is: 'the index of the largest value',
    more: 'With no axis it searches the flattened array and returns one integer; with axis=1 (or -1) it returns one index per row, turning class scores into predicted labels. Ties go to the first.',
    eg: 'np.array([[1, 5], [7, 2]]).argmax(1)  # [1 0]',
  },
  '.argmin': {
    is: 'the index of the smallest value',
    more: 'Works like argmax, with axis choosing the direction. Applied to distances, it finds the nearest item.',
    eg: 'np.array([4, 1, 3]).argmin()   # 1',
  },
  '.argsort': {
    is: 'the indices that would sort the array',
    more: 'The order is ascending, so a[a.argsort()] is sorted. It works the same on NumPy arrays and PyTorch tensors, and groups items by a key while remembering where each came from.',
    eg: 'np.array([30, 10, 20]).argsort()   # [1 2 0]',
  },
  '.astype': {
    is: 'a copy converted to another dtype',
    more: 'It returns a new array by default. Floats converted to int are truncated toward zero; uint8 pixels converted to float stop wrapping around in arithmetic.',
    eg: 'np.array([1.7, -1.7]).astype(int)   # [1 -1]',
  },
  '.backward': {
    is: 'runs the backward pass, computing gradients',
    more: 'In PyTorch, loss.backward() fills the .grad of every parameter that fed the loss, by backpropagation. On the course\'s own gates and layers, backward() multiplies the upstream gradient by the local one and passes the result on.',
  },
  '.bincount': {
    is: 'counts how often each integer appears',
    more: 'Called on a PyTorch tensor of non-negative integers, it returns a tensor whose entry i counts the occurrences of i; minlength makes room for values that never appear. NumPy spells it as the function np.bincount.',
  },
  '.copy': {
    is: 'an independent copy',
    more: 'Changing the copy never changes the original, and the reverse. This matters for slices, which are views sharing memory: a[1:4].copy() breaks the link. Gradient code copies probs before editing it in place.',
    eg: 'b = a.copy(); b[0] = 9   # a is unchanged',
  },
  '.dot': {
    is: 'the dot product or matrix product',
    more: 'For two 1-D arrays it sums the elementwise products into one number; for 2-D arrays it is the matrix product a @ b. The inner sizes must match: (N, D) times (D, C) gives (N, C).',
    eg: 'np.array([1, 2]).dot([3, 4])   # 11',
  },
  '.extend': {
    is: 'appends every item of another list',
    more: 'In place, like append, but it adds the items one by one instead of adding the list as a single item.',
    eg: 'xs = [1]; xs.extend([2, 3])   # [1, 2, 3]',
  },
  '.fit': {
    is: 'trains a model on inputs and labels',
    more: 'The scikit-learn convention: model.fit(X, y) learns the weights in place, then score or predict uses them. Here it trains small classifiers, such as linear probes, on frozen features.',
  },
  '.fit_transform': {
    is: 'fits a method to data and returns the result',
    more: 'The scikit-learn shortcut for fit followed by transform. For t-SNE it computes the low-dimensional embedding and returns it, one row per input: (N, 2) points to plot.',
  },
  '.format': {
    is: 'fills the {} placeholders in a string',
    more: 'Named fields are filled by keyword. A prompt template uses it to drop each question into the same text.',
    eg: '\'{q} = ?\'.format(q=\'2+2\')   # \'2+2 = ?\'',
  },
  '.get': {
    is: 'takes the next item from a queue',
    more: 'On a Python queue it removes and returns the oldest item, waiting while the queue is empty. On a dict, d.get(k) instead looks up a key and returns None when it is missing.',
  },
  '.items': { is: 'the (key, value) pairs of a dict', more: 'Loop over it to get both at once: for name, W in params.items().' },
  '.join': {
    is: 'glues a list of strings into one',
    more: 'The separator is the string it is called on: \', \'.join(words) puts a comma between words, and b\'\'.join(parts) concatenates byte strings with nothing between.',
    eg: '\'-\'.join([\'a\', \'b\', \'c\'])   # \'a-b-c\'',
  },
  '.maximum': {
    is: 'the elementwise maximum of two inputs',
    more: 'Called through a library other than NumPy, such as Theano\'s T.maximum(0, x), it is the same ReLU-style max as np.maximum. In Theano it adds a node to a symbolic graph; nothing is computed until the compiled function runs.',
  },
  '.mean': {
    is: 'the average, of everything or along an axis',
    more: 'With no axis it averages every element into one number, the usual way to turn per-example losses into one loss. axis=0 averages down the rows, one mean per column; keepdims=True keeps the axis for broadcasting.',
    eg: 'np.array([[1, 2], [3, 4]]).mean(0)  # [2. 3.]',
  },
  '.most_common': {
    is: 'the most frequent items, with their counts',
    more: 'On a Counter, most_common(n) returns a list of (item, count) pairs, largest count first, so votes.most_common(1)[0][0] is the winner of a majority vote.',
    eg: 'Counter(\'abca\').most_common(1)   # [(\'a\', 2)]',
  },
  '.normal': {
    is: 'random samples from a normal distribution',
    more: 'rng.normal(loc, scale, size) draws Gaussian numbers with mean loc and standard deviation scale (defaults 0 and 1); size gives the shape.',
    eg: 'rng.normal(0, 0.1, 3)   # 3 draws, std 0.1',
  },
  '.parameters': {
    is: 'every trainable weight of a model',
    more: 'In PyTorch it yields each weight tensor of the model and its submodules. Hand it to an optimizer, or loop over it to reach every gradient, as data-parallel training does to average them.',
  },
  '.permutation': {
    is: 'a random shuffle of 0 to n - 1',
    more: 'rng.permutation(n) returns 0 to n - 1 in random order; given an array instead, it returns a shuffled copy. Indexing several arrays with the same permutation shuffles them together.',
    eg: 'rng.permutation(4)   # e.g. [2 0 3 1]',
  },
  '.pop': {
    is: 'removes an item and returns it',
    more: 'On a list, pop() takes the last item and pop(0) the first, which makes a list work as a queue. On a dict, pop(key) removes that key and returns its value.',
    eg: 'xs = [5, 6, 7]; xs.pop(0)   # 5, leaving [6, 7]',
  },
  '.rand': {
    is: 'uniform random numbers in [0, 1)',
    more: 'rng.rand() returns one float and rng.rand(3, 4) a (3, 4) array. rng.rand() < p is a coin flip that comes up True with probability p.',
    eg: 'rng.rand() < 0.5   # True half the time',
  },
  '.randint': {
    is: 'random integers from low up to, not including, high',
    more: 'rng.randint(low, high, size) excludes high, like range; with one argument, randint(n) gives 0 to n - 1. size gives how many, or their shape.',
    eg: 'rng.randint(0, 10, 3)   # e.g. [7 0 4]',
  },
  '.ravel': {
    is: 'the array flattened to 1-D',
    more: 'The elements come out row by row. It returns a view when it can, sharing memory with the original, and does the same job as reshape(-1).',
    eg: 'np.zeros((2, 3)).ravel().shape   # (6,)',
  },
  '.repeat': {
    is: 'repeats each element along an axis',
    more: 'x.repeat(2, 0) writes every row twice, one after the other, and x.repeat(2, 1) every column, so chaining both upsamples an image by nearest neighbor. It returns a new array; without an axis it flattens first.',
    eg: 'np.array([1, 2]).repeat(2)   # [1 1 2 2]',
  },
  '.reshape': {
    is: 'the same numbers in a new shape',
    more: 'The total size must match, and one dimension can be -1 to have NumPy work it out. The numbers are read and refilled row by row, and the result is a view when possible, sharing memory.',
    eg: 'np.arange(6).reshape(2, -1).shape   # (2, 3)',
  },
  '.sort': {
    is: 'sorts a list in place',
    more: 'key gives the value to sort by and reverse=True puts the largest first. It returns None; sorted(xs) returns a new sorted list instead.',
    eg: 'xs = [3, 1, 2]; xs.sort()   # xs is [1, 2, 3]',
  },
  '.split': {
    is: 'breaks a string into a list of pieces',
    more: 'With no argument it splits on runs of whitespace, so a sentence becomes its words.',
    eg: '\'the cat sat\'.split()   # [\'the\', \'cat\', \'sat\']',
  },
  '.std': {
    is: 'the standard deviation, the typical spread',
    more: 'The square root of the variance: how far values typically sit from their mean. NumPy divides by N; axis=0 gives one value per column. Subtracting the mean and dividing by it standardizes data.',
    eg: 'np.array([1, 3]).std()   # 1.0',
  },
  '.step': {
    is: 'takes one update step with the optimizer',
    more: 'In PyTorch, opt.step() moves every parameter using the gradients that backward() just stored. The course\'s own optimizer objects work the same way: f.step(grad) applies one update from a gradient.',
  },
  '.swapaxes': {
    is: 'exchanges two axes of an array',
    more: 'k.swapaxes(1, 2) turns a (B, T, d) array into (B, d, T), transposing the last two axes and leaving the batch axis alone. It returns a view.',
  },
  '.transpose': {
    is: 'reorders the axes of an array',
    more: 'img.transpose(2, 0, 1) puts old axis 2 first, so an (H, W, 3) image becomes (3, H, W). With no arguments it reverses the axes, flipping a matrix to its transpose. It returns a view.',
    eg: 'img.transpose(2, 0, 1)   # (H,W,3) -> (3,H,W)',
  },
  '.uniform': {
    is: 'random numbers spread evenly between low and high',
    more: 'rng.uniform(low, high, size) draws floats in [low, high), every value equally likely. Data augmentation uses it to pick a random rotation, shear or contrast.',
    eg: 'rng.uniform(-10, 10)   # e.g. 3.71',
  },
  '.var': {
    is: 'the variance, the average squared spread',
    more: 'The mean of (x - x.mean()) ** 2, NumPy dividing by N; axis=0 gives one value per column. Its square root is the standard deviation.',
    eg: 'np.array([1, 3]).var()   # 1.0',
  },

  // Course helpers, defined or assumed in the lecture code.
  adam_update: {
    is: 'updates the weights with one Adam step',
    more: 'A course helper that hides the optimizer: it moves every parameter by the Adam rule, a step scaled per weight by running averages of the gradient and its square. Adam stands for adaptive moment estimation (Kingma and Ba, 2014).',
  },
  layer_norm: {
    is: 'normalizes each vector to mean 0 and variance 1',
    more: 'For each token\'s vector it subtracts the mean of its features and divides by their standard deviation, then scales by g and shifts by b, both learned. The name says it normalizes across a layer\'s features rather than across the batch, as batch norm does (Ba, Kiros and Hinton, 2016).',
  },
  relu: {
    is: 'max(0, x): keeps positives, zeros negatives',
    more: 'The rectified linear unit, the default activation in this course. A rectifier in electronics lets current through in one direction only. The NumPy lecture\'s version takes a leak that scales negatives instead of zeroing them, a leaky ReLU.',
    eg: 'relu(-2.0), relu(3.0)   # 0.0, 3.0',
  },
  sigmoid: {
    is: 'squashes any number into (0, 1)',
    more: 'sigmoid(z) = 1 / (1 + exp(-z)): large positive z gives nearly 1, large negative z nearly 0, and 0 gives 0.5, so the output reads as a probability or a gate. Sigmoid means S-shaped, after the Greek letter sigma.',
    eg: 'sigmoid(0.0)   # 0.5',
  },
  softmax: {
    is: 'turns scores into probabilities',
    more: 'It exponentiates every score and divides by the sum, so the outputs are positive and add to 1; subtracting the max first keeps exp from overflowing. With axis=1 it does this for every row. The name says it is a soft max: a smooth, differentiable stand-in for picking the largest score.',
    eg: 'softmax(np.array([0., 0.]))   # [0.5 0.5]',
  },
  softmax_loss: {
    is: 'the cross-entropy loss of the softmax',
    more: 'A course helper: it turns the scores into probabilities with softmax and returns -log of the probability given to the correct class y, averaged over the examples. PyTorch calls the same loss cross-entropy.',
  },

  // NumPy.
  'np.add.at': {
    is: 'adds into an array at indices, repeats included',
    more: 'np.add.at(a, idx, b) does a[idx] += b in place, except that an index listed twice gets both additions, where plain a[idx] += b keeps only one. An embedding\'s backward pass needs this when a token repeats.',
    eg: 'np.add.at(a, [0, 0], 1)   # a[0] grows by 2',
  },
  'np.all': {
    is: 'whether every element is True',
    more: 'With axis=0 it answers per column: np.all(Z <= 0, axis=0) marks the neurons that never fire on any example. np.any is its counterpart.',
    eg: 'np.all(np.array([1, 2]) > 0)   # True',
  },
  'np.allclose': {
    is: 'whether two arrays are equal up to rounding',
    more: 'True when every pair of elements agrees within a small tolerance (1e-5 relative plus 1e-8 absolute by default). Floats rarely match exactly, so this is how to check that two computations agree.',
    eg: 'np.allclose(0.1 + 0.2, 0.3)   # True',
  },
  'np.append': {
    is: 'a new array with values added at the end',
    more: 'It copies the whole array every time and flattens it unless axis is given, so it suits one-off changes such as adding the 1 for the bias trick, not growing an array in a loop.',
    eg: 'np.append([1, 2], 3)   # [1 2 3]',
  },
  'np.arange': {
    is: 'evenly spaced integers, like range',
    more: 'np.arange(N) is [0, 1, ..., N - 1]; the stop value is excluded. Paired with labels, scores[np.arange(N), y] picks one entry per row.',
    eg: 'np.arange(4)   # [0 1 2 3]',
  },
  'np.argmax': {
    is: 'the index of the largest value',
    more: 'With no axis it searches the flattened array; with axis=1 it returns one index per row, the predicted class of each example. Ties go to the first. The name is math notation: the argument (input) that maximizes.',
    eg: 'np.argmax([2.1, -0.4, 5.7])   # 2',
  },
  'np.argmin': {
    is: 'the index of the smallest value',
    more: 'Like argmax with the order reversed. Applied to distances it finds the nearest neighbor; applied to a loss curve, the best setting.',
    eg: 'np.argmin([4, 1, 3])   # 1',
  },
  'np.argsort': {
    is: 'the indices that would sort the array',
    more: 'Ascending, so a[np.argsort(a)] is sorted. For largest first, sort the negation, np.argsort(-a), and slice [:k] for the top k. Sorting random numbers this way gives a random shuffle.',
    eg: 'np.argsort([30, 10, 20])   # [1 2 0]',
  },
  'np.array': {
    is: 'makes a NumPy array from a list',
    more: 'Nested lists become rows, so a list of lists gives a 2-D array. It copies the data and picks one dtype for every element: all integers stay int, and a single float makes everything float.',
    eg: 'np.array([[1, 2], [3, 4]]).shape   # (2, 2)',
  },
  'np.array_split': {
    is: 'splits an array into n nearly equal parts',
    more: 'Returns a list of n arrays cut along axis (default 0). Unlike np.split, n need not divide the length: the sizes differ by at most one. Cross-validation uses it to make folds.',
    eg: 'np.array_split(np.arange(5), 2)  # [0 1 2] [3 4]',
  },
  'np.bincount': {
    is: 'counts how often each integer appears',
    more: 'For non-negative integers it returns an array whose entry i is the number of times i occurs. minlength makes room for values that never appear, giving one slot per class or expert.',
    eg: 'np.bincount([0, 2, 2])   # [1 0 2]',
  },
  'np.ceil': {
    is: 'rounds up to the next whole number',
    more: 'It returns a float, so wrap it in int() for a count, such as a capacity per expert.',
    eg: 'np.ceil(2.1)   # 3.0',
  },
  'np.clip': {
    is: 'limits every value to a range',
    more: 'Values below lo become lo and values above hi become hi; the rest pass through. It returns a new array unless out= names one to overwrite, as when clipping gradients in place.',
    eg: 'np.clip([-3, 2, 7], 0, 5)   # [0 2 5]',
  },
  'np.concatenate': {
    is: 'joins arrays end to end along an existing axis',
    more: 'It takes a list of arrays and joins them along axis (default 0), so their shapes must match on every other axis. The number of dimensions stays the same; np.stack adds a new one instead.',
    eg: 'np.concatenate([[1, 2], [3]])   # [1 2 3]',
  },
  'np.copy': {
    is: 'an independent copy of an array',
    more: 'The same as a.copy(): changes to the copy never reach the original. Gradient code copies the probabilities before editing them in place.',
    eg: 'b = np.copy(a)   # editing b leaves a alone',
  },
  'np.cos': {
    is: 'the cosine of every element',
    more: 'Angles are in radians. Sines and cosines at many frequencies encode positions in transformers, and RoPE uses them to rotate pairs of features.',
    eg: 'np.cos(np.pi)   # -1.0',
  },
  'np.cov': {
    is: 'the covariance matrix of the data',
    more: 'By default each row is a variable; rowvar=False treats each row as one sample instead, so N rows of D features give a (D, D) matrix. It subtracts the mean and divides by N - 1.',
    eg: 'np.cov(X, rowvar=False).shape   # (D, D)',
  },
  'np.cumprod': {
    is: 'the running product',
    more: 'Entry i is the product of the first i + 1 elements. In diffusion, alpha_bar[t] multiplies every alpha up to step t: how much of the signal survives.',
    eg: 'np.cumprod([2, 3, 4])   # [2 6 24]',
  },
  'np.cumsum': {
    is: 'the running total',
    more: 'Entry i is the sum of the first i + 1 elements, so the output has the input\'s length; axis picks the direction in 2-D. It counts hits so far and builds cumulative probabilities.',
    eg: 'np.cumsum([1, 2, 3])   # [1 3 6]',
  },
  'np.diag': {
    is: 'the diagonal of a matrix, or a diagonal matrix',
    more: 'Given a 2-D array it returns the diagonal as a 1-D array; given a 1-D array it builds a square matrix with those values on the diagonal. In a similarity matrix the diagonal holds the matching pairs.',
    eg: 'np.diag(np.eye(3))   # [1. 1. 1.]',
  },
  'np.diff': {
    is: 'the differences between neighbors',
    more: 'It returns a[1:] - a[:-1], one element shorter than the input. Multiplying the steps by heights and summing gives the area under a step curve.',
    eg: 'np.diff([0, 1, 4, 9])   # [1 3 5]',
  },
  'np.dot': {
    is: 'the dot product or matrix product',
    more: 'For two 1-D arrays it sums the elementwise products into one number; for 2-D arrays it is the matrix product a @ b, and the inner sizes must match. For plain numbers it just multiplies.',
    eg: 'np.dot([1, 2], [3, 4])   # 11',
  },
  'np.einsum': {
    is: 'a sum over indices, written as a formula',
    more: 'The string names every axis: \'nchw,c->nhw\' multiplies along the shared c and sums it away, keeping n, h and w. Named for Einstein summation notation, where a repeated index means a sum over it.',
    eg: 'np.einsum(\'ij,j->i\', A, x)   # A @ x',
  },
  'np.exp': {
    is: 'e to the power of every element',
    more: 'It makes scores positive in softmax and turns log-probabilities back into probabilities. It overflows to inf past about 709, which is why softmax subtracts the max first.',
    eg: 'np.exp(0.0)   # 1.0',
  },
  'np.eye': {
    is: 'the identity matrix',
    more: 'np.eye(N) is N by N with ones on the diagonal and zeros elsewhere. Indexing its rows, np.eye(V)[ids], turns integer ids into one-hot vectors. The name is a pun on I, the usual symbol for the identity.',
    eg: 'np.eye(3)[1]   # [0. 1. 0.]',
  },
  'np.fft.irfft2': {
    is: 'the inverse 2-D FFT, back to a real array',
    more: 'It undoes np.fft.rfft2: given the half spectrum and the output shape, it returns the real 2-D array. Multiplying two spectra and inverting the product computes a convolution.',
  },
  'np.fft.rfft2': {
    is: 'the 2-D Fourier transform of a real array',
    more: 'FFT stands for fast Fourier transform. The shape argument zero-pads the input to (n, n) first, and because the input is real only half the last axis is kept, n // 2 + 1 columns. In frequency space, convolution becomes elementwise multiplication.',
  },
  'np.fill_diagonal': {
    is: 'overwrites the diagonal of a matrix, in place',
    more: 'It changes the array passed in and returns None. Filling with -np.inf removes each item\'s similarity to itself before a softmax.',
    eg: 'np.fill_diagonal(S, 0)   # S changed in place',
  },
  'np.float16': {
    is: 'a 16-bit float: about 3 significant digits',
    more: 'Calling it converts a number to half precision. The gap between neighbors just below 1.0 is 2 ** -11, so a small update to a weight of 1.0 rounds away to nothing.',
    eg: 'np.float16(1.0 - 1e-4)   # 1.0',
  },
  'np.float32': {
    is: 'a 32-bit float: about 7 significant digits',
    more: 'Single precision, the standard format for training neural networks on GPUs: half the memory of float64, and far more range and precision than float16.',
  },
  'np.float64': {
    is: 'a 64-bit float: about 16 significant digits',
    more: 'Double precision, NumPy\'s default for floating-point arrays. Numerical gradient checks use it so rounding error does not swamp the comparison.',
  },
  'np.floor': {
    is: 'rounds down to a whole number',
    more: 'It rounds toward minus infinity and returns a float. Multiplying back, np.floor(v / u) * u snaps v down to a grid of step u.',
    eg: 'np.floor(-1.5)   # -2.0',
  },
  'np.full': {
    is: 'an array filled with one value',
    more: 'np.full(shape, value) is np.zeros or np.ones for any constant. np.full((T, T), -np.inf) is the start of an attention mask.',
    eg: 'np.full(3, 0.5)   # [0.5 0.5 0.5]',
  },
  'np.hstack': {
    is: 'joins arrays side by side',
    more: 'For 2-D arrays it concatenates along axis 1, so the row counts must match; 1-D arrays are joined end to end. Adding b as an extra column of W this way is the bias trick.',
  },
  'np.indices': {
    is: 'the row and column index of every position',
    more: 'For a shape (H, W) it returns an array of shape (2, H, W): a grid of row numbers and a grid of column numbers. Unpacked as rows, cols, they let fancy indexing pick one entry per pixel.',
    eg: 'rows, cols = np.indices((2, 3))   # each (2, 3)',
  },
  'np.linalg.eigh': {
    is: 'eigenvalues and eigenvectors of a symmetric matrix',
    more: 'It returns the eigenvalues in ascending order and the eigenvectors as the columns of a matrix. The h stands for Hermitian, the complex-number version of symmetric; covariance matrices qualify.',
  },
  'np.linalg.norm': {
    is: 'the length of a vector',
    more: 'By default the Euclidean length, the square root of the sum of squares; for a matrix, the same over all entries (the Frobenius norm). axis=0 gives one length per column, and the norm of a difference is the L2 distance.',
    eg: 'np.linalg.norm([3, 4])   # 5.0',
  },
  'np.linalg.solve': {
    is: 'solves the linear system A x = b',
    more: 'np.linalg.solve(H, g) returns the x with H x = g, faster and more accurate than forming the inverse of H. A Newton step is w - np.linalg.solve(H, dw).',
  },
  'np.linalg.svd': {
    is: 'the singular value decomposition of a matrix',
    more: 'It returns U, the singular values S as a 1-D array (largest first), and Vt, already transposed, so a square M equals (U * S) @ Vt. For a covariance matrix, the columns of U are the principal directions.',
  },
  'np.linspace': {
    is: 'n evenly spaced numbers from start to stop',
    more: 'Both ends are included, so np.linspace(-3, 3, 7) steps by 1. It makes plot grids and schedules; np.arange takes a step size instead of a count.',
    eg: 'np.linspace(0, 1, 3)   # [0. 0.5 1.]',
  },
  'np.log': {
    is: 'the natural logarithm of every element',
    more: 'Base e, the inverse of np.exp. -np.log(p) turns a probability into a loss: 0 when p is 1, growing without bound as p approaches 0. np.log(0) is -inf.',
    eg: 'np.log(np.e)   # 1.0',
  },
  'np.log10': {
    is: 'the base-10 logarithm',
    more: 'Each unit is a factor of ten. Taking log10 of both axes turns a power law into a straight line.',
    eg: 'np.log10(1000)   # 3.0',
  },
  'np.log2': {
    is: 'the base-2 logarithm',
    more: 'It measures information in bits: -np.log2(p) is the number of bits needed for an event of probability p.',
    eg: 'np.log2(8)   # 3.0',
  },
  'np.logspace': {
    is: 'numbers evenly spaced on a log scale',
    more: 'np.logspace(a, b, n) runs from 10 ** a to 10 ** b in n steps (50 by default) with a constant ratio between neighbors, like model sizes in a scaling sweep.',
    eg: 'np.logspace(0, 2, 3)   # [1. 10. 100.]',
  },
  'np.maximum': {
    is: 'the elementwise larger of two arrays',
    more: 'It compares element by element, broadcasting a scalar: np.maximum(0, x) is ReLU and the hinge in the SVM loss. np.max, by contrast, finds the single largest value of one array.',
    eg: 'np.maximum(0, [-2, 3])   # [0 3]',
  },
  'np.maximum.accumulate': {
    is: 'the running maximum',
    more: 'Entry i is the largest of the first i + 1 elements. Run over a reversed precision curve and reversed back, it gives the non-increasing envelope used for average precision.',
    eg: 'np.maximum.accumulate([1, 3, 2])   # [1 3 3]',
  },
  'np.mean': {
    is: 'the average, of everything or along an axis',
    more: 'With no axis it returns one number; axis=0 averages over the rows, one value per column. On a boolean array such as y_pred == y, the mean is the fraction that are True: the accuracy.',
    eg: 'np.mean([True, False, True, True])   # 0.75',
  },
  'np.memmap': {
    is: 'an array backed by a file on disk',
    more: 'np.memmap(path, dtype) maps the file into memory without reading it, and the operating system loads only the parts that get indexed. A dataset larger than RAM can then be sliced like an ordinary array.',
  },
  'np.meshgrid': {
    is: 'coordinate grids from 1-D axes',
    more: 'Given one vector per axis, it returns full 2-D arrays holding every point\'s coordinates. indexing=\'ij\' makes the first output vary down the rows, matching array indexing; the default \'xy\' follows plotting convention.',
  },
  'np.minimum': {
    is: 'the elementwise smaller of two arrays',
    more: 'It compares element by element, broadcasting a scalar: np.minimum(1, x) caps x at 1. PPO-style objectives take the minimum of the clipped and unclipped terms, a pessimistic bound.',
    eg: 'np.minimum(1, [0.5, 2])   # [0.5 1.]',
  },
  'np.ndindex': {
    is: 'every index tuple of a shape, in order',
    more: 'for i, j in np.ndindex(2, 3) visits (0, 0), (0, 1), ... (1, 2): nested loops in one line, for any number of dimensions. np.ndindex(W.shape) visits every entry of W.',
  },
  'np.ones': {
    is: 'an array of ones of a given shape',
    more: 'The shape is one number or a tuple, as in np.ones((T, T)); the default dtype is float64. Passed to np.tril it builds a causal mask.',
    eg: 'np.ones((2, 3)).shape   # (2, 3)',
  },
  'np.ones_like': { is: 'ones with the same shape and dtype as x', eg: 'np.ones_like(np.zeros(3))   # [1. 1. 1.]' },
  'np.outer': {
    is: 'every product a[i] * b[j], as a matrix',
    more: 'The result has shape (len(a), len(b)). A linear layer\'s weight gradient for one example is the outer product of the upstream gradient and the input.',
    eg: 'np.outer([1, 2], [3, 4])   # [[3 4] [6 8]]',
  },
  'np.pad': {
    is: 'adds a border around an array',
    more: 'np.pad(x, 1) adds one zero on both sides of every axis; one pair per axis, such as ((1, 1), (1, 1), (0, 0)), pads height and width but not channels. Zero padding keeps a convolution\'s output the same size.',
    eg: 'np.pad([1, 2], 1)   # [0 1 2 0]',
  },
  'np.polyfit': {
    is: 'fits a polynomial by least squares',
    more: 'np.polyfit(x, y, 1) fits a straight line and returns [slope, intercept], highest power first. On log-log data the slope is the exponent of a power law.',
    eg: 'np.polyfit([0, 1, 2], [1, 3, 5], 1)  # [2. 1.]',
  },
  'np.prod': {
    is: 'the product of all elements',
    more: 'It multiplies where np.sum adds, and axis works the same way. A product of many probabilities underflows to 0.0, which is why sequence models add log-probabilities instead.',
    eg: 'np.prod([1, 2, 3, 4])   # 24',
  },
  'np.ptp': {
    is: 'the range: maximum minus minimum',
    more: 'The name stands for peak to peak. Subtracting the min and dividing by it rescales an array to [0, 1] for display.',
    eg: 'np.ptp([2, 9, 5])   # 7',
  },
  'np.random.choice': {
    is: 'random picks from a range or an array',
    more: 'np.random.choice(N, B) picks B integers below N, with replacement unless replace=False. p gives each option\'s probability, which is how a model samples its next token or action.',
    eg: 'np.random.choice(3, p=[0, 0, 1])   # 2',
  },
  'np.random.rand': {
    is: 'uniform random numbers in [0, 1)',
    more: 'The arguments are the shape, written out: np.random.rand(500, 2) is a (500, 2) array, and no argument gives one float. np.random.rand(H) < p is a random mask keeping each unit with probability p.',
    eg: 'np.random.rand(2, 3).shape   # (2, 3)',
  },
  'np.random.randint': {
    is: 'random integers from low up to, not including, high',
    more: 'np.random.randint(4) gives 0 to 3; np.random.randint(low, high, size) excludes high, like range. size gives how many, or their shape.',
    eg: 'np.random.randint(1, 7)   # a die roll',
  },
  'np.random.randn': {
    is: 'samples from the standard normal distribution',
    more: 'Mean 0, standard deviation 1, with the arguments giving the shape: 0.01 * np.random.randn(D, C) is the classic small weight initialization. The n stands for normal.',
    eg: 'np.random.randn(10, 3072).shape  # (10, 3072)',
  },
  'np.random.seed': {
    is: 'fixes where the random numbers start',
    more: 'After np.random.seed(s), the same sequence of random numbers follows every time, so a run can be reproduced; different seeds give different initializations.',
  },
  'np.random.uniform': {
    is: 'random numbers spread evenly between low and high',
    more: 'np.random.uniform(low, high, size) draws floats in [low, high), every value equally likely. np.random.uniform(-1, 1, 100) is a typical GAN noise vector.',
    eg: 'np.random.uniform(-1, 1, 100).shape   # (100,)',
  },
  'np.repeat': {
    is: 'repeats each element along an axis',
    more: 'np.repeat(k, g, axis=0) writes every row g times, one after the other, so a few shared key and value heads can line up with many query heads. Without axis it flattens first.',
    eg: 'np.repeat([1, 2], 2)   # [1 1 2 2]',
  },
  'np.roll': {
    is: 'shifts an array circularly',
    more: 'Elements pushed off one end come back at the other. np.roll(x, 4, axis=1) shifts columns right by 4; tuples shift several axes at once, and without axis the array is shifted as if flattened.',
    eg: 'np.roll([1, 2, 3], 1)   # [3 1 2]',
  },
  'np.rot90': {
    is: 'rotates an array by 90 degrees',
    more: 'np.rot90(x, k) turns the first two axes counterclockwise k times, so an (H, W, 3) image rotates and keeps its channels. It returns a view.',
    eg: 'np.rot90([[1, 2], [3, 4]])   # [[2 4] [1 3]]',
  },
  'np.round': {
    is: 'rounds to the nearest whole number',
    more: 'Exact halves go to the even neighbor, so np.round(2.5) is 2.0, and the result stays a float; decimals= rounds to that many places instead. Quantization rounds each scaled weight to an integer level.',
    eg: 'np.round([1.4, 2.5, 3.5])   # [1. 2. 4.]',
  },
  'np.searchsorted': {
    is: 'where a value would go in a sorted array',
    more: 'np.searchsorted(a, v) returns the index at which inserting v keeps a sorted, the count of elements smaller than v. On a cumulative sum it finds how many items it takes to reach a total.',
    eg: 'np.searchsorted([1, 3, 5], 4)   # 2',
  },
  'np.sign': {
    is: 'the sign of every element: -1, 0 or +1',
    more: 'It keeps only the direction of each value, so x + eps * np.sign(dx) moves every pixel by exactly eps. It is also the gradient of the absolute value, used by L1 regularization.',
    eg: 'np.sign([-2.5, 0, 3])   # [-1. 0. 1.]',
  },
  'np.sin': {
    is: 'the sine of every element',
    more: 'Angles are in radians. Transformers write positions as sines and cosines at many frequencies, and toy datasets use it for curved shapes.',
    eg: 'np.sin(np.pi / 2)   # 1.0',
  },
  'np.sqrt': {
    is: 'the square root of every element',
    more: 'It appears as the 1 / np.sqrt(d) scale in attention and weight initialization, which keeps variances near 1, and in Adam\'s division by the root of the squared-gradient average.',
    eg: 'np.sqrt([4, 9])   # [2. 3.]',
  },
  'np.stack': {
    is: 'stacks equal-shape arrays along a new axis',
    more: 'N arrays of shape (D,) become one (N, D) array with the default axis=0. Unlike np.concatenate, it adds a dimension.',
    eg: 'np.stack([[1, 2], [3, 4]]).shape   # (2, 2)',
  },
  'np.std': {
    is: 'the standard deviation, of everything or along an axis',
    more: 'How far values typically sit from their mean, NumPy dividing by N. np.std(X, axis=0) gives one value per feature, the divisor that standardizes each column.',
    eg: 'np.std([1, 3])   # 1.0',
  },
  'np.tanh': {
    is: 'the hyperbolic tangent of every element',
    more: 'An S-shaped squashing function from -1 to 1, zero-centered unlike the sigmoid; it equals 2 * sigmoid(2x) - 1. The classic RNN applies it to its hidden state.',
    eg: 'np.tanh(0.0)   # 0.0',
  },
  'np.tril': {
    is: 'keeps the lower triangle, zeroing above the diagonal',
    more: 'np.tril(np.ones((T, T))) is the causal mask: row t has ones up to column t, so each position sees only itself and earlier ones. tril is short for triangle, lower.',
    eg: 'np.tril(np.ones((2, 2)))   # [[1. 0.] [1. 1.]]',
  },
  'np.triu': {
    is: 'keeps the upper triangle, zeroing below the diagonal',
    more: 'The second argument shifts the diagonal: np.triu(M, 1) keeps only the entries strictly above it. Applied to a matrix of -inf, it builds the mask that hides future tokens.',
    eg: 'np.triu(np.ones((2, 2)), 1)  # [[0. 1.] [0. 0.]]',
  },
  'np.uint8': {
    is: 'an 8-bit unsigned integer, 0 to 255',
    more: 'The dtype of image pixels. Arithmetic wraps around modulo 256, so np.uint8(10) - np.uint8(20) is 246; convert to int or float before subtracting images.',
    eg: 'np.uint8(10) - np.uint8(20)   # 246',
  },
  'np.vstack': {
    is: 'stacks arrays on top of each other',
    more: 'It joins along axis 0, turning 1-D arrays into rows first. Putting a class token above the patch tokens this way makes one (N + 1, D) sequence.',
    eg: 'np.vstack([[1, 2], [3, 4]]).shape   # (2, 2)',
  },
  'np.where': {
    is: 'picks from x where the condition holds, else y',
    more: 'np.where(cond, x, y) works element by element, broadcasting scalars: np.where(z > 0, z, 0.01 * z) is a leaky ReLU. With only a condition it returns the indices where it is True.',
    eg: 'np.where([True, False], 1, 0)   # [1 0]',
  },
  'np.zeros': {
    is: 'an array of zeros of a given shape',
    more: 'The shape is one number or a tuple, as in np.zeros((N, D)); the default dtype is float64, and dtype=int makes integers. It allocates an array to fill in later.',
    eg: 'np.zeros((2, 3)).shape   # (2, 3)',
  },
  'np.zeros_like': {
    is: 'zeros with the same shape and dtype as x',
    more: 'The usual way to start a gradient that matches its weights: dW = np.zeros_like(W).',
  },

  // Matplotlib.
  'plt.axis': { is: 'sets or hides the plot axes', more: 'plt.axis(\'off\') hides the ticks and frame, the usual choice when showing images.' },
  'plt.axvline': {
    is: 'draws a vertical line across the plot',
    more: 'The line sits at the given x and spans the full height; ls=\'--\' makes it dashed. It marks a reference value.',
  },
  'plt.barh': {
    is: 'draws a horizontal bar chart',
    more: 'One bar per position, its length given by the value. The h is for horizontal; plt.bar draws vertical bars.',
  },
  'plt.hist': {
    is: 'draws a histogram of the values',
    more: 'It sorts the values into bins and draws one bar per bin, showing how they are distributed; bins= sets how many.',
  },
  'plt.imshow': {
    is: 'shows a 2-D array as an image',
    more: 'An (H, W, 3) array is drawn in color, as uint8 from 0 to 255 or floats from 0 to 1; an (H, W) array is drawn as a heatmap.',
  },
  'plt.plot': {
    is: 'draws a line through the points',
    more: 'plt.plot(xs, ys) connects the (x, y) pairs; with one argument the x-values are 0, 1, 2, ..., handy for a loss history.',
  },
  'plt.show': { is: 'displays the figure', more: 'It renders everything drawn so far, in a window or below a notebook cell.' },
  'plt.subplot': {
    is: 'picks one cell of a grid of plots',
    more: 'plt.subplot(rows, cols, i) makes cell i current, counting from 1 across each row; the drawing calls that follow go into that cell.',
  },
  'plt.xscale': {
    is: 'sets the x-axis scale, such as log',
    more: 'plt.xscale(\'log\') gives every factor of ten the same width. With a log y-axis too, a power law plots as a straight line.',
  },
  'plt.yscale': {
    is: 'sets the y-axis scale, such as log',
    more: 'plt.yscale(\'log\') gives every factor of ten the same height, so a loss that keeps shrinking stays readable.',
  },

  // Python standard library.
  're.findall': {
    is: 'every match of a pattern in a string',
    more: 'It returns the matches as a list of strings, left to right, without overlaps. re is Python\'s regular-expression module; a tokenizer uses it to cut text into chunks before BPE.',
    eg: 're.findall(r"\\d+", "a1b22")   # [\'1\', \'22\']',
  },

  // PyTorch.
  'torch.empty_like': {
    is: 'an uninitialized tensor shaped like another',
    more: 'Same shape, dtype and device as its argument, but the contents are whatever was in memory. It is cheap, and safe whenever every entry is written before it is read.',
  },
  'torch.no_grad': {
    is: 'turns off gradient tracking inside its block',
    more: 'Inside with torch.no_grad():, PyTorch records no computation graph, so nothing there receives gradients and memory is saved. It is used for frozen models, such as the reference model in DPO, and for evaluation.',
  },
};
