import { fmt } from '../../core/code';
import { Rng } from '../../core/rand';
import { type Scene, type SceneDef, clamp01 } from '../../lecture/scene';
import { cifar } from './data';
import { type K, arc, box, chip, chipWidth, cross, dashed, depthVec, frame, pic, slices, wire } from './kit';

// ---------------------------------------------------------------- size

interface RowState {
  N: number;
  F: number;
  S: number;
  P: number;
  /** Placements shown so far (fractional while they appear). */
  shown: number;
}

/** One row of the input, every placement of the filter, and the output cells they produce. */
function sizeRow(s: Scene, st: RowState): void {
  const { w, u } = s;
  const { N, F, S, P } = st;
  const tot = N + 2 * P;
  const room = N - F + 2 * P;
  const ok = room % S === 0;
  const fits = Math.floor(room / S) + 1;
  const n = ok ? fits : fits + 1;
  const c = Math.min(9 * u, (w - 14 * u) / 9.4);
  const x0 = w / 2 - (tot * c) / 2;
  const yIn = 23 * u;
  s.text(`N = ${N}   F = ${F}   S = ${S}   P = ${P}`, w / 2, 14 * u, { size: 3.6, font: 'mono', weight: 600, color: s.c('slate') });
  for (let q = 0; q < tot; q++) {
    const pad = q < P || q >= P + N;
    if (pad) {
      dashed(s, x0 + q * c + 0.2 * u, yIn + 0.2 * u, c - 0.4 * u, c - 0.4 * u, s.c('--ink-3'), 0.25);
      s.text('0', x0 + (q + 0.5) * c, yIn + c / 2 + 0.2 * u, { size: 3, font: 'mono', color: s.c('--ink-3') });
    } else s.cell(x0 + q * c, yIn, c, c, '', 'gold', { on: 0.2 });
    s.text(String(q), x0 + (q + 0.5) * c, yIn - 2.4 * u, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
  }
  const yP = yIn + c + 3 * u;
  const step = Math.min(3.6 * u, (28 * u) / Math.max(1, n));
  const yO = yP + n * step + 3 * u;
  for (let k = 0; k < n; k++) {
    const a = clamp01(st.shown - k);
    if (a <= 0) continue;
    const start = k * S;
    const over = start + F > tot;
    s.alpha(a, () => {
      const y = yP + k * step;
      s.rrect(x0 + start * c + 0.3 * u, y, F * c - 0.6 * u, step * 0.68, 0.6, { fill: s.tint(over ? 'red' : 'slate', over ? 0.35 : 0.45), stroke: over ? s.c('red') : undefined, lw: 0.35 });
      if (over) {
        dashed(s, x0 + tot * c, yIn, (start + F - tot) * c, c, s.c('red'), 0.35);
        cross(s, x0 + (start + F) * c + 3 * u, y + step * 0.34, 1.8 * u);
      } else s.cell(x0 + (start + F / 2) * c - c * 0.42, yO, c * 0.84, c * 0.84, '', 'purple', { on: 0.6 });
    });
  }
  s.text('output', x0 - 2 * u, yO + c * 0.42, { size: 3, align: 'right', color: s.c('purple') });
  const val = room / S + 1;
  const res = ok ? String(val) : fmt(val, 3);
  const line = `(${N} − ${F} + ${2 * P}) / ${S} + 1 = ${res}`;
  s.alpha(clamp01(st.shown - n + 1), () => s.text(line, w / 2, yO + c + 6 * u, { size: 4, font: 'mono', weight: 600, color: s.c(ok ? 'purple' : 'red') }));
  s.slot('N', N);
  s.slot('F', F);
  s.slot('S', S);
  s.slot('P', P);
  s.slot('nout', ok ? val : 'error');
}

/** A small card naming one hyperparameter. */
function hyperCard(s: Scene, x: number, y: number, cw: number, ch: number, title: string, k: K, on: number, icon: () => void, caption: string): void {
  s.rrect(x, y, cw, ch, 2, { fill: s.tint(k, 0.05 + 0.08 * on), stroke: s.tint(k, 0.3 + 0.6 * on), lw: 0.3 + 0.2 * on });
  s.text(title, x + cw / 2, y + 5.5 * s.u, { size: 3.8, font: 'display', weight: 600, color: s.c(k) });
  icon();
  s.text(caption, x + cw / 2, y + ch - 4.5 * s.u, { size: 3.1, font: 'mono', color: s.c('--ink-2') });
}

const size: SceneDef = {
  marks: {
    formula: { tex: String.raw`N_{\text{out}} = \dfrac{\symN - \symF + 2\symP}{\symS} + 1`, x: 0.5, y: 0.88, size: 4.4 },
    same: { tex: String.raw`\symP = \dfrac{\symF - 1}{2}`, x: 0.5, y: 0.88, size: 4.4 },
    alex: { tex: String.raw`\dfrac{227 - 11 + 0}{4} + 1 = 55`, x: 0.5, y: 0.84, size: 4.8 },
  },
  draw(s) {
    const { w, u } = s;
    // Phase 1: the three knobs.
    const p1 = s.win('three', 'row');
    if (p1 > 0) {
      s.alpha(p1, () => {
        const cw = Math.min(34 * u, (w - 16 * u) / 3);
        const ch = 46 * u;
        const gap = 3 * u;
        const x0 = w / 2 - (3 * cw + 2 * gap) / 2;
        const y = 26 * u;
        s.text('three settings', w / 2, 16 * u, { size: 4.4, italic: true, color: s.c('--ink-2') });
        const onK = s.win('K', 'S', 0.4);
        const onS = s.win('S', 'P', 0.4);
        const onP = s.ease('P', 0.4);
        // K: a stack of activation maps
        s.alpha(s.ease('three', 0.5, 0.3), () =>
          hyperCard(s, x0, y, cw, ch, 'depth K', 'teal', onK, () => {
            const sz = Math.min(14 * u, cw * 0.45);
            const nK = 1 + Math.round(3 * s.ease('K', 1.5, 0.3));
            slices(s, x0 + cw / 2 - sz * 0.75, y + ch / 2 - sz * 0.35, sz, sz, nK, 9 * u * (nK - 1) / 3, (i, sx, sy) => s.rrect(sx, sy, sz, sz, 0.6, { fill: s.tint('teal', 0.12 + 0.05 * i), stroke: s.c('teal'), lw: 0.3 }));
          }, ((n) => `K = ${n} map${n > 1 ? 's' : ''}`)(1 + Math.round(3 * s.ease('K', 1.5, 0.3)))),
        );
        // S: hops along a row
        const S = s.since('S') >= 0 && s.prog('S') > 0.5 ? 2 : 1;
        s.alpha(s.ease('three', 0.5, 0.6), () =>
          hyperCard(s, x0 + cw + gap, y, cw, ch, 'stride S', 'slate', onS, () => {
            const cc = Math.min(4 * u, (cw - 4 * u) / 7);
            const rx = x0 + cw + gap + cw / 2 - 3.5 * cc;
            const ry = y + ch / 2 + u;
            for (let q = 0; q < 7; q++) s.cell(rx + q * cc, ry, cc, cc, '', 'gold', { on: 0.1 });
            for (let q = 0; q + S < 7; q += S) arc(s, rx + (q + 0.5) * cc, ry - 0.5 * u, rx + (q + S + 0.5) * cc, ry - 0.5 * u, -2.2 * u * S, s.c('slate'), 0.35);
          }, `S = ${S}`),
        );
        // P: a ring of zeros
        s.alpha(s.ease('three', 0.5, 0.9), () =>
          hyperCard(s, x0 + 2 * (cw + gap), y, cw, ch, 'padding P', 'slate', onP, () => {
            const cc = Math.min(3.6 * u, (cw - 6 * u) / 6);
            const gx = x0 + 2 * (cw + gap) + cw / 2 - 3 * cc;
            const gy = y + ch / 2 - 3 * cc + u;
            const ring = s.ease('P', 0.6, 0.4);
            for (let a = 0; a < 6; a++)
              for (let b = 0; b < 6; b++) {
                const pad = a === 0 || b === 0 || a === 5 || b === 5;
                if (pad) s.alpha(ring, () => s.text('0', gx + (b + 0.5) * cc, gy + (a + 0.5) * cc + 0.2 * u, { size: 2.6, font: 'mono', color: s.c('--ink-3') }));
                else s.cell(gx + b * cc, gy + a * cc, cc, cc, '', 'gold', { on: 0.1 });
              }
            s.alpha(ring, () => dashed(s, gx, gy, 6 * cc, 6 * cc, s.c('--ink-3'), 0.25));
          }, `P = ${s.since('P') >= 0 && s.ease('P', 0.6, 0.4) > 0.5 ? 1 : 0}`),
        );
      });
    }

    // Phase 2: one row, every placement.
    const p2 = s.win('row', 'alex');
    if (p2 > 0) {
      let st: RowState = { N: 7, F: 3, S: 1, P: 0, shown: 1 };
      if (s.since('slide') >= 0) st = { N: 7, F: 3, S: 1, P: 0, shown: 1 + s.prog('slide') * 1.25 * 4 };
      if (s.since('two') >= 0) st = { N: 7, F: 3, S: 2, P: 0, shown: s.prog('two') * 1.4 * 3 };
      if (s.since('formula') >= 0) st = { N: 7, F: 3, S: 2, P: 1, shown: 0.5 + s.prog('formula') * 1.6 * 4 };
      if (s.since('bad') >= 0) st = { N: 7, F: 3, S: 3, P: 0, shown: 0.5 + s.prog('bad') * 1.5 * 3 };
      if (s.since('same') >= 0) st = { N: 7, F: 3, S: 1, P: 1, shown: 0.5 + s.prog('same') * 1.5 * 7 };
      s.alpha(p2, () => sizeRow(s, st));
      s.show('formula', p2 * s.win('formula', 'same'));
      s.show('same', p2 * s.ease('same', 0.6, 0.3));
    }

    // Phase 3: AlexNet's first layer.
    const p3 = s.ease('alex', 0.6);
    if (p3 > 0) {
      s.alpha(p3, () => {
        const face = 36 * u;
        const ix = w / 2 - 46 * u;
        const iy = 22 * u;
        box(s, ix, iy, face, face, 4 * u, 'orange', { fill: 0.12 });
        wire(s, ix + face * 0.42, iy + face * 0.3, 4.5 * u, 4.5 * u, 4 * u, 'blue', 0.45, 0.35);
        s.text('227 × 227 × 3', ix + face / 2, iy + face + 4.5 * u, { size: 3.4, font: 'mono', color: s.c('orange') });
        s.text('96 filters, 11 × 11 × 3, S = 4, P = 0', w / 2, 13 * u, { size: 3.4, font: 'mono', color: s.c('blue') });
        const oA = s.ease('alex2', 0.7, 2.2);
        const ox = w / 2 + 12 * u;
        const oy = iy + face / 2 - 7 * u + 6 * u;
        s.alpha(oA, () => {
          s.arrow(ix + face + 5 * u, iy + face / 2, ox - 2 * u, iy + face / 2, s.c('--ink-3'), 0.5);
          slices(s, ox, oy, 14 * u, 14 * u, 16, 26 * u, (i, sx, sy) => s.rrect(sx, sy, 14 * u, 14 * u, 0.3, { fill: s.tint('purple', 0.1 + 0.012 * i), stroke: s.tint('purple', 0.6), lw: 0.2 }));
          s.text('55 × 55 × 96', ox + 7 * u, oy + 14 * u + 4.5 * u, { size: 3.6, font: 'mono', weight: 650, color: s.c('purple') });
        });
        s.show('alex', p3 * s.ease('alex2', 0.6, 0.2));
      });
    }
  },
};

// ---------------------------------------------------------------- sharing

let ownCv: HTMLCanvasElement | null = null;
/** 55 x 55 neurons, each tinted by weights of its own. */
function ownWeights(): HTMLCanvasElement {
  if (ownCv) return ownCv;
  const rng = new Rng(17);
  const c = document.createElement('canvas');
  c.width = c.height = 55;
  const img = new ImageData(55, 55);
  for (let p = 0; p < 55 * 55; p++) {
    const v = rng.uniform(0, 1);
    img.data[p * 4] = 60 + 150 * v;
    img.data[p * 4 + 1] = 90 + 120 * rng.uniform(0, 1);
    img.data[p * 4 + 2] = 150 + 100 * rng.uniform(0, 1);
    img.data[p * 4 + 3] = 255;
  }
  c.getContext('2d')!.putImageData(img, 0, 0);
  ownCv = c;
  return c;
}

/** A small grid icon of a filter's weights. */
function filterIcon(s: Scene, x: number, y: number, size: number, n: number, seed: number, k: K = 'blue'): void {
  const rng = new Rng(seed);
  const cs = size / n;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) s.rrect(x + j * cs + 0.08 * s.u, y + i * cs + 0.08 * s.u, cs - 0.16 * s.u, cs - 0.16 * s.u, 0.2, { fill: s.tint(k, 0.12 + 0.6 * rng.uniform(0, 1)) });
  s.rrect(x, y, size, size, 0.4, { stroke: s.c(k), lw: 0.3 });
}

