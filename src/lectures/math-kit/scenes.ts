import { fmt } from '../../core/code';
import { Rng } from '../../core/rand';
import type { Color } from '../../core/symbols';
import { gear } from '../../lib/math-kit-draw';
import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../lecture/scene';

type Rect = [number, number, number, number];

/** Maps a data window onto a pixel rectangle of the stage (y up). */
class Frame {
  kx: number;
  ky: number;
  ox: number;
  oy: number;
  constructor(
    readonly s: Scene,
    readonly rect: Rect,
    readonly dom: [number, number, number, number],
    square = false,
  ) {
    const [rx, ry, rw, rh] = rect;
    const [x0, x1, y0, y1] = dom;
    let kx = rw / (x1 - x0);
    let ky = rh / (y1 - y0);
    if (square) kx = ky = Math.min(kx, ky);
    this.kx = kx;
    this.ky = ky;
    this.ox = rx + (rw - kx * (x1 - x0)) / 2 - kx * x0;
    this.oy = ry + (rh - ky * (y1 - y0)) / 2 + ky * y1;
  }
  X(x: number): number {
    return this.ox + this.kx * x;
  }
  Y(y: number): number {
    return this.oy - this.ky * y;
  }
  /** Visible data bounds (wider than `dom` on the padded axis of a square frame). */
  get view(): [number, number, number, number] {
    const [rx, ry, rw, rh] = this.rect;
    return [(rx - this.ox) / this.kx, (rx + rw - this.ox) / this.kx, (this.oy - ry - rh) / this.ky, (this.oy - ry) / this.ky];
  }
  grid(step = 1, a = 1): void {
    const s = this.s;
    const [x0, x1, y0, y1] = this.view;
    s.alpha(a, () => {
      for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) s.line(this.X(x), this.Y(y0), this.X(x), this.Y(y1), s.c('--grid'), 0.25);
      for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) s.line(this.X(x0), this.Y(y), this.X(x1), this.Y(y), s.c('--grid'), 0.25);
      if (x0 <= 0 && x1 >= 0) s.line(this.X(0), this.Y(y0), this.X(0), this.Y(y1), s.c('--axis'), 0.35);
      if (y0 <= 0 && y1 >= 0) s.line(this.X(x0), this.Y(0), this.X(x1), this.Y(0), s.c('--axis'), 0.35);
    });
  }
  clip(fn: () => void): void {
    const c = this.s.ctx;
    c.save();
    c.beginPath();
    c.rect(...this.rect);
    c.clip();
    fn();
    c.restore();
  }
  fn(f: (x: number) => number, col: string, width = 0.8, from = this.view[0], to = this.view[1]): void {
    const c = this.s.ctx;
    this.clip(() => {
      c.beginPath();
      const n = 240;
      for (let i = 0; i <= n; i++) {
        const x = from + ((to - from) * i) / n;
        const y = f(x);
        const py = Math.max(-1e4, Math.min(1e4, this.Y(y)));
        if (i) c.lineTo(this.X(x), py);
        else c.moveTo(this.X(x), py);
      }
      c.strokeStyle = col;
      c.lineWidth = width * this.s.u;
      c.lineJoin = 'round';
      c.stroke();
    });
  }
  arrow(x0: number, y0: number, x1: number, y1: number, col: string, width = 0.8): void {
    this.s.arrow(this.X(x0), this.Y(y0), this.X(x1), this.Y(y1), col, width, 3.2);
  }
  dot(x: number, y: number, r: number, col: string): void {
    this.s.circle(this.X(x), this.Y(y), r * this.s.u, { fill: col, stroke: this.s.c('--card'), lw: 0.35 });
  }
}

/** The stage's drawing area inside a comfortable margin, with room for the chip at the top. */
function area(s: Scene, top = 0.13, pad = 0.05): Rect {
  const m = s.w * pad;
  return [m, s.h * top, s.w - 2 * m, s.h * (1 - top) - m];
}

const IDEAS: [string, string][] = [
  ['functions', 'def f(x)'],
  ['vectors', 'a list'],
  ['dot products', 'sum(a * b)'],
  ['matrices', 'list of lists'],
  ['sums', 'a for loop'],
  ['exp and log', 'np.exp'],
  ['derivatives', 'a slope'],
  ['gradients', 'many slopes'],
  ['chain rule', 'rates multiply'],
  ['probability', 'sums to 1'],
  ['argmax', 'index of max'],
];

const TILE_COLORS: Color[] = ['purple', 'orange', 'blue', 'blue', 'gold', 'red', 'teal', 'teal', 'green', 'green', 'slate'];

/** The eleven idea tiles from the opening, reused in the closing summary. */
function tiles(s: Scene, rect: Rect, appear: (i: number) => number, lit: (i: number) => number, sub: number, check = 0): void {
  const [rx, ry, rw, rh] = rect;
  const cols = rw > rh * 1.5 ? 4 : 3;
  const rows = Math.ceil(IDEAS.length / cols);
  const gap = s.u * 2;
  const tw = (rw - gap * (cols - 1)) / cols;
  const th = Math.min((rh - gap * (rows - 1)) / rows, tw * 0.62);
  const oy = ry + (rh - (th * rows + gap * (rows - 1))) / 2;
  IDEAS.forEach(([name, alias], i) => {
    const a = appear(i);
    if (a <= 0) return;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = rx + col * (tw + gap);
    const y = oy + row * (th + gap) + (1 - a) * s.u * 3;
    const on = lit(i);
    const k = TILE_COLORS[i]!;
    s.alpha(a, () => {
      s.rrect(x, y, tw, th, 2.2, { fill: s.tint(k, 0.07 + 0.2 * on), stroke: s.tint(k, 0.35 + 0.65 * on), lw: 0.3 + 0.35 * on });
      const fs = Math.min(5.2, (tw / s.u) * 0.115);
      s.text(name, x + tw / 2, y + th * (sub > 0 ? 0.4 : 0.5), { size: fs, font: 'display', weight: 560 });
      s.alpha(sub, () => s.text(alias, x + tw / 2, y + th * 0.7, { size: fs * 0.72, font: 'mono', color: s.c(k) }));
      if (check > 0) {
        const ca = clamp01(check * IDEAS.length - i);
        s.alpha(ca, () => {
          const cx = x + tw - s.u * 3.2;
          const cy = y + s.u * 3.2;
          s.circle(cx, cy, s.u * 1.9, { fill: s.c('green') });
          s.line(cx - s.u * 0.9, cy, cx - s.u * 0.2, cy + s.u * 0.7, '#fff', 0.45);
          s.line(cx - s.u * 0.2, cy + s.u * 0.7, cx + s.u * 1, cy - s.u * 0.7, '#fff', 0.45);
        });
      }
    });
  });
}

/** An 8 x 8 stand-in photo: sky, a hill, a red car. Deterministic. */
function pixelColor(i: number, j: number): [number, number, number] {
  if (i >= 4 && i <= 5 && j >= 2 && j <= 5) return [200, 50 + 10 * j, 45];
  if (i === 6 && (j === 2 || j === 5)) return [40, 40, 45];
  if (i >= 5 + (j % 3 === 0 ? 0 : 1)) return [70 + 8 * j, 140 - 4 * i, 60];
  return [110 + 6 * i, 160 + 6 * i, 225 - 3 * j];
}
const rgb = (c: [number, number, number]) => `rgb(${c[0]},${c[1]},${c[2]})`;

function pixelImage(s: Scene, x: number, y: number, size: number, a = 1): void {
  const n = 8;
  const cs = size / n;
  s.alpha(a, () => {
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        s.ctx.fillStyle = rgb(pixelColor(i, j));
        s.ctx.fillRect(x + j * cs, y + i * cs, cs + 0.5, cs + 0.5);
      }
    s.rrect(x, y, size, size, 0.6, { stroke: s.c('--rule'), lw: 0.3 });
  });
}

/** A rounded "machine" box with a label and spinning gear, for functions. */
function machine(s: Scene, cx: number, cy: number, w: number, h: number, label: string, k: Color, spin: number, a = 1): void {
  s.alpha(a, () => {
    s.rrect(cx - w / 2, cy - h / 2, w, h, 3, { fill: s.tint(k, 0.1), stroke: s.c(k), lw: 0.55 });
    gear(s.ctx, cx + w * 0.3, cy + h * 0.22, h * 0.16, spin, s.tint(k, 0.55), 9);
    s.text(label, cx - w * 0.06, cy - h * 0.02, { size: (h / s.u) * 0.3, font: 'serif', italic: true, weight: 600, color: s.c(k) });
  });
}

// ---------------------------------------------------------------- scenes

const intro: SceneDef = {
  marks: {
    w1: { tex: String.raw`L_i = -\log\frac{e^{s_{y_i}}}{\sum_j e^{s_j}}`, x: 0.3, y: 0.24, size: 5.2 },
    w2: { tex: String.raw`\nabla_W L = \tfrac{1}{N}\textstyle\sum_i \nabla_W L_i + \lambda W`, x: 0.68, y: 0.4, size: 4.6 },
    w3: { tex: String.raw`\frac{\partial f}{\partial x} = \frac{\partial f}{\partial q}\frac{\partial q}{\partial x}`, x: 0.76, y: 0.18, size: 4.8 },
    w4: { tex: String.raw`\sigma\!\left(W_2 \max(0, W_1 x + b_1)\right)`, x: 0.35, y: 0.56, size: 4.6 },
    w5: { tex: String.raw`\textstyle\sum_{j \ne y_i} \max(0,\, s_j - s_{y_i} + \Delta)`, x: 0.58, y: 0.72, size: 4.6 },
    w6: { tex: String.raw`\mu = \tfrac{1}{N}\textstyle\sum_i x_i`, x: 0.2, y: 0.85, size: 4.4 },
    w7: { tex: String.raw`p(y \mid x) = \operatorname{softmax}(Wx)`, x: 0.72, y: 0.88, size: 4.2 },
  },
  draw(s) {
    const { w, h } = s;
    const title = s.win('hello', 'wall');
    s.alpha(title, () => {
      s.text('Math survival kit', w / 2, h * 0.46, { size: 11, font: 'display', weight: 600 });
      s.text('the dozen ideas behind every equation', w / 2, h * 0.6, { size: 4.6, color: s.c('--ink-2'), italic: true });
    });
    const wall = s.win('wall', 'good', 0.9);
    ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7'].forEach((k, i) => {
      const a = wall * s.ease(i < 4 ? 'wall' : 'wall2', 0.8, (i % 4) * 0.35) * 0.85;
      const drift = Math.sin(s.t * 0.4 + i) * 0.006;
      s.show(k, a, { y: [0.24, 0.4, 0.18, 0.56, 0.72, 0.85, 0.88][i]! + drift });
    });
    const tl = s.ease('good', 0.6);
    if (tl > 0) {
      const appear = (i: number) => s.ease('good', 0.5, 0.12 * i);
      const lit = (i: number) => {
        // "A sum is a for loop. A vector is a list. A function is, well, a function."
        const p = s.prog('loop');
        const loopLit = s.since('loop') >= 0 && s.since('plan') < 0 ? (i === 4 && p < 0.36) || (i === 1 && p >= 0.36 && p < 0.62) || (i === 0 && p >= 0.62) : false;
        // The plan's for loop visits each idea in turn.
        const q = s.span('plan', 'go');
        const scan = s.since('plan') >= 0 && s.since('go') < 0 && Math.floor(q * IDEAS.length) === i;
        const first = s.since('go') >= 0 && i === 0 ? 0.6 + 0.4 * Math.sin(s.since('go') * 5) : 0;
        return loopLit || scan ? 1 : first;
      };
      tiles(s, area(s, 0.12, 0.05), appear, lit, s.ease('names', 0.6));
    }
  },
};

