import type { Scene, SceneDef } from '../../../lecture/scene';
import type { Color } from '../../../core/symbols';
import { Rng } from '../../../core/rand';
import { after, cells, cite, columns, rowLabel } from '../../draw';
import { caption, unit } from '../draw';

const H = [2, 1, 3, 2];
const M = [1, 0, 1, 0];
const P = 0.5;
const fmt = (v: number) => String(v);

/** Random keep masks, one per 0.7 seconds while units blink in and out; each keeps some and drops some, so every frame shows both. */
const MASKS = (() => {
  const rng = new Rng(11);
  const out: number[][] = [];
  while (out.length < 40) {
    const m = H.map(() => (rng.next() < P ? 1 : 0));
    if (m.includes(0) && m.includes(1)) out.push(m);
  }
  return out;
})();
const maskAt = (s: Scene, beat: string) => MASKS[Math.max(0, Math.floor(s.since(beat) / 0.7)) % MASKS.length]!;

// ---- lean: training and test time, units that only work together, and switching them off at random

/** Inputs on top, the hidden layer, one output; the lower stage holds the captions. */
function netLayout(s: Scene) {
  return { xi: columns(s, 3, 24), xh: columns(s, 4, s.tall ? 20 : 22), yi: s.h * 0.13, yh: s.h * 0.37, yo: s.h * 0.6, cx: s.w / 2 };
}

/** One row of the tally: a label, then a check or a cross per example. */
function tally(s: Scene, y: number, label: string, marks: boolean[], a: number) {
  const u = s.u;
  const x0 = s.w / 2 - 6 * u;
  s.alpha(a, () => {
    s.text(label, x0 - 2 * u, y, { size: 3.3, font: 'mono', align: 'right', color: s.c('--ink-2') });
    marks.forEach((ok, i) => s.alpha(after(s, 'gap', 0.15 + 0.05 * i, 0.3), () => s.text(ok ? '✓' : '✗', x0 + (2 + 5.5 * i) * u, y, { size: 4, font: 'ui', weight: 700, color: s.c(ok ? 'green' : 'red') })));
  });
}

const lean: SceneDef = {
  draw(s) {
    const L = netLayout(s);
    const u = s.u;
    // Weights change every step until test time, then hold still.
    const tt = Math.min(s.t, s.at('test'));
    const wt = (i: number, j: number) => 0.2 + 0.45 * (0.5 + 0.5 * Math.sin(2.1 * tt + i * 1.7 + j * 0.9));
    const drop = s.ease('drop', 0.5);
    const mask = maskAt(s, 'drop');
    const off = (j: number) => (1 - mask[j]!) * drop;
    // Connections, faded where a unit is off.
    L.xh.forEach((xh, j) => {
      const fade = 1 - 0.85 * off(j);
      L.xi.forEach((xi, i) => s.alpha(fade, () => s.line(xi, L.yi + 3 * u, xh, L.yh - 6 * u, s.tint('blue', 0.55), wt(i, j))));
      s.alpha(fade, () => s.line(xh, L.yh + 6 * u, L.cx, L.yo - 6 * u, s.tint('blue', 0.55), wt(3, j)));
    });
    L.xi.forEach((x) => s.circle(x, L.yi, 3 * u, { fill: s.tint('orange', 0.25), stroke: s.c('orange'), lw: 0.35 }));
    L.xh.forEach((x, j) => {
      s.alpha(1 - 0.7 * off(j), () => unit(s, x, L.yh, 6, '', 'gold', 0.3));
      if (off(j) > 0.003) s.alpha(off(j), () => s.line(x - 5 * u, L.yh + 5 * u, x + 5 * u, L.yh - 5 * u, s.c('red'), 0.5));
    });
    unit(s, L.cx, L.yo, 6, '', 'purple', 0.3);
    const lab = { size: 3, font: 'mono', align: 'right', color: s.c('--ink-3') } as const;
    s.text('input', L.xi[0]! - 6 * u, L.yi, lab);
    s.text('hidden', L.xh[0]! - 9 * u, L.yh, lab);
    s.text('output', L.cx - 9 * u, L.yo, lab);
    // Training's step counter, frozen at test time; then the new inputs.
    const step = 1 + Math.floor(Math.max(0, tt - s.at('train')) / 0.45);
    s.alpha(s.win('train', 'gap'), () => s.text(`step ${step}`, L.cx + 9 * u, L.yo, { size: 3.2, font: 'mono', weight: 600, align: 'left', color: s.c('blue') }));
    s.alpha(s.win('test', 'gap'), () => s.text('new input', L.xi[2]! + 5 * u, L.yi, { size: 3.1, font: 'mono', weight: 600, align: 'left', color: s.c('orange'), halo: true }));
    // Two units that only work together.
    const team = s.win('lean', 'drop');
    s.alpha(team, () => {
      const [a, b] = [L.xh[1]!, L.xh[2]!];
      s.rrect(a - 8.5 * u, L.yh - 8.5 * u, b - a + 17 * u, 17 * u, 3, { fill: s.tint('red', 0.06), stroke: s.tint('red', 0.7), lw: 0.4 });
      s.text('only useful together', (a + b) / 2, L.yh + 12 * u, { size: 3.2, font: 'mono', weight: 600, color: s.c('red'), halo: true });
    });
    cite(s, 'Hinton and colleagues, 2012', s.win('lean', 'name'));

    const cy = s.h * 0.78;
    s.alpha(s.win('train', 'test'), () => caption(s, 'training: the weights change every step', cy, 'blue', 3.4));
    s.alpha(s.win('test', 'gap'), () => caption(s, 'test time: weights fixed, new inputs', cy, '--ink-2', 3.4));
    const g = s.win('gap', 'lean');
    tally(s, s.h * 0.74, 'training examples', [true, true, true, true, true, true], g);
    tally(s, s.h * 0.84, 'new inputs', [true, false, true, false, false, true], g);
    s.alpha(s.win('drop', 'name'), () => caption(s, 'each unit off at random, half on average', cy, 'red', 3.3));
    s.alpha(s.ease('name', 0.6), () => caption(s, 'units drop out: dropout', cy, '--ink-2', 3.8));
  },
};

