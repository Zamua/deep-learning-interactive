import { type Scene, type SceneDef, lerp } from '../../../lecture/scene';
import type { Color } from '../../../core/symbols';
import { cells, downArrows, rowLabel, verdict } from '../../draw';

type Ink = Color | `--${string}`;

const NAMES = ['cat', 'dog', 'bird'];
const S = [2, 1, -1];
const E = S.map(Math.exp);
const TOTAL = E.reduce((a, b) => a + b, 0);
const P = E.map((e) => e / TOTAL);
const f2 = (v: number) => v.toFixed(2);
/** Integers with a true minus sign. */
const int = (v: number) => String(v).replace('-', '−');

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

const say = (s: Scene, text: string, x: number, y: number, k: Ink = '--ink-2', align: CanvasTextAlign = 'center', size = 3.4) =>
  s.text(text, x, y, { size, font: 'mono', weight: 600, align, color: s.c(k), halo: true });

/**
 * Three answer columns on the left (names, scores, exponentials, bars) and, on the right, the one
 * bar that the probabilities share. The exponentials' bars and the stacked bar use one scale, so
 * stacking them is a move, not a resize.
 */
function layout(s: Scene) {
  const u = s.u;
  const cx = s.w * (s.tall ? 0.37 : 0.36);
  const g = (s.tall ? 19 : 22) * u;
  const base = s.h * 0.86;
  const kE = (base - s.h * 0.41) / E[0]!;
  return {
    xs: [cx - g, cx, cx + g],
    cx,
    lx: cx - g - 9 * u,
    yN: s.h * 0.08,
    yS: s.h * 0.18,
    yE: s.h * 0.32,
    yP: s.h * 0.47,
    /** Zero line and stage units per point for the score bars. */
    z0: s.h * 0.66,
    su: 8.5 * u,
    base,
    kE,
    bw: 10 * u,
    /** The shared bar: centre, width, and top (its bottom is `base`). */
    bx: s.w * (s.tall ? 0.85 : 0.8),
    sw: (s.tall ? 12 : 15) * u,
    top: base - kE * TOTAL,
  };
}
type L = ReturnType<typeof layout>;

function names(s: Scene, L: L, hi: number[] = [0, 0, 0]) {
  NAMES.forEach((n, i) => s.text(n, L.xs[i]!, L.yN, { size: 3.6, font: 'mono', weight: 500 + 150 * hi[i]!, color: s.c(hi[i]! > 0.5 ? 'purple' : '--ink-2') }));
}

function scoreRow(s: Scene, L: L, on: number[] = [0, 0, 0]) {
  rowLabel(s, 's', L.lx, L.yS, 'purple');
  cells(s, L.xs, L.yS, S.map(int), 'purple', { w: 12, h: 8.5, on });
}

function expRow(s: Scene, L: L, on: number[] = [0, 0, 0]) {
  rowLabel(s, 'e', L.lx, L.yE, 'gold');
  cells(s, L.xs, L.yE, E.map(f2), 'gold', { w: 12, h: 8.5, on });
}

/** One bar between a zero line `y0` and `y0 - h` (h may be negative), centred on x. */
function bar(s: Scene, x: number, y0: number, h: number, w: number, k: Ink, on = 0) {
  const a = 0.55 + 0.45 * on;
  const top = Math.min(y0, y0 - h);
  s.rrect(x - w / 2, top, w, Math.max(Math.abs(h), 0.6 * s.u), 0.8, { fill: s.tint(k, 0.35 * a + 0.2), stroke: s.tint(k, a), lw: 0.3 });
}

/**
 * Score bars morphing into the exponentials' bars as `m` goes 0 -> 1: the zero line drops to the
 * base and each height goes from score to e^score, so minus one flips up above the line.
 */
function morphBars(s: Scene, L: L, m: number, hi: number[] = [0, 0, 0], red = 0) {
  const y0 = lerp(L.z0, L.base, m);
  s.line(L.xs[0]! - L.bw, y0, L.xs[2]! + L.bw, y0, s.c('--axis'), 0.35);
  S.forEach((v, i) => {
    const h = lerp(v * L.su, E[i]! * L.kE, m);
    const neg = i === 2 ? red : 0;
    s.alpha(1 - m, () => bar(s, L.xs[i]!, y0, h, L.bw, neg > 0.5 ? 'red' : 'purple', Math.max(hi[i]!, neg)));
    s.alpha(m, () => bar(s, L.xs[i]!, y0, h, L.bw, 'gold', hi[i]!));
  });
}

