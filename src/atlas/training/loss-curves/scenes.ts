import { clamp01, type Ink, type Scene, type SceneDef } from '../../../lecture/scene';
import { after, cite } from '../../draw';
import { caption } from '../../networks/draw';
import { axes, ball, clipped, curve, frame, type Frame, hop } from '../../optimization/draw';
import { fmt, key, series, xTicks, yTicks } from '../draw';
import type { Color } from '../../../core/symbols';
import { Rng } from '../../../core/rand';

const mono = (s: Scene, t: string, x: number, y: number, k: Ink, align: CanvasTextAlign = 'center', size = 3.2, weight = 600) =>
  s.text(t, x, y, { size, font: 'mono', weight, align, color: s.c(k), halo: true });

/** A ball walking through `pts` on a bowl, leaving its chords and landing dots behind. */
function walk(s: Scene, F: Frame, pts: [number, number][], t: number, every: number, k: Color): number {
  const h = hop(pts, t, every);
  clipped(s, F, () => {
    for (let i = 0; i < h.done; i++) s.line(F.X(pts[i]![0]), F.Y(pts[i]![1]), F.X(pts[i + 1]![0]), F.Y(pts[i + 1]![1]), s.tint('slate', 0.6), 0.35);
    if (h.done < pts.length - 1) s.line(F.X(pts[h.done]![0]), F.Y(pts[h.done]![1]), F.X(h.x), F.Y(h.y), s.tint('slate', 0.6), 0.35);
    for (let i = 0; i <= h.done; i++) s.circle(F.X(pts[i]![0]), F.Y(pts[i]![1]), 0.7 * s.u, { fill: s.tint(k, 0.4) });
    ball(s, F.X(h.x), F.Y(h.y), k, 1.7);
  });
  return h.done;
}

// ---- watch: the ball's height is all training shows, printed as it goes

/** The bowl L = 2.3 x², read every hundred steps: each reading 0.6 of the last. */
const READ = [2.3, 1.38, 0.83, 0.5, 0.3, 0.18];
const height = (r: number) => 2.3 * 0.6 ** r;

const watch: SceneDef = {
  draw(s) {
    const u = s.u;
    const mid = s.h * 0.47;
    const B = frame(9 * u, s.h * 0.07, s.w * 0.5 - 3 * u, mid, [-1.15, 1.15], [0, 2.8]);
    // The walk, in readings: once through on `walk`, again on `blind` as each reading prints.
    const glide = (id: string, lead: number) => 5 * clamp01((s.since(id) - lead) / Math.max(1, s.end(id) - s.at(id) - lead - 0.8));
    const r = s.since('blind') >= 0 ? glide('blind', 0.8) : glide('walk', 0.6);
    const veil = s.ease('blind', 0.8);
    s.alpha(1 - 0.8 * veil, () => {
      curve(s, B, (x) => 2.3 * x * x, -1.15, 1.15, '--ink-3', { width: 0.6 });
      s.line(B.l, B.b, B.r, B.b, s.c('--axis'), 0.3);
    });
    s.alpha(veil, () => mono(s, 'no bowl to see', (B.l + B.r) / 2, B.Y(1.9), '--ink-3', 'center', 3.2, 500));
    s.line(B.l, B.b, B.l, B.t, s.c('--axis'), 0.35);
    mono(s, 'L', B.l - 2.5 * u, B.t + 2 * u, 'red', 'right', 3.6, 650);
    const x = 0.6 ** (r / 2);
    const y = height(r);
    s.alpha(veil, () => {
      s.line(B.l, B.Y(y), B.X(x), B.Y(y), s.tint('red', 0.6), 0.3, [1, 0.8]);
      s.circle(B.l, B.Y(y), 1 * u, { fill: s.c('red') });
    });
    ball(s, B.X(x), B.Y(y), 'green', 1.8);

    // The printout, one line per reading as the ball passes it.
    const lx = s.w * 0.5 + 4 * u;
    const lw = s.w * 0.5 - 10 * u;
    const top = s.h * 0.07;
    const hot = s.win('log', 'curve');
    s.alpha(s.ease('walk', 0.6) * (1 - s.ease('blind', 0.5)), () => mono(s, `step ${Math.round(r * 100)}`, lx + lw / 2, (top + mid) / 2, '--ink-2', 'center', 4.2, 600));
    s.alpha(s.ease('blind', 0.6, 0.4), () => {
      s.rrect(lx, top, lw, mid - top, 1.6, { fill: s.tint('slate', 0.06 + 0.06 * hot), stroke: s.tint(hot > 0.5 ? 'gold' : 'slate', 0.5 + 0.5 * hot), lw: 0.3 + 0.2 * hot });
      const shown = s.since('blind') >= 0 ? Math.floor(r + 1e-6) : -1;
      const gap = (mid - top - 6 * u) / 5;
      READ.forEach((v, i) => {
        if (i > shown) return;
        const yy = top + 3 * u + i * gap;
        s.text(String(i * 100), lx + lw * 0.42, yy, { size: 3.2, font: 'mono', align: 'right', color: s.c('--ink-3') });
        s.text(fmt(v, 2), lx + lw * 0.58, yy, { size: 3.2, font: 'mono', weight: 600, align: 'left', color: s.c('red') });
      });
    });
    const cy = (mid + s.h * 0.58) / 2 + u;
    s.alpha(s.win('blind', 'log'), () => caption(s, 'all you see: the loss, every 100 steps', cy, '--ink-2', 3.2));
    s.alpha(hot, () => caption(s, 'the training log: a record kept as it goes', cy, 'gold', 3.2));
    // The readings, plotted.
    const P = frame(14 * u, s.h * 0.6, s.w - 7 * u, s.h * 0.88, [0, 500], [0, 3]);
    axes(s, P, 'step', 'L', { x: '--ink-3', y: 'red' });
    xTicks(s, P, [100, 200, 300, 400]);
    s.alpha(s.ease('curve', 0.6), () => {
      series(s, P, READ.map((v, i) => [i * 100, v]), 'red', { upto: s.ease('curve', 2.2, 0.4), width: 0.6, dots: 1 });
    });
    s.alpha(s.ease('curve', 0.6, 2.8), () => caption(s, 'a loss curve: its shape says what is wrong', cy, 'red', 3.2));
  },
};

