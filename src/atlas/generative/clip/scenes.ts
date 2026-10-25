import type { Scene, SceneDef } from '../../../lecture/scene';
import { block, caption, fmt, PICS, picture, rich } from '../draw';

const KINDS = ['tree', 'boat', 'sun'] as const;
const CAPS = ['a tree on a hill', 'a boat at sea', 'sunset over the sea'];
const SHORT = ['tree', 'boat', 'sunset'];
const SIM = [
  [0.8, 0.1, 0.3],
  [0.2, 0.7, 0.1],
  [0.3, 0.2, 0.9],
];

/** The 3 by 3 similarity grid centered on (gx, gy), `cell` stage units per cell, images down the left and captions across the top. */
function grid(s: Scene, gx: number, gy: number, cell: number, on: (i: number, j: number) => number, ink: (i: number, j: number) => 'green' | 'red' | 'slate', o: { thumb?: number; label?: number } = {}): void {
  const u = s.u;
  const p = cell * u;
  for (let i = 0; i < 3; i++) {
    picture(s, gx - 1.5 * p - (o.thumb ?? 0.55) * 8 * u - 2 * u, gy + (i - 1) * p, o.thumb ?? 0.55, PICS[KINDS[i]!]);
    s.text(SHORT[i]!, gx + (i - 1) * p, gy - 1.5 * p - 3 * u, { size: o.label ?? 2.8, font: 'mono', color: s.c('--ink-2') });
    for (let j = 0; j < 3; j++) s.cell(gx + (j - 1.5) * p + 0.4 * u, gy + (i - 1.5) * p + 0.4 * u, p - 0.8 * u, p - 0.8 * u, fmt(SIM[i]![j]!), ink(i, j), { on: on(i, j), size: Math.min(3.4, cell * 0.32) });
  }
}

const space: SceneDef = {
  draw(s) {
    const u = s.u;
    const X = (f: number) => s.w * f;
    const ys = [0.12, 0.27, 0.42].map((f) => s.h * f);
    KINDS.forEach((k, i) => {
      picture(s, X(0.12), ys[i]!, 0.7, PICS[k]);
      s.text(`“${CAPS[i]}”`, X(0.12) + 8 * u, ys[i]!, { size: 3, font: 'serif', italic: true, align: 'left', color: s.c('--ink-2') });
    });
    const enc = s.ease('encoders', 0.6);
    s.alpha(enc, () => {
      const bx = X(0.78);
      block(s, bx, s.h * 0.16, 22, 8, 'image enc', 'orange', { size: 3.2 });
      block(s, bx, s.h * 0.36, 22, 8, 'text enc', 'teal', { size: 3.2 });
      s.text('→ d numbers, length 1', bx, s.h * 0.46, { size: 2.9, font: 'mono', color: s.c('--ink-3') });
    });
    const sm = s.ease('sim', 0.6);
    s.alpha(sm, () => {
      const gx = s.w / 2 - 4 * u;
      grid(s, gx, s.h * 0.76, 10, (i, j) => (i === j ? 0.4 : 0), () => 'slate', { label: 2.6 });
      rich(s, [['images', 'orange'], [' × ', '--ink-3'], ['captions', 'teal']], gx + 18 * u, s.h * 0.76, { size: 3, weight: 650, align: 'left' });
    });
  },
};

