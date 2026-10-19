import { Rng } from '../../core/rand';
import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../lecture/scene';
import { round16, roundStoch16 } from '../../lib/convnets-practice-math';
import { type K, at, card, check, current, pill } from './kit';
import { fit } from './scenes-a';

const hash = (a: number, b: number): number => {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** A labeled rounded box, centered at (x, y). */
function box(s: Scene, x: number, y: number, bw: number, bh: number, label: string, k: K, o: { on?: number; size?: number; font?: 'mono' | 'ui' } = {}): void {
  const on = o.on ?? 0.5;
  s.rrect(x - bw / 2, y - bh / 2, bw, bh, 1.6, { fill: s.tint(k, 0.08 + 0.14 * on), stroke: s.tint(k, 0.5 + 0.5 * on), lw: 0.35 });
  const font = o.font ?? 'mono';
  s.text(label, x, y + s.u * 0.2, { size: fit(s, label, bw - s.u * 2, o.size ?? 3.3, { font, weight: 600 }), font, weight: 600, color: s.c(k) });
}

// ---------------------------------------------------------------- fast

const D = [2, -1, 3, 1];
const G3 = [1, 2, -1];
const GG = [G3[0]!, (G3[0]! + G3[1]! + G3[2]!) / 2, (G3[0]! - G3[1]! + G3[2]!) / 2, G3[2]!];
const MM = [(D[0]! - D[2]!) * GG[0]!, (D[1]! + D[2]!) * GG[1]!, (D[2]! - D[1]!) * GG[2]!, (D[1]! - D[3]!) * GG[3]!];
const pv = (v: number): string => (v < 0 ? `(−${-v})` : String(v));
const sg = (v: number): string => (v < 0 ? `−${-v}` : String(v));

const fast: SceneDef = {
  marks: {
    eq: { tex: String.raw`\symX * \symW = \mathcal{F}^{-1}\big(\mathcal{F}(\symX) \odot \mathcal{F}(\symW)\big)`, x: 0.5, y: 0.15, size: 5.4 },
    str: { tex: String.raw`N^3 \;\to\; N^{\log_2 7} \approx N^{2.81}`, x: 0.5, y: 0.71, size: 5.2 },
  },
  draw(s) {
    const { w, u } = s;
    const cx = w / 2;
    const fA = s.win('theorem', 'strassen');
    s.show('eq', fA);
    s.alpha(s.win('theorem', 'waves'), () => {
      s.text('the convolution theorem', cx, u * 45, { size: 5.6, font: 'display', weight: 600 });
      s.text('slide-and-multiply becomes one elementwise product', cx, u * 55, { size: fit(s, 'slide-and-multiply becomes one elementwise product', w - u * 10, 3.8), italic: true, color: s.c('--ink-2') });
    });
    // A signal as a sum of waves.
    s.alpha(s.win('waves', 'steps'), () => {
      const x0 = u * 8;
      const x1 = w - u * 8;
      const comps: [number, number, number][] = [
        [1, 1, 0],
        [0.5, 3, 1],
        [0.3, 7, 2],
      ];
      const path = (y: number, amp: number, f: (t: number) => number, col: string, lw: number, upto = 1) => {
        const c = s.ctx;
        c.beginPath();
        const n = 160;
        for (let i = 0; i <= n * upto; i++) {
          const t = i / n;
          const x = lerp(x0, x1, t);
          const yy = y - amp * f(t * Math.PI * 4);
          i ? c.lineTo(x, yy) : c.moveTo(x, yy);
        }
        c.strokeStyle = col;
        c.lineWidth = lw * u;
        c.stroke();
      };
      const sum = (t: number) => comps.reduce((a, [A, f, p]) => a + A * Math.sin(f * t + p), 0) / 1.5;
      path(u * 36, u * 8, sum, s.c('orange'), 0.6, s.ease('waves', 1.2));
      s.text('a signal', x0, u * 25, { size: 3.3, align: 'left', color: s.c('orange'), weight: 600 });
      comps.forEach(([A, f, p], i) => {
        const a = s.ease('waves', 0.5, 1.2 + i * 0.6);
        s.alpha(a, () => {
          path(u * (56 + i * 12), u * 4, (t) => A * Math.sin(f * t + p), s.tint('slate', 0.9), 0.4);
          if (i < 2) s.text('+', x0 - u * 3.5, u * (62 + i * 12), { size: 3.6, color: s.c('--ink-3') });
        });
      });
      s.alpha(s.ease('waves', 0.5, 2.6), () => s.text('= a sum of waves', x1, u * 25, { size: 3.3, align: 'right', color: s.c('slate'), weight: 600 }));
    });
    // Transform, multiply, transform back.
    s.alpha(s.win('steps', 'nlogn'), () => {
      const cs = [cx - u * 40, cx - u * 13, cx + u * 11, cx + u * 38];
      const ya = u * 37;
      const yb = u * 60;
      const ym = (ya + yb) / 2;
      const bw = u * 18;
      const bh = u * 9;
      const st = (i: number) => clamp01((s.t - at(s, 'steps', 0.05 + i * 0.2)) / 0.5);
      box(s, cs[0]!, ya, bw, bh, 'X', 'orange');
      box(s, cs[0]!, yb, bw, bh, 'W, flipped', 'blue');
      s.alpha(st(0), () => {
        s.arrow(cs[0]! + bw / 2 + u, ya, cs[1]! - bw / 2 - u, ya, s.c('--ink-3'), 0.4, 1.8);
        s.text('FFT', (cs[0]! + cs[1]!) / 2, ya - u * 3.4, { size: 3, font: 'mono', weight: 600, color: s.c('--ink-2') });
        box(s, cs[1]!, ya, bw, bh, 'F(X)', 'orange');
      });
      s.alpha(st(1), () => {
        s.arrow(cs[0]! + bw / 2 + u, yb, cs[1]! - bw / 2 - u, yb, s.c('--ink-3'), 0.4, 1.8);
        s.text('FFT', (cs[0]! + cs[1]!) / 2, yb - u * 3.4, { size: 3, font: 'mono', weight: 600, color: s.c('--ink-2') });
        box(s, cs[1]!, yb, bw, bh, 'F(W)', 'blue');
      });
      s.alpha(st(2), () => {
        s.arrow(cs[1]! + bw / 2 + u, ya, cs[2]! - u * 4.5, ym - u * 2, s.c('--ink-3'), 0.4, 1.8);
        s.arrow(cs[1]! + bw / 2 + u, yb, cs[2]! - u * 4.5, ym + u * 2, s.c('--ink-3'), 0.4, 1.8);
        s.circle(cs[2]!, ym, u * 4, { fill: s.tint('purple', 0.14), stroke: s.c('purple'), lw: 0.4 });
        s.text('⊙', cs[2]!, ym + u * 0.3, { size: 4.6, color: s.c('purple') });
        s.text('multiply', cs[2]!, ym + u * 8, { size: 3, color: s.c('--ink-2') });
      });
      s.alpha(st(3), () => {
        s.arrow(cs[2]! + u * 4.5, ym, cs[3]! - bw / 2 - u, ym, s.c('--ink-3'), 0.4, 1.8);
        s.text('inverse', (cs[2]! + cs[3]!) / 2 - u * 1, ym - u * 3.4, { size: 3, font: 'mono', weight: 600, color: s.c('--ink-2') });
        box(s, cs[3]!, ym, bw, bh, 'X * W', 'purple');
      });
      s.text('the flip: ConvNet "convolution" is really cross-correlation', cx, u * 80, { size: fit(s, 'the flip: ConvNet "convolution" is really cross-correlation', w - u * 10, 3.2), italic: true, color: s.c('--ink-3') });
    });
    // n log n against n squared.
    s.alpha(s.win('nlogn', 'strassen'), () => {
      const bx = u * 30;
      const bmax = w - bx - u * 8;
      s.text('n = 4,096 numbers', cx, u * 32, { size: 3.6, font: 'mono', weight: 600 });
      s.text('direct: n²', bx - u * 2, u * 42, { size: 3.3, align: 'right', font: 'mono' });
      s.rrect(bx, u * 40, bmax * s.ease('nlogn', 0.9), u * 4, 0.5, { fill: s.tint('red', 0.5) });
      s.text('16,777,216', bx + u * 1, u * 47.5, { size: 2.9, font: 'mono', align: 'left', color: s.c('--ink-3') });
      s.text('FFT: n log n', bx - u * 2, u * 55, { size: 3.3, align: 'right', font: 'mono' });
      s.rrect(bx, u * 53, Math.max(u * 0.6, (bmax * 49152) / 16777216), u * 4, 0.5, { fill: s.tint('green', 0.7) });
      s.text('49,152', bx + u * 2, u * 55, { size: 2.9, font: 'mono', align: 'left', color: s.c('--ink-3') });
      s.alpha(s.ease('nlogn', 0.5, 2.8), () => {
        pill(s, 'large filters: big win', cx - u * 2, u * 72, 'green', { size: 3.3, align: 'right' });
        pill(s, '3×3 filters: small win', cx + u * 2, u * 72, 'slate', { size: 3.3, align: 'left' });
      });
    });
    // Strassen.
    const sA = s.win('strassen', 'direct');
    s.alpha(sA, () => {
      s.text('fast algorithms', cx, u * 9, { size: 5, font: 'display', weight: 600 });
      const cs = u * 9;
      const blocks = (x: number, k: K, lab: string) => {
        for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) s.cell(x + j * cs, u * 18 + i * cs, cs * 0.92, cs * 0.92, `${lab}${i + 1}${j + 1}`, k, { on: 0.2, size: 2.6 });
      };
      blocks(cx - 2 * cs - u * 3, 'blue', 'A');
      s.text('·', cx, u * 18 + cs, { size: 6 });
      blocks(cx + u * 3, 'orange', 'B');
      s.text('2×2 blocks: 8 multiplies → 7', cx, u * 46, { size: fit(s, '2×2 blocks: 8 multiplies → 7', w - u * 10, 3.6, { weight: 600 }), weight: 600 });
      s.text('plus a few additions, which are cheaper', cx, u * 53, { size: fit(s, 'plus a few additions, which are cheaper', w - u * 10, 3.2), color: s.c('--ink-2') });
      s.show('str', sA * s.ease('strassen', 0.6, 2));
      s.text('Strassen, 1969', cx, u * 61, { size: 3.3, italic: true, color: s.c('--ink-3') });
      s.alpha(s.ease('lavin', 0.6), () => pill(s, 'Lavin & Gray, 2015: Winograd for 3×3 convolutions', cx, u * 84, '--accent', { size: fit(s, 'Lavin & Gray, 2015: Winograd for 3×3 convolutions', w - u * 14, 3.3, { font: 'ui', weight: 600 }) }));
    });
    // Winograd F(2, 3), worked.
    const wA = s.win('direct', 'tile');
    s.alpha(wA, () => {
      const cs = u * 7;
      const dx = Math.max(u * 5, cx - u * 50);
      const gx = dx + 4 * cs + u * 10;
      s.text('d', dx, u * 6, { size: 3.4, font: 'mono', weight: 650, color: s.c('orange'), align: 'left' });
      D.forEach((v, i) => s.cell(dx + i * cs, u * 8.5, cs * 0.92, cs * 0.8, sg(v), 'orange', { on: 0.3, size: 3.2 }));
      s.text('g', gx, u * 6, { size: 3.4, font: 'mono', weight: 650, color: s.c('blue'), align: 'left' });
      G3.forEach((v, i) => s.cell(gx + i * cs, u * 8.5, cs * 0.92, cs * 0.8, sg(v), 'blue', { on: 0.3, size: 3.2 }));
      const beat = current(s, ['direct', 'G', 'm', 'y']);
      const mStep = beat === 'm' ? Math.min(3, Math.floor(s.prog('m') * 4.4)) : beat === 'y' ? 4 : -1;
      const nW = beat === 'm' ? mStep + 1 : beat === 'y' ? 4 : 0;
      const lines: { t: string; on: boolean; head?: boolean; k?: K }[] = [
        { t: 'direct: 3 multiplies per output', on: false, head: true },
        { t: `y0 = 2·1 + (−1)·2 + 3·(−1) = ${sg(D[0]! * G3[0]! + D[1]! * G3[1]! + D[2]! * G3[2]!)}`, on: beat === 'direct' },
        { t: `y1 = (−1)·1 + 3·2 + 1·(−1) = ${sg(D[1]! * G3[0]! + D[2]! * G3[1]! + D[3]! * G3[2]!)}`, on: beat === 'direct' },
        { t: 'fast: 4 multiplies for both', on: false, head: true },
        { t: `G = [${GG.map(sg).join(', ')}]   once per filter`, on: beat === 'G', k: 'blue' },
        { t: `m1 = (d0 − d2)·G0 = ${pv(D[0]! - D[2]!)}·${GG[0]} = ${sg(MM[0]!)}`, on: mStep === 0 },
        { t: `m2 = (d1 + d2)·G1 = ${pv(D[1]! + D[2]!)}·${GG[1]} = ${sg(MM[1]!)}`, on: mStep === 1 },
        { t: `m3 = (d2 − d1)·G2 = ${pv(D[2]! - D[1]!)}·${pv(GG[2]!)} = ${sg(MM[2]!)}`, on: mStep === 2 },
        { t: `m4 = (d1 − d3)·G3 = ${pv(D[1]! - D[3]!)}·${pv(GG[3]!)} = ${sg(MM[3]!)}`, on: mStep === 3 },
        { t: `y0 = m1 + m2 + m3 = ${sg(MM[0]! + MM[1]! + MM[2]!)}    y1 = m2 − m3 − m4 = ${sg(MM[1]! - MM[2]! - MM[3]!)}`, on: beat === 'y', k: 'purple' },
      ];
      const shown = [s.since('direct') >= 0 ? 3 : 0, s.since('G') >= 0 ? 5 : 3, mStep >= 0 ? 6 + mStep : 5, beat === 'y' ? 10 : 0];
      const nShow = Math.max(...shown);
      const lx = dx;
      let y = u * 25;
      const fs = fit(s, lines[9]!.t, w - lx - u * 6, 3.2, { font: 'mono' });
      lines.forEach((L, i) => {
        if (L.head) y += u * 1.5;
        if (i < nShow) {
          const a = i >= 4 && i <= 8 && beat === 'm' && i === 5 + mStep ? clamp01((s.t - at(s, 'm', mStep / 4.4)) * 4) : 1;
          s.alpha(a, () => {
            if (L.on) s.rrect(lx - u * 1.5, y - u * 3.3, w - lx - u * 3, u * 6.2, 1, { fill: s.tint('--accent', 0.12) });
            if (L.head) {
              s.text(L.t, lx, y, { size: 3.3, weight: 650, align: 'left' });
              const n = i === 0 ? 6 : nW;
              s.text(`× ${n}`, w - u * 5, y, { size: 3.8, font: 'mono', weight: 700, align: 'right', color: s.c('purple') });
            }
            else s.text(L.t, lx + u * 1.5, y, { size: fs, font: 'mono', align: 'left', color: s.c(L.k ?? '--ink') });
          });
        }
        y += u * 7;
      });
      s.alpha(s.ease('y', 0.5, 1.4), () => check(s, w - u * 7, y - u * 10, u * 2.4));
    });
    // Two dimensions.
    s.alpha(s.win('tile', 'sum'), () => {
      s.text('in 2-D: a 2×2 tile of outputs', cx, u * 9, { size: 4.6, font: 'display', weight: 600 });
      const cs = u * 6.5;
      const x0 = cx - u * 40;
      const y0 = u * 20;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) s.cell(x0 + j * cs, y0 + i * cs, cs * 0.92, cs * 0.92, '', 'orange', { on: 0.25 });
      s.text('⊛', x0 + 4 * cs + u * 5, y0 + 2 * cs, { size: 5, color: s.c('--ink-3') });
      const fx = x0 + 4 * cs + u * 10;
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) s.cell(fx + j * cs, y0 + cs * 0.5 + i * cs, cs * 0.92, cs * 0.92, '', 'blue', { on: 0.3 });
      s.text('=', fx + 3 * cs + u * 4, y0 + 2 * cs, { size: 5, color: s.c('--ink-3') });
      const ox = fx + 3 * cs + u * 8;
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) s.cell(ox + j * cs, y0 + cs + i * cs, cs * 0.92, cs * 0.92, '', 'purple', { on: 0.5 });
      s.text('direct: 4 outputs × 9 = 36 multiplies', cx, u * 58, { size: fit(s, 'direct: 4 outputs × 9 = 36 multiplies', w - u * 10, 3.6, { font: 'mono' }), font: 'mono' });
      s.text('Winograd: 16 multiplies, 2.25× fewer', cx, u * 66, { size: fit(s, 'Winograd: 16 multiplies, 2.25× fewer', w - u * 10, 3.6, { font: 'mono', weight: 650 }), font: 'mono', weight: 650, color: s.c('purple') });
      s.alpha(s.ease('tile', 0.5, 2.4), () => pill(s, 'cuDNN added it in 2016', cx, u * 80, 'green', { size: 3.4 }));
    });
    // Three ways to compute a convolution.
    s.alpha(s.ease('sum', 0.6), () => {
      const items: [string, string, string, K][] = [
        ['im2col', 'easy, one matmul', 'costs memory', 'orange'],
        ['FFT', 'a product of spectra', 'large filters', 'teal'],
        ['Winograd', 'clever algebra', 'small filters', 'purple'],
      ];
      const g = u * 3;
      const cw = Math.min(u * 40, (w - u * 8 - 2 * g) / 3);
      const x0 = cx - (3 * cw + 2 * g) / 2;
      s.text('three ways to compute a convolution', cx, u * 12, { size: fit(s, 'three ways to compute a convolution', w - u * 10, 4.6, { font: 'display', weight: 600 }), font: 'display', weight: 600 });
      items.forEach(([t1, t2, t3, k], i) => {
        const a = s.ease('sum', 0.4, 0.4 + i * 1.2);
        s.alpha(a, () => {
          const x = x0 + i * (cw + g);
          card(s, x, u * 24, cw, u * 40, k, 0.6);
          s.text(t1, x + cw / 2, u * 33, { size: fit(s, t1, cw - u * 3, 4.4, { font: 'display', weight: 600 }), font: 'display', weight: 600, color: s.c(k) });
          s.text(t2, x + cw / 2, u * 44, { size: fit(s, t2, cw - u * 3, 3.2), color: s.c('--ink-2') });
          s.text(t3, x + cw / 2, u * 54, { size: fit(s, t3, cw - u * 3, 3.4, { weight: 650 }), weight: 650 });
        });
      });
    });
  },
};