// ---- rates: two bowls, one gentle and one steep, walked at four learning rates

const A = [0.25, 1];
const X0 = [2, 0.8];
const N = 12;
const RATES: { beat: string; until: string; lr: number; k: Color; name: string }[] = [
  { beat: 'low', until: 'good', lr: 0.03, k: 'blue', name: 'too low' },
  { beat: 'good', until: 'high', lr: 0.4, k: 'green', name: 'good' },
  { beat: 'high', until: 'huge', lr: 1, k: 'gold', name: 'too high' },
  { beat: 'huge', until: 'order', lr: 1.3, k: 'red', name: 'far too high' },
];
/** Each bowl's walk at each rate: every step multiplies w by 1 − 2aη. */
const WALKS = RATES.map((r) => A.map((a, j) => Array.from({ length: N + 1 }, (_, t) => {
  const w = X0[j]! * (1 - 2 * a * r.lr) ** t;
  return [w, a * w * w] as [number, number];
})));
const LOSS = WALKS.map((ws) => ws[0]!.map(([, h], t) => [t, h + ws[1]![t]![1]] as [number, number]));
/** Where each run's name sits on the plot: a step, a loss, and which side. */
const TAG: [number, number, CanvasTextAlign][] = [[9.5, 1.2, 'left'], [3.4, 0.38, 'left'], [8.2, 0.48, 'left'], [1.7, 1.98, 'left']];

