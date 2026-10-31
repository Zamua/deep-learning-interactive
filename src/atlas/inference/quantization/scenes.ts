import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import type { Ink } from '../../../lecture/scene';
import { cells, cite, columns, rowLabel } from '../../draw';
import { hbar } from '../draw';

const W = [0.7, -0.33, 0.18];
const S = 0.1;
const Q = W.map((w) => Math.round(w / S));
const BACK = Q.map((q) => +(q * S).toFixed(1));
const ERR = W.map((w, i) => Math.abs(w - BACK[i]!));
const f = (v: number) => String(+v.toFixed(2)).replace('-', '−');

/** A number line from l to r showing values in [lo, hi]; returns the map from value to x. */
function axis(s: Scene, y: number, l: number, r: number, lo: number, hi: number, a = 1): (v: number) => number {
  const X = (v: number) => l + ((v - lo) / (hi - lo)) * (r - l);
  s.alpha(a, () => s.line(l, y, r, y, s.c('--axis'), 0.35));
  return X;
}

/** Ticks at k times `step` for k from -n to n, optionally numbered by k. */
function ticks(s: Scene, X: (v: number) => number, y: number, step: number, n: number, k: Ink, o: { a?: number; labels?: 'all' | 'ends'; len?: number; lw?: number } = {}) {
  const len = (o.len ?? 1.2) * s.u;
  s.alpha(o.a ?? 1, () => {
    for (let i = -n; i <= n; i++) {
      const x = X(i * step);
      s.line(x, y - len, x, y + len, s.tint(k, 0.9), o.lw ?? 0.3);
      if (o.labels === 'all' || (o.labels === 'ends' && (i === 0 || Math.abs(i) === n))) s.text(String(i).replace('-', '−'), x, y + 4 * s.u, { size: 2.4, font: 'mono', color: s.c('--ink-3') });
    }
  });
}

const mono = (size: number, k: string, extra: object = {}) => ({ size, font: 'mono' as const, color: k, ...extra });

// ---- the problem: a model too big for a smaller GPU, and how fewer bits shrink it

const SIZES: [string, number, string, string, Ink][] = [
  ['16 bits: 2 bytes each', 14, '14 GB', 'big', 'slate'],
  ['8 bits: 1 byte each', 7, '7 GB', 'b8', 'teal'],
  ['4 bits: half a byte', 3.5, '3.5 GB', 'b4', 'green'],
];

const fit: SceneDef = {
  draw(s) {
    const u = s.u;
    const c = s.w / 2;
    const x0 = c - 42 * u;
    const G = 4.4 * u;
    s.text('7 billion weights', c, 7 * u, { size: 3.4, font: 'mono', weight: 650, color: s.c('blue') });
    // The GPU's memory: a box the bars must fit inside.
    const gA = s.ease('gpu', 0.6);
    s.alpha(gA, () => {
      s.rrect(x0 - 1.5 * u, 14 * u, 8 * G + 1.5 * u, 45 * u, 1, { fill: s.tint('blue', 0.06), stroke: s.tint('blue', 0.7), lw: 0.35 });
      s.text('GPU: 8 GB', x0 + 8 * G - 1 * u, 56 * u, { size: 2.9, font: 'mono', weight: 650, align: 'right', color: s.c('blue') });
    });
    SIZES.forEach(([name, gb, label, beat, k], i) => {
      const y = (24 + i * 13) * u;
      s.alpha(i === 0 ? 1 : s.ease(beat, 0.6), () => {
        s.text(name, x0, y - 5 * u, { size: 2.9, font: 'mono', align: 'left', color: s.c('--ink-3'), halo: true });
        const len = gb * G * (i === 0 ? s.ease(beat, 1, 0.2) : s.ease(beat, 1, 0.3));
        hbar(s, x0, y, len, k, label);
        if (i === 0) s.alpha(gA, () => {
          s.rrect(x0 + 8 * G, y - 2.2 * u, Math.max(0, len - 8 * G), 4.4 * u, 0.4, { fill: s.tint('red', 0.45), stroke: s.c('red'), lw: 0.3 });
          s.text('too big', x0 + len + 15 * u, y, { size: 3.1, font: 'mono', weight: 650, align: 'left', color: s.c('red'), halo: true });
        });
        if (i === 1) s.alpha(s.ease(beat, 0.6, 3.2), () => s.text('fits', x0 + len + 13 * u, y, { size: 3.1, font: 'mono', weight: 650, align: 'left', color: s.c('green'), halo: true }));
      });
    });
    // How many values each width allows: almost a continuum, or sixteen.
    const l = c - 46 * u;
    const r = c + 46 * u;
    s.alpha(s.ease('v16', 0.6), () => {
      s.text('16 bits: 65,536 values', l, 66 * u, { size: 2.9, font: 'mono', align: 'left', color: s.c('--ink-2') });
      for (let i = 0; i <= 240; i++) s.line(lerp(l, r, i / 240), 69.5 * u, lerp(l, r, i / 240), 72.5 * u, s.tint('slate', 0.6), 0.12);
    });
    s.alpha(s.ease('v4', 0.6), () => {
      s.text('4 bits: 16 values', l, 80 * u, { size: 2.9, font: 'mono', align: 'left', color: s.c('--ink-2') });
      for (let i = 0; i < 16; i++) s.circle(lerp(l, r, i / 15), 85 * u, 1 * u, { fill: s.c('purple') });
      s.alpha(s.ease('v4', 0.6, 2), () => s.text('which sixteen?', c, 94 * u, { size: 3.4, font: 'mono', weight: 650, color: s.c('purple') }));
    });
  },
};

