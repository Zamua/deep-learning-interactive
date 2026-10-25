import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';

const CW = 10;
const CH = 8;

/** The 3 by 4 grid of scene one: W's columns, the bias column, row centers. */
function grid(s: Scene) {
  const g = 12;
  const bOff = 3 * g + 17;
  const left = -(CW / 2 + 15);
  const right = bOff + CW / 2;
  const x0 = s.w / 2 - ((left + right) / 2) * s.u;
  return {
    W: [0, 1, 2, 3].map((i) => x0 + i * g * s.u),
    b: x0 + bOff * s.u,
    ys: [0.36, 0.5, 0.64].map((f) => s.h * f),
  };
}

function bracket(s: Scene, x0: number, x1: number, y: number, label: string, k: string) {
  s.line(x0, y, x1, y, k, 0.35);
  s.line(x0, y, x0, y + 1.6 * s.u, k, 0.35);
  s.line(x1, y, x1, y + 1.6 * s.u, k, 0.35);
  s.text(label, (x0 + x1) / 2, y - 3.6 * s.u, { size: 3.6, font: 'mono', weight: 600, color: k });
}

const gridScene: SceneDef = {
  draw(s) {
    const G = grid(s);
    const rowsOn = (r: number) => s.ease('rows', 0.5, 0.9 * r);
    const biasOn = (r: number) => s.ease('bias', 0.5, 0.5 + 0.35 * r);
    const shape = s.ease('shape', 0.6);
    s.alpha(s.ease('dims', 0.6), () => {
      bracket(s, G.W[0]! - (CW / 2) * s.u, G.W[3]! + (CW / 2) * s.u, s.h * 0.24, 'D = 4 features', s.c('slate'));
      s.text('C = 3', G.W[0]! - (CW / 2 + 3) * s.u, G.ys[1]!, { size: 3.6, font: 'mono', weight: 600, align: 'right', color: s.c('slate') });
      G.ys.forEach((y, r) => {
        G.W.forEach((x, c) => {
          const n = r * 4 + c + 1;
          const lit = rowsOn(r);
          s.cell(x - (CW / 2) * s.u, y - (CH / 2) * s.u, CW * s.u, CH * s.u, lit > 0.5 ? String(n) : '', 'blue', { on: lit * (1 - s.ease('total', 0.6)), size: 3.2 });
        });
      });
    });
    s.alpha(s.ease('bias', 0.6), () => {
      s.text('b', G.b, s.h * 0.24, { size: 3.8, font: 'mono', weight: 650, color: s.c('green') });
      G.ys.forEach((y, r) => {
        const lit = biasOn(r);
        s.cell(G.b - (CW / 2) * s.u, y - (CH / 2) * s.u, CW * s.u, CH * s.u, lit > 0.5 ? String(13 + r) : '', 'green', { on: lit * (1 - s.ease('total', 0.6)), size: 3.2 });
      });
    });
    const y1 = s.h * 0.8;
    s.alpha(s.ease('rows', 0.6, 2.8) * (1 - s.ease('bias', 0.4, 1.2)), () => s.text('3 × 4 = 12 weights', s.w / 2, y1, { size: 3.8, font: 'mono', color: s.c('blue') }));
    s.alpha(s.ease('bias', 0.6, 1.2), () => s.text('12 + 3 = 15', s.w / 2, y1, { size: 4.4, font: 'mono', weight: 650, color: s.c('--ink') }));
    s.show('f', s.ease('total', 0.6, 1.2) * (1 - shape));
    s.alpha(shape, () => {
      s.text('W: (C, D) = (3, 4)', s.w / 2, s.h * 0.91, { size: 3.6, font: 'mono', color: s.c('blue') });
      s.text('(3,)', G.b, G.ys[2]! + 9 * s.u, { size: 3.4, font: 'mono', color: s.c('green') });
    });
  },
  marks: {
    f: { tex: String.raw`\symC\symD + \symC`, x: 0.5, y: 0.91, size: 5 },
  },
};

