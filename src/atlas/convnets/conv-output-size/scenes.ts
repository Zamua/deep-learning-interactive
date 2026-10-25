import type { Scene, SceneDef } from '../../../lecture/scene';
import { clamp01, smooth } from '../../../lecture/scene';
import { cells, columns, rowLabel } from '../../draw';
import { rich } from '../draw';

const IN = [3, 1, 4, 1, 5, 9, 2];

/** Hops completed `t` seconds in, one every `every` seconds, each eased over `dur`: 0 .. n. */
function hops(t: number, n: number, every = 0.9, dur = 0.5): number {
  let p = 0;
  for (let k = 0; k < n; k++) p += smooth(clamp01((t - k * every) / dur));
  return p;
}

/** A row of cells with a filter-wide window at position `p` (in cells), and outputs under each window center. */
function track(s: Scene, o: { labels: string[]; pads: number; p: number; F: number; outs: number[]; outA: (i: number) => number; y: number; yo: number; pitch: number; bad?: number; on?: number; padA?: number; winA?: number }) {
  const n = o.labels.length;
  const xs = columns(s, n, o.pitch);
  const pitch = o.pitch * s.u;
  const cw = Math.min(o.pitch - 1.4, 11);
  o.labels.forEach((l, i) => {
    const pad = i < o.pads || i >= n - o.pads;
    s.alpha(pad ? (o.padA ?? 1) : 1, () => cells(s, [xs[i]!], o.y, [l], pad ? '--ink-3' : 'orange', { w: cw, h: 8.5 }));
  });
  const k = o.bad ? 'red' : 'blue';
  s.alpha(o.winA ?? 1, () => s.rrect(xs[0]! + (o.p - 0.5) * pitch - 0.6 * s.u, o.y - 5.8 * s.u, o.F * pitch + 1.2 * s.u, 11.6 * s.u, 1.8, { fill: s.tint(k, 0.07), stroke: s.c(k), lw: 0.5 }));
  o.outs.forEach((c, i) => {
    s.alpha(o.outA(i), () => cells(s, [xs[0]! + (c + (o.F - 1) / 2) * pitch], o.yo, [String(i)], 'gold', { w: cw, h: 8.5, on: [o.on ?? 0] }));
  });
  return xs;
}

const count: SceneDef = {
  draw(s) {
    const pitch = s.tall ? 12 : 12.5;
    const p = hops(s.since('slide') - 0.4, 4);
    const [yf, y, yo, yt] = [0.17, 0.38, 0.62, 0.84].map((f) => s.h * f);
    const xs = track(s, {
      labels: IN.map(String), pads: 0, p, F: 3, pitch, y, yo,
      outs: [0, 1, 2, 3, 4], outA: (i) => s.ease('row', 0.4, 2) * smooth(clamp01((p - i + 0.6) / 0.4)), on: s.ease('count', 0.6),
    });
    const fx = xs[0]! + p * pitch * s.u;
    cells(s, [0, 1, 2].map((k) => fx + k * pitch * s.u), yf, ['w', 'w', 'w'], 'blue', { w: 10, h: 7.5 });
    s.text('F = 3', fx + pitch * s.u, yf - 7 * s.u, { size: 3.4, font: 'mono', weight: 600, color: s.c('slate') });
    s.text('W = 7', s.w / 2, y + 8.6 * s.u, { size: 3.4, font: 'mono', weight: 600, color: s.c('orange') });
    s.alpha(s.ease('slide', 0.5, 0.6), () => rowLabel(s, 'out', xs[1]! - (pitch / 2 + 2) * s.u, yo, 'gold', 3.6));
    s.alpha(s.ease('count', 0.6, 0.5), () => rich(s, [['W − F + 1 = 7 − 3 + 1 = ', '--ink-2'], ['5', 'gold']], s.w / 2, yt, { size: 4.2, weight: 600 }));
  },
};

const PADDED = ['0', ...IN.map(String), '0'];

