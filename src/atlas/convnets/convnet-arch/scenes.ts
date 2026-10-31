import type { Scene, SceneDef } from '../../../lecture/scene';
import { reluGlyph } from '../../networks/draw';
import type { Ink } from '../../../lecture/scene';
import { after, cite } from '../../draw';
import { grid, rich, windowBox } from '../draw';

const caption = (s: Scene, text: string, y: number, k: Ink = '--ink-2', size = 3.6) => s.text(text, s.w / 2, y, { size, font: 'mono', color: s.c(k), halo: true });

const IMG: Ink = 'orange';
const CONV: Ink = 'blue';
const POOL: Ink = 'teal';
const RELU: Ink = 'gold';
const LIN: Ink = 'purple';

/**
 * A block for a (C, H, W) volume: a square face `side` stage units across, extruded up and to
 * the right by `depth` units for the channels. Centered on (cx, cy).
 */
function block(s: Scene, cx: number, cy: number, side: number, depth: number, k: Ink, on = 0): void {
  const u = s.u;
  const S = side * u;
  const d = depth * u * 0.7;
  const x = cx - (S + d) / 2;
  const y = cy - (S - d) / 2;
  const g = s.ctx;
  const fill = (a: number) => s.tint(k, a + 0.14 * on);
  // Top and right faces, then the front.
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + d, y - d);
  g.lineTo(x + S + d, y - d);
  g.lineTo(x + S, y);
  g.closePath();
  g.fillStyle = fill(0.22);
  g.fill();
  g.beginPath();
  g.moveTo(x + S, y);
  g.lineTo(x + S + d, y - d);
  g.lineTo(x + S + d, y + S - d);
  g.lineTo(x + S, y + S);
  g.closePath();
  g.fillStyle = fill(0.3);
  g.fill();
  s.rrect(x, y, S, S, 0.3, { fill: fill(0.14), stroke: s.tint(k, 0.7 + 0.3 * on), lw: 0.3 + 0.2 * on });
  s.line(x, y, x + d, y - d, s.tint(k, 0.7), 0.3);
  s.line(x + S, y, x + S + d, y - d, s.tint(k, 0.7), 0.3);
  s.line(x + S, y + S, x + S + d, y + S - d, s.tint(k, 0.7), 0.3);
  s.line(x + d, y - d, x + S + d, y - d, s.tint(k, 0.7), 0.3);
  s.line(x + S + d, y - d, x + S + d, y + S - d, s.tint(k, 0.7), 0.3);
}

/** Ten class scores as bars on a base line. */
const SCORES = [0.35, 0.6, 0.25, 0.9, 0.4, 0.3, 0.5, 0.2, 0.45, 0.3];
function scoreBars(s: Scene, cx: number, base: number, w: number, h: number, a = 1): void {
  const u = s.u;
  const pitch = (w * u) / 10;
  s.alpha(a, () => {
    s.line(cx - (w * u) / 2, base, cx + (w * u) / 2, base, s.c('--axis'), 0.3);
    SCORES.forEach((v, i) => {
      const hh = v * h * u;
      s.rrect(cx - (w * u) / 2 + i * pitch + pitch * 0.15, base - hh, pitch * 0.7, hh, 0.3, { fill: s.tint(LIN, 0.4), stroke: s.c(LIN), lw: 0.25 });
    });
  });
}

// ---- goal: an image in, ten scores out; why a linear classifier on pixels is not enough

/** Where the ear sits in the 8 by 8 picture, then where it has moved. */
const EAR_A: [number, number] = [1, 1];
const EAR_B: [number, number] = [4, 5];

