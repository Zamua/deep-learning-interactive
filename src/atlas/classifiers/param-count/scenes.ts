import type { Scene, SceneDef } from '../../../lecture/scene';
import { clamp01, lerp, smooth } from '../../../lecture/scene';
import type { Color } from '../../../core/symbols';
import { after, Frame, rich } from '../../networks/draw';

type Ink = Color | `--${string}`;

const mono = (size: number, k: string, o: { align?: CanvasTextAlign; weight?: number } = {}) => ({ size, font: 'mono' as const, weight: o.weight ?? 600, align: o.align, color: k, halo: true });

/** One place unless whole, with a typographic minus. */
const num = (v: number) => (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1)).replace(/^-/, '−');
const py = (v: number) => num(v).replace('−', '-');

// ---- the line: three numbers are the whole classifier

const CATS: [number, number][] = [[0.8, 1.6], [1.4, 0.9], [1.1, 1.3], [1.7, 1.4], [0.7, 0.9], [1.4, 1.9], [1, 1]];
const SHIPS: [number, number][] = [[1.8, 3.3], [2.5, 3.9], [2.3, 3.6], [2.7, 3.4], [1.6, 3.8], [2.4, 3.1], [2, 4]];
/** The order the input ring visits the points in. */
const HOPS: [number, number][] = [SHIPS[6]!, CATS[1]!, SHIPS[2]!, CATS[4]!, SHIPS[0]!, CATS[5]!, SHIPS[3]!, CATS[2]!];

/** The text goes under the plane unless the stage is wide enough to hold it beside. */
const stacked = (s: Scene) => s.tall || s.w / s.h < 1.45;

function plane(s: Scene): Frame {
  const st = stacked(s);
  const side = st ? Math.min(s.w - 24 * s.u, s.h * 0.58) : Math.min(s.h * 0.84, s.w * 0.5);
  const l = st ? s.w / 2 - side / 2 : s.w * 0.05;
  const t = st ? s.h * 0.04 : (s.h - side) / 2;
  return new Frame(s, l, t, l + side, t + side, [-0.5, 4.5], [-0.5, 4.5]);
}

/** The line n · x = c, across the window. */
function lineAt(F: Frame, n: [number, number], c: number, k: Ink, width = 0.8) {
  const len = Math.hypot(n[0], n[1]);
  const [nx, ny] = [n[0] / len, n[1] / len];
  const p0 = [nx * (c / len), ny * (c / len)];
  F.clip(() => F.seg(p0[0]! - ny * 12, p0[1]! + nx * 12, p0[0]! + ny * 12, p0[1]! - nx * 12, k, width));
}

/** 0 outside (0, 1), rising and falling quickly at the ends. */
const hold = (q: number) => (q <= 0 || q >= 1 ? 0 : Math.min(1, 6 * q, 6 * (1 - q)));

/** The parameters over time: turned about (2, 2) as the voice says "turn", then slid. */
function params(s: Scene) {
  const a = s.at('line');
  const d = s.end('line') - a;
  const q1 = (s.t - a - 0.4 * d) / (0.34 * d);
  const q2 = (s.t - a - 0.76 * d) / (0.24 * d + 1.4);
  const th = Math.PI / 4 + (q1 > 0 && q1 < 1 ? Math.sin(q1 * Math.PI * 2) * 0.45 : 0);
  const w: [number, number] = [Math.SQRT2 * Math.cos(th), Math.SQRT2 * Math.sin(th)];
  const b = -2 * (w[0] + w[1]) + (q2 > 0 && q2 < 1 ? Math.sin(q2 * Math.PI * 2) * 1.2 : 0);
  return { w, b, turn: hold(q1), slide: hold(q2) };
}

