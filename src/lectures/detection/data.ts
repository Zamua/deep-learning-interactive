import { Rng } from '../../core/rand';
import { type Box, OBJECTS, SCENE_H, SCENE_W, iou, sceneMasks } from '../../lib/detection-scene';
import { corners } from './kit';

// ---------------------------------------------------------------- NMS

/** Raw detections as a detector might emit them: [class, score, box]. The chapter's NMS figure uses the same set. */
export const CANDIDATES: [number, number, Box][] = [
  [1, 0.97, [30, 172, 200, 262]],
  [1, 0.91, [18, 182, 186, 268]],
  [1, 0.74, [40, 168, 210, 258]],
  [1, 0.52, [10, 190, 150, 270]],
  [2, 0.95, [212, 110, 258, 272]],
  [2, 0.83, [208, 120, 262, 268]],
  [2, 0.66, [216, 100, 252, 250]],
  [2, 0.88, [260, 176, 292, 272]],
  [2, 0.71, [258, 186, 288, 268]],
  [2, 0.62, [210, 114, 292, 270]],
  [3, 0.93, [302, 204, 402, 272]],
  [3, 0.85, [310, 200, 396, 266]],
  [3, 0.69, [296, 212, 388, 274]],
  [3, 0.47, [330, 198, 404, 262]],
  [4, 0.81, [412, 194, 464, 270]],
  [4, 0.64, [418, 200, 466, 266]],
  [2, 0.34, [338, 80, 378, 214]],
  [4, 0.38, [368, 200, 404, 236]],
];

/** Candidate indices, best score first. */
export const BY_SCORE = CANDIDATES.map((_, i) => i).sort((a, b) => CANDIDATES[b]![1] - CANDIDATES[a]![1]);

export interface NmsStep {
  keep: number[];
  removed: number[];
  /** Removed in this step, with their IoU against `cur`. */
  just: [number, number][];
  cur: number;
}

/** Every pick and every drop of NMS at threshold `tau`, as cumulative states (one per round). */
export function nmsSteps(tau: number): NmsStep[] {
  let order = [...BY_SCORE];
  const keep: number[] = [];
  const removed: number[] = [];
  const out: NmsStep[] = [];
  while (order.length) {
    const i = order.shift()!;
    keep.push(i);
    const just: [number, number][] = [];
    order = order.filter((j) => {
      const v = iou(CANDIDATES[i]![2], CANDIDATES[j]![2]);
      if (CANDIDATES[j]![0] === CANDIDATES[i]![0] && v > tau) {
        just.push([j, v]);
        return false;
      }
      return true;
    });
    removed.push(...just.map(([j]) => j));
    out.push({ keep: [...keep], removed: [...removed], just, cur: i });
  }
  return out;
}

export const NMS_05 = nmsSteps(0.5);
export const NMS_065 = nmsSteps(0.65);
export const NMS_03 = nmsSteps(0.3);

// ---------------------------------------------------------------- proposals

/** A pile of region proposals: many loose boxes near objects, some anywhere. */
export const PROPOSALS: Box[] = (() => {
  const rng = new Rng(21);
  const out: Box[] = [];
  for (let k = 0; k < 46; k++) {
    if (k % 3 === 2) {
      const w = rng.uniform(30, 140);
      const h = rng.uniform(30, 120);
      const x = rng.uniform(0, SCENE_W - w);
      const y = rng.uniform(0, SCENE_H - h);
      out.push([x, y, x + w, y + h]);
    } else {
      const o = OBJECTS[k % OBJECTS.length]!.box;
      const ow = o[2] - o[0];
      const oh = o[3] - o[1];
      const cx = (o[0] + o[2]) / 2 + rng.uniform(-0.35, 0.35) * ow;
      const cy = (o[1] + o[3]) / 2 + rng.uniform(-0.3, 0.3) * oh;
      const w = ow * rng.uniform(0.6, 1.5);
      const h = oh * rng.uniform(0.6, 1.4);
      const b = corners(cx, cy, w, h);
      out.push([Math.max(0, b[0]), Math.max(0, b[1]), Math.min(SCENE_W, b[2]), Math.min(SCENE_H, b[3])]);
    }
  }
  return out;
})();

/** Per object, the proposal that covers it best, and that IoU. */
export const BEST_PROPOSAL = OBJECTS.map((o) => {
  let best = 0;
  let bi = 0;
  PROPOSALS.forEach((p, i) => {
    const v = iou(p, o.box);
    if (v > best) {
      best = v;
      bi = i;
    }
  });
  return { i: bi, v: best };
});

// ---------------------------------------------------------------- anchors

export const ANCHOR_STRIDE = 32;
export const SIZES = [48, 96, 192];
export const RATIOS = [0.5, 1, 2];