const pad: SceneDef = {
  draw(s) {
    const pitch = s.tall ? 9.6 : 11;
    const grow = s.ease('pad', 0.8, 1.6);
    const p = hops(s.since('slide') - 0.2, 6, 0.6, 0.4);
    const [y, yo, yt] = [0.36, 0.6, 0.84].map((f) => s.h * f);
    const xs = track(s, {
      labels: PADDED, pads: 1, p, F: 3, pitch, y, yo,
      outs: [0, 1, 2, 3, 4, 5, 6], outA: (i) => s.ease('slide', 0.4, 0.1) * smooth(clamp01((p - i + 0.6) / 0.4)), on: s.ease('same', 0.6),
      padA: grow, winA: s.ease('slide', 0.5),
    });
    s.alpha(grow, () => {
      s.text('P = 1', xs[0]!, y - 9 * s.u, { size: 3.4, font: 'mono', weight: 600, color: s.c('slate') });
      s.text('P = 1', xs[PADDED.length - 1]!, y - 9 * s.u, { size: 3.4, font: 'mono', weight: 600, color: s.c('slate') });
      s.text('W + 2P = 9', s.w / 2, y + 8.6 * s.u, { size: 3.4, font: 'mono', weight: 600, color: s.c('orange') });
    });
    s.alpha(s.ease('slide', 0.6, 4), () => s.text('7 in, 7 out', s.w / 2, yo + 8.6 * s.u, { size: 3.4, font: 'mono', color: s.c('--ink-2') }));
    s.alpha(s.ease('same', 0.6, 0.6), () => rich(s, [['P = (F − 1) / 2', 'slate'], ['  keeps the size', '--ink-2']], s.w / 2, yt, { size: 4, weight: 600 }));
  },
};

const stride: SceneDef = {
  marks: {
    f: { tex: String.raw`\dfrac{W - \symF + 2\symP}{\symS} + 1`, x: 0.5, y: 0.13, size: 5 },
  },
  draw(s) {
    const pitch = s.tall ? 9.6 : 11;
    const fit = s.ease('fit', 0.8);
    const [y, yo, yt] = [0.4, 0.62, 0.84].map((f) => s.h * f);
    s.show('f', s.ease('formula', 0.6));
    s.alpha(1 - fit, () => {
      const p = 2 * hops(s.since('jump') - 0.6, 3, 0.9, 0.5);
      track(s, {
        labels: PADDED, pads: 1, p, F: 3, pitch, y, yo,
        outs: [0, 2, 4, 6], outA: (i) => s.ease('jump', 0.4, 0.4) * smooth(clamp01((p / 2 - i + 0.6) / 0.4)), on: s.ease('formula', 0.6, 3),
      });
      s.alpha(s.ease('jump', 0.6, 0.2), () => s.text('S = 2', s.w / 2, y + 8.6 * s.u, { size: 3.4, font: 'mono', weight: 600, color: s.c('slate') }));
      s.alpha(s.ease('formula', 0.6, 1.5), () => rich(s, [['(7 − 3 + 2) / 2 + 1 = ', '--ink-2'], ['4', 'gold']], s.w / 2, yt, { size: 4, weight: 600 }));
    });
    s.alpha(fit, () => {
      const p = 2 * hops(s.since('fit') - 0.8, 3, 1, 0.5);
      const over = p > 5;
      track(s, {
        labels: ['3', '1', '4', '1', '5', '9', '2', '6'], pads: 0, p, F: 3, pitch, y, yo,
        outs: [0, 2, 4], outA: (i) => smooth(clamp01((p / 2 - i + 0.6) / 0.4)), bad: over ? 1 : 0,
      });
      s.text('W = 8, F = 3, S = 2', s.w / 2, y - 9.5 * s.u, { size: 3.4, font: 'mono', weight: 600, color: s.c('--ink-2') });
      s.alpha(s.ease('fit', 0.6, 3.6), () => rich(s, [['(8 − 3) / 2 + 1 = ', '--ink-2'], ['3.5  ✗', 'red']], s.w / 2, yt, { size: 4, weight: 600 }));
    });
  },
};

export const scenes: Record<string, SceneDef> = { count, pad, stride };