// ---------------------------------------------------------------- hardware

function chip(s: Scene, x: number, y: number, cw: number, ch: number, k: K, cores: [number, number], lit: (i: number) => number, name: string): void {
  const { u } = s;
  s.rrect(x, y, cw, ch, 1.6, { fill: s.tint(k, 0.06), stroke: s.tint(k, 0.7), lw: 0.4 });
  const [nr, nc] = cores;
  const pad = u * 2;
  const gw = (cw - 2 * pad) / nc;
  const gh = (ch - 2 * pad - u * 5) / nr;
  for (let r = 0; r < nr; r++)
    for (let q = 0; q < nc; q++) {
      const i = r * nc + q;
      s.rrect(x + pad + q * gw + gw * 0.08, y + pad + u * 5 + r * gh + gh * 0.08, gw * 0.84, gh * 0.84, nc > 6 ? 0.15 : 0.8, { fill: s.tint(k, 0.15 + 0.6 * lit(i)) });
    }
  s.text(name, x + cw / 2, y + u * 4, { size: 3.4, font: 'ui', weight: 700, color: s.c(k) });
}

const hardware: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const cx = w / 2;
    // A few fast cores, or thousands of slow ones.
    s.alpha(s.win('cpu', 'nvidia'), () => {
      const cw = Math.min(u * 50, (w - u * 14) / 2);
      const chh = u * 34;
      const lx = cx - cw - u * 3;
      const rx = cx + u * 3;
      const y0 = u * 10;
      const n = 16;
      const cpuDone = Math.max(0, Math.min(n, Math.floor(s.since('cpu') * 1.05 - 0.4)));
      const busy = cpuDone % 4;
      chip(s, lx, y0, cw, chh, 'slate', [2, 2], (i) => (cpuDone < n && i === busy ? 1 : 0.1), 'CPU');
      const gpuOn = s.ease('gpu', 0.4, 0.8);
      s.alpha(s.ease('gpu', 0.6), () => chip(s, rx, y0, cw, chh, 'green', [8, 16], (i) => gpuOn * (0.55 + 0.45 * hash(i, Math.floor(s.t * 4))), 'GPU'));
      const cs = cw / n;
      const ry = y0 + chh + u * 6;
      for (let i = 0; i < n; i++) {
        s.rrect(lx + i * cs + u * 0.2, ry, cs - u * 0.4, u * 5, 0.6, { fill: s.tint('slate', i < cpuDone ? 0.6 : 0.05), stroke: s.tint('slate', 0.5), lw: 0.25 });
        s.alpha(s.ease('gpu', 0.6), () => s.rrect(rx + i * cs + u * 0.2, ry, cs - u * 0.4, u * 5, 0.6, { fill: s.tint('green', gpuOn > 0.9 ? 0.6 : 0.05), stroke: s.tint('green', 0.5), lw: 0.25 }));
      }
      s.text(`${cpuDone} of ${n}`, lx + cw / 2, ry + u * 16, { size: 3, font: 'mono', color: s.c('slate') });
      s.alpha(s.ease('gpu', 0.6), () => s.text(`${gpuOn > 0.9 ? n : 0} of ${n}`, rx + cw / 2, ry + u * 16, { size: 3, font: 'mono', color: s.c('green') }));
      s.text('a few fast cores: one after another', lx + cw / 2, ry + u * 10, { size: fit(s, 'a few fast cores: one after another', cw, 3.2), color: s.c('--ink-2') });
      s.alpha(s.ease('gpu', 0.6), () => {
        s.text('thousands of slow cores: all at once', rx + cw / 2, ry + u * 10, { size: fit(s, 'thousands of slow cores: all at once', cw, 3.2), color: s.c('--ink-2') });
        s.alpha(s.ease('gpu', 0.6, 2.4), () => s.text('the same multiply-add, everywhere: a convolution', cx, u * 86, { size: fit(s, 'the same multiply-add, everywhere: a convolution', w - u * 10, 3.6), italic: true, color: s.c('green') }));
      });
    });
    // The software stack on NVIDIA GPUs.
    s.alpha(s.win('nvidia', 'copy'), () => {
      const bw = Math.min(w - u * 16, u * 100);
      const layers: [string, K][] = [
        ['your code', 'slate'],
        ['framework: Caffe, Torch, Theano, TensorFlow', 'purple'],
        ['cuBLAS · cuDNN · cuFFT', 'green'],
        ['CUDA: C that runs on the GPU', 'green'],
        ['NVIDIA GPU', 'slate'],
      ];
      layers.forEach(([t, k], i) => {
        const a = s.ease('nvidia', 0.4, 0.3 + (4 - i) * 0.55);
        s.alpha(a, () => box(s, cx, u * 16 + i * u * 13, bw, u * 10, t, k, { font: 'ui', size: 3.5, on: i === 2 ? 0.9 : 0.4 }));
      });
      s.alpha(s.ease('nvidia', 0.5, 4), () => s.text('the frameworks call these for you', cx, u * 86, { size: 3.6, italic: true, color: s.c('--ink-2') }));
    });
    // Bottlenecks: copies, disks, memory.
    s.alpha(s.win('copy', 'data'), () => {
      const bw = Math.min(u * 26, (w - u * 24) / 3);
      const xs = [cx - bw - u * 9, cx, cx + bw + u * 9];
      const y = u * 16;
      const dA = s.ease('disk', 0.6);
      box(s, xs[0]!, y, bw, u * 10, 'disk', 'slate', { on: dA, font: 'ui' });
      box(s, xs[1]!, y, bw, u * 10, 'CPU', 'slate', { font: 'ui' });
      box(s, xs[2]!, y, bw, u * 10, 'GPU', 'green', { font: 'ui' });
      s.arrow(xs[0]! + bw / 2 + u, y, xs[1]! - bw / 2 - u, y, s.c('--ink-3'), 0.4, 1.6);
      s.arrow(xs[1]! + bw / 2 + u, y, xs[2]! - bw / 2 - u, y, s.c('red'), 0.5, 1.8);
      s.text('slow copy', (xs[1]! + xs[2]!) / 2, y - u * 7, { size: 3, color: s.c('red'), weight: 600 });
      s.text('load, augment', xs[1]!, y + u * 8.5, { size: 2.9, color: s.c('--ink-3') });
      s.text('forward, backward', xs[2]!, y + u * 8.5, { size: 2.9, color: s.c('--ink-3') });
      s.alpha(dA, () => s.text('one big file, from an SSD', xs[0]!, y + u * 8.5, { size: fit(s, 'one big file, from an SSD', bw + u * 6, 2.9), color: s.c('slate'), weight: 600 }));
      // two lanes: the CPU prepares batch k + 1 while the GPU trains on batch k
      const lx = u * 20;
      const lw = w - lx - u * 6;
      const slot = lw / 5;
      const t0 = Math.max(0, s.since('copy'));
      const off = ((t0 * 0.6) % 1) * slot;
      const lanes: [string, number, K][] = [
        ['CPU', u * 38, 'slate'],
        ['GPU', u * 47, 'green'],
      ];
      const c = s.ctx;
      c.save();
      c.beginPath();
      c.rect(lx, u * 33, lw, u * 20);
      c.clip();
      lanes.forEach(([, ly, k], li) => {
        for (let j = -1; j < 7; j++) {
          const bn = j + Math.floor(t0 * 0.6) + (li === 0 ? 2 : 1);
          const x = lx + j * slot - off;
          s.rrect(x + u * 0.5, ly - u * 3, slot - u * 1, u * 6, 1, { fill: s.tint(k, 0.22), stroke: s.tint(k, 0.7), lw: 0.3 });
          s.text(`batch ${bn}`, x + slot / 2, ly + u * 0.2, { size: 2.9, font: 'mono', color: s.c(k) });
        }
      });
      c.restore();
      lanes.forEach(([nm, ly, k]) => s.text(nm, lx - u * 2, ly, { size: 3.2, font: 'ui', weight: 700, align: 'right', color: s.c(k) }));
      s.text('a separate thread prepares the next batch', cx, u * 58, { size: fit(s, 'a separate thread prepares the next batch', w - u * 10, 3.3), italic: true, color: s.c('--ink-2') });
      const mA = s.ease('mem', 0.6);
      s.alpha(mA, () => {
        const mw = Math.min(w - u * 16, u * 96);
        const mx = cx - mw / 2;
        const my = u * 72;
        s.rrect(mx, my, mw, u * 7, 1, { fill: s.tint('green', 0.08), stroke: s.tint('green', 0.7), lw: 0.35 });
        s.rrect(mx, my, (mw * 3) / 12 * s.ease('mem', 0.8, 0.6), u * 7, 1, { fill: s.tint('orange', 0.45) });
        s.text('GPU memory: 12 GB, the biggest card of early 2016', mx, my - u * 3.6, { size: fit(s, 'GPU memory: 12 GB, the biggest card of early 2016', mw, 3.2, { weight: 600 }), align: 'left', weight: 600 });
        s.text('AlexNet, batch 256: about 3 GB', mx, my + u * 11, { size: 3, align: 'left', color: s.c('orange') });
      });
    });
    // Several GPUs.
    s.alpha(s.ease('data', 0.6), () => {
      const g = u * 3;
      const gw = Math.min(u * 26, (w - u * 8 - 3 * g) / 4);
      const x0 = cx - (4 * gw + 3 * g) / 2;
      const y0 = u * 16;
      const gh = u * 24;
      const mp = s.ease('model', 0.7);
      const SK: K[] = ['orange', 'gold', 'red', 'purple'];
      s.text('a batch, split four ways', cx, u * 5.5, { size: 3.2, color: s.c('--ink-2') });
      for (let i = 0; i < 4; i++) s.rrect(x0 + i * (gw + g), u * 8.5, gw, u * 3, 0.5, { fill: s.tint(SK[i]!, 0.5) });
      for (let i = 0; i < 4; i++) {
        const x = x0 + i * (gw + g);
        s.rrect(x, y0, gw, gh, 1.6, { fill: s.tint('green', 0.06), stroke: s.tint('green', 0.7), lw: 0.35 });
        s.text(`GPU ${i + 1}`, x + gw / 2, y0 + u * 3.6, { size: 2.9, font: 'ui', weight: 700, color: s.c('green') });
        for (let l = 0; l < 3; l++) s.rrect(x + u * 2, y0 + u * 6.5 + l * u * 3.6, gw - u * 4, u * 2.6, 0.4, { fill: s.tint('blue', 0.35) });
        s.alpha(1 - mp, () => s.rrect(x + u * 2, y0 + u * 18, gw - u * 4, u * 2.6, 0.4, { fill: s.tint('blue', 0.35) }));
        s.rrect(x + gw * 0.3, y0 + gh - u * 2.6, gw * 0.4, u * 1.6, 0.3, { fill: s.tint(SK[i]!, 0.6) });
      }
      s.alpha(mp, () => {
        s.rrect(x0 + u * 2, y0 + u * 18, 4 * gw + 3 * g - u * 4, u * 2.6, 0.4, { fill: s.tint('purple', 0.4), stroke: s.c('purple'), lw: 0.3 });
        s.text('conv layers: copied (data parallel)', x0 + 4 * gw + 3 * g, y0 + gh + u * 4, { size: fit(s, 'conv layers: copied (data parallel)', 4 * gw, 3), align: 'right', color: s.c('blue') });
        s.text('fc layer: split (model parallel)', x0 + 4 * gw + 3 * g, y0 + gh + u * 8.5, { size: fit(s, 'fc layer: split (model parallel)', 4 * gw, 3), align: 'right', color: s.c('purple') });
      });
      s.alpha(1 - mp, () => s.text('each GPU: the whole model, a slice of the batch', cx, y0 + gh + u * 5, { size: fit(s, 'each GPU: the whole model, a slice of the batch', w - u * 10, 3.2), color: s.c('--ink-2') }));
      // sync and async timelines
      const tA = s.ease('sync', 0.6);
      s.alpha(tA, () => {
        const lx = u * 12;
        const lw = w - lx - u * 5;
        const ly0 = u * 64;
        const lh = u * 6;
        const asy = s.ease('async', 0.6);
        s.text(asy > 0.5 ? 'asynchronous: no waiting, stale weights' : 'synchronous: wait, average, update', cx, ly0 - u * 5, { size: fit(s, 'asynchronous: no waiting, stale weights', w - u * 10, 3.4, { weight: 650 }), weight: 650, color: s.c(asy > 0.5 ? 'gold' : 'teal') });
        const rounds = 3;
        const per = lw / rounds;
        const tl = clamp01(s.since(asy > 0.5 ? 'async' : 'sync') / 4);
        for (let wk = 0; wk < 4; wk++) {
          const y = ly0 + wk * lh;
          s.text(`${wk + 1}`, lx - u * 2.5, y + lh / 2, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
          if (asy < 0.5) {
            for (let r = 0; r < rounds; r++) {
              const len = per * (0.45 + 0.4 * hash(wk, r));
              const x = lx + r * per;
              const vis = clamp01(tl * rounds - r);
              s.rrect(x, y + u * 0.6, len * vis, lh - u * 1.2, 0.4, { fill: s.tint(SK[wk]!, 0.5) });
              if (vis >= 1) s.rrect(x + len, y + lh / 2 - u * 0.25, per * 0.88 - len, u * 0.5, 0, { fill: s.tint('--ink', 0.18) });
            }
          } else {
            let x = lx;
            let r = 0;
            while (x < lx + lw * tl && r < 8) {
              const len = per * (0.4 + 0.45 * hash(wk, r + 5));
              const vis = Math.min(len, lx + lw * tl - x);
              s.rrect(x, y + u * 0.6, vis, lh - u * 1.2, 0.4, { fill: s.tint(SK[wk]!, 0.5) });
              if (vis >= len) s.line(x + len, y, x + len, y + lh, s.c('gold'), 0.45);
              x += len + u * 0.6;
              r++;
            }
          }
        }
        if (asy < 0.5)
          for (let r = 1; r <= rounds; r++) {
            if (tl * rounds < r) continue;
            const x = lx + r * per - per * 0.1;
            s.line(x, ly0 - u * 0.5, x, ly0 + 4 * lh + u * 0.5, s.c('teal'), 0.5);
          }
      });
    });
  },
};