const diagonal: SceneDef = {
  draw(s) {
    const u = s.u;
    const gx = s.w / 2 + 4 * u;
    const gy = s.h * 0.44;
    const cell = 13;
    const p = cell * u;
    const d = s.ease('diag', 0.6, 0.5);
    const r = s.win('rows', 'cols');
    const c = s.win('cols', 'count');
    const k = s.ease('count', 0.6);
    grid(
      s,
      gx,
      gy,
      cell,
      (i, j) => (i === j ? d : 0) + (i === 0 ? 0.6 * r : 0) + (j === 0 ? 0.6 * c : 0) + 0.3 * k,
      (i, j) => (i === j ? 'green' : r * (i === 0 ? 1 : 0) + c * (j === 0 ? 1 : 0) + k > 0.3 ? 'red' : 'slate'),
      { thumb: 0.75, label: 3.2 },
    );
    const o = { size: 3.2, font: 'mono', weight: 650, halo: true } as const;
    s.alpha(r, () => {
      s.rrect(gx - 1.5 * p - 0.2 * u, gy - 1.5 * p - 0.2 * u, 3 * p + 0.4 * u, p + 0.4 * u, 1, { stroke: s.c('purple'), lw: 0.5 });
      caption(s, 'row 0: softmax over captions, pick caption 0', s.h * 0.78, 'purple', 3.2);
      caption(s, '2 negatives: N − 1', s.h * 0.86, 'red', 3.4);
    });
    s.alpha(c, () => {
      s.rrect(gx - 1.5 * p - 0.2 * u, gy - 1.5 * p - 0.2 * u, p + 0.4 * u, 3 * p + 0.4 * u, 1, { stroke: s.c('purple'), lw: 0.5 });
      caption(s, 'column 0: softmax over images, pick image 0', s.h * 0.78, 'purple', 3.2);
    });
    s.alpha(k, () => {
      rich(s, [['3', 'green'], [' right pairs up, ', '--ink-2'], ['6', 'red'], [' negatives down', '--ink-2']], s.w / 2, s.h * 0.8, o);
      caption(s, '3 × 3 = 9 similarities', s.h * 0.88, '--ink-3', 3.2);
    });
    s.alpha(d * (1 - Math.max(r, c, k)), () => caption(s, 'right pairs on the diagonal', s.h * 0.8, 'green', 3.4));
  },
};

const SCORES = [0.31, 0.12, 0.05];

const zeroshot: SceneDef = {
  draw(s) {
    const u = s.u;
    const X = (f: number) => s.w * f;
    const ys = [0.22, 0.42, 0.62].map((f) => s.h * f);
    const capA = s.ease('names', 0.6);
    const em = s.ease('embed', 0.6);
    const pk = s.ease('pick', 0.6);
    s.alpha(em, () => {
      picture(s, X(0.16), s.h * 0.42, 1.3, PICS.tree);
      s.text('the image', X(0.16), s.h * 0.42 + 13.5 * u, { size: 3, font: 'mono', color: s.c('orange') });
    });
    const cx = X(0.36);
    SHORT.forEach((nm, i) => {
      s.alpha(s.ease('names', 0.5, 0.6 + i * 0.8) * capA, () => {
        const best = i === 0 ? pk : 0;
        s.rrect(cx - 1 * u, ys[i]! - 4.5 * u, 40 * u, 9 * u, 1.2, { fill: s.tint(best ? 'green' : 'teal', 0.08 + 0.2 * best), stroke: s.tint(best ? 'green' : 'teal', 0.4 + 0.6 * best), lw: 0.3 });
        s.text(`a photo of a ${nm}`, cx + 1.5 * u, ys[i]!, { size: 3.2, font: 'serif', italic: true, align: 'left', color: s.c('--ink') });
      });
    });
    s.alpha(em, () => {
      for (const y of ys) s.arrow(X(0.16) + 12 * u, s.h * 0.42 + (y - s.h * 0.42) * 0.3, cx - 2 * u, y, s.c('--ink-3'), 0.25, 1.6);
    });
    s.alpha(pk, () => {
      const bx = cx + 42 * u;
      SCORES.forEach((v, i) => {
        const w = v * 40 * u * pk;
        s.rrect(bx, ys[i]! - 2 * u, Math.max(w, 0.5 * u), 4 * u, 0.6, { fill: s.tint(i ? 'slate' : 'green', 0.45), stroke: s.c(i ? 'slate' : 'green'), lw: 0.25 });
        s.text(v.toFixed(2), bx + w + 1.5 * u, ys[i]!, { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c(i ? '--ink-2' : 'green') });
      });
      caption(s, 'highest dot product wins: tree', s.h * 0.82, 'green', 3.6);
      caption(s, 'no labeled tree images needed', s.h * 0.9, '--ink-3', 3.2);
    });
  },
};

export const scenes: Record<string, SceneDef> = { space, diagonal, zeroshot };
