import { Rng } from '../../core/rand';
import { type Scene, type SceneDef, clamp01, lerp } from '../../lecture/scene';
import {
  CURVES,
  HALF,
  type K,
  LETTERS,
  QI,
  SEQ,
  arc,
  area,
  box,
  cellXY,
  circuitsFinal,
  drawStrip,
  fitSize,
  heatGrid,
  inductionScore,
  lensProbs,
  letterBars,
  pill,
  pillRows,
  poly,
  stripAt,
  traceEarly,
  traceFinal,
} from './kit';

/* ------------------------------------------------------------------ intro */

/** Seeded 3x3 patches and a saliency blob for the ConvNet tiles. */
const PATCHES: number[][][] = (() => {
  const r = new Rng(5);
  return Array.from({ length: 4 }, () => Array.from({ length: 9 }, () => [r.next(), r.next(), r.next()]));
})();

const PLAN: [string, K][] = [
  ['residual stream', 'orange'],
  ['QK and OV circuits', 'blue'],
  ['induction heads', 'purple'],
  ['probes', 'teal'],
  ['superposition', 'green'],
  ['sparse autoencoders', 'gold'],
];

function convTiles(s: Scene, x: number, y: number, w: number, h: number): void {
  const { u } = s;
  const gap = u * 3;
  const tw = (w - 2 * gap) / 3;
  const side = Math.min(tw * 0.8, h - u * 9);
  const labels = ['filters', 'saliency', 'what excites a unit'];
  labels.forEach((lab, k) => {
    const cx = x + k * (tw + gap) + tw / 2;
    const x0 = cx - side / 2;
    const y0 = y;
    s.alpha(s.ease('convnets', 0.5, 0.5 + 0.5 * k), () => {
      s.rrect(x0, y0, side, side, 1.2, { fill: s.c('--paper-2'), stroke: s.c('--rule'), lw: 0.3 });
      if (k === 0) {
        const cs = side / 2 - u;
        PATCHES.forEach((p, q) => {
          const px = x0 + u * 0.7 + (q % 2) * (cs + u * 0.6);
          const py = y0 + u * 0.7 + Math.floor(q / 2) * (cs + u * 0.6);
          p.forEach((c, i) => {
            s.ctx.fillStyle = `rgb(${Math.round(60 + 180 * c[0]!)},${Math.round(60 + 150 * c[1]!)},${Math.round(70 + 160 * c[2]!)})`;
            s.ctx.fillRect(px + (i % 3) * (cs / 3), py + Math.floor(i / 3) * (cs / 3), cs / 3 - 0.5, cs / 3 - 0.5);
          });
        });
      } else if (k === 1) {
        const n = 8;
        const cs = side / n;
        for (let i = 0; i < n; i++)
          for (let j = 0; j < n; j++) {
            const d = Math.hypot(i - 3.2, j - 4.4);
            s.ctx.fillStyle = s.tint('red', clamp01(1 - d / 3.6) * 0.85);
            s.ctx.fillRect(x0 + j * cs, y0 + i * cs, cs - 0.5, cs - 0.5);
          }
      } else {
        for (let r = 6; r >= 1; r--) s.circle(x0 + side / 2, y0 + side / 2, (side / 2) * (r / 6.4), { fill: r % 2 ? s.tint('purple', 0.18 + 0.1 * (6 - r)) : s.c('--paper-2') });
      }
      s.text(lab, cx, y0 + side + u * 4, { font: 'ui', size: fitSize(s, lab, tw, 3.4), weight: 600, color: s.c('--ink-2') });
    });
  });
}