// ---------------------------------------------------------------- precision

const T16 = 400;
const STEP = 1e-4;
const W32: number[] = [1];
const WN: number[] = [1];
const WS: number[] = [1];
{
  const r = new Rng(3);
  for (let t = 0; t < T16; t++) {
    W32.push(Math.fround(W32[t]! - STEP));
    WN.push(round16(WN[t]! - STEP));
    WS.push(roundStoch16(WS[t]! - STEP, r.next()));
  }
}

const FORMATS: [string, string, number, number, string][] = [
  ['f64', 'double, 64 bits', 11, 52, "NumPy's default"],
  ['f32', 'single, 32 bits', 8, 23, 'training in 2016'],
  ['f16', 'half, 16 bits', 5, 10, 'the prediction'],
  ['f16', 'binary, 1 bit', 0, 0, 'research'],
];

const precision: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const cx = w / 2;
    // Bits per number.
    s.alpha(s.win('bits', 'danger'), () => {
      s.text('bits per number', cx, u * 9, { size: 5, font: 'display', weight: 600 });
      const x0 = u * 6;
      const bw = (w - u * 12) / 64;
      FORMATS.forEach(([id, name, ex, fr, note], i) => {
        const a = id === 'f64' ? s.ease('bits', 0.5, 0.8) : s.ease(id, 0.5, i === 3 ? 2.2 : 0);
        const on = current(s, ['f64', 'f32', 'f16']) === id ? 1 : 0;
        s.alpha(a, () => {
          const y = u * 22 + i * u * 16;
          s.text(name, x0, y, { size: 3.4, font: 'mono', weight: 650, align: 'left', color: s.c(on ? '--ink' : '--ink-2') });
          s.text(note, w - u * 6, y, { size: 3.1, align: 'right', italic: true, color: s.c('--ink-3') });
          const n = 1 + ex + fr;
          for (let b = 0; b < n; b++) {
            const k: K = b === 0 ? 'red' : b <= ex ? 'gold' : 'blue';
            s.rrect(x0 + b * bw, y + u * 3, Math.max(1, bw - u * 0.25), u * 4.5, 0.15, { fill: s.tint(k, 0.35 + 0.4 * on) });
          }
        });
      });
      s.alpha(s.ease('f64', 0.5, 1), () => {
        const y = h - u * 7;
        [['sign', 'red'], ['exponent', 'gold'], ['fraction', 'blue']].forEach(([t, k], i) => {
          const x = cx - u * 30 + i * u * 22;
          s.rrect(x, y - u * 1.6, u * 3, u * 3, 0.4, { fill: s.tint(k as K, 0.7) });
          s.text(t!, x + u * 4.5, y, { size: 3, align: 'left', color: s.c('--ink-2') });
        });
      });
    });
    // float16 just below 1.0.
    s.alpha(s.win('danger', 'sr'), () => {
      s.text('float16 values near 1.0', cx, u * 9, { size: 5, font: 'display', weight: 600 });
      const lo = 0.99832;
      const hi = 1.0012;
      const x0 = u * 8;
      const x1 = w - u * 8;
      const X = (v: number) => lerp(x0, x1, (v - lo) / (hi - lo));
      const y = u * 47;
      s.line(x0, y, x1, y, s.tint('--ink', 0.35), 0.3);
      const ticks: number[] = [];
      for (let k = 0; k < 4; k++) ticks.push(1 - k * 2 ** -11);
      ticks.push(1 + 2 ** -10);
      ticks.forEach((v) => {
        s.line(X(v), y - u * 3, X(v), y + u * 3, s.c('--ink-2'), 0.4);
      });
      s.text('1.0', X(1), y + u * 7, { size: 3.2, font: 'mono', weight: 600 });
      s.text('0.99951', X(1 - 2 ** -11), y + u * 7, { size: 3, font: 'mono', color: s.c('--ink-2') });
      s.text('1.00098', X(1 + 2 ** -10), y + u * 7, { size: 3, font: 'mono', color: s.c('--ink-2') });
      // the gap
      const ga = X(1 - 2 ** -11);
      const gb = X(1);
      s.line(ga, y - u * 7, gb, y - u * 7, s.c('--accent'), 0.4);
      s.line(ga, y - u * 8.5, ga, y - u * 5.5, s.c('--accent'), 0.4);
      s.line(gb, y - u * 8.5, gb, y - u * 5.5, s.c('--accent'), 0.4);
      s.text('gap ≈ 0.0005', (ga + gb) / 2, y - u * 10.5, { size: 3.2, font: 'mono', weight: 600, color: s.c('--accent') });
      const stA = s.ease('stuck', 0.6);
      const cyc = s.since('stuck') >= 0 ? (s.since('stuck') % 1.8) / 1.8 : 0;
      const k = s.since('stuck') >= 0 ? Math.floor(s.since('stuck') / 1.8) + 1 : 0;
      const out = stA > 0 ? smooth(clamp01(cyc / 0.35)) * (1 - smooth(clamp01((cyc - 0.55) / 0.25))) : 0;
      const vx = lerp(X(1), X(1 - STEP), out);
      s.alpha(stA * out, () => {
        s.circle(X(1 - STEP), y, u * 1.6, { stroke: s.c('blue'), lw: 0.4, fill: s.c('--card') });
        s.text('1 − 0.0001', X(1 - STEP), y + u * 15, { size: 3, font: 'mono', color: s.c('blue') });
      });
      s.circle(vx, y, u * 1.9, { fill: s.c('blue') });
      s.alpha(stA, () => {
        s.text('round to nearest → back to 1.0', cx, u * 72, { size: 3.6, weight: 600, color: s.c('red') });
        s.text(`step ${k}:  w = 1.0`, cx, u * 81, { size: 3.6, font: 'mono', color: s.c('--ink-2') });
      });
    });
    // Stochastic rounding.
    s.alpha(s.win('sr', 'avg'), () => {
      s.text('stochastic rounding', cx, u * 9, { size: 5, font: 'display', weight: 600 });
      const x0 = u * 12;
      const x1 = w - u * 12;
      const y = u * 46;
      const v = 1 - STEP;
      const lo = 1 - 2 ** -11;
      const f = (v - lo) / 2 ** -11;
      const vx = lerp(x0, x1, f);
      s.line(x0, y, x1, y, s.tint('--ink', 0.35), 0.3);
      s.line(x0, y - u * 3, x0, y + u * 3, s.c('--ink-2'), 0.4);
      s.line(x1, y - u * 3, x1, y + u * 3, s.c('--ink-2'), 0.4);
      s.text('0.99951', x0, y + u * 7, { size: 3, font: 'mono' });
      s.text('1.0', x1, y + u * 7, { size: 3, font: 'mono' });
      s.circle(vx, y, u * 1.6, { stroke: s.c('blue'), lw: 0.4, fill: s.c('--card') });
      s.text('v = 0.9999', vx, y + u * 7, { size: 3, font: 'mono', color: s.c('blue') });
      const a = s.ease('sr', 0.6, 1.4);
      s.alpha(a, () => {
        const c = s.ctx;
        const arc = (xa: number, xb: number, lw: number, col: string) => {
          c.beginPath();
          c.moveTo(xa, y - u * 2.4);
          c.quadraticCurveTo((xa + xb) / 2, y - u * 16, xb, y - u * 2.4);
          c.strokeStyle = col;
          c.lineWidth = lw * u;
          c.stroke();
        };
        arc(vx, x1, 0.3 + 1.2 * f, s.c('teal'));
        arc(vx, x0, 0.3 + 1.2 * (1 - f), s.c('teal'));
        s.text(`up: ${Math.round(f * 100)}%`, (vx + x1) / 2, y - u * 13, { size: 3.4, font: 'mono', weight: 650, color: s.c('teal'), halo: true });
        s.text(`down: ${Math.round((1 - f) * 100)}%`, (vx + x0) / 2, y - u * 13, { size: 3.4, font: 'mono', weight: 650, color: s.c('teal'), halo: true });
        s.text('chance of up = how far v is past the lower neighbor', cx, u * 66, { size: fit(s, 'chance of up = how far v is past the lower neighbor', w - u * 10, 3.4), color: s.c('--ink-2') });
        s.text(`average: ${f.toFixed(2)} · 1.0 + ${(1 - f).toFixed(2)} · 0.99951 = 0.9999`, cx, u * 75, { size: fit(s, `average: ${f.toFixed(2)} · 1.0 + ${(1 - f).toFixed(2)} · 0.99951 = 0.9999`, w - u * 10, 3.3, { font: 'mono' }), font: 'mono', color: s.c('teal') });
      });
    });
    // 400 updates, three ways.
    s.alpha(s.ease('avg', 0.6), () => {
      const px0 = u * 16;
      const px1 = w - u * 6;
      const py0 = u * 12;
      const py1 = u * 70;
      const ylo = 0.955;
      const yhi = 1.004;
      const X = (t: number) => lerp(px0, px1, t / T16);
      const Y = (v: number) => lerp(py1, py0, (v - ylo) / (yhi - ylo));
      [0.96, 0.98, 1].forEach((v) => {
        s.line(px0, Y(v), px1, Y(v), s.c('--grid'), 0.25);
        s.text(v.toFixed(2), px0 - u * 1.5, Y(v), { size: 2.9, font: 'mono', align: 'right', color: s.c('--ink-3') });
      });
      [0, 200, 400].forEach((t) => s.text(String(t), X(t), py1 + u * 4, { size: 2.9, font: 'mono', color: s.c('--ink-3') }));
      s.text('updates of 0.0001', (px0 + px1) / 2, py1 + u * 9, { size: 3, color: s.c('--ink-3') });
      const n = Math.max(1, Math.floor(T16 * s.ease('avg', 3.5, 0.4)));
      const line = (arr: number[], col: string, lw: number, dash?: number[]) => {
        const c = s.ctx;
        c.beginPath();
        for (let t = 0; t <= n; t++) (t ? c.lineTo : c.moveTo).call(c, X(t), Y(arr[t]!));
        c.strokeStyle = col;
        c.lineWidth = lw * u;
        c.setLineDash(dash ? dash.map((d) => d * u) : []);
        c.stroke();
        c.setLineDash([]);
      };
      line(W32, s.c('--ink-2'), 0.45, [1.4, 1]);
      line(WN, s.c('red'), 0.55);
      line(WS, s.c('teal'), 0.4);
      const lx = X(206);
      const ly = Y(0.9952);
      s.rrect(lx - u * 2, ly - u * 4, px1 - lx + u * 1.5, u * 15.5, 1.4, { fill: s.tint('--card', 0.92), stroke: s.c('--rule'), lw: 0.3 });
      ([
        ['float32 (the truth)', '--ink-2'],
        ['float16, round to nearest', 'red'],
        ['float16, stochastic', 'teal'],
      ] as [string, K][]).forEach(([t, k], i) => s.text(t, lx, ly + i * u * 4.6, { size: fit(s, 'float16, round to nearest', px1 - lx - u * 1, 3.1, { weight: 600 }), align: 'left', weight: 600, color: s.c(k) }));
      s.alpha(s.ease('gupta', 0.6), () => pill(s, '16-bit fixed point training: Gupta et al., 2015', cx, u * 89, 'green', { size: fit(s, '16-bit fixed point training: Gupta et al., 2015', w - u * 12, 3.3, { font: 'ui', weight: 600 }) }));
    });
  },
};

