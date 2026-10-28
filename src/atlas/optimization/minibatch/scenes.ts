import type { Scene, SceneDef } from '../../../lecture/scene';
import type { Color } from '../../../core/symbols';
import { Rng } from '../../../core/rand';
import { cells, columns } from '../../draw';
import { after, caption, Frame } from '../../networks/draw';

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

/** Samples scaled to mean 0 and spread exactly 1, so each row's scatter is what it claims. */
function standard(rng: Rng, n: number): number[] {
  const z = Array.from({ length: n }, () => rng.randn());
  const m = z.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(z.reduce((a, b) => a + (b - m) ** 2, 0) / n);
  return z.map((v) => (v - m) / sd);
}

// ---- the dataset: one photo per tile, one gradient arrow per photo

const DOTS = 60;
const rng = new Rng(7);
const GRADS = Array.from({ length: DOTS }, () => {
  const a = -0.45 + rng.randn() * 0.9;
  const r = 0.55 + rng.next() * 0.6;
  return [Math.cos(a) * r, Math.sin(a) * r] as const;
});
/** Each photo's four pixels, as a hue and a lightness. */
const PIX = Array.from({ length: DOTS }, () => Array.from({ length: 4 }, () => [rng.int(360), 45 + rng.int(30)] as const));
const mean = (idx: number[]) => [0, 1].map((k) => idx.reduce((a, i) => a + GRADS[i]![k]!, 0) / idx.length);
const ALL = mean(GRADS.map((_, i) => i));
/** A random batch of eight whose average lands near the true one, as most do. */
const BATCH = Array.from({ length: 12 }, () => rng.shuffle(GRADS.map((_, i) => i)).slice(0, 8))
  .map((b) => ({ b, d: Math.hypot(mean(b)[0]! - ALL[0]!, mean(b)[1]! - ALL[1]!) }))
  .sort((p, q) => p.d - q.d)[2]!.b;
const EST = mean(BATCH);

/** The dataset grid's cell centers. */
function grid(s: Scene) {
  const cols = s.tall ? 10 : 12;
  const step = Math.min((s.w - 16 * s.u) / cols, (s.h * 0.48) / (DOTS / cols));
  const x0 = s.w / 2 - ((cols - 1) / 2) * step;
  const y0 = s.h * 0.15;
  return { cols, step, at: (i: number) => [x0 + (i % cols) * step, y0 + Math.floor(i / cols) * step] as const };
}

/** A tiny photo: two by two pixels of color. */
function photo(s: Scene, x: number, y: number, size: number, i: number) {
  const p = size / 2;
  PIX[i]!.forEach(([hue, l], k) => {
    s.ctx.fillStyle = `hsl(${hue} 35% ${l}%)`;
    s.ctx.fillRect(x - p + (k % 2) * p, y - p + Math.floor(k / 2) * p, p, p);
  });
}

/** An arrow of gradient `g`, scaled by `len` px per unit, centered on (x, y). */
function gradArrow(s: Scene, x: number, y: number, g: readonly number[], len: number, col: string, w = 0.35, head = 1.4): void {
  const dx = g[0]! * len;
  const dy = -g[1]! * len;
  s.arrow(x - dx / 2, y - dy / 2, x + dx / 2, y + dy / 2, col, w, head);
}

