import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import type { Ink } from '../../../lecture/scene';
import { after, cells, cite, columns, rowLabel, stacked } from '../../draw';
import { caption, fmt, rich } from '../draw';

/** One anchor's row: similarities to its positive (0) and two negatives, over the temperature 0.4. */
const SIM = [0.8, 0, 0.4];
const TAU = 0.4;
const S = SIM.map((v) => Math.round(v / TAU));
const E = S.map((v) => +Math.exp(v).toFixed(2));
const TOTAL = E.reduce((a, b) => a + b, 0);
const P = E.map((e) => e / TOTAL);
const SLOPE = P.map((v, j) => (j ? v : v - 1));

const ROLE: Ink[] = ['green', 'red', 'red'];
const ROLES = ['positive', 'negative', 'negative'];

// ---- the circle: the anchor straight up, the positive and one negative on its right, the other on its left

const ANCHOR = 90;
const SIDE = [-1, -1, 1];
/** Each candidate's angle in degrees: its similarity is the cosine of its angle from the anchor. */
const ANG = SIM.map((v, j) => ANCHOR + SIDE[j]! * (Math.acos(v) * 180) / Math.PI);
/** Which way along the circle a candidate moves as its score rises: toward the anchor. */
const UP = SIDE.map((v) => -v);
const rad = (a: number) => (a * Math.PI) / 180;

interface Ring {
  cx: number;
  cy: number;
  r: number;
}
const at = (g: Ring, a: number, r = g.r): [number, number] => [g.cx + r * Math.cos(rad(a)), g.cy - r * Math.sin(rad(a))];

/** An arrow along the circle of radius `r`, from angle `a0` turning by `sweep` degrees. */
function arcArrow(s: Scene, g: Ring, r: number, a0: number, sweep: number, k: Ink, width = 0.6) {
  if (Math.abs(sweep) < 1.2) return;
  const sg = Math.sign(sweep);
  const head = Math.min(2.6 * s.u, Math.abs(rad(sweep)) * r * 0.6);
  const back = (head / r) * (180 / Math.PI) * sg;
  const a1 = a0 + sweep;
  const c = s.ctx;
  c.beginPath();
  c.arc(g.cx, g.cy, r, -rad(a0), -rad(a1 - 0.6 * back), sweep > 0);
  c.strokeStyle = s.c(k);
  c.lineWidth = width * s.u;
  c.lineCap = 'round';
  c.stroke();
  // The head: a triangle at the end, pointing along the circle.
  const [x, y] = at(g, a1, r);
  const dx = -Math.sin(rad(a1)) * sg;
  const dy = -Math.cos(rad(a1)) * sg;
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x - dx * head - dy * head * 0.55, y - dy * head + dx * head * 0.55);
  c.lineTo(x - dx * head + dy * head * 0.55, y - dy * head - dx * head * 0.55);
  c.closePath();
  c.fillStyle = s.c(k);
  c.fill();
}

/** The unit circle, the anchor and the three candidates, each labelled with its role and similarity. */
function ring(s: Scene, g: Ring, o: { anchor: number; cands: number; roles?: string[]; dim?: number[] }) {
  const u = s.u;
  s.circle(g.cx, g.cy, g.r, { stroke: s.c('--axis'), lw: 0.3 });
  s.circle(g.cx, g.cy, 0.8 * u, { fill: s.c('--ink-3') });
  s.alpha(o.anchor, () => {
    const [x, y] = at(g, ANCHOR);
    s.arrow(g.cx, g.cy, x, y, s.c('orange'), 0.55, 2.2);
    s.text('anchor', x - 2.5 * u, y - 1.5 * u, { size: 3.3, font: 'mono', weight: 650, align: 'right', color: s.c('orange'), halo: true });
  });
  const roles = o.roles ?? ROLES;
  ANG.forEach((a, j) => {
    s.alpha(o.cands * (1 - (o.dim?.[j] ?? 0)), () => {
      const [x, y] = at(g, a);
      s.arrow(g.cx, g.cy, x, y, s.c(ROLE[j]!), 0.5, 2);
      const [lx, ly] = at(g, a, g.r + 7.5 * u);
      const align = Math.cos(rad(a)) > 0.3 ? 'left' : Math.cos(rad(a)) < -0.3 ? 'right' : 'center';
      const lab = { size: 3.1, font: 'mono', weight: 650, align, halo: true } as const;
      s.text(roles[j]!, lx, ly - 2 * u, { ...lab, color: s.c(ROLE[j]!) });
      s.text(`sim ${fmt(SIM[j]!)}`, lx, ly + 2.2 * u, { ...lab, weight: 500, color: s.c('--ink-2') });
    });
  });
}

