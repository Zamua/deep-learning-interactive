import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { after } from '../../networks/draw';
import { type Ink, rich } from '../draw';
import { type Box, iou } from '../box-iou/box';
import { type Plane, plane, rect } from '../box-iou/plane';

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

/** The overlap of two boxes that touch. */
const overlap = (a: Box, b: Box): Box => [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])];

/** A check or a cross for a box's fate: 1 kept, -1 dropped. */
function mark(s: Scene, x: number, y: number, f: number) {
  s.alpha(Math.abs(f), () => s.text(f > 0 ? '✓' : '✗', x, y, { size: 4, font: 'ui', weight: 700, color: s.c(f > 0 ? 'green' : 'red') }));
}

interface Det {
  name: string;
  box: Box;
  score: number;
  k: Ink;
  /** Where the label sits: above the top-left or top-right corner, or below the bottom-right one. */
  at: 'tl' | 'tr' | 'br';
}

/** One box with its name, its score once `sc` > 0, drawn dashed and dim as `f` goes to -1 (dropped) and bold as it goes to 1 (kept). */
function det(s: Scene, P: Plane, d: Det, f: number, sc: number) {
  s.alpha(f < 0 ? 1 - 0.7 * -f : 1, () => {
    rect(s, P, d.box, d.k, { fill: 0.06 + 0.12 * Math.max(0, f), lw: 0.45 + 0.35 * Math.max(0, f), dash: f < -0.5 });
    const [x1, y1, x2, y2] = d.box;
    const label = sc > 0.5 ? `${d.name} ${d.score.toFixed(1)}` : d.name;
    const top = d.at !== 'br';
    s.text(label, d.at === 'tl' ? P.X(x1) : P.X(x2), top ? P.Y(y1) - 2.4 * s.u : P.Y(y2) + 2.6 * s.u, { size: 3, font: 'mono', weight: 650, align: d.at === 'tl' ? 'left' : 'right', color: s.c(d.k), halo: true });
  });
}

// Two objects, two boxes each: A and B on the left one, C and D on the right one.
const NB: Det[] = [
  { name: 'A', box: [1, 2, 8, 9], score: 0.9, k: 'blue', at: 'tl' },
  { name: 'B', box: [2, 3, 9, 10], score: 0.7, k: 'teal', at: 'br' },
  { name: 'C', box: [11, 1, 18, 7], score: 0.8, k: 'purple', at: 'tl' },
  { name: 'D', box: [12, 2, 18, 8], score: 0.6, k: 'orange', at: 'br' },
];
const ORDER = [0, 2, 1, 3];

function objects(s: Scene, P: Plane) {
  s.circle(P.X(5), P.Y(6.5), 2.9 * P.c, { fill: s.tint('--ink-3', 0.14) });
  s.circle(P.X(14.8), P.Y(4.8), 2.6 * P.c, { fill: s.tint('--ink-3', 0.14) });
  s.rrect(P.l, P.t, P.r - P.l, P.b - P.t, 1, { stroke: s.tint('--ink-3', 0.5), lw: 0.3 });
}

const line = (s: Scene, P: Plane, runs: [string, Ink][], a: number, row = 0) => s.alpha(a, () => rich(s, runs, P.tx, P.ty + row * P.gap, { size: 3.2, weight: 600 }));

// Edge strength across one edge: the filter answers on the edge and, less, beside it.
const EDGE = [0.4, 1.2, 2.6, 4.2, 2.8, 1.3, 0.5];

