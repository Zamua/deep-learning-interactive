import { Rng } from '../../core/rand';
import { type Scene, type SceneDef, clamp01, lerp } from '../../lecture/scene';
import { FRESH_ACC, GATE, LIN_FINAL, NETS, NET_EVERY, NET_FINAL, NET_FRESH_WRONG, NET_HITS, NET_LOSS, NET_WRONG, NPTS, XF, XS, YF, YS, unitOf } from './data';
import { type K, Plane, at, boundary, cycle, lossChart, margin, pill, points, readout, regions, top, unitLine, within } from './draw';
import { fit, num, plotSide, twoPlots } from './kit';

// ---------------------------------------------------------------- backprop-net

interface ChainRow {
  label: string;
  k: K;
  kind: 'box' | 'op';
  param?: string;
}

const ROWS_NET: ChainRow[] = [
  { label: 'X', k: 'orange', kind: 'box' },
  { label: '·W +b', k: 'blue', kind: 'op', param: 'W, b' },
  { label: 'ReLU', k: '--ink-2', kind: 'op' },
  { label: 'hidden_layer', k: '--ink', kind: 'box' },
  { label: '·W2 +b2', k: 'blue', kind: 'op', param: 'W2, b2' },
  { label: 'scores', k: 'purple', kind: 'box' },
  { label: 'loss', k: 'red', kind: 'box' },
];

function netChain(s: Scene) {
  const { u, h } = s;
  const m = margin(s);
  const cx = m + u * 25;
  const y0 = top(s) + u * 4;
  const gap = (h - m - u * 3 - y0) / (ROWS_NET.length - 1);
  return { cx, ys: ROWS_NET.map((_, i) => y0 + i * gap), px: m + u * 6.5, rx: cx + u * 28 };
}

/** A teal arrow up the right of the chain, from row `a` to row `b`, drawn to fraction `p`. */
function backArrow(s: Scene, x: number, ya: number, yb: number, p: number, label: string): void {
  if (p <= 0) return;
  const { u } = s;
  s.arrow(x, ya, x, lerp(ya, yb, p), s.c('teal'), 0.5, 2);
  s.alpha(clamp01(p * 2 - 1), () => s.text(label, x + u * 1.6, (ya + yb) / 2, { size: 2.7, font: 'mono', weight: 650, color: s.c('teal'), align: 'left', halo: true }));
}

