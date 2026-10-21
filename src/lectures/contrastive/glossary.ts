import type { Glossary } from '../../lecture/glossary';

export const glossary: Glossary = {
  agree: {
    is: 'a loss that is low when two views match',
    more: 'A placeholder for the losses to come. Contrastive methods, the first family, also push apart views of different images, and the collapse scene shows why that matters.',
  },
  linear_probe: {
    is: 'grades frozen features with a linear classifier',
    more: 'Freeze the encoder f, fit one linear softmax classifier on labeled data, and report its test accuracy. The term comes from Alain and Bengio (2016), who used linear classifiers to probe what each layer encodes.',
  },
  ce: {
    is: 'cross-entropy between scores and target classes',
    more: 'Row by row: softmax the scores, then take minus the log probability of the target column, and average. With S and the diagonal as targets, it is exactly InfoNCE; CLIP applies it to S and to S.T.',
  },
  head: {
    is: 'a small classifier that guesses the rotation',
    more: 'It gives four scores, one per quarter turn. Only the pretext task needs it; what matters afterwards is the encoder f underneath.',
  },
  fit_softmax: {
    is: 'trains a linear softmax classifier on fixed features',
    more: 'It returns the weights W and bias b. The encoder f stays frozen, so the resulting accuracy measures f, not the classifier.',
  },
  accuracy: {
    is: 'the fraction of test images classified correctly',
    more: 'Each row\'s highest score is its prediction. This number is the grade a paper reports for its features.',
  },
  random_crop: {
    is: 'cuts out a random region of the image',
    more: 'The range (0.25, 1) bounds the crop\'s share of the image area, so two crops can show different parts, or one can zoom in on the other.',
  },
  maybe_flip: { is: 'flips the image left to right half the time' },
  color_jitter: {
    is: 'randomly shifts brightness, contrast, saturation and hue',
    more: 'Applied with probability 0.8. Without it, two crops of one photo share their colors, and the network can match views by color alone.',
  },
  maybe_gray: { is: 'turns the image gray 20% of the time', more: 'Another way to stop the network from matching views by their colors.' },
  augment: {
    is: 'makes one random view of an image',
    more: 'Crop, maybe flip, jitter the colors, maybe gray. Called twice on one image, it gives two views with the same content and different pixels. On the toy data it keeps the content numbers and redraws the style.',
  },
  normalize: {
    is: 'scales a vector to length 1',
    more: 'After it, the dot product of two embeddings is the cosine of their angle, and every embedding lies on a sphere.',
    eg: 'normalize(np.array([3., 4.]))   # [0.6, 0.8]',
  },
  onehot: {
    is: 'a vector of zeros with a single 1',
    more: 'The 1 marks the partner\'s column, so P - onehot(partner) is the gradient of one row\'s loss with respect to its scores.',
    eg: 'onehot(2)   # [0., 0., 1., 0.] for a row of 4',
  },
  embed: { is: 'maps a toy item to a point on a circle', more: 'Each item has two numbers of content and four of style; its embedding is a unit vector in two dimensions.' },
  grad: {
    is: 'the gradient of the loss with respect to the weights',
    more: 'Shorthand for backpropagation through the network. In MoCo only f_q gets one; the key encoder f_k never does.',
  },
  '.step': {
    is: 'moves the network\'s weights one step against a gradient',
    more: 'Shorthand for an optimizer update: f.step(grad(loss)) trains f. In MoCo and DINO only the query encoder and the student are stepped; the slow copies follow by moving average.',
  },
  g: {
    is: 'SimCLR\'s projection head: maps h to z',
    more: 'A small MLP from the 2,048 numbers of h to the 128 numbers the loss sees. It is thrown away after training, because h probes more than ten points better than z. SimCLR is short for a simple framework for contrastive learning of visual representations.',
  },
  aug: {
    is: 'makes one random view of x',
    more: 'Called separately for the query and the key, so q and k come from two different views of the same image.',
  },
  push: {
    is: 'adds new keys to the queue, drops the oldest',
    more: 'A first-in, first-out queue of 65,536 keys, so each query meets negatives from many past batches while the batch stays at 256.',
  },
  image_encoder: {
    is: 'CLIP\'s image tower: an image to an embedding',
    more: 'A ResNet or a vision transformer, with a projection into the space it shares with text.',
  },
  text_encoder: {
    is: 'CLIP\'s text tower: a caption to an embedding',
    more: 'A transformer projecting into the same space as the images. In zero-shot classification, its outputs for the prompts become the classifier\'s weights.',
  },
  decoder: {
    is: 'MAE\'s small decoder: fills in the hidden patches',
    more: 'It puts the encoder\'s outputs back at their positions using ids, places a learned mask token in every gap, and predicts pixels for all 64 patches. The loss scores only the hidden ones.',
  },
  gt: {
    is: 'DINO\'s teacher network',
    more: 'The same architecture as the student, with weights that are a moving average of the student\'s and no gradient. Its outputs are centered, then sharpened by a temperature of 0.04. DINO is short for self-distillation with no labels.',
  },
  gs: {
    is: 'DINO\'s student network',
    more: 'The only network trained by backprop. Its softmax, at temperature 0.1, learns to match the teacher\'s on another view.',
  },
};
