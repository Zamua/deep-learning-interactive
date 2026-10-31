import type { Ink, Scene, SceneDef } from '../../../lecture/scene';
import { after, cells, cite } from '../../draw';
import { caption, rich } from '../../networks/draw';
import { gpu, mono } from '../draw';

const W = [
  [1, 0, 2, -1],
  [3, 1, 0, 2],
  [0, -2, 1, 1],
];
const X = [2, 1, 3, 1];
const Z = W.map((r) => r.reduce((a, w, j) => a + w * X[j]!, 0));
const DZ = [2, -1, 1];
const f = (v: number) => String(v).replace('-', '−');

/** Mono text shrunk, if need be, to fit `maxW` pixels. */
function fit(s: Scene, text: string, x: number, y: number, maxW: number, o: { size: number; k?: Ink; weight?: number; align?: CanvasTextAlign }): void {
  const w = s.measure(text, { size: o.size, font: 'mono', weight: o.weight });
  mono(s, text, x, y, { ...o, size: w > maxW ? (o.size * maxW) / w : o.size });
}

// ---- a time ruler, hour to year, on a log scale

const SPANS: [string, number][] = [['hour', 1], ['day', 24], ['week', 168], ['month', 720], ['year', 8760]];
const LO = -0.45;
const HI = 4.35;

/** x of `hours` on a ruler centered on cx, `half` pixels each side. */
const rulerX = (cx: number, half: number, hours: number) => cx - half + ((Math.log10(hours) - LO) / (HI - LO)) * 2 * half;

function ruler(s: Scene, cx: number, y: number, half: number): void {
  s.line(cx - half, y, cx + half, y, s.c('--ink-3'), 0.4);
  for (const [name, h] of SPANS) {
    if (name === 'week' && half < 40 * s.u) continue;
    const x = rulerX(cx, half, h);
    s.line(x, y - 1.4 * s.u, x, y + 1.4 * s.u, s.c('--ink-3'), 0.4);
    mono(s, name, x, y + 4.4 * s.u, { size: 3, k: '--ink-2' });
  }
}

/** A marker standing on the ruler at `hours`, with a label above it. */
function marker(s: Scene, cx: number, y: number, half: number, hours: number, label: string, k: Ink): void {
  const x = rulerX(cx, half, hours);
  s.circle(x, y, 1.1 * s.u, { fill: s.c(k) });
  mono(s, label, x, y - 4.6 * s.u, { size: 3.4, k, weight: 650, halo: true });
}

/** A GPU card whose cells flicker: many multiplications at once. */
function chip(s: Scene, x: number, y: number, w: number, h: number, name: string, seed: number): void {
  gpu(s, x, y, w, h, name, { size: 2.8 });
  const c = 3.6;
  const cols = Math.floor((w - 4) / (c + 1));
  const rows = Math.floor((h - 9) / (c + 1));
  const x0 = x - ((cols - 1) / 2) * (c + 1) * s.u;
  const y0 = y - h / 2 * s.u + 7.5 * s.u;
  for (let i = 0; i < cols * rows; i++) {
    const cx = x0 + (i % cols) * (c + 1) * s.u;
    const cy = y0 + Math.floor(i / cols) * (c + 1) * s.u + (c / 2) * s.u;
    const on = 0.5 + 0.5 * Math.sin(s.t * 5 + i * 2.3 + seed);
    s.cell(cx - (c / 2) * s.u, cy - (c / 2) * s.u, c * s.u, c * s.u, i % 3 === 2 ? '+' : '×', 'orange', { on, size: 2.4 });
  }
}