const backpropNet: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const m = margin(s);
    const { cx, ys, px, rx } = netChain(s);
    const rw = w - rx - m;
    // the forward chain
    ROWS_NET.forEach((r, i) => {
      const a = within(s, 'longer', i * 0.08, i * 0.08 + 0.2);
      const y = ys[i]!;
      const gateOn = r.label === 'ReLU' ? s.win('slope', 'dW') : 0;
      s.alpha(a, () => {
        if (i > 0) s.arrow(cx, ys[i - 1]! + u * 3.4, cx, y - u * 3.4, s.tint('--ink-3', 0.7), 0.3, 1.6);
        if (r.kind === 'box') {
          const bw = s.measure(r.label, { font: 'mono', size: 2.9, weight: 650 }) + u * 3.6;
          s.rrect(cx - bw / 2, y - u * 3, bw, u * 6, 1.1, { fill: s.tint(r.k, 0.1), stroke: s.tint(r.k, 0.7), lw: 0.3 });
          s.text(r.label, cx, y + u * 0.2, { size: 2.9, font: 'mono', weight: 650, color: s.c(r.k) });
        } else {
          const bw = s.measure(r.label, { font: 'mono', size: 2.7, weight: 650 }) + u * 3;
          s.rrect(cx - bw / 2, y - u * 2.6, bw, u * 5.2, 2.6, { fill: s.tint(gateOn > 0 ? 'teal' : r.k, 0.08 + 0.15 * gateOn), stroke: s.tint(gateOn > 0 ? 'teal' : r.k, 0.6 + 0.4 * gateOn), lw: 0.3 + 0.3 * gateOn });
          s.text(r.label, cx, y + u * 0.2, { size: 2.7, font: 'mono', weight: 650, color: s.c(r.k) });
        }
        if (r.param) {
          const pw = s.measure(r.param, { font: 'mono', size: 2.6, weight: 650 }) + u * 2.6;
          const on = r.param === 'W2, b2' ? s.win('dW2', 'dh') : s.win('dW', 'reg');
          const reg = s.win('reg', 'rules');
          s.rrect(px - pw / 2, y - u * 2.6, pw, u * 5.2, 1, { fill: s.tint('blue', 0.08 + 0.2 * Math.max(on, reg)), stroke: s.tint('blue', 0.6 + 0.4 * Math.max(on, reg)), lw: 0.3 });
          s.text(r.param, px, y + u * 0.2, { size: 2.6, font: 'mono', weight: 650, color: s.c('blue') });
          s.line(px + pw / 2, y, cx - u * 5, y, s.tint('--ink-3', 0.6), 0.25, [0.6, 0.5]);
        }
      });
    });
    // the gradient climbing back
    const bx = cx + u * 11.5;
    backArrow(s, bx, ys[6]! - u * 1, ys[5]! + u * 1, within(s, 'ds', 0.1, 0.6), 'dscores');
    backArrow(s, bx, ys[5]! - u * 1, ys[3]! + u * 1, within(s, 'dh', 0.15, 0.7), 'dhidden');
    backArrow(s, bx, ys[3]! - u * 1, ys[2]! + u * 0.5, within(s, 'gate', 0.2, 0.6), 'gated');
    backArrow(s, bx, ys[2]! - u * 1, ys[1]! + u * 0.5, within(s, 'dW', 0.1, 0.4), '');
    const side = (y: number, p: number, label: string) =>
      s.alpha(p, () => {
        s.arrow(cx - u * 5, y + u * 3.4, px + u * 2, y + u * 3.4, s.c('teal'), 0.45, 1.8);
        s.text(label, (cx - u * 5 + px) / 2, y + u * 6.4, { size: 2.5, font: 'mono', weight: 650, color: s.c('teal'), halo: true });
      });
    side(ys[4]!, within(s, 'dW2', 0.2, 0.5), 'dW2, db2');
    side(ys[1]!, within(s, 'dW', 0.3, 0.6), 'dW, db');
    // right: the detail for each step
    const L = (str: string, y: number, k: K = '--ink-2', size = 2.9, mono = true) => fit(s, str, rx, y, rw, { size, font: mono ? 'mono' : 'ui', weight: 650, color: s.c(k), align: 'left' });
    const ty = top(s) + u * 6;
    s.alpha(s.win('longer', 'ds'), () => {
      L('forward: down', ty, '--ink-3', 2.9, false);
      L('backward: up', ty + u * 6, 'teal', 2.9, false);
    });
    s.alpha(s.win('ds', 'dW2'), () => {
      L('dscores', ty, 'teal', 3.4);
      L('(300, 3)', ty + u * 5.5, '--ink-3');
      L('exactly as before', ty + u * 11, '--ink-2', 2.9, false);
    });
    const shapeRows = (rows: [string, K][], a: number) =>
      s.alpha(a, () => rows.forEach(([t, k], i) => L(t, ty + i * u * 5.5, k, i === rows.length - 1 ? 3.3 : 3)));
    shapeRows([['hidden_layer.T', '--ink'], ['(100, 300)', '--ink-3'], ['· dscores', 'teal'], ['(300, 3)', '--ink-3'], ['= dW2 (100, 3)', 'teal']], s.win('dW2', 'dh'));
    shapeRows([['dscores', 'teal'], ['(300, 3)', '--ink-3'], ['· W2.T', 'blue'], ['(3, 100)', '--ink-3'], ['= dhidden (300, 100)', 'teal']], s.win('dh', 'slope'));
    shapeRows([['X.T', 'orange'], ['(2, 300)', '--ink-3'], ['· dhidden', 'teal'], ['(300, 100)', '--ink-3'], ['= dW (2, 100)', 'teal']], s.win('dW', 'reg'));
    s.alpha(s.win('dW', 'reg'), () => L('db: sum the rows', ty + u * 30, '--ink-2', 2.8, false));
    // the ReLU gate on real values
    const gA = s.win('slope', 'dW');
    if (gA > 0)
      s.alpha(gA, () => {
        const nr = 4;
        const nc = GATE.units.length;
        const cw = Math.min(rw / nc, u * 9);
        const ch = u * 5.4;
        const gy0 = ty + u * 1;
        L('hidden_layer', gy0, '--ink', 2.8);
        const y1 = gy0 + u * 3.4;
        for (let i = 0; i < nr; i++)
          for (let j = 0; j < nc; j++) {
            const v = GATE.hid[i]![j]!;
            s.cell(rx + j * cw, y1 + i * ch, cw, ch, num(v, 1), v > 0 ? 'blue' : '--ink-3', { size: 2.3, on: v > 0 ? 0.35 : 0 });
          }
        const gy1 = y1 + nr * ch + u * 5;
        L('dhidden', gy1, 'teal', 2.8);
        const y2 = gy1 + u * 3.4;
        const wipe = within(s, 'gate', 0.3, 0.75);
        let mx = 0;
        for (const r of GATE.up.slice(0, nr)) for (const v of r) mx = Math.max(mx, Math.abs(v));
        for (let i = 0; i < nr; i++)
          for (let j = 0; j < nc; j++) {
            const off = GATE.hid[i]![j]! <= 0;
            const g = GATE.up[i]![j]! / (mx || 1);
            const a = off ? 1 - wipe : 1;
            const x = rx + j * cw;
            const y = y2 + i * ch;
            s.rrect(x + u * 0.3, y + u * 0.3, cw - u * 0.6, ch - u * 0.6, 0.8, { fill: s.tint('--ink-3', 0.06), stroke: s.tint('--ink-3', 0.3), lw: 0.2 });
            s.alpha(a, () => s.rrect(x + u * 0.3, y + u * 0.3, cw - u * 0.6, ch - u * 0.6, 0.8, { fill: s.tint(g >= 0 ? 'teal' : 'red', 0.15 + 0.55 * Math.min(1, Math.abs(g))) }));
            if (off) s.alpha(wipe, () => s.text('0', x + cw / 2, y + ch / 2, { size: 2.4, font: 'mono', color: s.c('--ink-3') }));
          }
        s.alpha(s.ease('gate', 0.5, 0.4), () => fit(s, 'zero where the unit was off', rx, y2 + nr * ch + u * 3.4, rw, { size: 2.6, font: 'ui', weight: 650, color: s.c('--ink-2'), align: 'left' }));
        s.alpha(s.win('slope', 'gate'), () => fit(s, 'slope: 1 if on, 0 if off', rx, y2 + nr * ch + u * 3.4, rw, { size: 2.6, font: 'ui', weight: 650, color: s.c('--ink-2'), align: 'left' }));
      });
    s.alpha(s.win('reg', 'rules'), () => {
      L('dW2 += reg * W2', ty, 'teal', 3);
      L('dW += reg * W', ty + u * 6, 'teal', 3);
    });
    s.alpha(s.ease('rules', 0.6), () => {
      L('chapter 6, four rules:', ty, '--ink-3', 2.8, false);
      const rules: [string, K][] = [
        ['matmul: Xᵀ · grad', 'orange'],
        ['matmul: grad · Wᵀ', 'blue'],
        ['ReLU: a gate', '--ink'],
        ['bias: sum the rows', 'green'],
      ];
      rules.forEach(([t, k], i) => s.alpha(within(s, 'rules', 0.1 + i * 0.12, 0.2 + i * 0.12), () => pill(s, t, rx, ty + u * (7 + i * 7), k, { size: 2.7, align: 'left' })));
    });
  },
};

