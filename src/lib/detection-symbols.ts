import type { SymbolMap } from '../core/symbols';

/** Shared by the detection chapter and its lecture, so a symbol keeps its color across both. */
export const DETECTION_SYMBOLS: SymbolMap = {
  x: { color: 'orange', name: 'x: the input image', code: ['img'] },
  bp: { color: 'purple', name: 'b̂: a box the network predicts', tex: '\\hat{b}', code: ['box', 'boxes', 'pred'] },
  bg: { color: 'gold', name: 'b*: the true (ground-truth) box', tex: 'b^{*}', code: ['gt'] },
  P: { color: 'green', name: 'P: a region proposal or anchor box', code: ['P', 'proposals', 'anchors'] },
  t: { color: 'teal', name: 't: box offsets, how to nudge a proposal onto the object', code: ['t', 'deltas'] },
  s: { color: 'blue', name: 's: class scores or confidences', code: ['scores'] },
  L: { color: 'red', name: 'L: the loss', code: ['loss'] },
  tau: { color: 'slate', name: 'τ: an IoU threshold', tex: '\\tau', code: ['thresh'] },
};