const cost: SceneDef = {
  draw(s) {
    const half = Math.min(s.w / 2 - 9 * s.u, 60 * s.u);
    const ry = s.h * 0.2;
    ruler(s, s.w / 2, ry, half);
    // A guess sweeping the ruler, AlexNet's run, then the open question again.
    const alex = s.win('alex', 'flop');
    s.alpha(Math.max(s.win('ask', 'alex'), s.ease('flop', 0.6)), () => {
      const swing = s.since('alex') < 0 ? Math.sin(s.t * 1.3) : 0;
      marker(s, s.w / 2, ry, half, 10 ** (1.9 + 1.7 * swing), '?', 'purple');
    });
    s.alpha(alex, () => marker(s, s.w / 2, ry, half, 5.5 * 24, '5-6 days', 'orange'));

    const cy = s.h * 0.52;
    // The bill, every line still unknown.
    s.alpha(s.win('ask', 'gpu'), () => {
      const bw = 44;
      const bh = 30;
      s.rrect(s.w / 2 - (bw / 2) * s.u, cy - (bh / 2) * s.u, bw * s.u, bh * s.u, 1.4, { fill: s.c('--card'), stroke: s.c('--ink-3'), lw: 0.35 });
      mono(s, 'training run', s.w / 2, cy - 10 * s.u, { size: 3.4, k: '--ink-2', weight: 650 });
      s.line(s.w / 2 - (bw / 2 - 4) * s.u, cy - 6.5 * s.u, s.w / 2 + (bw / 2 - 4) * s.u, cy - 6.5 * s.u, s.c('--ink-3'), 0.3);
      (['arithmetic', 'speed', 'time'] as const).forEach((name, i) => {
        const y = cy - 1.5 * s.u + i * 6 * s.u;
        s.alpha(after(s, 'ask', 0.2 + i * 0.12), () => {
          mono(s, name, s.w / 2 - (bw / 2 - 4) * s.u, y, { size: 3.4, align: 'left', k: i === 2 ? 'purple' : '--ink' });
          mono(s, '?', s.w / 2 + (bw / 2 - 4) * s.u, y, { size: 3.6, align: 'right', k: 'purple', weight: 700 });
        });
      });
    });
    const w = 34;
    const h = 28;
    const two = s.ease('alex', 0.8);
    const dx = 19 * two;
    s.alpha(s.ease('gpu', 0.6), () => chip(s, s.w / 2 - dx * s.u, cy, w, h, two > 0.5 ? 'GPU 0' : 'GPU', 0));
    s.alpha(two, () => chip(s, s.w / 2 + dx * s.u, cy, w, h, 'GPU 1', 1.7));
    cite(s, 'AlexNet · Krizhevsky, Sutskever & Hinton, 2012', alex);

    const ty = s.h * 0.78;
    const cyy = s.h * 0.88;
    s.alpha(s.win('ask', 'gpu'), () => caption(s, 'how long will training take?', cyy, 'purple', 3.8));
    s.alpha(s.win('gpu', 'alex'), () => caption(s, 'GPU: graphics processing unit', cyy, '--ink-2', 3.6));
    s.alpha(alex, () => caption(s, 'AlexNet: 2 GPUs, 5 to 6 days', cyy, 'orange', 3.6));
    s.alpha(s.win('flop', 'plan'), () => {
      mono(s, '3.14 × 2.5 = 7.85', s.w / 2, ty, { size: 3.6, k: '--ink-2' });
      caption(s, 'one multiply or one add: one FLOP', cyy, '--ink', 3.6);
    });
    s.alpha(s.ease('plan', 0.6), () => {
      rich(s, [['time', 'purple'], [' = ', '--ink-2'], ['FLOPs', 'blue'], [' / ', '--ink-2'], ['speed', 'orange']], s.w / 2, ty, { size: 4.2, weight: 650 });
      caption(s, 'speed: FLOPs per second', cyy, '--ink-2', 3.4);
    });
  },
};

// ---- W x, with a tally of FLOPs on every weight

/** Where W's cells, x and z sit; `top` places x as a row above W instead of a column beside it. */
function grid(s: Scene, cy: number, top: boolean) {
  const cw = s.tall ? 9.6 : 10.4;
  const gap = s.tall ? 10.4 : 11.2;
  const pitch = 12.4;
  const left = s.w / 2 - (top ? 12 : s.tall ? 33 : 36) * s.u;
  const xs = W[0]!.map((_, j) => left + j * gap * s.u);
  const ys = W.map((_, i) => cy + (i - 1) * pitch * s.u);
  return { cw, ch: 11, xs, ys };
}
type G = ReturnType<typeof grid>;