// ---------------------------------------------------------------- train-net

function netIt(s: Scene): number {
  if (s.since('early') < 0) return 0;
  if (s.since('follow') < 0) return 150 * within(s, 'early', 0, 0.45) + 850 * within(s, 'early', 0.5, 0.95);
  if (s.since('loss') < 0) return 1000 + 2000 * within(s, 'follow', 0, 0.9);
  return 3000 + 7000 * within(s, 'loss', 0, 0.8);
}

/** Regions at iteration `it`, crossfading between the two snapshots around it. */
function netRegions(s: Scene, pl: Plane, it: number): void {
  let a = 0;
  while (a < NETS.length - 2 && NETS[a + 1]!.it <= it) a++;
  const A = NETS[a]!;
  const B = NETS[a + 1]!;
  const f = clamp01((it - A.it) / (B.it - A.it));
  regions(s, pl, `net${A.it}`, A.net, 1 - f, 140);
  if (f > 0.003) regions(s, pl, `net${B.it}`, B.net, f, 140);
}

const trainNet: SceneDef = {
  draw(s) {
    const { u } = s;
    const { pl, side } = plotSide(s, 0.6);
    const [sx, sy, sw, sh] = side;
    const it = Math.floor(netIt(s));
    const k = Math.min(NET_LOSS.length - 1, Math.floor(it / NET_EVERY));
    pl.card();
    netRegions(s, pl, it);
    const linesA = s.ease('lines', 0.8);
    s.alpha(linesA, () => {
      for (let j = 0; j < 100; j++) {
        const v = unitOf(NET_FINAL, j);
        unitLine(s, pl, v.a, v.b, v.c, s.tint('--ink', 0.3), 0.16);
      }
    });
    boundary(s, pl, 'net10000', NET_FINAL, 0.85 * s.ease('poly', 0.6), 300);
    points(s, pl, XS, YS, { wrong: NET_WRONG, ring: s.win('acc', 'lines'), a: 1 - 0.55 * s.ease('poly', 0.6) });
    // side: loss and readouts
    const chartH = Math.min(sh * 0.36, u * 26);
    lossChart(s, [sx + u * 6, sy + u * 4, sw - u * 7, chartH], NET_LOSS, NET_EVERY, 10000, s.since('first') >= 0 ? it : -1);
    const ry = sy + u * 4 + chartH + u * 9;
    const step = s.tall ? 11 : 12;
    const size = s.tall ? 4.4 : 5;
    readout(s, sx, ry, 'iteration', it.toLocaleString('en-US'), '--ink', { size });
    s.alpha(s.ease('first', 0.4), () => readout(s, sx, ry + u * step, 'loss', num(NET_LOSS[k]!, 3), 'red', { size }));
    const hits = it >= 10000 ? NET_HITS[NET_HITS.length - 1]! : NET_HITS[k]!;
    s.alpha(s.ease('early', 0.4), () => readout(s, sx, ry + u * step * 2, 'accuracy', `${Math.round((hits / NPTS) * 100)}%`, 'green', { size }));
    const note = (str: string, a: number, kk: K = '--ink-2') => s.alpha(a, () => fit(s, str, sx, ry + u * (step * 3 + 1), sw, { size: 2.8, font: 'ui', weight: 650, color: s.c(kk), align: 'left' }));
    note('100 lines, one per unit', s.win('lines', 'poly'));
    note('straight segments', s.win('poly', 'crease'), '--ink');
    note('one crease per ReLU', s.ease('crease', 0.6), '--accent');
    const printed = Math.floor(Math.min(it, 9999) / 1000) * 1000;
    s.slot('log', `${printed} ${num(NET_LOSS[printed / NET_EVERY]!, 3)}`);
    s.slot('acc', s.since('acc') >= 0 ? num(NET_HITS[NET_HITS.length - 1]! / NPTS, 2) : '…');
  },
};