const intro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const tA = s.win('hello', 'convnets');
    s.alpha(tA, () => {
      const t = 'Looking inside language models';
      s.text(t, w / 2, h * 0.44, { font: 'display', weight: 600, size: fitSize(s, t, w - u * 14, 9, 'display') });
      s.alpha(s.ease('hello', 0.8, 1), () => s.text('Chapter 20', w / 2, h * 0.44 + u * 10, { font: 'mono', size: 3.6, color: s.c('--ink-3') }));
    });
    const [ax, ay, aw, ah] = area(s, 0.14);
    // ConvNet pictures, then where versus what.
    const cA = s.win('convnets', 'goal');
    s.alpha(cA, () => {
      convTiles(s, ax, ay + ah * 0.08, aw, ah * 0.5);
      s.alpha(s.ease('where', 0.6), () => {
        const y = ay + ah * 0.72;
        s.text('where a network looks', w / 2, y, { font: 'display', size: 5, weight: 600, color: s.c('teal') });
        s.alpha(s.ease('where', 0.6, 2.2), () => s.text('but not how it computes', w / 2, y + u * 8, { size: 4, italic: true, color: s.c('--ink-2') }));
      });
    });
    // Weights to a program.
    const gA = s.win('goal', 'plan1');
    if (gA > 0)
      s.alpha(gA, () => {
        const gw = s.tall ? aw : aw * 0.42;
        const rows = 6;
        const cols = 6;
        const cs = Math.min((s.tall ? ah * 0.3 : ah * 0.55) / rows, gw / cols);
        const gx = s.tall ? ax + (aw - cols * cs) / 2 : ax + (gw - cols * cs) / 2;
        const gy = s.tall ? ay + u * 2 : ay + (ah - rows * cs) / 2 - u * 4;
        const r = new Rng(9);
        for (let i = 0; i < rows; i++)
          for (let j = 0; j < cols; j++) {
            const v = r.randn();
            s.rrect(gx + j * cs + 1, gy + i * cs + 1, cs - 2, cs - 2, 0.6, { fill: s.tint(v > 0 ? 'blue' : 'slate', 0.12 + 0.25 * Math.min(1, Math.abs(v))) });
            if (cs > u * 6) s.text(v.toFixed(1), gx + j * cs + cs / 2, gy + i * cs + cs / 2 + u * 0.2, { font: 'mono', size: Math.min(2.8, (cs / u) * 0.3), color: s.c('--ink-2') });
          }
        s.text('weights', gx + (cols * cs) / 2, gy + rows * cs + u * 4, { font: 'ui', size: 3.4, weight: 600, color: s.c('blue') });
        const lines = ['if seen  A B', 'and now  A:', '  predict  B'];
        const pa = s.ease('goal', 0.6, 2.4);
        const px = s.tall ? ax + aw * 0.12 : ax + aw * 0.58;
        const py = s.tall ? gy + rows * cs + u * 16 : ay + ah * 0.32;
        s.alpha(pa, () => {
          if (s.tall) s.arrow(w / 2, gy + rows * cs + u * 6.5, w / 2, py - u * 3, s.tint('--ink-3', 0.8), 0.4, 2);
          else s.arrow(ax + gw + u * 2, ay + ah * 0.42, px - u * 3, ay + ah * 0.42, s.tint('--ink-3', 0.8), 0.4, 2);
          const lw = s.tall ? aw * 0.76 : aw * 0.4;
          s.rrect(px, py - u * 1.5, lw, u * 25, 2, { fill: s.tint('purple', 0.07), stroke: s.tint('purple', 0.5), lw: 0.3 });
          lines.forEach((l, i) => s.text(l, px + u * 4, py + u * 4.5 + i * u * 6.5, { font: 'mono', size: fitSize(s, 'and now  A:  ', lw * 0.8, 4.2, 'mono'), align: 'left', color: s.c('--ink') }));
          s.text('the algorithm', px + lw / 2, py + u * 28, { font: 'ui', size: 3.4, weight: 600, color: s.c('purple') });
        });
        s.alpha(s.ease('name', 0.6), () => {
          const y = s.tall ? h - u * 6 : ay + ah - u * 2;
          s.text('mechanistic interpretability', w / 2, y, { font: 'display', size: fitSize(s, 'mechanistic interpretability', aw, 5.4, 'display'), weight: 600, color: s.c('--accent') });
        });
      });
    // The plan.
    const pA = s.ease('plan1', 0.6);
    if (pA > 0) {
      const cols = s.tall ? 2 : 3;
      const gap = u * 3;
      const bw = (aw - gap * (cols - 1)) / cols;
      const bh = Math.min(u * 15, (ah * 0.75 - gap * 2) / Math.ceil(PLAN.length / cols));
      const oy = ay + (ah - Math.ceil(PLAN.length / cols) * (bh + gap)) / 2;
      const lit = s.since('plan3') >= 0 ? [4, 5] : s.since('plan2') >= 0 ? [2, 3] : [0, 1];
      PLAN.forEach(([lab, k], i) => {
        const beat = i < 2 ? 'plan1' : i < 4 ? 'plan2' : 'plan3';
        const a = s.ease(beat, 0.5, 0.3 * (i % 2));
        const x = ax + (i % cols) * (bw + gap);
        const y = oy + Math.floor(i / cols) * (bh + gap);
        s.alpha(pA * a, () => box(s, x, y, bw, bh, lab, k, { on: lit.includes(i) ? 1 : 0, size: 4 }));
      });
    }
  },
};

/* ------------------------------------------------------------------ stream */

const LAYERS: [string, K][] = [
  ['attention 0', 'purple'],
  ['MLP 0', 'blue'],
  ['attention 1', 'purple'],
  ['MLP 1', 'blue'],
];
/** Illustrative writes, as 2-D arrows added tip to tail. */
const CHAIN: [number, number, string, K][] = [
  [0.7, 0.35, 'x₀', 'orange'],
  [-0.15, 0.55, 'a₀', 'purple'],
  [0.45, 0.2, 'm₀', 'blue'],
  [-0.35, 0.4, 'a₁', 'purple'],
  [0.2, 0.45, 'm₁', 'blue'],
];