const line: SceneDef = {
  draw(s) {
    const F = plane(s);
    const u = s.u;
    s.rrect(F.l, F.t, F.r - F.l, F.b - F.t, 1, { stroke: s.c('--axis'), lw: 0.3 });
    F.axes();
    const ax = { size: 3.2, font: 'mono', weight: 600, color: s.c('orange'), halo: true } as const;
    s.text('x₀: blue →', F.X(0) + 2 * u, F.Y(0) + 3.2 * u, { ...ax, align: 'left' });
    s.text('x₁: edges ↑', F.X(0) + 2 * u, F.t + 3.5 * u, { ...ax, align: 'left' });
    const pts = s.ease('open', 0.8);
    s.alpha(pts, () => {
      CATS.forEach(([a, b]) => F.dot(a, b, 'gold', 1.3));
      SHIPS.forEach(([a, b]) => F.dot(a, b, 'teal', 1.3));
    });
    s.alpha(s.win('line', 'three'), () => {
      s.text('cats', F.X(1.2), F.Y(0.3), mono(3.4, s.c('gold'), { weight: 650 }));
      s.text('ships', F.X(3.4), F.Y(3.7), mono(3.4, s.c('teal'), { weight: 650 }));
    });
    const P = params(s);
    s.alpha(s.ease('open', 0.8, 0.5), () => lineAt(F, P.w, -P.b, 'purple'));

    // The input ring hops from point to point while the parameters stay put.
    const hop = s.since('input');
    const inX = hop >= 0 ? HOPS[Math.floor(hop / 0.9) % HOPS.length]! : SHIPS[6]!;
    s.alpha(s.ease('input', 0.4), () => {
      s.circle(F.X(inX[0]), F.Y(inX[1]), 2.6 * u, { stroke: s.c('orange'), lw: 0.5 });
      s.text('x', F.X(inX[0]) + 4 * u, F.Y(inX[1]) - 2.6 * u, mono(3.6, s.c('orange'), { weight: 700 }));
    });
    s.slot('w0', py(P.w[0]));
    s.slot('w1', py(P.w[1]));
    s.slot('b', py(P.b));
    s.slot('x0', String(inX[0]));
    s.slot('x1', String(inX[1]));

    // Three cells: the parameters, live.
    const st = stacked(s);
    const ex = st ? s.w / 2 : (F.r + s.w) / 2;
    const dy = st ? F.b + 10 * u : s.h * 0.34;
    const pitch = st ? 15 : 16;
    const all = s.win('three', 'input');
    const lit = [Math.max(P.turn, all), Math.max(P.turn, all), Math.max(P.slide, all)];
    const names: [string, Color][] = [['w₀', 'blue'], ['w₁', 'blue'], ['b', 'green']];
    s.alpha(s.ease('open', 0.6, 0.8), () => {
      names.forEach(([n, k], i) => {
        const x = ex + (i - 1) * pitch * u;
        const v = i < 2 ? P.w[i]! : P.b;
        s.text(n, x, dy - 7.4 * u, mono(3.4, s.c(k), { weight: 650 }));
        s.cell(x - 6 * u, dy - 4 * u, 12 * u, 8 * u, num(v), k, { on: lit[i], size: 3.6 });
      });
    });
    const c1 = dy + (st ? 10.5 : 13) * u;
    const c2 = c1 + 7 * u;
    const cap = (t: string, y: number, k: Ink, a: number, size = 3.4) => s.alpha(a, () => s.text(t, ex, y, mono(size, s.c(k), { weight: 500 })));
    cap('how many numbers does it keep?', c1, '--ink-2', s.win('open', 'line'));
    cap('change w: the line turns', c1, 'blue', P.turn);
    cap('change b: it slides', c1, 'green', P.slide);
    cap('3 numbers: the whole classifier', c1, '--ink-2', s.win('three', 'name'));
    s.alpha(s.win('name', 'input'), () => {
      rich(s, [['y = ', '--ink-2'], ['m', 'blue'], ['x + ', '--ink-2'], ['b', 'green']], ex, c1, { size: 4, weight: 650 });
      s.text('m and b: its parameters', ex, c2, mono(3.3, s.c('--ink-2'), { weight: 500 }));
    });
    cap('x: a new input every image', c1, 'orange', s.ease('input', 0.6));
    cap('w and b: they stay put', c2, '--ink-2', s.ease('input', 0.6, 1.2));
  },
};

// ---- the block: one row of D weights per class, and one bias each

const CW = 9;
const CH = 8;
const CLASSES = ['cat', 'plane', 'ship'];