const rates: SceneDef = {
  draw(s) {
    const u = s.u;
    const G = frame(6 * u, s.h * 0.13, s.w / 2 - 3 * u, s.h * 0.41, [-2.2, 2.2], [0, 1.6]);
    const S = frame(s.w / 2 + 3 * u, s.h * 0.13, s.w - 6 * u, s.h * 0.41, [-2.2, 2.2], [0, 1.6]);
    const P = frame(14 * u, s.h * 0.55, s.w - 6 * u, s.h * 0.88, [0, N], [0, 2.1]);
    const bowls = s.ease('two', 0.8);
    s.alpha(bowls, () => {
      for (const [F, a, name] of [[G, A[0]!, 'gentle: 0.25 w[0]²'], [S, A[1]!, 'steep: w[1]²']] as const) {
        s.line(F.l, F.b, F.r, F.b, s.c('--axis'), 0.3);
        curve(s, F, (x) => a * x * x, -2.2, 2.2, '--ink-3', { width: 0.6, upto: s.ease('two', 1.2) });
        mono(s, name, (F.l + F.r) / 2, F.t - 2.5 * u, '--ink-2', 'center', 3.1, 550);
      }
    });
    const cur = RATES.reduce((k, r, i) => (s.since(r.beat) >= 0 ? i : k), -1);
    // Before the first rate, both balls wait at their starts, their heights marked.
    s.alpha(s.ease('two', 0.6, 0.8) * (1 - s.ease('low', 0.4)), () => {
      [G, S].forEach((F, j) => {
        const [x, y] = WALKS[0]![j]![0]!;
        ball(s, F.X(x), F.Y(y), 'slate', 1.7);
        s.alpha(s.ease('sum', 0.6), () => mono(s, fmt(y, 2), F.X(x) + (j ? 3 : -3) * u, F.Y(y) - 3.5 * u, 'red', j ? 'left' : 'right', 3.1));
      });
    });
    s.alpha(s.ease('two', 0.6), () => {
      axes(s, P, 'step', '', { x: '--ink-3', y: 'red' });
      mono(s, 'L', P.l - 2 * u, P.t + 1 * u, 'red', 'right', 3.6, 650);
      xTicks(s, P, [4, 8]);
      yTicks(s, P, [1]);
    });
    s.alpha(s.ease('sum', 0.6), () => {
      s.alpha(1 - s.ease('low', 0.4), () => {
        s.circle(P.X(0), P.Y(LOSS[0]![0]![1]), 1 * u, { fill: s.c('red') });
        mono(s, '1.00 + 0.64 = 1.64', P.X(0) + 3 * u, P.Y(1.64), 'red', 'left', 3.1);
      });
    });
    RATES.forEach((r, i) => {
      if (s.since(r.beat) < 0) return;
      const win = s.at(r.until) - s.at(r.beat);
      const every = Math.min(0.7, Math.max(0.2, (win - 1) / N));
      const t = s.since(r.beat) - 0.4;
      const on = i === cur || s.since('order') >= 0;
      // The balls of the current rate only; its curve stays, dimmed once the next rate starts.
      if (i === cur && s.since('order') < 0) [G, S].forEach((F, j) => walk(s, F, WALKS[i]![j]!, t, every, r.k));
      const done = Math.min(N, t / every);
      s.alpha(on ? 1 : 0.4, () => {
        clipped(s, P, () => series(s, P, LOSS[i]!, r.k, { upto: Math.max(0, done) / N, width: on ? 0.7 : 0.5, dots: 0.7 }));
        const [tx, ty, al] = TAG[i]!;
        s.alpha(after(s, r.beat, 0.6), () => mono(s, i === 3 ? 'far too high: nan' : r.name, P.X(tx), P.Y(ty), r.k, al, 3.1));
      });
    });
    // The plateau, bracketed.
    s.alpha(s.win('plateau', 'huge'), () => {
      s.line(P.X(3), P.Y(0.64) - 2.2 * u, P.X(N), P.Y(0.64) - 2.2 * u, s.c('gold'), 0.4, [1, 0.8]);
    });
    const cy = s.h * 0.475;
    const cap = (a: number, t: string, k: Ink = '--ink-2') => s.alpha(a, () => caption(s, t, cy, k, 3.2));
    cap(s.win('sum', 'low'), 'L = gentle + steep: the two heights');
    cap(s.win('high', 'plateau'), 'steep bowl: η at the edge, it bounces', 'gold');
    cap(s.win('plateau', 'huge'), 'drops fast, then flat: a plateau', 'gold');
    cap(s.win('huge', 'order'), 'steep bowl: past the edge, it diverges', 'red');
    cap(s.win('order', 'cure'), 'lowest rate → highest: line, drop, stall, blow-up');
    cap(s.win('cure', 'bengio'), 'slow line: raise η · plateau or nan: lower η');
    cap(s.ease('bengio', 0.6), 'diverges? try η three times smaller');
    cite(s, 'Bengio, 2012', s.ease('bengio', 0.6));
    if (cur >= 0 && s.since('order') < 0) s.alpha(s.ease(RATES[cur]!.beat, 0.4), () => mono(s, `η = ${RATES[cur]!.lr}`, P.r - 1 * u, P.t + 1 * u, RATES[cur]!.k, 'right', 3.6, 650));
  },
};