const pull: SceneDef = {
  draw(s) {
    const u = s.u;
    const g: Ring = { cx: s.w / 2, cy: s.h * 0.46, r: 26 * u };
    ring(s, g, { anchor: s.ease('anchor', 0.7), cands: s.ease('cands', 0.7) });
    // The pull and the pushes, each as long as its slope.
    const mv = s.ease('move', 1.2, 0.8);
    SLOPE.forEach((v, j) => {
      arcArrow(s, g, g.r + 2.8 * u, ANG[j]!, -v * 100 * UP[j]! * mv, ROLE[j]!, 0.8);
    });
    // Uniformity: views spread evenly around the circle.
    const uni = s.win('names', 'how') * after(s, 'names', 0.45);
    s.alpha(0.6 * uni, () => {
      for (let i = 0; i < 16; i++) {
        const [x, y] = at(g, 11.25 + i * 22.5);
        s.circle(x, y, 0.9 * u, { fill: s.c('slate') });
      }
    });
    cite(s, 'Wang & Isola, 2020', s.win('names', 'how'));
    const y1 = s.h * 0.86;
    const y2 = s.h * 0.93;
    s.alpha(s.win('ask', 'low'), () => caption(s, 'which way does each one move?', y1, '--ink-2', 3.5));
    s.alpha(s.win('low', 'move'), () => {
      rich(s, [['loss low: ', '--ink-2'], ['positive', 'green'], [' holds the probability', '--ink-2']], s.w / 2, y1, { size: 3.3, halo: true });
      s.alpha(after(s, 'low', 0.5), () => rich(s, [['positive\'s score ↑, ', 'green'], ['negatives\' ↓', 'red']], s.w / 2, y2, { size: 3.3, halo: true }));
    });
    s.alpha(s.win('move', 'names'), () => rich(s, [['pull ', '--ink-2'], ['positive', 'green'], [' in, push ', '--ink-2'], ['negatives', 'red'], [' out', '--ink-2']], s.w / 2, y1, { size: 3.4, halo: true }));
    s.alpha(s.win('names', 'how'), () => {
      rich(s, [['alignment: ', 'green'], ['positive pairs together', '--ink-2']], s.w / 2, y1, { size: 3.3, halo: true });
      s.alpha(after(s, 'names', 0.45), () => rich(s, [['uniformity: ', 'slate'], ['all spread out', '--ink-2']], s.w / 2, y2, { size: 3.3, halo: true }));
    });
    s.alpha(s.ease('how', 0.6), () => caption(s, 'how hard? the loss\'s slope on each score', y1, '--ink-2', 3.3));
  },
};

// ---- the slopes, worked on the row's numbers