const stream: SceneDef = {
  draw(s) {
    const { u } = s;
    const [ax, ay, aw, ah] = area(s, 0.14);
    const appear = s.ease('recall', 0.6);
    const dw = s.tall ? aw * 0.56 : aw * 0.46;
    const bandX = ax + dw * 0.24;
    const top = ay + u * 9;
    const bot = ay + ah - u * 9;
    const bx = ax + dw * 0.48;
    const bwid = dw * 0.52;
    const bh = Math.min(u * 9, (bot - top) / 7);
    const ys = LAYERS.map((_, i) => lerp(bot - u * 6, top + u * 10, (i + 0.5) / LAYERS.length));
    s.alpha(appear, () => {
      const lit = s.ease('stream', 0.6) * (1 - 0.5 * s.ease('read', 0.5));
      s.rrect(bandX - u * 2.2, top, u * 4.4, bot - top, 2.2, { fill: s.tint('orange', 0.12 + 0.2 * lit), stroke: s.tint('orange', 0.4 + 0.5 * lit), lw: 0.3 });
      s.alpha(s.ease('stream', 0.6), () => {
        s.ctx.save();
        s.ctx.translate(bandX - u * 5.5, (top + bot) / 2);
        s.ctx.rotate(-Math.PI / 2);
        s.text('residual stream', 0, 0, { font: 'ui', size: 3.2, weight: 600, color: s.c('orange') });
        s.ctx.restore();
      });
      box(s, bandX - dw * 0.22, bot + u * 1.2, dw * 0.44, u * 6.5, 'x₀ = embed', 'orange', { size: 3.2 });
      box(s, bandX - dw * 0.22, top - u * 7.7, dw * 0.44, u * 6.5, '× W_U → logits', 'teal', { size: 3.2, on: s.win('out', 'channel') });
      const rp = s.prog('read');
      const wp = s.prog('write');
      LAYERS.forEach(([lab, k], i) => {
        const y = ys[i]!;
        box(s, bx, y - bh / 2, bwid, bh, lab, k, { size: 3.2 });
        const readOn = s.since('read') >= 0 && s.since('write') < 0 ? clamp01(rp * 4.5 - i) : 0;
        const writeOn = s.since('write') >= 0 && s.since('sum') < 0 ? clamp01(wp * 4.5 - i) : 0;
        s.arrow(bandX + u * 2.4, y + bh * 0.3, bx - u * 0.6, y + bh * 0.3, s.tint('teal', 0.35 + 0.65 * readOn), 0.3 + 0.3 * readOn, 1.6);
        s.arrow(bx - u * 0.6, y - bh * 0.3, bandX + u * 2.6, y - bh * 0.3, s.tint('orange', 0.35 + 0.65 * writeOn), 0.3 + 0.3 * writeOn, 1.6);
        s.circle(bandX, y - bh * 0.3, u * 1.5, { fill: s.c('--card'), stroke: s.tint('orange', 0.5 + 0.5 * writeOn), lw: 0.3 });
        s.text('+', bandX, y - bh * 0.3 + u * 0.2, { font: 'mono', size: 3, weight: 700, color: s.c('orange') });
      });
      s.alpha(s.win('read', 'write'), () => s.text('read', bx + bwid / 2, ys[0]! + bh * 0.95, { font: 'ui', size: 3, weight: 600, color: s.c('teal') }));
      s.alpha(s.win('write', 'sum'), () => s.text('write: add', bx + bwid / 2, ys[0]! + bh * 0.95, { font: 'ui', size: 3, weight: 600, color: s.c('orange') }));
      // A message from attention 0 up to MLP 1.
      const cp = s.prog('channel');
      if (s.since('channel') >= 0 && s.since('direct') < 0) {
        const y = lerp(ys[0]! - bh * 0.3, ys[3]! + bh * 0.3, clamp01(cp * 1.3));
        s.circle(bandX, y, u * 1.6, { fill: s.c('red') });
        s.text('message', bandX + u * 3, y, { font: 'ui', size: 3, weight: 600, align: 'left', color: s.c('red'), halo: true });
      }
    });
    // The sum, as arrows tip to tail.
    const sA = s.ease('sum', 0.6);
    if (sA > 0) {
      const rx = ax + dw + u * 3;
      const rw = ax + aw - rx;
      const tot = CHAIN.reduce((a, c) => [a[0] + c[0], a[1] + c[1]], [0, 0]);
      const minx = Math.min(0, ...CHAIN.map((_, i) => CHAIN.slice(0, i + 1).reduce((a, c) => a + c[0], 0)));
      const maxx = Math.max(tot[0], ...CHAIN.map((_, i) => CHAIN.slice(0, i + 1).reduce((a, c) => a + c[0], 0)));
      const sc = Math.min(rw / (maxx - minx + 0.3), (ah * 0.62) / (tot[1] + 0.2));
      const ox = rx + (rw - (maxx - minx) * sc) / 2 - minx * sc;
      const oy = ay + ah * (s.since('direct') >= 0 ? 0.66 : 0.8);
      const sp = s.prog('sum');
      let px = ox;
      let py = oy;
      s.alpha(sA, () => {
        s.circle(ox, oy, u * 0.8, { fill: s.c('--ink-3') });
        CHAIN.forEach(([dx, dy, lab, k], i) => {
          const a = clamp01(sp * 6 - i);
          if (a <= 0) return;
          const nx = px + dx * sc * a;
          const ny = py - dy * sc * a;
          s.arrow(px, py, nx, ny, s.c(k), 0.55, 2.2);
          s.text(lab, (px + nx) / 2 + (dx >= 0 ? -u * 3 : u * 3), (py + ny) / 2, { font: 'ui', italic: true, size: 3.8, weight: 700, color: s.c(k), halo: true });
          px = px + dx * sc;
          py = py - dy * sc;
        });
        const fa = clamp01(sp * 6 - 5);
        s.alpha(fa, () => {
          s.line(ox, oy, px, py, s.tint('orange', 0.8), 0.4, [1.2, 1]);
          s.text('top of the stream: the sum', ox + (px - ox) / 2 + u * 2, oy + u * 5, { font: 'ui', size: fitSize(s, 'top of the stream: the sum', rw, 3.2), weight: 600, color: s.c('orange') });
        });
      });
      // Each write's direct effect on one logit.
      const dA = s.ease('direct', 0.6);
      if (dA > 0)
        s.alpha(dA * sA, () => {
          const dir = [0.35, 0.94];
          const vals = CHAIN.map(([dx, dy]) => dx * dir[0]! + dy * dir[1]!);
          const by = oy + u * 12;
          const bwid2 = rw / CHAIN.length;
          const mx = Math.max(...vals.map(Math.abs));
          const hh = Math.min(u * 12, ay + ah - by - u * 5);
          s.text('direct effect on one logit', rx + rw / 2, by - u * 2.5, { font: 'ui', size: 3, weight: 600, color: s.c('teal') });
          vals.forEach((v, i) => {
            const k = CHAIN[i]![3];
            const bhh = (Math.abs(v) / mx) * hh;
            s.rrect(rx + i * bwid2 + bwid2 * 0.2, by + hh - bhh + u, bwid2 * 0.6, bhh, 0.5, { fill: s.tint(k, 0.75) });
            s.text(CHAIN[i]![2], rx + i * bwid2 + bwid2 / 2, by + hh + u * 4, { font: 'ui', italic: true, size: 3.4, weight: 700, color: s.c(k) });
          });
        });
    }
  },
};

