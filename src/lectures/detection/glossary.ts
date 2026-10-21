import type { Glossary } from '../../lecture/glossary';

export const glossary: Glossary = {
  load: { is: 'reads an image file into an array', more: 'A height × width × 3 array of pixel values: here 320 × 480 × 3.' },
  net: {
    is: 'the ConvNet, run on the whole image',
    more: 'What it returns depends on the task: class scores plus four box numbers for localization, or a (C, H, W) block of class scores, one set per pixel, for segmentation.',
  },
  iou: {
    is: 'intersection over union of two boxes',
    more: 'Shared area over total area: 1 for a perfect match, 0 for no contact, and fair to boxes of every size. A detection usually counts as correct at IoU ≥ 0.5.',
    eg: 'iou((0, 0, 2, 2), (1, 0, 3, 2))   # 0.33',
  },
  convnet: {
    is: 'a forward pass through the ConvNet',
    more: 'On a window it gives class scores, and in R-CNN a feature vector per warped proposal. In Fast R-CNN it runs once on the whole image and returns a feature map that every proposal shares.',
  },
  out_size: {
    is: 'a layer\'s output width, with no padding',
    more: 'Input minus filter size, over the stride, plus one. A 14-pixel crop shrinks to 10, 5, then 1; a 16-pixel image ends at 2 × 2, four windows scored at once.',
    eg: 'out_size(14, 5)   # 10',
  },
  selective_search: {
    is: 'proposes about 2,000 likely object boxes',
    more: 'It keeps merging similar neighboring patches by color, texture and edges, and emits a box at each merge. High recall matters more than precision.',
  },
  warp: {
    is: 'cuts out a proposal, stretched to 227 × 227',
    more: 'The ConvNet needs a fixed input size, so every box is resized to it, whatever its shape.',
  },
  svms: {
    is: 'one linear classifier per class, on the features',
    more: 'R-CNN scored each crop with a separate linear SVM per class, trained on the fixed ConvNet features.',
  },
  regressor: {
    is: 'predicts the box offsets t from the features',
    more: 'Four numbers that shift the proposal\'s center and rescale its width and height onto the object, in units relative to the proposal\'s size.',
  },
  roi_pool: {
    is: 'max-pools any region into a fixed grid',
    more: 'It splits a region of the feature map into H × W cells, 2 × 2 here, and keeps each cell\'s max, so proposals of any size feed the same layers. RoI stands for region of interest.',
  },
  yolo_net: {
    is: 'the YOLO network: every box in one pass',
    more: 'It returns a 7 × 7 × 30 block: for each grid cell, two boxes of five numbers and 20 class probabilities. YOLO stands for You Only Look Once.',
  },
  nms: {
    is: 'removes duplicate detections of one object',
    more: 'Keep the highest-scoring box, delete every box of its class that overlaps it with IoU above τ, and repeat. The name says it: whatever is not the local maximum is suppressed.',
  },
  backbone: {
    is: 'the classifier\'s conv layers, with three outputs',
    more: 'f3, f4 and f5 are its feature maps at strides 8, 16 and 32: the finer the map, the more it knows about where. Task heads attach to it, hence the name backbone.',
  },
  score5: {
    is: 'class scores from f5, at stride 32',
    more: 'It turns each cell of the coarsest map into C class scores: a (C, 10, 15) map that the skips then refine.',
  },
  score4: {
    is: 'class scores from f4, at stride 16',
    more: 'Added to the upsampled stride-32 scores: a skip connection that recovers detail the coarse map lost.',
  },
  score3: { is: 'class scores from f3, at stride 8', more: 'The finest skip, added after a second 2x upsampling to give a (C, 40, 60) map.' },
  up: {
    is: 'upsamples a score map by a factor',
    more: 'A transpose convolution: each input value stamps a scaled copy of a learned filter, and overlapping stamps add. up(s, 2) doubles the height and width.',
  },
  faster_rcnn: {
    is: 'the whole Faster R-CNN detector',
    more: 'A region proposal network with anchors proposes boxes, and a Fast R-CNN head on the same features classifies and refines them.',
  },
  roi_align: {
    is: 'RoI pooling without rounding to whole cells',
    more: 'Mask R-CNN\'s version samples the feature map at exact, fractional positions with bilinear interpolation, so the features line up with the pixels the mask must cover.',
  },
  mask_head: {
    is: 'paints a mask inside one detected box',
    more: 'Mask R-CNN\'s small extra head: for each pixel of the region, it predicts whether the pixel belongs to the object.',
  },
};