// ---------------------------------------------------------------- software

const FW: [string, string, string, string][] = [
  ['Caffe', 'C++, Python', 'UC Berkeley', 'fine-tuning, no code'],
  ['Torch', 'Lua', 'NYU, Facebook', 'writing new layers'],
  ['Theano', 'Python', 'U. Montreal', 'recurrent nets'],
  ['TensorFlow', 'Python', 'Google', 'recurrent nets, huge models'],
];

const software: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const cx = w / 2;
    // Four frameworks, two jobs.
    s.alpha(s.win('nobody', 'graph'), () => {
      const g = u * 4;
      const cw = Math.min(u * 52, (w - u * 8 - g) / 2);
      const chh = u * 19;
      const x0 = cx - cw - g / 2;
      FW.forEach(([nm, lang, org], i) => {
        const a = s.ease('nobody', 0.4, 2.4 + i * 0.7);
        s.alpha(a, () => {
          const x = x0 + (i % 2) * (cw + g);
          const y = u * 8 + Math.floor(i / 2) * (chh + u * 3);
          card(s, x, y, cw, chh, 'purple', 0.3);
          s.text(nm, x + cw / 2, y + u * 6.5, { size: fit(s, nm, cw - u * 4, 4.6, { font: 'display', weight: 600 }), font: 'display', weight: 600 });
          s.text(`${lang} · ${org}`, x + cw / 2, y + u * 13.5, { size: fit(s, `${lang} · ${org}`, cw - u * 4, 3.1), color: s.c('--ink-2') });
        });
      });
      s.alpha(s.ease('jobs', 0.6), () => {
        pill(s, '1. run fast on GPUs', cx, u * 64, 'green', { size: 3.6 });
        pill(s, '2. compute the gradients for you', cx, u * 76, 'teal', { size: 3.6 });
      });
    });
    // The graph Theano builds, differentiates, compiles and runs.
    const gA = s.win('graph', 'tf');
    s.alpha(gA, () => {
      const names = ['x', 'dot', 'relu', 'dot', 'softmax', 'ce', 'loss'];
      const ks: K[] = ['orange', '--ink-2', '--ink-2', '--ink-2', 'teal', '--ink-2', 'red'];
      const n = names.length;
      const x0 = u * 10;
      const x1 = w - u * 10;
      const xs = names.map((_, i) => lerp(x0, x1, i / (n - 1)));
      const y = u * 42;
      const nw = Math.min(u * 13, ((x1 - x0) / (n - 1)) * 0.78);
      const nh = u * 8;
      const sym = s.ease('sym', 0.6);
      const run = s.ease('run', 0.6);
      const bwd = Math.max(s.ease('auto', 0.6), clamp01((s.t - at(s, 'graph', 0.5)) / 0.6));
      const comp = s.ease('compile', 0.6, 1);
      s.text('a computational graph', cx, u * 9, { size: 4.6, font: 'display', weight: 600 });
      const ins: [number, string, K][] = [
        [1, 'w1', 'blue'],
        [3, 'w2', 'blue'],
        [5, 'y', 'gold'],
      ];
      for (let i = 0; i < n - 1; i++) s.arrow(xs[i]! + nw / 2, y, xs[i + 1]! - nw / 2 - u * 0.4, y, s.c('--ink-3'), 0.35, 1.5);
      ins.forEach(([i, nm, k]) => {
        s.arrow(xs[i]!, y + u * 13, xs[i]!, y + nh / 2 + u * 0.6, s.c('--ink-3'), 0.35, 1.5);
        s.text(nm, xs[i]!, y + u * 16, { size: 3.4, font: 'mono', weight: 650, color: s.c(k) });
      });
      names.forEach((nm, i) => {
        const term = i === 0 || i === n - 1;
        const k = ks[i]!;
        const c = s.ctx;
        c.save();
        if (sym > 0 && run < 0.5) c.setLineDash([u * 0.9, u * 0.6]);
        s.rrect(xs[i]! - nw / 2, y - nh / 2, nw, nh, term ? 3.5 : 1.4, { fill: s.tint(k, 0.08 + 0.2 * run), stroke: s.tint(k, 0.8), lw: 0.35 });
        c.restore();
        s.text(nm, xs[i]!, y + u * 0.2, { size: fit(s, nm, nw - u * 1.2, 3.2, { font: 'ui', weight: 650 }), font: 'ui', weight: 650, color: s.c(k) });
      });
      s.alpha(sym * (1 - run), () => s.text('dashed: symbolic, no data yet', cx, y + u * 33, { size: 3.4, italic: true, color: s.c('--ink-2') }));
      // backward pass, derived
      s.alpha(bwd, () => {
        const by = y - u * 8;
        s.arrow(xs[n - 1]!, by, xs[1]! - u * 1, by, s.c('teal'), 0.5, 1.8);
        const lab = s.since('auto') >= 0 ? 'backprop, derived for you: dw1, dw2' : 'backprop: the chain rule, run backward';
        s.text(lab, (xs[1]! + xs[n - 1]!) / 2, by - u * 3.4, { size: fit(s, 'backprop, derived for you: dw1, dw2', x1 - x0, 3.1, { weight: 600 }), weight: 600, color: s.c('teal'), halo: true });
      });
      s.alpha(comp, () => {
        s.rrect(x0 - nw / 2 - u * 2, y - u * 17, x1 - x0 + nw + u * 4, u * 38, 2, { stroke: s.c('purple'), lw: 0.5 });
        s.text('f = theano.function(...)', x0 - nw / 2 - u * 1, y + u * 24, { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c('purple') });
      });
      // real arrays flowing through
      s.alpha(run, () => {
        const p = (s.since('run') * 0.9) % 1;
        for (let i = 0; i < n - 1; i++) {
          const q = clamp01(p * (n - 1) - i);
          if (q > 0 && q < 1) s.circle(lerp(xs[i]! + nw / 2, xs[i + 1]! - nw / 2, q), y, u * 1.2, { fill: s.c('orange') });
        }
        s.text('out = f(xx, yy, ww1, ww2)', cx, u * 84, { size: 3.4, font: 'mono', weight: 600, color: s.c('orange') });
      });
    });
    // What each was good for.
    s.alpha(s.win('tf', 'later'), () => {
      s.text('the four frameworks, 2016', cx, u * 9, { size: 4.6, font: 'display', weight: 600 });
      const x0 = Math.max(u * 5, cx - u * 64);
      const x1 = Math.min(w - u * 5, cx + u * 64);
      const tw = x1 - x0;
      const cols = [x0 + u * 2, x0 + tw * 0.31, x0 + tw * 0.53];
      const hy = u * 20;
      ['framework', 'language', 'best for'].forEach((t, i) => s.text(t, cols[i]!, hy, { size: 3, align: 'left', weight: 650, color: s.c('--ink-3') }));
      s.line(x0, hy + u * 3, x1, hy + u * 3, s.c('--rule'), 0.3);
      const beat = current(s, ['tf', 'caffe', 'torch']);
      const lit = (i: number) => (beat === 'tf' ? i >= 2 : beat === 'caffe' ? i === 0 : beat === 'torch' ? i === 1 : false);
      FW.forEach(([nm, lang, , best], i) => {
        const y = hy + u * 11 + i * u * 13;
        const on = lit(i) ? 1 : 0;
        if (on) s.rrect(x0, y - u * 5, tw, u * 10, 1.4, { fill: s.tint('--accent', 0.1) });
        s.text(nm, cols[0]!, y, { size: fit(s, nm, cols[1]! - cols[0]! - u * 2, 3.9, { font: 'display', weight: 600 }), font: 'display', weight: 600, align: 'left' });
        s.text(lang, cols[1]!, y, { size: fit(s, lang, cols[2]! - cols[1]! - u * 2, 3.2, { font: 'mono' }), font: 'mono', align: 'left', color: s.c('--ink-2') });
        s.text(best, cols[2]!, y, { size: fit(s, best, x1 - cols[2]! - u * 1, 3.3, { weight: 600 }), weight: on ? 650 : 450, align: 'left', color: s.c(on ? '--ink' : '--ink-2') });
      });
      s.alpha(s.ease('tf', 0.5, 2), () => s.text('TensorFlow: placeholders, Variables, a Session', cx, u * 84, { size: fit(s, 'TensorFlow: placeholders, Variables, a Session', w - u * 10, 3.2, { font: 'mono' }), font: 'mono', color: s.c('--ink-2') }));
    });
    // What happened next.
    s.alpha(s.ease('later', 0.6), () => {
      s.text('later context: what happened next', cx, u * 9, { size: fit(s, 'later context: what happened next', w - u * 10, 4.6, { font: 'display', weight: 600 }), font: 'display', weight: 600 });
      const x0 = u * 10;
      const x1 = w - u * 10;
      const X = (yr: number) => lerp(x0, x1, (yr - 2015) / 5);
      const y = u * 50;
      s.line(x0, y, x1, y, s.tint('--ink', 0.4), 0.35);
      for (let yr = 2015; yr <= 2020; yr++) {
        s.line(X(yr), y - u * 1.4, X(yr), y + u * 1.4, s.tint('--ink', 0.4), 0.35);
        s.text(String(yr), X(yr), y + u * 5, { size: 2.9, font: 'mono', color: s.c('--ink-3') });
      }
      const ev: [number, string, number, K][] = [
        [2015.9, 'TensorFlow', -1, 'slate'],
        [2017.05, 'PyTorch', 1, '--accent'],
        [2017.8, 'Theano ends', -2, 'slate'],
        [2018.3, 'Caffe2 joins PyTorch', 2, 'slate'],
        [2019.75, 'TF 2: eager', -1, 'slate'],
      ];
      ev.forEach(([yr, t, tier, k], i) => {
        const a = s.ease('later', 0.4, 0.5 + i * 0.7);
        s.alpha(a, () => {
          const ty = y + tier * u * 10 + (tier > 0 ? u * 3 : 0);
          s.line(X(yr), tier > 0 ? y + u * 8 : y, X(yr), ty + (tier > 0 ? -u * 2.5 : u * 2), s.tint(k, 0.6), 0.3);
          s.circle(X(yr), y, u * 1.2, { fill: s.c(k) });
          const al: CanvasTextAlign = X(yr) < x0 + u * 14 ? 'left' : X(yr) > x1 - u * 14 ? 'right' : 'center';
          s.text(t, X(yr), ty, { size: 3.2, weight: 650, align: al, color: s.c(k), halo: true });
        });
      });
      s.alpha(s.ease('later', 0.5, 3.2), () => {
        s.text('PyTorch: define by run, the graph is built as the code runs', cx, u * 82, { size: fit(s, 'PyTorch: define by run, the graph is built as the code runs', w - u * 10, 3.3), italic: true, color: s.c('--ink-2') });
      });
    });
  },
};

