import type { SceneDef } from '../../../lecture/scene';
import { Rng } from '../../../core/rand';
import { axes, curve, frame, key, series, xTicks } from '../draw';

const RUNS = [
  { beat: 'low', k: 'blue', name: 'low', f: (t: number) => 2.3 - 0.07 * t + 0.001 * t * t, to: 10, end: 1.7 },
  { beat: 'high', k: 'gold', name: 'high', f: (t: number) => 1.25 + 1.05 * Math.exp(-2.2 * t), to: 10, end: 1.25 },
  { beat: 'huge', k: 'red', name: 'very high', f: (t: number) => 2.3 + 0.4 * t + 1.5 * t * t, to: 0.75, end: 3 },
  { beat: 'good', k: 'green', name: 'good', f: (t: number) => 0.45 + 1.85 * Math.exp(-0.9 * t) - 0.015 * t, to: 10, end: 0.3 },
] as const;

const rates: SceneDef = {
  draw(s) {
    const F = frame(12 * s.u, s.h * 0.1, s.w - 6 * s.u, s.h - 9 * s.u, [0, 10], [0, 3]);
    axes(s, F, 'epoch', '', { x: '--ink-3', y: 'red' });
    s.text('L', F.l - 2 * s.u, F.t + 2 * s.u, { size: 3.6, font: 'mono', weight: 650, align: 'right', color: s.c('red') });
    xTicks(s, F, [2, 4, 6, 8]);
    const cur = RUNS.reduce((k, r, i) => (s.since(r.beat) >= 0 ? i : k), -1);
    RUNS.forEach((r, i) => {
      const a = s.ease(r.beat, 0.4);
      s.alpha(a * (i === cur ? 1 : 0.55), () => {
        curve(s, F, r.f, 0, r.to, r.k, { width: i === cur ? 0.8 : 0.5, upto: s.ease(r.beat, 2, 0.3) });
        s.alpha(s.ease(r.beat, 0.6, 1.8), () => {
          if (r.beat === 'huge') s.text('very high: nan', F.X(0.95), F.t + 3 * s.u, { size: 3.4, font: 'mono', weight: 600, align: 'left', color: s.c(r.k), halo: true });
          else s.text(r.name, F.r - 1 * s.u, F.Y(r.end) + (r.beat === 'good' ? 3.8 : -3.4) * s.u, { size: 3.4, font: 'mono', weight: 600, align: 'right', color: s.c(r.k), halo: true });
        });
      });
    });
  },
};

const rng = new Rng(5);
const NOISY: [number, number][] = Array.from({ length: 61 }, (_, t) => [t, Math.max(0.05, 0.35 + 1.95 * Math.exp(-t / 18) + (t ? rng.randn() * 0.22 : 0))]);
const T = (e: number) => 2.3 * 0.85 ** e;
const V = (e: number) => T(e) + 0.05 + 0.0022 * e * e;
const TRAIN: [number, number][] = Array.from({ length: 21 }, (_, e) => [e, T(e)]);
const VAL: [number, number][] = Array.from({ length: 21 }, (_, e) => [e, V(e)]);

const more: SceneDef = {
  draw(s) {
    const two = s.ease('val', 0.8);
    s.alpha(1 - two, () => {
      const F = frame(12 * s.u, s.h * 0.12, s.w - 6 * s.u, s.h - 9 * s.u, [0, 60], [0, 2.6]);
      axes(s, F, 'step', 'L', { x: '--ink-3', y: 'red' });
      series(s, F, NOISY, 'purple', { upto: s.ease('noisy', 3, 0.3), width: 0.45 });
      s.alpha(s.ease('noisy', 0.6, 3.5), () => {
        curve(s, F, (t) => 0.35 + 1.95 * Math.exp(-t / 18), 0, 60, 'purple', { width: 0.8, dash: [1.6, 1] });
        s.text('trend: still down', F.r - 1 * s.u, F.t + 2 * s.u, { size: 3.4, font: 'mono', align: 'right', color: s.c('purple'), halo: true });
        s.text('batch of 8', F.r - 1 * s.u, F.t + 6.5 * s.u, { size: 3.2, font: 'mono', align: 'right', color: s.c('--ink-3') });
      });
    });
    s.alpha(two, () => {
      const F = frame(12 * s.u, s.h * 0.12, s.w - 6 * s.u, s.h - 9 * s.u, [0, 20], [0, 2.5]);
      axes(s, F, 'epoch', 'L', { x: '--ink-3', y: 'red' });
      xTicks(s, F, [4, 8, 12, 16]);
      let kx = F.X(6);
      kx = key(s, kx, F.t + 2 * s.u, 'blue', 'train');
      key(s, kx, F.t + 2 * s.u, 'gold', 'val');
      const up = Math.max(0, Math.min(1, (s.since('val') - 0.6) / 4));
      s.alpha(s.win('gap', 'bottom'), () => {
        for (const e of [4, 16]) s.line(F.X(e), F.Y(T(e)) - 1 * s.u, F.X(e), F.Y(V(e)) + 1 * s.u, s.c('red'), 0.4);
        s.text('gap: small, then widening', F.X(0.6), F.Y(0.22), { size: 3.2, font: 'mono', align: 'left', color: s.c('red'), halo: true });
      });
      series(s, F, TRAIN, 'blue', { upto: up });
      series(s, F, VAL, 'gold', { upto: up });
      s.alpha(s.ease('bottom', 0.6), () => {
        s.line(F.X(12), F.Y(V(12)), F.X(12), F.b, s.tint('gold', 0.7), 0.3, [1.2, 1]);
        s.circle(F.X(12), F.Y(V(12)), 1.3 * s.u, { fill: s.c('gold') });
        s.text('best: epoch 12', F.X(12), F.Y(V(12)) - 4.5 * s.u, { size: 3.4, font: 'mono', weight: 600, color: s.c('gold'), halo: true });
      });
    });
  },
};

export const scenes: Record<string, SceneDef> = { rates, more };