/* ------------------------------------------------------------------ lens */

const lensScene: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const [ax, ay, aw, ah] = area(s, 0.14);
    // The model, as a stack.
    const mA = s.win('model', 'data');
    s.alpha(mA, () => {
      const parts: [string, K][] = [
        ['20 letters in', 'orange'],
        ['embed + position', 'orange'],
        ['head 0 (layer 1)', 'purple'],
        ['head 1 (layer 2)', 'purple'],
        ['× W_U → next letter', 'teal'],
      ];
      const sw = Math.min(aw * 0.8, u * 70);
      const sx = ax + (aw - sw) / 2;
      const rowH = ah / (parts.length + 0.6);
      parts.forEach(([lab, k], i) => {
        const y = ay + ah - (i + 1) * rowH + u * 2;
        s.alpha(s.ease('model', 0.5, 0.3 * i), () => {
          box(s, sx, y, sw, rowH * 0.62, lab, k, { size: 3.8, on: s.since('arch') >= 0 && (i === 2 || i === 3) ? 1 : 0 });
          if (i > 0) s.arrow(sx + sw / 2, y + rowH + u * 0.5 - rowH * 0.38, sx + sw / 2, y + rowH * 0.62 + u * 0.5, s.tint('--ink-3', 0.8), 0.3, 1.6);
        });
      });
      s.alpha(s.ease('arch', 0.6, 2.5), () => pill(s, 'no MLPs · no layer norm', w / 2, ay + u * 1, 'slate', { size: 3.2 }));
    });
    // The letters.
    const big = s.since('lens') < 0;
    const shrink = s.ease('lens', 0.8);
    const sw = lerp(aw, aw * 0.7, shrink);
    const st = stripAt(ax + (aw - sw) / 2, lerp(ay + ah * 0.08, ay, shrink), sw, s, lerp(9, 3, shrink));
    const lA = s.ease('data', 0.6);
    s.alpha(lA, () => {
      const inLens = s.since('input') >= 0;
      drawStrip(s, st, (i) => ({ on: inLens && i === QI ? 1 : 0, ring: inLens ? (i === QI ? 'teal' : i === QI + 1 ? 'gold' : undefined) : undefined, k: i >= HALF ? 'orange' : 'orange', a: big && i >= HALF ? s.ease('data', 0.6, 1.5) : 1 }));
      s.alpha(big ? 1 - shrink : 0, () => {
        const y1 = st.y + st.ch + st.gap / 2;
        s.text('then the same letters again', st.x, y1, { font: 'ui', size: 3, align: 'left', color: s.c('--ink-3') });
        s.alpha(s.ease('only', 0.6), () => {
          const y = st.y + 2 * st.ch + st.gap + u * 7;
          s.text('first row: unpredictable', ax + aw * 0.25, y, { font: 'ui', size: fitSize(s, 'first row: unpredictable', aw * 0.48, 3.6), weight: 600, color: s.c('--ink-3') });
          s.text('second row: copy it', ax + aw * 0.75, y, { font: 'ui', size: fitSize(s, 'first row: unpredictable', aw * 0.48, 3.6), weight: 600, color: s.c('green') });
        });
        s.alpha(s.ease('sum', 0.6), () => {
          const t = 'x₂ = x₀ + head 0 + head 1';
          s.text(t, w / 2, ay + ah * 0.78, { font: 'ui', italic: true, size: fitSize(s, t, aw, 6, 'ui'), weight: 600, color: s.c('orange') });
        });
      });
    });
    // Three readings of the stream.
    if (s.since('lens') >= 0) {
      const P = lensProbs();
      const t = SEQ[QI + 1]!;
      const y0 = st.y + 2 * st.ch + st.gap + u * 5;
      const rowH = (ay + ah - y0 - u * 8) / 3;
      const names: [string, string, string][] = [
        ['x0', 'x₀', 'embedding'],
        ['x1', 'x₁', '+ head 0'],
        ['x2', 'x₂', '+ head 1'],
      ];
      s.alpha(s.ease('lens', 0.6, 1), () => {
        if (s.since('input') < 0) s.text('decode each partial sum with W_U', w / 2, y0 + rowH, { font: 'ui', size: 3.6, weight: 600, color: s.c('teal') });
      });
      names.forEach(([beat, sym, sub], r) => {
        const a = s.ease(beat, 0.6);
        if (a <= 0) return;
        const y = y0 + r * rowH;
        const msgA = s.since('message') >= 0 ? (r === 1 ? 1 : 0.35) : 1;
        s.alpha(a * msgA, () => {
          s.text(sym, ax, y + u * 2.5, { font: 'ui', italic: true, size: 4.2, weight: 700, align: 'left', color: s.c('orange') });
          s.text(sub, ax + u * 6.5, y + u * 2.5, { font: 'ui', size: 3.2, align: 'left', color: s.c('--ink-2') });
          s.text(`P ${Math.round(P[r]![t]! * 100)}%`, ax + aw, y + u * 2.5, { font: 'mono', size: 3.4, weight: 700, align: 'right', color: s.c('gold') });
          letterBars(s, ax, y + u * 5, aw, rowH - u * (r === 2 ? 9 : 6), P[r]!, t, s.ease(beat, 0.8, 0.3), r === 2);
        });
      });
      s.alpha(s.ease('message', 0.6), () => pill(s, 'head 0 wrote a message for head 1, not for the output', w / 2, ay + ah - u * 3.5, 'purple', { size: fitSize(s, 'head 0 wrote a message for head 1, not for the output', aw * 0.85, 3.4) }));
    }
  },
};