// ---- the steps: a scale, integers, rounding and the way back

const steps: SceneDef = {
  draw(s) {
    const u = s.u;
    const xs = columns(s, 3, s.tall ? 19 : 21).map((x) => x + 5 * u);
    const lx = xs[0]! - 11 * u;
    // Weight 0 snaps on 'divide'; 1 and 2 on 'round'.
    const snapT = [s.ease('divide', 1, 6.5), s.ease('round', 1, 4.2), s.ease('round', 1, 8)];
    const qA = [s.ease('divide', 0.6, 7), s.ease('round', 0.6, 4.6), s.ease('round', 0.6, 8.4)];
    const rows: [string, string[], Ink, number, number[]][] = [
      ['w', W.map(f), 'blue', 14, W.map(() => s.ease('line', 0.6))],
      ['q', Q.map(f), 'purple', 26, qA],
      ['q × s', BACK.map(f), 'teal', 38, W.map(() => s.ease('back', 0.6))],
    ];
    rows.forEach(([name, vals, k, y, a], r) => {
      s.alpha(Math.max(...a), () => rowLabel(s, name, lx, y * u, k, 3.6));
      vals.forEach((v, i) => s.alpha(a[i]!, () => cells(s, [xs[i]!], y * u, [v], k, { w: 13, h: 8, size: 3.2, on: [r === 1 ? s.win('divide', 'back') * (i === 0 ? 1 : s.win('round', 'back')) : r === 2 ? s.win('back', 'error') * (i === 1 ? 1 : 0) : 0] })));
    });
    s.alpha(s.ease('divide', 0.6), () => s.text('÷ s, then round', (xs[0]! + xs[1]!) / 2, 20 * u, { size: 2.7, font: 'mono', color: s.c('--ink-3') }));
    s.alpha(s.ease('back', 0.6), () => s.text('× s', (xs[0]! + xs[1]!) / 2, 32 * u, { size: 2.7, font: 'mono', color: s.c('--ink-3') }));

    // The number line, the steps, and the weights snapping onto them.
    const ly = 60 * u;
    const half = (s.tall ? 46 : 50) * u;
    const X = axis(s, ly, s.w / 2 - half, s.w / 2 + half, -0.8, 0.8);
    ticks(s, X, ly, S, 7, 'slate', { a: s.ease('grid', 0.6), labels: 'all' });
    s.alpha(s.ease('scale', 0.6, 0.8), () => {
      for (const v of [-0.7, 0.7]) s.text(f(v), X(v), ly - 8.5 * u, { size: 2.8, font: 'mono', weight: 650, color: s.c('slate') });
    });
    W.forEach((w, i) => {
      s.alpha(s.ease('line', 0.5, 0.6 + 0.3 * i), () => {
        const lift = snapT[i]!;
        const x = lerp(X(w), X(BACK[i]!), lift);
        // The true weight rises above the line; its stored copy slides to the nearest step.
        s.circle(X(w), ly - (2.4 + 3.6 * lift) * u, (1.3 - 0.2 * lift) * u, { fill: s.tint('blue', 1 - 0.5 * lift) });
        if (lift > 0.02) s.circle(x, ly - 2.4 * u, 1.3 * u, { fill: s.c(lift > 0.5 ? 'teal' : 'blue') });
        s.alpha(s.ease('error', 0.6), () => {
          if (ERR[i]! > 0.001) s.line(X(w), ly - 6 * u, X(BACK[i]!), ly - 6 * u, s.c('red'), 0.5);
        });
      });
    });
    const cy = 71 * u;
    s.alpha(s.win('scale', 'name'), () => s.text('s = 0.1: steps −7 to 7 cover −0.7 to 0.7', s.w / 2, cy, mono(2.9, s.c('--ink-2'))));
    s.alpha(s.win('name', 'divide'), () => s.text('quantum: Latin for how much', s.w / 2, cy, mono(3.1, s.c('purple'), { weight: 650 })));
    s.alpha(s.win('divide', 'error'), () => s.text('q = round(w / s)', s.w / 2, cy, mono(3.1, s.c('purple'), { weight: 650 })));
    s.alpha(s.ease('error', 0.6), () => {
      s.text(`errors: ${ERR.map((e) => e.toFixed(2)).join(', ')}`, s.w / 2, 82 * u, mono(3.1, s.c('red')));
      s.text('never more than s / 2 = 0.05', s.w / 2, 89 * u, mono(3.4, s.c('red'), { weight: 650 }));
    });
    cite(s, 'Jacob et al., Google, 2017', s.ease('jacob', 0.6));
  },
};