// ---- mask: h, the keep probability p, a mask m, and h times m

/** Where the units, the mask and the output sit. */
function rows(s: Scene) {
  const xs = columns(s, 4, s.tall ? 20 : 22);
  return { xs, lx: xs[0]! - 11 * s.u, yh: s.h * 0.2, ym: s.h * 0.44, yo: s.h * 0.68, cy: s.h * 0.88 };
}
type R = ReturnType<typeof rows>;

/** The units of h as circles, dimmed and struck through where `off`, ringed where `ring`. */
function units(s: Scene, R: R, off: number[], ring: number[] = []) {
  rowLabel(s, 'h', R.lx, R.yh, 'gold', 3.8);
  R.xs.forEach((x, i) => {
    const o = off[i] ?? 0;
    s.alpha(1 - 0.65 * o, () => unit(s, x, R.yh, 6, String(H[i]), 'gold', 0, 3.8));
    if (o > 0.003) s.alpha(o, () => s.line(x - 5 * s.u, R.yh + 5 * s.u, x + 5 * s.u, R.yh - 5 * s.u, s.c('red'), 0.5));
    const r = ring[i] ?? 0;
    if (r > 0.003) s.alpha(r, () => s.circle(x, R.yh, 7.6 * s.u, { stroke: s.tint('gold', 0.9), lw: 0.45 }));
  });
}

/** A row of mask cells, green where kept and red where dropped. */
function maskRow(s: Scene, R: R, m: number[], y: number, on = 0.5) {
  R.xs.forEach((x, i) => s.cell(x - 5.5 * s.u, y - 4.25 * s.u, 11 * s.u, 8.5 * s.u, String(m[i]), m[i] ? 'green' : 'red', { on }));
}

/** Ten tosses for unit 0, kept in five of them. */
const TOSSES = [1, 0, 0, 1, 1, 0, 1, 0, 1, 0];

const mask: SceneDef = {
  draw(s) {
    const R = rows(s);
    const u = s.u;
    const mA = s.ease('mask', 0.6);
    // From halfway through `kept`, a fresh mask every 0.7 seconds.
    const cyc = after(s, 'kept', 0.45);
    const live = s.since('kept') >= 0 ? maskAt(s, 'kept') : M;
    const m = cyc > 0.5 ? live : M;
    units(s, R, m.map((v) => (1 - v) * after(s, 'mask', 0.6)), [s.win('prob', 'mask'), 0, 0, 0]);
    s.alpha(s.win('p', 'mask'), () => s.text('p = 0.5: the chance a unit is kept', s.w / 2, R.ym - 10 * u, { size: 3.2, font: 'mono', color: s.c('--ink-2'), halo: true }));
    cite(s, 'Srivastava and colleagues, 2014', s.win('p', 'prob'));
    // Unit 0 over ten steps: kept in half of them.
    s.alpha(s.win('prob', 'mask'), () => {
      const w = 5.4 * u;
      const x0 = s.w / 2 - (TOSSES.length * w) / 2;
      TOSSES.forEach((k, i) => s.alpha(after(s, 'prob', 0.25 + 0.04 * i, 0.3), () => s.cell(x0 + i * w + 0.4 * u, R.ym - 2.3 * u, w - 0.8 * u, 4.6 * u, '', k ? 'green' : 'red', { on: k ? 0.8 : 0.2 })));
      s.text('unit 0, ten steps: kept 5 times', s.w / 2, R.ym + 7 * u, { size: 3.2, font: 'mono', color: s.c('--ink-2'), halo: true });
    });
    s.alpha(mA, () => {
      rowLabel(s, 'm', R.lx, R.ym, '--ink-2', 3.8);
      maskRow(s, R, m, R.ym);
    });
    const zA = s.ease('zeroed', 0.6) * (1 - cyc);
    s.alpha(zA, () => {
      R.xs.forEach((x) => s.arrow(x, R.ym + 5 * u, x, R.yo - 5.5 * u, s.c('--ink-3'), 0.35, 2));
      rowLabel(s, 'out', R.lx, R.yo, 'gold', 3.8);
      cells(s, R.xs, R.yo, H.map((v, i) => fmt(v * M[i]!)), 'gold', { w: 11, h: 8.5, on: M.map((k) => k * s.win('zeroed', 'kept')) });
    });
    const cap = (text: string, a: number, k: Color | '--ink-2' = '--ink-2', size = 3.6) => s.alpha(a, () => caption(s, text, R.cy, k, size));
    cap('a coin toss per unit: 1 keeps, 0 drops', s.win('mask', 'zeroed'));
    cap('h × m = [2, 0, 3, 0]', s.win('zeroed', 'kept'), 'gold', 3.8);
    cap('kept on average: 4 × 0.5 = 2 units', s.ease('kept', 0.6) * (1 - cyc), 'green');
    cap('a new mask every step', cyc, 'green');
  },
};