const full: SceneDef = {
  draw(s) {
    const G = grid(s);
    const per = s.ease('per', 0.8);
    const pick = s.ease('poll', 0.8, 1.2);
    for (let i = 0; i < DOTS; i++) {
      const [x, y] = G.at(i);
      const inB = BATCH.includes(i);
      const a = s.ease('data', 0.4, (i / DOTS) * 1.5) * (inB ? 1 : 1 - 0.7 * pick);
      s.alpha(a, () => {
        s.alpha(1 - 0.75 * per, () => photo(s, x, y, G.step * 0.78, i));
        s.alpha(per, () => gradArrow(s, x, y, GRADS[i]!, G.step * 0.55, s.c(inB && pick > 0 ? 'gold' : 'red')));
      });
      if (inB) s.alpha(pick, () => s.rrect(x - G.step * 0.46, y - G.step * 0.46, G.step * 0.92, G.step * 0.92, 0.8, { stroke: s.c('gold'), lw: 0.35 }));
    }
    const ty = s.h * 0.06;
    const head = (t: string, a: number, k: Color | '--ink-2' = '--ink-2') => s.alpha(a, () => s.text(t, s.w / 2, ty, { size: 3.4, font: 'mono', weight: 600, color: s.c(k) }));
    head('N = 50,000 photos (60 shown)', s.win('data', 'example'));
    head('each photo: one example', s.win('example', 'per'));
    head('one gradient per example', s.win('per', 'poll'));
    head('8 picked at random', s.ease('poll', 0.6, 1.2), 'gold');

    const oy = s.h * 0.74;
    const L = 26 * s.u;
    const dx = (s.tall ? 22 : 26) * s.u;
    s.alpha(s.win('example', 'true'), () => caption(s, 'f(w) = the average of N terms', oy, 'purple'));
    const big = (g: number[], ox: number, k: 'red' | 'gold', label: string, sub: string) => {
      s.arrow(ox - (g[0]! * L) / 2, oy + (g[1]! * L) / 2, ox + (g[0]! * L) / 2, oy - (g[1]! * L) / 2, s.c(k), 0.8, 2.6);
      s.text(label, ox, oy + 10 * s.u, { size: 3.2, font: 'mono', weight: 600, color: s.c(k) });
      s.text(sub, ox, oy + 14.5 * s.u, { size: 3, font: 'mono', color: s.c('--ink-2') });
    };
    s.alpha(s.ease('true', 0.6, 1.5), () => big(ALL, s.w / 2 - dx, 'red', 'true gradient', 'all N averaged'));
    s.alpha(s.win('descent', 'poll'), () => {
      s.text('50,000 gradients', s.w / 2 + dx, oy - 2 * s.u, { size: 3.4, font: 'mono', weight: 600, color: s.c('--ink-2') });
      s.text('per exact step', s.w / 2 + dx, oy + 3 * s.u, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
    });
    s.alpha(after(s, 'poll', 0.62), () => big(EST, s.w / 2 + dx, 'gold', '8 averaged', 'close'));
    s.alpha(s.ease('B', 0.6, 1.2), () => s.text('B = 8: a minibatch', s.w / 2 + dx, oy + 19 * s.u, { size: 3.2, font: 'mono', weight: 600, color: s.c('slate') }));
  },
};

// ---- one entry's estimates, batch after batch, for three batch sizes

const TRUE = 0.8;
const nrng = new Rng(11);
const ROWS: { B: number; sd: number; vals: number[] }[] = [
  { B: 4, sd: 0.8, vals: [1, 0.2, 1.9, ...standard(nrng, 11).map((z) => TRUE + 0.8 * z)] },
  { B: 16, sd: 0.4, vals: standard(nrng, 14).map((z) => TRUE + 0.4 * z) },
  { B: 64, sd: 0.2, vals: standard(nrng, 14).map((z) => TRUE + 0.2 * z) },
];
const RANGE: [number, number] = [-1.4, 3];
const clampV = (v: number) => Math.max(RANGE[0] + 0.05, Math.min(RANGE[1] - 0.05, v));

const average: SceneDef = {
  draw(s) {
    const xs = columns(s, 4, s.tall ? 18 : 16);
    const vals = [2, -1, 3, 0];
    const lit = s.win('mean', 'noise');
    s.text('one entry\'s gradients, B = 4', s.w / 2, s.h * 0.07, { size: 3.2, color: s.c('--ink-3') });
    cells(s, xs, s.h * 0.16, vals.map((v) => String(v).replace('-', '−')), 'red', { w: 12, h: 8, on: vals.map(() => lit) });
    const y2 = s.h * 0.27;
    s.alpha(s.ease('mean', 0.6, 0.6), () => {
      s.text('(2 − 1 + 3 + 0) / 4 =', s.w / 2 + 2 * s.u, y2, { size: 3.6, font: 'mono', align: 'right', color: s.c('--ink-2') });
      cells(s, [s.w / 2 + 10 * s.u], y2, ['1'], 'red', { w: 12, h: 8, on: [1] });
    });
    s.alpha(s.win('used', 'noise'), () => caption(s, '/ B = 4, the examples used, not / N', s.h * 0.355, 'slate', 3.3));

    const l = s.w * 0.2;
    const r = s.w * 0.94;
    const X = (v: number) => l + ((v - RANGE[0]) / (RANGE[1] - RANGE[0])) * (r - l);
    const ys = [0.5, 0.61, 0.72].map((f) => s.h * f);
    const ax = s.h * 0.81;
    const scale = s.ease('mean', 0.6, 1.4);
    s.alpha(scale, () => {
      s.line(l, ax, r, ax, s.c('--axis'), 0.35);
      [-1, 0, 1, 2, 3].forEach((v) => s.text(String(v).replace('-', '−'), X(v), ax + 3.6 * s.u, { size: 2.8, font: 'mono', color: s.c('--ink-3') }));
    });
    s.alpha(s.ease('noise', 0.6, 2.5), () => {
      s.line(X(TRUE), ys[0]! - 5 * s.u, X(TRUE), ax, s.tint('green', 0.8), 0.4, [1, 0.8]);
      s.text('true 0.8', X(TRUE), ys[0]! - 7.5 * s.u, { size: 3, font: 'mono', weight: 600, color: s.c('green'), halo: true });
    });
    const band = s.ease('sqrt', 0.8, 1);
    const ks: Color[] = ['red', 'purple', 'blue'];
    ROWS.forEach((row, ri) => {
      const y = ys[ri]!;
      const rowOn = ri === 0 ? scale : s.ease('more', 0.6, 0.4 + ri * 0.8);
      s.alpha(rowOn, () => s.text(`B = ${row.B}`, l - 2 * s.u, y, { size: 3, font: 'mono', align: 'right', color: s.c('--ink-2') }));
      s.alpha(band * rowOn, () => {
        const x0 = X(TRUE - 2 * row.sd);
        const x1 = X(TRUE + 2 * row.sd);
        s.rrect(x0, y - 2.6 * s.u, x1 - x0, 5.2 * s.u, 1, { fill: s.tint(ks[ri]!, 0.12), stroke: s.tint(ks[ri]!, 0.45), lw: 0.25 });
      });
      s.alpha(s.ease('cost', 0.6, 0.8 + ri * 0.4), () => {
        const bw = (row.B / 64) * 12 * s.u;
        s.rrect(l - 2 * s.u - bw, y + 2.4 * s.u, Math.max(bw, 0.5 * s.u), 1.4 * s.u, 0.4, { fill: s.tint('slate', 0.7) });
      });
      row.vals.forEach((v, i) => {
        let a: number;
        if (ri > 0) a = s.ease('more', 0.3, 0.6 + ri * 0.8 + i * 0.12);
        else if (i === 0) a = s.ease('mean', 0.4, 1.6);
        else if (i === 1) a = after(s, 'noise', 0.22, 0.3);
        else if (i === 2) a = after(s, 'noise', 0.38, 0.3);
        else a = after(s, 'noise', 0.5 + (i - 3) * 0.04, 0.3);
        const lift = ((i % 3) - 1) * 1.3 * s.u;
        s.alpha(a, () => s.circle(X(clampV(v)), y + lift, 1.05 * s.u, { fill: s.tint(ks[ri]!, i === 0 && ri === 0 ? 1 : 0.65) }));
      });
    });
    const cy = s.h * 0.93;
    s.alpha(s.win('sqrt', 'cost'), () => caption(s, '4 × the batch: ½ the scatter', cy, 'blue', 3.4, { weight: 600 }));
    s.alpha(s.win('cost', 'trade'), () => caption(s, 'work per step: like B (gray bars)', cy, 'slate', 3.4, { weight: 600 }));
    s.alpha(s.ease('trade', 0.6), () => caption(s, 'small B: cheap, noisy · big B: costly, steady', cy, '--ink-2', 3.1));
  },
};

// ---- the bowl f(u, v) = u² + 2v², with exact steps and minibatch steps

const START: [number, number] = [-2.5, 1.3];
const ETA = 0.12;
const EXACT: [number, number][] = [START];
for (let k = 0; k < 14; k++) {
  const [u, v] = EXACT[EXACT.length - 1]!;
  EXACT.push([u - ETA * 2 * u, v - ETA * 4 * v]);
}
const prng = new Rng(6);
const NOISY: [number, number][] = [START];
for (let k = 0; k < 24; k++) {
  const [u, v] = NOISY[NOISY.length - 1]!;
  const eta = 0.15 / (1 + k / 20);
  const gu = 2 * u + prng.randn() * 2;
  const gv = 4 * v + prng.randn() * 2;
  NOISY.push([Math.max(-2.9, Math.min(2.9, u - eta * gu)), Math.max(-1.9, Math.min(1.9, v - eta * gv))]);
}

/** The bowl's window, kept at its true aspect inside the stage. */
function bowl(s: Scene): Frame {
  const t = s.h * 0.12;
  const b = s.h * 0.84;
  const k = Math.min((s.w - 10 * s.u) / 6, (b - t) / 4);
  return new Frame(s, s.w / 2 - 3 * k, (t + b) / 2 - 2 * k, s.w / 2 + 3 * k, (t + b) / 2 + 2 * k, [-3, 3], [-2, 2]);
}

/** A polyline through the first `n` (fractional) points of `pts`, with a dot at each step. */
function trail(s: Scene, F: Frame, pts: [number, number][], n: number, k: Color, width: number) {
  const whole = Math.floor(n);
  for (let i = 0; i < Math.min(whole, pts.length - 1); i++) F.seg(pts[i]![0], pts[i]![1], pts[i + 1]![0], pts[i + 1]![1], k, width);
  if (whole < pts.length - 1 && n > whole) {
    const [a, b] = [pts[whole]!, pts[whole + 1]!];
    const f = n - whole;
    F.seg(a[0], a[1], a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, k, width);
  }
  for (let i = 0; i <= Math.min(whole, pts.length - 1); i++) F.dot(pts[i]![0], pts[i]![1], k, 0.8);
}

const path: SceneDef = {
  draw(s) {
    const F = bowl(s);
    F.clip(() => {
      for (const c of [0.5, 2, 4.5, 8, 12.5]) {
        const ring: [number, number][] = Array.from({ length: 97 }, (_, i) => {
          const a = (i / 96) * 2 * Math.PI;
          return [Math.sqrt(c) * Math.cos(a), Math.sqrt(c / 2) * Math.sin(a)];
        });
        for (let i = 0; i < 96; i++) F.seg(ring[i]![0], ring[i]![1], ring[i + 1]![0], ring[i + 1]![1], '--axis', 0.3);
      }
    });
    F.dot(0, 0, 'green', 1);
    const ex = s.ease('path', 0.3) * (EXACT.length - 1) * Math.min(1, s.prog('path') * 2.2);
    s.alpha(1 - 0.5 * s.ease('cancel', 0.8), () => trail(s, F, EXACT, ex, 'red', 0.45));
    const nz = (NOISY.length - 1) * Math.min(1, Math.max(0, s.prog('path') * 2 - 1) * 0.45 + s.prog('cancel') * 0.75);
    trail(s, F, NOISY, nz, 'gold', 0.45);
    const lx = F.l + 2 * s.u;
    const ly = F.t + 3 * s.u;
    const leg = (t: string, y: number, k: Color, a: number) =>
      s.alpha(a, () => {
        s.line(lx, y, lx + 5 * s.u, y, s.c(k), 0.6);
        s.text(t, lx + 7 * s.u, y, { size: 3.1, font: 'mono', align: 'left', color: s.c(k), halo: true });
      });
    leg('exact: all N', ly, 'red', s.ease('path', 0.6));
    leg('minibatch: B', ly + 5 * s.u, 'gold', after(s, 'path', 0.45));
    cite(s, 'Robbins & Monro, 1951', s.ease('robbins', 0.6, 1.5));
    const cy = s.h * 0.93;
    s.alpha(s.win('path', 'cancel'), () => caption(s, 'the bowl f(u, v) = u² + 2v²', cy, '--ink-2', 3.3));
    s.alpha(s.win('cancel', 'robbins'), () => caption(s, 'each estimate: the true way, on average', cy, 'gold', 3.3));
    s.alpha(s.win('robbins', 'name'), () => caption(s, 'noisy measurements, shrinking steps', cy, '--ink-2', 3.3));
    s.alpha(s.win('name', 'sgd'), () => caption(s, 'stochastic: random (Greek: aim, guess)', cy, '--ink-2', 3.3));
    s.alpha(s.ease('sgd', 0.6), () => caption(s, 'SGD: stochastic gradient descent', cy, 'gold', 3.4, { weight: 600 }));
  },
};

// ---- one epoch: N examples cut into batches of B

const STRIPES = new Rng(3).shuffle(Array.from({ length: DOTS }, (_, i) => i));

const epoch: SceneDef = {
  draw(s) {
    const l = s.w * 0.1;
    const r = s.w * 0.9;
    const y = s.h * 0.3;
    const h = 10 * s.u;
    const seg = (r - l) / 12;
    s.text('N = 1,200 examples, shuffled', s.w / 2, y - h / 2 - 12 * s.u, { size: 3.6, font: 'mono', weight: 600, color: s.c('orange') });
    const cut = s.ease('shuffle', 0.6, 1.2);
    const seen = s.ease('seen', 0.4);
    // The examples in shuffled order, as thin stripes of their photos' colors.
    s.alpha(0.55, () => {
      const sw = (r - l) / STRIPES.length;
      STRIPES.forEach((i, j) => {
        const [hue, lt] = PIX[i]![j % 4]!;
        s.ctx.fillStyle = `hsl(${hue} 35% ${lt}%)`;
        s.ctx.fillRect(l + j * sw, y - h / 2, sw * 0.8, h);
      });
    });
    for (let i = 0; i < 12; i++) {
      const on = Math.min(1, Math.max(0, (s.since('count') - 0.6 - i * 0.3) / 0.3)) * (1 - seen);
      const seenOn = i < 5 ? s.ease('seen', 0.4, 0.8 + i * 0.3) * (1 - s.ease('back', 0.5)) : 0;
      s.rrect(l + i * seg, y - h / 2, seg, h, 0.6, { fill: s.tint('orange', 0.12 + 0.3 * Math.max(on, seenOn)), stroke: s.tint('orange', 0.3 + 0.6 * cut), lw: 0.3 });
      s.alpha(s.ease('count', 0.6), () => s.text(String(i + 1), l + (i + 0.5) * seg, y + h / 2 + 3.4 * s.u, { size: 2.8, font: 'mono', color: s.c('--ink-3') }));
    }
    s.alpha(cut, () => {
      s.line(l, y - h / 2 - 2 * s.u, l + seg, y - h / 2 - 2 * s.u, s.c('slate'), 0.4);
      s.text('B = 100', l, y - h / 2 - 5 * s.u, { size: 3, font: 'mono', align: 'left', color: s.c('slate') });
    });
    s.alpha(s.ease('epoch', 0.6, 0.6), () => {
      s.line(l, y + h / 2 + 7.5 * s.u, r, y + h / 2 + 7.5 * s.u, s.c('slate'), 0.4);
      s.text('one epoch: one full pass', s.w / 2, y + h / 2 + 11 * s.u, { size: 3.2, color: s.c('slate') });
    });
    const line = (t: string, f: number, k: 'orange' | '--ink-2') => s.text(t, s.w / 2, s.h * f, { size: 3.5, font: 'mono', weight: 600, color: s.c(k) });
    s.alpha(after(s, 'count', 0.55), () => line('N / B = 1,200 / 100 = 12 steps', 0.56, '--ink-2'));
    s.alpha(s.ease('epochs', 0.6, 1), () => line('3 epochs: 3 × 12 = 36 steps', 0.645, '--ink-2'));
    s.alpha(after(s, 'seen', 0.55), () => line('k = 5 steps: 5 × 100 = 500 seen', 0.73, 'orange'));
    s.alpha(after(s, 'back', 0.5), () => line('k = 36: 36 × 100 = 3,600 seen', 0.815, 'orange'));
    s.alpha(after(s, 'div', 0.4), () => line('3,600 / 1,200 = 3 epochs', 0.9, 'orange'));
  },
};

export const scenes: Record<string, SceneDef> = { full, average, path, epoch };