const goal: SceneDef = {
  draw(s) {
    const u = s.u;
    // The goal, across the top: image -> ? -> ten scores.
    const ty = s.h * 0.17;
    const lx = s.w * 0.2;
    const rx = s.w * 0.78;
    block(s, lx, ty, 13, 2.2, IMG);
    s.text('(3, 32, 32)', lx, ty + 11 * u, { size: 3.1, font: 'mono', color: s.c('--ink-2') });
    s.alpha(s.ease('goal', 0.6, 1.2), () => {
      scoreBars(s, rx, ty + 6 * u, 24, 12);
      s.text('10 scores', rx, ty + 11 * u, { size: 3.1, font: 'mono', color: s.c(LIN) });
      s.arrow(lx + 11 * u, ty, rx - 15 * u, ty, s.c('--ink-3'), 0.4, 2.2);
    });
    const mid = (lx + 11 * u + rx - 15 * u) / 2;
    s.alpha(s.win('goal', 'linear'), () => s.text('?', mid, ty - 4 * u, { size: 5, font: 'mono', weight: 700, color: s.c('--ink-2') }));
    s.alpha(s.win('linear', 'name'), () => s.text('W x + b', mid, ty - 4 * u, { size: 3.6, font: 'mono', weight: 650, color: s.c(LIN), halo: true }));
    s.alpha(s.ease('name', 0.6), () => s.text('ConvNet', mid, ty - 4 * u, { size: 3.6, font: 'mono', weight: 650, color: s.c('--ink'), halo: true }));

    // The picture, a grid of pixels with an ear in it.
    const G = grid(s, s.w / 2, s.h * 0.55, 8, 8, s.tall ? 5.2 : 4.6);
    const moved = s.ease('linear', 0.8, 0.55 * (s.end('linear') - s.at('linear')));
    const ear = (i: number, j: number) => {
      const [ai, aj] = moved > 0.5 ? EAR_B : EAR_A;
      return (i === ai && j === aj) || (i === ai + 1 && j === aj) || (i === ai + 1 && j === aj + 1);
    };
    s.alpha(s.ease('linear', 0.6), () => {
      const w = (G.pitch - 0.8) * u;
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          const on = ear(i, j) ? 1 : 0;
          s.rrect(G.x(j) - w / 2, G.y(i) - w / 2, w, w, 0.4, { fill: on ? s.tint(IMG, 0.75) : s.tint('--ink-3', 0.08), stroke: s.tint('--ink-3', 0.3), lw: 0.2 });
        }
      }
      // The linear classifier's weights that learned the ear: tied to the first place.
      s.alpha(s.win('linear', 'conv'), () => windowBox(s, G, EAR_A[0], EAR_A[1], 2, 2, LIN, 1, 0.5));
      s.alpha(s.win('linear', 'conv') * (1 - moved), () => caption(s, 'weights for these pixels learned the ear', G.b + 5 * u, LIN, s.tall ? 3.2 : 3.5));
      s.alpha(s.win('linear', 'conv') * moved, () => caption(s, 'the ear moved; those weights did not', G.b + 5 * u, 'red', s.tall ? 3.2 : 3.5));
    });

    // The convolution: one filter slid over every position, lighting up on the ear.
    const cp = s.prog('conv');
    s.alpha(s.win('conv', 'relu'), () => {
      const k = Math.min(48, Math.floor(cp * 49));
      const i = Math.floor(k / 7);
      const j = k % 7;
      const hit = i === EAR_B[0] && j === EAR_B[1];
      windowBox(s, G, i, j, 2, 2, hit ? 'green' : CONV, 1, hit ? 0.8 : 0.5);
      caption(s, 'one filter, tried at every position', G.b + 5 * u, CONV, s.tall ? 3.2 : 3.5);
    });

    // The pieces, as a row of named layers.
    const py = s.h * 0.9;
    const names: [string, Ink, string][] = [['conv', CONV, 'conv'], ['ReLU', RELU, 'relu'], ['pool', POOL, 'pool'], ['linear', LIN, 'name']];
    const pw = s.tall ? 17 : 19;
    names.forEach(([t, k, beat], i) => {
      const x = s.w / 2 + (i - 1.5) * (pw + 3) * u;
      const lit = beat === 'name' ? s.ease('name', 0.6) : s.win(beat, beat === 'pool' ? 'name' : names[i + 1]![2]);
      s.alpha(s.ease(beat, 0.6), () => {
        s.rrect(x - (pw / 2) * u, py - 3.6 * u, pw * u, 7.2 * u, 1.4, { fill: s.tint(k, 0.12 + 0.2 * lit), stroke: s.c(k), lw: 0.3 + 0.2 * lit });
        s.text(t, x, py, { size: 3.4, font: 'mono', weight: 650, color: s.c(k) });
        if (i > 0) s.text('→', x - ((pw + 3) / 2) * u, py, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
      });
    });
    s.alpha(s.win('relu', 'pool'), () => reluGlyph(s, s.w / 2, G.b + 5.5 * u, 14, 7, RELU, { on: 1 }));
    s.alpha(s.win('pool', 'name'), () => {
      for (let i = 0; i < 8; i += 2) for (let j = 0; j < 8; j += 2) windowBox(s, G, i, j, 2, 2, POOL, 0.9, 0.35);
      caption(s, 'keep the largest in each 2 × 2 window', G.b + 5 * u, POOL, s.tall ? 3.2 : 3.5);
    });
    s.alpha(s.ease('name', 0.6), () => caption(s, 'ConvNet: a convolutional network', G.b + 5 * u, '--ink', s.tall ? 3.4 : 3.7));
    cite(s, 'LeNet-5 · LeCun, Bottou, Bengio & Haffner, 1998', s.ease('lenet', 0.6));
  },
};