function grid(s: Scene) {
  const g = 11;
  const lab = 12;
  const total = lab + 3 + 3 * g + CW + 6 + CW;
  const x0 = s.w / 2 - (total / 2) * s.u;
  const W = [0, 1, 2, 3].map((i) => x0 + (lab + 3 + CW / 2 + i * g) * s.u);
  return { W, b: W[3]! + (CW + 6) * s.u, name: x0 + lab * s.u, xy: s.h * 0.2, ys: [0.35, 0.47, 0.59].map((f) => s.h * f) };
}

const block: SceneDef = {
  draw(s) {
    const G = grid(s);
    const u = s.u;
    const shape = s.ease('shape', 0.6);
    const rowOn = (r: number) => (r === 0 ? s.ease('D', 0.6, 0.6) : s.ease('C', 0.6, 0.5 + 0.4 * r));
    // The input along the top, one feature per column of W.
    s.alpha(s.ease('D', 0.6), () => {
      s.text('x', G.name, G.xy, mono(4, s.c('orange'), { align: 'right', weight: 650 }));
      G.W.forEach((x) => s.cell(x - (CW / 2) * u, G.xy - (CH / 2) * u, CW * u, CH * u, '', 'orange', { on: shape * s.win('shape') }));
      const y = G.xy - 8 * u;
      const x0 = G.W[0]! - (CW / 2) * u;
      const x1 = G.W[3]! + (CW / 2) * u;
      s.line(x0, y, x1, y, s.c('slate'), 0.35);
      s.line(x0, y, x0, y + 1.6 * u, s.c('slate'), 0.35);
      s.line(x1, y, x1, y + 1.6 * u, s.c('slate'), 0.35);
      s.text('D = 4 features', (x0 + x1) / 2, y - 3.4 * u, mono(3.4, s.c('slate')));
    });
    const counting = (r: number, c: number) => s.ease('weights', 0.3, 0.18 * (r * 4 + c));
    const fadeNums = 1 - s.ease('total', 0.6, 1.4);
    G.ys.forEach((y, r) => {
      s.alpha(rowOn(r), () => {
        s.text(CLASSES[r]!, G.name, y, mono(3.4, s.c('--ink-2'), { align: 'right', weight: 550 }));
        G.W.forEach((x, c) => {
          const n = counting(r, c);
          const band = r === 0 ? shape : 0;
          s.cell(x - (CW / 2) * u, y - (CH / 2) * u, CW * u, CH * u, n > 0.5 && fadeNums > 0.5 ? String(r * 4 + c + 1) : '', 'blue', { on: Math.max(n * fadeNums, band), size: 3.2 });
        });
      });
    });
    s.alpha(s.ease('C', 0.6, 1.6), () => s.text('C = 3 classes', G.name, G.ys[2]! + 10 * u, mono(3.2, s.c('slate'), { align: 'right' })));
    s.alpha(s.ease('bias', 0.6), () => {
      s.text('b', G.b, G.xy, mono(4, s.c('green'), { weight: 650 }));
      G.ys.forEach((y, r) => {
        const n = s.ease('bias', 0.3, 0.6 + 0.35 * r);
        s.cell(G.b - (CW / 2) * u, y - (CH / 2) * u, CW * u, CH * u, n > 0.5 && fadeNums > 0.5 ? String(13 + r) : '', 'green', { on: n * fadeNums, size: 3.2 });
      });
    });
    const cy = s.h * 0.8;
    const cy2 = s.h * 0.9;
    s.alpha(s.win('C', 'weights'), () => s.text('W: C rows × D columns', s.w / 2, cy, mono(3.6, s.c('blue'))));
    s.alpha(s.ease('weights', 0.6, 1.4) * (1 - s.ease('bias', 0.5)), () => s.text('3 × 4 = 12 weights', s.w / 2, cy, mono(3.8, s.c('blue'))));
    s.alpha(s.win('bias', 'shape'), () => s.text('12 + 3 = 15', s.w / 2, cy, mono(4.4, s.c('--ink'), { weight: 650 })));
    s.show('f', s.ease('total', 0.6, 1.4) * (1 - shape));
    s.alpha(shape, () => {
      rich(s, [['W: (C, D) = (3, 4)', 'blue'], ['   ', '--ink-2'], ['b: (3,)', 'green']], s.w / 2, cy, { size: 3.6, weight: 600 });
      s.alpha(s.ease('shape', 0.6, 2.4), () => s.text('not (4, 3): a row meets x', s.w / 2, cy2, mono(3.4, s.c('red'))));
    });
  },
  marks: {
    f: { tex: String.raw`\symC\symD + \symC`, x: 0.5, y: 0.9, size: 5 },
  },
};