const forward: SceneDef = {
  draw(s) {
    const cy = s.h * 0.34;
    const g = grid(s, cy, false);
    const hi = s.win('mult', 'n');
    // The pips arrive cell by cell, so the per-weight tally builds on screen.
    const order = (i: number, j: number) => i * 4 + j;
    const pipsOf = (i: number, j: number) => [after(s, 'mark', 0.15 + order(i, j) * 0.025), after(s, 'mark', 0.35 + order(i, j) * 0.025)];
    weightsBy(s, g, (i, j) => pipsOf(i, j), () => [0, 0, 0, 0], { row: 1, hi });
    const xx = g.xs[3]! + (s.tall ? 15 : 17) * s.u;
    const xz = xx + (s.tall ? 17 : 20) * s.u;
    const xY = [-1.5, -0.5, 0.5, 1.5].map((i) => cy + i * 8 * s.u);
    X.forEach((v, j) => cells(s, [xx], xY[j]!, [f(v)], 'orange', { w: 8.4, h: 7.2, size: 3.4, on: [hi] }));
    s.text('=', (xx + xz) / 2, cy, { size: 4.6, font: 'mono', color: s.c('--ink-3') });
    const zOn = [0, s.ease('mult', 0.6, 3.5), 0];
    Z.forEach((v, i) => cells(s, [xz], g.ys[i]!, [String(v)], '--ink-2', { w: 8.4, h: 8, size: 3.4, on: [zOn[i]!] }));
    mono(s, 'W', g.xs[0]! - 9 * s.u, cy, { size: 4.2, k: 'blue', weight: 650 });
    mono(s, 'x', xx, xY[0]! - 7 * s.u, { size: 4.2, k: 'orange', weight: 650 });
    mono(s, 'z', xz, g.ys[0]! - 8.4 * s.u, { size: 4.2, k: '--ink-2', weight: 650 });

    const t1 = s.h * 0.7;
    const t2 = s.h * 0.8;
    s.alpha(s.ease('mult', 0.6, 1) * (1 - s.ease('mark', 0.5)), () => mono(s, '3·2 + 1·1 + 0·3 + 2·1 = 9', s.w / 2, t1, { size: 3.8, k: '--ink-2' }));
    s.alpha(s.win('mark', 'n'), () => {
      legend(s, s.w / 2, t1, [['blue', 'multiply'], ['blue', 'add']], 'per weight:');
      mono(s, '= 2 FLOPs per token', s.w / 2, t2, { size: 4.2, k: 'blue', weight: 650 });
    });
    s.alpha(s.ease('n', 0.6), () => {
      mono(s, '12 weights × 2 = 24 FLOPs per token', s.w / 2, t1, { size: 3.6, k: '--ink-2' });
      mono(s, 'N parameters: 2N FLOPs per token', s.w / 2, t2, { size: 4, k: 'blue', weight: 650 });
    });
  },
};

/**
 * W's cells with the FLOPs each weight has cost so far: up to six pips per cell, two forward
 * (blue) then four backward (red), each 0..1. `hi` lights row `row`, `on` lights weight `cell`.
 */
function weightsBy(s: Scene, g: G, blue: (i: number, j: number) => number[], red: (i: number, j: number) => number[], o: { row?: number; hi?: number; cell?: [number, number]; on?: number } = {}): void {
  const pw = 1.15;
  const step = 1.5;
  W.forEach((r, i) => r.forEach((v, j) => {
    const x = g.xs[j]!;
    const y = g.ys[i]!;
    const lit = (i === o.row ? o.hi ?? 0 : 0) + (o.cell && o.cell[0] === i && o.cell[1] === j ? o.on ?? 0 : 0);
    s.cell(x - (g.cw / 2) * s.u, y - (g.ch / 2) * s.u, g.cw * s.u, g.ch * s.u, '', 'blue', { on: Math.min(1, lit) });
    mono(s, f(v), x, y - 1.6 * s.u, { size: 3.4, weight: 550 });
    const x0 = x - ((6 * step - (step - pw)) / 2) * s.u;
    [...blue(i, j), ...red(i, j)].forEach((a, k) => {
      if (a <= 0.003) return;
      s.alpha(a, () => s.rrect(x0 + k * step * s.u, y + 2 * s.u, pw * s.u, 2 * s.u, 0.3, { fill: s.c(k < 2 ? 'blue' : 'red') }));
    });
  }));
}