// ---- stages: the shape layer by layer, smaller and deeper

interface Row {
  op: string;
  shape: string;
  C: number;
  S: number;
  k: Ink;
  beat: string;
  delay: number;
}

const ROWS: Row[] = [
  { op: 'image', shape: '(3, 32, 32)', C: 3, S: 32, k: IMG, beat: 'input', delay: 0 },
  { op: 'conv', shape: '(16, 32, 32)', C: 16, S: 32, k: CONV, beat: 'conv', delay: 0.3 },
  { op: 'pool', shape: '(16, 16, 16)', C: 16, S: 16, k: POOL, beat: 'pool', delay: 0.3 },
  { op: 'conv', shape: '(32, 16, 16)', C: 32, S: 16, k: CONV, beat: 'repeat', delay: 0.4 },
  { op: 'pool', shape: '(32, 8, 8)', C: 32, S: 8, k: POOL, beat: 'repeat', delay: 2.6 },
];

const stages: SceneDef = {
  draw(s) {
    const u = s.u;
    // Left to right, sized so the row fits the stage: face from the grid size, depth from the channels.
    // Gaps before each block; the wider ones hold the ReLU after a conv.
    const GAPS = [0, 6, 10, 6, 10];
    const widthAt = (k: number) => ROWS.reduce((t, r, i) => t + (r.S / 32) * 18 * k + 0.7 * (r.C / 32) * 13 * k + GAPS[i]!, 0);
    const k = Math.min(1.15, (s.w / u - 10) / widthAt(1));
    const total = widthAt(k) * u;
    const by = s.h * 0.42;
    let x = s.w / 2 - total / 2;
    const pos = ROWS.map((r, i) => {
      const face = (r.S / 32) * 18 * k;
      const depth = (r.C / 32) * 13 * k;
      const w = face + 0.7 * depth;
      x += GAPS[i]! * u;
      const p = { cx: x + (w / 2) * u, l: x, r: x + w * u, face, depth };
      x += w * u;
      return p;
    });
    let cur = 0;
    ROWS.forEach((r, i) => {
      if (s.ease(r.beat, 0.4, r.delay) > 0.5) cur = i;
    });
    const deeper = s.ease('deeper', 0.6);
    // Half the tallest block (the first conv), for one row of labels above and one below.
    const half = ((18 + 0.7 * 6.5) / 2) * k * u;
    ROWS.forEach((r, i) => {
      const a = s.ease(r.beat, 0.6, r.delay);
      const P = pos[i]!;
      const on = (i === cur ? 1 : 0) * (1 - deeper);
      s.alpha(a * (on || deeper ? 1 : 0.55), () => {
        if (i > 0) s.arrow(pos[i - 1]!.r + 1.2 * u, by, P.l - 1.2 * u, by, s.c('--ink-3'), 0.3, 1.4);
        block(s, P.cx, by, P.face, P.depth, r.k, on);
        s.text(r.op, P.cx, by - half - 4 * u, { size: 3.2, font: 'mono', weight: 650, color: s.c(r.k) });
        const unknown = r.beat === 'conv' && s.since('pad') < 0;
        const low = by + half + 4 * u;
        s.text(`${r.C} ch`, P.cx, low, { size: 3, font: 'mono', weight: 600, color: s.c(on ? r.k : '--ink-2') });
        s.text(unknown ? '?' : `${r.S}×${r.S}`, P.cx, low + 4.2 * u, { size: 3, font: 'mono', color: s.c(on ? '--ink' : '--ink-2') });
      });
    });
    // The ReLU after each conv, on the arrow: the shape passes through unchanged.
    [1, 3].forEach((i) => {
      const beat = i === 1 ? 'relu' : 'repeat';
      const delay = i === 1 ? 0.2 : 1.5;
      const ax = (pos[i]!.r + pos[i + 1]!.l) / 2;
      s.alpha(s.ease(beat, 0.6, delay), () => s.text('ReLU', ax, by - 3.4 * u, { size: 2.7, font: 'mono', weight: 650, color: s.c(RELU), halo: true }));
    });

    // The current shape, written out.
    const ty = s.h * 0.74;
    const row = ROWS[cur]!;
    const shape = row.beat === 'conv' && s.since('pad') < 0 ? '(16, ?, ?)' : row.shape;
    const sz = s.tall ? 3.2 : 3.6;
    s.alpha(s.ease('input', 0.6) * (1 - s.win('nopad', 'repeat')) * (1 - deeper), () => rich(s, [[`${row.op}:  `, row.k], [shape, '--ink']], s.w / 2, ty, { size: 4.2, weight: 650 }));
    s.alpha(s.win('nopad', 'repeat'), () => rich(s, [['no padding:  ', '--ink-3'], ['(16, 30, 30)', CONV], [' → ', '--ink-3'], ['(16, 15, 15)', POOL]], s.w / 2, ty, { size: s.tall ? 3.4 : 4, weight: 650 }));
    s.alpha(deeper, () => rich(s, [['(3, 32, 32)', IMG], ['  →  ', '--ink-3'], ['(32, 8, 8)', POOL]], s.w / 2, ty, { size: 4.2, weight: 650 }));

    const cy = s.h * 0.9;
    s.alpha(s.win('input', 'conv'), () => caption(s, 'channels first, then height and width', cy, IMG, sz));
    s.alpha(s.win('conv', 'pad'), () => caption(s, '16 filters → 16 channels', cy, CONV, sz));
    s.alpha(s.win('pad', 'relu'), () => caption(s, 'padding 1: 32 − 3 + 2 + 1 = 32', cy, CONV, sz));
    s.alpha(s.win('relu', 'pool'), () => caption(s, 'ReLU: entry by entry, same shape', cy, RELU, sz));
    s.alpha(s.win('pool', 'nopad'), () => caption(s, 'conv, ReLU, pool: one stage', cy, POOL, sz));
    s.alpha(s.win('nopad', 'repeat'), () => caption(s, '32 − 3 + 1 = 30, and the pool halves it', cy, '--ink-2', sz));
    s.alpha(s.win('repeat', 'deeper'), () => caption(s, 'stage 2: 32 channels, 8 × 8', cy, CONV, sz));
    s.alpha(deeper, () => caption(s, 'smaller and deeper: fewer places, more patterns', cy, '--ink', s.tall ? 3 : 3.5));
  },
};

