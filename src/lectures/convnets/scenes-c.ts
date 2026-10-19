import { fmt } from '../../core/code';
import { type Scene, type SceneDef, lerp, smooth } from '../../lecture/scene';
import { cifar } from './data';
import { type K, arc, box, check, chip, chipWidth, dashed, depthVec, frame, pic, wire } from './kit';

/** A centered row of layer chips and glyphs; returns nothing, draws at baseline y. */
type Piece = { t: string; k?: K; on?: number } | { g: string; k?: K };
function flow(s: Scene, items: Piece[], cx: number, y: number, size = 3.2, a: (i: number) => number = () => 1): void {
  const u = s.u;
  const gap = 1.2 * u;
  const width = (p: Piece) => ('t' in p ? chipWidth(s, p.t, size) : s.measure(p.g, { font: 'mono', size, weight: 600 }));
  const tot = items.reduce((acc, p) => acc + width(p), 0) + gap * (items.length - 1);
  let x = cx - tot / 2;
  items.forEach((p, i) => {
    const wd = width(p);
    s.alpha(a(i), () => {
      if ('t' in p) chip(s, p.t, x, y, p.k ?? 'slate', { size, on: p.on ?? 1 });
      else s.text(p.g, x + wd / 2, y + 0.2 * u, { size, font: 'mono', weight: 600, color: s.c(p.k ?? '--ink-3') });
    });
    x += wd + gap;
  });
}

// ---------------------------------------------------------------- fc

