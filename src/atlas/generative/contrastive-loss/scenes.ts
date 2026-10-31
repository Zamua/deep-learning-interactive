import type { Ink, Scene, SceneDef } from '../../../lecture/scene';
import { lerp, smooth } from '../../../lecture/scene';
import { after, cells, cite, columns, rowLabel } from '../../draw';
import { block, caption, crop, fmt, PICS, picture, rich } from '../draw';

const KINDS = ['sun', 'tree', 'boat'] as const;
/** Two crops of each picture: [row, column] of a 10 by 10 window. */
const CROPS: [number, number][][] = [
  [[0, 0], [5, 6]],
  [[2, 4], [6, 1]],
  [[1, 5], [4, 0]],
];
const view = (k: number, v: number) => crop(PICS[KINDS[k]!], CROPS[k]![v]![0], CROPS[k]![v]![1], 10);
/** Similarities of view 1 of photo i (rows) with view 2 of photo j (columns). */
const SIM = [
  [0.8, 0, 0.4],
  [0.2, 0.8, 0.3],
  [0.4, 0.1, 0.85],
];
const ROLE: Ink[] = ['green', 'red', 'red'];
const ROLES = ['positive', 'negative', 'negative'];
const rad = (a: number) => (a * Math.PI) / 180;

// ---- two views of one photo, and what the encoder should do with them

const views: SceneDef = {
  draw(s) {
    const u = s.u;
    const X = (f: number) => s.w * f;
    const yTop = s.h * 0.27;
    const slots = columns(s, 3, 28);
    const mv = s.ease('views', 1);
    // Three photos, none of them labelled; then the sun moves left to be cropped.
    KINDS.forEach((k, i) => {
      const a = i === 0 ? 1 : 1 - mv;
      s.alpha(a, () => {
        const cx = i === 0 ? lerp(slots[0]!, X(0.17), mv) : slots[i]!;
        const px = i === 0 ? lerp(1.15, 1.35, mv) : 1.15;
        picture(s, cx, yTop, px, PICS[k]);
        s.alpha(1 - mv, () => {
          const ty = yTop + 13 * u;
          s.text(k, cx, ty, { size: 3.1, font: 'mono', color: s.c('--ink-3') });
          const w = s.measure(k, { size: 3.1, font: 'mono' });
          s.alpha(after(s, 'problem', 0.35), () => s.line(cx - w / 2 - 1 * u, ty, cx + w / 2 + 1 * u, ty, s.c('red'), 0.4));
        });
      });
    });
    s.alpha(s.win('problem', 'views'), () => caption(s, 'no labels: nobody writes down what each shows', s.h * 0.6, '--ink-2', 3.2));

    const g = { l: X(0.17) - 8 * 1.35 * u, t: yTop - 8 * 1.35 * u, p: 1.35 * u };
    const inks = ['orange', 'teal'] as const;
    s.alpha(s.ease('views', 0.6, 1), () => {
      CROPS[0]!.forEach(([r, c], v) => {
        s.rrect(g.l + c * g.p, g.t + r * g.p, 10 * g.p, 10 * g.p, 0.4, { stroke: s.c(inks[v]!), lw: 0.5 });
        const y = yTop + (v ? 9.5 : -9.5) * u;
        picture(s, X(0.4), y, 0.85, view(0, v));
        s.rrect(X(0.4) - 4.25 * u, y - 4.25 * u, 8.5 * u, 8.5 * u, 0.4, { stroke: s.c(inks[v]!), lw: 0.4 });
      });
      s.text('two views', X(0.4), yTop + 18 * u, { size: 3, font: 'mono', color: s.c('--ink-3') });
    });
    // The encoder, and a vector out for each view.
    s.alpha(s.ease('embed', 0.6), () => {
      for (const v of [0, 1]) s.arrow(X(0.4) + 5 * u, yTop + (v ? 9.5 : -9.5) * u, X(0.62) - 8 * u, yTop + (v ? 2 : -2) * u, s.c('--ink-3'), 0.3, 1.8);
      block(s, X(0.62), yTop, 12, 10, 'enc', 'blue', { size: 3.4, on: s.win('embed', 'goal') });
      s.arrow(X(0.62) + 7 * u, yTop, X(0.77) - 1 * u, yTop, s.c('--ink-3'), 0.3, 1.8);
    });
    s.alpha(s.ease('embed', 0.6, 1.5), () => {
      const ox = X(0.79);
      const oy = yTop + 6 * u;
      s.circle(ox, oy, 0.7 * u, { fill: s.c('--ink-3') });
      [[58, 'orange', 'z₁'], [44, 'teal', 'z₂']].forEach(([a, k, name]) => {
        const t = rad(a as number);
        const len = 14 * u;
        s.arrow(ox, oy, ox + len * Math.cos(t), oy - len * Math.sin(t), s.c(k as Ink), 0.45, 1.8);
        s.text(name as string, ox + (len + 3 * u) * Math.cos(t), oy - (len + 3 * u) * Math.sin(t), { size: 3.2, font: 'mono', weight: 650, color: s.c(k as Ink), halo: true });
      });
    });

    // The goal, as two small pictures: together for one photo, apart for different ones.
    s.alpha(s.ease('goal', 0.6), () => {
      const y = s.h * 0.72;
      const xs = [s.w / 2 - 22 * u, s.w / 2 + 22 * u];
      const pair = (cx: number, a: number[], ks: Ink[]) => {
        s.circle(cx, y, 0.7 * u, { fill: s.c('--ink-3') });
        a.forEach((deg, i) => s.arrow(cx, y, cx + 11 * u * Math.cos(rad(deg)), y - 11 * u * Math.sin(rad(deg)), s.c(ks[i]!), 0.45, 1.8));
      };
      pair(xs[0]!, [62, 48], ['orange', 'teal']);
      s.alpha(after(s, 'goal', 0.3), () => pair(xs[1]!, [62, 168], ['orange', 'red']));
      s.text('one photo: together', xs[0]!, y + 6 * u, { size: 3.1, font: 'mono', color: s.c('green') });
      s.alpha(after(s, 'goal', 0.3), () => s.text('other photos: apart', xs[1]!, y + 6 * u, { size: 3.1, font: 'mono', color: s.c('red') }));
    });
    s.alpha(after(s, 'goal', 0.7) * (1 - s.ease('simclr', 0.5)), () => caption(s, 'each view, contrasted with the others', s.h * 0.92, '--ink-2', 3.2));
    s.alpha(s.ease('simclr', 0.6), () => {
      caption(s, 'SimCLR: two random, recolored crops', s.h * 0.92, '--ink-2', 3.2);
      cite(s, 'Chen, Kornblith, Norouzi & Hinton, 2020', 1);
    });
  },
};