// ---- head: flatten to one vector, then a fully connected layer to ten scores

const head: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    const by = s.h * 0.14;
    block(s, cx, by, 6, 8, POOL);
    s.text('(32, 8, 8)', cx + 12 * u, by, { size: 3.2, font: 'mono', align: 'left', color: s.c('--ink-2') });

    // Flatten: one long row of numbers.
    const fy = s.h * 0.36;
    const fl = s.ease('flatten', 0.8, 0.4);
    const x0 = 8 * u;
    const x1 = s.w - 8 * u;
    s.alpha(fl, () => {
      s.arrow(cx, by + 7 * u, cx, fy - 4 * u, s.c('--ink-3'), 0.3, 1.8);
      s.text('flatten', cx + 2 * u, (by + fy) / 2 + 1.5 * u, { size: 3, font: 'mono', align: 'left', color: s.c(POOL) });
      const w = (x1 - x0) * fl;
      const l = cx - w / 2;
      s.rrect(l, fy - 1.6 * u, w, 3.2 * u, 0.6, { fill: s.tint(POOL, 0.3), stroke: s.tint(POOL, 0.8), lw: 0.3 });
      for (let k = 1; k < 32; k++) s.line(l + (w * k) / 32, fy - 1.6 * u, l + (w * k) / 32, fy + 1.6 * u, s.tint(POOL, 0.5), 0.15);
      s.alpha(s.ease('flatten', 0.6, 1.6), () => rich(s, [['32 × 8 × 8 = ', '--ink-2'], ['2,048', POOL]], cx, fy + 5.5 * u, { size: 3.5, weight: 600 }));
    });

    // Fully connected: every score wired to every entry.
    const sy = s.h * 0.7;
    const fc = s.ease('fc', 0.8);
    const sw = Math.min(64, (s.w / u) * 0.66);
    const pitch = (sw * u) / 10;
    const sx = (k: number) => cx - (sw * u) / 2 + (k + 0.5) * pitch;
    s.alpha(fc, () => {
      for (let k = 0; k < 10; k++) {
        for (let e = 0; e <= 16; e++) {
          const ex = x0 + ((x1 - x0) * e) / 16;
          s.line(ex, fy + 9 * u, sx(k), sy - 4.5 * u, s.tint(LIN, k === 3 ? 0.55 : 0.12), k === 3 ? 0.22 : 0.12);
        }
      }
      scoreBars(s, cx, sy + 2 * u, sw, 6);
      s.text('10 scores', cx, sy + 6 * u, { size: 3.2, font: 'mono', color: s.c(LIN) });
    });
    s.alpha(s.win('fc', 'names'), () => caption(s, 'each score: 2,048 weights + a bias', s.h * 0.84, LIN, s.tall ? 3.3 : 3.6));
    s.alpha(s.win('names', 'order'), () => rich(s, [['nn.Linear', LIN], [' = linear layer = fully connected', '--ink-2']], cx, s.h * 0.84, { size: s.tall ? 3 : 3.5 }));

    // The order, as a row of layers: grids first, then a vector.
    const oy = s.h * 0.93;
    s.alpha(s.ease('order', 0.6), () => {
      const runs: [string, Ink][] = [['conv', CONV], [' → ', '--ink-3'], ['ReLU', RELU], [' → ', '--ink-3'], ['pool', POOL], [' … ', '--ink-3'], ['flatten', POOL], [' → ', '--ink-3'], ['linear', LIN]];
      rich(s, runs, cx, oy, { size: s.tall ? 3.1 : 3.6, weight: 600 });
      s.alpha(after(s, 'order', 0.35), () => caption(s, 'grids first, then one vector', s.h * 0.84, '--ink-2', s.tall ? 3.2 : 3.5));
    });
  },
};

