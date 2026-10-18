import type { ChapterDef } from './index';

const OFFICIAL = 'https://cs231n.github.io/assignments2016/assignment1/';

const chapter: ChapterDef = {
  symbols: {},

  render(p) {
    p.prose(`
Assignment 1 of the 2016 course builds a complete image classification pipeline, several times over, on the **CIFAR-10** dataset: 60,000 color images of 32 × 32 pixels in ten classes (airplane, automobile, bird, cat, deer, dog, frog, horse, ship, truck), split into 50,000 for training and 10,000 for testing. You implement five classifiers in vectorized NumPy and compare them honestly using validation data.

It was due on **January 20, 2016**, about two and a half weeks into the course, and was worth 15% of the grade. It has five questions worth 100 points, plus up to 10 bonus points. This page describes what each question asks; the work itself happens in the original starter notebooks, linked from the [official assignment page](${OFFICIAL}).`);
    p.table(
      ['Question', 'Notebook', 'Topic', 'Points'],
      [
        ['[Q1](#/a1/q1)', '`knn.ipynb`', 'k-nearest neighbor classifier', '20'],
        ['[Q2](#/a1/q2)', '`svm.ipynb`', 'multiclass SVM trained with SGD', '25'],
        ['[Q3](#/a1/q3)', '`softmax.ipynb`', 'Softmax classifier', '20'],
        ['[Q4](#/a1/q4)', '`two_layer_net.ipynb`', 'two-layer neural network', '25'],
        ['[Q5](#/a1/q5)', '`features.ipynb`', 'classifiers on image features', '10'],
        ['[Q6](#/a1/q6)', 'your choice', 'bonus: do something extra', '+10'],
      ],
    );

    p.h2('Goals', 'goals');
    p.prose(`
By the end of this assignment you should:

- understand the image classification pipeline and the data-driven approach: a training stage that learns from labeled images, and a prediction stage that labels new ones;
- know why data is split into training, validation and test sets, and how to use the validation set (or cross-validation) to choose hyperparameters;
- be fluent at writing fast, loop-free NumPy code;
- have implemented and applied a k-nearest neighbor classifier, a multiclass SVM, a Softmax classifier and a two-layer neural network;
- understand the tradeoffs between those classifiers;
- have seen how much higher-level features (color histograms and histograms of oriented gradients) help compared with raw pixels.`);

    p.h2('Setup in 2016', 'setup');
    p.prose(`
The 2016 environment, in brief:

1. **Get the starter code.** The zip file is linked from the [official assignment page](${OFFICIAL}). It contains the notebooks and a small Python package, \`cs231n\`, with the files you edit.
2. **Install the dependencies.** The recommended route was the Anaconda Python distribution, which already includes NumPy, SciPy, matplotlib and IPython. The alternative was a virtual environment (\`virtualenv .env\`, \`source .env/bin/activate\`, \`pip install -r requirements.txt\`). Students could also boot a preconfigured cloud machine image on Terminal.com.
3. **Download CIFAR-10.** From \`cs231n/datasets\`, run \`./get_datasets.sh\`. It fetches the Python version of CIFAR-10 (about 170 MB) from the University of Toronto and unpacks it.
4. **Start IPython.** Run the notebook server from the assignment directory and open the notebooks in order. On OS X inside a virtual environment, the provided \`start_ipython_osx.sh\` works around a matplotlib problem.
5. **Submit.** Run \`collectSubmission.sh\`, which zips your code and completed notebooks (without the dataset) into \`assignment1.zip\`, and upload it to the course site.`);
    p.callout('warning', 'This is a 2016 codebase: Python 2.7 (it uses `print` statements and `xrange`) with library versions pinned to late 2015 (NumPy 1.10, SciPy 0.16, matplotlib 1.5, IPython 4). To run it today you need either a Python 2.7 environment or a few mechanical edits for Python 3. As of 2026 the starter code and the CIFAR-10 download were still online.', 'Running it today');

    p.h2('The files you work in', 'files');
    p.prose(`
Everything you edit lives in the \`cs231n\` package that comes with the starter code. The classifiers are in its \`classifiers\` folder:

- \`k_nearest_neighbor.py\`: the \`KNearestNeighbor\` class. You write three distance functions and the label vote (Q1).
- \`linear_svm.py\`: the SVM loss. You add its gradient, then write a loop-free version of both (Q2).
- \`softmax.py\`: the Softmax loss. You write a looped and a loop-free version, each with its gradient (Q3).
- \`linear_classifier.py\`: the \`LinearClassifier\` base class, with subclasses \`LinearSVM\` and \`Softmax\`. You write \`train\` (minibatch SGD) and \`predict\` (Q2, reused in Q3).
- \`neural_net.py\`: the \`TwoLayerNet\` class. You write \`loss\`, \`train\` and \`predict\` (Q4).

The rest of the package is provided: \`features.py\` (HOG and color-histogram features, used in Q5), \`gradient_check.py\` (numerical gradients), \`data_utils.py\` (the CIFAR-10 loader) and \`vis_utils.py\` (image grids). Each notebook also has cells marked TODO, for experiments such as cross-validation and hyperparameter searches. The listings on this page show only each function's signature and its job, never its body.`);
    p.callout('aside', 'The starter code stores one image per **row**: `X` has shape (N, D) and the weights `W` have shape (D, C), so the scores are `X.dot(W)`. That is the transpose of the $Wx$ convention in the notes and in [chapter 4](#/linear-classification). The SVM and Softmax notebooks also append a constant 1 to every image (the bias trick), so D is 3,073 rather than 3,072.', 'Shapes in the starter code');

    p.h2('Q1: k-nearest neighbor (20 points)', 'q1');
    p.prose(`
- **Notebook:** \`knn.ipynb\`
- **You edit:** \`k_nearest_neighbor.py\`, plus the cross-validation cells in the notebook
- **Read first:** [chapter 3](#/image-classification) for kNN, distances and cross-validation; [chapter 2](#/numpy) for broadcasting

The notebook loads CIFAR-10 and, to keep things fast, works with a subsample of 5,000 training images and 500 test images, each flattened to a row of 3,072 numbers. "Training" a kNN classifier only stores the data; all the work is in comparing each test image with every training image.`);
    p.code(`
      class KNearestNeighbor(object):
          def train(self, X, y):
              """Store the training data. Provided."""
          def predict(self, X, k=1, num_loops=0):
              """Distances, then votes. Provided."""
          def compute_distances_two_loops(self, X):
              """(num_test, num_train) matrix of L2 distances,
              one test/train pair at a time."""
          def compute_distances_one_loop(self, X):
              """The same matrix, looping only over test images."""
          def compute_distances_no_loops(self, X):
              """The same matrix with no Python loops."""
          def predict_labels(self, dists, k=1):
              """For each test image, the most common label
              among its k nearest training images."""
    `, { title: 'k_nearest_neighbor.py' });
    p.prose(`
### What you do

1. Write the two-loop distance function. The notebook draws the resulting 500 × 5,000 distance matrix as an image.
2. Write the label vote and classify the test images with $k = 1$, then $k = 5$.
3. Write the one-loop and fully vectorized versions. The notebook checks that all three produce the same matrix (using the Frobenius norm of the difference) and times them against each other.
4. Choose $k$ by **5-fold cross-validation**: split the training images into five folds, and for each $k$ in 1, 3, 5, 8, 10, 12, 15, 20, 50 and 100, train on four folds and measure accuracy on the fifth, rotating through all five. Plot the mean and spread of the accuracies for each $k$, pick the best, then retrain on all 5,000 images and evaluate on the test set.

### What you answer

- The distance matrix shows some distinctly bright rows and some distinctly bright columns. What in the data causes each?

### What to expect

About 27% test accuracy with $k = 1$, a little better with $k = 5$, and above 28% with the cross-validated $k$. Ten classes means guessing gets 10%, so kNN on raw pixels is better than chance but not by much. The fully vectorized distance computation should be dramatically faster than both loop versions.`);

    p.h2('Q2: training a multiclass SVM (25 points)', 'q2');
    p.prose(`
- **Notebook:** \`svm.ipynb\`
- **You edit:** \`linear_svm.py\` and \`linear_classifier.py\`, plus the tuning cells in the notebook
- **Read first:** [chapter 4](#/linear-classification) for the score function and the [SVM loss](#/linear-classification/svm); [chapter 5](#/optimization) for gradients, gradient checking and stochastic gradient descent

This notebook uses the full dataset: 49,000 training images, 1,000 validation images taken from the end of the training set, 1,000 test images, and a 500-image development subset of the training set for quick experiments. It subtracts the mean training image from every image and appends the bias column of ones.`);
    p.code(`
      def svm_loss_naive(W, X, y, reg):
          """Loss with explicit loops (provided).
          You add the gradient dW. Returns (loss, dW)."""
      def svm_loss_vectorized(W, X, y, reg):
          """The same loss and gradient, without loops."""

      class LinearClassifier(object):
          def train(self, X, y, learning_rate=1e-3, reg=1e-5,
                    num_iters=100, batch_size=200, verbose=False):
              """Minibatch SGD on self.loss.
              Returns the loss at every iteration."""
          def predict(self, X):
              """The highest-scoring class for each row of X."""
    `, { title: 'linear_svm.py, linear_classifier.py' });
    p.prose(`
### What you do

1. Derive the gradient of the SVM loss and add it to the looped implementation. Check it against a numerical gradient at a few random coordinates, with and without regularization.
2. Write the vectorized loss, then the vectorized gradient. The notebook compares both with the looped version for correctness and speed.
3. Write \`train\`: sample a minibatch, evaluate the loss and gradient, and take a gradient step. Plot the loss against the iteration number.
4. Write \`predict\` and measure training and validation accuracy.
5. Search over learning rates and regularization strengths, training on the training set and scoring on the validation set. Plot the results, keep the best model and evaluate it on the test set.
6. Visualize the learned weights: each class's row of weights, reshaped back into a 32 × 32 color image.

### What you answer

- A gradient check occasionally disagrees in one coordinate. What could cause that, and is it a reason for concern? Give a one-dimensional example where a gradient check could fail. (The hinge in the SVM loss is the clue: it is not differentiable everywhere.)
- Describe what the visualized weights look like, and explain why they look that way.

### What to expect

With careful tuning, about 40% accuracy on the validation set, and test accuracy close to that.`);

    p.h2('Q3: a Softmax classifier (20 points)', 'q3');
    p.prose(`
- **Notebook:** \`softmax.ipynb\`
- **You edit:** \`softmax.py\`, plus the tuning cells in the notebook
- **Read first:** the [Softmax section of chapter 4](#/linear-classification/softmax), including its note on numerical stability; [chapter 5](#/optimization)

The same pipeline as Q2, with the cross-entropy loss in place of the hinge loss. The data preparation is identical, and your \`train\` and \`predict\` from Q2 are reused through the \`Softmax\` subclass of \`LinearClassifier\`.`);
    p.code(`
      def softmax_loss_naive(W, X, y, reg):
          """Softmax loss and gradient with explicit loops.
          Returns (loss, dW)."""
      def softmax_loss_vectorized(W, X, y, reg):
          """The same, with no explicit loops."""
    `, { title: 'softmax.py' });
    p.prose(`
### What you do

1. Write the looped loss. With small random weights the loss should come out close to $-\\log(0.1) \\approx 2.3$, a useful sanity check.
2. Add the looped gradient and check it numerically, with and without regularization.
3. Write the vectorized version and compare it with the looped one for agreement and speed.
4. Tune the learning rate and regularization strength on the validation set, evaluate the best model on the test set, and visualize its weights.

### What you answer

- Why should the loss with small random weights be close to $-\\log(0.1)$?

### What to expect

Over 35% on the validation set. Chapter 4's [comparison table](#/linear-classification/svm-vs-softmax) explains why SVM and Softmax usually land close together.`);

    p.h2('Q4: a two-layer neural network (25 points)', 'q4');
    p.prose(`
- **Notebook:** \`two_layer_net.ipynb\`
- **You edit:** \`neural_net.py\`, plus the tuning cells in the notebook
- **Read first:** [chapter 6](#/backprop) for backpropagation, [chapter 7](#/nn-architecture) for the architecture, [chapter 9](#/nn-learning) for reading loss curves and tuning, and [chapter 10](#/case-study), which builds a small version of this network step by step

The network is: input, fully connected layer, ReLU, fully connected layer, softmax loss, with L2 regularization on both weight matrices. Its parameters live in a dictionary, \`self.params\`, with \`W1\` of shape (D, H), \`b1\` of shape (H,), \`W2\` of shape (H, C) and \`b2\` of shape (C,).`);
    p.code(`
      class TwoLayerNet(object):
          def __init__(self, input_size, hidden_size, output_size,
                       std=1e-4):
              """Small random weights, zero biases. Provided."""
          def loss(self, X, y=None, reg=0.0):
              """If y is None, return the (N, C) scores.
              Otherwise return (loss, grads), where grads has
              the same keys as self.params."""
          def train(self, X, y, X_val, y_val,
                    learning_rate=1e-3, learning_rate_decay=0.95,
                    reg=1e-5, num_iters=100, batch_size=200,
                    verbose=False):
              """Minibatch SGD; multiplies the learning rate by
              learning_rate_decay after every epoch."""
          def predict(self, X):
              """The highest-scoring class for each row of X."""
    `, { title: 'neural_net.py' });
    p.prose(`
### What you do

1. On a tiny network (4 inputs, 10 hidden units, 3 classes) and five toy examples, write the forward pass that computes the scores, then the data and regularization loss. The notebook compares both against reference values.
2. Write the backward pass, the gradients of the loss with respect to \`W1\`, \`b1\`, \`W2\` and \`b2\`, and check them numerically.
3. Write \`train\` and \`predict\`, and train on the toy data until the training loss falls below about 0.2.
4. Train on CIFAR-10 (49,000 training, 1,000 validation and 1,000 test images) with the provided starting settings: 50 hidden units and 1,000 iterations.
5. Debug that first network by plotting its loss and its training and validation accuracy over time, and by viewing its first-layer weights as images.
6. Tune the hidden layer size, learning rate, number of training iterations and regularization strength (and, if you like, the learning-rate decay) on the validation set. Keep the best network and evaluate it on the test set.

### What to expect

The default settings give only about 29% on the validation set: the loss falls almost linearly (a sign the learning rate is too low) and training and validation accuracy are nearly equal (a sign the model is too small). Tuned, the network should exceed **48%** on both the validation and the test set; the staff's best network got over 52% on validation. In 2016 there was one bonus point for every percentage point above 52% on the test set.`);

    p.h2('Q5: image features (10 points)', 'q5');
    p.prose(`
- **Notebook:** \`features.ipynb\`
- **You edit:** only the notebook; the feature extractors in \`features.py\` are provided
- **Read first:** the [history section of chapter 0](#/welcome/history) on hand-designed features, then your own work from Q2 and Q4

So far every classifier has looked at raw pixels. This notebook instead describes each image with two hand-designed features and trains on those. A **histogram of oriented gradients** (HOG) captures local edge directions, so it describes texture and shape while ignoring color. A **color histogram** over the hue channel (in HSV color space) describes color while ignoring texture. The two are concatenated into one feature vector per image, then normalized: subtract the mean feature, divide by the standard deviation, and append a bias dimension.`);
    p.code(`
      def hog_feature(im):
          """HOG descriptor of one image. Provided."""
      def color_histogram_hsv(im, nbin=10, xmin=0, xmax=255,
                              normalized=True):
          """Histogram of the hue of one image. Provided."""
      def extract_features(imgs, feature_fns, verbose=False):
          """Apply every feature function to every image and
          stack the results. Provided."""
    `, { title: 'features.py (provided)' });
    p.prose(`
### What you do

1. Train your linear SVM from Q2 on the features, tuning the learning rate and regularization strength (and, optionally, the number of histogram bins) on the validation set. Evaluate it on the test set.
2. Look at test images the SVM gets wrong: for each class, examples that were labeled as that class but belong to another.
3. Train your two-layer network from Q4 on the same features, tuning its hyperparameters, and evaluate it on the test set.

### What you answer

- Describe the misclassifications you see. Do they make sense?

### What to expect

The SVM on features should reach about 44% on the validation set, several points better than on raw pixels. The two-layer network on features should comfortably pass 55% on the test set; the staff's best model reached about 60%. The notebook also invites, for bonus credit, designing and testing a feature of your own.`);

    p.h2('Q6: bonus, do something extra (+10 points)', 'q6');
    p.prose(`
Up to 10 bonus points for going beyond the questions with the code you have written: implement, investigate or analyze something extra around the assignment's topics. The suggestions included asking an interesting question the assignment did not, producing an insightful visualization, or experimenting with a variation on the loss function. The staff noted they might show particularly good results in lecture.`);

    p.callout('idea', 'Assignment 1 walks the whole classical pipeline on CIFAR-10: kNN (about 28%), linear SVM and Softmax (high 30s), a two-layer network (around 50%) and the same classifiers on HOG and color features (up to about 55 to 60%). Along the way you learn the habits the rest of the course depends on: vectorized NumPy, numerical gradient checks, minibatch SGD, and choosing hyperparameters on a validation set, never on the test set.', 'Takeaways');
  },
};

export default chapter;