const fc: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const P = cifar(s);
    // Phase 1: normalization layers, retired.
    const p1 = s.win('norm', 'fc');
    if (p1 > 0) {
      s.alpha(p1, () => {
        const items: Piece[] = [
          { t: 'CONV', k: 'purple' },
          { g: '→' },
          { t: 'RELU' },
          { g: '→' },
          { t: 'NORM', k: 'red' },
          { g: '→' },
          { t: 'POOL' },
        ];
        const fs = 4.2;
        flow(s, items, w / 2, 40 * u, fs);
        const strike = s.ease('norm', 0.5, 2.6);
        const nw = chipWidth(s, 'NORM', fs);
        const tot = items.reduce((acc, p) => acc + ('t' in p ? chipWidth(s, p.t, fs) : s.measure(p.g, { font: 'mono', size: fs, weight: 600 })), 0) + 1.2 * u * 6;
        const nx = w / 2 - tot / 2 + chipWidth(s, 'CONV', fs) + chipWidth(s, 'RELU', fs) + 2 * s.measure('→', { font: 'mono', size: fs, weight: 600 }) + 4 * 1.2 * u;
        s.alpha(strike, () => s.line(nx - u, 40 * u + 3.5 * u, nx + nw + u, 40 * u - 3.5 * u, s.c('red'), 0.6));
        s.alpha(s.ease('norm', 0.5, 3.4), () => s.text('added little, fell out of use', w / 2, 56 * u, { size: 3.8, italic: true, color: s.c('--ink-2') }));
      });
    }
    // Phase 2: an FC neuron is a filter as big as its input.
    const p2 = s.win('fc', 'why');
    if (p2 > 0) {
      s.alpha(p2, () => {
        const face = 24 * u;
        const d = 18 * u;
        const [dx, dy] = depthVec(d);
        const xx = w / 2 - 44 * u;
        const xy = 24 * u;
        box(s, xx, xy, face, face, d, 'orange', { fill: 0.14 });
        s.text('X: 7 × 7 × 512', xx + face / 2, xy + face + 4.5 * u, { size: 3.3, font: 'mono', color: s.c('orange') });
        // flattened input and one neuron's weights, as two long strips
        const flatA = 1 - s.ease('same', 0.6, 0.5);
        const sx0 = w / 2 - 40 * u;
        const sx1 = w / 2 + 26 * u;
        const sy = 66 * u;
        s.alpha(flatA * s.ease('fc', 0.6, 0.4), () => {
          s.arrow(xx + face / 2, xy + face + 8 * u, xx + face / 2, sy - 2 * u, s.c('--ink-3'), 0.4);
          s.rrect(sx0, sy, sx1 - sx0, 3 * u, 0.6, { fill: s.tint('orange', 0.35), stroke: s.c('orange'), lw: 0.3 });
          s.text('flat(X): 25,088 numbers', sx0 + 26 * u, sy - 2.6 * u, { size: 3, font: 'mono', color: s.c('orange'), align: 'left' });
          s.rrect(sx0, sy + 5 * u, sx1 - sx0, 3 * u, 0.6, { fill: s.tint('blue', 0.35), stroke: s.c('blue'), lw: 0.3 });
          s.text('one neuron\'s 25,088 weights', sx0, sy + 12 * u, { size: 3, font: 'mono', color: s.c('blue'), align: 'left' });
          s.text('·', sx1 + 3 * u, sy + 4 * u, { size: 5, color: s.c('--ink-2') });
          s.cell(sx1 + 6 * u, sy + 0.5 * u, 7 * u, 7 * u, '', 'purple', { on: 1 });
          s.text('× 4,096 neurons', w / 2, sy + 20 * u, { size: 3.4, font: 'mono', color: s.c('purple') });
        });
        s.alpha(s.win('disguise', 'same'), () => {
          s.text('an FC layer', w / 2 + 24 * u, 30 * u, { size: 4.6, font: 'display', weight: 600 });
          s.text('is a CONV layer', w / 2 + 24 * u, 38 * u, { size: 4.6, font: 'display', weight: 600, color: s.c('--accent') });
        });
        // the weights refolded into the shape of X, laid over it
        const fold = s.ease('same', 0.8, 1.6);
        const slide = s.ease('same', 0.9, 3.6);
        s.alpha(fold, () => {
          const wx = lerp(xx + face + dx + 10 * u, xx, slide);
          wire(s, wx, xy, face, face, d, 'blue', 0.5, 0.18);
          s.text('W[k]: 7 × 7 × 512', lerp(wx + face / 2, w / 2 + 18 * u, slide), lerp(xy + face + 4.5 * u, xy + face / 2, slide), { size: 3.3, font: 'mono', color: s.c('blue'), halo: true });
        });
        const fA = s.ease('fits', 0.6, 0.4);
        s.alpha(fA, () => {
          const ox = w / 2 + 6 * u;
          const oy = 64 * u;
          s.arrow(xx + face / 2 + dx / 2, xy + face + 8 * u, ox - 2 * u, oy + 2 * u, s.c('--ink-3'), 0.45);
          for (let i = 11; i >= 0; i--) {
            const [ex, ey] = depthVec(i * 2.4 * u);
            s.rrect(ox + ex, oy + ey, 4 * u, 4 * u, 0.4, { fill: s.tint('purple', 0.25), stroke: s.c('purple'), lw: 0.25 });
          }
          s.text('1 × 1 × 4,096', ox + 2 * u, oy + 9 * u, { size: 3.4, font: 'mono', weight: 650, color: s.c('purple') });
          s.text('one position: the same numbers', w / 2, 88 * u, { size: 3.6, italic: true, color: s.c('--ink-2') });
          check(s, ox + 22 * u, oy + 8.6 * u, 1.8 * u);
        });
      });
    }
    // Phase 3: sliding the converted network over a bigger image.
    const p3 = s.ease('why', 0.6);
    if (p3 > 0) {
      s.alpha(p3, () => {
        const grow = s.ease('big', 1.4, 0.3);
        const size = Math.round(lerp(224, 384, grow));
        const feat = Math.floor(size / 32);
        const n = feat - 6;
        s.slot('size', s.since('big') >= 0 ? (grow >= 1 ? 384 : size) : 224);
        s.slot('feat', feat);
        s.slot('n', n);
        const imgMax = 38 * u;
        const isz = lerp(imgMax * (224 / 384), imgMax, grow);
        const fsz = 28 * u * (feat / 12);
        const ssz = Math.max(4 * u, 18 * u * (n / 6));
        const gap = 7 * u;
        const tot = imgMax + 28 * u + 18 * u + 2 * gap;
        const x0 = w / 2 - tot / 2;
        const cy = 46 * u;
        const ix = x0 + (imgMax - isz) / 2;
        const iy = cy - isz / 2;
        if (P) pic(s, P.horse, ix, iy, isz, isz, true);
        s.rrect(ix, iy, isz, isz, 0.4, { stroke: s.c('--rule'), lw: 0.3 });
        s.text(`${size} × ${size}`, x0 + imgMax / 2, cy + imgMax / 2 + 4.5 * u, { size: 3.3, font: 'mono', color: s.c('--ink-2') });
        const fx = x0 + imgMax + gap + (28 * u - fsz) / 2;
        const fy = cy - fsz / 2;
        const fc0 = fsz / feat;
        for (let a = 0; a < feat; a++) for (let b = 0; b < feat; b++) s.rrect(fx + b * fc0 + 0.1 * u, fy + a * fc0 + 0.1 * u, fc0 - 0.2 * u, fc0 - 0.2 * u, 0.2, { fill: s.tint('orange', 0.12 + ((a * 5 + b * 3) % 4) * 0.05) });
        s.text(`${feat} × ${feat} × 512`, x0 + imgMax + gap + 14 * u, cy + imgMax / 2 + 4.5 * u, { size: 3.3, font: 'mono', color: s.c('orange') });
        const sx = x0 + imgMax + 28 * u + 2 * gap + (18 * u - ssz) / 2;
        const sy = cy - ssz / 2;
        const sc = ssz / Math.max(1, n);
        // which crop is lit
        let ci = 0;
        let cj = 0;
        if (s.since('grid') >= 0) {
          const k = Math.min(35, Math.floor(s.prog('grid') * 1.15 * 36));
          ci = Math.floor(k / 6);
          cj = k % 6;
        }
        if (s.since('cheap') >= 0) {
          ci = -1;
          cj = -1;
        }
        for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) s.cell(sx + b * sc, sy + a * sc, sc, sc, '', 'purple', { on: (a === ci && b === cj) || s.since('cheap') >= 0 ? 0.9 : 0.25 });
        s.text(`${n} × ${n} × 1000`, x0 + imgMax + 28 * u + 2 * gap + 9 * u, cy + imgMax / 2 + 4.5 * u, { size: 3.3, font: 'mono', color: s.c('purple') });
        s.arrow(x0 + imgMax + 1.5 * u, cy, x0 + imgMax + gap - 1.5 * u, cy, s.c('--ink-3'), 0.4);
        s.arrow(x0 + imgMax + 28 * u + gap + 1.5 * u, cy, x0 + imgMax + 28 * u + 2 * gap - 1.5 * u, cy, s.c('--ink-3'), 0.4);
        if (ci >= 0) {
          const crop = (224 / size) * isz;
          const step = (32 / size) * isz;
          frame(s, ix + cj * step, iy + ci * step, crop, crop, 'purple', 0.5, 0);
          frame(s, fx + cj * fc0, fy + ci * fc0, 7 * fc0, 7 * fc0, 'blue', 0.5, 0);
        }
        s.alpha(s.win('alex', 'big'), () => {
          flow(s, [{ t: 'FC6 → CONV 7×7', k: 'blue' }, { t: 'FC7, FC8 → CONV 1×1', k: 'blue' }], w / 2, 80 * u, 3.1, (i) => s.ease('alex', 0.5, 2.5 + i * 0.8));
        });
        s.alpha(s.win('why', 'alex'), () => s.text('the CONV version can slide', w / 2, 82 * u, { size: 3.8, italic: true, color: s.c('--ink-2') }));
        s.alpha(s.ease('grid', 0.6, 0.3) * (1 - s.ease('cheap', 0.4)), () => s.text('each score: one 224 × 224 crop, 32 px apart', w / 2, 82 * u, { size: 3.3, font: 'mono', color: s.c('purple') }));
        s.alpha(s.ease('cheap', 0.6), () => {
          s.text('1 pass = 36 crops', w / 2, 80 * u, { size: 4.6, font: 'display', weight: 650, color: s.c('--accent') });
          s.text('overlapping crops share their features', w / 2, 88 * u, { size: 3.4, italic: true, color: s.c('--ink-2') });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- arch

const arch: SceneDef = {
  marks: {
    params: { tex: String.raw`3 \cdot (3 \cdot 3)\,C^2 = 27\,C^2 \quad\text{vs}\quad 7 \cdot 7\,C^2 = 49\,C^2`, x: 0.5, y: 0.88, size: 4.2 },
  },
  draw(s) {
    const { w, u } = s;
    // Phase 1: the common pattern.
    const p1 = s.win('pattern', 'l1');
    if (p1 > 0) {
      s.alpha(p1, () => {
        const a = (i: number) => s.ease('pattern', 0.4, 0.4 + i * 0.25);
        flow(s, [{ t: 'INPUT', k: 'orange' }, { g: '→ [ [' }, { t: 'CONV', k: 'purple' }, { g: '→' }, { t: 'RELU' }, { g: ']×n →' }, { t: 'POOL?', k: 'gold' }, { g: ']×m' }], w / 2, 21 * u, 3.4, a);
        flow(s, [{ g: '→ [' }, { t: 'FC', k: 'blue' }, { g: '→' }, { t: 'RELU' }, { g: ']×k →' }, { t: 'FC', k: 'purple' }], w / 2, 32 * u, 3.4, (i) => a(i + 8));
        // a deeper instance: two CONVs before every pool, as a silhouette
        const dA = s.ease('deeper', 0.6);
        s.alpha(dA, () => {
          const blocks: [K, number][] = [];
          let hgt = 26 * u;
          for (let r = 0; r < 3; r++) {
            blocks.push(['purple', hgt], ['slate', hgt], ['purple', hgt], ['slate', hgt], ['gold', hgt]);
            hgt *= 0.62;
          }
          blocks.push(['blue', 6 * u], ['slate', 6 * u], ['blue', 6 * u], ['slate', 6 * u], ['purple', 4 * u]);
          const bw = Math.min(4.4 * u, (w - 20 * u) / blocks.length);
          const x0 = w / 2 - (blocks.length * bw) / 2;
          const cy = 62 * u;
          blocks.forEach(([k, bh], i) => {
            const a2 = s.ease('deeper', 0.3, 0.3 + i * 0.08);
            s.alpha(a2, () => s.rrect(x0 + i * bw + 0.3 * u, cy - bh / 2, bw - 0.6 * u, bh, 0.5, { fill: s.tint(k, k === 'slate' ? 0.3 : 0.45), stroke: s.c(k), lw: 0.25 }));
          });
          s.text('[CONV → RELU → CONV → RELU → POOL] ×3 → FC …', w / 2, 82 * u, { size: 3, font: 'mono', color: s.c('--ink-2') });
          s.text('two CONVs before every pool', w / 2, 89 * u, { size: 3.4, italic: true, color: s.c('--ink-2') });
        });
      });
    }
    // Phase 2: three 3 x 3 layers see 7 x 7.
    const p2 = s.win('l1', 'rules');
    s.show('params', p2 * s.ease('params', 0.6, 0.4));
    if (p2 > 0) {
      s.alpha(p2, () => {
        const n = 11;
        const c = Math.min(6.2 * u, (w - 40 * u) / n);
        const x0 = w / 2 - (n * c) / 2;
        const ys = [70, 54, 38, 22].map((v) => v * u);
        const names = ['input', 'layer 1', 'layer 2', 'layer 3'];
        const level = s.since('l3') >= 0 ? 3 : s.since('l2') >= 0 ? 2 : 1;
        const mid = 5;
        // cells each layer's chosen neuron depends on
        const span = (L: number) => level - L; // half-width in cells at layer L
        for (let L = level; L >= 1; L--) {
          const h0 = span(L);
          for (let q = mid - h0; q <= mid + h0; q++)
            for (const t of [-1, 0, 1]) s.line(x0 + (q + 0.5) * c, ys[L]! + c * 0.4, x0 + (q + t + 0.5) * c, ys[L - 1]! - c * 0.4, s.tint('blue', 0.5), 0.25);
        }
        ys.forEach((y, L) => {
          const shown = L <= level || L === 0;
          if (!shown) return;
          const h0 = span(L);
          for (let q = 0; q < n; q++) {
            const on = L <= level && Math.abs(q - mid) <= h0;
            s.rrect(x0 + q * c + 0.4 * u, y - c * 0.4, c - 0.8 * u, c * 0.8, 0.6, {
              fill: s.tint(L === 0 ? 'orange' : 'purple', on ? 0.5 : 0.08),
              stroke: s.tint(L === 0 ? 'orange' : 'purple', on ? 0.9 : 0.3),
              lw: 0.25,
            });
          }
          s.text(names[L]!, x0 - 2 * u, y, { size: 3, font: 'mono', color: s.c('--ink-3'), align: 'right' });
          if (L > 0 && L <= level) s.text(`sees ${2 * L + 1}×${2 * L + 1}`, x0 + n * c + 2 * u, y, { size: 3, font: 'mono', weight: 650, color: s.c('purple'), align: 'left' });
          if (L > 0 && L < 3 && s.since('relus') >= 0) s.alpha(s.ease('relus', 0.5, 0.4 + L * 0.4), () => s.text('ReLU', x0 + n * c + 2 * u, (y + ys[L + 1]!) / 2, { size: 2.8, font: 'mono', color: s.c('slate'), align: 'left' }));
        });
        if (level === 3) {
          s.alpha(s.ease('l3', 0.6, 1.6), () => {
            const bx = x0 + (mid - 3) * c;
            const by = ys[0]! + c * 0.4 + 2 * u;
            s.line(bx, by, bx + 7 * c, by, s.c('blue'), 0.45);
            s.line(bx, by - u, bx, by + u, s.c('blue'), 0.45);
            s.line(bx + 7 * c, by - u, bx + 7 * c, by + u, s.c('blue'), 0.45);
            s.text('as far as one 7 × 7 filter', bx + 3.5 * c, by + 3.6 * u, { size: 3.2, italic: true, color: s.c('blue') });
          });
        }
        s.alpha(s.ease('relus', 0.5, 1.6) * (1 - s.ease('params', 0.4)), () => s.text('three ReLUs instead of one', w / 2, 88 * u, { size: 3.6, italic: true, color: s.c('--accent') }));
      });
    }
    // Phase 3: rules of thumb, then: don't be a hero.
    const p3 = s.win('rules', 'hero');
    if (p3 > 0) {
      s.alpha(p3, () => {
        const sizes = [224, 112, 56, 28, 14, 7];
        const tot = sizes.reduce((a, v) => a + Math.max(2.4 * u, (v / 224) * 26 * u), 0) + 5 * 6 * u;
        let x = w / 2 - tot / 2;
        const cy = 36 * u;
        sizes.forEach((v, i) => {
          const sz = Math.max(2.4 * u, (v / 224) * 26 * u);
          const a = s.ease('rules', 0.4, 0.6 + i * 0.35);
          s.alpha(a, () => {
            box(s, x, cy - sz / 2, sz, sz, 3 * u, 'purple', { fill: 0.15 });
            s.text(String(v), x + sz / 2, cy + 16 * u, { size: 3, font: 'mono', color: s.c('--ink-2') });
          });
          x += sz + 6 * u;
        });
        s.alpha(s.ease('rules', 0.5, 0.4), () => {
          const t1 = 'CONV 3×3, S=1, P=1: same size';
          const t2 = 'POOL 2×2, S=2: half size';
          chip(s, t1, w / 2 - chipWidth(s, t1, 3.2) / 2, 66 * u, 'purple', { size: 3.2 });
          chip(s, t2, w / 2 - chipWidth(s, t2, 3.2) / 2, 76 * u, 'gold', { size: 3.2 });
          s.text('each pool halves the size', w / 2, 86 * u, { size: 3.4, italic: true, color: s.c('--ink-2') });
        });
      });
    }
    const p4 = s.ease('hero', 0.6);
    if (p4 > 0) {
      s.alpha(p4, () => {
        s.text('don’t be a hero', w / 2, 24 * u, { size: 7, font: 'display', weight: 650, color: s.c('--accent') });
        const steps = ['take a net that works on ImageNet', 'download its weights', 'fine-tune it on your data'];
        steps.forEach((t, i) => {
          const a = s.ease('hero', 0.5, 1.8 + i * 1.4);
          s.alpha(a, () => {
            const y = 44 * u + i * 13 * u;
            s.circle(w / 2 - 38 * u, y, 3 * u, { fill: s.tint('blue', 0.15), stroke: s.c('blue'), lw: 0.35 });
            s.text(String(i + 1), w / 2 - 38 * u, y + 0.2 * u, { size: 3.4, font: 'mono', weight: 700, color: s.c('blue') });
            s.text(t, w / 2 - 32 * u, y, { size: 4, align: 'left' });
          });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- cases

const NETS: [string, string, number, string][] = [
  ['AlexNet', '2012', 16.4, 'alex'],
  ['ZF Net', '2013', 14.8, 'zf'],
  ['VGGNet', '2014', 7.3, 'vgg'],
  ['GoogLeNet', '2014', 6.7, 'goog'],
  ['ResNet', '2015', 3.6, 'res2'],
];

const cases: SceneDef = {
  draw(s) {
    const { w, u } = s;
    // LeNet first.
    const lA = s.win('lenet', 'score');
    s.alpha(lA, () => {
      s.text('LeNet, 1990s', w / 2, 30 * u, { size: 6, font: 'display', weight: 600 });
      s.text('zip codes and handwritten digits', w / 2, 39 * u, { size: 3.6, italic: true, color: s.c('--ink-2') });
      flow(s, [{ t: 'CONV', k: 'purple' }, { g: '→' }, { t: 'POOL', k: 'gold' }, { g: '→' }, { t: 'CONV', k: 'purple' }, { g: '→' }, { t: 'POOL', k: 'gold' }, { g: '→' }, { t: 'FC', k: 'blue' }], w / 2, 54 * u, 3, (i) => s.ease('lenet', 0.3, 1 + i * 0.2));
    });
    // The scoreboard.
    const cA = s.ease('score', 0.6);
    if (cA <= 0) return;
    s.alpha(cA, () => {
      const x0 = 14 * u;
      const x1 = w - 6 * u;
      const base = 78 * u;
      const top = 20 * u;
      const Y = (v: number) => base - (v / 30) * (base - top);
      for (const v of [10, 20]) {
        s.line(x0, Y(v), x1, Y(v), s.c('--grid'), 0.25);
        s.text(`${v}%`, x0 - 1.5 * u, Y(v), { size: 2.8, font: 'mono', color: s.c('--ink-3'), align: 'right' });
      }
      s.line(x0, base, x1, base, s.c('--axis'), 0.35);
      s.text('top-5 error on ImageNet (lower is better)', x0, 13 * u, { size: 3.2, italic: true, color: s.c('--ink-2'), align: 'left' });
      const slot = (x1 - x0) / NETS.length;
      NETS.forEach(([name, year, err, beat], i) => {
        const a = s.ease(beat === 'res2' ? 'res' : beat, 0.6);
        if (a <= 0) return;
        const cx = x0 + slot * (i + 0.5);
        const bw = Math.min(10 * u, slot * 0.55);
        const bx = i === 0 ? cx + 0.5 * u : cx - bw / 2;
        const bwi = i === 0 ? Math.min(7 * u, slot * 0.4) : bw;
        const hgt = (base - Y(err)) * smooth(a);
        s.rrect(bx, base - hgt, bwi, hgt, 0.6, { fill: s.tint('purple', 0.35 + 0.1 * i), stroke: s.c('purple'), lw: 0.3 });
        s.alpha(a, () => {
          s.text(`${err}%`, bx + bwi / 2, base - hgt - 2.6 * u, { size: 3, font: 'mono', weight: 650, color: s.c('purple') });
          s.text(name, cx, base + 3.6 * u, { size: 2.9, font: 'mono', weight: 600, color: s.c('--ink') });
          s.text(year, cx, base + 8 * u, { size: 2.7, font: 'mono', color: s.c('--ink-3') });
        });
        if (i === 0) {
          const ra = s.ease('alex', 0.6, 2.2);
          const rh = (base - Y(26.2)) * smooth(ra);
          const rx = cx - 0.5 * u - bwi;
          s.alpha(ra, () => {
            dashed(s, rx, base - rh, bwi, rh, s.c('--ink-3'), 0.3);
            s.text('26%', rx + bwi / 2, base - rh - 2.6 * u, { size: 3, font: 'mono', color: s.c('--ink-3') });
            s.text('runner-up', rx + bwi / 2 - 1 * u, base - rh - 6.4 * u, { size: 2.7, italic: true, color: s.c('--ink-3') });
          });
        }
      });
      // AlexNet's recipe
      s.alpha(s.win('recipe', 'zf'), () => {
        const items = ['ReLU', 'dropout', 'momentum', 'learning rate ÷ 10 when stuck'];
        items.forEach((t, i) => {
          const a = s.ease('recipe', 0.4, 0.8 + i * 0.6);
          s.alpha(a, () => chip(s, t, x0 + slot * 1.2, 20 * u + i * 6 * u, 'blue', { size: 3, on: 0.6 }));
        });
      });
      // ResNet's skip connection
      s.alpha(s.ease('res', 0.6, 0.6), () => {
        const bx = x0 + slot * 2.35;
        const by = 30 * u;
        const bw = Math.min(26 * u, slot * 1.9);
        s.text('x', bx - 3 * u, by + 4 * u, { size: 3.6, italic: true, weight: 600 });
        s.arrow(bx - 1.6 * u, by + 4 * u, bx + 2 * u, by + 4 * u, s.c('--ink-3'), 0.4);
        s.rrect(bx + 2 * u, by, bw * 0.55, 8 * u, 1.2, { fill: s.tint('purple', 0.15), stroke: s.c('purple'), lw: 0.35 });
        s.text('layers', bx + 2 * u + bw * 0.275, by + 4.2 * u, { size: 3, font: 'mono', color: s.c('purple') });
        const px = bx + 2 * u + bw * 0.55 + 5 * u;
        s.arrow(bx + 2 * u + bw * 0.55, by + 4 * u, px - 2 * u, by + 4 * u, s.c('--ink-3'), 0.4);
        s.circle(px, by + 4 * u, 2 * u, { fill: s.c('--card'), stroke: s.c('teal'), lw: 0.45 });
        s.text('+', px, by + 4.2 * u, { size: 3.6, font: 'mono', weight: 700, color: s.c('teal') });
        arc(s, bx - 0.5 * u, by + 1.5 * u, px, by + 1.9 * u, -7 * u, s.c('teal'), 0.4);
        s.text('skip', (bx + px) / 2, by - 6.5 * u, { size: 2.8, font: 'mono', color: s.c('teal') });
        s.alpha(s.ease('res2', 0.5, 0.4), () => s.text('152 layers', px - 6 * u, by + 13 * u, { size: 3.2, font: 'mono', weight: 650, color: s.c('purple') }));
      });
    });
  },
};

// ---------------------------------------------------------------- memory

interface Layer {
  name: string;
  acts: number;
  params: number;
  kind: 'input' | 'conv' | 'pool' | 'fc';
}
const VGG: Layer[] = (() => {
  const cfg: (number | 'M')[] = [64, 64, 'M', 128, 128, 'M', 256, 256, 256, 'M', 512, 512, 512, 'M', 512, 512, 512, 'M'];
  let H = 224;
  let D = 3;
  const rows: Layer[] = [{ name: 'INPUT', acts: H * H * D, params: 0, kind: 'input' }];
  for (const v of cfg) {
    if (v === 'M') {
      H /= 2;
      rows.push({ name: 'POOL', acts: H * H * D, params: 0, kind: 'pool' });
    } else {
      rows.push({ name: `CONV-${v}`, acts: H * H * v, params: 9 * D * v, kind: 'conv' });
      D = v;
    }
  }
  for (const [a, b] of [
    [7 * 7 * 512, 4096],
    [4096, 4096],
    [4096, 1000],
  ] as const)
    rows.push({ name: `FC-${b}`, acts: b, params: a * b, kind: 'fc' });
  return rows;
})();
const TOT_A = VGG.reduce((a, r) => a + r.acts, 0);
const TOT_P = VGG.reduce((a, r) => a + r.params, 0);
const gbOf = (batch: number) => ((2 * batch * TOT_A + 3 * TOT_P) * 4) / 1024 ** 3;

const memory: SceneDef = {
  draw(s) {
    const { w, u } = s;
    // A GPU's memory as a bar, 0 to 12 GB.
    const gpuBar = (y: number, segs: [number, K][], label: boolean) => {
      const x0 = 12 * u;
      const x1 = w - 10 * u;
      const X = (gb: number) => x0 + (gb / 12) * (x1 - x0);
      s.rrect(x0, y, x1 - x0, 6 * u, 1, { fill: s.c('--paper-2'), stroke: s.c('--rule'), lw: 0.3 });
      let acc = 0;
      for (const [gb, k] of segs) {
        if (gb <= 0) continue;
        s.rrect(X(acc), y, X(acc + gb) - X(acc), 6 * u, 1, { fill: s.tint(k, 0.55), stroke: s.c(k), lw: 0.3 });
        acc += gb;
      }
      if (label)
        for (const g of [0, 3, 6, 12]) {
          s.line(X(g), y + 6 * u, X(g), y + 7.5 * u, s.c('--axis'), 0.3);
          s.text(`${g} GB`, X(g), y + 10 * u, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
        }
      return X;
    };
    // Phase 1: where memory goes.
    const p1 = s.win('limit', 'vgg');
    if (p1 > 0) {
      s.alpha(p1, () => {
        s.text('GPU memory, 2016', 12 * u, 17 * u, { size: 3.4, italic: true, color: s.c('--ink-2'), align: 'left' });
        const X = gpuBar(22 * u, [], true);
        s.alpha(s.ease('limit', 0.6, 1.4), () => {
          s.rrect(X(3), 21 * u, X(6) - X(3), 8 * u, 1, { stroke: s.c('gold'), lw: 0.5 });
          s.text('typical', (X(3) + X(6)) / 2, 25.2 * u, { size: 3, font: 'mono', weight: 650, color: s.c('gold') });
        });
        const rows: [string, string, K, string][] = [
          ['activations', 'every layer\'s output, ×2 with gradients', 'orange', 'acts'],
          ['parameters', 'weights, gradients, momentum: ×3', 'blue', 'params'],
          ['odds and ends', 'the images themselves, and so on', 'slate', 'three'],
        ];
        rows.forEach(([t, d, k, beat], i) => {
          const a = s.ease('three', 0.4, 0.4 + i * 0.6);
          const on = s.since(beat) >= 0 && beat !== 'three' ? 1 : 0;
          const y = 48 * u + i * 14 * u;
          s.alpha(a, () => {
            s.rrect(12 * u, y - 2.4 * u, 4.8 * u, 4.8 * u, 0.8, { fill: s.tint(k, 0.55), stroke: s.c(k), lw: 0.3 });
            s.text(t, 20 * u, y, { size: 4, align: 'left', weight: on ? 650 : 450 });
            s.alpha(beat === 'three' ? 0.85 : s.ease(beat, 0.5, 0.6), () => s.text(d, 20 * u, y + 5 * u, { size: 3, font: 'mono', align: 'left', color: s.c(k) }));
          });
        });
      });
    }
    // Phase 2: VGG-16, layer by layer: activations up, weights down.
    const p2 = s.win('vgg', 'total');
    if (p2 > 0) {
      s.alpha(p2, () => {
        const x0 = 12 * u;
        const x1 = w - 8 * u;
        const cw = (x1 - x0) / VGG.length;
        const mid = 54 * u;
        const upH = 30 * u;
        const dnH = 30 * u;
        const maxA = Math.max(...VGG.map((r) => r.acts));
        const maxP = Math.max(...VGG.map((r) => r.params));
        const early = s.since('early') >= 0 && s.since('late') < 0 ? 1 : 0;
        const late = s.since('late') >= 0 ? 1 : 0;
        VGG.forEach((r, i) => {
          const a = s.ease('vgg', 0.4, 0.3 + i * 0.07);
          s.alpha(a, () => {
            const x = x0 + i * cw;
            const hA = (r.acts / maxA) * upH;
            const hP = (r.params / maxP) * dnH;
            const dimA = late ? 0.35 : 1;
            const dimP = early ? 0.35 : 1;
            if (hA > 0) s.alpha(dimA, () => s.rrect(x + 0.15 * cw, mid - Math.max(0.4 * u, hA), cw * 0.7, Math.max(0.4 * u, hA), 0.3, { fill: s.tint('orange', 0.6), stroke: s.c('orange'), lw: 0.2 }));
            if (hP > 0) s.alpha(dimP, () => s.rrect(x + 0.15 * cw, mid + 0.6 * u, cw * 0.7, Math.max(0.4 * u, hP), 0.3, { fill: s.tint('blue', 0.6), stroke: s.c('blue'), lw: 0.2 }));
          });
        });
        s.line(x0, mid + 0.3 * u, x1, mid + 0.3 * u, s.c('--axis'), 0.3);
        s.text('activations per image ↑', x0, 15.5 * u, { size: 3.2, font: 'mono', color: s.c('orange'), align: 'left' });
        s.text('weights ↓', x0, 90 * u, { size: 3.2, font: 'mono', color: s.c('blue'), align: 'left' });
        s.text('input', x0 + 0.5 * cw, mid + 3 * u, { size: 2.6, font: 'mono', color: s.c('--ink-3') });
        s.text('FC', x0 + (VGG.length - 2) * cw, mid - 3 * u, { size: 2.8, font: 'mono', weight: 650, color: s.c('--ink-3') });
        s.alpha(s.ease('early', 0.6, 0.6) * (1 - s.ease('late', 0.4)), () => s.text('15.2M numbers per image, mostly here', x0 + 3 * cw, 22 * u, { size: 3.2, font: 'mono', weight: 600, color: s.c('orange'), align: 'left' }));
        s.alpha(s.ease('late', 0.6, 0.6), () => {
          const fx = x0 + (VGG.length - 3) * cw;
          s.text('FC-4096: 103M of 138M weights', fx - 2 * u, mid + dnH - 2 * u, { size: 3.2, font: 'mono', weight: 600, color: s.c('blue'), align: 'right' });
        });
      });
    }
    // Phase 3: from counts to gigabytes, and the batch size.
    const p3 = s.ease('total', 0.6);
    if (p3 > 0) {
      s.alpha(p3, () => {
        const batch = s.since('batch') >= 0 ? Math.round(lerp(64, 16, s.ease('batch', 2.2, 1.6))) : 64;
        const actsGB = (2 * batch * TOT_A * 4) / 1024 ** 3;
        const parGB = (3 * TOT_P * 4) / 1024 ** 3;
        s.slot('gb', fmt(gbOf(batch), 2));
        const lines: [string, K][] = [
          [`2 × ${batch} × 15.2M acts`, 'orange'],
          ['+ 3 × 138M params', 'blue'],
          [`× 4 bytes ≈ ${gbOf(batch).toFixed(1)} GB`, 'purple'],
        ];
        lines.forEach(([t, k], i) => s.alpha(s.ease('total', 0.4, 0.3 + i * 0.7), () => s.text(t, w / 2, 20 * u + i * 8 * u, { size: i === 2 ? 4.6 : 3.8, font: 'mono', weight: i === 2 ? 700 : 500, color: s.c(k) })));
        s.alpha(s.ease('total', 0.5, 2.4), () => {
          gpuBar(56 * u, [
            [actsGB, 'orange'],
            [parGB, 'blue'],
          ], true);
          s.text(`batch = ${batch}`, w / 2, 51 * u, { size: 3.4, font: 'mono', weight: 600, color: s.c('--ink-2') });
        });
        s.alpha(s.ease('batch', 0.6, 3), () => s.text('smaller batch, fewer activations', w / 2, 82 * u, { size: 3.8, italic: true, color: s.c('--accent') }));
      });
    }
  },
};

// ---------------------------------------------------------------- outro

const outro: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const listA = 1 - s.ease('next', 0.6, 0.3);
    s.alpha(listA, () => {
      flow(s, [{ t: 'INPUT', k: 'orange' }, { g: '→' }, { t: 'CONV', k: 'purple' }, { g: '→' }, { t: 'RELU' }, { g: '→' }, { t: 'POOL', k: 'gold' }, { g: '→ … →' }, { t: 'FC', k: 'blue' }], w / 2, 18 * u, 3, (i) => s.ease('stack', 0.4, 0.4 + i * 0.15));
      s.alpha(s.ease('stack', 0.5, 1.6), () => s.text('volume in, volume out', w / 2, 27 * u, { size: 3.4, italic: true, color: s.c('--ink-2') }));
      const items: [string, string, boolean][] = [
        ['conv', 'CONV: small, full-depth, shared filters', false],
        ['size', 'N_out = (N − F + 2P) / S + 1', true],
        ['pool', 'POOL: shrink; gradients via switches', false],
        ['fc', 'FC = CONV with a filter as big as its input', false],
        ['arch', 'stacks of 3 × 3; memory early, weights late', false],
      ];
      const tw = Math.max(...items.map(([, t, mono]) => s.measure(t, mono ? { size: 3.6, font: 'mono' } : { size: 3.8 })));
      const x = w / 2 - (tw + 7 * u) / 2;
      items.forEach(([beat, t, mono], i) => {
        const a = s.ease(beat, 0.5, 0.2);
        s.alpha(a, () => {
          const y = 38 * u + i * 11 * u;
          check(s, x + 2 * u, y, 1.9 * u);
          s.text(t, x + 7 * u, y, mono ? { size: 3.6, font: 'mono', align: 'left', weight: 600, color: s.c('purple') } : { size: 3.8, align: 'left' });
        });
      });
    });
    const nA = s.ease('next', 0.7, 0.4);
    s.alpha(nA, () => {
      s.text('next: inside a trained ConvNet', w / 2, 40 * u, { size: 6.2, font: 'display', weight: 600 });
      s.text('what its filters see, which pixels matter,', w / 2, 52 * u, { size: 3.6, italic: true, color: s.c('--ink-2') });
      s.text('and how easily it is fooled', w / 2, 58 * u, { size: 3.6, italic: true, color: s.c('--ink-2') });
    });
  },
};

export const scenesC: Record<string, SceneDef> = { fc, arch, cases, memory, outro };