const functions: SceneDef = {
  marks: {
    def: { tex: String.raw`\symf(\symx) = 2\symx + 1`, x: 0.5, y: 0.2, size: 7.5 },
    sq: { tex: String.raw`y = \symx^2`, x: 0.8, y: 0.3, size: 5.5 },
    lin: { tex: String.raw`y = 2\symx + 1`, x: 0.22, y: 0.24, size: 5 },
  },
  draw(s) {
    const { w, h, u } = s;
    // Phase 1: the machine.
    const mA = s.win('var', 'graph');
    if (mA > 0) {
      const cx = w / 2;
      const cy = h * 0.55;
      const mw = Math.min(w * 0.36, u * 40);
      const mh = mw * 0.62;
      const runs: [string, number, number][] = [
        ['three', 3, 7],
        ['more', 0, 1],
        ['more', -2, -3],
      ];
      let run = -1;
      let rp = 0;
      if (s.since('more') >= 0) {
        const p = s.prog('more');
        run = p < 0.5 ? 1 : 2;
        rp = clamp01((p < 0.5 ? p : p - 0.5) * 2.2);
      } else if (s.since('three') >= 0) {
        run = 0;
        rp = clamp01(s.prog('three') * 1.3);
      }
      const spin = run >= 0 && rp > 0.35 && rp < 0.65 ? s.t * 8 : s.t * 0.4;
      s.alpha(mA, () => {
        machine(s, cx, cy, mw, mh, 'f', 'purple', spin, s.ease('machine', 0.6));
        s.show('def', mA * s.ease('def', 0.6));
        const tokR = u * 5.5;
        const inX0 = w * 0.1;
        const outX1 = w * 0.9;
        const token = (x: number, label: string, k: Color, a: number) =>
          s.alpha(a, () => {
            s.circle(x, cy, tokR, { fill: s.tint(k, 0.16), stroke: s.c(k), lw: 0.5 });
            s.text(label, x, cy + u * 0.3, { size: 4.6, font: 'mono', weight: 600, color: s.c(k) });
          });
        if (run < 0) {
          token(inX0 + tokR, 'x', 'orange', s.ease('var', 0.5));
          s.alpha(s.ease('machine', 0.5), () => {
            s.arrow(inX0 + tokR * 2.4, cy, cx - mw / 2 - u, cy, s.c('--ink-3'), 0.5);
            s.arrow(cx + mw / 2 + u, cy, outX1 - tokR * 2.4, cy, s.c('--ink-3'), 0.5);
          });
        } else {
          const [, xin, yout] = runs[run]!;
          const pin = smooth(rp / 0.4);
          const pout = smooth((rp - 0.6) / 0.4);
          if (rp < 0.45) token(lerp(inX0 + tokR, cx - mw * 0.2, pin), String(xin), 'orange', 1 - smooth((rp - 0.3) / 0.15));
          if (rp > 0.55) token(lerp(cx + mw * 0.2, outX1 - tokR, pout), String(yout), 'purple', smooth((rp - 0.55) / 0.12));
          s.slot('x', xin);
          s.slot('fx', rp > 0.6 ? yout : '…');
        }
        // A running record of what went in and what came out.
        const done = [s.since('three') > s.end('three') - s.at('three') - 0.3, s.prog('more') > 0.48, s.prog('more') > 0.97];
        const listA = s.ease('same', 0.5);
        if (listA > 0) {
          runs.forEach(([, xi, yo], i) => {
            if (!done[i]) return;
            const ty = h * 0.86;
            const tx = w / 2 + (i - 1) * u * 24;
            s.alpha(listA, () => {
              s.text(`${xi} → ${yo}`, tx, ty, { size: 4.4, font: 'mono', color: s.c('--ink-2') });
            });
          });
        }
      });
    }
    // Phase 2: the graph.
    const gA = s.win('graph', 'big');
    if (gA > 0) {
      const fr = new Frame(s, area(s, 0.1, 0.06), [-3.4, 3.4, -5.5, 9.5]);
      s.alpha(gA, () => {
        fr.grid(1, 0.9);
        s.text('x', fr.X(3.3), fr.Y(0) - u * 2.5, { size: 3.6, italic: true, color: s.c('orange') });
        const f = (x: number) => 2 * x + 1;
        let n = 7;
        if (s.since('join') >= 0) n = Math.round(lerp(7, 61, smooth(s.prog('join') * 1.6)));
        const shown = s.since('join') >= 0 ? n : Math.floor(s.prog('dots') * 7.99);
        for (let i = 0; i < Math.min(n, shown); i++) {
          const x = -3 + (6 * i) / (n - 1);
          if (n === 7) s.line(fr.X(x), fr.Y(0), fr.X(x), fr.Y(f(x)), s.tint('purple', 0.35), 0.3, [1, 1]);
          fr.dot(x, f(x), n > 20 ? 0.7 : 1.3, s.c('purple'));
        }
        s.slot('n', s.since('join') >= 0 ? n : 7);
        const lineA = s.ease('join', 0.8, 1.8);
        s.alpha(lineA, () => fr.fn(f, s.c('purple'), 0.6, -3, 3));
        s.show('lin', gA * s.ease('dots', 0.6), { x: fr.X(2.1) / w, y: fr.Y(-3.6) / h });
        const cA = s.ease('curve', 0.8);
        s.alpha(cA, () => fr.fn((x) => x * x, s.c('red'), 0.8, -3, 3 * cA));
        s.show('sq', gA * cA, { x: fr.X(2.35) / w, y: fr.Y(8.4) / h });
      });
    }
    // Phase 3: the two enormous functions.
    const bA = s.ease('big', 0.6);
    if (bA > 0) {
      s.alpha(s.win('big', 'net'), () => s.text('two enormous functions', w / 2, h / 2, { size: 7, font: 'display', weight: 560 }));
      s.alpha(bA, () => {
        const rowY = [h * 0.36, h * 0.74];
        const mw = Math.min(w * 0.24, u * 30);
        const mh = Math.min(h * 0.24, mw * 0.6);
        // network: image -> 10 scores
        const nA = s.ease('net', 0.6);
        s.alpha(nA, () => {
          const img = Math.min(mh * 1.1, w * 0.16);
          pixelImage(s, w * 0.08, rowY[0]! - img / 2, img);
          s.text('3,072 numbers', w * 0.08 + img / 2, rowY[0]! + img / 2 + u * 3.2, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
          for (let k = 0; k < 7; k++) {
            const y0 = rowY[0]! - img * 0.4 + (img * 0.8 * k) / 6;
            s.line(w * 0.08 + img + u, y0, w * 0.5 - mw / 2 - u, rowY[0]! + (k - 3) * u * 1.2, s.tint('orange', 0.45), 0.25);
          }
          machine(s, w * 0.5, rowY[0]!, mw, mh, 'network', 'purple', s.t * 1.5);
          const bx = w * 0.5 + mw / 2 + u * 4;
          const bw = (w * 0.92 - bx) / 10;
          const sc = [0.3, 0.8, 0.2, 0.55, 0.4, 0.95, 0.25, 0.6, 0.35, 0.5];
          sc.forEach((v, i) => {
            const bh = mh * 0.9 * v * smooth(s.prog('net') * 2 - i * 0.05);
            s.rrect(bx + i * bw + bw * 0.15, rowY[0]! + mh * 0.45 - bh, bw * 0.7, bh, 0.4, { fill: s.c(i === 5 ? 'purple' : '--ink-3') });
          });
          s.text('10 scores', bx + bw * 5, rowY[0]! + mh * 0.45 + u * 3.2, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
        });
        // loss: every weight -> one number
        const lA = s.ease('loss', 0.6);
        s.alpha(lA, () => {
          const rng = new Rng(7);
          const cx0 = w * 0.08;
          const cw = Math.min(mh * 1.1, w * 0.16);
          const jig = s.since('learn') > 0 ? Math.sin(s.t * 6) * u * 0.5 : 0;
          for (let i = 0; i < 6; i++)
            for (let j = 0; j < 6; j++) {
              const v = rng.uniform(0.2, 1);
              s.circle(cx0 + (j + 0.5) * (cw / 6) + (i % 2 ? jig : -jig), rowY[1]! - cw / 2 + (i + 0.5) * (cw / 6), (cw / 6) * 0.32 * v, { fill: s.tint('blue', 0.35 + 0.5 * v) });
            }
          s.text('every weight', cx0 + cw / 2, rowY[1]! + cw / 2 + u * 3.2, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
          for (let k = 0; k < 7; k++) s.line(cx0 + cw + u, rowY[1]! - cw * 0.4 + (cw * 0.8 * k) / 6, w * 0.5 - mw / 2 - u, rowY[1]! + (k - 3) * u * 1.2, s.tint('blue', 0.4), 0.25);
          machine(s, w * 0.5, rowY[1]!, mw, mh, 'loss', 'red', s.t * 1.5);
          const loss = s.since('learn') > 0 ? lerp(2.31, 0.12, smooth((s.since('learn') - 0.5) / 6)) : 2.31;
          const lx = w * 0.5 + mw / 2 + u * 14;
          s.arrow(w * 0.5 + mw / 2 + u, rowY[1]!, lx - u * 7, rowY[1]!, s.c('--ink-3'), 0.5);
          s.rrect(lx - u * 6.5, rowY[1]! - u * 5, u * 15, u * 10, 1.5, { fill: s.tint('red', 0.1), stroke: s.c('red') });
          s.text(loss.toFixed(2), lx + u, rowY[1]! + u * 0.3, { size: 5, font: 'mono', weight: 650, color: s.c('red') });
          s.text('one number', lx + u, rowY[1]! + u * 8.4, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
        });
      });
    }
  },
};

const vectors: SceneDef = {
  marks: {
    norm: { tex: String.raw`\lVert \symx \rVert = \sqrt{3^2 + 1^2} \approx 3.16`, x: 0.5, y: 0.88, size: 5.6 },
  },
  draw(s) {
    const { w, h, u } = s;
    const planeA = s.win('list', 'leap');
    if (planeA > 0) {
      const fr = new Frame(s, area(s, 0.12, 0.05), [-4.2, 7.2, -2.4, 4.4], true);
      s.alpha(planeA, () => {
        fr.grid(1, 0.9);
        // The list form, top left.
        const cw = u * 10;
        const listRow = (y: number, vals: string[], k: Color, label: string, a: number) =>
          s.alpha(a, () => {
            s.text(label, u * 5, y + cw * 0.36, { size: 5, italic: true, weight: 600, color: s.c(k), align: 'left', halo: true });
            vals.forEach((v, i) => s.cell(u * 11 + i * (cw + u), y, cw, cw * 0.72, v, k, { size: 4.2 }));
          });
        listRow(h * 0.15, ['3', '1'], 'orange', 'x', s.ease('list', 0.5));
        listRow(h * 0.15 + cw, ['1', '2'], 'blue', 'w', s.ease('w', 0.5));
        listRow(h * 0.15 + 2 * cw, ['4', '3'], 'green', '+', s.win('add', 'scale') * s.ease('add', 0.5, 1.6));
        // x as an arrow: three across, one up.
        const pa = s.ease('arrow', 1.4, 0.8);
        const pb = s.ease('arrow', 0.8, 2.4);
        s.alpha(1 - s.ease('w', 0.5), () => {
          s.line(fr.X(0), fr.Y(0), fr.X(3 * pa), fr.Y(0), s.tint('orange', 0.6), 0.45, [1.2, 1]);
          if (pa >= 1) s.line(fr.X(3), fr.Y(0), fr.X(3), fr.Y(pb), s.tint('orange', 0.6), 0.45, [1.2, 1]);
          s.alpha(pa, () => s.text('3 across', fr.X(1.5), fr.Y(0) + u * 3.5, { size: 3.4, font: 'mono', color: s.c('--ink-3') }));
          s.alpha(pb, () => s.text('1 up', fr.X(3) + u * 2, fr.Y(0.5), { size: 3.4, font: 'mono', color: s.c('--ink-3'), align: 'left' }));
        });
        const xA = s.ease('arrow', 0.6, 3.2);
        // Scaling stretches x by k: 1 -> 2 -> -1.
        let k = 1;
        if (s.since('scale') >= 0 && s.since('norm') < 0) {
          const p = s.prog('scale');
          k = p < 0.45 ? lerp(1, 2, smooth(p / 0.3)) : lerp(2, -1, smooth((p - 0.62) / 0.3));
        }
        s.slot('k', fmt(Math.round(k * 10) / 10));
        s.slot('kx0', fmt(Math.round(3 * k * 10) / 10));
        s.slot('kx1', fmt(Math.round(k * 10) / 10));
        if (Math.abs(k - 1) > 0.01) s.alpha(0.3, () => fr.arrow(0, 0, 3, 1, s.c('orange'), 0.6));
        s.alpha(xA, () => {
          fr.arrow(0, 0, 3 * k, k, s.c('orange'), 0.9);
          s.text(Math.abs(k - 1) > 0.05 ? `${fmt(Math.round(k * 10) / 10)}x` : 'x', fr.X(3 * k * 0.55) - u * 1.5, fr.Y(k * 0.55) - u * 3, { size: 4.4, italic: true, weight: 600, color: s.c('orange'), halo: true });
        });
        // w, then tip to tail.
        const wA = s.win('w', 'scale');
        const slide = s.ease('tip', 1.4, 0.6);
        s.alpha(wA, () => {
          fr.arrow(0, 0, 1, 2, s.c('blue'), 0.9);
          s.text('w', fr.X(0.4) - u * 3, fr.Y(1.2), { size: 4.4, italic: true, weight: 600, color: s.c('blue'), halo: true });
          if (slide > 0) {
            s.alpha(0.85, () => fr.arrow(3 * slide, slide, 3 * slide + 1, slide + 2, s.c('blue'), 0.7));
            s.alpha(s.ease('tip', 0.7, 2.2), () => {
              fr.arrow(0, 0, 4, 3, s.c('green'), 1);
              s.text('x + w', fr.X(2) - u * 4, fr.Y(1.9) - u, { size: 4, font: 'mono', weight: 600, color: s.c('green'), halo: true, align: 'right' });
            });
          }
        });
        // Length by Pythagoras.
        const nA = s.win('norm', 'leap');
        s.alpha(nA, () => {
          s.line(fr.X(0), fr.Y(0), fr.X(3), fr.Y(0), s.c('teal'), 0.8);
          s.line(fr.X(3), fr.Y(0), fr.X(3), fr.Y(1), s.c('teal'), 0.8);
          s.text('3', fr.X(1.5), fr.Y(0) + u * 3.4, { size: 4, font: 'mono', color: s.c('teal') });
          s.text('1', fr.X(3) + u * 2.4, fr.Y(0.5), { size: 4, font: 'mono', color: s.c('teal') });
          s.show('norm', nA * s.ease('norm', 0.6, 1.2));
        });
      });
    }
    // An image is a vector.
    const iA = s.ease('leap', 0.6);
    if (iA > 0) {
      s.alpha(iA, () => {
        const size = Math.min(h * 0.5, w * 0.3);
        const x0 = w * 0.08;
        const y0 = h * 0.24;
        const fly = s.ease('pixels', 2.2, 1.6);
        const n = 8;
        const cs = size / n;
        // Pixels peel off the grid into one long row.
        const rowY = h * 0.84;
        const slots = Math.floor((w * 0.86) / (cs * 0.7));
        for (let i = 0; i < n; i++)
          for (let j = 0; j < n; j++) {
            const idx = i * n + j;
            const tx = w * 0.07 + (idx % slots) * cs * 0.7;
            const ty = rowY - Math.floor(idx / slots) * cs * 0.8;
            const p = smooth(fly * 1.6 - (idx / (n * n)) * 0.6);
            s.ctx.fillStyle = rgb(pixelColor(i, j));
            const x = lerp(x0 + j * cs, tx, p);
            const y = lerp(y0 + i * cs, ty, p);
            const sz = lerp(cs, cs * 0.6, p);
            s.ctx.fillRect(x, y, sz, sz);
          }
        s.alpha(1 - fly * 0.6, () => s.rrect(x0, y0, size, size, 0.6, { stroke: s.c('--rule'), lw: 0.3 }));
        if (fly > 0) pixelImage(s, x0, y0, size, 0.25 * fly);
        const tx = x0 + size + u * 6;
        s.alpha(s.ease('pixels', 0.6), () => {
          s.text('32 × 32 pixels', tx, y0 + size * 0.2, { size: 4.6, font: 'display', weight: 560, align: 'left' });
          s.text('× 3 colors (red, green, blue)', tx, y0 + size * 0.2 + u * 6.5, { size: 3.6, color: s.c('--ink-2'), align: 'left' });
        });
        s.alpha(s.ease('pixels', 0.6, 3.6), () => {
          s.text('= 3,072 numbers in one list', tx, y0 + size * 0.2 + u * 14, { size: 4.6, font: 'display', weight: 560, color: s.c('orange'), align: 'left' });
        });
        s.alpha(s.ease('dims', 0.6), () => {
          ['x + w', 'k * x', 'np.linalg.norm(x)'].forEach((t, i) =>
            s.alpha(s.ease('dims', 0.5, 2.4 + i * 0.8), () => s.text(t, tx, y0 + size * 0.2 + u * (24 + i * 6), { size: 3.8, font: 'mono', color: s.c('--ink-2'), align: 'left' })),
          );
        });
      });
    }
  },
};

const dot: SceneDef = {
  marks: {
    dot: { tex: String.raw`\symw \cdot \symx = \sum_i \symw_i \symx_i`, x: 0.5, y: 0.82, size: 6.4 },
  },
  draw(s) {
    const { w, h, u } = s;
    s.alpha(s.win('most', 'what'), () => s.text('the dot product', w / 2, h / 2, { size: 9, font: 'display', weight: 560 }));
    // Phase 1: multiply matching entries, then add.
    const aA = s.win('what', 'mean');
    if (aA > 0) {
      s.alpha(aA, () => {
        const cw = Math.min(u * 15, w * 0.15);
        const ch = cw * 0.66;
        const x0 = w / 2 - cw - u * 2;
        const rows: [string, string[], Color][] = [
          ['w', ['1', '0.5'], 'blue'],
          ['x', ['3', '1'], 'orange'],
        ];
        rows.forEach(([lab, vals, k], r) => {
          const y = h * 0.2 + r * (ch + u * 2.5);
          s.text(lab, x0 - u * 6, y + ch / 2, { size: 5, italic: true, weight: 600, color: s.c(k) });
          vals.forEach((v, i) => s.cell(x0 + i * (cw + u * 4), y, cw, ch, v, k, { on: s.since('how') > 0 ? 0.5 : 0 }));
        });
        const mp = s.ease('how', 0.8, 0.4);
        const py = h * 0.2 + 2 * (ch + u * 2.5) + u * 3;
        s.alpha(mp, () => {
          ['3', '0.5'].forEach((v, i) => {
            const cx = x0 + i * (cw + u * 4) + cw / 2;
            s.text('×', cx, py - u * 2.6, { size: 4, color: s.c('--ink-3') });
            s.cell(cx - cw / 2, py, cw, ch, v, 'purple', { on: 0.3 });
          });
        });
        const sp = s.ease('how', 0.8, 1.6);
        s.alpha(sp, () => {
          const sy = py + ch + u * 7;
          s.text('+', x0 + cw + u * 2, py + ch / 2, { size: 5, color: s.c('--ink-3') });
          s.circle(w / 2, sy + u * 2, u * 6.5, { fill: s.tint('purple', 0.16), stroke: s.c('purple'), lw: 0.6 });
          s.text('3.5', w / 2, sy + u * 2.3, { size: 5, font: 'mono', weight: 650, color: s.c('purple') });
        });
        s.show('dot', aA * s.ease('np', 0.6));
      });
    }
    // Phase 2: arrows that agree, disagree, or neither.
    const bA = s.ease('mean', 0.6);
    if (bA > 0) {
      const fr = new Frame(s, area(s, 0.1, 0.05), [-3.6, 3.6, -3, 3], true);
      const xAng = Math.atan2(1, 3);
      let ang = xAng;
      const r = 2;
      if (s.since('right') >= 0) ang = xAng + (Math.PI / 2) * smooth(s.prog('right') * 2.5);
      if (s.since('opp') >= 0) ang = xAng + Math.PI / 2 + (Math.PI / 2) * smooth(s.prog('opp') * 2.5);
      if (s.since('agree') >= 0) ang = xAng + Math.PI + s.since('agree') * 0.9;
      const wx = r * Math.cos(ang);
      const wy = r * Math.sin(ang);
      const d = wx * 3 + wy * 1;
      s.slot('w0', fmt(Math.round(wx * 100) / 100));
      s.slot('w1', fmt(Math.round(wy * 100) / 100));
      s.slot('p0', fmt(Math.round(wx * 3 * 100) / 100));
      s.slot('p1', fmt(Math.round(wy * 100) / 100));
      s.slot('d1', fmt(Math.round(d * 100) / 100));
      s.slot('d2', fmt(Math.round(d * 100) / 100));
      s.alpha(bA, () => {
        // Half-planes: the sign of w . p for every point p.
        const pA = s.ease('plane', 0.9);
        if (pA > 0) {
          const c = s.ctx;
          fr.clip(() => {
            c.save();
            c.translate(fr.X(0), fr.Y(0));
            c.rotate(-ang);
            const big = Math.max(w, h) * 2;
            c.fillStyle = s.tint('blue', 0.13 * pA);
            c.fillRect(0, -big, big, 2 * big);
            c.fillStyle = s.tint('red', 0.08 * pA);
            c.fillRect(-big, -big, big, 2 * big);
            c.restore();
            const bx = -Math.sin(ang) * 6;
            const by = Math.cos(ang) * 6;
            s.alpha(pA, () => s.line(fr.X(-bx), fr.Y(-by), fr.X(bx), fr.Y(by), s.c('--ink-3'), 0.4, [1.4, 1.2]));
          });
          s.alpha(pA, () => {
            const pa = ang + 0.75;
            const na = ang + Math.PI - 0.75;
            s.text('positive', fr.X(Math.cos(pa) * 2.4), fr.Y(Math.sin(pa) * 2.4), { size: 3.8, font: 'mono', color: s.c('blue'), halo: true });
            s.text('negative', fr.X(Math.cos(na) * 2.4), fr.Y(Math.sin(na) * 2.4), { size: 3.8, font: 'mono', color: s.c('red'), halo: true });
          });
        }
        fr.grid(1, 0.7);
        fr.arrow(0, 0, 3, 1, s.c('orange'), 0.9);
        s.text('x', fr.X(3) + u * 2, fr.Y(1) - u * 2, { size: 4.2, italic: true, weight: 600, color: s.c('orange'), align: 'left', halo: true });
        s.alpha(s.ease('clf', 0.6), () => {
          const bx = fr.rect[0] + u * 1.5;
          const by = fr.rect[1] + fr.rect[3] - u * 13;
          s.rrect(bx - u, by - u * 4, u * 52, u * 17, 1.5, { fill: s.tint('--card', 0.92), stroke: s.c('--rule') });
          s.text('w: one class\'s weights', bx, by, { size: 3.6, align: 'left', color: s.c('blue') });
          s.text('x: an image', bx, by + u * 4.6, { size: 3.6, align: 'left', color: s.c('orange') });
          s.text('w · x: that class\'s score', bx, by + u * 9.2, { size: 3.6, align: 'left', font: 'mono' });
        });
        const wA = s.ease('same', 0.6);
        s.alpha(wA, () => {
          fr.arrow(0, 0, wx, wy, s.c('blue'), 0.9);
          s.text('w', fr.X(wx * 1.15), fr.Y(wy * 1.15), { size: 4.2, italic: true, weight: 600, color: s.c('blue'), halo: true });
          // Angle arc between the arrows.
          const c = s.ctx;
          c.beginPath();
          const a0 = -xAng;
          let delta = -(ang - xAng);
          delta = ((((delta + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
          c.arc(fr.X(0), fr.Y(0), u * 7, a0, a0 + delta, delta < 0);
          c.strokeStyle = s.c('--ink-3');
          c.lineWidth = u * 0.35;
          c.stroke();
          const col = Math.abs(d) < 0.25 ? s.c('--ink-2') : d > 0 ? s.c('green') : s.c('red');
          const rx = fr.rect[0] + fr.rect[2] - u * 2;
          s.text('w · x =', rx - u * 17, fr.rect[1] + u * 4, { size: 4.6, font: 'mono', align: 'right', color: s.c('--ink-2') });
          s.text((Math.abs(d) < 0.05 ? 0 : d).toFixed(1), rx, fr.rect[1] + u * 4, { size: 6, font: 'mono', weight: 650, align: 'right', color: col });
          const word = s.since('plane') >= 0 ? '' : Math.abs(d) < 0.3 ? 'right angle: zero' : d > 3 ? 'same way: large, positive' : d < -3 ? 'opposite: large, negative' : '';
          if (word) s.text(word, rx, fr.rect[1] + u * 10.5, { size: 3.6, align: 'right', color: col, italic: true });
        });
      });
    }
  },
};

const matrices: SceneDef = {
  marks: {
    rule: { tex: String.raw`(m, \textcolor{#23893f}{n}) \cdot (\textcolor{#23893f}{n}, p) \to (m, p)`, x: 0.5, y: 0.18, size: 6.2 },
  },
  draw(s) {
    const { w, h, u } = s;
    const W = [
      [2, 0, 1],
      [-1, 3, 2],
    ];
    const X = [1, 2, 3];
    const out = [5, 11];
    // Phase 1: W times x, one row at a time.
    const aA = s.win('grid', 'habit');
    if (aA > 0) {
      s.alpha(aA, () => {
        const cw = Math.min(u * 13, (w * 0.86 - u * 24) / 5);
        const ch = cw * 0.78;
        const gx = (w - (5 * cw + u * 12)) / 2 + u * 5;
        const gy = h * 0.4 - ch;
        const r0 = s.since('r0') >= 0 && s.since('r1') < 0;
        const r1 = s.since('r1') >= 0 && s.since('stack') < 0;
        W.forEach((row, i) =>
          row.forEach((v, j) => {
            const on = (i === 0 && r0) || (i === 1 && r1) ? 1 : 0;
            s.alpha(s.ease('grid', 0.4, (i * 3 + j) * 0.08), () => s.cell(gx + j * cw, gy + i * ch, cw, ch, String(v), 'blue', { on }));
          }),
        );
        // shape labels
        s.alpha(s.ease('shape', 0.5), () => {
          s.text('3 columns', gx + cw * 1.5, gy - u * 3.4, { size: 3.6, font: 'mono', color: s.c('--ink-3') });
          s.text('2 rows', gx - u * 3, gy + ch, { size: 3.6, font: 'mono', color: s.c('--ink-3'), align: 'right' });
          s.text('shape (2, 3)', gx + cw * 1.5, gy + ch * 2 + u * 4.5, { size: 4, font: 'mono', weight: 600, color: s.c('blue') });
        });
        s.alpha(s.win('rows', 'mv'), () => {
          [0, 1].forEach((i) => s.rrect(gx - u * 0.6, gy + i * ch - u * 0.2, cw * 3 + u * 1.2, ch + u * 0.4, 1.6, { stroke: s.c('blue'), lw: 0.7 }));
        });
        // x as a column
        const xx = gx + cw * 3 + u * 5;
        const xy = gy + ch - (3 * ch) / 2;
        s.text('·', xx - u * 2.6, gy + ch, { size: 6, color: s.c('--ink-3') });
        X.forEach((v, j) => s.alpha(s.ease('grid', 0.4, 0.6 + j * 0.08), () => s.cell(xx, xy + j * ch, cw, ch, String(v), 'orange', { on: r0 || r1 ? 1 : 0 })));
        // the result
        const ox = xx + cw + u * 7;
        s.alpha(s.ease('mv', 0.5), () => {
          s.text('=', ox - u * 3.5, gy + ch, { size: 5.5, color: s.c('--ink-3') });
          out.forEach((v, i) => {
            const filled = (i === 0 && s.ease('r0', 0.4, 2.6)) || (i === 1 && s.ease('r1', 0.4, 2.2));
            s.cell(ox, gy + i * ch, cw, ch, filled ? String(v) : '', 'purple', { on: s.since('stack') > 0 ? 1 : (i === 0 && r0) || (i === 1 && r1) ? 0.6 : 0 });
          });
        });
        const terms = r0 ? '2·1 + 0·2 + 1·3 = 5' : r1 ? '−1·1 + 3·2 + 2·3 = 11' : '';
        if (terms) s.alpha(s.ease(r0 ? 'r0' : 'r1', 0.5, 0.3), () => s.text(terms, w / 2, h * 0.8, { size: 4.8, font: 'mono', weight: 550 }));
        s.alpha(s.ease('code', 0.5), () => s.text('W.dot(x)  →  [5, 11]', w / 2, h * 0.8, { size: 4.8, font: 'mono', weight: 550, color: s.c('purple') }));
      });
    }
    // Phase 2: shape algebra, then the course's own shapes.
    const bA = s.win('habit', 'T');
    if (bA > 0) {
      s.alpha(bA, () => {
        const course = s.ease('course', 0.8);
        const cy = h * 0.56;
        const box = (x: number, bw: number, bh: number, k: Color, lab: string, dims: [string, string], hi: number) => {
          s.rrect(x, cy - bh / 2, bw, bh, 1.4, { fill: s.tint(k, 0.12), stroke: s.c(k), lw: 0.5 });
          s.text(lab, x + bw / 2, cy, { size: 4.6, italic: true, weight: 600, color: s.c(k) });
          s.text(dims[0], x - u * 1.5, cy, { size: 4, font: 'mono', weight: 600, align: 'right', color: hi && dims[0] === 'n' ? s.c('green') : s.c('--ink-3') });
          s.text(dims[1], x + bw / 2, cy - bh / 2 - u * 3, { size: 4, font: 'mono', weight: 600, color: hi && dims[1] === 'n' ? s.c('green') : s.c('--ink-3') });
        };
        const hi = s.ease('rule', 0.5, 1.5);
        s.show('rule', bA * s.ease('rule', 0.6) * (1 - course));
        s.alpha(s.ease('rule', 0.6) * (1 - course), () => {
          const gap = u * 14;
          const unit = Math.min(u * 13, (w * 0.9 - 3 * gap) / 5.4);
          const x0 = (w - (unit * 5.4 + 2 * gap)) / 2 + u * 3;
          box(x0, unit * 2.2, unit * 1.4, 'blue', 'A', ['m', 'n'], hi);
          s.text('·', x0 + unit * 2.2 + gap / 2, cy, { size: 6, color: s.c('--ink-3') });
          box(x0 + unit * 2.2 + gap, unit * 1.6, unit * 2.2, 'orange', 'B', ['n', 'p'], hi);
          s.text('→', x0 + unit * 3.8 + gap * 1.5, cy, { size: 6, color: s.c('--ink-3') });
          box(x0 + unit * 3.8 + gap * 2, unit * 1.6, unit * 1.4, 'purple', 'C', ['m', 'p'], 0);
          s.alpha(hi, () => s.text('inner sizes match, then cancel', w / 2, h * 0.86, { size: 4, italic: true, color: s.c('green') }));
        });
        s.alpha(s.ease('habit', 0.6) * (1 - s.ease('rule', 0.4)), () => {
          s.text('W   # (10, 3072)', w / 2, h * 0.42, { size: 5, font: 'mono' });
          s.text('x   # (3072,)', w / 2, h * 0.52, { size: 5, font: 'mono' });
          s.text('write the shape next to every array', w / 2, h * 0.7, { size: 4.2, italic: true, color: s.c('--ink-2') });
        });
        s.alpha(course, () => {
          const Ww = w * 0.48;
          const Wh = h * 0.12;
          const x0 = w * 0.06;
          box(x0, Ww, Wh, 'blue', 'W', ['10', '3,072'], 0);
          s.text('·', x0 + Ww + u * 3, cy, { size: 6, color: s.c('--ink-3') });
          const xh = Math.min(h * 0.6, Ww * 0.9);
          s.rrect(x0 + Ww + u * 6, cy - xh / 2, u * 4, xh, 1, { fill: s.tint('orange', 0.12), stroke: s.c('orange'), lw: 0.5 });
          s.text('x', x0 + Ww + u * 8, cy, { size: 4.2, italic: true, weight: 600, color: s.c('orange') });
          s.text('3,072', x0 + Ww + u * 8, cy + xh / 2 + u * 3, { size: 3.4, font: 'mono', color: s.c('--ink-3') });
          s.text('→', x0 + Ww + u * 15, cy, { size: 6, color: s.c('--ink-3') });
          s.rrect(x0 + Ww + u * 20, cy - Wh / 2, u * 4, Wh, 1, { fill: s.tint('purple', 0.15), stroke: s.c('purple'), lw: 0.5 });
          s.text('10 scores', x0 + Ww + u * 26, cy, { size: 3.8, font: 'mono', align: 'left', color: s.c('purple') });
        });
      });
    }
    // Phase 3: the transpose flips rows into columns.
    const tA = s.ease('T', 0.6);
    if (tA > 0) {
      s.alpha(tA, () => {
        const cw = Math.min(u * 15, w * 0.14);
        const ch = cw * 0.78;
        const p = s.ease('T', 1.6, 1.4);
        const gx = w / 2 - cw * 1.5;
        const gy = h * 0.32;
        s.line(gx - u * 2, gy - u * 2, gx + cw * 2.6, gy + ch * 2.6, s.tint('teal', 0.6 * smooth(p * 3)), 0.4, [1.2, 1]);
        W.forEach((row, i) =>
          row.forEach((v, j) => {
            const x = lerp(gx + j * cw, gx + i * cw, p);
            const y = lerp(gy + i * ch, gy + j * ch, p);
            s.cell(x, y, cw, ch, String(v), 'blue', { on: i === 0 ? 0.5 : 0 });
          }),
        );
        s.text(p > 0.5 ? 'W.T   shape (3, 2)' : 'W   shape (2, 3)', w / 2, h * 0.86, { size: 4.6, font: 'mono', weight: 600, color: s.c('blue') });
      });
    }
  },
};

const sums: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const vals = [4, 1, 3, 2];
    const prod = s.since('pi') >= 0;
    // The sigma, drawn so its parts can be pointed at.
    const gx = w * 0.26;
    const gy = h * 0.3;
    const big = 15;
    s.alpha(s.ease('sigma', 0.7), () => {
      s.text(prod ? 'Π' : 'Σ', gx, gy, { size: big, font: 'serif', weight: 500 });
      s.alpha(s.ease('sigma', 0.5, 1.6), () => {
        s.text('n', gx, gy - u * 11.5, { size: 5, italic: true });
        s.text('i = 1', gx, gy + u * 11.5, { size: 5, italic: true });
        s.text('x', gx + u * 10, gy + u * 1, { size: 8, italic: true, weight: 600, color: s.c('orange') });
        s.text('i', gx + u * 13.6, gy + u * 3.6, { size: 4.6, italic: true, color: s.c('orange') });
      });
    });
    const pA = s.win('parts', 'run');
    s.alpha(pA, () => {
      const note = (tx: number, ty: number, ax: number, ay: number, label: string, d: number) =>
        s.alpha(s.ease('parts', 0.5, d), () => {
          s.arrow(tx, ty, ax, ay, s.c('--accent'), 0.4);
          s.text(label, tx + u, ty, { size: 3.8, align: 'left', color: s.c('--accent'), halo: true });
        });
      note(gx + u * 22, gy + u * 14, gx + u * 6, gy + u * 11.5, 'start here', 0);
      note(gx + u * 22, gy - u * 13, gx + u * 4, gy - u * 11.5, 'stop here', 2.2);
      note(gx + u * 26, gy + u * 2, gx + u * 17, gy + u * 2, 'add this, each pass', 4.2);
    });
    // The array and the running loop.
    const aA = s.ease('loop', 0.6);
    const cw = Math.min(u * 13, w * 0.15);
    const ch = cw * 0.75;
    const ax = w / 2 - cw * 2 + u * 3;
    const ay = h * 0.56;
    let i = -1;
    let total = prod ? 1 : 0;
    if (s.since('run') >= 0) {
      const p = s.prog('run');
      i = Math.min(3, Math.floor(p * 4.4 - 0.3));
    }
    if (s.since('index') >= 0) i = 3;
    if (prod) i = Math.min(3, Math.floor(s.prog('pi') * 5));
    for (let k = 0; k <= i; k++) total = prod ? total * vals[k]! : total + vals[k]!;
    s.slot('i', Math.max(0, i));
    s.slot('tot', i < 0 ? 0 : total);
    s.alpha(aA, () => {
      s.text('x', ax - u * 5, ay + ch / 2, { size: 5, italic: true, weight: 600, color: s.c('orange') });
      vals.forEach((v, k) => s.cell(ax + k * cw, ay, cw, ch, String(v), 'orange', { on: k === i ? 1 : k < i ? 0.25 : 0 }));
      const mathIdx = s.ease('read', 0.5);
      s.alpha(mathIdx, () => vals.forEach((_, k) => s.text(`i=${k + 1}`, ax + k * cw + cw / 2, ay - u * 3, { size: 3.2, font: 'mono', color: s.c('--ink-3') })));
      s.alpha(s.ease('index', 0.5), () => {
        vals.forEach((_, k) => s.text(`[${k}]`, ax + k * cw + cw / 2, ay + ch + u * 3.4, { size: 3.4, font: 'mono', color: s.c('purple') }));
        s.text('math counts from 1', w * 0.5, h * 0.22, { size: 3.8, align: 'left', italic: true, color: s.c('--ink-2') });
        s.text('Python counts from 0', w * 0.5, h * 0.3, { size: 3.8, align: 'left', italic: true, color: s.c('purple') });
      });
      if (i >= 0) {
        const tx = ax + i * cw + cw / 2;
        s.arrow(tx, ay + ch + u * 9, tx, ay + ch + u * 2, s.c('--ink-2'), 0.5);
      }
      const tb = ay + ch + u * 10;
      s.rrect(ax + cw * 0.5, tb, cw * 3, ch, 1.6, { fill: s.tint('purple', 0.1), stroke: s.c('purple') });
      s.text(`${prod ? 'product' : 'total'} = ${i < 0 ? (prod ? 1 : 0) : total}`, ax + cw * 2, tb + ch / 2, { size: 4.4, font: 'mono', weight: 600, color: s.c('purple') });
    });
    const npY = ay + ch * 2 + u * 17;
    s.alpha(s.win('np', 'pi'), () => s.text('np.sum(x)  →  10', w / 2, npY, { size: 4.6, font: 'mono', weight: 600, color: s.c('purple') }));
    s.alpha(s.ease('pi', 0.5), () => s.text('np.prod(x)  →  24', w / 2, npY, { size: 4.6, font: 'mono', weight: 600, color: s.c('purple') }));
    s.alpha(s.ease('remember', 0.6), () => {
      s.rrect(0, 0, w, h, 0, { fill: s.c('--card') });
      s.text('Σ  =  loop, and add', w / 2, h / 2, { size: 8, font: 'display', weight: 560 });
    });
  },
};

const expLog: SceneDef = {
  marks: {
    e: { tex: String.raw`e \approx 2.718`, x: 0.5, y: 0.5, size: 12 },
    exp: { tex: String.raw`y = e^{\symx}`, x: 0.28, y: 0.2, size: 6 },
    log: { tex: String.raw`y = \log \symx`, x: 0.78, y: 0.62, size: 5.4 },
  },
  draw(s) {
    const { w, h, u } = s;
    s.show('e', s.win('e', 'exp'));
    // Phase 1: e^x explodes to the right and hugs zero to the left.
    const aA = s.win('exp', 'log');
    if (aA > 0) {
      const fr = new Frame(s, area(s, 0.1, 0.06), [-5.2, 3.4, -2, 22]);
      let px = 0;
      if (s.since('zero') >= 0) px = lerp(0, 2, smooth((s.prog('zero') - 0.4) / 0.6));
      if (s.since('boom') >= 0) px = lerp(2, 3, smooth(s.prog('boom') * 2));
      if (s.since('left') >= 0) px = lerp(3, -5, smooth(s.prog('left') * 1.4));
      if (s.since('why') >= 0) px = -5;
      s.slot('x', fmt(Math.round(px * 10) / 10));
      s.slot('ex', fmt(Math.exp(Math.round(px * 10) / 10), 3));
      s.alpha(aA, () => {
        fr.grid(1, 0.8);
        [5, 10, 15, 20].forEach((v) => s.text(String(v), fr.X(0) - u * 1.5, fr.Y(v), { size: 2.8, font: 'mono', align: 'right', color: s.c('--ink-3') }));
        fr.fn(Math.exp, s.c('red'), 0.9);
        s.show('exp', aA, { x: fr.X(-3.6) / w, y: fr.Y(15) / h });
        // multiply-by-e steps
        s.alpha(s.win('zero', 'left'), () => {
          [0, 1, 2].forEach((k) => {
            if (px < k) return;
            fr.dot(k, Math.exp(k), 1.1, s.c('red'));
            s.text(`${fmt(Math.exp(k), 3)}`, fr.X(k) - u * 2, fr.Y(Math.exp(k)) - u * 1.5, { size: 3.4, font: 'mono', align: 'right', color: s.c('red'), halo: true });
            if (k > 0) s.text('×2.7', fr.X(k - 0.45) + u * 3, fr.Y(Math.exp(k - 0.5)) + u * 2, { size: 3, font: 'mono', align: 'left', color: s.c('--ink-3'), halo: true });
          });
        });
        if (s.since('why') < 0) {
          fr.dot(px, Math.exp(px), 1.5, s.c('orange'));
          const right = px < 0.5;
          s.text(`exp(${fmt(Math.round(px * 10) / 10)}) = ${fmt(Math.exp(px), 3)}`, fr.X(px) + u * (right ? 3 : -3), fr.Y(Math.exp(px)) - u * (px < -1 ? 5 : 0), { size: 3.8, font: 'mono', align: right ? 'left' : 'right', halo: true });
        }
        s.alpha(s.win('left', 'why'), () => s.text('never touches zero', fr.X(-2.5), fr.Y(5), { size: 3.8, italic: true, color: s.c('--ink-2'), halo: true }));
        // why: any score becomes positive
        const wA = s.ease('why', 0.6);
        s.alpha(wA, () => {
          [-2, 0.5, 2].forEach((sc, i) => {
            const p = s.ease('why', 0.8, 0.4 + i * 0.5);
            fr.dot(sc, 0, 1.2, s.c('purple'));
            s.text(String(sc), fr.X(sc), fr.Y(0) + u * 3.4, { size: 3.2, font: 'mono', color: s.c('purple'), halo: true });
            if (p > 0) {
              s.line(fr.X(sc), fr.Y(0), fr.X(sc), fr.Y(Math.exp(sc) * p), s.c('purple'), 0.5, [1, 0.8]);
              s.alpha(p, () => {
                fr.dot(sc, Math.exp(sc), 1.2, s.c('red'));
                s.text(fmt(Math.exp(sc), 2), fr.X(sc) + u * 2, fr.Y(Math.exp(sc)) - u * 2, { size: 3.2, font: 'mono', align: 'left', color: s.c('red'), halo: true });
              });
            }
          });
        });
      });
    }
    // Phase 2: log is exp mirrored across the diagonal.
    const bA = s.win('log', 'softmax');
    if (bA > 0) {
      const fr = new Frame(s, area(s, 0.1, 0.06), [-7.5, 7.5, -7.5, 4.5], true);
      const m = s.ease('mirror', 1.6, 0.3);
      s.alpha(bA, () => {
        fr.grid(1, 0.8);
        const [vx0, vx1] = fr.view;
        s.line(fr.X(vx0), fr.Y(vx0), fr.X(vx1), fr.Y(vx1), s.c('--ink-3'), 0.35, [1.2, 1]);
        fr.fn(Math.exp, s.c('red'), 0.8);
        // Each point (t, e^t) travels to (e^t, t).
        const c = s.ctx;
        fr.clip(() => {
          c.beginPath();
          for (let i = 0; i <= 200; i++) {
            const t = -7.5 + (i / 200) * 9.5;
            const ex = Math.exp(t);
            const x = lerp(t, ex, m);
            const y = lerp(ex, t, m);
            if (i) c.lineTo(fr.X(x), fr.Y(y));
            else c.moveTo(fr.X(x), fr.Y(y));
          }
          c.strokeStyle = s.tint('teal', smooth(m * 5));
          c.lineWidth = u * 0.9;
          c.stroke();
        });
        s.show('log', bA * m, { x: fr.X(4.6) / w, y: fr.Y(2.6) / h });
        s.alpha(s.ease('vals', 0.5), () => {
          fr.dot(1, 0, 1.3, s.c('teal'));
          s.text('log 1 = 0', fr.X(1) + u * 2, fr.Y(0) + u * 3.6, { size: 3.6, font: 'mono', align: 'left', color: s.c('teal'), halo: true });
        });
        s.alpha(s.ease('vals', 0.5, 2.2), () => {
          fr.dot(0.001, Math.log(0.001), 1.3, s.c('teal'));
          s.text('log 0.001 = −6.9', fr.X(0.001) + u * 2.4, fr.Y(Math.log(0.001)), { size: 3.6, font: 'mono', align: 'left', color: s.c('teal'), halo: true });
        });
      });
    }
    // Phase 3: the softmax, step by step.
    const cA = s.ease('softmax', 0.6);
    if (cA > 0) {
      const sc = [2, 1, -1];
      const ex = sc.map(Math.exp);
      const tot = ex.reduce((a, b) => a + b, 0);
      const pr = ex.map((v) => v / tot);
      const names = ['cat', 'dog', 'ship'];
      s.alpha(cA, () => {
        const cols = [w * 0.2, w * 0.5, w * 0.8];
        const base = h * 0.7;
        const unit = h * 0.05;
        const stage1 = s.ease('softmax', 1, 1.6);
        const stage2 = s.ease('divide', 1, 0.3);
        const titles = ['scores s', 'e^s  (all positive)', 'e^s / total  (sums to 1)'];
        const ti = stage2 > 0.5 ? 2 : stage1 > 0.5 ? 1 : 0;
        s.text(titles[ti]!, w / 2, h * 0.16, { size: 4.8, font: 'mono', weight: 600 });
        s.line(w * 0.08, base, w * 0.92, base, s.c('--axis'), 0.35);
        sc.forEach((v, i) => {
          const bw = w * 0.13;
          const target = stage2 > 0 ? lerp(ex[i]!, pr[i]! * 8, stage2) : lerp(v, ex[i]!, stage1);
          const hpx = target * unit;
          const k: Color = stage1 > 0.5 ? (stage2 > 0.5 ? 'green' : 'red') : 'purple';
          s.rrect(cols[i]! - bw / 2, hpx >= 0 ? base - hpx : base, bw, Math.abs(hpx), 0.8, { fill: s.tint(k, 0.6) });
          const label = stage2 > 0.5 ? fmt(pr[i]!, 2) : stage1 > 0.5 ? fmt(ex[i]!, 3) : String(v);
          s.text(label, cols[i]!, (hpx >= 0 ? base - hpx : base - hpx) + (hpx >= 0 ? -u * 3 : u * 3.4), { size: 3.8, font: 'mono', weight: 600, halo: true });
          s.text(names[i]!, cols[i]!, base + u * (v < 0 && stage1 < 0.5 ? 9 : 4), { size: 3.6, color: s.c('--ink-3') });
        });
      });
    }
  },
};

const derivatives: SceneDef = {
  marks: {
    d: { tex: String.raw`\frac{d}{d\symx}\,\symx^2 = 2\symx`, x: 0.08, y: 0.2, size: 6, align: 'left' },
    r1: { tex: String.raw`\symx^n \;\to\; n\,\symx^{n-1}`, x: 0.08, y: 0.35, size: 4.6, align: 'left' },
    r2: { tex: String.raw`e^{\symx} \;\to\; e^{\symx}`, x: 0.08, y: 0.45, size: 4.6, align: 'left' },
    r3: { tex: String.raw`\log \symx \;\to\; 1/\symx`, x: 0.08, y: 0.55, size: 4.6, align: 'left' },
  },
  draw(s) {
    const { w, h, u } = s;
    s.alpha(s.win('calc', 'line'), () => {
      s.text('calculus,', w / 2, h * 0.42, { size: 9, font: 'display', weight: 560 });
      s.text('the friendly kind', w / 2, h * 0.58, { size: 6, font: 'display', italic: true, color: s.c('--ink-2') });
    });
    const fr = new Frame(s, area(s, 0.1, 0.06), [-1.6, 3.6, -1, 7]);
    // A straight line has one slope.
    const lA = s.win('line', 'curve');
    s.alpha(lA, () => {
      fr.grid(1, 0.8);
      fr.fn((x) => 2 * x + 1, s.c('purple'), 0.8);
      const p = s.ease('line', 0.8, 1.2);
      s.alpha(p, () => {
        s.line(fr.X(1), fr.Y(3), fr.X(2), fr.Y(3), s.c('--accent'), 0.6);
        s.line(fr.X(2), fr.Y(3), fr.X(2), fr.Y(5), s.c('--accent'), 0.6);
        s.text('run 1', fr.X(1.5), fr.Y(3) + u * 3.4, { size: 3.6, font: 'mono', color: s.c('--accent'), halo: true });
        s.text('rise 2', fr.X(2) + u * 2, fr.Y(4), { size: 3.6, font: 'mono', color: s.c('--accent'), align: 'left', halo: true });
        s.text('slope = rise / run = 2', fr.X(-1.3), fr.Y(6.3), { size: 4.2, font: 'mono', weight: 600, align: 'left', halo: true });
      });
    });
    // The curve, a secant, and the tangent it becomes.
    const cA = s.ease('curve', 0.6);
    if (cA > 0) {
      const f = (x: number) => x * x;
      const x0 = 1.5;
      let hh = 1;
      if (s.since('shrink') >= 0) hh = Math.pow(10, lerp(0, -2, smooth((s.prog('shrink') - 0.08) / 0.7)));
      const slope = (f(x0 + hh) - f(x0)) / hh;
      s.slot('h', hh >= 0.995 ? '1' : fmt(hh, 2));
      s.slot('slope', fmt(slope, 3));
      s.alpha(cA, () => {
        fr.grid(1, 0.8);
        fr.fn(f, s.c('purple'), 0.9);
        const signA = s.ease('sign', 0.6);
        // nudge: a small change in, a bigger change out
        s.alpha(s.win('nudge', 'measure'), () => {
          const nd = 0.45 * (0.55 + 0.45 * Math.sin(s.since('nudge') * 2.4));
          s.line(fr.X(x0), fr.Y(f(x0)), fr.X(x0 + nd), fr.Y(f(x0)), s.c('orange'), 0.9);
          s.line(fr.X(x0 + nd), fr.Y(f(x0)), fr.X(x0 + nd), fr.Y(f(x0 + nd)), s.c('purple'), 0.9);
          fr.dot(x0, f(x0), 1.3, s.c('orange'));
          fr.dot(x0 + nd, f(x0 + nd), 1, s.c('purple'));
          s.text('nudge in', fr.X(x0 + nd / 2), fr.Y(f(x0)) + u * 3.6, { size: 3.6, color: s.c('orange'), halo: true });
          s.text('change out', fr.X(x0 + nd) + u * 2, fr.Y(f(x0) + (f(x0 + nd) - f(x0)) / 2), { size: 3.6, align: 'left', color: s.c('purple'), halo: true });
        });
        const secA = s.win('measure', 'rule') * (1 - s.ease('tangent', 0.8, 0.6) * 0.75);
        s.alpha(secA, () => {
          fr.dot(x0, f(x0), 1.3, s.c('orange'));
          fr.dot(x0 + hh, f(x0 + hh), 1.1, s.c('slate'));
          fr.fn((x) => f(x0) + slope * (x - x0), s.c('--ink-2'), 0.5);
          s.line(fr.X(x0), fr.Y(f(x0)), fr.X(x0 + hh), fr.Y(f(x0)), s.c('slate'), 0.45, [1, 0.8]);
          s.line(fr.X(x0 + hh), fr.Y(f(x0)), fr.X(x0 + hh), fr.Y(f(x0 + hh)), s.c('slate'), 0.45, [1, 0.8]);
          if (hh > 0.2) s.text(`h = ${fmt(hh, 2)}`, fr.X(x0 + hh / 2), fr.Y(f(x0)) + u * 3.4, { size: 3.4, font: 'mono', color: s.c('slate'), halo: true });
          s.text(`slope = ${slope.toFixed(slope < 3.1 ? 3 : 2)}`, fr.X(-1.3), fr.Y(6.3), { size: 4.4, font: 'mono', weight: 600, align: 'left', halo: true });
          s.text(`h = ${hh >= 0.995 ? '1' : fmt(hh, 2)}`, fr.X(-1.3), fr.Y(5.5), { size: 3.8, font: 'mono', align: 'left', color: s.c('slate'), halo: true });
        });
        const tA = s.win('tangent', 'sign');
        s.alpha(tA, () => {
          fr.fn((x) => f(x0) + 3 * (x - x0), s.c('teal'), 0.8, 0.3, 2.8);
          s.text('tangent: slope 3', fr.X(1.8), fr.Y(1.1), { size: 3.8, font: 'mono', weight: 600, color: s.c('teal'), align: 'left', halo: true });
        });
        s.show('d', cA * s.win('rule', 'sign'));
        ['r1', 'r2', 'r3'].forEach((k, i) => s.show(k, cA * s.win('rules', 'sign') * s.ease('rules', 0.5, 0.6 + i * 1.4)));
        // Reading the sign: slide the tangent along the curve.
        s.alpha(signA, () => {
          const t = s.since('sign');
          const xs = t < 0 ? -1 : lerp(-1.2, 2.4, smooth((t - 0.4) / 7));
          const m = 2 * xs;
          const col = Math.abs(m) < 0.25 ? s.c('slate') : m > 0 ? s.c('green') : s.c('red');
          fr.fn((x) => f(xs) + m * (x - xs), col, 0.7, xs - 0.8, xs + 0.8);
          fr.dot(xs, f(xs), 1.4, col);
          const word = Math.abs(m) < 0.25 ? 'flat: 0' : m > 0 ? `uphill: +${m.toFixed(1)}` : `downhill: ${m.toFixed(1)}`;
          s.text(word, fr.X(xs), fr.Y(f(xs)) - u * 6, { size: 4, font: 'mono', weight: 600, color: col, halo: true });
          s.alpha(s.ease('key', 0.6), () => {
            const kx = 2.2;
            fr.dot(kx, f(kx), 1.4, s.c('orange'));
            s.arrow(fr.X(kx), fr.Y(f(kx)) + u * 5, fr.X(kx - 0.9), fr.Y(f(kx)) + u * 5, s.c('--accent'), 0.9, 3);
            s.text('move this way', fr.X(kx - 0.45), fr.Y(f(kx)) + u * 9.5, { size: 3.6, italic: true, color: s.c('--accent'), halo: true });
          });
        });
      });
    }
  },
};

const gradient: SceneDef = {
  marks: {
    many: { tex: String.raw`L(w_1, w_2, w_3, \dots, w_{1{,}000{,}000})`, x: 0.5, y: 0.5, size: 6 },
    f: { tex: String.raw`\symf(\symx, y) = \symx^2 + 3y^2`, x: 0.5, y: 0.1, size: 5 },
    g: { tex: String.raw`\symgrad = \begin{bmatrix} 2\symx \\ 6y \end{bmatrix}`, x: 0.5, y: 0.11, size: 4.2 },
  },
  draw(s) {
    const { w, h, u } = s;
    s.show('many', s.win('many', 'two'));
    const A = s.ease('two', 0.7);
    if (A <= 0) return;
    const fr = new Frame(s, area(s, 0.18, 0.04), [-3.1, 3.1, -1.75, 2.05], true);
    const f = (x: number, y: number) => x * x + 3 * y * y;
    const grad = (x: number, y: number): [number, number] => [2 * x, 6 * y];
    let px = 2;
    let py = 1;
    let steps = 0;
    const path: [number, number][] = [[px, py]];
    if (s.since('steps') >= 0) {
      steps = Math.min(16, Math.floor(s.since('steps') / 0.55));
      for (let k = 0; k < steps; k++) {
        const [gx, gy] = grad(px, py);
        px -= 0.1 * gx;
        py -= 0.1 * gy;
        path.push([px, py]);
      }
    }
    s.slot('px', fmt(Math.round(px * 100) / 100));
    s.slot('py', fmt(Math.round(py * 100) / 100));
    s.slot('steps', steps);
    s.alpha(A, () => {
      s.show('f', A * (1 - s.ease('grad', 0.5)));
      // Contours of the bowl: ellipses x^2 + 3y^2 = c.
      const c = s.ctx;
      fr.clip(() => {
        [16, 12, 9, 6.5, 4.5, 3, 1.8, 0.9, 0.35].forEach((lev, i) => {
          c.beginPath();
          c.ellipse(fr.X(0), fr.Y(0), fr.kx * Math.sqrt(lev), fr.ky * Math.sqrt(lev / 3), 0, 0, Math.PI * 2);
          c.fillStyle = s.tint('purple', 0.035 + i * 0.012);
          c.fill();
          c.strokeStyle = s.tint('purple', 0.35);
          c.lineWidth = u * 0.25;
          c.stroke();
        });
      });
      s.text('low', fr.X(0), fr.Y(0), { size: 3, font: 'mono', color: s.c('purple'), halo: true });
      // Partial derivatives: freeze one input, slide along the other.
      const sA = s.win('partial', 'grad');
      s.alpha(sA, () => {
        const pp = s.prog('partial');
        const horiz = pp < 0.55 || s.since('px') >= 0;
        s.line(fr.X(-3.2), fr.Y(1), fr.X(3.2), fr.Y(1), s.tint('orange', horiz ? 0.8 : 0.25), 0.45, [1.4, 1]);
        s.text('y frozen: only x moves', fr.X(-2.9), fr.Y(1) - u * 2.6, { size: 3.4, align: 'left', color: s.c('orange'), halo: true });
        s.alpha(s.since('px') >= 0 ? s.ease('px', 0.5, 2.6) : 0, () => {
          s.line(fr.X(2), fr.Y(-1.7), fr.X(2), fr.Y(2), s.tint('teal', 0.8), 0.45, [1.4, 1]);
          s.text('x frozen', fr.X(2) - u * 1.6, fr.Y(-1.4), { size: 3.4, align: 'right', color: s.c('teal'), halo: true });
        });
      });
      const [gx, gy] = grad(2, 1);
      const k = 0.13;
      const p0 = path[0]!;
      s.alpha(s.win('px', 'steps') * (s.since('px') >= 0 ? 1 : 0), () => {
        const comp = s.ease('px', 0.6, 0.4);
        const compY = s.ease('px', 0.6, 2.8);
        s.alpha(comp * (1 - s.ease('grad', 0.6, 0.8)), () => {
          fr.arrow(p0[0], p0[1], p0[0] + gx * k, p0[1], s.c('orange'), 0.6);
          s.text('2x = 4', fr.X(p0[0] + gx * k * 0.6), fr.Y(p0[1]) + u * 3.4, { size: 3.4, font: 'mono', color: s.c('orange'), halo: true });
        });
        s.alpha(compY * (1 - s.ease('grad', 0.6, 0.8)), () => {
          fr.arrow(p0[0], p0[1], p0[0], p0[1] + gy * k, s.c('teal'), 0.6);
          s.text('6y = 6', fr.X(p0[0]) - u * 1.6, fr.Y(p0[1] + gy * k * 0.6), { size: 3.4, font: 'mono', color: s.c('teal'), align: 'right', halo: true });
        });
      });
      const gA = s.win('grad', 'steps');
      s.alpha(gA, () => {
        fr.arrow(p0[0], p0[1], p0[0] + gx * k, p0[1] + gy * k, s.c('teal'), 1);
        s.text('∇f', fr.X(p0[0] + gx * k) + u * 1.5, fr.Y(p0[1] + gy * k), { size: 4.4, italic: true, weight: 600, color: s.c('teal'), align: 'left', halo: true });
        s.show('g', gA);
        s.alpha(s.ease('uphill', 0.6, 1.2), () => s.text('steepest way up', fr.X(p0[0] + gx * k) - u * 3, fr.Y(p0[1] + gy * k) + u * 1, { size: 3.6, italic: true, color: s.c('teal'), align: 'right', halo: true }));
      });
      s.alpha(s.win('down', 'steps'), () => {
        fr.arrow(p0[0], p0[1], p0[0] - gx * k, p0[1] - gy * k, s.c('--accent'), 1);
        s.text('downhill', fr.X(p0[0] - gx * k) + u * 2, fr.Y(p0[1] - gy * k) + u * 2, { size: 3.6, italic: true, color: s.c('--accent'), align: 'left', halo: true });
      });
      // Gradient descent.
      const dA = s.ease('steps', 0.4);
      s.alpha(dA, () => {
        const cc = s.ctx;
        cc.beginPath();
        path.forEach(([x, y], i) => (i ? cc.lineTo(fr.X(x), fr.Y(y)) : cc.moveTo(fr.X(x), fr.Y(y))));
        cc.strokeStyle = s.c('--accent');
        cc.lineWidth = u * 0.6;
        cc.stroke();
        path.forEach(([x, y], i) => i < path.length - 1 && fr.dot(x, y, 0.7, s.tint('--accent', 0.6)));
        const lx = fr.rect[0] + u;
        s.text(`step ${steps}   height ${f(px, py).toFixed(2)}`, lx, fr.rect[1] + fr.rect[3] - u * 2, { size: 3.8, font: 'mono', weight: 600, align: 'left', halo: true });
      });
      fr.dot(px, py, 1.6, s.c('orange'));
      s.alpha(s.ease('gd', 0.6, 1), () => s.text('gradient descent', fr.X(0), fr.Y(-1.45), { size: 4.6, font: 'display', weight: 600, color: s.c('--accent'), halo: true }));
    });
  },
};

const chain: SceneDef = {
  marks: {
    rule: { tex: String.raw`\frac{dv}{d\symx} = \frac{dv}{du} \cdot \frac{du}{d\symx}`, x: 0.5, y: 0.78, size: 6 },
    mult: { tex: String.raw`\frac{d\symf}{d\symx} = 2u \cdot 2 = 12`, x: 0.5, y: 0.8, size: 6 },
  },
  draw(s) {
    const { w, h, u } = s;
    // Phase 1: a pipeline of functions.
    const pA = s.win('pipe', 'g1');
    s.alpha(pA, () => {
      const n = 4;
      const bw = w * 0.14;
      const bh = h * 0.16;
      const gap = (w * 0.86 - n * bw) / (n - 1);
      for (let i = 0; i < n; i++) {
        const x = w * 0.07 + i * (bw + gap);
        s.alpha(s.ease('pipe', 0.5, i * 0.35), () => {
          s.rrect(x, h * 0.36, bw, bh, 2, { fill: s.tint('purple', 0.1), stroke: s.c('purple'), lw: 0.5 });
          s.text(`f${i + 1}`, x + bw / 2, h * 0.36 + bh / 2, { size: 4.6, italic: true, weight: 600, color: s.c('purple') });
          if (i < n - 1) s.arrow(x + bw + u, h * 0.36 + bh / 2, x + bw + gap - u, h * 0.36 + bh / 2, s.c('--ink-3'), 0.5);
        });
      }
      const q = (s.t * 0.35) % 1;
      s.circle(w * 0.07 + q * w * 0.86, h * 0.36 + bh / 2 + bh * 0.75, u * 1.3, { fill: s.c('orange') });
      s.show('rule', pA * s.ease('rule', 0.6, 2));
    });
    // Phase 2: gears.
    const gA = s.win('g1', 'curvy');
    if (gA > 0) {
      s.alpha(gA, () => {
        const base = s.t * 0.55;
        const R = Math.min(h * 0.2, w * 0.15);
        const cy = h * 0.45;
        const gears: [number, number, Color, string, number, string][] = [
          [w * 0.5 - R * 1.6, R, 'orange', 'x', 1, 'g1'],
          [w * 0.5 + R * 0.02, R * 0.62, 'purple', 'u', -3, 'g1'],
          [w * 0.5 + R * 1.17, R * 0.48, 'teal', 'v', 12, 'g2'],
        ];
        gears.forEach(([gx, r, k, lab, rate, beat], i) => {
          s.alpha(s.ease(beat, 0.6, i === 1 ? 1 : 0), () => {
            gear(s.ctx, gx, cy, r, base * rate, s.c(k), Math.round(8 + r / u / 2));
            s.circle(gx, cy, r * 0.32, { fill: s.c('--card'), stroke: s.c(k), lw: 0.4 });
            s.text(lab, gx, cy + u * 0.3, { size: 4.4, italic: true, weight: 650, color: s.c(k) });
          });
        });
        const local = s.ease('local', 0.6);
        s.alpha(s.ease('g1', 0.5, 1.6) * (s.since('g3') > 0 && local < 0.5 ? 0.3 : 1), () => s.text('× 3', (gears[0]![0] + gears[1]![0]) / 2, cy - R - u * 2, { size: 4.4, font: 'mono', weight: 600 }));
        s.alpha(s.ease('g2', 0.5, 0.8) * (s.since('g3') > 0 && local < 0.5 ? 0.3 : 1), () => s.text('× 4', (gears[1]![0] + gears[2]![0]) / 2, cy - R - u * 2, { size: 4.4, font: 'mono', weight: 600 }));
        s.alpha(s.win('g3', 'local'), () => {
          s.text('x: 1 turn    u: 3 turns    v: 12 turns', w / 2, h * 0.74, { size: 3.6, font: 'mono', color: s.c('--ink-2') });
          s.text('3 × 4 = 12', w / 2, h * 0.86, { size: 6.4, font: 'mono', weight: 650, color: s.c('teal') });
        });
        s.alpha(local, () => s.text('each gear knows only its neighbor', w * 0.5, h * 0.84, { size: 4.2, italic: true, color: s.c('--ink-2') }));
      });
    }
    // Phase 3: a curvier pipeline, with a nudge rippling through.
    const cA = s.win('curvy', 'backprop');
    if (cA > 0) {
      s.alpha(cA, () => {
        const cy = h * 0.42;
        const bw = w * 0.2;
        const bh = h * 0.16;
        const nodes: [number, string, string, Color][] = [
          [w * 0.08, 'x = 1', '', 'orange'],
          [w * 0.31, '2x + 1', 'rate 2', 'purple'],
          [w * 0.55, 'u²', 'rate 2u = 6', 'purple'],
          [w * 0.8, 'f = 9', '', 'red'],
        ];
        nodes.forEach(([x, lab, rate, k], i) => {
          const box = i === 1 || i === 2;
          const nx = box ? x : x;
          if (box) s.rrect(nx, cy - bh / 2, bw, bh, 2, { fill: s.tint(k, 0.1), stroke: s.c(k), lw: 0.5 });
          s.text(lab, nx + (box ? bw / 2 : w * 0.06), cy, { size: 4.6, font: 'mono', weight: 600, color: s.c(k) });
          if (rate) s.alpha(s.ease('rates', 0.5, i === 1 ? 0 : 2), () => s.text(rate, nx + bw / 2, cy + bh / 2 + u * 4, { size: 3.8, font: 'mono', color: s.c('--accent') }));
        });
        s.arrow(w * 0.2, cy, w * 0.31 - u, cy, s.c('--ink-3'), 0.5);
        s.text('u = 3', w * 0.53 - u * 0, cy - bh / 2 - u * 3, { size: 3.4, font: 'mono', color: s.c('--ink-3') });
        s.arrow(w * 0.51 + u, cy, w * 0.55 - u, cy, s.c('--ink-3'), 0.5);
        s.arrow(w * 0.75 + u, cy, w * 0.8 - u, cy, s.c('--ink-3'), 0.5);
        // nudge x by 0.01 and watch it grow
        const nd = s.ease('mult', 0.4, 0.2);
        s.alpha(nd, () => {
          const y = cy - bh / 2 - u * 9;
          s.text('+0.01', w * 0.14, y, { size: 3.6, font: 'mono', color: s.c('orange') });
          s.alpha(s.ease('mult', 0.4, 0.9), () => s.text('+0.02', w * 0.53, y, { size: 3.6, font: 'mono', color: s.c('purple') }));
          s.alpha(s.ease('mult', 0.4, 1.6), () => s.text('+0.12', w * 0.86, y, { size: 3.6, font: 'mono', color: s.c('red') }));
        });
        s.show('mult', cA * s.ease('mult', 0.6, 1.2));
      });
    }
    // Phase 4: forward, then backward through a network.
    const bA = s.ease('backprop', 0.6);
    if (bA > 0) {
      s.alpha(bA, () => {
        const n = 5;
        const cy = h * 0.48;
        const bw = w * 0.11;
        const bh = h * 0.3;
        const gap = (w * 0.86 - n * bw) / (n - 1);
        const t = s.since('backprop');
        const fwd = clamp01((t - 0.5) / 3);
        const bwd = clamp01((t - 4.5) / 3.5);
        for (let i = 0; i < n; i++) {
          const x = w * 0.07 + i * (bw + gap);
          const lit = fwd * n > i ? 0.5 : 0;
          const blit = bwd * n > n - 1 - i ? 1 : 0;
          s.rrect(x, cy - bh / 2, bw, bh, 2, { fill: s.tint(blit ? 'teal' : 'purple', 0.08 + 0.15 * Math.max(lit, blit)), stroke: s.c(blit ? 'teal' : 'purple'), lw: 0.5 });
          s.text(i === n - 1 ? 'loss' : `L${i + 1}`, x + bw / 2, cy, { size: 3.6, font: 'mono', weight: 600, color: s.c('--ink-2') });
          if (i < n - 1) {
            s.arrow(x + bw + u, cy - bh * 0.25, x + bw + gap - u, cy - bh * 0.25, s.tint('--ink-3', fwd * n > i + 0.5 ? 1 : 0.3), 0.5);
            s.arrow(x + bw + gap - u, cy + bh * 0.25, x + bw + u, cy + bh * 0.25, s.tint('teal', bwd * n > n - 1.5 - i ? 1 : 0.15), 0.5);
            if (bwd * n > n - 1.5 - i) s.text('×', x + bw + gap / 2, cy + bh * 0.25 + u * 3.4, { size: 3.6, font: 'mono', color: s.c('teal') });
          }
        }
        s.text('forward: compute', w / 2, cy - bh / 2 - u * 5, { size: 4, italic: true, color: s.c('--ink-2') });
        s.alpha(bwd > 0 ? 1 : 0, () => s.text('backward: multiply local rates', w / 2, cy + bh / 2 + u * 8, { size: 4, italic: true, color: s.c('teal') }));
      });
    }
  },
};

const probability: SceneDef = {
  marks: {
    gauss: { tex: String.raw`\symmu + \symsigma \cdot \mathcal{N}(0, 1)`, x: 0.82, y: 0.16, size: 4.8 },
  },
  draw(s) {
    const { w, h, u } = s;
    // Phase 1: a probability, and a distribution that sums to one.
    const aA = s.win('p', 'mean');
    s.alpha(s.win('two', 'p'), () => s.text('probability', w / 2, h / 2, { size: 9, font: 'display', weight: 560 }));
    if (aA > 0) {
      s.alpha(aA, () => {
        const x0 = w * 0.12;
        const x1 = w * 0.88;
        const ly = h * 0.26;
        s.line(x0, ly, x1, ly, s.c('--axis'), 0.5);
        s.text('0', x0, ly + u * 4, { size: 3.6, font: 'mono' });
        s.text('1', x1, ly + u * 4, { size: 3.6, font: 'mono' });
        s.text('never', x0, ly - u * 4, { size: 3.4, italic: true, color: s.c('--ink-3') });
        s.text('certainly', x1, ly - u * 4, { size: 3.4, italic: true, color: s.c('--ink-3') });
        const m = 0.5 + 0.45 * Math.sin(s.since('p') * 1.3);
        s.circle(lerp(x0, x1, m), ly, u * 1.6, { fill: s.c('--accent') });
        s.text(m.toFixed(2), lerp(x0, x1, m), ly - u * 4, { size: 3.4, font: 'mono', color: s.c('--accent'), halo: true });
        const dA = s.ease('dist', 0.6);
        const probs: [string, number, Color][] = [
          ['cat', 0.7, 'orange'],
          ['dog', 0.2, 'blue'],
          ['ship', 0.1, 'teal'],
        ];
        const stack = s.ease('softmax', 1.2, 1.2);
        s.alpha(dA, () => {
          let acc = 0;
          probs.forEach(([name, p, k], i) => {
            const by = lerp(h * 0.44 + i * h * 0.12, h * 0.62, stack);
            const bx = lerp(x0, lerp(x0, x1, acc), stack);
            const bwid = (x1 - x0) * p;
            s.rrect(bx, by, bwid, h * 0.08, 0.8, { fill: s.tint(k, 0.55) });
            const ly = by + h * 0.04 + (stack > 0.5 && i > 0 ? h * 0.06 + i * u * 4.6 : 0);
            s.text(`${name} ${p}`, lerp(bx + bwid + u * 2, bx + bwid / 2, stack), ly, { size: 3.6, font: 'mono', align: stack > 0.5 ? 'center' : 'left', halo: true });
            acc += p;
          });
          s.alpha(stack, () => s.text('0.7 + 0.2 + 0.1 = 1', w / 2, h * 0.9, { size: 4.6, font: 'mono', weight: 600 }));
        });
      });
    }
    // Phase 2: samples, their mean and spread, then the bell.
    const bA = s.ease('mean', 0.6);
    if (bA > 0) {
      const rng = new Rng(42);
      const z: number[] = [];
      for (let i = 0; i < 3000; i++) z.push(rng.randn());
      let n = 24;
      if (s.since('bell') >= 0) n = Math.round(lerp(24, 3000, smooth(s.prog('bell') * 1.2) ** 1.5));
      let mu = 0;
      let sg = 1;
      if (s.since('randn') >= 0) {
        const p = s.prog('randn');
        sg = lerp(1, 0.55, smooth((p - 0.35) / 0.25));
        mu = lerp(0, 1.6, smooth((p - 0.68) / 0.25));
      }
      const xs = z.slice(0, n).map((v) => mu + sg * v);
      const mean = xs.reduce((a, b) => a + b, 0) / n;
      const std = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
      s.slot('n', n);
      s.slot('mean', fmt(Math.round(mean * 100) / 100));
      s.slot('std', fmt(Math.round(std * 100) / 100));
      s.slot('mu', fmt(Math.round(mu * 10) / 10));
      s.slot('sigma', fmt(Math.round(sg * 100) / 100));
      const fr = new Frame(s, area(s, 0.14, 0.05), [-4, 4.4, -0.06, 0.82]);
      s.alpha(bA * (1 - s.ease('init', 0.6)), () => {
        const base = fr.Y(0);
        s.line(fr.X(-4), base, fr.X(4.4), base, s.c('--axis'), 0.4);
        for (let v = -3; v <= 4; v++) s.text(String(v), fr.X(v), base + u * 3.6, { size: 3, font: 'mono', color: s.c('--ink-3') });
        const bell = s.ease('bell', 0.6);
        if (bell < 1) {
          // a small pile of dots
          s.alpha(1 - bell, () => xs.slice(0, 24).forEach((v, i) => fr.dot(v, 0.05 + (i % 4) * 0.045, 1, s.tint('slate', 0.8))));
        }
        s.alpha(bell, () => {
          const bins = 42;
          const lo = -4;
          const bwid = 8.4 / bins;
          const cnt = new Array(bins).fill(0) as number[];
          for (const v of xs) {
            const b = Math.floor((v - lo) / bwid);
            if (b >= 0 && b < bins) cnt[b]!++;
          }
          cnt.forEach((cn, b) => {
            const dens = cn / (n * bwid);
            s.rrect(fr.X(lo + b * bwid) + 0.5, fr.Y(dens), fr.kx * bwid - 1, fr.ky * dens, 0.2, { fill: s.tint('slate', 0.45) });
          });
          fr.fn((x) => Math.exp(-((x - mu) ** 2) / (2 * sg * sg)) / (sg * Math.sqrt(2 * Math.PI)), s.c('purple'), 0.6);
        });
        // the 68 / 95 bands
        const rA = s.win('rule', 'randn');
        s.alpha(rA, () => {
          const c = s.ctx;
          c.fillStyle = s.tint('green', 0.1);
          c.fillRect(fr.X(mu - 2 * sg), fr.Y(0.5), fr.kx * 4 * sg, fr.Y(0) - fr.Y(0.5));
          c.fillStyle = s.tint('green', 0.14);
          c.fillRect(fr.X(mu - sg), fr.Y(0.5), fr.kx * 2 * sg, fr.Y(0) - fr.Y(0.5));
          s.text('68% within 1σ', fr.X(mu), fr.Y(0.56), { size: 3.6, font: 'mono', color: s.c('green'), halo: true });
          s.alpha(s.ease('rule', 0.5, 2.4), () => s.text('95% within 2σ', fr.X(mu + 2 * sg) + u, fr.Y(0.3), { size: 3.4, font: 'mono', color: s.c('green'), align: 'left', halo: true }));
        });
        // mean and spread markers
        s.alpha(s.ease('mean', 0.5, 0.6), () => {
          s.line(fr.X(mean), fr.Y(0), fr.X(mean), fr.Y(0.66), s.c('gold'), 0.6);
          s.text(`μ = ${mean.toFixed(2)}`, fr.X(mean), fr.Y(0.7), { size: 3.8, font: 'mono', weight: 600, color: s.c('gold'), halo: true });
        });
        s.alpha(s.ease('std', 0.5, 0.6), () => {
          const y = fr.Y(0.45);
          s.line(fr.X(mean - std), y, fr.X(mean + std), y, s.c('green'), 0.6);
          s.line(fr.X(mean - std), y - u * 1.5, fr.X(mean - std), y + u * 1.5, s.c('green'), 0.6);
          s.line(fr.X(mean + std), y - u * 1.5, fr.X(mean + std), y + u * 1.5, s.c('green'), 0.6);
          s.text(`σ = ${std.toFixed(2)}`, fr.X(mean + std) + u * 1.5, y, { size: 3.6, font: 'mono', color: s.c('green'), align: 'left', halo: true });
        });
        s.show('gauss', bA * s.win('randn', 'init'));
        s.text(`n = ${n}`, fr.rect[0] + u, fr.rect[1] + u * 2, { size: 3.4, font: 'mono', align: 'left', color: s.c('--ink-3') });
      });
      // Phase 3: small random weights.
      const iA = s.ease('init', 0.6);
      s.alpha(iA, () => {
        const rng2 = new Rng(3);
        const rows = 8;
        const cols = 14;
        const cs = Math.min((w * 0.8) / cols, (h * 0.55) / rows);
        const gx = (w - cs * cols) / 2;
        const gy = h * 0.22;
        for (let i = 0; i < rows; i++)
          for (let j = 0; j < cols; j++) {
            const v = rng2.randn();
            s.rrect(gx + j * cs + 1, gy + i * cs + 1, cs - 2, cs - 2, 0.5, { fill: s.tint(v > 0 ? 'blue' : 'red', Math.min(0.75, Math.abs(v) * 0.35)) });
          }
        s.text('W = 0.01 * np.random.randn(D, H)', w / 2, gy + rows * cs + u * 6, { size: 4, font: 'mono', weight: 600 });
        s.text('blue: small positive    red: small negative', w / 2, gy + rows * cs + u * 12, { size: 3.4, color: s.c('--ink-3') });
      });
    }
  },
};

const argmax: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const sc: [string, number][] = [
      ['cat', 1.2],
      ['dog', 3.1],
      ['ship', -0.4],
    ];
    const aA = s.win('max', 'decode');
    if (aA > 0) {
      const fr = new Frame(s, area(s, 0.14, 0.08), [-0.5, 2.5, -2.3, 4]);
      s.alpha(aA, () => {
        s.line(fr.X(-0.5), fr.Y(0), fr.X(2.5), fr.Y(0), s.c('--axis'), 0.4);
        sc.forEach(([name, v], i) => {
          const win = i === 1;
          const hl = win && s.since('max') > 0.6;
          const bw = fr.kx * 0.5;
          s.rrect(fr.X(i) - bw / 2, Math.min(fr.Y(v), fr.Y(0)), bw, Math.abs(fr.Y(v) - fr.Y(0)), 0.8, { fill: s.tint(hl ? 'purple' : 'slate', hl ? 0.6 : 0.35) });
          if (v >= 0 && !(win && s.since('max') > 0.6)) s.text(String(v), fr.X(i), fr.Y(v) - u * 3, { size: 4, font: 'mono', weight: 600, halo: true });
          else s.text(String(v), fr.X(i) + bw / 2 + u, fr.Y(v / 2), { size: 4, font: 'mono', weight: 600, align: 'left', halo: true });
          s.text(name, fr.X(i), fr.Y(-0.75), { size: 3.8, color: s.c('--ink-2') });
          const ia = s.ease('argmax', 0.5);
          s.alpha(ia, () => s.cell(fr.X(i) - u * 3.5, fr.Y(-1.4) - u * 2.5, u * 7, u * 5, String(i), win ? 'teal' : 'slate', { on: win ? 1 : 0, size: 3.6 }));
        });
        s.alpha(s.ease('max', 0.6, 1), () => {
          s.line(fr.X(-0.5), fr.Y(3.1), fr.X(2.5), fr.Y(3.1), s.c('purple'), 0.4, [1.2, 1]);
          s.text('max = 3.1  (a value)', fr.X(-0.45), fr.Y(3.1) - u * 2.8, { size: 3.8, font: 'mono', weight: 600, align: 'left', color: s.c('purple'), halo: true });
        });
        s.alpha(s.ease('argmax', 0.6, 0.8), () => s.text('argmax = 1  (a position)', fr.X(1), fr.Y(-2.1), { size: 3.8, font: 'mono', weight: 600, color: s.c('teal'), halo: true }));
        s.alpha(s.ease('pred', 0.6, 1.4), () => s.text('prediction: dog', fr.X(1.6), fr.Y(2.2), { size: 4.6, font: 'display', weight: 600, color: s.c('teal'), align: 'left', halo: true }));
      });
    }
    // The decoder.
    const dA = s.win('decode', 'kit');
    if (dA > 0) {
      s.alpha(dA, () => {
        s.text('the decoder', w / 2, h * 0.17, { size: 5, font: 'display', weight: 600 });
        const cards: [string, Color, string, string, string][] = [
          ['Σ', 'gold', 'loop, and add', 'np.sum(x)', 'sigma'],
          ['∇f', 'teal', 'the gradient', 'grad', 'nabla'],
          ['μ  σ', 'green', 'center, spread', 'x.mean(), x.std()', 'musig'],
          ['W x', 'blue', 'a dot product per row', 'W.dot(x)', 'wx'],
        ];
        const two = w > h * 1.15;
        const cols = two ? 2 : 1;
        const cw = two ? w * 0.42 : w * 0.84;
        const chh = two ? h * 0.3 : h * 0.155;
        cards.forEach(([sym, k, mean, code, beat], i) => {
          const a = s.ease(beat, 0.5);
          const x = w * 0.08 + (i % cols) * (cw + w * 0.0);
          const y = h * 0.24 + Math.floor(i / cols) * (chh + u * 2);
          s.alpha(a, () => {
            s.rrect(x, y, cw - u * 2, chh, 2, { fill: s.tint(k, 0.08), stroke: s.tint(k, 0.6) });
            s.text(sym, x + chh * 0.45, y + chh / 2, { size: Math.min(9, (chh / u) * 0.42), italic: true, weight: 600, color: s.c(k) });
            s.text(mean, x + chh * 0.95, y + chh * 0.36, { size: 3.8, align: 'left' });
            s.text(code, x + chh * 0.95, y + chh * 0.66, { size: 3.4, font: 'mono', align: 'left', color: s.c(k) });
          });
        });
      });
    }
    // The whole kit, checked off.
    const kA = s.ease('kit', 0.6);
    if (kA > 0) {
      s.alpha(kA * (1 - s.ease('next', 0.6, 0.4) * 0.94), () => tiles(s, area(s, 0.12, 0.05), () => 1, () => 0.4, 0, s.prog('kit') * 1.05));
      const nA = s.ease('next', 0.7, 0.4);
      s.alpha(nA, () => {
        s.text('next: Python and NumPy', w / 2, h * 0.42, { size: 6.4, font: 'display', weight: 600 });
        s.text('each tool, as one short line of array code', w / 2, h * 0.55, { size: 3.8, italic: true, color: s.c('--ink-2') });
        s.alpha(s.ease('next', 0.6, 2.5), () => s.text('np.sum   W.dot(x)   np.argmax', w / 2, h * 0.7, { size: 4, font: 'mono', weight: 600, color: s.c('--accent') }));
      });
    }
  },
};

export const scenes: Record<string, SceneDef> = {
  intro,
  functions,
  vectors,
  dot,
  matrices,
  sums,
  'exp-log': expLog,
  derivatives,
  gradient,
  chain,
  probability,
  argmax,
};
