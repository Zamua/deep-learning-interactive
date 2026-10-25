import type { SceneDef } from '../../../lecture/scene';
import { cells } from '../../draw';
import { axes, frame, key, series, xTicks } from '../draw';

const T = (e: number) => 2.3 * 0.84 ** e;
const V = (e: number) => T(e) + 0.05 + 0.007 * e * e;
const EPOCHS = Array.from({ length: 17 }, (_, e) => e);
const TRAIN = EPOCHS.map((e): [number, number] => [e, T(e)]);
const VAL = EPOCHS.map((e): [number, number] => [e, V(e)]);
const ROWS = [2, 4, 6, 8, 10, 12];
const BEST = 3;
const f2 = (v: number) => v.toFixed(2);

const SPLITS = [
  { name: 'train', n: '40,000', from: 0, to: 0.8, k: 'blue', role: 'fits the weights', beat: 'train' },
  { name: 'val', n: '5,000', from: 0.8, to: 0.9, k: 'gold', role: 'makes the choices', beat: 'val' },
  { name: 'test', n: '5,000', from: 0.9, to: 1, k: 'teal', role: 'reports once, at the end', beat: 'test' },
] as const;

const splits: SceneDef = {
  draw(s) {
    const l = 8 * s.u;
    const r = s.w - 8 * s.u;
    const y = s.h * 0.22;
    const bh = 11 * s.u;
    const X = (f: number) => l + (r - l) * f;
    s.alpha(s.ease('data', 0.6), () => {
      s.text('50,000 examples', s.w / 2, y - bh / 2 - 5 * s.u, { size: 3.8, font: 'mono', weight: 600, color: s.c('--ink-2') });
      s.rrect(l, y - bh / 2, r - l, bh, 1.2, { fill: s.tint('--ink-3', 0.15), stroke: s.tint('--ink-3', 0.5), lw: 0.3 });
    });
    SPLITS.forEach((p, i) => {
      const a = s.ease(p.beat, 0.6);
      s.alpha(a, () => {
        s.rrect(X(p.from) + 0.3 * s.u, y - bh / 2, X(p.to) - X(p.from) - 0.6 * s.u, bh, 1, { fill: s.tint(p.k, 0.35), stroke: s.c(p.k), lw: 0.35 });
        if (i === 0) s.text(`train  ${p.n}`, (X(p.from) + X(p.to)) / 2, y, { size: 3.8, font: 'mono', weight: 600, color: s.c('--ink') });
        else {
          const cx = (X(p.from) + X(p.to)) / 2;
          const ly = y + bh / 2 + (i === 1 ? 5 : 11) * s.u;
          s.line(cx, y + bh / 2 + 0.6 * s.u, cx, ly - 2 * s.u, s.c(p.k), 0.3);
          s.text(`${p.name}  ${p.n}`, cx + 1 * s.u, ly, { size: 3.4, font: 'mono', weight: 600, align: 'right', color: s.c(p.k) });
        }
      });
      s.alpha(s.ease(p.beat, 0.6, 1), () => {
        const ry = s.h * (0.56 + 0.13 * i);
        const nx = s.w / 2 - (s.tall ? 20 : 26) * s.u;
        s.rrect(nx - 15 * s.u, ry - 3.5 * s.u, 15 * s.u, 7 * s.u, 1, { fill: s.tint(p.k, 0.25), stroke: s.c(p.k), lw: 0.3 });
        s.text(p.name, nx - 7.5 * s.u, ry, { size: 3.4, font: 'mono', weight: 650, color: s.c(p.k) });
        s.text(p.role, nx + 3 * s.u, ry, { size: 3.8, align: 'left', color: s.c('--ink-2') });
      });
    });
  },
};