// ---- more: a small batch's jitter, then training and validation parting

const rng = new Rng(5);
const KICKS = Array.from({ length: 61 }, (_, t) => (t ? rng.randn() : 0));
const trend = (t: number) => 0.35 + 1.95 * Math.exp(-t / 18);
/** The scatter shrinks like 1/√B: eight times the batch, about a third the jitter. */
const jitter = (B: number): [number, number][] => KICKS.map((z, t) => [t, Math.max(0.05, trend(t) + z * 0.22 * Math.sqrt(8 / B))]);
const NOISY = jitter(8);
const SMOOTH = jitter(64);
const T = (e: number) => 2.3 * 0.85 ** e;
const V = (e: number) => T(e) + 0.05 + 0.0022 * e * e;
const TRAIN: [number, number][] = Array.from({ length: 21 }, (_, e) => [e, T(e)]);
const VAL: [number, number][] = Array.from({ length: 21 }, (_, e) => [e, V(e)]);

const more: SceneDef = {
  draw(s) {
    const u = s.u;
    const two = s.ease('val', 0.8);
    s.alpha(1 - two, () => {
      const F = frame(12 * u, s.h * 0.14, s.w - 6 * u, s.h - 9 * u, [0, 60], [0, 2.6]);
      axes(s, F, 'step', 'L', { x: '--ink-3', y: 'red' });
      const big = s.ease('big', 0.8);
      s.alpha(1 - 0.75 * big, () => series(s, F, NOISY, 'purple', { upto: s.ease('noisy', 3, 0.3), width: 0.45 }));
      s.alpha(s.ease('noisy', 0.6, 3.5) * (1 - big), () => curve(s, F, trend, 0, 60, 'purple', { width: 0.8, dash: [1.6, 1] }));
      s.alpha(big, () => series(s, F, SMOOTH, 'teal', { upto: s.ease('big', 2, 0.2), width: 0.6 }));
      let kx = F.X(22);
      kx = key(s, kx, F.t + 1 * u, 'purple', 'B = 8');
      s.alpha(big, () => key(s, kx, F.t + 1 * u, 'teal', 'B = 64'));
      s.alpha(s.ease('noisy', 0.6, 3.5) * (1 - big), () => mono(s, 'trend: still down', F.r - 1 * u, F.t + 6 * u, 'purple', 'right', 3.2));
      s.alpha(after(s, 'big', 0.3), () => mono(s, 'bigger batch: smoother', F.r - 1 * u, F.t + 6 * u, 'teal', 'right', 3.2));
    });
    s.alpha(two, () => {
      const F = frame(12 * u, s.h * 0.14, s.w - 6 * u, s.h - 9 * u, [0, 20], [0, 2.5]);
      axes(s, F, 'epoch', 'L', { x: '--ink-3', y: 'red' });
      xTicks(s, F, [4, 8, 12, 16]);
      let kx = F.X(6);
      kx = key(s, kx, F.t + 1 * u, 'blue', 'train');
      key(s, kx, F.t + 1 * u, 'gold', 'val');
      const up = clamp01((s.since('val') - 0.6) / 4);
      series(s, F, TRAIN, 'blue', { upto: up });
      series(s, F, VAL, 'gold', { upto: up });
      const late = after(s, 'val', 0.75);
      s.alpha(late, () => {
        for (const e of [4, 18]) s.line(F.X(e), F.Y(T(e)) - 1 * u, F.X(e), F.Y(V(e)) + 1 * u, s.c('red'), 0.4);
        mono(s, 'the gap widens', F.X(18) - 1.5 * u, F.Y((T(18) + V(18)) / 2), 'red', 'right', 3.1);
        s.line(F.X(12), F.Y(V(12)), F.X(12), F.b, s.tint('gold', 0.7), 0.3, [1.2, 1]);
        s.circle(F.X(12), F.Y(V(12)), 1.3 * u, { fill: s.c('gold') });
        mono(s, 'val bottoms out: epoch 12', F.X(12), F.Y(V(12)) - 8 * u, 'gold', 'center', 3.2);
      });
    });
  },
};

// ---- read: logs as bare numbers, one plot per list