/** A one-line key of pips: a lead-in, then a pip and its meaning per entry. */
function legend(s: Scene, cx: number, y: number, items: [Ink, string][], lead: string): void {
  const size = 3.6;
  const gapU = 3;
  const leadW = lead ? s.measure(lead, { size, font: 'mono' }) + gapU * s.u : 0;
  const ws = items.map(([, t]) => s.measure(t, { size, font: 'mono', weight: 650 }) + 2.6 * s.u);
  const total = leadW + ws.reduce((a, b) => a + b, 0) + gapU * s.u * (items.length - 1);
  let x = cx - total / 2;
  if (lead) mono(s, lead, x, y, { size, k: '--ink-2', align: 'left' });
  x += leadW;
  items.forEach(([k, t], i) => {
    s.rrect(x, y - 1.2 * s.u, 1.15 * s.u, 2.4 * s.u, 0.3, { fill: s.c(k) });
    mono(s, t, x + 2.6 * s.u, y, { size, k, align: 'left', weight: 650 });
    x += ws[i]! + gapU * s.u;
  });
}

// ---- backprop: four more pips per weight, then the bill for a whole run

const backward: SceneDef = {
  marks: {
    c: { tex: String.raw`\sym{Cflops}{C} \approx 6\,\sym{Nparams}{N}\,\sym{Dtokens}{D}`, x: 0.5, y: 0.87, size: 6.4 },
  },
  draw(s) {
    const bill = s.ease('d', 0.6);
    s.alpha(1 - bill, () => {
      const cy = s.h * 0.42;
      const g = grid(s, cy, true);
      const order = (i: number, j: number) => i * 4 + j;
      const red = (i: number, j: number) => [
        after(s, 'dx', 0.25 + order(i, j) * 0.02),
        after(s, 'dx', 0.45 + order(i, j) * 0.02),
        after(s, 'dW', 0.55 + order(i, j) * 0.02),
        after(s, 'acc', 0.4 + order(i, j) * 0.02),
      ];
      const pick = s.win('dW', 'acc');
      weightsBy(s, g, () => [1, 1], red, { cell: [1, 0], on: pick });
      // x across the top, dz down the side: each weight meets its column's x and its row's dz.
      const xr = g.ys[0]! - 12 * s.u;
      X.forEach((v, j) => cells(s, [g.xs[j]!], xr, [f(v)], 'orange', { w: 8.4, h: 7.2, size: 3.4, on: [j === 0 ? pick : 0] }));
      const dzx = g.xs[0]! - (g.cw / 2 + 8) * s.u;
      s.alpha(s.ease('back', 0.6, 0.6), () => {
        DZ.forEach((v, i) => cells(s, [dzx], g.ys[i]!, [f(v)], 'red', { w: 8.4, h: 8, size: 3.4, on: [i === 1 ? pick : 0] }));
        mono(s, 'dz', dzx, xr, { size: 4, k: 'red', weight: 650 });
      });
      mono(s, 'x', g.xs[3]! + (g.cw / 2 + 3) * s.u, xr, { size: 4, k: 'orange', weight: 650, align: 'left' });
    });

    const t1 = s.h * 0.74;
    const t2 = s.h * 0.84;
    s.alpha(s.win('back', 'dx') * (1 - bill), () => mono(s, 'backprop: two more products', s.w / 2, t1, { size: 3.6, k: '--ink-2' }));
    s.alpha(s.win('dx', 'dW'), () => {
      mono(s, 'Wᵀ dz: each weight once more', s.w / 2, t1, { size: 3.6, k: '--ink-2' });
      legend(s, s.w / 2, t2, [['red', 'multiply'], ['red', 'add']], '');
    });
    s.alpha(s.win('dW', 'acc'), () => {
      mono(s, 'dW[1, 0] = dz[1] × x[0]', s.w / 2, t1, { size: 3.6, k: '--ink-2' });
      legend(s, s.w / 2, t2, [['red', 'multiply']], '');
    });
    s.alpha(s.win('acc', 'six'), () => {
      mono(s, 'dW[1, 0] += the next token\'s', s.w / 2, t1, { size: 3.6, k: '--ink-2' });
      legend(s, s.w / 2, t2, [['red', 'add']], '');
    });
    s.alpha(s.win('six', 'kaplan'), () => {
      rich(s, [['2 forward', 'blue'], [' + ', '--ink-2'], ['4 backward', 'red'], [' = 6', '--ink']], s.w / 2, t1, { size: 4, weight: 650 });
      mono(s, 'per parameter, per token', s.w / 2, t2, { size: 3.4, k: '--ink-2' });
    });
    s.alpha(s.win('kaplan', 'd'), () => {
      rich(s, [['backward', 'red'], [' ≈ 2 × ', '--ink-2'], ['forward', 'blue']], s.w / 2, t1, { size: 4, weight: 650 });
      mono(s, 'so training ≈ 6 FLOPs per parameter per token', s.w / 2, t2, { size: 3.2, k: '--ink-2' });
    });
    cite(s, 'Kaplan et al., 2020', s.win('kaplan', 'd'));

    // The bill: a cell per parameter and token, six FLOPs in each.
    s.alpha(bill, () => {
      const cols = 12;
      const rows = 8;
      const cw = s.tall ? 5.8 : 5.6;
      const ch = 4.6;
      const gx = (cw + 0.6) * s.u;
      const gy = (ch + 0.6) * s.u;
      const x0 = s.w / 2 - ((cols - 1) / 2) * gx + 4 * s.u;
      const y0 = s.h * 0.24;
      for (let r = 0; r < rows; r++) {
        s.alpha(after(s, 'd', 0.15 + r * 0.07), () => {
          for (let c = 0; c < cols; c++) s.cell(x0 + c * gx - (cw / 2) * s.u, y0 + r * gy - (ch / 2) * s.u, cw * s.u, ch * s.u, '6', 'purple', { size: 2.4 });
        });
      }
      mono(s, 'N parameters →', s.w / 2 + 4 * s.u, y0 - 6 * s.u, { size: 3.4, k: 'blue', weight: 650 });
      s.alpha(after(s, 'd', 0.2), () => {
        mono(s, 'D', x0 - (cw / 2 + 3) * s.u, y0 + ((rows - 1) / 2) * gy - 2.4 * s.u, { size: 4, k: 'orange', weight: 700, align: 'right' });
        mono(s, 'tokens ↓', x0 - (cw / 2 + 3) * s.u, y0 + ((rows - 1) / 2) * gy + 2.6 * s.u, { size: 3, k: 'orange', align: 'right' });
      });
      s.alpha(s.ease('c', 0.6), () => mono(s, '6 FLOPs per parameter per token', s.w / 2, s.h * 0.72, { size: 3.4, k: '--ink-2' }));
    });
    s.show('c', s.ease('c', 0.6, 1.2));
  },
};