// ---------------------------------------------------------------- outro

const RECAP: [string, string, K][] = [
  ['augment', 'label-keeping noise; average fixed views', 'orange'],
  ['transfer', 'start from ImageNet, fine-tune as data grows', 'teal'],
  ['stack', '3×3s, 1×1 bottlenecks, 1×N: cheaper, deeper', 'blue'],
  ['compute', 'im2col, FFT, Winograd; GPUs; fewer bits', 'green'],
  ['software', 'the framework derives the gradients', 'purple'],
];

const outro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const cx = w / 2;
    const ids = ['r1', 'r2', 'r3', 'r4', 'r5'];
    const cur = current(s, ids);
    const nA = s.ease('next', 0.7);
    s.alpha(1 - nA, () => {
      const rw = Math.min(w - u * 10, u * 120);
      const x0 = cx - rw / 2;
      RECAP.forEach(([nm, t, k], i) => {
        const a = s.ease(ids[i]!, 0.5);
        if (a <= 0) return;
        const y = u * 7 + i * u * 17.5;
        const on = cur === ids[i] ? 1 : 0.3;
        s.alpha(a, () => {
          card(s, x0, y, rw, u * 14.5, k, on);
          s.circle(x0 + u * 7, y + u * 7.25, u * 3.2, { fill: s.tint(k, 0.2 + 0.7 * on), stroke: s.c(k), lw: 0.3 });
          s.text(String(i + 1), x0 + u * 7, y + u * 7.5, { size: 3.4, font: 'ui', weight: 700, color: on > 0.5 ? '#fff' : s.c(k) });
          s.text(nm, x0 + u * 13, y + u * 4.8, { size: 3.6, font: 'display', weight: 600, align: 'left', color: s.c(k) });
          s.text(t, x0 + u * 13, y + u * 10.2, { size: fit(s, t, rw - u * 16, 3.3), align: 'left', color: s.c('--ink-2') });
        });
      });
    });
    s.alpha(nA, () => {
      s.text('next: the interactive chapter', cx, h * 0.4, { size: fit(s, 'next: the interactive chapter', w - u * 10, 6.4, { font: 'display', weight: 600 }), font: 'display', weight: 600 });
      s.text('real CIFAR-10 augmentations, a transfer-strategy map,', cx, h * 0.53, { size: fit(s, 'real CIFAR-10 augmentations, a transfer-strategy map,', w - u * 10, 3.8), italic: true, color: s.c('--ink-2') });
      s.text('im2col step by step, and the rounding race', cx, h * 0.53 + u * 6, { size: fit(s, 'real CIFAR-10 augmentations, a transfer-strategy map,', w - u * 10, 3.8), italic: true, color: s.c('--ink-2') });
      s.alpha(s.ease('bye', 0.6), () => s.text('see you there', cx, h * 0.74, { size: 4.6, font: 'display', italic: true, color: s.c('--accent') }));
    });
  },
};

export const scenesC: Record<string, SceneDef> = { fast, hardware, precision, software, outro };