/* ------------------------------------------------------------------ heads */

const heads: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const [ax, ay, aw, ah] = area(s, 0.14);
    const mA = 1 - s.ease('read0', 0.6);
    // Four matrices, then two circuits.
    s.alpha(mA, () => {
      const qkM = s.ease('qk', 0.9);
      const ovM = s.ease('ov', 0.9);
      const side = Math.min(u * 18, aw / 5.5);
      const cy = ay + ah * 0.3;
      const xs = [0.14, 0.34, 0.66, 0.86].map((f) => ax + aw * f);
      const qkX = (xs[0]! + xs[1]!) / 2;
      const ovX = (xs[2]! + xs[3]!) / 2;
      const mats: [string, K, number, number][] = [
        ['W_Q', 'blue', xs[0]!, qkX],
        ['W_K', 'blue', xs[1]!, qkX],
        ['W_V', 'gold', xs[2]!, ovX],
        ['W_O', 'gold', xs[3]!, ovX],
      ];
      mats.forEach(([lab, k, x0, x1], i) => {
        const m = i < 2 ? qkM : ovM;
        const x = lerp(x0, x1, m);
        s.alpha(s.ease('four', 0.5, 0.3 * i) * (1 - m), () => box(s, x - side / 2, cy - side / 2, side, side, lab, k, { size: 4.2, font: 'mono' }));
      });
      const merged: [string, string, K, number, number][] = [
        ['W_QK', 'where to look', 'blue', qkX, qkM],
        ['W_OV', 'what to move', 'gold', ovX, ovM],
      ];
      merged.forEach(([lab, sub, k, x, m]) => {
        if (m <= 0) return;
        s.alpha(m, () => {
          const bw = side * 1.6;
          box(s, x - bw / 2, cy - side / 2, bw, side, lab, k, { size: 5, font: 'mono', on: 0.6 });
          s.text(sub, x, cy + side / 2 + u * 5, { font: 'ui', size: fitSize(s, sub, aw * 0.45, 4), weight: 600, color: s.c(k) });
        });
      });
      s.alpha(s.ease('qk', 0.6, 1.2), () => s.text('= Wq Wkᵀ', qkX, cy - side / 2 - u * 4, { font: 'mono', size: 3.2, color: s.c('--ink-3') }));
      s.alpha(s.ease('ov', 0.6, 1.2), () => s.text('= Wv Wo', ovX, cy - side / 2 - u * 4, { font: 'mono', size: 3.2, color: s.c('--ink-3') }));
      s.alpha(s.ease('indep', 0.6), () => s.text('independent: look right, copy wrong', w / 2, ay + ah * 0.66, { font: 'ui', size: fitSize(s, 'independent: look right, copy wrong', aw, 4), weight: 600, color: s.c('--ink-2') }));
      s.alpha(s.ease('rank', 0.6), () => s.text('32 × 32, through a width of 16', w / 2, ay + ah * 0.78, { font: 'mono', size: fitSize(s, '32 × 32, through a width of 16', aw, 3.8, 'mono'), color: s.c('--ink-3') }));
    });
    // The two circuits of the trained model.
    const { pos, ov } = circuitsFinal();
    const g0A = s.ease('read0', 0.6);
    const g1A = s.ease('read1', 0.6);
    if (g0A <= 0) return;
    const both = !s.tall || s.since('noinput') >= 0;
    const half = both && g1A > 0;
    const gw = half ? (aw - u * 8) / 2 : Math.min(aw, ah - u * 14);
    const cs0 = gw / 24;
    const cs1 = gw / 20;
    const gy = ay + u * 9;
    const x0 = half ? ax : ax + (aw - gw) / 2;
    const x1 = half ? ax + gw + u * 8 : ax + (aw - gw) / 2;
    const show0 = half || g1A <= 0;
    if (show0)
      s.alpha(g0A * (half ? 1 : 1 - g1A), () => {
        s.text('head 0 · QK, positions', x0 + gw / 2, gy - u * 4, { font: 'ui', size: fitSize(s, 'head 0 · QK, positions', gw, 3.6), weight: 600, color: s.c('teal') });
        heatGrid(s, x0, gy, cs0, pos, (v) => s.tint('teal', 0.05 + 0.9 * v), true);
        const st = s.ease('stripe', 0.6);
        if (st > 0)
          s.alpha(st, () => {
            s.line(x0 + cs0 * 0.5, gy + cs0 * 1.5, x0 + cs0 * 22.5, gy + cs0 * 23.5, s.tint('red', 0.75), 0.35, [1, 1]);
            s.text('one step back', x0 + gw * 0.62, gy + gw * 0.42, { font: 'ui', size: 3.4, weight: 700, color: s.c('red'), halo: true });
          });
      });
    if (g1A > 0)
      s.alpha(g1A, () => {
        s.text('head 1 · OV, letter → logit', x1 + gw / 2, gy - u * 4, { font: 'ui', size: fitSize(s, 'head 1 · OV, letter → logit', gw, 3.6), weight: 600, color: s.c('gold') });
        let range = 0;
        for (const v of ov.a) range = Math.max(range, Math.abs(v));
        heatGrid(s, x1, gy, cs1, ov, (v) => s.tint(v >= 0 ? 'gold' : 'slate', 0.05 + 0.85 * Math.min(1, Math.abs(v) / (range * 0.8))));
        if (cs1 > u * 2.4)
          for (let j = 0; j < 20; j += half ? 2 : 1) s.text(LETTERS[j]!, x1 + j * cs1 + cs1 / 2, gy + gw + u * 2.6, { font: 'mono', size: Math.min(2.8, (cs1 / u) * 0.7), color: s.c('--ink-3') });
        const dg = s.ease('diag', 0.6);
        if (dg > 0) s.alpha(dg, () => s.line(x1, gy, x1 + gw, gy + gw, s.tint('red', 0.6), 0.35, [1, 1]));
      });
    s.alpha(s.ease('noinput', 0.6), () => pill(s, 'weights only, no input text', w / 2, ay + ah - u * 3, 'slate', { size: 3.4 }));
  },
};