export function anchorsAt(i: number, j: number, sizes = SIZES, ratios = RATIOS): Box[] {
  const cx = (j + 0.5) * ANCHOR_STRIDE;
  const cy = (i + 0.5) * ANCHOR_STRIDE;
  const out: Box[] = [];
  for (const sz of sizes) for (const r of ratios) out.push(corners(cx, cy, sz * Math.sqrt(r), sz / Math.sqrt(r)));
  return out;
}

/** Each object's best anchor anywhere in the 10 x 15 grid, for one square or for all nine shapes. */
function bestAnchors(sizes: number[], ratios: number[]): { box: Box; v: number }[] {
  return OBJECTS.map((o) => {
    let best = { box: [0, 0, 0, 0] as Box, v: 0 };
    for (let i = 0; i < 10; i++)
      for (let j = 0; j < 15; j++)
        for (const b of anchorsAt(i, j, sizes, ratios)) {
          const v = iou(b, o.box);
          if (v > best.v) best = { box: b, v };
        }
    return best;
  });
}
export const BEST_ONE = bestAnchors([96], [1]);
export const BEST_NINE = bestAnchors(SIZES, RATIOS);
/** The grid position the lecture zooms in on: centered on the dog. */
export const AT: [number, number] = [7, 10];
export const AT_ANCHORS = anchorsAt(AT[0], AT[1]).map((b) => ({ box: b, v: Math.max(...OBJECTS.map((o) => iou(b, o.box))) }));

// ---------------------------------------------------------------- YOLO

export interface YCell {
  r: number;
  c: number;
  boxes: { b: Box; conf: number }[];
  /** The most likely class (1..4), or 0 for a background cell. */
  cls: number;
}

/** Hand-made predictions in YOLO's format on an S x S grid: responsible cells fit their object. */
export function yoloCells(S: number): YCell[] {
  const rng = new Rng(S * 7 + 1);
  const cw = SCENE_W / S;
  const chh = SCENE_H / S;
  const out: YCell[] = [];
  for (let r = 0; r < S; r++)
    for (let c = 0; c < S; c++) {
      const cell: Box = [c * cw, r * chh, (c + 1) * cw, (r + 1) * chh];
      let cls = 0;
      let cover = 0;
      for (const o of OBJECTS) {
        const iw = Math.max(0, Math.min(cell[2], o.box[2]) - Math.max(cell[0], o.box[0]));
        const ih = Math.max(0, Math.min(cell[3], o.box[3]) - Math.max(cell[1], o.box[1]));
        const f = (iw * ih) / (cw * chh);
        if (f > cover && f > 0.25) {
          cover = f;
          cls = o.cls;
        }
      }
      const owner = OBJECTS.find((o) => {
        const ox = (o.box[0] + o.box[2]) / 2;
        const oy = (o.box[1] + o.box[3]) / 2;
        return Math.floor(ox / cw) === c && Math.floor(oy / chh) === r;
      });
      const boxes = [0, 1].map((k) => {
        if (owner) {
          const [x1, y1, x2, y2] = owner.box;
          const j = k === 0 ? 0.04 : 0.16;
          const b: Box = [x1 + rng.uniform(-j, j) * (x2 - x1), y1 + rng.uniform(-j, j) * (y2 - y1), x2 + rng.uniform(-j, j) * (x2 - x1), y2 + rng.uniform(-j, j) * (y2 - y1)];
          return { b, conf: k === 0 ? rng.uniform(0.75, 0.95) : rng.uniform(0.25, 0.5) };
        }
        const cx = (c + rng.uniform(0.2, 0.8)) * cw;
        const cy = (r + rng.uniform(0.2, 0.8)) * chh;
        const b = corners(cx, cy, rng.uniform(0.6, 2.2) * cw, rng.uniform(0.6, 2.2) * chh);
        return { b, conf: rng.uniform(0.02, 0.18) };
      });
      out.push({ r, c, boxes, cls: owner ? owner.cls : cls });
    }
  return out;
}
export const YOLO7 = yoloCells(7);
/** Each object's center cell on an S x S grid, [row, col]. */
export const centerCell = (b: Box, S: number): [number, number] => [Math.floor(((b[1] + b[3]) / 2) / (SCENE_H / S)), Math.floor(((b[0] + b[2]) / 2) / (SCENE_W / S))];

// ---------------------------------------------------------------- average precision

export const AP_SCORES = [0.98, 0.95, 0.91, 0.87, 0.8, 0.72, 0.65, 0.51, 0.4, 0.33];
export const AP_TP = [1, 1, 0, 1, 1, 0, 1, 0, 0, 1];
export const N_GT = 7;
export const TP_CUM = AP_TP.map((_, i) => AP_TP.slice(0, i + 1).reduce((a, b) => a + b, 0));
export const FP_CUM = AP_TP.map((_, i) => i + 1 - TP_CUM[i]!);
export const PREC = TP_CUM.map((t, i) => t / (t + FP_CUM[i]!));
export const REC = TP_CUM.map((t) => t / N_GT);
export const ENV = PREC.map((_, i) => Math.max(...PREC.slice(i)));
export const AP = REC.reduce((acc, r, i) => acc + (r - (i ? REC[i - 1]! : 0)) * ENV[i]!, 0);

