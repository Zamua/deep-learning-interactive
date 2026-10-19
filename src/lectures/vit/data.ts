import { CIFAR_CLASSES } from '../../core/data';
import type { Plot } from '../../core/plot';
import { Rng } from '../../core/rand';
import type { Scene } from '../../lecture/scene';
import { imgCanvas } from '../../lib/vit-draw';
import { type Assets, argmax, clsMap, initPos, loadAssets, posSimilarity, traceOf } from '../../lib/vit-figs';
import { edgeMap } from '../../lib/vit-figs2';

/** Test-sample images the lecture shows: the plane throughout, the deer for attention, a gallery. */
export const MAIN = 0;
export const CLSI = 34;
export const FEW = [17, 73, 4, 49];

export interface LecData {
  a: Assets;
  /** Image i of the 200-image test sample as a 32 x 32 canvas. */
  img(i: number): HTMLCanvasElement;
  /** Class token attention over the 64 patches: layer l, column 0-3 = head, 4 = mean, 5 = rollout. */
  cls(i: number, l: number, col: number): Float32Array;
  /** Top class and its probability. */
  pred(i: number): [string, number];
  /** Position-embedding cosine similarity, 64 x 64, trained and at initialization. */
  sim: { tr: Float32Array; init: Float32Array };
  /** The fixed shuffle and both models' probabilities before and after it, for MAIN. */
  shuffle: { order: number[]; vit: [Float32Array, Float32Array]; nopos: [Float32Array, Float32Array] };
  /** Mean attention distance sums per (layer, head), and how many images went in. */
  dist: { sum: Float64Array; n: number; uniform: number };
  /** Vertical-edge response of image i rolled right by `shift` pixels. */
  edges(i: number, shift: number): Float32Array;
}

let D: LecData | null = null;
let plot: Plot | null = null;
const memo = new Map<string, unknown>();
const once = <T>(k: string, f: () => T): T => {
  if (!memo.has(k)) memo.set(k, f());
  return memo.get(k) as T;
};

loadAssets()
  .then((a) => {
    const m = a.vit;
    const order = new Rng(7).shuffle(Array.from({ length: 64 }, (_, i) => i));
    let uni = 0;
    for (let i = 0; i < m.N; i++) for (let j = 0; j < m.N; j++) uni += m.dist(i, j);
    const dist = { sum: new Float64Array(m.L * m.H), n: 0, uniform: uni / (m.N * m.N) };
    D = {
      a,
      img: (i) => imgCanvas(a.test, i),
      cls: (i, l, col) => once(`c${i}-${l}-${col}`, () => clsMap(m, traceOf(a, m, i), l, col)),
      pred: (i) => once(`p${i}`, () => {
        const pr = traceOf(a, m, i).probs;
        const c = argmax(pr);
        return [CIFAR_CLASSES[c]!, pr[c]!] as [string, number];
      }),
      sim: { tr: posSimilarity(m.pos, m.N, m.D), init: posSimilarity(initPos(m.N + 1, m.D), m.N, m.D) },
      shuffle: {
        order,
        vit: [traceOf(a, m, MAIN).probs, m.forward(m.patches(a.test.pixels, MAIN * 3072), order).probs],
        nopos: [traceOf(a, a.nopos, MAIN).probs, a.nopos.forward(a.nopos.patches(a.test.pixels, MAIN * 3072), order).probs],
      },
      dist,
      edges: (i, shift) => once(`e${i}-${shift}`, () => edgeMap(a.test.pixels, i * 3072, shift)),
    };
    plot?.redraw();
    // Mean attention distance over the whole test sample, one image per tick.
    const step = () => {
      if (dist.n >= a.test.n) return;
      const tr = m.forward(m.patches(a.test.pixels, dist.n * 3072));
      for (let l = 0; l < m.L; l++) for (let h = 0; h < m.H; h++) dist.sum[l * m.H + h]! += m.attnDistance(tr, l, h);
      dist.n++;
      setTimeout(step, 25);
    };
    setTimeout(step, 400);
  })
  .catch((e: Error) => {
    console.warn('vit lecture assets:', e.message);
  });

/** The trained models and images, or null while they load (the stage redraws once they land). */
export function data(s: Scene): LecData | null {
  plot = s.p;
  return D;
}