/** W as a block of C by D small cells and b as a column beside it, centered on the stage. */
function block(s: Scene, rows: number, cols: number, top: number, o: { newRow?: number; grow?: number } = {}) {
  const u = s.u;
  const CELL = s.tall ? 4 : 5;
  const wide = cols * CELL + 3 + CELL;
  const x0 = s.w / 2 - (wide / 2) * u;
  const full = Math.floor(cols);
  const part = cols - full;
  for (let r = 0; r < Math.ceil(rows); r++) {
    const ra = r < Math.floor(rows) ? 1 : rows - Math.floor(rows);
    const fresh = r === 3 ? (o.newRow ?? 0) : 0;
    s.alpha(ra, () => {
      for (let c = 0; c < Math.ceil(cols); c++) {
        const a = c < full ? 1 : part;
        const old = c < 4;
        s.alpha(a, () => s.rrect(x0 + c * CELL * u, top + r * CELL * u, (CELL - 0.6) * u, (CELL - 0.6) * u, 0.6, { fill: s.tint('blue', old ? 0.35 + 0.3 * fresh : 0.35 + 0.35 * (o.grow ?? 0)), stroke: s.tint('blue', 0.8), lw: 0.15 }));
      }
      s.rrect(x0 + (cols * CELL + 3) * u, top + r * CELL * u, (CELL - 0.6) * u, (CELL - 0.6) * u, 0.6, { fill: s.tint('green', 0.45 + 0.3 * fresh), stroke: s.tint('green', 0.9), lw: 0.15 });
    });
  }
  return { x0, x1: x0 + wide * u, cell: CELL };
}

const grows: SceneDef = {
  draw(s) {
    const top = s.h * 0.3;
    const cls = s.win('class', 'side');
    const side = s.ease('side', 1.4, 1.5);
    const back = s.ease('side', 0.6);
    const rows = 3 + cls;
    const cols = lerp(4, 16, side);
    const B = block(s, rows, cols, top, { newRow: cls, grow: side });
    s.text(rows > 3.5 ? 'C = 4' : 'C = 3', B.x0 - 2.5 * s.u, top + (rows * B.cell * s.u) / 2, { size: 3.4, font: 'mono', align: 'right', color: s.c('slate') });
    s.text(`D = ${Math.round(cols)}`, s.w / 2, top - 4 * s.u, { size: 3.4, font: 'mono', color: s.c('slate') });
    const y = s.h * 0.68;
    const o = { size: 4.2, font: 'mono', weight: 600, color: s.c('--ink') } as const;
    s.alpha(1 - s.ease('class', 0.5), () => s.text('3 × 4 + 3 = 15', s.w / 2, y, o));
    s.alpha(cls * (1 - back), () => s.text('4 × 4 + 4 = 20', s.w / 2, y, o));
    s.alpha(s.ease('side', 0.5, 2.6), () => s.text('3 × 16 + 3 = 51', s.w / 2, y, o));
    s.alpha(s.win('class', 'side'), () => s.text('one more row, one more bias', s.w / 2, s.h * 0.8, { size: 3.4, color: s.c('--ink-2') }));
    s.alpha(s.win('side', 'data') * s.ease('side', 0.5, 2.6), () => s.text('4× the pixels, about 4× the count', s.w / 2, s.h * 0.8, { size: 3.4, color: s.c('--ink-2') }));
    const d = s.ease('data', 0.6);
    s.alpha(d, () => {
      const n = Math.round(lerp(6, 40, s.ease('data', 2.5, 0.6)));
      const per = 20;
      const sz = 2.6 * s.u;
      const x0 = s.w / 2 - (per * 3.2 * s.u) / 2;
      for (let i = 0; i < n; i++) {
        const cx = x0 + (i % per) * 3.2 * s.u;
        const cy = s.h * 0.8 + Math.floor(i / per) * 3.2 * s.u;
        s.rrect(cx, cy, sz, sz, 0.4, { fill: s.tint('orange', 0.45), stroke: s.tint('orange', 0.8), lw: 0.12 });
      }
      s.text('training images', s.w / 2, s.h * 0.8 - 3.4 * s.u, { size: 3.2, color: s.c('--ink-3') });
      s.alpha(s.ease('data', 0.6, 2.4), () => s.text('×1,000 images: still 51 parameters', s.w / 2, s.h * 0.94, { size: 3.4, font: 'mono', weight: 600, color: s.c('green') }));
    });
  },
};