// ---- the vector as an arrow, scaled to length 1, and the dot product of two such arrows

const Z1 = [6, 8];
const A1 = (Math.atan2(Z1[1]!, Z1[0]!) * 180) / Math.PI;
const PAIR = (Math.acos(SIM[0]![0]!) * 180) / Math.PI;

/** How far z₂ has turned away from z₁, in degrees: 0, then a right angle, then opposite, then back to the pair. */
function apart(s: Scene): number {
  const p = s.prog('sim');
  const leg = (a: number, b: number) => smooth((p - a) / (b - a));
  const swept = 90 * leg(0.3, 0.5) + 90 * leg(0.62, 0.82);
  return lerp(swept, PAIR, s.ease('pair', 1.4, 0.2));
}

const circle: SceneDef = {
  draw(s) {
    const u = s.u;
    // Left: z₁ on axes, at its full size.
    const k = Math.min(4.2 * u, s.h * 0.042);
    const ox = s.w * 0.1;
    const oy = s.h * 0.86;
    const tx = ox + Z1[0]! * k;
    const ty = oy - Z1[1]! * k;
    s.line(ox - 2 * u, oy, tx + 5 * u, oy, s.c('--axis'), 0.3);
    s.line(ox, oy + 2 * u, ox, ty - 4 * u, s.c('--axis'), 0.3);
    s.alpha(s.ease('size', 0.6), () => {
      s.line(ox, oy, tx, oy, s.tint('--ink-3', 0.9), 0.3, [1, 0.8]);
      s.line(tx, oy, tx, ty, s.tint('--ink-3', 0.9), 0.3, [1, 0.8]);
      s.text('6', (ox + tx) / 2, oy + 3.2 * u, { size: 3.2, font: 'mono', color: s.c('--ink-2') });
      s.text('8', tx + 1.8 * u, (oy + ty) / 2, { size: 3.2, font: 'mono', align: 'left', color: s.c('--ink-2') });
    });
    s.arrow(ox, oy, tx, ty, s.c('orange'), 0.45, 2);
    s.text('z₁', tx + 2 * u, ty - 2 * u, { size: 3.4, font: 'mono', weight: 650, align: 'left', color: s.c('orange'), halo: true });
    s.alpha(after(s, 'size', 0.8), () => s.text('10', (ox + tx) / 2 - 2.8 * u, (oy + ty) / 2 - 2.2 * u, { size: 3.4, font: 'mono', weight: 650, color: s.c('gold'), halo: true }));

    // Right, below the circle: the arithmetic.
    const lx = s.w * 0.5;
    const line = (y: number, runs: [string, Ink][], a: number) => s.alpha(a, () => rich(s, runs, lx, s.h * y, { size: 3.4, weight: 600, align: 'left' }));
    line(0.66, [['z₁ = [6, 8]', 'orange']], 1);
    line(0.73, [['36 + 64 = 100', '--ink-2']], after(s, 'size', 0.55));
    line(0.8, [['size ', '--ink-2'], ['10', 'gold'], [', as 10² = 100', '--ink-2']], after(s, 'size', 0.8));
    line(0.87, [['z₁ / 10 = [0.6, 0.8]', 'orange']], after(s, 'unit', 0.15));

    // Right, above: the unit circle, where every view lands.
    const cx = s.w * 0.7;
    const cy = s.h * 0.32;
    const r = Math.min(19 * u, s.h * 0.2);
    s.alpha(s.ease('unit', 0.7, 0.8), () => {
      s.circle(cx, cy, r, { stroke: s.c('--axis'), lw: 0.3 });
      s.circle(cx, cy, 0.7 * u, { fill: s.c('--ink-3') });
      s.arrow(cx, cy, cx + r * Math.cos(rad(A1)), cy - r * Math.sin(rad(A1)), s.c('orange'), 0.5, 2);
      s.text('z₁', cx + (r + 3.5 * u) * Math.cos(rad(A1)), cy - (r + 3.5 * u) * Math.sin(rad(A1)), { size: 3.3, font: 'mono', weight: 650, color: s.c('orange'), halo: true });
      s.alpha(1 - s.ease('sim', 0.5), () => s.text('length 1', cx, cy + r + 4 * u, { size: 3, font: 'mono', color: s.c('--ink-3') }));
    });
    // z₂ turns away from z₁ and back; the dot product follows.
    s.alpha(s.ease('sim', 0.6), () => {
      const a = A1 - apart(s);
      s.arrow(cx, cy, cx + r * Math.cos(rad(a)), cy - r * Math.sin(rad(a)), s.c('teal'), 0.5, 2);
      s.text('z₂', cx + (r + 3.5 * u) * Math.cos(rad(a)), cy - (r + 3.5 * u) * Math.sin(rad(a)), { size: 3.3, font: 'mono', weight: 650, color: s.c('teal'), halo: true });
      const v = Math.cos(rad(apart(s)));
      const val = Math.abs(v) < 0.005 ? '0.00' : fmt(+v.toFixed(2), 2);
      rich(s, [['z₁ · z₂ = ', '--ink-2'], [val, 'green']], s.w * 0.25, cy, { size: 3.4, weight: 650, halo: true });
    });
  },
};