const many: SceneDef = {
  draw(s) {
    const P = plane(s, 20, 12, 4.4, 50);
    objects(s, P);
    const best = s.ease('want', 0.6, 1.2);
    const gone = s.ease('name', 0.6, 2.2) * (1 - s.ease('canny', 0.5));
    NB.forEach((d, i) => {
      const f = i === 0 ? best : i === 1 ? -gone : 0;
      s.alpha(s.ease('many', 0.6, 2.4 + 0.45 * ORDER.indexOf(i)), () => det(s, P, d, f, s.ease('conf', 0.4, 1.2 + 0.4 * ORDER.indexOf(i))));
    });
    s.alpha(s.win('iou', 'name'), () => rect(s, P, overlap(NB[0]!.box, NB[1]!.box), 'gold', { fill: 0.4, lw: 0.5 }));
    line(s, P, [['one object, many boxes', '--ink-2']], s.win('many', 'conf') * after(s, 'many', 0.5));
    line(s, P, [['confidence: ', '--ink-2'], ['0 to 1, higher = surer', 'purple']], s.win('conf', 'want') * after(s, 'conf', 0.3));
    line(s, P, [['keep the most confident: ', '--ink-2'], ['A', 'blue']], s.win('want', 'iou'));
    line(s, P, [['IoU(A, B) = 36 / 62 ≈ ', '--ink-2'], ['0.58', 'gold']], s.win('iou', 'name') * after(s, 'iou', 0.5));
    line(s, P, [['max: kept · ', 'green'], ['non-max: suppressed', 'red']], s.win('name', 'canny') * after(s, 'name', 0.35));

    // An edge's responses, side by side: only the peak is kept.
    const ea = s.ease('canny', 0.6, 0.4);
    s.alpha(ea, () => {
      const bw = 4.2 * s.u;
      const hmax = 2.6 * P.gap;
      const x0 = P.tx - (EDGE.length * bw) / 2;
      const base = P.ty + P.gap * 1.6;
      const peak = after(s, 'canny', 0.82);
      EDGE.forEach((v, i) => {
        const on = i === 3;
        s.alpha(on ? 1 : 1 - 0.75 * peak, () => s.rrect(x0 + i * bw + 0.5 * s.u, base - (v / 4.2) * hmax, bw - s.u, (v / 4.2) * hmax, 0.4, { fill: s.tint(on ? 'green' : '--ink-3', on ? 0.25 + 0.4 * peak : 0.35), stroke: s.c(on ? 'green' : '--ink-3'), lw: 0.3 }));
      });
      s.line(x0, base, x0 + EDGE.length * bw, base, s.c('--axis'), 0.3);
      s.text('edge strength', x0 - 2 * s.u, base - hmax / 2, { size: 3, font: 'mono', align: 'right', color: s.c('--ink-3') });
      s.alpha(peak, () => s.text('one response: the peak', P.tx, base + 4.5 * s.u, { size: 3.2, font: 'mono', weight: 600, color: s.c('green') }));
    });
    cite(s, 'John Canny, 1986', s.ease('canny', 0.5, 1.5));
  },
};

const nms: SceneDef = {
  draw(s) {
    const P = plane(s, 20, 12, 4.4, 50);
    // 1 kept, -1 dropped, eased in as the narration reaches each box; at the higher threshold B comes back.
    const back = after(s, 'thresh', 0.5);
    const fate = [after(s, 'keep', 0.1), lerp(-after(s, 'keep', 0.85), 1, back), after(s, 'repeat', 0.35), -after(s, 'repeat', 0.8)];
    objects(s, P);
    NB.forEach((d, i) => det(s, P, d, fate[i]!, 1));
    // The pair being compared: A with B, then C with D.
    s.alpha(s.ease('keep', 0.5, 2) * (1 - s.ease('stay', 0.5)) + after(s, 'thresh', 0.3) * (1 - after(s, 'thresh', 0.9)), () => rect(s, P, overlap(NB[0]!.box, NB[1]!.box), 'gold', { fill: 0.4, lw: 0.5 }));
    s.alpha(after(s, 'repeat', 0.55) * (1 - s.ease('done', 0.5)), () => rect(s, P, overlap(NB[2]!.box, NB[3]!.box), 'gold', { fill: 0.4, lw: 0.5 }));

    // The boxes sorted by confidence, each marked kept or dropped as the rounds reach it.
    const step = P.side ? 10 * s.u : 22 * s.u;
    ORDER.forEach((i, r) => {
      const n = NB[i]!;
      const x = P.side ? P.tx - 5 * s.u : s.w / 2 + (r - 1.5) * step;
      const y = P.side ? s.h * 0.22 + r * step : P.b + 8 * s.u;
      const f = fate[i]!;
      s.alpha(s.ease('sort', 0.4, 1.5 + 0.35 * r), () => {
        s.cell(x - 7 * s.u, y - 3.3 * s.u, 14 * s.u, 6.6 * s.u, `${n.name} ${n.score.toFixed(1)}`, n.k, { on: Math.max(0, f), size: 3 });
        mark(s, P.side ? x + 12 * s.u : x, P.side ? y : y + 6.4 * s.u, f);
      });
    });
    const lx = P.side ? P.tx : s.w / 2;
    const ly = P.side ? s.h * 0.22 + 4.2 * step : P.b + 21 * s.u;
    const say = (runs: [string, Ink][], a: number, row = 0) => s.alpha(a, () => rich(s, runs, lx, ly + row * 7 * s.u, { size: 3.2, weight: 600 }));
    say([['sorted: A, C, B, D', '--ink-2']], after(s, 'sort', 0.6) * (1 - s.ease('keep', 0.4)));
    say([['IoU(A, B) = 0.58 > 0.5: ', '--ink-2'], ['drop B', 'red']], after(s, 'keep', 0.75) * (1 - s.ease('stay', 0.4)));
    say([['IoU(A, C) = 0: ', '--ink-2'], ['C stays', 'green']], s.win('stay', 'repeat'));
    say([['IoU(C, D) = 0.63 > 0.5: ', '--ink-2'], ['drop D', 'red']], after(s, 'repeat', 0.75) * (1 - s.ease('done', 0.4)));
    say([['kept: ', '--ink-2'], ['A', 'blue'], [' and ', '--ink-2'], ['C', 'purple']], s.win('done', 'thresh'));
    say([['threshold ', '--ink-2'], ['0.6', 'gold'], [': 0.58 is not above it', '--ink-2']], after(s, 'thresh', 0.3));
    say([['B', 'teal'], [' stays: fewer boxes dropped', 'green']], after(s, 'thresh', 0.6), 1);
  },
};

