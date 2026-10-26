import type { SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { after } from '../../networks/draw';
import { type Ink, rich } from '../draw';
import type { Box } from '../box-iou/box';
import { plane, rect } from '../box-iou/plane';

// Two objects, two boxes each: A and B on the left one, C and D on the right one.
const NB: { name: string; box: Box; score: number; k: Ink }[] = [
  { name: 'A', box: [1, 2, 8, 9], score: 0.9, k: 'blue' },
  { name: 'B', box: [2, 3, 9, 10], score: 0.7, k: 'teal' },
  { name: 'C', box: [11, 1, 18, 7], score: 0.8, k: 'purple' },
  { name: 'D', box: [12, 2, 18, 8], score: 0.6, k: 'orange' },
];
const ORDER = [0, 2, 1, 3];

const nms: SceneDef = {
  draw(s) {
    const P = plane(s, 20, 12, 4.4, 50);
    // 1 kept, -1 dropped, eased in as the narration reaches each box; at the higher threshold B comes back.
    const back = after(s, 'thresh', 0.55);
    const fate = [after(s, 'keep', 0.12), lerp(-after(s, 'keep', 0.8), 1, back), after(s, 'stay', 0.55), -after(s, 'stay', 0.85)];
    s.circle(P.X(5), P.Y(6.5), 2.9 * P.c, { fill: s.tint('--ink-3', 0.14) });
    s.circle(P.X(14.8), P.Y(4.8), 2.6 * P.c, { fill: s.tint('--ink-3', 0.14) });
    s.rrect(P.l, P.t, P.r - P.l, P.b - P.t, 1, { stroke: s.tint('--ink-3', 0.5), lw: 0.3 });
    NB.forEach((n, i) => {
      const f = fate[i]!;
      const a = s.ease('many', 0.6, 0.6 + 0.5 * ORDER.indexOf(i)) * (f < 0 ? 1 - 0.75 * -f : 1);
      s.alpha(a, () => {
        rect(s, P, n.box, n.k, { fill: 0.06 + 0.12 * Math.max(0, f), lw: 0.45 + 0.35 * Math.max(0, f), dash: f < -0.5 });
        const [x1, y1, x2, y2] = n.box;
        const top = i % 2 === 0;
        s.text(`${n.name} ${n.score.toFixed(1)}`, top ? P.X(x1) : P.X(x2), top ? P.Y(y1) - 2.4 * s.u : P.Y(y2) + 2.6 * s.u, { size: 3, font: 'mono', weight: 650, align: top ? 'left' : 'right', color: s.c(n.k), halo: true });
      });
    });
    // A and B's shared area, for the IoU the passes compare.
    s.alpha(s.win('recall', 'sort'), () => rect(s, P, [2, 3, 8, 9], 'gold', { fill: 0.4, lw: 0.5 }));
    // The boxes sorted by confidence, each marked kept or dropped as the passes reach it.
    const step = P.side ? 10 * s.u : 22 * s.u;
    ORDER.forEach((i, r) => {
      const n = NB[i]!;
      const x = P.side ? P.tx - 5 * s.u : s.w / 2 + (r - 1.5) * step;
      const y = P.side ? s.h * 0.22 + r * step : P.b + 8 * s.u;
      const f = fate[i]!;
      const mx = P.side ? x + 12 * s.u : x;
      const my = P.side ? y : y + 6.4 * s.u;
      s.alpha(s.ease('sort', 0.4, 0.3 + 0.35 * r), () => {
        s.cell(x - 7 * s.u, y - 3.3 * s.u, 14 * s.u, 6.6 * s.u, `${n.name} ${n.score.toFixed(1)}`, n.k, { on: Math.max(0, f), size: 3 });
        s.alpha(Math.abs(f), () => s.text(f > 0 ? '✓' : '✗', mx, my, { size: 4, font: 'ui', weight: 700, color: s.c(f > 0 ? 'green' : 'red') }));
      });
    });
    const lx = P.side ? P.tx : s.w / 2;
    const ly = P.side ? s.h * 0.22 + 4.2 * step : P.b + 21 * s.u;
    const line = (runs: [string, Ink][], a: number, row = 0) => s.alpha(a, () => rich(s, runs, lx, ly + row * 7 * s.u, { size: 3.2, weight: 600 }));
    line([['IoU(A, B) = 36 / 62 ≈ ', '--ink-2'], ['0.58', 'gold']], after(s, 'recall', 0.6) * (1 - s.ease('sort', 0.4)));
    line([['IoU(A, B) = 0.58 > 0.5: ', '--ink-2'], ['drop B', 'red']], after(s, 'keep', 0.75) * (1 - s.ease('stay', 0.4)));
    line([['IoU(A, C) = 0: ', '--ink-2'], ['C stays', 'green']], after(s, 'stay', 0.05) * (1 - after(s, 'stay', 0.75, 0.4)));
    line([['IoU(C, D) = 0.63 > 0.5: ', '--ink-2'], ['drop D', 'red']], after(s, 'stay', 0.8) * (1 - s.ease('done', 0.4)));
    line([['kept: ', '--ink-2'], ['A', 'blue'], [' and ', '--ink-2'], ['C', 'purple']], s.ease('done', 0.6, 0.3) * (1 - s.ease('thresh', 0.4)));
    line([['threshold ', '--ink-2'], ['0.6', 'gold'], [': 0.58 is not above it', '--ink-2']], after(s, 'thresh', 0.2));
    line([['B', 'teal'], [' stays: fewer boxes dropped', 'green']], after(s, 'thresh', 0.6), 1);
  },
};

// Worked from a table, as the practice gives it. D overlaps C above the threshold, but D is
// dropped first, so C is judged only against the kept B.
const TB = [
  { name: 'A', conf: 0.6, k: 'blue' },
  { name: 'B', conf: 0.9, k: 'teal' },
  { name: 'C', conf: 0.7, k: 'purple' },
  { name: 'D', conf: 0.8, k: 'orange' },
] as const;
const TIOU = [
  [0, 0.18, 0.69, 0.37],
  [0.18, 0, 0.32, 0.61],
  [0.69, 0.32, 0, 0.56],
  [0.37, 0.61, 0.56, 0],
];
const SORTED = [1, 3, 2, 0];

const table: SceneDef = {
  draw(s) {
    // 1 kept, -1 dropped, as the walk reaches each box.
    const fate = [-after(s, 'last', 0.5), after(s, 'first', 0.1), after(s, 'chain', 0.8), -after(s, 'first', 0.6)];
    const sorted = after(s, 'order', 0.1, 0.9);
    const step = 17 * s.u;
    const yC = s.h * 0.11;
    TB.forEach((b, i) => {
      const x = s.w / 2 + (lerp(i, SORTED.indexOf(i), sorted) - 1.5) * step;
      const f = fate[i]!;
      s.alpha(s.ease('grid', 0.5, 0.3 + 0.3 * i), () => {
        s.cell(x - 7 * s.u, yC - 3.3 * s.u, 14 * s.u, 6.6 * s.u, `${b.name} ${b.conf}`, b.k, { on: Math.max(0, f), size: 3 });
        s.alpha(Math.abs(f), () => s.text(f > 0 ? '✓' : '✗', x, yC + 6.8 * s.u, { size: 4, font: 'ui', weight: 700, color: s.c(f > 0 ? 'green' : 'red') }));
      });
    });

    // The IoU table: rows and columns in letter order, the diagonal left blank.
    const cw = 13 * s.u;
    const ch = 7.6 * s.u;
    const x0 = s.w / 2 - 2.5 * cw;
    const y0 = s.h * 0.25;
    const cx = (j: number) => x0 + (j + 1) * cw;
    const cy = (i: number) => y0 + (i + 1) * ch;
    // Which cells each beat reads, and how: 1 above the threshold, 0 at or below it, -1 ignored.
    const lit = (i: number, j: number): [number, Ink] | null => {
      const first = s.win('first', 'chain');
      const chain = s.win('chain', 'last');
      const last = s.ease('last', 0.6);
      if (i === 0 && j === 2 && s.since('order') < 0) return [after(s, 'grid', 0.7), 'gold'];
      if (i === 1 && j !== 1 && s.since('chain') < 0) return [first * after(s, 'first', j === 3 ? 0.35 : 0.65), j === 3 ? 'red' : 'green'];
      if (i === 2 && j === 3 && s.since('last') < 0) return [chain * after(s, 'chain', 0.1), '--ink-3'];
      if (i === 2 && j === 1 && s.since('last') < 0) return [chain * after(s, 'chain', 0.6), 'green'];
      if (i === 0 && j === 2) return [last * after(s, 'last', 0.3), 'red'];
      return null;
    };
    s.alpha(s.ease('grid', 0.6, 0.8), () => {
      const head = { size: 3.4, font: 'mono', weight: 700 } as const;
      TB.forEach((b, i) => {
        const gone = fate[i]! < 0 ? 0.45 * -fate[i]! : 0;
        s.alpha(1 - gone, () => {
          s.text(b.name, cx(i) + cw / 2, y0 + ch / 2, { ...head, color: s.c(b.k) });
          s.text(b.name, x0 + cw / 2, cy(i) + ch / 2, { ...head, color: s.c(b.k) });
        });
      });
      s.line(x0 + cw, y0 + 0.6 * s.u, x0 + cw, cy(4) - 0.4 * s.u, s.c('--ink-3'), 0.3);
      s.line(x0 + 0.6 * s.u, y0 + ch, cx(4) - 0.4 * s.u, y0 + ch, s.c('--ink-3'), 0.3);
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 4; j++) {
          if (i === j) continue;
          const l = lit(i, j);
          const k: Ink = l && l[0] > 0.01 ? l[1] : '--ink-3';
          s.cell(cx(j) + 0.6 * s.u, cy(i) + 0.6 * s.u, cw - 1.2 * s.u, ch - 1.2 * s.u, TIOU[i]![j]!.toFixed(2), k, { on: l ? l[0] : 0, size: 3.1 });
        }
    });

    const line = (row: number, runs: [string, Ink][], a: number) => s.alpha(a, () => rich(s, runs, s.w / 2, s.h * 0.78 + row * 7 * s.u, { size: 3.3, weight: 600 }));
    line(0, [['row A, column C: IoU(A, C) = ', '--ink-2'], ['0.69', 'gold']], after(s, 'grid', 0.7) * (1 - s.ease('order', 0.4)));
    line(0, [['IoU(B, D) = 0.61 > 0.5: ', '--ink-2'], ['drop D', 'red']], after(s, 'first', 0.45) * (1 - s.ease('chain', 0.4)));
    line(0, [['IoU(C, D) = 0.56, but D is ', '--ink-2'], ['dropped', '--ink-3']], after(s, 'chain', 0.15) * (1 - s.ease('last', 0.4)));
    line(1, [['IoU(C, B) = 0.32 < 0.5: ', '--ink-2'], ['keep C', 'green']], after(s, 'chain', 0.7) * (1 - s.ease('last', 0.4)));
    line(0, [['IoU(A, C) = 0.69 > 0.5: ', '--ink-2'], ['drop A', 'red']], after(s, 'last', 0.35));
    line(1, [['kept: ', '--ink-2'], ['B', 'teal'], [' and ', '--ink-2'], ['C', 'purple']], after(s, 'last', 0.8));
  },
};

export const scenes: Record<string, SceneDef> = { nms, table };