/* ------------------------------------------------------------------ induction */

const induction: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const [ax, ay, aw, ah] = area(s, 0.14);
    const tr = traceFinal();
    const gridOn = s.ease('grid', 0.8);
    const sw = lerp(s.tall ? aw : Math.min(aw, ah * 1.3), Math.min(aw, ah * 1.3) * 0.72, gridOn);
    const st = stripAt(ax + (aw - sw) / 2, ay + lerp(7, 1, gridOn) * u, sw, s, lerp(9, 4.5, gridOn));
    const A0 = tr.A[0]!;
    const A1 = tr.A[1]!;
    const j = 8;
    // Head 0 arrows: every position to the one before.
    const pp = s.prog('prev');
    const prevA = s.since('prev') >= 0 ? (s.since('query') >= 0 ? 0.35 : 1) : 0;
    if (prevA > 0)
      for (let i = 1; i < 24; i++) {
        if (i === HALF) continue;
        const a = clamp01(pp * 26 - i);
        if (a <= 0) continue;
        const c0 = cellXY(st, i);
        const c1 = cellXY(st, i - 1);
        const lit = i === j && s.since('here') >= 0;
        s.alpha(prevA * a * (lit ? 1 / prevA : 1) * (1 - 0.6 * gridOn), () => arc(s, c0.cx - st.cw * 0.1, c0.y - u * 0.5, c1.cx + st.cw * 0.1, c1.y - u * 0.5, -st.cw * 0.28, s.tint('teal', 0.4 + 0.6 * (A0.a[i * 24 + i - 1] ?? 0)), lit ? 0.55 : 0.35, 1.4));
      }
    // Head 1 from the query.
    const qA = s.ease('key', 0.6);
    if (qA > 0) {
      const q = cellXY(st, QI);
      for (let k = 0; k < QI; k++) {
        const a = A1.a[QI * 24 + k]!;
        if (a < 0.02) continue;
        const c = cellXY(st, k);
        s.alpha(qA, () => s.line(q.cx, q.y, c.cx, c.y + st.ch, s.tint('purple', 0.2 + 0.8 * a), 0.3 + 1.1 * a * s.ease('found', 0.6)));
      }
    }
    drawStrip(s, st, (i) => {
      const isQ = i === QI && s.since('query') >= 0;
      const isJ = i === j && s.since('here') >= 0;
      return { on: isQ || isJ ? 0.8 : 0, ring: isQ ? '--ink' : isJ ? 'purple' : undefined, k: isJ ? 'purple' : 'orange' };
    });
    const below = st.y + 2 * st.ch + st.gap + u * 6;
    s.alpha(s.win('here', 'query'), () => {
      const c = cellXY(st, j);
      pill(s, 'previous letter: F', c.cx, c.y + st.ch + st.gap / 2, 'teal', { size: 3 });
    });
    s.alpha(s.ease('found', 0.6) * (1 - s.ease('copy', 0.5)), () => {
      const a = A1.a[QI * 24 + j]!;
      s.text(`head 1 puts ${Math.round(a * 100)}% on the earlier P`, w / 2, below + u * 2, { font: 'ui', size: fitSize(s, 'head 1 puts 98% on the earlier P', aw, 3.8), weight: 600, color: s.c('purple') });
    });
    s.alpha(s.ease('copy', 0.6), () => {
      const p = tr.logits.a.subarray(QI * 20, QI * 20 + 20);
      const mx = Math.max(...p);
      const e = Array.from(p, (v) => Math.exp(v - mx));
      const pr = e[SEQ[QI + 1]!]! / e.reduce((a, b) => a + b, 0);
      const c = cellXY(st, QI);
      pill(s, `→ P  ${Math.round(pr * 100)}%`, c.cx, c.y + st.ch + u * 4.5, 'green', { size: 3.4 });
    });
    // The rule.
    s.alpha(s.win('rule', 'prev'), () => {
      const t = 'seen  A B  …  now  A  →  predict  B';
      s.text(t, w / 2, below + u * 6, { font: 'mono', size: fitSize(s, t, aw, 4.6, 'mono'), weight: 600, color: s.c('--ink') });
    });
    // Head 1's whole pattern.
    if (gridOn > 0) {
      const gy = st.y + 2 * st.ch + st.gap + u * 14;
      const gs = Math.min(aw * 0.8, ay + ah - gy);
      const cs = gs / 24;
      const gx = ax + (aw - gs) / 2;
      s.alpha(gridOn, () => {
        heatGrid(s, gx, gy, cs, A1, (v) => s.tint('purple', 0.04 + 0.92 * Math.min(1, v)), true);
        s.line(gx, gy + HALF * cs, gx + HALF * cs, gy + HALF * cs, s.tint('--ink-3', 0.6), 0.2, [0.8, 0.8]);
        s.line(gx + HALF * cs, gy + HALF * cs, gx + HALF * cs, gy + gs, s.tint('--ink-3', 0.6), 0.2, [0.8, 0.8]);
        const title = s.since('name') >= 0 ? 'head 1: the induction head' : 'head 1, all 24 rows';
        s.text(title, gx + gs / 2, gy - u * 2.6, { font: 'ui', size: fitSize(s, 'head 1: the induction head', gs, 3.6), weight: 700, color: s.c('purple') });
        s.alpha(s.ease('score', 0.6), () => pill(s, `induction score ${inductionScore(tr).toFixed(2)}`, st.x, st.y + 2 * st.ch + st.gap + u * 4.5, 'purple', { size: 3.2, fill: 0.2, align: 'left' }));
      });
    }
  },
};