// ---- a real run, priced

/** The ledger, one line per quantity: label, color, and its text as the beats go by. */
const LEDGER: { label: string; k: Ink; from: string; texts: [string, string][] }[] = [
  { label: 'N', k: 'blue', from: 'model', texts: [['model', '3 × 10⁹ parameters']] },
  { label: 'D', k: 'orange', from: 'model', texts: [['model', '4 × 10¹⁰ tokens']] },
  { label: 'C', k: 'purple', from: 'lead', texts: [['lead', '6 × 3 × 4 = 72'], ['pow', '72 × 10¹⁹ FLOPs'], ['shift', '7.2 × 10²⁰ FLOPs']] },
  { label: 'speed', k: 'slate', from: 'rate', texts: [['rate', '2 × 10¹⁶ FLOPs per second']] },
  { label: 'time', k: 'green', from: 'div', texts: [['div', '7.2 / 2 = 3.6'], ['sub', '3.6 × 10⁴ s'], ['hours', '36,000 s = 10 hours']] },
  { label: 'forward', k: 'teal', from: 'fwd', texts: [['fwd', '2N = 6 × 10⁹ per token']] },
];

const run: SceneDef = {
  draw(s) {
    // The picture above the ledger, unless the stage is wide enough to put it beside.
    const side = !s.tall && s.w / s.h >= 1.45;
    const px = side ? s.w * 0.27 : s.w / 2;
    const py = side ? s.h * 0.5 : s.h * 0.25;
    const zh = side ? s.h * 0.72 : s.h * 0.36;
    const zw = side ? s.w * 0.44 : s.w - 24 * s.u;

    // N by D: a rectangle whose area is the bill, reshaped at 'same'.
    const rectA = s.win('model', 'rate');
    const k = Math.min(zh / 4.8, zw / 6);
    // Reshaped for 'same' only; the forward pass returns to the run as priced.
    const m = s.since('fwd') < 0 ? s.ease('same', 1.2, 0.4) : 0;
    const rw = (3 + 3 * m) * k;
    const rh = (4 - 2 * m) * k;
    const fw = s.ease('fwd', 0.6);
    s.alpha(Math.max(rectA, fw), () => {
      const l = px - rw / 2;
      const t = py - rh / 2 + 2 * s.u;
      s.alpha(m * (1 - fw), () => {
        s.ctx.save();
        s.ctx.setLineDash([1 * s.u, 0.8 * s.u]);
        s.rrect(px - 1.5 * k, py - 2 * k + 2 * s.u, 3 * k, 4 * k, 0.6, { stroke: s.tint('purple', 0.6), lw: 0.3 });
        s.ctx.restore();
      });
      s.rrect(l, t, rw, rh, 0.6, { fill: s.tint('purple', 0.18 * (1 - 0.6 * fw)), stroke: s.tint('purple', 0.8), lw: 0.35 });
      // One token's row: the forward pass alone.
      s.alpha(fw, () => {
        s.rrect(l, t + rh / 2 - 0.12 * k, rw, 0.24 * k, 0.3, { fill: s.tint('teal', 0.7) });
        mono(s, 'one token: 2N', l + rw + 2 * s.u, t + rh / 2, { size: 3.4, k: 'teal', weight: 650, align: 'left' });
      });
      s.alpha(1 - fw, () => fit(s, m > 0.5 ? 'same 6ND' : '6ND', px, t + rh / 2, rw - 2 * s.u, { size: 4.2, k: 'purple', weight: 700 }));
      mono(s, m > 0.5 ? 'N = 6 × 10⁹' : 'N = 3 × 10⁹', px, t - 3.2 * s.u, { size: 3.2, k: 'blue', weight: 650, halo: true });
      // D runs down the side, so its label does too.
      s.ctx.save();
      s.ctx.translate(l - 3.2 * s.u, t + rh / 2);
      s.ctx.rotate(-Math.PI / 2);
      mono(s, m > 0.5 ? 'D = 2 × 10¹⁰' : 'D = 4 × 10¹⁰', 0, 0, { size: 3.2, k: 'orange', weight: 650, halo: true });
      s.ctx.restore();
    });

    // A hundred GPUs, as a 10 by 10 block.
    s.alpha(s.win('rate', 'div'), () => {
      const p = Math.min(zh / 11.5, zw / 11) / s.u;
      const c = p * 0.76;
      for (let i = 0; i < 100; i++) {
        const x = px + ((i % 10) - 4.5) * p * s.u;
        const y = py - 2 * s.u + (Math.floor(i / 10) - 4.5) * p * s.u;
        s.alpha(after(s, 'rate', 0.4 + i * 0.002), () => s.rrect(x - (c / 2) * s.u, y - (c / 2) * s.u, c * s.u, c * s.u, 0.4, { fill: s.tint('slate', 0.35), stroke: s.tint('slate', 0.9), lw: 0.2 }));
      }
      mono(s, '100 GPUs', px, py - 2 * s.u + 5.4 * p * s.u + 2 * s.u, { size: 3.4, k: 'slate', weight: 650 });
    });

    // The time, on the ruler from the start.
    s.alpha(s.win('div', 'fwd'), () => {
      const half = side ? s.w * 0.22 : Math.min(s.w / 2 - 9 * s.u, 60 * s.u);
      const ry = py + 2 * s.u;
      ruler(s, px, ry, half);
      const hr = s.ease('hours', 1, 0.6);
      s.alpha(1 - hr, () => marker(s, px, ry, half, 10 ** 1.9, '?', 'purple'));
      s.alpha(hr, () => marker(s, px, ry, half, 10, '10 hours', 'green'));
    });

    // The ledger.
    const lx = side ? s.w * 0.62 : s.w / 2 - 20 * s.u;
    const vx = lx + 2 * s.u;
    const maxW = s.w - 5 * s.u - vx;
    LEDGER.forEach((row, i) => {
      const y = side ? s.h * (0.2 + i * 0.12) : s.h * (0.53 + i * 0.076);
      s.alpha(s.ease(row.from, 0.6, row.label === 'D' ? 1.2 : 0), () => {
        mono(s, row.label, lx - 1 * s.u, y, { size: 3.6, k: row.k, align: 'right', weight: 650 });
        row.texts.forEach(([beat, text], j) => {
          const next = row.texts[j + 1];
          const a = (j === 0 ? 1 : s.ease(beat, 0.5)) * (next ? 1 - s.ease(next[0], 0.5) : 1);
          s.alpha(a, () => fit(s, text, vx, y, maxW, { size: 3.6, align: 'left', weight: j === row.texts.length - 1 ? 600 : 500 }));
        });
      });
    });
  },
};

export const scenes: Record<string, SceneDef> = { cost, forward, backward, run };