/** The shared bar's outline, with its scale at the ends. */
function whole(s: Scene, L: L, topLabel: string, k: Ink, a = 1) {
  s.alpha(a, () => {
    s.rrect(L.bx - L.sw / 2, L.top, L.sw, L.base - L.top, 0.8, { stroke: s.tint(k, 0.8), lw: 0.4 });
    s.text(topLabel, L.bx, L.top - 3.6 * s.u, { size: 3.4, font: 'mono', weight: 650, color: s.c(k), halo: true });
    s.text('0', L.bx, L.base + 3.6 * s.u, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
  });
}

/** Slices of the shared bar, cat at the bottom, with a label for each to its left. */
function slices(s: Scene, L: L, shares: number[], k: Ink, labels: string[], o: { a?: number; hi?: number[] } = {}) {
  s.alpha(o.a ?? 1, () => {
    let y = L.base;
    const H = L.base - L.top;
    shares.forEach((p, i) => {
      const h = p * H;
      const on = o.hi?.[i] ?? 0;
      s.rrect(L.bx - L.sw / 2, y - h, L.sw, h, 0.5, { fill: s.tint(k, 0.22 + 0.16 * (2 - i) / 2 + 0.3 * on), stroke: s.c('--card'), lw: 0.35 });
      // The thin bird slice's label rides just above the dog's.
      const ly = h > 4 * s.u ? y - h / 2 : y - h / 2 - 2 * s.u;
      s.text(labels[i]!, L.bx - L.sw / 2 - 2 * s.u, ly, { size: 3.2, font: 'mono', weight: 500 + 150 * on, align: 'right', color: s.c(on > 0.5 ? k : '--ink-2'), halo: true });
      y -= h;
    });
  });
}

const GUESS = [0.5, 0.3, 0.2];

const sure: SceneDef = {
  draw(s) {
    const L = layout(s);
    const u = s.u;
    const hiCat = s.win('arg', 'prob');
    s.alpha(s.ease('ask', 0.6), () => {
      names(s, L, [hiCat, 0, 0]);
      scoreRow(s, L, [hiCat, 0, 0]);
    });
    s.alpha(s.ease('ask', 0.8, 1.5), () => morphBars(s, L, 0, [hiCat, 0, 0], s.ease('fail', 0.6)));
    s.alpha(s.win('arg', 'prob'), () => {
      say(s, 'argmax: cat', L.cx, s.h * 0.29, 'purple', 'center', 3.6);
      say(s, 'but how sure?', L.cx, s.h * 0.36, '--ink-2', 'center', 3.6);
    });
    // The one whole that probabilities share.
    const wa = s.ease('prob', 0.8);
    whole(s, L, '1', 'teal', wa);
    s.alpha(wa * (1 - s.ease('whole', 0.5)), () => {
      s.text('certain', L.bx - L.sw / 2 - 2 * u, L.top + 2 * u, { size: 3.2, font: 'mono', align: 'right', color: s.c('--ink-2'), halo: true });
      s.text('no chance', L.bx - L.sw / 2 - 2 * u, L.base - 2 * u, { size: 3.2, font: 'mono', align: 'right', color: s.c('--ink-2'), halo: true });
    });
    slices(s, L, GUESS, 'teal', NAMES.map((n) => `${n} ?`), { a: s.ease('whole', 0.8) });
    s.alpha(s.ease('whole', 0.6, 1.5) * (1 - s.ease('fail', 0.5)), () => say(s, 'shares of one whole', L.cx, s.h * 0.92));
    // Why scores cannot be the slices.
    s.alpha(s.ease('fail', 0.6, 1), () => say(s, '−1 < 0', L.xs[2]!, L.z0 + L.su + 4 * u, 'red', 'center', 3.4));
    s.alpha(s.ease('fail', 0.6, 3), () => say(s, '2 + 1 − 1 = 2, not 1', L.cx, s.h * 0.92, 'red', 'center', 3.6));
  },
};

const exp: SceneDef = {
  draw(s) {
    const L = layout(s);
    const u = s.u;
    names(s, L);
    scoreRow(s, L);
    whole(s, L, '1', 'teal', 0.35);
    s.alpha(s.win('two', 'exp'), () => say(s, 'move 1: e to each score', L.cx, s.h * 0.29, 'gold', 'center', 3.6));
    const ea = s.ease('exp', 0.8, 0.6);
    s.alpha(s.ease('exp', 0.6), () => {
      downArrows(s, L.xs, L.yS + 5 * u, L.yE - 5 * u);
      ['e²', 'e¹', 'e⁻¹'].forEach((t, i) => s.text(t, L.xs[i]! + 2 * u, (L.yS + L.yE) / 2, { size: 3.6, italic: true, align: 'left', color: s.c('--ink-3'), halo: true }));
    });
    const hi = [s.win('grow', undefined), 0, s.win('pos', 'order')];
    s.alpha(ea, () => expRow(s, L, hi));
    morphBars(s, L, s.ease('exp', 1.6, 1.2), hi);
    // Notes in the open space above the dog and bird bars.
    const nx = L.xs[1]! - 5 * u;
    s.alpha(s.win('pos', 'order'), () => say(s, '0.37 > 0: positive', nx, s.h * 0.5, 'gold', 'left'));
    s.alpha(s.win('order', 'grow'), () => say(s, '7.39 > 2.72 > 0.37', nx, s.h * 0.5, 'gold', 'left'));
    s.alpha(s.win('order', 'grow'), () => say(s, 'same order', nx, s.h * 0.56, '--ink-2', 'left'));
    s.alpha(s.ease('grow', 0.6), () => {
      say(s, '× 2.7 per point', nx, s.h * 0.5, 'gold', 'left');
      say(s, 'the leader pulls ahead', nx, s.h * 0.56, '--ink-2', 'left');
    });
  },
};

const divide: SceneDef = {
  marks: {
    pk: { tex: String.raw`\symp_k = \dfrac{e^{\syms_k}}{\text{total}}`, x: 0.36, y: 0.74, size: 5.2 },
    full: { tex: String.raw`\symp_k = \dfrac{e^{\syms_k}}{\sum_j e^{\syms_j}}`, x: 0.36, y: 0.74, size: 5.2 },
  },
  draw(s) {
    const L = layout(s);
    const u = s.u;
    names(s, L, [s.win('cat', 'check'), 0, 0]);
    s.alpha(0.45, () => scoreRow(s, L));
    expRow(s, L, [s.win('cat', 'check'), 0, 0]);
    // The three bars slide over and stack, cat at the bottom.
    let off = 0;
    E.forEach((e, i) => {
      const m = s.ease('stack', 1.2, 0.4 + 0.5 * i);
      const h = e * L.kE;
      const x = lerp(L.xs[i]!, L.bx, m);
      const y0 = lerp(L.base, L.base - off, m);
      const w = lerp(L.bw, L.sw, m);
      s.alpha(1 - s.ease('stack', 0.4, 2.4), () => bar(s, x, y0, h, w, 'gold'));
      off += h;
    });
    s.alpha(1 - s.ease('stack', 0.4, 0.2), () => s.line(L.xs[0]! - L.bw, L.base, L.xs[2]! + L.bw, L.base, s.c('--axis'), 0.35));
    const st = s.ease('stack', 0.4, 2.4);
    // The gold bar hands over to the teal one: out first, then in, so the labels never overprint.
    const out = s.ease('divide', 0.5);
    const dv = s.ease('divide', 0.7, 0.5);
    whole(s, L, f2(TOTAL), 'gold', st * (1 - out));
    slices(s, L, P, 'gold', E.map((e, i) => `${NAMES[i]} ${f2(e)}`), { a: st * (1 - out) });
    s.alpha(s.ease('stack', 0.6, 3) * (1 - s.ease('divide', 0.6)), () => say(s, '7.39 + 2.72 + 0.37 = 10.48', L.cx, s.h * 0.47, 'gold', 'center', 3.4));
    // Divided by the total: the same slices, now shares of one.
    const hiP = [s.win('cat', 'check'), 0, 0];
    whole(s, L, '1', 'teal', dv);
    slices(s, L, P, 'teal', P.map((p, i) => `${NAMES[i]} ${f2(p)}`), { a: dv, hi: hiP });
    s.alpha(s.ease('divide', 0.6, 1.5), () => {
      rowLabel(s, 'p', L.lx, L.yP, 'teal');
      cells(s, L.xs, L.yP, P.map(f2), 'teal', { w: 12, h: 8.5, on: hiP });
    });
    s.alpha(s.win('cat', 'check'), () => say(s, '7.39 / 10.48 ≈ 0.71', L.cx, s.h * 0.6, 'teal', 'center', 3.6));
    s.alpha(s.win('check', 'pk'), () => {
      verdict(s, true, 'all positive', L.xs[0]! - 5 * u, s.h * 0.62, 3.6);
      verdict(s, true, 'adding up to 1', L.xs[0]! - 5 * u, s.h * 0.72, 3.6);
    });
    s.show('pk', s.win('pk', 'sigma'));
    s.show('full', s.ease('sigma', 0.6));
    s.alpha(s.ease('j', 0.6), () => say(s, 'j = 0, 1, 2: every answer', L.cx, s.h * 0.9, '--ink-2', 'center', 3.4));
  },
};

// ---- the same shares under a shift, sharper under a stretch, equal with no gaps

const ROWS: { name: string; sc: number[]; beat: string | null; note: string; k: Ink }[] = [
  { name: 's', sc: S, beat: null, note: '', k: '--ink-2' },
  { name: 's + 5', sc: S.map((v) => v + 5), beat: 'shift', note: 'the same shares', k: 'green' },
  { name: '0 · s', sc: S.map(() => 0), beat: 'gaps', note: 'no gaps: a third each', k: 'blue' },
  { name: '2s', sc: S.map((v) => 2 * v), beat: 'scale', note: 'gaps doubled: sharper', k: 'orange' },
];
const share = (sc: number[]) => {
  const e = sc.map(Math.exp);
  const t = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / t);
};