// ---- what makes it grow: the image's size and color, the number of classes, never the data

/** A 32 by 32 color photo: sky, sun and sea, as CSS colors. */
const PHOTO: string[][] = Array.from({ length: 32 }, (_, i) =>
  Array.from({ length: 32 }, (_, j) => {
    if (Math.hypot(i - 9, j - 22) < 4.5) return 'rgb(250,205,80)';
    if (i > 19) return `rgb(${40 + 2 * i},${100 + 2 * i},${150 + 2 * i + ((i + j) % 3) * 6})`;
    if (i > 17 && j > 5 && j < 14) return 'rgb(120,90,70)';
    return `rgb(${120 + 3 * i},${170 + 2 * i},${235})`;
  }),
);
const GRAY2 = [[0.25, 0.7], [0.55, 0.9]];
const GRAY4 = Array.from({ length: 4 }, (_, i) => Array.from({ length: 4 }, (_, j) => 0.2 + 0.18 * i + 0.08 * ((i * 3 + j * 5) % 4)));
const COLOR4 = Array.from({ length: 4 }, (_, i) => Array.from({ length: 4 }, (_, j) => (i < 2 ? `rgb(${110 + 20 * j},${170 + 10 * i},235)` : i === 2 && j === 1 ? 'rgb(205,95,70)' : `rgb(80,${140 + 12 * j},70)`)));

const gray = (v: number) => {
  const c = Math.round(40 + 190 * v);
  return `rgb(${c},${c},${c})`;
};

function pixels(s: Scene, cx: number, cy: number, px: number, img: string[][]): void {
  const p = px * s.u;
  const n = img.length;
  const l = cx - (n * p) / 2;
  const t = cy - (n * p) / 2;
  const g = s.ctx;
  img.forEach((row, i) =>
    row.forEach((col, j) => {
      g.fillStyle = col;
      g.fillRect(l + j * p, t + i * p, p + 0.5, p + 0.5);
    }),
  );
  s.rrect(l, t, n * p, n * p, 0.3, { stroke: s.c('--ink-3'), lw: 0.25 });
}