/* ------------------------------------------------------------------ phase */

const sq = (v: number): number => Math.sqrt(v);

function chart(s: Scene, x: number, y: number, w: number, h: number, ys: number[], ymax: number, k: K, upto: number, o: { dash?: number[]; width?: number } = {}): void {
  const xmax = sq(4000);
  const xs: number[] = [];
  const yy: number[] = [];
  for (let i = 0; i < CURVES.step.length; i++) {
    const st = CURVES.step[i]!;
    if (st > upto) break;
    xs.push(x + (sq(st) / xmax) * w);
    yy.push(y + h - (Math.min(ymax, ys[i]!) / ymax) * h);
  }
  if (xs.length > 1) poly(s, xs, yy, s.c(k), o.width ?? 0.55, o.dash);
}

function axesFrame(s: Scene, x: number, y: number, w: number, h: number, ticks: boolean): void {
  const { u } = s;
  s.line(x, y + h, x + w, y + h, s.c('--axis'), 0.25);
  s.line(x, y, x, y + h, s.c('--axis'), 0.25);
  if (ticks)
    for (const t of [0, 500, 1000, 2000, 4000]) {
      const tx = x + (sq(t) / sq(4000)) * w;
      s.text(String(t), tx, y + h + u * 2.8, { font: 'mono', size: 2.6, align: t === 4000 ? 'right' : 'center', color: s.c('--ink-3') });
    }
}