const curves: SceneDef = {
  draw(s) {
    const F = frame(12 * s.u, s.h * 0.1, s.w - 8 * s.u, s.h - 10 * s.u, [0, 16], [0, 2.5]);
    axes(s, F, 'epoch', 'L', { x: '--ink-3', y: 'red' });
    xTicks(s, F, [4, 8, 12]);
    let kx = F.X(4.2);
    kx = key(s, kx, F.t + 2 * s.u, 'blue', 'train');
    key(s, kx, F.t + 2 * s.u, 'gold', 'val');
    const e = s.ease('both', 1) + 6 * s.ease('early', 3, 0.3) + 9 * s.ease('gap', 4, 0.3);
    const over = s.ease('memo', 0.8);
    s.alpha(over, () => {
      s.rrect(F.X(7.3), F.t + 6 * s.u, F.r - F.X(7.3), F.b - F.t - 6 * s.u, 0, { fill: s.tint('red', 0.07) });
      s.line(F.X(7.3), F.t + 6 * s.u, F.X(7.3), F.b, s.tint('red', 0.6), 0.3, [1.2, 1]);
      s.text('overfitting', F.X(12.3), F.Y(0.85), { size: 3.6, weight: 600, color: s.c('red'), halo: true });
    });
    const blind = s.ease('blind', 0.6);
    series(s, F, TRAIN, 'blue', { upto: e / 16, width: 0.6 + 0.4 * blind });
    series(s, F, VAL, 'gold', { upto: e / 16 });
    s.alpha(s.ease('gap', 0.6, 4.3), () => {
      s.circle(F.X(8), F.Y(V(8)), 1.2 * s.u, { fill: s.c('gold') });
      s.text('lowest', F.X(8), F.Y(V(8)) + 4.5 * s.u, { size: 3.2, font: 'mono', color: s.c('gold'), halo: true });
    });
    s.alpha(blind, () => {
      s.text('still falling', F.X(16) - 1 * s.u, F.Y(T(16)) - 4 * s.u, { size: 3.2, font: 'mono', align: 'right', color: s.c('blue'), halo: true });
    });
  },
};

const stop: SceneDef = {
  draw(s) {
    const tableA = 1 - s.ease('under', 0.6);
    const xs = [s.w / 2 - 22 * s.u, s.w / 2, s.w / 2 + 22 * s.u];
    const top = s.h * 0.1;
    const rh = 9.5 * s.u;
    s.alpha(tableA, () => {
      ['epoch', 'train', 'val'].forEach((t, j) => s.text(t, xs[j]!, top, { size: 3.6, font: 'mono', weight: 650, color: s.c((['--ink-2', 'blue', 'gold'] as const)[j]) }));
      ROWS.forEach((ep, i) => {
        const y = top + (i + 1) * rh;
        s.alpha(s.ease('table', 0.4, 0.15 * i), () => {
          const hi = i === BEST ? s.ease('min', 0.6) : 0;
          cells(s, [xs[0]!], y, [String(ep)], '--ink-3', { w: 13, h: 7.5, size: 3.4, on: [hi] });
          cells(s, [xs[1]!], y, [f2(T(ep))], 'blue', { w: 15, h: 7.5, size: 3.4 });
          cells(s, [xs[2]!], y, [f2(V(ep))], 'gold', { w: 15, h: 7.5, size: 3.4, on: [hi] });
        });
      });
      s.alpha(s.ease('min', 0.6, 0.8), () => {
        s.text('← lowest', xs[2]! + 9.5 * s.u, top + (BEST + 1) * rh, { size: 3.2, font: 'mono', align: 'left', color: s.c('gold') });
      });
      s.alpha(s.ease('keep', 0.6), () => {
        s.text("keep epoch 8's weights: early stopping", s.w / 2, top + 7 * rh + 2 * s.u, { size: 3.6, weight: 600, color: s.c('green') });
      });
    });
    const cases = [
      { name: 'underfitting', tr: 1.9, va: 2.0, k: 'red', at: 'under' },
      { name: 'overfitting', tr: 0.1, va: 1.3, k: 'red', at: 'under' },
      { name: 'fits well', tr: 0.4, va: 0.5, k: 'green', at: 'fine' },
    ] as const;
    const nx = s.w / 2 - (s.tall ? 20 : 26) * s.u;
    const len = (v: number) => (v / 2) * (s.tall ? 46 : 56) * s.u;
    s.alpha(s.ease('under', 0.6, 0.4), () => {
      let kx = nx + 2 * s.u;
      kx = key(s, kx, s.h * 0.12, 'blue', 'train');
      key(s, kx, s.h * 0.12, 'gold', 'val');
    });
    cases.forEach((c, i) => {
      const y = s.h * (0.3 + 0.24 * i);
      s.alpha(s.ease(c.at, 0.6, 0.4 + (i === 1 ? 0.8 : 0)), () => {
        s.text(c.name, nx - 2 * s.u, y, { size: 3.6, weight: 600, align: 'right', color: s.c(c.k) });
        ([[c.tr, 'blue', -2.4], [c.va, 'gold', 2.4]] as const).forEach(([v, k, dy]) => {
          s.rrect(nx, y + dy * s.u - 1.8 * s.u, len(v), 3.6 * s.u, 0.6, { fill: s.tint(k, 0.55), stroke: s.c(k), lw: 0.25 });
          s.text(v.toFixed(1), nx + len(v) + 1.5 * s.u, y + dy * s.u, { size: 3, font: 'mono', align: 'left', color: s.c(k) });
        });
      });
    });
  },
};

export const scenes: Record<string, SceneDef> = { splits, curves, stop };