// ---- a chain: B overlaps both C and A, but B is dropped first, so A is judged only against C

const CH: Det[] = [
  { name: 'A', box: [5, 2, 12, 9], score: 0.7, k: 'blue', at: 'br' },
  { name: 'B', box: [2, 1, 11, 9], score: 0.8, k: 'teal', at: 'tr' },
  { name: 'C', box: [1, 1, 8, 9], score: 0.9, k: 'purple', at: 'tl' },
];
const CN = { x: 13, y: 10 };
const T3 = CH.map((p) => CH.map((q) => (p === q ? 0 : iou(p.box, q.box))));

/** The picture at the left, the IoU table at the right, the pair centered on the stage. */
function chainLayout(s: Scene) {
  const u = s.u;
  const cw = 9.5 * u;
  const ch = 7 * u;
  const gap = 5 * u;
  const c = Math.min(5.2 * u, (s.w - 4 * cw - gap - 12 * u) / CN.x, (s.h * 0.6) / CN.y);
  const l = (s.w - (CN.x * c + gap + 4 * cw)) / 2;
  const mid = s.h * 0.42;
  const t = mid - (CN.y * c) / 2;
  const P: Plane = { X: (x) => l + x * c, Y: (y) => t + y * c, c, l, t, r: l + CN.x * c, b: t + CN.y * c, side: false, tx: s.w / 2, ty: s.h * 0.82, gap: 7 * u };
  return { P, cw, ch, x0: P.r + gap, y0: mid - 2 * ch };
}