// ---- the batch: an anchor, its positive, the negatives; then one row on the circle

const ANCHOR = 90;
const SIDE = [-1, -1, 1];
/** Each candidate's angle in degrees: its similarity to the anchor is the cosine of the angle between them. */
const ANG = SIM[0]!.map((v, j) => ANCHOR + SIDE[j]! * (Math.acos(v) * 180) / Math.PI);

/** The unit circle with row 0's anchor straight up and its three candidates, each with its role and similarity. */
function ring(s: Scene, cx: number, cy: number, r: number, a: number) {
  const u = s.u;
  s.alpha(a, () => {
    s.circle(cx, cy, r, { stroke: s.c('--axis'), lw: 0.3 });
    s.circle(cx, cy, 0.8 * u, { fill: s.c('--ink-3') });
    s.arrow(cx, cy, cx, cy - r, s.c('orange'), 0.55, 2.2);
    s.text('anchor', cx - 2.5 * u, cy - r - 1.5 * u, { size: 3.2, font: 'mono', weight: 650, align: 'right', color: s.c('orange'), halo: true });
  });
  ANG.forEach((ang, j) => {
    s.alpha(a * after(s, 'row', 0.3 + 0.2 * j), () => {
      const x = cx + r * Math.cos(rad(ang));
      const y = cy - r * Math.sin(rad(ang));
      s.arrow(cx, cy, x, y, s.c(ROLE[j]!), 0.5, 2);
      const lx = cx + (r + 7.5 * u) * Math.cos(rad(ang));
      const ly = cy - (r + 7.5 * u) * Math.sin(rad(ang));
      const align = Math.cos(rad(ang)) > 0.3 ? 'left' : Math.cos(rad(ang)) < -0.3 ? 'right' : 'center';
      const lab = { size: 3.1, font: 'mono', weight: 650, align, halo: true } as const;
      s.text(ROLES[j]!, lx, ly - 2 * u, { ...lab, color: s.c(ROLE[j]!) });
      s.text(`sim ${fmt(SIM[0]![j]!)}`, lx, ly + 2.2 * u, { ...lab, weight: 500, color: s.c('--ink-2') });
    });
  });
}