// ---- count: parameters per layer, and how lopsided the total is

const PARAMS: [string, number, Ink, string][] = [
  ['conv 1', 448, CONV, 'c1'],
  ['conv 2', 4640, CONV, 'c2'],
  ['linear', 20490, LIN, 'lin'],
];
const fmtN = (n: number) => n.toLocaleString('en-US');

const SUMS: [string, string, Ink, string][] = [
  ['filter  ', '3·3·3 + 1 = 28', CONV, 'one'],
  ['conv 1  ', '16 × 28 = 448', CONV, 'c1'],
  ['conv 2  ', '32 × (3·3·16 + 1) = 4,640', CONV, 'c2'],
  ['linear  ', '2,048 × 10 + 10 = 20,490', LIN, 'lin'],
  ['total   ', '25,578', '--ink', 'most'],
];

const count: SceneDef = {
  draw(s) {
    const o = { size: s.tall ? 3.2 : 3.6, weight: 600 };
    const wide = Math.max(...SUMS.map(([a, b]) => s.measure(a + b, { ...o, font: 'mono' })));
    const x0 = s.w / 2 - wide / 2;
    let cur = 0;
    SUMS.forEach(([, , , beat], i) => {
      if (s.ease(beat, 0.4) > 0.5) cur = i;
    });
    SUMS.forEach(([name, sum, k, beat], i) => {
      const y = s.h * (0.1 + i * 0.085);
      s.alpha(s.ease(beat, 0.6), () => rich(s, [[name, k], [sum, i === cur ? '--ink' : '--ink-2']], x0, y, { ...o, align: 'left' }));
    });
    // One first-layer filter: a 3 × 3 patch through all 3 channels, plus its bias.
    s.alpha(s.win('one', 'c1'), () => {
      const fy = s.h * 0.68;
      const fx = s.w / 2 - 18 * s.u;
      block(s, fx, fy, 11, 6, CONV);
      s.text('3 × 3 × 3', fx, fy + 11 * s.u, { size: 3.2, font: 'mono', color: s.c(CONV) });
      s.alpha(after(s, 'one', 0.45), () => rich(s, [['27 weights', CONV], [' + 1 bias', 'green']], fx + 11 * s.u, fy - 3 * s.u, { size: 3.5, weight: 600, align: 'left' }));
      s.alpha(after(s, 'one', 0.75), () => rich(s, [['= 28', '--ink']], fx + 11 * s.u, fy + 4 * s.u, { size: 3.8, weight: 650, align: 'left' }));
    });
    const max = PARAMS[2]![1];
    const lx = s.w * 0.22;
    const span = s.w * 0.5;
    PARAMS.forEach(([name, n, k, beat], i) => {
      const by = s.h * (0.6 + i * 0.09);
      const a = s.ease(beat, 0.5, 0.8);
      s.alpha(a, () => {
        const on = i === 2 ? s.ease('most', 0.6) : 0;
        s.text(name, lx - 2.5 * s.u, by, { size: 3.3, font: 'mono', align: 'right', color: s.c(k) });
        s.rrect(lx, by - 1.8 * s.u, Math.max(0.6 * s.u, (span * n * a) / max), 3.6 * s.u, 0.6, { fill: s.tint(k, 0.3 + 0.35 * on), stroke: s.tint(k, 0.7 + 0.3 * on), lw: 0.3 });
        s.text(fmtN(n), lx + Math.max(0.6 * s.u, (span * n) / max) + 2 * s.u, by, { size: 3.3, font: 'mono', weight: 600, align: 'left', color: s.c(k), halo: true });
      });
    });
    const cy = s.h * 0.9;
    s.alpha(s.win('most', 'alexnet'), () => caption(s, '20,490 / 25,578 ≈ 80% in the last layer', cy, '--ink-2', s.tall ? 3.1 : 3.4));
    s.alpha(s.ease('alexnet', 0.6), () => caption(s, 'AlexNet: 60 million; each conv layer at most 1%', cy, '--ink-2', s.tall ? 3.1 : 3.4));
    cite(s, 'AlexNet · Krizhevsky, Sutskever & Hinton, 2012', s.ease('alexnet', 0.6));
  },
};

export const scenes: Record<string, SceneDef> = { goal, stages, head, count };
