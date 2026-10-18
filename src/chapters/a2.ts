import type { ChapterDef } from './index';

const OFFICIAL = 'https://cs231n.github.io/assignments2016/assignment2/';

const chapter: ChapterDef = {
  symbols: {},

  render(p) {
    p.prose(`
Assignment 2 of the 2016 course takes the two-layer network from [Assignment 1](#/a1) apart and rebuilds it properly. Every layer becomes a small, separately tested module with a forward pass and a backward pass, and those modules snap together into fully connected networks of any depth and, by the end, a convolutional network. Along the way you implement the update rules, batch normalization and dropout that made deep networks practical, and you train the best CIFAR-10 ConvNet you can.

It was due on **February 5, 2016**, and was worth 15% of the grade. It has four questions worth 100 points, plus up to 10 bonus points. This page describes what each question asks; the work itself happens in the original starter notebooks, linked from the [official assignment page](${OFFICIAL}).`);
    p.table(
      ['Question', 'Notebook', 'Topic', 'Points'],
      [
        ['[Q1](#/a2/q1)', '`FullyConnectedNets.ipynb`', 'modular layers, deep fully connected nets, update rules', '30'],
        ['[Q2](#/a2/q2)', '`BatchNormalization.ipynb`', 'batch normalization', '30'],
        ['[Q3](#/a2/q3)', '`Dropout.ipynb`', 'dropout', '10'],
        ['[Q4](#/a2/q4)', '`ConvolutionalNetworks.ipynb`', 'ConvNet layers and a ConvNet on CIFAR-10', '30'],
        ['[Q5](#/a2/q5)', 'your choice', 'bonus: do something extra', '+10'],
      ],
    );

    p.h2('Goals', 'goals');
    p.prose(`
By the end of this assignment you should:

- understand neural networks as stacks of layers, and be able to write each layer's forward and backward pass in vectorized NumPy;
- have implemented the update rules used to train networks in practice: SGD with momentum, RMSProp and Adam;
- have implemented batch normalization and dropout, and seen what each does to training;
- be able to search hyperparameters effectively for a neural network;
- understand the layers of a convolutional network, and have trained one on CIFAR-10.`);

    p.h2('Setup in 2016', 'setup');
    p.prose(`
The setup matches [Assignment 1](#/a1/setup), with one extra step:

1. **Get the starter code** from the [official assignment page](${OFFICIAL}).
2. **Install the dependencies** with Anaconda (recommended) or a virtual environment and \`pip install -r requirements.txt\`; or use the preconfigured cloud image on Terminal.com.
3. **Download CIFAR-10** by running \`./get_datasets.sh\` in \`cs231n/datasets\`.
4. **Compile the Cython extension.** Convolution in pure NumPy is slow, so the fast convolution layers rely on a small compiled extension (\`im2col_cython.pyx\`). From the \`cs231n\` folder, run \`python setup.py build_ext --inplace\`.
5. **Start IPython** from the assignment directory (on OS X in a virtual environment, through \`start_ipython_osx.sh\`).
6. **Submit** by running \`collectSubmission.sh\` and uploading the resulting \`assignment2.zip\`.

The notebooks load data through a helper that returns 49,000 training, 1,000 validation and 1,000 test images, with the mean training image subtracted and the color channel moved first, so each batch has shape (N, 3, 32, 32).`);
    p.callout('warning', 'This is a 2016 codebase: Python 2.7 with library versions pinned to late 2015. To run it today you need either a Python 2.7 environment or some edits for Python 3, and the Cython extension has to compile against your NumPy. As of 2026 the starter code and the CIFAR-10 download were still online.', 'Running it today');

    p.h2('The modular design', 'design');
    p.prose(`
The central idea of the assignment is one small contract that every layer obeys. A forward function takes the layer's inputs and parameters and returns its output together with a **cache**: whatever the backward pass will need. A backward function takes the gradient of the loss with respect to that output (\`dout\`) and the cache, and returns the gradients with respect to the inputs and parameters. [Chapter 6](#/backprop) explains why this local, one-gate-at-a-time view of backpropagation is all you need.`);
    p.code(`
      def layer_forward(x, w):
          """Compute the output from inputs and weights."""
          return out, cache        # cache: what backward needs

      def layer_backward(dout, cache):
          """dout: gradient of the loss with respect to out."""
          return dx, dw            # gradients for x and w
    `, { title: 'the layer contract' });
    p.prose(`
Training is also separated from models. A provided \`Solver\` class runs minibatch gradient descent on any model that keeps its parameters in a dictionary \`model.params\` and has a method \`model.loss(X, y)\` returning scores (when \`y\` is None) or the loss and a dictionary of gradients. A notebook cell typically looks like this:`);
    p.code(`
      model = TwoLayerNet()   # any model with this API works
      solver = Solver(model, data,
                      update_rule='sgd',
                      optim_config={'learning_rate': 1e-3},
                      lr_decay=0.95,
                      num_epochs=10, batch_size=100,
                      print_every=100)
      solver.train()
      # afterwards: solver.loss_history, solver.train_acc_history,
      # solver.val_acc_history; model.params holds the best weights
    `, { title: 'a typical notebook cell' });
    p.prose(`
The files you edit are in the \`cs231n\` package:

- \`layers.py\`: every layer's forward and backward pass (Q1 to Q4).
- \`optim.py\`: the update rules. Plain \`sgd\` is provided; you write the others (Q1).
- \`classifiers/fc_net.py\`: \`TwoLayerNet\` and \`FullyConnectedNet\` (Q1, extended in Q2 and Q3).
- \`classifiers/cnn.py\`: \`ThreeLayerConvNet\` (Q4).

Provided and worth reading: \`solver.py\` (the training loop), \`layer_utils.py\` ("sandwich" layers such as affine followed by ReLU, or convolution, ReLU and pooling), \`fast_layers.py\` (fast convolution and pooling), and \`gradient_check.py\`. The listings on this page show only each function's signature and its job, never its body.`);

    p.h2('Q1: fully connected networks (30 points)', 'q1');
    p.prose(`
- **Notebook:** \`FullyConnectedNets.ipynb\`
- **You edit:** \`layers.py\`, \`fc_net.py\`, \`optim.py\`
- **Read first:** [chapter 6](#/backprop) for backpropagation, [chapter 7](#/nn-architecture) for layers and ReLU, [chapter 9](#/nn-learning) for the update rules`);
    p.code(`
      def affine_forward(x, w, b):
          """x: (N, d_1, ..., d_k), flattened to (N, D);
          w: (D, M); b: (M,). Returns (out, cache)."""
      def affine_backward(dout, cache):
          """Returns (dx, dw, db)."""
      def relu_forward(x):
          """Returns (out, cache)."""
      def relu_backward(dout, cache):
          """Returns dx."""

      class FullyConnectedNet(object):
          def __init__(self, hidden_dims, input_dim=3*32*32,
                       num_classes=10, dropout=0,
                       use_batchnorm=False, reg=0.0,
                       weight_scale=1e-2, dtype=np.float32,
                       seed=None):
              """{affine - [batch norm] - relu - [dropout]}
              x (L - 1), then affine - softmax."""
          def loss(self, X, y=None):
              """Scores if y is None, else (loss, grads)."""

      def sgd_momentum(w, dw, config=None):
          """Momentum update; the velocity lives in config.
          Returns (next_w, config)."""
      def rmsprop(x, dx, config=None):
          """Per-parameter step sizes from a moving average
          of squared gradients."""
      def adam(x, dx, config=None):
          """Moving averages of the gradient and its square,
          with bias correction."""
    `, { title: 'layers.py, fc_net.py, optim.py' });
    p.prose(`
### What you do

1. Write the affine (fully connected) layer and the ReLU layer, forward and backward. The notebook compares each forward pass with reference outputs and checks each backward pass against numerical gradients. The SVM and Softmax losses from Assignment 1 are provided as loss layers.
2. Rebuild the two-layer network as \`TwoLayerNet\` in \`fc_net.py\` from these modules, then use a \`Solver\` to train it to **at least 50%** validation accuracy.
3. Write \`FullyConnectedNet\`, a network with any number of hidden layers. Check its initial loss and gradients, with and without regularization.
4. As a sanity check, overfit 50 training images: first with a three-layer network (100 units per hidden layer), then a five-layer one, reaching 100% training accuracy within 20 epochs by adjusting the learning rate and initialization scale.
5. Write the update rules SGD with momentum, RMSProp and Adam in \`optim.py\`, check them against reference values, and compare them with plain SGD by training a six-layer network on 4,000 images.
6. Train the best fully connected network you can on CIFAR-10. The notebook suggests doing Q2 and Q3 first, since batch normalization and dropout help.

### What you answer

- Did you notice a difference in how hard it was to train the three-layer network compared with the five-layer one?

### What to expect

SGD with momentum should converge visibly faster than plain SGD. The best fully connected network must reach at least **50%** on the validation set; above 55% is possible but earned no extra credit, because the staff preferred that effort go into ConvNets.`);

    p.h2('Q2: batch normalization (30 points)', 'q2');
    p.prose(`
- **Notebook:** \`BatchNormalization.ipynb\`
- **You edit:** \`layers.py\`, \`fc_net.py\`
- **Read first:** [chapter 8](#/nn-data-loss) for batch normalization and initialization; [chapter 6](#/backprop) for backpropagating through a computational graph

Batch normalization (Ioffe and Szegedy, 2015) normalizes each feature to zero mean and unit variance using the statistics of the current minibatch, then applies a learnable scale (\`gamma\`) and shift (\`beta\`) so the network can undo the normalization where that helps. During training it keeps running averages of the means and variances, and at test time it normalizes with those averages instead of batch statistics.`);
    p.code(`
      def batchnorm_forward(x, gamma, beta, bn_param):
          """x: (N, D); gamma, beta: (D,).
          bn_param holds mode ('train' or 'test'), eps,
          momentum, running_mean and running_var.
          Returns (out, cache)."""
      def batchnorm_backward(dout, cache):
          """Backprop through the graph, node by node.
          Returns (dx, dgamma, dbeta)."""
      def batchnorm_backward_alt(dout, cache):
          """The same gradients from a formula simplified
          on paper; should be a bit faster."""
    `, { title: 'layers.py' });
    p.prose(`
### What you do

1. Write the forward pass for both modes. The notebook checks that training-mode outputs have the expected means and standard deviations (zero and one, then \`beta\` and \`gamma\`), and that test mode, after the running averages have warmed up, behaves similarly.
2. Write the backward pass by drawing the computational graph and backpropagating through each intermediate node, remembering to add up gradients where a value feeds into more than one branch. Check it numerically.
3. Optionally, derive a simplified backward pass on paper and implement it as \`batchnorm_backward_alt\`; the notebook compares the two for agreement and speed. (The notebook says the rest of the assignment does not depend on this part.)
4. Add a \`use_batchnorm\` option to \`FullyConnectedNet\` that inserts batch normalization before every ReLU (but not after the last layer), and gradient-check it.
5. Train a six-layer network on 1,000 images with and without batch normalization and compare.
6. Train eight-layer networks with and without batch normalization across a range of weight initialization scales, and plot training accuracy, validation accuracy and training loss against the scale.

### What you answer

- Describe the results of the initialization-scale experiment, and explain why it came out the way it did.

### What to expect

With batch normalization the deep network should converge much faster than without it.`);

    p.h2('Q3: dropout (10 points)', 'q3');
    p.prose(`
- **Notebook:** \`Dropout.ipynb\`
- **You edit:** \`layers.py\`, \`fc_net.py\`
- **Read first:** the dropout section of [chapter 8](#/nn-data-loss)

Dropout (Hinton et al., 2012) regularizes a network by randomly setting some activations to zero during training. The starter code asks for **inverted** dropout, so nothing needs rescaling at test time. Note the convention of this 2016 code: the parameter \`p\` is the probability of *dropping* a unit, not of keeping it.`);
    p.code(`
      def dropout_forward(x, dropout_param):
          """dropout_param holds p (the probability of
          dropping each unit), mode ('train' or 'test')
          and an optional seed. Returns (out, cache)."""
      def dropout_backward(dout, cache):
          """Returns dx."""
    `, { title: 'layers.py' });
    p.prose(`
### What you do

1. Write the forward pass for both training and test mode, and check the statistics of its outputs.
2. Write the backward pass and check it numerically.
3. Add dropout to \`FullyConnectedNet\`: when the \`dropout\` argument is nonzero, put a dropout layer right after every ReLU. Gradient-check the result.
4. Train two otherwise identical two-layer networks on just 500 images, one without dropout and one with \`p\` = 0.75, and plot their training and validation accuracy over time.

### What you answer

- Explain what you see in the experiment. What does it suggest about dropout?`);

    p.h2('Q4: a ConvNet on CIFAR-10 (30 points)', 'q4');
    p.prose(`
- **Notebook:** \`ConvolutionalNetworks.ipynb\`
- **You edit:** \`layers.py\`, \`cnn.py\`, plus your own experiments in the notebook
- **Read first:** [chapter 11](#/convnets) for convolution, pooling and output sizes; [chapter 13](#/convnets-practice) for fast convolution; [chapter 8](#/nn-data-loss) for batch normalization`);
    p.code(`
      def conv_forward_naive(x, w, b, conv_param):
          """x: (N, C, H, W); w: (F, C, HH, WW); b: (F,).
          conv_param holds 'stride' and 'pad'.
          Returns (out, cache), out of shape (N, F, H', W')."""
      def conv_backward_naive(dout, cache):
          """Returns (dx, dw, db)."""
      def max_pool_forward_naive(x, pool_param):
          """pool_param holds 'pool_height', 'pool_width'
          and 'stride'. Returns (out, cache)."""
      def max_pool_backward_naive(dout, cache):
          """Returns dx."""
      def spatial_batchnorm_forward(x, gamma, beta, bn_param):
          """x: (N, C, H, W); one mean and variance per
          channel, over N, H and W. Returns (out, cache)."""
      def spatial_batchnorm_backward(dout, cache):
          """Returns (dx, dgamma, dbeta)."""

      class ThreeLayerConvNet(object):
          def __init__(self, input_dim=(3, 32, 32),
                       num_filters=32, filter_size=7,
                       hidden_dim=100, num_classes=10,
                       weight_scale=1e-3, reg=0.0,
                       dtype=np.float32):
              """conv - relu - 2x2 max pool - affine - relu
              - affine - softmax."""
          def loss(self, X, y=None):
              """Scores if y is None, else (loss, grads)."""
    `, { title: 'layers.py, cnn.py' });
    p.prose(`
### What you do

1. Write the naive forward pass of a convolutional layer, as clearly as you like; speed does not matter yet. As a check you can see with your own eyes, the notebook builds two hand-made filters (one converting to grayscale, one detecting horizontal edges) and runs them over photos of a kitten and a puppy.
2. Write the naive convolution backward pass and the naive max-pooling forward and backward passes, each checked numerically.
3. Compare your naive layers with the provided fast versions (the Cython extension) for speed, and try the provided convolutional sandwich layers.
4. Write \`ThreeLayerConvNet\`. Sanity-check its initial loss (about $\\log 10 \\approx 2.3$ for ten classes with no regularization), gradient-check it on small data, and show it can badly overfit a 100-image training set.
5. Train it for one epoch on the full training set and visualize the first-layer filters.
6. Write **spatial batch normalization**, the version for convolutional feature maps, forward and backward.
7. **Experiment.** Train the best ConvNet you can. The notebook suggests varying the filter size and number of filters, adding spatial batch normalization, and trying deeper architectures such as [conv-relu-pool] × N followed by affine layers, or [conv-relu-conv-relu-pool] × N. Tune the learning rate and regularization coarse-to-fine for each architecture. Report training, validation and test accuracy, and describe what you did in the notebook.

### What to expect

One epoch of the three-layer ConvNet should exceed **40%** training accuracy. Your final network must reach at least **65%** on the validation set; that is a floor, and careful work goes well beyond it. Extra credit was given for particularly high-scoring models or original approaches.`);

    p.h2('Q5: bonus, do something extra (+10 points)', 'q5');
    p.prose(`
Up to 10 bonus points for anything you implement beyond the assignment to improve your network: modifying the solver (for example AdaGrad or AdaDelta), new layers or activation functions (leaky ReLU, parametric ReLU, maxout), other kinds of regularization, model ensembles, data augmentation, or anything else. Describe it clearly in the notebook's extra-credit cell.`);

    p.callout('idea', 'Assignment 2 is where backpropagation becomes engineering: every layer is a forward function that saves a cache and a backward function that turns an upstream gradient into local ones, so networks of any depth assemble from parts you have each checked numerically. On top of that you build the training tools of the 2016 era (momentum, RMSProp, Adam, batch normalization, dropout) and a ConvNet that must reach 65% on CIFAR-10.', 'Takeaways');
  },
};

export default chapter;