const grows: SceneDef = {
  draw(s) {
    const u = s.u;
    const side = s.ease('side', 1.2, 0.8);
    const colr = s.ease('color', 0.8, 0.6);
    const photo = s.ease('photo', 0.9, 0.4);
    const dbl = s.ease('class', 1.4, 0.6);
    const data = s.ease('data', 0.6);

    // The image, top center, with what it is beside it.
    const iy = s.h * 0.17;
    const ix = s.w / 2 - 6 * u;
    const imgs: [string[][], number, number][] = [
      [GRAY2.map((r) => r.map(gray)), 5.5, 1 - side],
      [GRAY4.map((r) => r.map(gray)), 5.5, side * (1 - colr)],
      [COLOR4, 5.5, colr * (1 - photo)],
      [PHOTO, 0.7, photo * (1 - data)],
    ];
    imgs.forEach(([img, px, a]) => s.alpha(a, () => pixels(s, ix, iy, px, img)));
    const what = photo > 0.5 ? '32 × 32, color' : colr > 0.5 ? '4 × 4, color' : side > 0.5 ? '4 × 4, gray' : '2 × 2, gray';
    s.alpha(s.ease('px', 0.6) * (1 - data), () => s.text(what, ix + 14 * u, iy, mono(3.2, s.c('--ink-2'), { align: 'left', weight: 500 })));
    // Many images stream past, and the count does not move.
    s.alpha(data, () => {
      const n = 7;
      const sp = 15 * u;
      const off = ((s.since('data') * 9 * u) % sp) - sp;
      for (let k = 0; k <= n; k++) {
        const x = s.w / 2 - ((n - 1) / 2) * sp + k * sp + off;
        const a = clamp01(1 - Math.abs(x - s.w / 2) / (s.w * 0.46));
        s.alpha(a, () => pixels(s, x, iy, 0.36, PHOTO));
      }
      const count = Math.round(lerp(10, 1_000_000, smooth(s.since('data') / 4.5)));
      s.text(`${count.toLocaleString('en-US')} images`, s.w / 2, iy + 9 * u, mono(3.2, s.c('orange')));
    });

    // W as a block of cells, then a slab too long to draw, with b beside it.
    const D = photo > 0.5 ? 3072 : colr > 0.5 ? 48 : Math.round(lerp(4, 16, side));
    const C = Math.round(lerp(3, lerp(10, 20, dbl), photo));
    const rp = lerp(4, 2, photo) * u;
    const top = s.h * 0.4;
    const full = 64 * u;
    const width = lerp(16 * u, full, side);
    // Centered with the C label on its left.
    const x0 = s.w / 2 - (width + 6 * u) / 2 + 6 * u;
    const rows = lerp(3, lerp(10, 20, dbl), photo);
    const nr = Math.ceil(rows - 1e-6);
    const cellRow = (y: number, cols: number, pitch: number, a: number) => {
      for (let c = 0; c < Math.ceil(cols); c++) {
        const ca = c < Math.floor(cols) ? 1 : cols - Math.floor(cols);
        s.alpha(a * ca, () => s.rrect(x0 + c * pitch, y, pitch * 0.85, rp * 0.85, 0.4, { fill: s.tint('blue', 0.4), stroke: s.tint('blue', 0.8), lw: 0.12 }));
      }
    };
    for (let r = 0; r < nr; r++) {
      const ra = r < Math.floor(rows) ? 1 : rows - Math.floor(rows);
      const y = top + r * rp;
      s.alpha(ra, () => {
        const cols = lerp(4, 16, side);
        cellRow(y, cols, width / cols, (1 - colr) * (1 - photo));
        cellRow(y, 48, full / 48, colr * (1 - photo));
        s.alpha(photo, () => s.rrect(x0, y, full, rp * 0.85, 0.3, { fill: s.tint('blue', 0.4) }));
        s.rrect(x0 + width + 2.5 * u, y, rp * 0.85, rp * 0.85, 0.4, { fill: s.tint('green', 0.5), stroke: s.tint('green', 0.9), lw: 0.12 });
      });
    }
    const h = nr > 0 ? (rows - 0.15) * rp : 0;
    // The break in the slab: most of its 3,072 columns are not drawn.
    s.alpha(photo, () => {
      const g = s.ctx;
      const mx = x0 + full / 2;
      g.fillStyle = s.c('--card');
      g.beginPath();
      g.moveTo(mx - 1.6 * u, top - 1 * u);
      g.lineTo(mx + 0.4 * u, top - 1 * u);
      g.lineTo(mx + 1.6 * u, top + h + 1 * u);
      g.lineTo(mx - 0.4 * u, top + h + 1 * u);
      g.closePath();
      g.fill();
    });
    s.text(`D = ${D.toLocaleString('en-US')}`, x0 + width / 2, top - 4 * u, mono(3.4, s.c('slate')));
    s.text(`C = ${C}`, x0 - 2.5 * u, top + h / 2, mono(3.4, s.c('slate'), { align: 'right' }));

    // The count, and what changed.
    const cy = s.h * 0.86;
    const cy2 = s.h * 0.94;
    const big = (t: string, a: number) => s.alpha(a, () => s.text(t, s.w / 2, cy, mono(4, s.c('--ink'), { weight: 650 })));
    const small = (t: string, a: number, k: Ink = '--ink-2') => s.alpha(a, () => s.text(t, s.w / 2, cy2, mono(3.2, s.c(k), { weight: 500 })));
    big('3 × 4 + 3 = 15', s.ease('px', 0.6) * (1 - side));
    big('3 × 16 + 3 = 51', side * (1 - colr));
    big('3 × 48 + 3 = 147', colr * (1 - photo));
    big('10 × 3,072 + 10 = 30,730', photo * (1 - dbl));
    big('20 × 3,072 + 20 = 61,460', dbl);
    small('one feature per pixel', s.win('px', 'side'));
    small('4× the pixels: each row 4× longer', s.win('side', 'color'));
    small('3 numbers per pixel: D triples', s.win('color', 'photo'));
    small('32 × 32 × 3 = 3,072 numbers', s.win('photo', 'class'));
    small('2× the rows, 2× the biases', s.win('class', 'data'));
    small('more images: the same 61,460', s.ease('data', 0.6, 2), 'green');
  },
};

