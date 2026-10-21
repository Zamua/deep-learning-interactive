import type { SymbolMap } from '../core/symbols';

/** Shared by the detection chapter and its lecture, so a symbol keeps its color across both. */
export const DETECTION_SYMBOLS: SymbolMap = {
  x: {
    color: 'orange',
    name: 'x: the input image',
    code: ['img'],
    about: 'Here a 320 × 480 × 3 street scene. Each method starts from it: cut into sliding windows, warped once per proposal, or run once through the ConvNet with proposals cut from the feature map.',
  },
  bp: {
    color: 'purple',
    name: 'b̂: a box the network predicts',
    tex: '\\hat{b}',
    code: ['box', 'boxes', 'pred'],
    about: 'Four numbers. Localization uses the left edge x, top edge y, width and height; the IoU code uses corners (x1, y1, x2, y2). The hat is the usual statistics mark for an estimate.',
  },
  bg: {
    color: 'gold',
    name: 'b*: the true (ground-truth) box',
    tex: 'b^{*}',
    code: ['gt'],
    about: 'Drawn by a person. The box loss compares b̂ with it, IoU grades against it, and anchors are labeled by it. gt is short for ground truth, as in remote sensing, where images are checked against observations made on the ground.',
  },
  P: {
    color: 'green',
    name: 'P: a region proposal or anchor box',
    code: ['P', 'proposals', 'anchors'],
    about: 'About 2,000 from Selective Search in R-CNN, or 9 anchors, 3 sizes × 3 aspect ratios, at every cell of the feature map in Faster R-CNN. Predictions are anchored to it: the network outputs offsets t from a fixed reference box rather than a box from scratch.',
  },
  t: {
    color: 'teal',
    name: 't: box offsets, how to nudge a proposal onto the object',
    code: ['t', 'deltas'],
    about: 'Four numbers (t_x, t_y, t_w, t_h): move the center by t_x proposal widths and t_y proposal heights, and scale the size by a log ratio. Relative units let one regressor serve small and large boxes, and the log keeps widths positive.',
  },
  s: {
    color: 'blue',
    name: 's: class scores or confidences',
    code: ['scores'],
    about: 'Per window, proposal, box or pixel, depending on the method. NMS sorts by them, and in YOLO a box\'s score is its confidence times the class probability.',
  },
  L: {
    color: 'red',
    name: 'L: the loss',
    code: ['loss'],
    about: 'For localization, the softmax loss on the class plus λ times the L2 box loss; for segmentation, the softmax loss at every pixel, averaged. Fast R-CNN uses smooth L1 for the box, so wild misses cannot dominate.',
  },
  tau: {
    color: 'slate',
    name: 'τ: an IoU threshold',
    tex: '\\tau',
    code: ['thresh'],
    about: 'A detection counts as correct at IoU ≥ 0.5, and NMS deletes boxes overlapping a kept one by more than τ. Too high lets duplicates through; too low deletes a real object right beside another.',
  },
};