const slopes: SceneDef = {
  draw(s) {
    const u = s.u;
    const xs = columns(s, 3, 19);
    const lx = xs[0]! - 13 * u;
    const ys = [0.17, 0.31, 0.45, 0.59].map((f) => s.h * f);
    ROLES.forEach((t, j) => s.text(t, xs[j]!, s.h * 0.08, { size: 3, font: 'mono', weight: 650, color: s.c(ROLE[j]!) }));
    rowLabel(s, 's', lx, ys[0]!, 'purple', 3.8);
    cells(s, xs, ys[0]!, S.map(String), 'purple', { w: 14, h: 8, on: [s.win('pos', 'step'), 0, s.win('nudge', 'share')] });
    s.alpha(s.ease('loss', 0.6, 0.5), () => {
      rowLabel(s, 'eˢ', lx, ys[1]!, 'gold', 3.8);
      cells(s, xs, ys[1]!, E.map((e) => e.toFixed(2)), 'gold', { w: 14, h: 8, on: [0, 0, s.win('nudge', 'is-p') * after(s, 'nudge', 0.5)] });
      s.text(`total ${TOTAL.toFixed(2)}`, xs[2]! + 9 * u, ys[1]!, { size: 3.2, font: 'mono', align: 'left', color: s.c('--ink-2') });
    });
    s.alpha(s.ease('is-p', 0.6), () => {
      rowLabel(s, 'p', lx, ys[2]!, 'teal', 3.8);
      cells(s, xs, ys[2]!, P.map((v) => v.toFixed(2)), 'teal', { w: 14, h: 8, on: [s.win('pos', 'step'), 0, s.win('is-p', 'pos')] });
    });
    // The loss's slope on each score: a negative's is its probability, the positive's is p - 1.
    const shown = [after(s, 'pos', 0.7), after(s, 'is-p', 0.75), after(s, 'share', 0.6)];
    s.alpha(shown[2]!, () => rowLabel(s, 'slope', lx, ys[3]!, 'red', 3.4));
    SLOPE.forEach((v, j) => s.alpha(shown[j]!, () => cells(s, [xs[j]!], ys[3]!, [fmt(v, 2)], 'red', { w: 14, h: 8, on: [s.ease('order', 0.6) * (j === 2 ? 1 : 0)] })));
    const y1 = s.h * 0.72;
    const o = { size: 3.4, weight: 600, halo: true } as const;
    s.alpha(s.win('row', 'loss'), () => caption(s, 'similarity ÷ τ, with τ = 0.4', y1, 'slate', 3.4));
    s.alpha(s.win('loss', 'nudge') * after(s, 'loss', 0.5), () => rich(s, [['loss = ln 11.11 − 2 = ', '--ink-2'], ['0.41', 'red']], s.w / 2, y1, o));
    s.alpha(s.win('nudge', 'share') * (1 - after(s, 'nudge', 0.5)), () => caption(s, 'candidate 2 enters only through e¹', y1, '--ink-2', 3.4));
    s.alpha(s.win('nudge', 'share') * after(s, 'nudge', 0.55), () => rich(s, [['total grows ', '--ink-2'], ['2.72', 'gold'], [' × as fast', '--ink-2']], s.w / 2, y1, o));
    s.alpha(s.win('share', 'is-p'), () => rich(s, [['slope = 2.72 / 11.11 = ', '--ink-2'], ['0.24', 'red']], s.w / 2, y1, o));
    s.alpha(s.win('is-p', 'pos'), () => rich(s, [['a negative\'s slope = its ', '--ink-2'], ['p', 'teal']], s.w / 2, y1, o));
    s.alpha(s.win('pos', 'step') * after(s, 'pos', 0.6), () => rich(s, [['positive: 0.67 − 1 = ', '--ink-2'], ['−0.33', 'red']], s.w / 2, y1, o));
    // Training steps against each slope: the positive's score up, the negatives' down.
    s.alpha(s.ease('step', 0.6), () => {
      const yA = s.h * 0.68;
      xs.forEach((x, j) => {
        const k = ROLE[j]!;
        const up = j === 0;
        s.alpha(j === 0 ? after(s, 'step', 0.65) : after(s, 'step', 0.2), () => {
          s.arrow(x - 4 * u, up ? yA + 2.4 * u : yA - 2.4 * u, x - 4 * u, up ? yA - 2.4 * u : yA + 2.4 * u, s.c(k), 0.45, 1.8);
          s.text(up ? 'pull' : 'push', x - 1.5 * u, yA, { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c(k) });
        });
      });
    });
    s.alpha(after(s, 'order', 0.35), () => rich(s, [['0.24', 'red'], [' > ', '--ink-3'], ['0.09', 'red'], [' > 0 > ', '--ink-3'], ['−0.33', 'green']], s.w / 2, s.h * 0.79, o));
  },
};

// ---- the temperature: the same row, the same vectors, the push split differently

/** Each negative's share of the push at temperature `t`: its probability over the negatives' total. */
function shares(t: number): [number, number] {
  const e1 = Math.exp(SIM[1]! / t);
  const e2 = Math.exp(SIM[2]! / t);
  return [e1 / (e1 + e2), e2 / (e1 + e2)];
}