const batch: SceneDef = {
  draw(s) {
    const u = s.u;
    const xs = columns(s, 3, 26);
    const rows = [s.h * 0.4, s.h * 0.62];
    const tiles = 1 - s.ease('grid', 0.6);
    // Three photos, two views each, with each view's role once the anchor is picked.
    s.alpha(tiles, () => {
      KINDS.forEach((k, i) => {
        picture(s, xs[i]!, s.h * 0.15, 0.8, PICS[k]);
        for (const v of [0, 1]) picture(s, xs[i]!, rows[v]!, 1.05, view(i, v));
      });
      s.text('view 1', xs[0]! - 9 * u, rows[0]!, { size: 2.9, font: 'mono', align: 'right', color: s.c('--ink-3') });
      s.text('view 2', xs[0]! - 9 * u, rows[1]!, { size: 2.9, font: 'mono', align: 'right', color: s.c('--ink-3') });
      const role = (i: number, v: number, text: string, k: Ink, a: number) =>
        s.alpha(a, () => {
          s.rrect(xs[i]! - 6.2 * u, rows[v]! - 6.2 * u, 12.4 * u, 12.4 * u, 0.6, { stroke: s.c(k), lw: 0.55 });
          s.text(text, xs[i]!, rows[v]! + 9.5 * u, { size: 2.9, font: 'mono', weight: 650, color: s.c(k), halo: true });
        });
      role(0, 0, 'anchor', 'orange', s.ease('anchor', 0.6));
      role(0, 1, 'positive', 'green', s.ease('pos', 0.6));
      for (let i = 1; i < 3; i++) for (const v of [0, 1]) role(i, v, 'negative', 'red', s.ease('neg', 0.6, 0.3 * (2 * (i - 1) + v)));
    });
    const cap = s.h * 0.9;
    s.alpha(s.win('batch', 'anchor') * tiles, () => caption(s, '3 photos × 2 views = 6 views', cap, '--ink-2', 3.3));
    s.alpha(s.win('pos', 'neg') * tiles, () => caption(s, 'the pair is fixed by the cropping', cap, 'green', 3.3));
    s.alpha(s.win('neg', 'grid') * tiles, () => caption(s, 'negatives: 2N − 2 = 4', cap, 'red', 3.3));

    // The grid: view 1 of photo i against view 2 of photo j.
    const gA = s.win('grid', 'row');
    s.alpha(gA, () => {
      const p = 10 * u;
      const gx = s.w / 2 + 6 * u;
      const gy = s.h * 0.56;
      for (let i = 0; i < 3; i++) {
        picture(s, gx - 1.5 * p - 6 * u, gy + (i - 1) * p, 0.7, view(i, 0));
        picture(s, gx + (i - 1) * p, gy - 1.5 * p - 6 * u, 0.7, view(i, 1));
        for (let j = 0; j < 3; j++) {
          const diag = i === j;
          s.cell(gx + (j - 1.5) * p + 0.4 * u, gy + (i - 1.5) * p + 0.4 * u, p - 0.8 * u, p - 0.8 * u, fmt(SIM[i]![j]!), diag ? 'green' : 'red', { on: diag ? s.ease('grid', 0.6, 2.5) : 0, size: 3 });
        }
      }
      s.text('view 1', gx - 1.5 * p - 6 * u, gy + 1.5 * p + 4 * u, { size: 3, font: 'mono', color: s.c('orange') });
      s.text('view 2', gx + 1.5 * p + 3 * u, gy - 1.5 * p - 6 * u, { size: 3, font: 'mono', align: 'left', color: s.c('teal') });
      s.alpha(s.ease('grid', 0.6, 2.5), () => s.text('positives', gx + 1.5 * p + 3 * u, gy, { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c('green') }));
    });
    // Row 0 on the circle: the picture the next explainers start from.
    const r = Math.min(24 * u, s.h * 0.27);
    ring(s, s.w / 2, s.h * 0.5, r, s.ease('row', 0.7));
  },
};

// ---- the loss: a softmax over the row, scored against the positive