// ---------------------------------------------------------------- feature map and segmentation (built on first use)

export const FW = 12;
export const FH = 8;
let fmapCache: number[] | null = null;

/** A made-up one-channel feature map of the scene at stride 40: larger where objects are. */
export function fmap(): number[] {
  if (fmapCache) return fmapCache;
  const m = sceneMasks(2);
  const rng = new Rng(3);
  const out: number[] = [];
  for (let a = 0; a < FH; a++)
    for (let b = 0; b < FW; b++) {
      let cnt = 0;
      for (let yy = a * 20; yy < a * 20 + 20; yy++) for (let xx = b * 20; xx < b * 20 + 20; xx++) if (m.cls[yy * m.w + xx]) cnt++;
      out.push(Math.max(0, Math.min(9, Math.round((8 * cnt) / 400 + 2.4 * rng.next()))));
    }
  fmapCache = out;
  return out;
}

/** RoI pooling with nearly equal, non-overlapping bins (np.array_split). roi in cells: x1, y1, x2, y2. */
export function roiPool(roi: Box, H = 2, W = 2): { ys: number; ye: number; xs: number; xe: number; v: number; ai: number; aj: number }[] {
  const f = fmap();
  const split = (a: number, b: number, n: number): [number, number][] => {
    const len = b - a;
    const base = Math.floor(len / n);
    const extra = len % n;
    const out: [number, number][] = [];
    let p = a;
    for (let i = 0; i < n; i++) {
      const sz = base + (i < extra ? 1 : 0);
      out.push([p, p + sz]);
      p += sz;
    }
    return out;
  };
  const rows = split(roi[1], roi[3], H);
  const cols = split(roi[0], roi[2], W);
  const out: { ys: number; ye: number; xs: number; xe: number; v: number; ai: number; aj: number }[] = [];
  for (const [ys, ye] of rows)
    for (const [xs, xe] of cols) {
      let v = -1;
      let ai = ys;
      let aj = xs;
      for (let a = ys; a < ye; a++)
        for (let b = xs; b < xe; b++)
          if (f[a * FW + b]! > v) {
            v = f[a * FW + b]!;
            ai = a;
            aj = b;
          }
      out.push({ ys, ye, xs, xe, v, ai, aj });
    }
  return out;
}

const fcnCache = new Map<number, Uint8Array>();

/**
 * The best an FCN predicting at `stride` (scene px) could do: the class coverage of every grid
 * cell, upsampled bilinearly, then argmax per pixel. Stride 0 is the truth. Maps are 240 x 160.
 */
export function fcnLabels(stride: number): Uint8Array {
  const m = sceneMasks(2);
  if (stride === 0) return m.cls;
  const hit = fcnCache.get(stride);
  if (hit) return hit;
  const cs = stride / 2;
  const gw = Math.round(m.w / cs);
  const gh = Math.round(m.h / cs);
  const C = 5;
  const cover = new Float32Array(C * gw * gh);
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      const g = Math.min(gh - 1, Math.floor(y / cs)) * gw + Math.min(gw - 1, Math.floor(x / cs));
      cover[m.cls[y * m.w + x]! * gw * gh + g]! += 1 / (cs * cs);
    }
  const out = new Uint8Array(m.w * m.h);
  for (let y = 0; y < m.h; y++) {
    const gy = Math.max(0, Math.min(gh - 1, (y + 0.5) / cs - 0.5));
    const y0 = Math.floor(gy);
    const y1 = Math.min(gh - 1, y0 + 1);
    const fy = gy - y0;
    for (let x = 0; x < m.w; x++) {
      const gx = Math.max(0, Math.min(gw - 1, (x + 0.5) / cs - 0.5));
      const x0 = Math.floor(gx);
      const x1 = Math.min(gw - 1, x0 + 1);
      const fx = gx - x0;
      let best = 0;
      let bv = -1;
      for (let c = 0; c < C; c++) {
        const o = c * gw * gh;
        const v = (1 - fy) * ((1 - fx) * cover[o + y0 * gw + x0]! + fx * cover[o + y0 * gw + x1]!) + fy * ((1 - fx) * cover[o + y1 * gw + x0]! + fx * cover[o + y1 * gw + x1]!);
        if (v > bv) {
          bv = v;
          best = c;
        }
      }
      out[y * m.w + x] = best;
    }
  }
  fcnCache.set(stride, out);
  return out;
}