const phase: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const [ax, ay, aw, ah] = area(s, 0.14);
    const cA = 1 - s.ease('why', 0.6);
    s.alpha(cA, () => {
      const gridsOn = s.ease('grids', 0.6);
      const cw = s.tall ? aw : aw * (1 - 0.42 * gridsOn);
      const cx = ax + u * 4;
      const ch = s.tall ? ah * (0.62 - 0.22 * gridsOn) : ah * 0.86;
      const h1 = ch * 0.56;
      const h2 = ch * 0.3;
      const y1 = ay + u * 4;
      const y2 = y1 + h1 + u * 8;
      // Loss on the repeat, drawn as the narration goes.
      const upto = s.since('cliff') >= 0 ? lerp(700, 4000, s.prog('cliff')) : s.since('plateau') >= 0 ? lerp(250, 700, s.prog('plateau')) : lerp(0, 250, s.prog('watch'));
      axesFrame(s, cx, y1, cw - u * 4, h1, false);
      s.line(cx, y1 + h1 - (Math.log(20) / 4) * h1, cx + cw - u * 4, y1 + h1 - (Math.log(20) / 4) * h1, s.tint('--ink-3', 0.7), 0.2, [0.8, 1]);
      s.text('blind guess', cx + cw - u * 5, y1 + h1 - (Math.log(20) / 4) * h1 - u * 2.2, { font: 'ui', size: 2.8, align: 'right', color: s.c('--ink-3') });
      chart(s, cx, y1, cw - u * 4, h1, CURVES.rep, 4, 'red', upto, { width: 0.6 });
      s.text('loss on the repeat', cx + u * 1.5, y1 + u * 2, { font: 'ui', size: 3.2, weight: 600, align: 'left', color: s.c('red') });
      // Induction score.
      s.alpha(s.ease('score', 0.6), () => {
        axesFrame(s, cx, y2, cw - u * 4, h2, true);
        chart(s, cx, y2, cw - u * 4, h2, CURVES.ind, 1, 'purple', lerp(0, 4000, s.ease('score', 2.4)), { width: 0.6 });
        s.text('induction score', cx + u * 1.5, y2 + u * 1.5, { font: 'ui', size: 3.2, weight: 600, align: 'left', color: s.c('purple') });
      });
      // Before and after.
      if (gridsOn > 0) {
        const gx = s.tall ? ax : ax + cw + u * 2;
        const gwid = s.tall ? aw : aw - cw - u * 2;
        const gy = s.tall ? y2 + h2 + u * 9 : ay + u * 6;
        const gs = s.tall ? Math.min((gwid - u * 6) / 2, ay + ah - gy - u * 5) : Math.min(gwid, (ah - u * 18) / 2);
        const items: [string, number][] = [['step 300', 0], ['step 4000', 1]];
        items.forEach(([lab, k], i) => {
          const tr = k ? traceFinal() : traceEarly();
          const x = s.tall ? gx + (gwid - 2 * gs - u * 6) / 2 + i * (gs + u * 6) : gx + (gwid - gs) / 2;
          const y = s.tall ? gy : gy + i * (gs + u * 8);
          s.alpha(gridsOn * s.ease('grids', 0.6, 0.9 * i), () => {
            heatGrid(s, x, y, gs / 24, tr.A[1]!, (v) => s.tint('purple', 0.04 + 0.92 * Math.min(1, v)), true);
            s.text(lab, x + gs / 2, y - u * 2.4, { font: 'mono', size: 3, weight: 600, color: s.c('--ink-2') });
          });
        });
      }
    });
    // Why so sudden.
    const wA = s.win('why', 'olsson');
    s.alpha(wA, () => {
      const bw = s.tall ? aw : aw * 0.46;
      const bh = u * 17;
      const y0 = ay + ah * 0.1;
      const cards: [string, string, K][] = [
        ['previous-token head alone', 'writes notes nobody reads', 'teal'],
        ['induction head alone', 'looks for notes nobody wrote', 'purple'],
      ];
      cards.forEach(([t1, t2, k], i) => {
        const x = s.tall ? ax : ax + i * (aw - bw);
        const y = s.tall ? y0 + i * (bh + u * 4) : y0;
        s.alpha(s.ease('why', 0.5, 2 + 1.6 * i), () => {
          s.rrect(x, y, bw, bh, 2, { fill: s.tint(k, 0.08), stroke: s.tint(k, 0.6), lw: 0.3 });
          s.text(t1, x + bw / 2, y + bh * 0.36, { font: 'ui', size: fitSize(s, t1, bw - u * 4, 3.8), weight: 700, color: s.c(k) });
          s.text(t2, x + bw / 2, y + bh * 0.7, { font: 'ui', size: fitSize(s, t2, bw - u * 4, 3.4), italic: true, color: s.c('--ink-2') });
        });
      });
      s.alpha(s.ease('together', 0.6), () => {
        const y = s.tall ? y0 + 2 * (bh + u * 4) + u * 6 : y0 + bh + u * 16;
        s.text('both a little → both fast, together', w / 2, y, { font: 'display', size: fitSize(s, 'both a little → both fast, together', aw, 5, 'display'), weight: 600, color: s.c('--accent') });
      });
    });
    const oA = s.ease('olsson', 0.6);
    s.alpha(oA, () => {
      s.text('Olsson et al., 2022', w / 2, ay + u * 6, { font: 'display', size: fitSize(s, 'Olsson et al., 2022', aw, 6), weight: 600 });
      s.text('In-context Learning and Induction Heads', w / 2, ay + u * 13, { font: 'serif', italic: true, size: fitSize(s, 'In-context Learning and Induction Heads', aw, 3.8, 'serif'), color: s.c('--ink-2') });
      const items: [string, K][] = [
        ['phase change in real models', 'purple'],
        ['in-context learning jumps', 'green'],
        ['small models: remove the heads, lose most of it', 'red'],
        ['large models: correlational evidence', 'slate'],
      ];
      const a = (i: number) => (i === 0 ? 1 : i === 1 ? s.ease('icl', 0.5) : s.ease('evidence', 0.5, (i - 2) * 2.2));
      pillRows(s, items, ax, ay + u * 26, aw, { size: fitSize(s, 'small models: remove the heads, lose most of it', aw * 0.9, 4), a, center: true, stack: true });
    });
  },
};

export const scenesA: Record<string, SceneDef> = { intro, stream, lens: lensScene, heads, induction, phase };
void LETTERS;