const gaps: SceneDef = {
  draw(s) {
    const u = s.u;
    const cw = 10;
    const g = 12;
    const barW = (s.tall ? 48 : 70) * u;
    // Label, three cells and the share bar, centred as one block.
    const block = 14 * u + (2 * g + cw) * u + 6 * u + barW;
    const x0 = s.w / 2 - block / 2;
    const xs = [0, 1, 2].map((i) => x0 + 14 * u + (cw / 2 + i * g) * u);
    const bx0 = xs[2]! + (cw / 2 + 6) * u;
    NAMES.forEach((n, i) => s.text(n, xs[i]!, s.h * 0.07, { size: 3.2, font: 'mono', color: s.c('--ink-3') }));
    ROWS.forEach((r, ri) => {
      const y = s.h * (0.16 + ri * 0.215);
      const a = r.beat ? s.ease(r.beat, 0.6) : 1;
      const p = share(r.sc);
      const top = r.beat === 'scale' ? s.ease('soft', 0.6) : 0;
      s.alpha(a, () => {
        rowLabel(s, r.name, xs[0]! - (cw / 2 + 2) * u, y, 'purple', 3.6);
        cells(s, xs, y, r.sc.map(int), 'purple', { w: cw, h: 7.5, size: 3.2 });
        let x = bx0;
        p.forEach((v, i) => {
          const w = v * barW;
          const on = i === 0 ? top : 0;
          s.rrect(x, y - 4 * u, w, 8 * u, 0.5, { fill: s.tint('teal', 0.22 + 0.16 * (2 - i) / 2 + 0.3 * on), stroke: s.c('--card'), lw: 0.35 });
          if (w > 9 * u) s.text(f2(v), x + w / 2, y + 0.2 * u, { size: 3.2, font: 'mono', weight: 600, color: s.c('--ink') });
          x += w;
        });
        // During "soft", the doubled row's note says what stays soft about it.
        const soft = r.beat === 'scale' ? s.win('soft', 'bridle') : 0;
        if (r.note) s.alpha(1 - soft, () => say(s, r.note, bx0, y + 7.5 * u, r.k, 'left', 3.2));
        s.alpha(soft, () => say(s, 'biggest, never all of it', bx0, y + 7.5 * u, 'teal', 'left', 3.2));
      });
    });
    cite(s, 'John S. Bridle, NIPS 1989: soft max', s.ease('bridle', 0.6));
  },
};

export const scenes: Record<string, SceneDef> = { sure, exp, divide, gaps };
