// Box arithmetic for box-iou and iou.

/** Corners (x1, y1, x2, y2): top left, then bottom right, y counting down. */
export type Box = [number, number, number, number];

export const area = (b: Box): number => (b[2] - b[0]) * (b[3] - b[1]);
/** The overlap's edges, which cross over (right < left) when the boxes miss each other. */
export const edges = (a: Box, b: Box) => ({ l: Math.max(a[0], b[0]), r: Math.min(a[2], b[2]), t: Math.max(a[1], b[1]), bt: Math.min(a[3], b[3]) });
export const inter = (a: Box, b: Box): number => {
  const e = edges(a, b);
  return Math.max(0, e.r - e.l) * Math.max(0, e.bt - e.t);
};
export const union = (a: Box, b: Box): number => area(a) + area(b) - inter(a, b);
export const iou = (a: Box, b: Box): number => inter(a, b) / union(a, b);
/** The box around both, a common stand-in for the overlap or the union. */
export const hull = (a: Box, b: Box): number => (Math.max(a[2], b[2]) - Math.min(a[0], b[0])) * (Math.max(a[3], b[3]) - Math.min(a[1], b[1]));

export const tex = (b: Box): string => `(${b.join(', ')})`;