/** The temperature at this moment: 0.4, up to 1, then down to 0.1, moving evenly in log scale. */
function tauNow(s: Scene): number {
  const up = s.ease('warm', 2.2, 0.4);
  const down = s.ease('cold', 2.4, 0.4);
  const l = lerp(lerp(Math.log(TAU), 0, up), Math.log(0.1), down);
  return Math.exp(l);
}

const trim = (v: number) => fmt(+v.toFixed(v < 0.995 ? 2 : 1)).replace(/\.0$/, '');

const temperature: SceneDef = {
  draw(s) {
    const u = s.u;
    const st = stacked(s);
    const g: Ring = st ? { cx: s.w / 2, cy: s.h * 0.36, r: 19 * u } : { cx: s.w * 0.3, cy: s.h * 0.47, r: 25 * u };
    const t = tauNow(s);
    const [easy, hard] = shares(t);
    s.slot('tau', trim(t));
    s.slot('share', `[${easy.toFixed(2)}, ${hard.toFixed(2)}]`);
    const hardName = after(s, 'hard', 0.4);
    ring(s, g, { anchor: 1, cands: 1 });
    s.alpha(hardName, () => {
      const [lx, ly] = at(g, ANG[2]!, g.r + 7.5 * u);
      s.text('hard', lx, ly - 6.2 * u, { size: 3.1, font: 'mono', weight: 650, align: 'right', color: s.c('red'), halo: true });
    });
    // The pull keeps one length; the pushes split it.
    const grow = s.ease('circle', 1, 0.5);
    const PULL = 34;
    arcArrow(s, g, g.r + 2.6 * u, ANG[0]!, PULL * UP[0]! * grow, 'green', 0.8);
    arcArrow(s, g, g.r + 2.6 * u, ANG[1]!, -PULL * easy * UP[1]! * grow, 'red', 0.8);
    arcArrow(s, g, g.r + 2.6 * u, ANG[2]!, -PULL * hard * UP[2]! * grow, 'red', 0.8);
    // The readouts: the temperature, the scores it gives, and how the push splits.
    const px = st ? s.w / 2 : s.w * 0.72;
    const yT = st ? s.h * 0.66 : s.h * 0.27;
    const yS = st ? s.h * 0.72 : s.h * 0.36;
    const yB = st ? s.h * 0.84 : s.h * 0.58;
    const bw = (st ? 64 : 52) * u;
    s.alpha(s.ease('circle', 0.6), () => {
      rich(s, [['τ', 'slate'], [` = ${trim(t)}`, '--ink-2']], px, yT, { size: 4.2, weight: 650 });
      const sc = SIM.map((v) => trim(v / t));
      rich(s, [['s', 'purple'], [` = sim / τ = [${sc.join(', ')}]`, '--ink-2']], px, yS, { size: 3.2 });
    });
    s.alpha(s.win('circle', 'hard') * after(s, 'circle', 0.5), () => rich(s, [['pushes 0.09 + 0.24 = ', 'red'], ['0.33 pull', 'green']], px, yB, { size: 3.3, weight: 600, halo: true }));
    s.alpha(s.ease('hard', 0.7), () => {
      const x0 = px - bw / 2;
      const h = 5 * u;
      s.rrect(x0, yB - h / 2, bw * hard, h, 0.8, { fill: s.tint('red', 0.55), stroke: s.c('red'), lw: 0.3 });
      s.rrect(x0 + bw * hard, yB - h / 2, bw * easy, h, 0.8, { fill: s.tint('red', 0.15), stroke: s.tint('red', 0.6), lw: 0.3 });
      const lab = { size: 3.2, font: 'mono', weight: 650, halo: true } as const;
      s.text(`${hardName > 0.5 ? 'hard' : 'closer'}: ${hard.toFixed(2)}`, x0, yB - 5.5 * u, { ...lab, align: 'left', color: s.c('red') });
      s.text(`other: ${easy.toFixed(2)}`, x0 + bw, yB - 5.5 * u, { ...lab, align: 'right', color: s.tint('red', 0.75) });
      s.text('the push, split between the negatives', px, yB + 5.5 * u, { size: 2.9, font: 'mono', color: s.c('--ink-3') });
    });
    cite(s, 'Wang & Liu, 2021', s.ease('aware', 0.6));
    const cy = s.h * 0.95;
    s.alpha(s.win('warm', 'cold') * after(s, 'warm', 0.35), () => caption(s, 'large τ: gaps narrow, softmax flat', cy, 'slate', 3.2));
    s.alpha(s.win('cold', 'unit') * after(s, 'cold', 0.35), () => caption(s, 'small τ: gaps stretch, softmax sharp', cy, 'slate', 3.2));
    s.alpha(s.win('unit', 'aware'), () => caption(s, 'same vectors: only the scores rescale', cy, '--ink-2', 3.2));
    s.alpha(s.ease('aware', 0.6), () => caption(s, 'small τ aims the push at hard negatives', cy, 'red', 3.2));
  },
};

