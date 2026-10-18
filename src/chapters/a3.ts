import type { ChapterDef } from './index';

const OFFICIAL = 'https://cs231n.github.io/assignments2016/assignment3/';

const chapter: ChapterDef = {
  symbols: {},

  render(p) {
    p.prose(`
Assignment 3 of the 2016 course has two halves. In the first you build **recurrent networks**, a vanilla RNN and then an LSTM, and use them to write captions for photos from Microsoft COCO. In the second you take a convolutional network that has already been trained and compute **gradients with respect to the input image**, then use them to see what the network looks at, to fool it, and to make it draw.

It was due on **February 24, 2016**, and was worth 15% of the grade. It has four questions worth 100 points, plus up to 10 bonus points. This page describes what each question asks; the work itself happens in the original starter notebooks, linked from the [official assignment page](${OFFICIAL}).`);
    p.table(
      ['Question', 'Notebook', 'Topic', 'Points'],
      [
        ['[Q1](#/a3/q1)', '`RNN_Captioning.ipynb`', 'image captioning with vanilla RNNs', '40'],
        ['[Q2](#/a3/q2)', '`LSTM_Captioning.ipynb`', 'image captioning with LSTMs', '35'],
        ['[Q3](#/a3/q3)', '`ImageGradients.ipynb`', 'saliency maps and fooling images', '10'],
        ['[Q4](#/a3/q4)', '`ImageGeneration.ipynb`', 'class visualization, feature inversion, DeepDream', '15'],
        ['[Q5](#/a3/q5)', 'your choice', 'bonus: do something extra', '+10'],
      ],
    );

    p.h2('Goals', 'goals');
    p.prose(`
By the end of this assignment you should:

- understand how a recurrent network processes a sequence by applying the same weights at every time step;
- know how a vanilla RNN differs from a Long Short-Term Memory (LSTM) network, and why the difference matters;
- know how to sample from a recurrent network at test time, one word at a time;
- understand how a convolutional network and a recurrent network combine into an image captioning system;
- be able to compute the gradient of a trained network's output with respect to its input image;
- have used those image gradients for saliency maps, fooling images, class visualizations, feature inversion and DeepDream.`);

    p.h2('Setup in 2016', 'setup');
    p.prose(`
The setup follows [Assignment 1](#/a1/setup) and [Assignment 2](#/a2/setup), with different data:

1. **Get the starter code** from the [official assignment page](${OFFICIAL}).
2. **Install the dependencies** with Anaconda (recommended) or a virtual environment and \`pip install -r requirements.txt\`; or use the preconfigured cloud image on Terminal.com.
3. **Download the data and the model.** From \`cs231n/datasets\`, run \`./get_coco_captioning.sh\` (the preprocessed COCO captions and image features, about 1 GB), \`./get_tiny_imagenet_a.sh\` (TinyImageNet-100-A, about 125 MB) and \`./get_pretrained_model.sh\` (the pretrained ConvNet, about 46 MB).
4. **Compile the Cython extension** from the \`cs231n\` folder with \`python setup.py build_ext --inplace\`, as in Assignment 2.
5. **Start IPython** from the assignment directory.
6. **Submit** by running \`collectSubmission.sh\` and uploading the resulting \`assignment3.zip\`.`);
    p.callout('warning', 'This is a 2016 codebase: Python 2.7 with library versions pinned to late 2015, plus a Cython extension. To run it today you need either a Python 2.7 environment or some edits for Python 3. As of 2026 the starter code, the COCO features, TinyImageNet-100-A and the pretrained model were all still downloadable.', 'Running it today');

    p.h2('The data', 'data');
    p.prose(`
### Microsoft COCO, for captioning

The captioning questions use the 2014 release of **Microsoft COCO**: about 80,000 training and 40,000 validation images, each with five captions written by crowd workers. You never touch the raw pixels. Every image has been passed through **VGG-16**, a ConvNet pretrained on ImageNet, and its 4,096-number activation from the fc7 layer stored as the image's feature vector; a version reduced to 512 numbers with PCA is the default, to save time and memory. The raw images (nearly 20 GB) are not included; the notebooks fetch individual images from their Flickr URLs to show them, so viewing them needs an internet connection.

Captions are stored as sequences of integer word IDs, with a vocabulary file for converting back to words. Four special tokens are added: \`<START>\` and \`<END>\` at the ends of every caption, \`<UNK>\` for rare words, and \`<NULL>\` for padding short captions to a common length. Padding positions must not count toward the loss.

### TinyImageNet and a pretrained ConvNet, for image gradients

**TinyImageNet** is a subset of the ILSVRC-2012 classification data with 200 classes, each with 500 training, 50 validation and 50 test images, downsampled to 64 × 64 pixels. The assignment uses half of it, **TinyImageNet-100-A** (100 classes). Loaded in full it takes about 2.8 GB of memory.

The provided model was trained on TinyImageNet-100-A. It has nine convolutional layers, each with spatial batch normalization, and one fully connected hidden layer with batch normalization. It scores about 90% on training images and about 60% on validation images: somewhat overfit, but good enough for visualization.

### The files

- \`rnn_layers.py\`: the recurrent layers (Q1, Q2).
- \`classifiers/rnn.py\`: the \`CaptioningRNN\` model (Q1, Q2).
- Provided: \`captioning_solver.py\` (a \`CaptioningSolver\` like Assignment 2's \`Solver\`), \`coco_utils.py\` (loading data, sampling minibatches, decoding captions), \`classifiers/pretrained_cnn.py\` (the \`PretrainedCNN\`), and \`image_utils.py\` (preprocessing, blurring and loading images).
- For Q3 and Q4 you write functions directly in the notebooks.

The listings on this page show only each function's signature and its job, never its body.`);

    p.h2('Q1: captioning with vanilla RNNs (40 points)', 'q1');
    p.prose(`
- **Notebook:** \`RNN_Captioning.ipynb\`
- **You edit:** \`rnn_layers.py\` and \`rnn.py\`
- **Read first:** [chapter 15](#/rnn) for recurrent networks and image captioning; [chapter 6](#/backprop) for backpropagation, here through time

The captioning model works like this. An affine layer turns the image feature vector into the RNN's initial hidden state. Each word of the caption is turned into a learned vector by a **word embedding**. The RNN reads the words one at a time, and at every step an affine layer turns its hidden state into a score for every word in the vocabulary. During training the RNN is fed the true caption and asked to predict the next word at each step, scored with a softmax loss at every step.`);
    p.code(`
      def rnn_step_forward(x, prev_h, Wx, Wh, b):
          """One time step with tanh. x: (N, D),
          prev_h: (N, H), Wx: (D, H), Wh: (H, H), b: (H,).
          Returns (next_h, cache)."""
      def rnn_step_backward(dnext_h, cache):
          """Returns (dx, dprev_h, dWx, dWh, db)."""
      def rnn_forward(x, h0, Wx, Wh, b):
          """A whole sequence. x: (N, T, D), h0: (N, H).
          Returns (h, cache), h of shape (N, T, H)."""
      def rnn_backward(dh, cache):
          """Backprop through every time step.
          Returns (dx, dh0, dWx, dWh, db)."""
      def word_embedding_forward(x, W):
          """x: (N, T) word indices; W: (V, D) word vectors.
          Returns (out, cache), out of shape (N, T, D)."""
      def word_embedding_backward(dout, cache):
          """Returns dW."""

      # provided:
      def temporal_affine_forward(x, w, b):
          """An affine layer applied at every time step."""
      def temporal_softmax_loss(x, y, mask, verbose=False):
          """Softmax loss at every time step, skipping the
          positions where mask is False (the <NULL> pads)."""
    `, { title: 'rnn_layers.py' });
    p.code(`
      class CaptioningRNN(object):
          def __init__(self, word_to_idx, input_dim=512,
                       wordvec_dim=128, hidden_dim=128,
                       cell_type='rnn', dtype=np.float32):
              """Sets up the parameters. Provided."""
          def loss(self, features, captions):
              """features: (N, D); captions: (N, T) word IDs.
              Returns (loss, grads)."""
          def sample(self, features, max_length=30):
              """Generate captions one word at a time, from
              <START>, choosing the highest-scoring word at
              each step. Returns (N, max_length) word IDs."""
    `, { title: 'rnn.py' });
    p.prose(`
### What you do

1. Write the single-step forward and backward passes of a vanilla RNN, checked against reference values and numerical gradients.
2. Write the forward and backward passes over a whole sequence, built from the single-step functions.
3. Write the word embedding layer, forward and backward.
4. Gradient-check the provided temporal affine layer and temporal softmax loss.
5. Write \`CaptioningRNN.loss\` for \`cell_type='rnn'\`: the forward pass through all the pieces above, then the backward pass. The notebook checks it on a small fixed example and with numerical gradients.
6. Use the provided \`CaptioningSolver\` to overfit a tiny training set (50 images), until the training loss gets close to 1.
7. Write \`sample\` for test-time generation: feed the image to get the first hidden state, start from \`<START>\`, and at each step feed back the best word the model just produced. Sample captions for training and validation images from the overfit model.

### What to expect

Captions sampled for the training images should be very good, because the model has memorized them. Captions for validation images will probably make little sense: a model trained on 50 images cannot generalize.`);

    p.h2('Q2: captioning with LSTMs (35 points)', 'q2');
    p.prose(`
- **Notebook:** \`LSTM_Captioning.ipynb\`
- **You edit:** \`rnn_layers.py\` and \`rnn.py\`
- **Read first:** the LSTM and vanishing-gradient sections of [chapter 15](#/rnn)

Vanilla RNNs are hard to train on long sequences, because repeated multiplication by the same matrix makes gradients vanish or explode. An **LSTM** keeps an additional *cell state* and controls it with gates. At each step it computes one activation vector of size 4H from the input and previous hidden state, splits it into four parts, and produces an input gate, a forget gate and an output gate (each passed through a sigmoid) and a candidate update (passed through tanh). The new cell state is the old one scaled by the forget gate plus the candidate scaled by the input gate, and the new hidden state is the output gate times the tanh of the cell state. The notebook states these equations precisely.`);
    p.code(`
      def lstm_step_forward(x, prev_h, prev_c, Wx, Wh, b):
          """One time step. Wx: (D, 4H), Wh: (H, 4H),
          b: (4H,). Returns (next_h, next_c, cache)."""
      def lstm_step_backward(dnext_h, dnext_c, cache):
          """Returns (dx, dprev_h, dprev_c, dWx, dWh, db)."""
      def lstm_forward(x, h0, Wx, Wh, b):
          """A whole sequence; the cell state starts at zero
          and stays internal. Returns (h, cache)."""
      def lstm_backward(dh, cache):
          """Returns (dx, dh0, dWx, dWh, db)."""
    `, { title: 'rnn_layers.py' });
    p.prose(`
### What you do

1. Write the single-step LSTM forward and backward passes, checked against reference values and numerical gradients.
2. Write the forward and backward passes over a whole sequence.
3. Extend \`CaptioningRNN.loss\` to handle \`cell_type='lstm'\` (the notebook expects fewer than 10 extra lines), and check it on the same fixed example.
4. Overfit the same tiny training set with the LSTM model.
5. Extend \`sample\` to the LSTM case, again in a handful of lines, tracking the cell state (which starts at zero).
6. Train a captioning model that produces reasonable captions for *validation* images: better than the random-looking output of the overfit models. You may train on a subset of the data.

### What to expect

There is no accuracy threshold for the final model. The bar is qualitative: validation captions that are clearly better than random. The notebook asks you not to spend too long on it.`);

    p.h2('Q3: saliency maps and fooling images (10 points)', 'q3');
    p.prose(`
- **Notebook:** \`ImageGradients.ipynb\`
- **You edit:** functions defined in the notebook itself
- **Read first:** [chapter 12](#/visualizing) for saliency maps and adversarial examples

Everything in Q3 and Q4 uses the pretrained TinyImageNet model through two methods: \`forward\`, which can run any contiguous range of the network's layers and returns their output with a cache, and \`backward\`, which takes a gradient at the last of those layers and returns the gradient with respect to the first layer's input (and the parameters). Running from the first layer gives gradients with respect to the image itself. The model must be run in test mode.`);
    p.code(`
      class PretrainedCNN(object):     # provided
          def forward(self, X, start=None, end=None, mode='test'):
              """Run layers start..end on X.
              Returns (out, cache)."""
          def backward(self, dout, cache):
              """Gradient dout at the end layer back to the
              input of the start layer. Returns (dX, grads)."""

      # written in the notebook:
      def compute_saliency_maps(X, y, model):
          """X: (N, 3, H, W) images, y: (N,) labels.
          Returns (N, H, W) saliency maps."""
      def make_fooling_image(X, target_y, model):
          """Change X until the model labels it target_y."""
    `, { title: 'pretrained_cnn.py and the notebook' });
    p.prose(`
### What you do

1. Look at the TinyImageNet-100-A classes and some example images, and check the pretrained model's accuracy on training and validation images.
2. Write \`compute_saliency_maps\`, following Simonyan, Vedaldi and Zisserman (2014): use the gradient of the **unnormalized class score** of each image's correct class (not the softmax probability) with respect to the image to produce one map per image, the same height and width as the image, showing how much each pixel location matters. The notebook displays the maps for random and hand-picked validation images.
3. Write \`make_fooling_image\`, following Szegedy et al. (2014): starting from a correctly classified image and a different target class, run gradient ascent on the target class's score with respect to the image, stopping as soon as the network predicts the target. The notebook shows the original, the fooling image and their difference.

### What to expect

For most images a fooling image needs fewer than 100 steps of gradient ascent, and the change is barely visible.`);

    p.h2('Q4: class visualization, inversion and DeepDream (15 points)', 'q4');
    p.prose(`
- **Notebook:** \`ImageGeneration.ipynb\`
- **You edit:** functions defined in the notebook itself
- **Read first:** [chapter 12](#/visualizing) for class visualization, feature inversion and DeepDream

All three techniques optimize an *image* rather than the network's weights, using the same forward and backward methods. Each function also applies some regularization so the result looks like a picture rather than noise: an L2 penalty on pixel values, small random shifts (jitter), clipping to the valid pixel range, and periodic blurring, as suggested by Yosinski et al. (2015).`);
    p.code(`
      def create_class_visualization(target_y, model, **kwargs):
          """From random noise, gradient ascent on the score
          of target_y, with L2 regularization, jitter,
          clipping and blurring. Returns the image."""
      def invert_features(target_feats, layer, model, **kwargs):
          """Find an image whose activations at layer match
          target_feats. Returns the image."""
      def deepdream(X, layer, model, **kwargs):
          """Amplify whatever layer already responds to
          in X. Returns the modified image."""
    `, { title: 'the notebook' });
    p.prose(`
### What you do

1. **Class visualization** (Simonyan et al., 2014): complete \`create_class_visualization\`, which starts from random noise and repeatedly computes the gradient of the target class's raw score with respect to the image, adds the L2 regularization term, and updates the image. Generate images for classes of your choice.
2. **Feature inversion** (Mahendran and Vedaldi, 2015): complete \`invert_features\`, which searches for an image whose activations at a chosen layer match those of a real image, by gradient descent on the squared difference plus regularization. Reconstruct an image from the features after the fourth convolutional layer with the provided settings, then from deeper features (after seven convolutional layers), tuning the settings yourself.
3. **DeepDream** (Google, 2015): complete \`deepdream\`, which runs the image forward to a chosen layer, sets the gradient at that layer equal to the layer's own activations, backpropagates to the image, and takes a step. Generate your own DeepDream images, trying different layers and starting images.

### What to expect

Q4 has no numerical targets; the aim is good-looking images. The provided settings should be enough to invert the shallow features. Reconstructions from deep features tend not to resemble the original image much, as in Mahendran and Vedaldi's paper, but should show some discernible structure within 1,000 iterations. DeepDream images from this small network will be less striking than Google's.`);

    p.h2('Q5: bonus, do something extra (+10 points)', 'q5');
    p.prose(`
Up to 10 bonus points for doing something interesting with the pieces of this assignment. The official suggestion was to look for other ways of generating images that the assignment did not cover.`);

    p.callout('idea', 'Assignment 3 reuses one idea in two directions. Recurrent networks apply the same small set of weights at every time step, so backpropagation through time is just the layer contract from Assignment 2 run along a sequence, and an LSTM adds gates to keep gradients alive. Image-gradient methods hold a trained network fixed and optimize the input instead, which is enough to find what the network attends to, fool it, and make it draw.', 'Takeaways');
  },
};

export default chapter;