// ---------------------------------------------------------------- compare

/** A tiny made-up image: a few blocks of color, standing in for a CIFAR-10 photo. */
function thumb(s: Scene, x: number, y: number, size: number, seed: number): void {
  const r = new Rng(seed);
  const n = 4;
  const base = [r.uniform(60, 200), r.uniform(60, 200), r.uniform(60, 200)];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const c = base.map((v) => Math.round(Math.max(0, Math.min(255, v + r.uniform(-60, 60)))));
      s.ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      s.ctx.fillRect(x + (j * size) / n, y + (i * size) / n, size / n + 0.5, size / n + 0.5);
    }
  s.rrect(x, y, size, size, 0.4, { stroke: s.c('--rule'), lw: 0.25 });
}

function header(s: Scene, pl: Plane, name: string, acc: string, k: K): void {
  const y = pl.y - s.u * 4.2;
  const pw = s.measure(acc, { font: 'mono', size: 3.6, weight: 600 }) + s.u * 3.6 * 0.9;
  fit(s, name, pl.x, y, pl.size - pw - s.u * 2, { size: 3.8, font: 'ui', weight: 650, align: 'left' });
  pill(s, acc, pl.x + pl.size, y, k, { size: 3.6, align: 'right' });
}

const compare: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const m = margin(s);
    const T = top(s);
    // Phase 1: the two pictures.
    const aA = s.win('side', 'params');
    if (aA > 0)
      s.alpha(aA, () => {
        const [q1, p2] = twoPlots(s, 9);
        const p1 = new Plane(s, lerp((w - q1.size) / 2, q1.x, s.ease('right', 0.8)), q1.y, q1.size);
        p1.card();
        regions(s, p1, 'lin200', LIN_FINAL);
        points(s, p1, XS, YS);
        header(s, p1, 'linear classifier', '49%', 'red');
        s.alpha(s.ease('right', 0.6), () => {
          p2.card();
          regions(s, p2, 'net10000', NET_FINAL, 1, 140);
          points(s, p2, XS, YS);
          header(s, p2, 'two-layer network', '99%', 'green');
        });
      });
    // Phase 2: the numbers.
    const bA = s.win('params', 'caveat');
    if (bA > 0)
      s.alpha(bA, () => {
        const rows: [string, string, string, string][] = [
          ['parameters', '9', '603', 'params'],
          ['iterations', '200', '10,000', 'params'],
          ['final loss', '0.77', '0.24', 'result'],
          ['training accuracy', '49%', '99%', 'result'],
        ];
        const tw = Math.min(w - 2 * m, u * 100);
        const x0 = (w - tw) / 2;
        const c1 = x0 + tw * 0.62;
        const c2 = x0 + tw * 0.88;
        const rh = u * 11;
        const y0 = T + (h - T - m - rh * 5) / 2;
        s.text('linear', c1, y0, { size: 3.4, font: 'ui', weight: 700, color: s.c('--ink-2') });
        s.text('two-layer', c2, y0, { size: 3.4, font: 'ui', weight: 700, color: s.c('--ink-2') });
        rows.forEach(([lab, a, b, beat], i) => {
          const y = y0 + rh * (i + 1);
          const off = beat === 'params' ? i * 0.35 : (i - 2) * 0.3;
          s.alpha(within(s, beat, off, off + 0.15), () => {
            s.line(x0, y - rh / 2, x0 + tw, y - rh / 2, s.c('--rule'), 0.25);
            fit(s, lab, x0, y, tw * 0.45, { size: 3.6, font: 'ui', weight: 600, align: 'left' });
            s.text(a, c1, y, { size: 4.2, font: 'mono', weight: 650, color: s.c('--ink-2') });
            s.text(b, c2, y, { size: 4.2, font: 'mono', weight: 700, color: s.c(i === 3 ? 'green' : i === 2 ? 'red' : 'blue') });
          });
        });
      });
    // Phase 3: training points versus fresh ones.
    const cA = s.win('caveat', 'a1');
    if (cA > 0)
      s.alpha(cA, () => {
        const { pl, side } = plotSide(s, 0.6);
        const [sx, sy, sw] = side;
        pl.card();
        regions(s, pl, 'net10000', NET_FINAL, 1, 140);
        const fresh = s.ease('fresh', 0.8, at(s, 'fresh', 0.35) - s.at('fresh'));
        points(s, pl, XS, YS, { a: 1 - fresh });
        points(s, pl, XF, YF, { a: fresh, hollow: true, wrong: NET_FRESH_WRONG, ring: fresh });
        readout(s, sx, sy + u * 8, 'training points', '99%', 'green', { size: s.tall ? 4.4 : 5 });
        s.alpha(fresh, () => readout(s, sx, sy + u * 24, 'fresh spiral', `${Math.round(FRESH_ACC * 100)}%`, 'green', { size: s.tall ? 4.4 : 5 }));
        s.alpha(s.win('caveat', 'fresh'), () => fit(s, 'never-seen points?', sx, sy + u * 24, sw, { size: 3, font: 'ui', weight: 650, color: s.c('--ink-2'), align: 'left' }));
        s.alpha(fresh, () => fit(s, 'held-out: chapter 3', sx, sy + u * 36, sw, { size: 2.8, font: 'ui', weight: 650, color: s.c('--ink-3'), align: 'left' }));
      });
    // Phase 4: the assignment.
    const dA = s.ease('a1', 0.6);
    if (dA > 0)
      s.alpha(dA, () => {
        const cw = Math.min(w - 2 * m, u * 96);
        const y0 = T + u * 4;
        s.text('Assignment 1', w / 2, y0 + u * 3, { size: 6, font: 'display', weight: 600 });
        fit(s, 'this two-layer network, on real images', w / 2, y0 + u * 11, cw, { size: 3.6, italic: true, color: s.c('--ink-2') });
        const tags: [string, K][] = [
          ['mini-batches', 'blue'],
          ['validation set', 'green'],
          ['learning-rate schedule', 'purple'],
        ];
        tags.forEach(([t, k], i) => s.alpha(within(s, 'a1', 0.2 + 0.12 * i, 0.3 + 0.12 * i), () => pill(s, t, w / 2, y0 + u * (20 + 7 * i), k, { size: 3 })));
        const n = s.tall ? 6 : 8;
        const ts = Math.min((cw - u * 2 * (n - 1)) / n, u * 9);
        const tx = (w - (n * ts + (n - 1) * u * 2)) / 2;
        const ty = y0 + u * 44;
        s.alpha(within(s, 'a1', 0.65, 0.85), () => {
          for (let i = 0; i < n; i++) thumb(s, tx + i * (ts + u * 2), ty, ts, 40 + i);
          s.text('CIFAR-10: 3,072 numbers per image', w / 2, ty + ts + u * 5, { size: 3, font: 'mono', weight: 600, color: s.c('--ink-2') });
        });
      });
  },
};