// ---- worked as the practice asks it, with the positive in the middle

const WS = [1, 2, 1];
const WK = 1;
const WE = WS.map((v) => +Math.exp(v).toFixed(2));
const WT = WE.reduce((a, b) => a + b, 0);
const WP = WE.map((e) => +(e / WT).toFixed(2));
const WROLE: Ink[] = WS.map((_, j) => (j === WK ? 'green' : 'red'));

const worked: SceneDef = {
  draw(s) {
    const u = s.u;
    const xs = columns(s, 3, 19);
    const lx = xs[0]! - 13 * u;
    const ys = [0.17, 0.31, 0.45].map((f) => s.h * f);
    WS.forEach((_, j) => s.text(j === WK ? 'positive' : 'negative', xs[j]!, s.h * 0.08, { size: 3, font: 'mono', weight: 650, color: s.c(WROLE[j]!) }));
    rowLabel(s, 's', lx, ys[0]!, 'purple', 3.8);
    cells(s, xs, ys[0]!, WS.map(String), 'purple', { w: 14, h: 8, on: [s.win('ask', 'pos'), s.win('pos', 'turn'), 0] });
    s.alpha(after(s, 'ask', 0.6) * (1 - s.ease('neg', 0.5)), () => caption(s, 'slope on candidate 0?', s.h * 0.24, '--ink-3', 3.2));
    s.alpha(s.ease('neg', 0.6, 0.5), () => {
      rowLabel(s, 'eˢ', lx, ys[1]!, 'gold', 3.8);
      cells(s, xs, ys[1]!, WE.map((e) => e.toFixed(2)), 'gold', { w: 14, h: 8, on: [s.win('neg', 'pos'), s.win('pos', 'turn'), 0] });
    });
    s.alpha(after(s, 'neg', 0.35), () => s.text(`total ${WT.toFixed(2)}`, xs[2]! + 9 * u, ys[1]!, { size: 3.2, font: 'mono', align: 'left', color: s.c('--ink-2') }));
    const shown = [after(s, 'neg', 0.75), after(s, 'pos', 0.75)];
    s.alpha(shown[0]!, () => rowLabel(s, 'slope', lx, ys[2]!, 'red', 3.4));
    s.alpha(shown[0]!, () => cells(s, [xs[0]!], ys[2]!, [fmt(WP[0]!, 2)], 'red', { w: 14, h: 8 }));
    s.alpha(shown[1]!, () => cells(s, [xs[WK]!], ys[2]!, [fmt(+(WP[WK]! - 1).toFixed(2), 2)], 'red', { w: 14, h: 8 }));
    s.alpha(after(s, 'neg', 0.3), () => rich(s, [[`candidate 0: ${WE[0]!.toFixed(2)} / ${WT.toFixed(2)} = `, '--ink-2'], [WP[0]!.toFixed(2), 'red']], s.w / 2, s.h * 0.62, { size: 3.4, weight: 600, halo: true }));
    s.alpha(after(s, 'pos', 0.3), () => rich(s, [[`positive: ${WP[WK]!.toFixed(2)} − 1 = `, '--ink-2'], [fmt(+(WP[WK]! - 1).toFixed(2), 2), 'red']], s.w / 2, s.h * 0.7, { size: 3.4, weight: 600, halo: true }));
  },
};

export const scenes: Record<string, SceneDef> = { pull, slopes, temperature, worked };
