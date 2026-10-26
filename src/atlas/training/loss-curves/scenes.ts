import { type Scene, type SceneDef, smooth } from '../../../lecture/scene';
import { Rng } from '../../../core/rand';
import { cells, columns } from '../../draw';
import { axes, curve, fmt, frame, key, series, xTicks, yTicks } from '../draw';

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

/** Eased 0 -> 1 starting a fraction `f` of the way through beat `id`, so it tracks the voice at any pace. */
const after = (s: Scene, id: string, f: number, dur = 0.5): number => smooth((s.t - s.at(id) - f * (s.end(id) - s.at(id))) / dur);

/** Logged losses, one list per shape; null is the reading that printed nan. */
const LOGS: { beat: string; vals: (number | null)[]; top: number; ticks: number[]; k: 'blue' | 'gold' | 'red' | 'purple'; verdict: string; at: string }[] = [
  { beat: 'list', vals: [2.3, 2.28, 2.26, 2.24, 2.21, 2.19], top: 2.6, ticks: [1, 2], k: 'blue', verdict: 'same small drop each time: rate too low', at: 'slow' },
  { beat: 'plateau', vals: [2.3, 1.38, 1.21, 1.19, 1.22, 1.2], top: 2.6, ticks: [1, 2], k: 'gold', verdict: 'fast drop, then flat and high: too high', at: 'plateau' },
  { beat: 'explode', vals: [2.3, 4.88, 11.21, 27.93, 69.1, null], top: 75, ticks: [25, 50], k: 'red', verdict: 'grows every reading to nan: far too high', at: 'explode' },
  { beat: 'noisy', vals: [2.3, 2.33, 1.71, 1.95, 1.32, 1.55, 0.92, 1.16], top: 2.6, ticks: [1, 2], k: 'purple', verdict: 'up and down, trending down: batch too small', at: 'noisy' },
];

const read: SceneDef = {
  draw(s) {
    const u = s.u;
    s.text('training loss, every 100 steps', s.w / 2, s.h * 0.06, { size: 3.3, font: 'mono', color: s.c('--ink-2') });
    LOGS.forEach((g, n) => {
      const next = LOGS[n + 1];
      const a = s.ease(g.beat, 0.5) * (next ? 1 - s.ease(next.beat, 0.4) : 1);
      if (a <= 0.003) return;
      s.alpha(a, () => {
        const m = g.vals.length;
        const F = frame(14 * u, s.h * 0.15, s.w - 6 * u, s.h * 0.7, [-0.5, m - 0.5], [0, g.top]);
        axes(s, F, '', 'L', { x: '--ink-3', y: 'red' });
        yTicks(s, F, g.ticks, (v) => String(v));
        const reveal = n === 0 ? Math.min(1, Math.max(0, (s.prog('list') - 0.3) / 0.55)) : s.ease(g.beat, 1.6, 0.3);
        const pts = g.vals.flatMap((v, i) => (v === null ? [] : [[i, v] as [number, number]]));
        const shown = Math.floor(reveal * (m - 1) + 1e-6);
        series(s, F, pts, g.k, { upto: Math.min(1, (reveal * (m - 1)) / Math.max(1, pts.length - 1)), width: 0.5, dots: 1.1 });
        g.vals.forEach((v, i) => {
          if (i > shown) return;
          const t = v === null ? 'nan' : fmt(v, 2);
          s.text(t, F.X(i), F.b + 4 * u, { size: 3, font: 'mono', weight: v === null ? 700 : 500, color: s.c(v === null ? 'red' : '--ink-2') });
          if (v === null) s.text('nan', F.X(i), F.t + 3 * u, { size: 3.4, font: 'mono', weight: 700, color: s.c('red'), halo: true });
        });
        s.alpha(after(s, g.at, n === 0 ? 0.2 : 0.55), () => s.text(g.verdict, s.w / 2, s.h * 0.88, { size: 3.4, font: 'mono', weight: 600, color: s.c(g.k), halo: true }));
      });
    });
  },
};

/** Three runs of the worked problem, as the log prints them, and the rank each gets. */
const RUNS3: { name: string; vals: string[]; tag: string; beat: string }[] = [
  { name: 'A', vals: ['2.30', '1.39', '1.06', '0.83', '0.67'], tag: 'fast, keeps going: in between', beat: 'middle' },
  { name: 'B', vals: ['2.30', '4.88', '11.21', '27.93', 'nan'], tag: 'blows up: highest rate', beat: 'highest' },
  { name: 'C', vals: ['2.30', '2.28', '2.26', '2.23', '2.21'], tag: 'same tiny drop: lowest rate', beat: 'lowest' },
];

/** The answer's beats in order: each row stays lit until the next one is read. */
const NEXT: Record<string, string | undefined> = { lowest: 'middle', middle: 'highest' };

const tryIt: SceneDef = {
  draw(s) {
    const u = s.u;
    s.text('same model, only the learning rate differs', s.w / 2, s.h * 0.06, { size: 3.3, font: 'mono', color: s.c('--ink-2') });
    const xs = columns(s, 5, s.tall ? 14 : 15).map((x) => x + 6 * u);
    RUNS3.forEach((r, i) => {
      const y = s.h * (0.19 + i * 0.2);
      const hot = s.ease(r.beat, 0.6);
      s.text(`Run ${r.name}`, xs[0]! - 9 * u, y, { size: 3.6, font: 'mono', weight: 650, align: 'right', color: s.c(hot > 0.5 ? 'gold' : '--ink') });
      const next = NEXT[r.beat];
      const on = hot * (next ? 1 - 0.65 * s.ease(next, 0.6) : 1);
      cells(s, xs, y, r.vals, 'blue', { w: s.tall ? 12.5 : 13, h: 8, size: 3, on: r.vals.map(() => on) });
      s.alpha(after(s, r.beat, 0.3), () => s.text(r.tag, s.w / 2 + 6 * u, y + 8 * u, { size: 3.2, font: 'mono', weight: 600, color: s.c('gold'), halo: true }));
    });
    s.alpha(after(s, 'highest', 0.6), () => s.text('lowest to highest: C, A, B', s.w / 2, s.h * 0.86, { size: 4, font: 'mono', weight: 650, color: s.c('gold'), halo: true }));
  },
};

export const scenes: Record<string, SceneDef> = { rates, more, read, try: tryIt };