const TAU = 0.4;
const S = SIM[0]!.map((v) => Math.round(v / TAU));
const E = S.map((v) => +Math.exp(v).toFixed(2));
const TOTAL = E.reduce((a, b) => a + b, 0);
const P = E.map((e) => e / TOTAL);
/** The softmax of the similarities themselves, before the temperature. */
const RAW = (() => {
  const e = SIM[0]!.map(Math.exp);
  const t = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / t);
})();

const loss: SceneDef = {
  marks: {
    f: { tex: String.raw`\text{score} = \frac{\text{similarity}}{\sym{tau}{\tau}}`, x: 0.5, y: 0.76, size: 5 },
  },
  draw(s) {
    const u = s.u;
    const xs = columns(s, 3, 19);
    const lx = xs[0]! - 13 * u;
    const ys = [0.15, 0.33, 0.47, 0.64].map((f) => s.h * f);
    s.alpha(1 - s.ease('oord', 0.5), () =>
      ROLES.forEach((t, j) => s.text(t, xs[j]!, s.h * 0.07, { size: 3, font: 'mono', weight: 650, color: s.c(ROLE[j]!) })),
    );
    rowLabel(s, 'sim', lx, ys[0]!, 'green', 3.6);
    cells(s, xs, ys[0]!, SIM[0]!.map((v) => fmt(v)), 'green', { w: 14, h: 8, on: [s.win('ask', 'range'), 0, 0] });
    const c1 = s.h * 0.24;
    s.alpha(s.win('ask', 'range'), () => caption(s, 'which candidate is the partner?', c1, '--ink-2', 3.2));
    // Without the temperature, the softmax barely prefers the positive.
    s.alpha(s.win('range', 's'), () => {
      rowLabel(s, 'p', lx, ys[1]!, 'teal', 3.8);
      cells(s, xs, ys[1]!, RAW.map((v) => v.toFixed(2)), 'teal', { w: 14, h: 8, on: [1, 0, 0] });
    });
    s.alpha(s.win('range', 'tau'), () => caption(s, 'from −1 to 1: positive gets under half', c1, '--ink-2', 3.1));
    s.alpha(s.ease('tau', 0.6, 0.6) * (1 - s.ease('soft', 0.5)), () => caption(s, `÷ τ = ${TAU}: the gaps stretch`, c1, 'slate', 3.2));
    s.show('f', s.win('tau', 'soft'));
    s.alpha(s.ease('s', 0.6, 2), () => {
      rowLabel(s, 's', lx, ys[1]!, 'purple', 3.8);
      cells(s, xs, ys[1]!, S.map(String), 'purple', { w: 14, h: 8, on: [s.win('loss', 'oord'), 0, 0] });
    });
    s.alpha(s.win('heat', 'soft'), () => {
      caption(s, 'large τ, hot: the odds even out', s.h * 0.86, '--ink-2', 3.1);
      caption(s, 'small τ, cold: one takes nearly all', s.h * 0.93, '--ink-2', 3.1);
    });
    s.alpha(s.ease('soft', 0.6, 2), () => {
      rowLabel(s, 'eˢ', lx, ys[2]!, 'gold', 3.8);
      cells(s, xs, ys[2]!, E.map((e) => e.toFixed(2)), 'gold', { w: 14, h: 8 });
      s.alpha(after(s, 'soft', 0.8), () => caption(s, `total ${TOTAL.toFixed(2)}`, ys[2]! + 7.5 * u, '--ink-2', 3.1));
    });
    s.alpha(s.ease('loss', 0.6), () => {
      rowLabel(s, 'p', lx, ys[3]!, 'teal', 3.8);
      cells(s, xs, ys[3]!, P.map((v) => v.toFixed(2)), 'teal', { w: 14, h: 8, on: [1, 0, 0] });
      rich(s, [[`loss = ln ${TOTAL.toFixed(2)} − ${S[0]} = `, '--ink-2'], [(Math.log(TOTAL) - S[0]!).toFixed(2), 'red']], s.w / 2, s.h * 0.74, { size: 3.8, weight: 650, halo: true });
      s.alpha(after(s, 'loss', 0.6), () => caption(s, `= −ln ${P[0]!.toFixed(2)}: cross-entropy on the positive`, s.h * 0.81, '--ink-3', 3.1));
    });
    s.alpha(s.ease('oord', 0.6), () => {
      caption(s, 'InfoNCE: pick the positive out', s.h * 0.9, 'green', 3.3);
      cite(s, 'van den Oord, Li & Vinyals, 2018', 1);
    });
  },
};

export const scenes: Record<string, SceneDef> = { views, circle, batch, loss };