// ---- two maps in a row: count each, then add

interface Part {
  x: number;
  w: number;
  rows: number;
}

/** x, W₁, b₁, h, W₂, b₂ and s, left to right, in cells of `c` px. */
function chainLayout(s: Scene) {
  const gx = 1.8;
  const spans: [string, number][] = [['x', 1], ['g', gx], ['W1', 4], ['g', 0.7], ['b1', 1], ['g', gx], ['h', 1], ['g', gx], ['W2', 5], ['g', 0.7], ['b2', 1], ['g', gx], ['s', 1]];
  const units = spans.reduce((t, [, n]) => t + n, 0);
  const c = Math.min(5.2 * s.u, (s.w - 18 * s.u) / units);
  const rows: Record<string, number> = { x: 4, W1: 5, b1: 5, h: 5, W2: 3, b2: 3, s: 3 };
  let x = s.w / 2 - (units * c) / 2;
  const P: Record<string, Part> = {};
  for (const [k, n] of spans) {
    if (k !== 'g') P[k] = { x, w: n * c, rows: rows[k]! };
    x += n * c;
  }
  return { P, c, cy: s.h * 0.42 };
}

function grid2(s: Scene, p: Part, cols: number, c: number, cy: number, k: Color, on: number) {
  const top = cy - (p.rows * c) / 2;
  for (let r = 0; r < p.rows; r++) for (let j = 0; j < cols; j++) s.rrect(p.x + j * c, top + r * c, c * 0.86, c * 0.86, 0.5, { fill: s.tint(k, 0.2 + 0.3 * on), stroke: s.tint(k, 0.55 + 0.45 * on), lw: 0.15 + 0.15 * on });
}