// ---------------------------------------------------------------- outro

const outro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const T = top(s);
    const aA = 1 - s.ease('layer', 0.6);
    if (aA > 0) {
      const ids = ['s1', 's2', 's3', 's4'];
      const lit = (k: number) => {
        const cur = ids.findIndex((id, i) => s.since(id) >= 0 && (i === 3 || s.since(ids[i + 1]!) < 0));
        if (s.since('s4') >= 0 && s.since('s4') > (s.end('s4') - s.at('s4')) * 0.6) return 0.35 + 0.65 * (Math.floor(s.since('s4') * 2.4) % 4 === k ? 1 : 0);
        return cur === k ? 1 : 0.15;
      };
      cycle(s, w / 2, T + (h - T) / 2, Math.min(w, h) * 0.28, lit, { a: aA * s.ease('recap', 0.6), size: s.tall ? 4 : 4.6, center: 'repeat' });
    }
    const bA = s.ease('layer', 0.6);
    if (bA > 0)
      s.alpha(bA, () => {
        const [p1, p2] = twoPlots(s, 9);
        p1.card();
        regions(s, p1, 'lin200', LIN_FINAL);
        points(s, p1, XS, YS);
        header(s, p1, 'linear', '49%', 'red');
        p2.card();
        regions(s, p2, 'net10000', NET_FINAL, 1, 140);
        points(s, p2, XS, YS);
        header(s, p2, '+ one hidden layer', '99%', 'green');
        s.alpha(s.ease('next', 0.6), () => {
          const y = Math.min(h - margin(s) - u * 2, p1.y + p1.size + u * 7);
          pill(s, 'next: convolutional networks', w / 2, y, '--accent', { size: 3.4 });
        });
      });
  },
};

export const scenes3: Record<string, SceneDef> = { 'backprop-net': backpropNet, 'train-net': trainNet, compare, outro };