/** Node positions of the 4 -> 5 -> 3 network. */
function net(s: Scene) {
  const xs = [0.22, 0.5, 0.78].map((f) => s.w * f);
  const sizes = [4, 5, 3];
  const gap = 9 * s.u;
  const cy = s.h * 0.44;
  return xs.map((x, l) => Array.from({ length: sizes[l]! }, (_, i) => ({ x, y: cy + (i - (sizes[l]! - 1) / 2) * gap })));
}

const layers: SceneDef = {
  draw(s) {
    const N = net(s);
    const l1 = s.win('l1', 'l2') + s.ease('sum', 0.6);
    const l2 = s.ease('l2', 0.6);
    const edge = (on: number) => ({ col: on > 0.01 ? s.tint('blue', 0.25 + 0.5 * Math.min(1, on)) : s.c('--grid'), w: 0.22 + 0.12 * Math.min(1, on) });
    const e1 = edge(l1);
    const e2 = edge(l2);
    for (const a of N[0]!) for (const b of N[1]!) s.line(a.x, a.y, b.x, b.y, e1.col, e1.w);
    for (const a of N[1]!) for (const b of N[2]!) s.line(a.x, a.y, b.x, b.y, e2.col, e2.w);
    const r = 2.4 * s.u;
    const kinds = ['orange', 'slate', 'purple'] as const;
    N.forEach((col, l) => col.forEach((p) => s.circle(p.x, p.y, r, { fill: s.c('--card'), stroke: s.c(kinds[l]), lw: 0.45 })));
    const bias = [0, l1, l2];
    N.forEach((col, l) => {
      if (l === 0) return;
      s.alpha(0.35 + 0.65 * Math.min(1, bias[l]!), () => col.forEach((p) => s.rrect(p.x + r + 0.8 * s.u, p.y - 1.1 * s.u, 2.2 * s.u, 2.2 * s.u, 0.4, { fill: s.tint('green', 0.6), stroke: s.c('green'), lw: 0.15 })));
    });
    const hy = s.h * 0.13;
    const lab = { size: 3.4, font: 'mono', weight: 600 } as const;
    s.text('D = 4', N[0]![0]!.x, hy, { ...lab, color: s.c('orange') });
    s.text('H = 5', N[1]![0]!.x, hy, { ...lab, color: s.c('slate') });
    s.text('C = 3', N[2]![0]!.x, hy, { ...lab, color: s.c('purple') });
    const cy = s.h * 0.8;
    const mid = (a: number, b: number) => (N[a]![0]!.x + N[b]![0]!.x) / 2;
    s.alpha(s.ease('l1', 0.6, 1), () => s.text('4·5 + 5 = 25', mid(0, 1), cy, { size: 3.6, font: 'mono', color: s.c('blue'), halo: true }));
    s.alpha(s.ease('l2', 0.6, 1), () => s.text('5·3 + 3 = 18', mid(1, 2), cy, { size: 3.6, font: 'mono', color: s.c('blue'), halo: true }));
    s.alpha(s.ease('sum', 0.6), () => s.text('25 + 18 = 43', s.w / 2, s.h * 0.9, { size: 4.4, font: 'mono', weight: 650, color: s.c('--ink') }));
  },
};

/** A small RGB image: three offset squares. */

export const scenes: Record<string, SceneDef> = { grid: gridScene, grows, layers };