const chain: SceneDef = {
  draw(s) {
    const u = s.u;
    const { P, c, cy } = chainLayout(s);
    const two = s.ease('chain', 0.8);

    // One map: x through W and b to C numbers.
    s.alpha(1 - two, () => {
      const at = (f: number, w: number, rows: number): Part => ({ x: s.w / 2 + f * c, w: w * c, rows });
      const one = { x: at(-6.05, 1, 4), W: at(-2.85, 4, 3), b: at(1.85, 1, 3), s: at(5.05, 1, 3) };
      grid2(s, one.x, 1, c, cy, 'orange', 0);
      grid2(s, one.W, 4, c, cy, 'blue', 0);
      grid2(s, one.b, 1, c, cy, 'green', 0);
      grid2(s, one.s, 1, c, cy, 'purple', 0);
      s.arrow(one.x.x + 1.2 * c, cy, one.W.x - 0.4 * c, cy, s.c('--ink-3'), 0.3, 1.6);
      s.arrow(one.b.x + 1.2 * c, cy, one.s.x - 0.4 * c, cy, s.c('--ink-3'), 0.3, 1.6);
      const ly = cy + 2.5 * c + 4.5 * u;
      s.text('D = 4 in', one.x.x + c / 2, ly, mono(3.2, s.c('orange')));
      s.text('W, b', one.W.x + 2.5 * c, ly, mono(3.2, s.c('blue')));
      s.text('C = 3 out', one.s.x + c / 2, ly, mono(3.2, s.c('purple')));
      s.text('a linear map: Wx + b', s.w / 2, s.h * 0.78, mono(3.6, s.c('--ink-2'), { weight: 500 }));
    });

    s.alpha(two, () => {
      const lit = (id: string, until?: string) => s.win(id, until);
      const on1 = Math.max(lit('W1', 'b1'), lit('c1', 'W2'));
      const on2 = Math.max(lit('W2', 'sum'));
      grid2(s, P.x!, 1, c, cy, 'orange', 0);
      grid2(s, P.W1!, 4, c, cy, 'blue', on1);
      grid2(s, P.b1!, 1, c, cy, 'green', Math.max(lit('b1', 'W2')));
      grid2(s, P.h!, 1, c, cy, 'gold', lit('H', 'W1'));
      grid2(s, P.W2!, 5, c, cy, 'blue', on2);
      grid2(s, P.b2!, 1, c, cy, 'green', lit('c2', 'sum'));
      grid2(s, P.s!, 1, c, cy, 'purple', 0);
      const arrow = (a: Part, b: Part) => s.arrow(a.x + a.w + 0.35 * c, cy, b.x - 0.35 * c, cy, s.c('--ink-3'), 0.3, 1.5);
      arrow(P.x!, P.W1!);
      arrow(P.b1!, P.h!);
      arrow(P.h!, P.W2!);
      arrow(P.b2!, P.s!);
      const mid = (p: Part) => p.x + p.w / 2;
      const hy = cy - 2.5 * c - 4.5 * u;
      s.text('D = 4', mid(P.x!), hy, mono(3.1, s.c('orange')));
      s.alpha(s.ease('H', 0.6), () => s.text('H = 5', mid(P.h!), hy, mono(3.1, s.c('slate'), { weight: 700 })));
      s.text('C = 3', mid(P.s!), hy, mono(3.1, s.c('purple')));
      const ly = cy + 2.5 * c + 4 * u;
      const sy = ly + 4.6 * u;
      const lab = (t: string, p: Part, k: Color, a: number, y = ly) => s.alpha(a, () => s.text(t, mid(p), y, mono(3.1, s.c(k))));
      lab('x', P.x!, 'orange', 1);
      lab('h', P.h!, 'gold', 1);
      lab('s', P.s!, 'purple', 1);
      lab('map 1', { ...P.W1!, w: P.b1!.x + P.b1!.w - P.W1!.x }, 'blue', s.win('chain', 'W1'));
      lab('map 2', { ...P.W2!, w: P.b2!.x + P.b2!.w - P.W2!.x }, 'blue', s.win('chain', 'W2'));
      lab('W₁', P.W1!, 'blue', s.ease('W1', 0.5));
      lab('(5, 4)', P.W1!, 'blue', s.ease('W1', 0.5, 1.2), sy);
      lab('b₁', P.b1!, 'green', s.ease('b1', 0.5));
      lab('(5,)', P.b1!, 'green', s.ease('b1', 0.5, 0.8), sy);
      lab('W₂', P.W2!, 'blue', s.ease('W2', 0.5));
      lab('(3, 5)', P.W2!, 'blue', s.ease('W2', 0.5, 1.2), sy);
      lab('b₂', P.b2!, 'green', s.ease('c2', 0.5));
      lab('(3,)', P.b2!, 'green', s.ease('c2', 0.5, 0.5), sy);
      const ky = s.h * 0.8;
      const m1 = (P.W1!.x + P.b1!.x + P.b1!.w) / 2;
      const m2 = (P.W2!.x + P.b2!.x + P.b2!.w) / 2;
      s.alpha(s.win('chain', 'H'), () => s.text('one map hands its outputs to the next', s.w / 2, ky, mono(3.3, s.c('--ink-2'), { weight: 500 })));
      s.alpha(s.ease('c1', 0.6), () => s.text('4·5 + 5 = 25', m1, ky, mono(3.4, s.c('blue'))));
      s.alpha(after(s, 'c2', 0.4), () => s.text('5·3 + 3 = 18', m2, ky, mono(3.4, s.c('blue'))));
      s.alpha(s.ease('sum', 0.6), () => s.text('25 + 18 = 43', s.w / 2, s.h * 0.9, mono(4.4, s.c('--ink'), { weight: 650 })));
    });
  },
};

export const scenes: Record<string, SceneDef> = { line, block, grows, chain };