const sharing: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const P = cifar(s);
    // Phases 1 and 3: the 55 x 55 grid of neurons and the parameter count.
    const gA = s.win('naive', 'assume') + s.win('share', 'name');
    if (gA > 0) {
      s.alpha(Math.min(1, gA), () => {
        const shared = s.since('share') >= 0;
        const face = 40 * u;
        const gx = w / 2 - 48 * u;
        const gy = 26 * u;
        const [dx, dy] = depthVec(14 * u);
        box(s, gx, gy, face, face, 14 * u, 'purple', { fill: 0.1, front: false });
        const mix = shared ? s.ease('share', 1.2, 0.3) : 0;
        pic(s, ownWeights(), gx, gy, face, face);
        s.alpha(mix, () => s.rrect(gx, gy, face, face, 0.2, { fill: s.tint('blue', 0.55) }));
        s.rrect(gx, gy, face, face, 0.2, { stroke: s.c('purple'), lw: 0.35 });
        s.text('55 × 55 positions', gx + face / 2, gy + face + 4.5 * u, { size: 3.2, font: 'mono', color: s.c('--ink-2') });
        s.text('× 96 maps', gx + face + dx + 1.5 * u, gy + dy + 1.5 * u, { size: 3.2, font: 'mono', color: s.c('--ink-2'), align: 'left' });
        s.text(shared ? 'one filter per map' : 'every neuron: its own weights', gx + face / 2, gy - 9 * u, { size: 3.4, italic: true, color: s.c(shared ? 'blue' : '--ink-2') });
        if (shared) s.alpha(s.ease('share', 0.6, 0.8), () => filterIcon(s, gx + face / 2 - 4 * u, gy + face / 2 - 4 * u, 8 * u, 11, 3));
        // the count
        const tx = w / 2 + 6 * u;
        const lines: [string, K, number, number][] = shared
          ? [
              ['96 filters × 363', '--ink-2', 3.6, s.ease('count', 0.5)],
              ['+ 96 biases', '--ink-2', 3.6, s.ease('count', 0.5, 0.8)],
              ['= 34,944', 'blue', 5.2, s.ease('count', 0.5, 1.6)],
            ]
          : [
              ['55 × 55 × 96', '--ink-2', 3.6, s.ease('naive', 0.5, 0.3)],
              ['= 290,400 neurons', 'purple', 3.6, s.ease('naive', 0.5, 1.6)],
              ['× (363 + 1)', '--ink-2', 3.6, s.ease('naive', 0.5, 3.4)],
              ['= 105,705,600', 'red', 5.2, s.ease('total', 0.5)],
            ];
        lines.forEach(([t, k, sz, a], i) => s.alpha(a, () => s.text(t, tx, 32 * u + i * 9 * u, { size: sz, font: 'mono', weight: sz > 4 ? 700 : 500, color: s.c(k), align: 'left' })));
        s.alpha(shared ? 0 : s.ease('total', 0.5, 0.6), () => s.text('parameters, one layer', tx, 32 * u + 4 * 9 * u - 2 * u, { size: 3.2, italic: true, color: s.c('red'), align: 'left' }));
        s.alpha(shared ? s.ease('ratio', 0.6) : 0, () => {
          s.text('3,025× fewer', tx, 32 * u + 3 * 9 * u + 2 * u, { size: 4.6, font: 'display', weight: 650, color: s.c('--accent'), align: 'left' });
          s.text('= 55 × 55 positions', tx, 32 * u + 4 * 9 * u, { size: 3.2, font: 'mono', color: s.c('--accent'), align: 'left' });
        });
      });
    }
    // Phase 2: an edge is an edge, top or bottom.
    const aA = s.win('assume', 'share');
    if (aA > 0) {
      s.alpha(aA, () => {
        const isz = 46 * u;
        const ix = w / 2 - isz - 4 * u;
        const iy = 20 * u;
        if (P) pic(s, P.truckC, ix, iy, isz, isz);
        s.rrect(ix, iy, isz, isz, 0.4, { stroke: s.c('--rule'), lw: 0.3 });
        const ps = isz / 32;
        const spots: [number, number][] = [
          [6, 10],
          [P?.hit[0] ?? 23, P?.hit[1] ?? 23],
        ];
        const fx = w / 2 + 16 * u;
        const fy = iy + isz / 2 - 6 * u;
        filterIcon(s, fx, fy, 12 * u, 3, 9);
        s.text('one filter W', fx + 6 * u, fy - 3.5 * u, { size: 3.4, color: s.c('blue') });
        spots.forEach(([r, c], i) => {
          const a = s.ease('assume', 0.5, 1 + i * 1.6);
          s.alpha(a, () => {
            frame(s, ix + (c - 1) * ps, iy + (r - 1) * ps, 3 * ps, 3 * ps, 'orange', 0.5, 0.1);
            s.line(ix + (c + 2) * ps + u, iy + (r + 0.5) * ps, fx - u, fy + 6 * u, s.tint('blue', 0.6), 0.3, [0.8, 0.6]);
          });
        });
        s.alpha(s.ease('assume', 0.6, 4), () => s.text('an edge is an edge, top or bottom', w / 2, iy + isz + 7 * u, { size: 3.8, italic: true, color: s.c('--ink-2') }));
      });
    }
    // Phase 4: one filter slid along a row is a convolution; its gradients add up.
    const cA = s.win('name', 'numpy');
    if (cA > 0) {
      s.alpha(cA, () => {
        const n = 9;
        const c = Math.min(9 * u, (w - 16 * u) / n);
        const x0 = w / 2 - (n * c) / 2;
        const yIn = 18 * u;
        const yO = yIn + c + 12 * u;
        const nOut = n - 2;
        const pos = Math.min(nOut - 1, Math.floor(s.prog('name') * 1.3 * nOut));
        const vals = [2, 0, 1, 3, 1, 0, 2, 1, 3];
        const wv = [1, 0, -1];
        for (let q = 0; q < n; q++) s.cell(x0 + q * c, yIn, c, c, String(vals[q]), 'orange', { size: 3.4, on: s.since('grad') < 0 && q >= pos && q < pos + 3 ? 0.8 : 0 });
        s.alpha(1 - s.ease('grad', 0.5), () => {
          for (let t = 0; t < 3; t++) s.cell(x0 + (pos + t) * c, yIn + c + 1.5 * u, c, c * 0.62, String(wv[t]), 'blue', { on: 1, size: 3 });
        });
        for (let q = 0; q < nOut; q++) {
          const v = vals[q]! * wv[0]! + vals[q + 1]! * wv[1]! + vals[q + 2]! * wv[2]!;
          const shown = s.since('grad') >= 0 || q <= pos;
          s.cell(x0 + (q + 1) * c, yO, c, c, shown ? String(v) : '', 'purple', { on: q === pos && s.since('grad') < 0 ? 1 : 0.2, size: 3.4 });
        }
        s.text('one filter, slid everywhere: a convolution', w / 2, yO + c + 6 * u, { size: 3.6, italic: true, color: s.c('--ink-2') });
        // gradients from every position flow into the one shared filter
        const gA2 = s.ease('grad', 0.6);
        s.alpha(gA2, () => {
          const bx = w / 2 - 14 * u;
          const by = 80 * u;
          for (let q = 0; q < nOut; q++) {
            const a = s.ease('grad', 0.4, 0.4 + q * 0.25);
            s.alpha(a, () => s.arrow(x0 + (q + 1.5) * c, yO + c + 9.5 * u, w / 2 + (q - 3) * 2 * u, by - 1.2 * u, s.tint('teal', 0.8), 0.35, 2));
          }
          s.rrect(bx, by, 28 * u, 8 * u, 1.5, { fill: s.tint('teal', 0.15), stroke: s.c('teal'), lw: 0.4 });
          s.text('dW: one sum', w / 2, by + 4.2 * u, { size: 3.4, font: 'mono', weight: 650, color: s.c('teal') });
        });
      });
    }
    // Phase 5: the NumPy view, V is 11 x 11 x 4.
    const nA = s.win('numpy', 'local');
    if (nA > 0) {
      s.alpha(nA, () => {
        const c = Math.min(4.4 * u, (w / 2 - 14 * u) / 11);
        const vx = w / 2 - 11 * c - 4 * u;
        const vy = 20 * u;
        let r0 = 0;
        let mapK = 0;
        let filled = 1;
        if (s.since('steps') >= 0) {
          const k = Math.min(2, Math.floor(s.prog('steps') * 1.3 * 3));
          r0 = k * 2;
          filled = k + 1;
        }
        if (s.since('map1') >= 0) {
          r0 = 0;
          mapK = 1;
          filled = 3;
        }
        for (let a = 0; a < 11; a++) {
          for (let b = 0; b < 11; b++) s.rrect(vx + b * c + 0.1 * u, vy + a * c + 0.1 * u, c - 0.2 * u, c - 0.2 * u, 0.3, { fill: s.tint('orange', 0.07 + ((a * 7 + b * 3) % 5) * 0.04) });
          s.text(String(a), vx - 2.2 * u, vy + (a + 0.5) * c, { size: 2.6, font: 'mono', color: s.c('--ink-3') });
        }
        s.text('V: 11 × 11 × 4', vx + 5.5 * c, vy - 3 * u, { size: 3.2, font: 'mono', color: s.c('orange') });
        frame(s, vx, vy + r0 * c, 5 * c, 5 * c, mapK ? 'teal' : 'blue', 0.6, 0.1);
        const ox = w / 2 + 4 * u;
        const oc = Math.min(5 * u, (w / 2 - 16 * u) / 8.4);
        for (let k = 0; k < 2; k++) {
          const gx = ox + k * (4 * oc + 4 * u);
          s.text(`A[:, :, ${k}]`, gx + 2 * oc, vy - 3 * u, { size: 3, font: 'mono', color: s.c('purple') });
          for (let a = 0; a < 4; a++)
            for (let b = 0; b < 4; b++) {
              const on = b === 0 && ((k === 0 && a < filled) || (k === 1 && mapK === 1 && a === 0));
              const cur = b === 0 && k === mapK && a === r0 / 2;
              s.cell(gx + b * oc, vy + a * oc, oc, oc, '', 'purple', { on: cur ? 1 : on ? 0.4 : 0 });
            }
        }
        const expr = `V[${r0 === 0 ? '' : r0}:${r0 + 5}, :5, :] * W${mapK}`;
        s.text(expr, w / 2, vy + 11 * c + 7 * u, { size: 3.8, font: 'mono', weight: 600, color: s.c(mapK ? 'teal' : 'blue') });
        s.text(`→ A[${r0 / 2}, 0, ${mapK}]`, w / 2, vy + 11 * c + 13 * u, { size: 3.6, font: 'mono', color: s.c('purple') });
      });
    }
    // Phase 6: a centered face wants different weights in different places.
    const lA = s.ease('local', 0.6);
    if (lA > 0) {
      s.alpha(lA, () => {
        const r = 23 * u;
        const fx = w / 2 - 26 * u;
        const fy = 46 * u;
        s.circle(fx, fy, r, { fill: s.tint('gold', 0.12), stroke: s.c('--ink-3'), lw: 0.4 });
        s.circle(fx - 7 * u, fy - 5 * u, 2 * u, { fill: s.c('--ink-2') });
        s.circle(fx + 7 * u, fy - 5 * u, 2 * u, { fill: s.c('--ink-2') });
        arc(s, fx - 7 * u, fy + 8 * u, fx + 7 * u, fy + 8 * u, 4 * u, s.c('--ink-2'), 0.5, false);
        const eyeA = s.ease('local', 0.5, 2.5);
        const mouthA = s.ease('local', 0.5, 3.5);
        s.alpha(eyeA, () => {
          frame(s, fx - 12 * u, fy - 10 * u, 24 * u, 10 * u, 'blue', 0.5, 0);
          s.text('eye filter', fx, fy - 13 * u - r * 0.1, { size: 3.2, color: s.c('blue'), halo: true });
        });
        s.alpha(mouthA, () => {
          frame(s, fx - 10 * u, fy + 4 * u, 20 * u, 9 * u, 'teal', 0.5, 0);
          s.text('mouth filter', fx, fy + 16.5 * u, { size: 3.2, color: s.c('teal'), halo: true });
        });
        s.alpha(s.ease('local', 0.6, 5), () => {
          const tx = w / 2 + 2 * u;
          s.text('own weights', tx, 40 * u, { size: 4.2, font: 'display', weight: 600, align: 'left' });
          s.text('in each place:', tx, 47 * u, { size: 4.2, font: 'display', weight: 600, align: 'left' });
          s.text('locally connected', tx, 56 * u, { size: 3.6, italic: true, color: s.c('--accent'), align: 'left' });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- more

const X4 = [
  [3, 1, 4, 1],
  [5, 9, 2, 6],
  [5, 3, 5, 8],
  [9, 7, 9, 3],
];
const W2 = [
  [1, 0, -1, 1, 0, -1, 1, 0, -1],
  [0, 1, 0, 1, -1, 1, 0, 1, 0],
];
const patchOf = (p: number) => {
  const i = Math.floor(p / 2);
  const j = p % 2;
  const out: number[] = [];
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) out.push(X4[i + a]![j + b]!);
  return out;
};

const more: SceneDef = {
  marks: {
    back: { tex: String.raw`d\symX = \text{conv}\big(dA,\ \text{flip}(\symW)\big)`, x: 0.5, y: 0.78, size: 5 },
  },
  draw(s) {
    const { w, u } = s;
    // Phase 1: im2col.
    const p1 = s.win('cols', 'back');
    if (p1 > 0) {
      s.alpha(p1, () => {
        const c = 4.4 * u;
        const left = w / 2 - 38 * u;
        const xc = left + 50 * u;
        const yc = 15 * u;
        const yr = yc + 9 * c + 3 * u;
        const xr = xc - 3 * u - 9 * c;
        // X and the current patch
        const xs = 5 * u;
        const pp = s.since('rows') < 0 ? Math.min(3, Math.floor(s.prog('cols') * 1.25 * 4)) : -1;
        const copies = s.since('mm') >= 0 ? s.ease('mm', 0.6, 3.5) : 0;
        s.text('X', left - 3 * u, yc + 2 * xs, { size: 4, italic: true, weight: 600, color: s.c('orange') });
        for (let a = 0; a < 4; a++)
          for (let b = 0; b < 4; b++) {
            const inP = pp >= 0 && a >= Math.floor(pp / 2) && a < Math.floor(pp / 2) + 3 && b >= pp % 2 && b < (pp % 2) + 3;
            s.cell(left + b * xs, yc + a * xs, xs, xs, String(X4[a]![b]), 'orange', { on: inP ? 0.8 : 0, size: 3 });
            if (copies > 0 && a === 1 && b === 1) s.alpha(copies, () => frame(s, left + b * xs, yc + a * xs, xs, xs, '--accent', 0.6, 0));
          }
        if (pp >= 0) frame(s, left + (pp % 2) * xs, yc + Math.floor(pp / 2) * xs, 3 * xs, 3 * xs, 'orange', 0.5, 0.1);
        // the two filters
        const fs = 4 * u;
        const fy = yc + 4 * xs + 6 * u;
        const fA = s.ease('rows', 0.5);
        for (let k = 0; k < 2; k++) {
          const fx = left - 2 * u + k * (3 * fs + 2 * u);
          for (let q = 0; q < 9; q++) s.cell(fx + (q % 3) * fs, fy + Math.floor(q / 3) * fs, fs, fs, String(W2[k]![q]), 'blue', { size: 2.8, on: fA * 0.5 });
        }
        s.text('W: 2 filters', left + 3 * fs + 1.5 * u, fy - 2.6 * u, { size: 3, color: s.c('blue') });
        // cols: 9 x 4, one column per patch
        for (let p = 0; p < 4; p++) {
          const vals = patchOf(p);
          const show = s.since('rows') >= 0 || p <= pp ? 1 : 0;
          for (let q = 0; q < 9; q++) {
            const dup = copies > 0 && vals[q] === 9 && X4[1]![1] === 9 && ((p === 0 && q === 4) || (p === 1 && q === 3) || (p === 2 && q === 1) || (p === 3 && q === 0));
            s.cell(xc + p * c, yc + q * c, c, c, show ? String(vals[q]) : '', 'orange', { on: p === pp ? 0.8 : 0, size: 2.7 });
            if (dup) s.alpha(copies, () => frame(s, xc + p * c, yc + q * c, c, c, '--accent', 0.6, 0));
          }
        }
        s.text('(9, 4)', xc + 4 * c + 2 * u, yc + 4.5 * c, { size: 3, font: 'mono', color: s.c('--ink-3'), align: 'left' });
        s.text('cols', xc + 2 * c, yc - 2.6 * u, { size: 3.2, font: 'mono', color: s.c('orange') });
        // rows: 2 x 9, one row per filter
        s.alpha(fA, () => {
          for (let k = 0; k < 2; k++) for (let q = 0; q < 9; q++) s.cell(xr + q * c, yr + k * c, c, c, String(W2[k]![q]), 'blue', { size: 2.7 });
          s.text('rows (2, 9)', xr + 4.5 * c, yr + 2 * c + 3.4 * u, { size: 3, font: 'mono', color: s.c('blue') });
        });
        // A = rows . cols
        const mA = s.ease('mm', 0.5);
        s.alpha(mA, () => {
          const k = Math.min(8, Math.floor(s.prog('mm') * 1.6 * 8));
          for (let r = 0; r < 2; r++)
            for (let p = 0; p < 4; p++) {
              const idx = r * 4 + p;
              const v = patchOf(p).reduce((acc, x, q) => acc + x * W2[r]![q]!, 0);
              s.cell(xc + p * c, yr + r * c, c, c, idx <= k ? String(v) : '', 'purple', { on: idx === k ? 1 : 0.3, size: 2.7 });
            }
          s.text('A (2, 4)', xc + 2 * c, yr + 2 * c + 3.4 * u, { size: 3, font: 'mono', color: s.c('purple') });
        });
        s.alpha(copies, () => s.text('X[1, 1] is copied into all 4 columns', w / 2, 92 * u, { size: 3.4, italic: true, color: s.c('--accent') }));
      });
    }
    // Phase 2: the backward pass uses the flipped filter.
    const p2 = s.win('back', 'one');
    s.show('back', p2 * s.ease('back', 0.6, 1.2));
    if (p2 > 0) {
      s.alpha(p2, () => {
        const c = 7 * u;
        const y = 26 * u;
        const xa = w / 2 - 3 * c - 10 * u;
        const xb = w / 2 + 10 * u;
        const flip = s.ease('back', 1.2, 1.5);
        for (let q = 0; q < 9; q++) {
          s.cell(xa + (q % 3) * c, y + Math.floor(q / 3) * c, c, c, String(q + 1), 'blue', { size: 3.6 });
          s.alpha(flip, () => s.cell(xb + (q % 3) * c, y + Math.floor(q / 3) * c, c, c, String(9 - q), 'blue', { size: 3.6, on: 0.6 }));
        }
        s.text('W', xa + 1.5 * c, y - 4 * u, { size: 4.2, italic: true, weight: 600, color: s.c('blue') });
        s.alpha(flip, () => {
          s.arrow(xa + 3 * c + 2 * u, y + 1.5 * c, xb - 2 * u, y + 1.5 * c, s.c('--ink-3'), 0.5);
          s.text('flipped', xb + 1.5 * c, y - 4 * u, { size: 3.6, italic: true, color: s.c('blue') });
        });
      });
    }
    // Phase 3: 1 x 1 convolutions mix channels.
    const p3 = s.win('one', 'dil');
    if (p3 > 0) {
      s.alpha(p3, () => {
        const face = 30 * u;
        const ix = w / 2 - 47 * u;
        const iy = 34 * u;
        const d1 = 30 * u;
        const [dx1, dy1] = depthVec(d1);
        box(s, ix, iy, face, face, d1, 'orange', { fill: 0.1 });
        const fr = 0.45;
        const fc = 0.4;
        const cell = 2 * u;
        wire(s, ix + face * fc, iy + face * fr, cell, cell, d1, 'blue', 0.45, 0.45);
        s.text('56 × 56 × 64', ix + face / 2, iy + face + 4.5 * u, { size: 3.4, font: 'mono', color: s.c('orange') });
        s.alpha(s.ease('one', 0.6, 1.5), () => s.text('a 1 × 1 filter, 64 deep', ix + (face + dx1) / 2, iy + dy1 - 4 * u, { size: 3.4, color: s.c('blue') }));
        const oA = s.ease('one2', 0.6, 1.2);
        s.alpha(oA, () => {
          const ox = w / 2 + 10 * u;
          const d2 = 15 * u;
          s.arrow(ix + face + dx1 + 2 * u, iy + face / 2, ox - 2 * u, iy + face / 2, s.c('--ink-3'), 0.5);
          box(s, ox, iy, face, face, d2, 'purple', { fill: 0.1 });
          wire(s, ox + face * fc, iy + face * fr, cell, cell, d2, 'purple', 0.45, 0.45);
          s.text('56 × 56 × 32', ox + face / 2, iy + face + 4.5 * u, { size: 3.4, font: 'mono', color: s.c('purple') });
          s.text('32 filters, each 1 × 1 × 64', w / 2, 80 * u, { size: 3.4, font: 'mono', color: s.c('purple') });
        });
        s.alpha(s.ease('one3', 0.6, 0.3), () => s.text('mixes channels, never neighbors', w / 2, 89 * u, { size: 4, italic: true, color: s.c('--accent') }));
      });
    }
    // Phase 4: dilated taps, and how their reach grows.
    const p4 = s.ease('dil', 0.6);
    if (p4 > 0) {
      s.alpha(p4, () => {
        const n = 15;
        const sp = Math.min(6.4 * u, (w - 46 * u) / (n - 1));
        const x0 = w / 2 - ((n - 1) * sp) / 2;
        const two = 1 - s.ease('dil3', 0.6);
        // two rows: gap 0 and gap 1
        s.alpha(two, () => {
          const rows: [number, string][] = [
            [1, 'gap 0: 3 taps read 3 cells'],
            [2, 'gap 1: 3 taps reach 5 cells'],
          ];
          rows.forEach(([step, label], r) => {
            const y = 30 * u + r * 28 * u;
            const a = s.ease('dil', 0.5, r * 2.4);
            s.alpha(a, () => {
              for (let q = 0; q < n; q++) s.cell(x0 + q * sp - sp * 0.45, y, sp * 0.9, sp * 0.9, '', 'orange', { on: q >= 5 && q <= 5 + 2 * step && (q - 5) % step === 0 ? 1 : 0 });
              const ty = y - 8 * u;
              for (let t = 0; t < 3; t++) s.line(x0 + (5 + t * step) * sp, y, x0 + (5 + step) * sp, ty + 1.8 * u, s.tint('blue', 0.8), 0.4);
              s.circle(x0 + (5 + step) * sp, ty, 1.8 * u, { fill: s.c('purple') });
              s.text(label, w / 2, y + sp + 4 * u, { size: 3.4, font: 'mono', color: s.c('--ink-2') });
            });
          });
        });
        // stacked layers with taps 1, 2, 4 apart
        const tA = s.ease('dil3', 0.6);
        s.alpha(tA, () => {
          const ys = [84, 62, 40, 18].map((v) => v * u);
          const names = ['input', '1 apart', '2 apart', '4 apart'];
          const reach = ['', '3', '7', '15'];
          const mid = 7;
          // which cells of each layer the top neuron depends on
          const need: Set<number>[] = [new Set(), new Set(), new Set(), new Set([mid])];
          const gaps = [1, 2, 4];
          for (let L = 3; L >= 1; L--) for (const q of need[L]!) for (const t of [-1, 0, 1]) need[L - 1]!.add(q + t * gaps[L - 1]!);
          for (let L = 3; L >= 1; L--) {
            const a = s.ease('dil3', 0.5, 0.5 + (3 - L) * 1.1);
            s.alpha(a, () => {
              for (const q of need[L]!) for (const t of [-1, 0, 1]) s.line(x0 + q * sp, ys[L]! + 1.6 * u, x0 + (q + t * gaps[L - 1]!) * sp, ys[L - 1]! - 1.6 * u, s.tint('blue', 0.55), 0.3);
            });
          }
          ys.forEach((y, L) => {
            for (let q = 0; q < n; q++) {
              const on = need[L]!.has(q);
              s.circle(x0 + q * sp, y, 1.4 * u, { fill: on ? s.c(L === 0 ? 'orange' : 'purple') : s.tint('--ink-3', 0.25) });
            }
            s.text(names[L]!, x0 - 2.5 * u, y, { size: 2.8, font: 'mono', color: s.c('--ink-3'), align: 'right' });
            if (L > 0) s.alpha(s.ease('dil3', 0.5, 0.5 + (L - 1) * 1.1), () => s.text(`reach ${reach[L]}`, x0 + (n - 1) * sp + 2.5 * u, y, { size: 2.8, font: 'mono', weight: 650, color: s.c('purple'), align: 'left' }));
          });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- pooling

const PX = [
  [1, 1, 2, 4],
  [5, 6, 7, 8],
  [3, 2, 1, 0],
  [1, 2, 3, 4],
];
const PDA = [
  [1.5, -0.4],
  [0.8, 2],
];
const PTINT: K[] = ['blue', 'orange', 'green', 'red'];
/** Position of the max of window (i, j): [row, col] in X. */
const argmax = (i: number, j: number): [number, number] => {
  let best: [number, number] = [2 * i, 2 * j];
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) if (PX[2 * i + a]![2 * j + b]! > PX[best[0]]![best[1]]!) best = [2 * i + a, 2 * j + b];
  return best;
};

const pooling: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const P = cifar(s);
    // Phase 1: a volume shrinks in width and height, slice by slice.
    const p1 = s.win('what', 'max');
    if (p1 > 0) {
      s.alpha(p1, () => {
        const face = 32 * u;
        const d = 14 * u;
        const ix = w / 2 - 44 * u;
        const iy = 32 * u;
        const one = s.ease('slice', 0.6);
        slices(s, ix, iy, face, face, 12, d, (i, sx, sy) => {
          s.alpha(i === 0 ? 1 : 1 - 0.7 * one, () => {
            if (P) pic(s, P.relus[i]!, sx, sy, face, face);
            s.rrect(sx, sy, face, face, 0.2, { stroke: s.tint('purple', 0.7), lw: 0.25 });
          });
        });
        const ox = w / 2 + 14 * u;
        const oy = iy + face / 4;
        s.arrow(ix + face + depthVec(d)[0] + 2 * u, iy + face / 2, ox - 2 * u, iy + face / 2, s.c('--ink-3'), 0.5);
        s.text('pool', (ix + face + depthVec(d)[0] + ox) / 2, iy + face / 2 - 3 * u, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
        slices(s, ox, oy, face / 2, face / 2, 12, d, (i, sx, sy) => {
          s.alpha(i === 0 ? 1 : 1 - 0.7 * one, () => {
            if (P) pic(s, P.pools[i]!, sx, sy, face / 2, face / 2);
            s.rrect(sx, sy, face / 2, face / 2, 0.2, { stroke: s.tint('purple', 0.7), lw: 0.25 });
          });
        });
        s.text('32 × 32 × 12', ix + face / 2, iy + face + 4.5 * u, { size: 3.4, font: 'mono', color: s.c('--ink-2') });
        s.text('16 × 16 × 12', ox + face / 4, oy + face / 2 + 4.5 * u, { size: 3.4, font: 'mono', color: s.c('--ink-2') });
        s.alpha(one, () => s.text('each depth slice on its own', w / 2, 88 * u, { size: 3.8, italic: true, color: s.c('--accent') }));
      });
    }
    // Phases 2 and 3: the 4 x 4 example, forward and backward.
    const p2 = s.win('max', 'rid');
    if (p2 > 0) {
      s.alpha(p2, () => {
        const c = Math.min(8.6 * u, (w - 40 * u) / 6);
        const x0 = w / 2 - 2 * c - 18 * u;
        const xA = w / 2 + 16 * u;
        const yF = 14 * u;
        const yB = yF + 4 * c + 8 * u;
        const back = s.since('back') >= 0;
        // forward: which windows are done
        const nF = s.since('run') >= 0 ? Math.min(4, Math.floor(s.prog('run') * 1.25 * 4) + 1) : s.since('max') >= 0 && s.prog('max') > 0.5 ? 1 : 0;
        const winOn = s.since('run') >= 0 && s.since('halve') < 0 ? nF - 1 : -1;
        const switches = s.since('switch') >= 0 ? s.ease('switch', 0.5, 0.6) : 0;
        for (let r = 0; r < 4; r++)
          for (let q = 0; q < 4; q++) {
            const n = (r >> 1) * 2 + (q >> 1);
            const k = PTINT[n]!;
            const [ar, aq] = argmax(r >> 1, q >> 1);
            const isMax = ar === r && aq === q;
            const lit = isMax && (n < nF || back);
            s.cell(x0 + q * c, yF + r * c, c, c, String(PX[r]![q]), k, { on: n === winOn ? 0.9 : lit ? 0.5 : 0.1, size: 3.6 });
            if (lit) s.circle(x0 + (q + 0.5) * c, yF + (r + 0.5) * c, c * 0.36, { stroke: s.c(k), lw: 0.5 });
            if (isMax && switches > 0) s.alpha(switches, () => frame(s, x0 + q * c, yF + r * c, c, c, '--accent', 0.6, 0.1));
          }
        if (winOn >= 0) frame(s, x0 + (winOn & 1) * 2 * c, yF + (winOn >> 1) * 2 * c, 2 * c, 2 * c, PTINT[winOn]!, 0.6, 0.15);
        s.text('X', x0 - 3 * u, yF + 2 * c, { size: 4.2, italic: true, weight: 600, color: s.c('orange') });
        s.arrow(x0 + 4 * c + 2 * u, yF + 2 * c, xA - 2 * u, yF + 2 * c, s.c('--ink-3'), 0.45);
        s.text('max', (x0 + 4 * c + xA) / 2, yF + 2 * c - 3 * u, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
        for (let i = 0; i < 2; i++)
          for (let j = 0; j < 2; j++) {
            const n = i * 2 + j;
            const done = n < nF || back;
            const [ar, aq] = argmax(i, j);
            s.cell(xA + j * c, yF + c + i * c, c, c, done ? String(PX[ar]![aq]) : '', PTINT[n]!, { on: n === winOn ? 1 : done ? 0.4 : 0, size: 3.6 });
          }
        s.text('A', xA + c, yF + c - 3 * u, { size: 4.2, italic: true, weight: 600, color: s.c('purple') });
        // notes under the forward pass, before the backward pass takes the space
        const noteY = yB + 6 * u;
        s.alpha(s.win('halve', 'ask'), () => {
          s.text('4 × 4 → 2 × 2: three quarters dropped', w / 2, noteY, { size: 3.6, font: 'mono', color: s.c('--ink-2') });
          s.text('depth stays the same', w / 2, noteY + 7 * u, { size: 3.6, italic: true, color: s.c('--ink-2') });
        });
        s.alpha(s.win('ask', 'settings'), () => {
          s.text('“did this feature fire', w / 2, noteY, { size: 4, italic: true, color: s.c('--accent') });
          s.text('anywhere in here?”', w / 2, noteY + 7 * u, { size: 4, italic: true, color: s.c('--accent') });
        });
        s.alpha(s.win('settings', 'back'), () => {
          const t1 = '2 × 2, stride 2';
          const t2 = '3 × 3, stride 2 (overlapping)';
          chip(s, t1, w / 2 - chipWidth(s, t1, 3.4) / 2, noteY, 'slate', { size: 3.4 });
          chip(s, t2, w / 2 - chipWidth(s, t2, 3.4) / 2, noteY + 9 * u, 'slate', { size: 3.4 });
          s.text('no weights to learn', w / 2, noteY + 18 * u, { size: 3.4, italic: true, color: s.c('--ink-3') });
        });
        // backward
        const bA = s.ease('back', 0.6);
        s.alpha(bA, () => {
          const avg = s.ease('avg', 0.8, 0.4);
          const nB = s.since('route') >= 0 ? Math.min(4, Math.floor(s.prog('route') * 1.25 * 4) + 1) : 0;
          for (let r = 0; r < 4; r++)
            for (let q = 0; q < 4; q++) {
              const i = r >> 1;
              const j = q >> 1;
              const n = i * 2 + j;
              const [ar, aq] = argmax(i, j);
              const hot = ar === r && aq === q;
              const routed = n < nB || s.since('avg') >= 0;
              const vMax = routed ? (hot ? fmt(PDA[i]![j]!, 2) : '0') : '';
              const vAvg = fmt(PDA[i]![j]! / 4, 2);
              const k = PTINT[n]!;
              s.cell(x0 + q * c, yB + r * c, c, c, '', k, { on: routed && hot && avg < 0.5 ? 0.6 : 0.08 });
              s.alpha(1 - avg, () => s.text(vMax, x0 + (q + 0.5) * c, yB + (r + 0.5) * c + 0.2 * u, { size: 3.2, font: 'mono', color: s.c(hot ? '--ink' : '--ink-3') }));
              s.alpha(avg, () => s.text(vAvg, x0 + (q + 0.5) * c, yB + (r + 0.5) * c + 0.2 * u, { size: 3, font: 'mono', color: s.c('--ink') }));
            }
          s.text('dX', x0 - 3.5 * u, yB + 2 * c, { size: 4, italic: true, weight: 600, color: s.c('teal') });
          s.arrow(xA - 2 * u, yB + 2 * c, x0 + 4 * c + 2 * u, yB + 2 * c, s.c('--ink-3'), 0.45);
          s.text(avg > 0.5 ? '÷ 4' : 'route', (x0 + 4 * c + xA) / 2, yB + 2 * c - 3 * u, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
          for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) s.cell(xA + j * c, yB + c + i * c, c, c, fmt(PDA[i]![j]!, 2), PTINT[i * 2 + j]!, { on: 0.35, size: 3.2 });
          s.text('dA', xA + c, yB + c - 3 * u, { size: 4, italic: true, weight: 600, color: s.c('teal') });
        });
      });
    }
    // Phase 4: pooling replaced by a stride-2 convolution.
    const p4 = s.ease('rid', 0.6);
    if (p4 > 0) {
      s.alpha(p4, () => {
        const items: [string, K][] = [
          ['CONV', 'purple'],
          ['RELU', 'slate'],
          ['POOL', 'slate'],
        ];
        const gap = 4 * u;
        const tot = items.reduce((a, [t]) => a + chipWidth(s, t, 4.4), 0) + gap * 2;
        let x = w / 2 - tot / 2;
        const y = 30 * u;
        let px = 0;
        let pw = 0;
        items.forEach(([t, k]) => {
          const cw = chipWidth(s, t, 4.4);
          chip(s, t, x, y, k, { size: 4.4 });
          if (t === 'POOL') {
            px = x;
            pw = cw;
          }
          x += cw + gap;
        });
        const strike = s.ease('rid', 0.5, 1.4);
        s.alpha(strike, () => s.line(px - u, y + 3 * u, px + pw + u, y - 3 * u, s.c('red'), 0.6));
        s.alpha(s.ease('rid', 0.6, 2.4), () => {
          const t = 'CONV, stride 2';
          s.arrow(px + pw / 2, y + 6 * u, px + pw / 2, y + 17 * u, s.c('--ink-3'), 0.45);
          chip(s, t, Math.min(px + pw / 2 - chipWidth(s, t, 4.4) / 2, w - 6 * u - chipWidth(s, t, 4.4)), y + 24 * u, 'purple', { size: 4.4 });
          s.text('shrinks the volume with learned weights', w / 2, y + 40 * u, { size: 3.6, italic: true, color: s.c('--ink-2') });
        });
      });
    }
  },
};

export const scenesB: Record<string, SceneDef> = { size, sharing, more, pooling };