/** Logged losses; null is the reading that printed nan. */
const LOGS: { beat: string; until?: string; vals: (number | null)[]; top: number; ticks: number[]; k: Color; verdict: string; at: string; head: string }[] = [
  { beat: 'list', until: 'plateau', vals: [2.3, 2.28, 2.26, 2.24, 2.21], top: 2.6, ticks: [1, 2], k: 'blue', verdict: 'the same small drop: rate too low', at: 'slow', head: 'training loss, every 100 steps' },
  { beat: 'plateau', until: 'explode', vals: [2.3, 1.38, 1.21, 1.19, 1.22], top: 2.6, ticks: [1, 2], k: 'gold', verdict: 'fast drop, then flat: rate too high', at: 'plateau', head: 'training loss, every 100 steps' },
  { beat: 'explode', until: 'noisy', vals: [2.3, 4.88, 11.21, 27.93, null], top: 32, ticks: [10, 20, 30], k: 'red', verdict: 'grows every reading: far too high', at: 'explode', head: 'training loss, every 100 steps' },
  { beat: 'noisy', until: 'val', vals: [2.3, 2.33, 1.71, 1.95, 1.32], top: 2.6, ticks: [1, 2], k: 'purple', verdict: 'up and down, trending down: small batch', at: 'noisy', head: 'training loss, every 100 steps' },
  { beat: 'val', vals: [2.16, 1.58, 1.27, 1.19, 1.24], top: 2.6, ticks: [1, 2], k: 'gold', verdict: 'lowest: the 4th reading', at: 'val', head: 'validation loss, every 2 epochs' },
];
const BEST = 3;

const read: SceneDef = {
  draw(s) {
    const u = s.u;
    LOGS.forEach((g, n) => {
      const a = s.ease(g.beat, 0.5) * (g.until ? 1 - s.ease(g.until, 0.4) : 1);
      if (a <= 0.003) return;
      s.alpha(a, () => {
        s.text(g.head, s.w / 2, s.h * 0.06, { size: 3.3, font: 'mono', color: s.c('--ink-2') });
        const m = g.vals.length;
        const F = frame(14 * u, s.h * 0.15, s.w - 6 * u, s.h * 0.68, [-0.5, m - 0.5], [0, g.top]);
        axes(s, F, '', 'L', { x: '--ink-3', y: 'red' });
        yTicks(s, F, g.ticks, (v) => String(v));
        const reveal = n === 0 ? clamp01((s.prog('list') - 0.25) / 0.6) : s.ease(g.beat, 1.6, 0.3);
        const pts = g.vals.flatMap((v, i) => (v === null ? [] : [[i, v] as [number, number]]));
        const shown = Math.floor(reveal * (m - 1) + 1e-6);
        series(s, F, pts, g.k, { upto: Math.min(1, (reveal * (m - 1)) / Math.max(1, pts.length - 1)), width: 0.5, dots: 1.1 });
        g.vals.forEach((v, i) => {
          if (i > shown) return;
          const best = g.beat === 'val' && i === BEST;
          s.text(v === null ? 'nan' : fmt(v, 2), F.X(i), F.b + 4 * u, { size: 3, font: 'mono', weight: v === null || best ? 700 : 500, color: s.c(v === null ? 'red' : best ? 'gold' : '--ink-2') });
          if (v === null) mono(s, 'nan', F.X(i), F.t + 3 * u, 'red', 'center', 3.4, 700);
        });
        if (g.beat === 'val') {
          // Which epoch each reading was taken at, and the lowest one.
          s.alpha(after(s, 'epoch', 0.05), () => {
            g.vals.forEach((_, i) => s.text(`epoch ${2 * (i + 1)}`, F.X(i), F.b + 8.5 * u, { size: 2.8, font: 'mono', weight: i === BEST ? 700 : 500, color: s.c(i === BEST ? 'gold' : '--ink-3') }));
          });
          s.alpha(after(s, 'val', 0.55), () => s.circle(F.X(BEST), F.Y(g.vals[BEST]!), 2.2 * u, { stroke: s.c('gold'), lw: 0.45 }));
        }
        const verdict = g.beat === 'val' ? (s.since('epoch') >= 0 ? 'reading 4, two epochs apart: epoch 8' : g.verdict) : g.verdict;
        s.alpha(after(s, g.at, n === 0 ? 0.2 : 0.55), () => mono(s, verdict, s.w / 2, s.h * 0.88, g.k, 'center', 3.4));
      });
    });
  },
};

export const scenes: Record<string, SceneDef> = { watch, rates, more, read };