// ---- scale: dropping lowers the average; plain dropout fixes it at test time, inverted in training

const scale: SceneDef = {
  draw(s) {
    const R = rows(s);
    const u = s.u;
    const inv = s.ease('invert', 0.8);
    const free = s.ease('free', 0.8);
    const title = (text: string, y: number, a: number, k: Color | '--ink-2' = '--ink-2') => s.alpha(a, () => s.text(text, s.w / 2, y - 8.5 * u, { size: 3.2, font: 'mono', weight: 600, color: s.c(k), halo: true }));
    const ring0 = Math.max(s.win('shrink', 'test'), s.win('avg', 'free'));
    // Training masks the units only in the inverted part; test time keeps them all.
    units(s, R, M.map((k) => (1 - k) * inv * (1 - free)), [ring0, 0, 0, 0]);

    // Plain dropout: the training average, test time, then test time scaled by p.
    s.alpha(1 - inv, () => {
      title('training average: p × h', R.ym, s.ease('shrink', 0.6), 'gold');
      cells(s, R.xs, R.ym, H.map((v) => fmt(v * P)), 'gold', { w: 11, h: 8.5, on: [ring0, 0, 0, 0] });
      const pl = s.ease('plain', 0.8, 1.5);
      s.alpha(s.ease('test', 0.6), () => {
        title(pl > 0.5 ? 'test time, × p: they match' : 'test time: every unit kept', R.yo, 1, pl > 0.5 ? 'green' : 'red');
        s.alpha(1 - pl, () => cells(s, R.xs, R.yo, H.map(fmt), 'red', { w: 11, h: 8.5, on: H.map(() => s.win('test', 'plain')) }));
        s.alpha(pl, () => cells(s, R.xs, R.yo, H.map((v) => fmt(v * P)), 'green', { w: 11, h: 8.5, on: H.map(() => 0.5) }));
      });
      cite(s, 'Hinton and colleagues, 2012', s.win('plain', 'invert'));
    });

    // Inverted dropout: mask, divide by p during training; test time passes h through.
    s.alpha(inv, () => {
      title(free > 0.5 ? 'test time: keep every unit' : 'training: m', R.ym, 1);
      s.alpha(1 - free, () => maskRow(s, R, M, R.ym));
      s.alpha(free, () => maskRow(s, R, [1, 1, 1, 1], R.ym, 0.2));
      const sc = s.ease('scaled', 0.8);
      s.alpha(1 - free, () => {
        title(sc > 0.5 ? 'out = h × m ÷ p' : 'out = h × m', R.yo, 1, 'gold');
        s.alpha(1 - sc, () => cells(s, R.xs, R.yo, H.map((v, i) => fmt(v * M[i]!)), 'gold', { w: 11, h: 8.5 }));
        s.alpha(sc, () => cells(s, R.xs, R.yo, H.map((v, i) => fmt((v * M[i]!) / P)), 'gold', { w: 11, h: 8.5, on: [Math.max(s.win('scaled', 'avg'), ring0), 0, s.win('scaled', 'avg'), 0] }));
      });
      s.alpha(free, () => {
        title('out = h: nothing to fix', R.yo, 1, 'green');
        cells(s, R.xs, R.yo, H.map(fmt), 'green', { w: 11, h: 8.5, on: H.map(() => 0.5) });
      });
    });

    const cap = (text: string, a: number, k: Color | '--ink-2' = '--ink-2', size = 3.4) => s.alpha(a, () => caption(s, text, R.cy, k, size));
    cap('unit 0: ½ × 2 + ½ × 0 = 1 = p × h', s.win('shrink', 'test'), 'gold');
    cap('test: 2× what training averaged', s.win('test', 'plain'), 'red');
    cap('plain dropout: × p at test time', s.win('plain', 'invert'), 'green');
    cap('inverted dropout: ÷ p in training', s.win('invert', 'scaled'), 'gold');
    cap('÷ 0.5 doubles: [4, 0, 6, 0]', s.win('scaled', 'avg'), 'gold', 3.6);
    cap('unit 0: ½ × 4 + ½ × 0 = 2 = h', s.win('avg', 'free'), 'gold');
    cap('test time: out = h', free, 'green', 3.6);
  },
};

export const scenes: Record<string, SceneDef> = { lean, mask, scale };