// ---- the price: the scale trades reach for step size, and fewer bits mean coarser steps

const price: SceneDef = {
  draw(s) {
    const u = s.u;
    const c = s.w / 2;
    const half = (s.tall ? 48 : 52) * u;
    const low = s.ease('b8', 0.7);
    // One ruler whose scale doubles: the reach and the step grow together.
    s.alpha(1 - 0.6 * low, () => {
      const sc = lerp(0.1, 0.2, s.ease('wider', 1.2, 0.3));
      const y = 30 * u;
      const X = axis(s, y, c - half, c + half, -1.5, 1.5);
      ticks(s, X, y, sc, 7, 'slate', { labels: 'ends' });
      const reach = 7 * sc;
      s.rrect(X(-reach), y - 2.5 * u, X(reach) - X(-reach), 5 * u, 1, { fill: s.tint('teal', 0.12) });
      s.text(`s = ${sc.toFixed(2).replace(/0$/, '')}`, c - half, 19 * u, mono(3.2, s.c('slate'), { weight: 650, align: 'left' }));
      s.text(`reach ${f(reach)}, largest error ${f(sc / 2)}`, c - half, 41 * u, mono(3, s.c('--ink-2'), { align: 'left' }));
      // A weight beyond the reach of s = 0.1, inside the reach of 0.2.
      s.alpha(s.ease('reach', 0.6, 10.3), () => {
        const out = reach < 1.1;
        s.circle(X(1.1), y - 4.5 * u, 1.3 * u, { fill: s.c(out ? 'red' : 'blue') });
        s.text(out ? 'beyond reach' : 'fits', X(1.1), y - 8.5 * u, mono(2.8, s.c(out ? 'red' : 'green'), { weight: 650 }));
      });
    });
    // The same range in 8 bits and in 4.
    const l = c - half;
    const r = c + half;
    s.alpha(low, () => {
      const y8 = 64 * u;
      s.text('8 bits: 255 steps, from −127 to 127', l, y8 - 5.5 * u, mono(2.9, s.c('--ink-2'), { align: 'left' }));
      s.line(l, y8, r, y8, s.c('--axis'), 0.35);
      for (let k = -127; k <= 127; k++) s.line(lerp(l, r, (k + 127) / 254), y8 - 0.9 * u, lerp(l, r, (k + 127) / 254), y8 + 0.9 * u, s.tint('teal', 0.7), 0.12);
    });
    s.alpha(s.ease('b4', 0.7), () => {
      const y4 = 82 * u;
      s.text('4 bits: 15 steps, each about 18× as wide', l, y4 - 5.5 * u, mono(2.9, s.c('--ink-2'), { align: 'left' }));
      const X = axis(s, y4, l, r, -1, 1);
      ticks(s, X, y4, 1 / 7, 7, 'green', { lw: 0.35 });
    });
    cite(s, 'LLM.int8() · Dettmers et al., 2022', s.win('dettmers', 'frantar'));
    cite(s, 'GPTQ · Frantar et al., 2022', s.ease('frantar', 0.6));
  },
};

export const scenes: Record<string, SceneDef> = { fit, steps, price };