const chain: SceneDef = {
  draw(s) {
    const { P, cw, ch, x0, y0 } = chainLayout(s);
    const [A, B, C] = CH as [Det, Det, Det];
    const fate = [after(s, 'keepA', 0.4), -after(s, 'dropB', 0.7), after(s, 'dropB', 0.05)];
    s.circle(P.X(4), P.Y(5.4), 2.4 * P.c, { fill: s.tint('--ink-3', 0.14) });
    s.circle(P.X(9), P.Y(5.8), 2.4 * P.c, { fill: s.tint('--ink-3', 0.14) });
    s.rrect(P.l, P.t, P.r - P.l, P.b - P.t, 1, { stroke: s.tint('--ink-3', 0.5), lw: 0.3 });
    CH.forEach((d, i) => s.alpha(s.ease('row', 0.6, 1.2 + 0.5 * (2 - i)), () => det(s, P, d, fate[i]!, 1)));
    s.alpha(after(s, 'dropB', 0.3) * (1 - s.ease('ghost', 0.4)), () => rect(s, P, overlap(C.box, B.box), 'gold', { fill: 0.4, lw: 0.5 }));
    s.alpha(after(s, 'ghost', 0.15) * (1 - s.ease('keepA', 0.4)), () => rect(s, P, overlap(B.box, A.box), '--ink-3', { fill: 0.3, lw: 0.5, dash: true }));
    s.alpha(after(s, 'keepA', 0.2) * (1 - s.ease('why', 0.4)), () => rect(s, P, overlap(C.box, A.box), 'gold', { fill: 0.4, lw: 0.5 }));

    // The IoU table, rows and columns in letter order, the diagonal left blank.
    const cx = (j: number) => x0 + (j + 1) * cw;
    const cy = (i: number) => y0 + (i + 1) * ch;
    const rowC = s.ease('first', 0.6);
    /** Which cell each beat reads, and how: [on, color]. */
    const lit = (i: number, j: number): [number, Ink] | null => {
      if (i === 2 && j === 1) return [Math.max(s.win('dropB', 'ghost') * after(s, 'dropB', 0.3), rowC), 'red'];
      if (i === 1 && j === 0) return [s.win('ghost', 'keepA') * after(s, 'ghost', 0.15), '--ink-3'];
      if (i === 2 && j === 0) return [Math.max(s.win('keepA', 'why') * after(s, 'keepA', 0.2), rowC), 'green'];
      if (i === 1 && j === 2) return [s.win('table', 'first') * after(s, 'table', 0.5), 'gold'];
      return null;
    };
    s.alpha(s.ease('dropB', 0.6), () => {
      const head = { size: 3.4, font: 'mono', weight: 700 } as const;
      s.alpha(rowC, () => s.rrect(x0 + 0.3 * s.u, cy(2) + 0.3 * s.u, 4 * cw - 0.6 * s.u, ch - 0.6 * s.u, 1.2, { fill: s.tint('purple', 0.1), stroke: s.tint('purple', 0.6), lw: 0.3 }));
      CH.forEach((d, i) => {
        s.alpha(fate[i]! < 0 ? 1 - 0.55 * -fate[i]! : 1, () => {
          s.text(d.name, cx(i) + cw / 2, y0 + ch / 2, { ...head, color: s.c(d.k) });
          s.text(d.name, x0 + cw / 2, cy(i) + ch / 2, { ...head, color: s.c(d.k) });
        });
      });
      s.line(x0 + cw, y0 + 0.6 * s.u, x0 + cw, cy(3) - 0.4 * s.u, s.c('--ink-3'), 0.3);
      s.line(x0 + 0.6 * s.u, y0 + ch, cx(3) - 0.4 * s.u, y0 + ch, s.c('--ink-3'), 0.3);
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++) {
          if (i === j) continue;
          const l = lit(i, j);
          const k: Ink = l && l[0] > 0.01 ? l[1] : '--ink-3';
          s.cell(cx(j) + 0.5 * s.u, cy(i) + 0.5 * s.u, cw - s.u, ch - s.u, T3[i]![j]!.toFixed(2).replace(/0$/, ''), k, { on: l ? l[0] : 0, size: 3 });
        }
      s.text('IoU table', x0 + 2.5 * cw, y0 - 3 * s.u, { size: 3, font: 'mono', color: s.c('--ink-3') });
    });

    const say = (runs: [string, Ink][], a: number, row = 0) => line(s, P, runs, a, row);
    say([['by score: ', '--ink-2'], ['C 0.9', 'purple'], [', ', '--ink-2'], ['B 0.8', 'teal'], [', ', '--ink-2'], ['A 0.7', 'blue']], s.win('row', 'dropB') * after(s, 'row', 0.4));
    say([['IoU(C, B) = 0.6 > 0.5: ', '--ink-2'], ['drop B', 'red']], s.win('dropB', 'ghost') * after(s, 'dropB', 0.4));
    say([['IoU(B, A) = 0.53, but B is ', '--ink-2'], ['dropped', '--ink-3']], s.win('ghost', 'keepA') * after(s, 'ghost', 0.3));
    say([['IoU(C, A) = 0.25 < 0.5: ', '--ink-2'], ['keep A', 'green']], s.win('keepA', 'why') * after(s, 'keepA', 0.3));
    say([['kept: ', '--ink-2'], ['C', 'purple'], [' and ', '--ink-2'], ['A', 'blue']], s.win('keepA', 'why') * after(s, 'keepA', 0.7), 1);
    say([['only kept boxes drop others', 'green']], s.win('why', 'table'));
    say([['selected = kept', '--ink-2']], s.win('rcnn', 'table') * after(s, 'rcnn', 0.75), 1);
    say([['row B, column C: IoU(B, C) = ', '--ink-2'], ['0.6', 'gold']], s.win('table', 'first') * after(s, 'table', 0.5));
    say([['first kept: C, so read ', '--ink-2'], ['row C', 'purple']], s.ease('first', 0.5));
    cite(s, 'R-CNN · Girshick et al., 2014', s.win('rcnn', 'table'));
  },
};

export const scenes: Record<string, SceneDef> = { many, nms, chain };

