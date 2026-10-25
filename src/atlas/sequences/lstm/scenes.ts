import type { Color } from '../../../core/symbols';
import type { Scene, SceneDef } from '../../../lecture/scene';

/** Where the cell diagram's parts sit, for either stage shape. */
function layout(s: Scene) {
  const x = (d: number) => s.w / 2 + d * s.u;
  return {
    yc: s.h * 0.2,
    xL: x(-50),
    xR: x(50),
    xf: x(-30),
    xp: x(-3),
    xo: x(33),
    fy: s.h * 0.48,
    ig: s.h * 0.38,
    gy: s.h * 0.58,
    th: s.h * 0.4,
    oy: s.h * 0.6,
    hy: s.h * 0.82,
    bus: s.h * 0.9,
    x,
  };
}

/** A small operator node on a wire: × or +. */
function op(s: Scene, x: number, y: number, t: string): void {
  s.circle(x, y, 2.8 * s.u, { fill: s.c('--card'), stroke: s.tint('slate', 0.9), lw: 0.35 });
  s.text(t, x, y + 0.2 * s.u, { size: 3.4, font: 'mono', weight: 700, color: s.c('--ink-2') });
}

/** A gate (or the candidate) as a labelled circle, lit by `on`. */
function gate(s: Scene, x: number, y: number, t: string, k: Color, on: number): void {
  s.circle(x, y, 4.4 * s.u, { fill: s.tint(k, 0.14 + 0.3 * on), stroke: s.tint(k, 0.7 + 0.3 * on), lw: 0.35 + 0.2 * on });
  s.text(t, x, y + 0.2 * s.u, { size: 3.6, font: 'mono', weight: 700, color: s.c(k) });
}

interface Vals {
  c0?: string;
  f?: string;
  fc?: string;
  i?: string;
  g?: string;
  ig?: string;
  c?: string;
  tc?: string;
  o?: string;
  h?: string;
}

/** The LSTM cell: the cell wire along the top, gates below, the output branch on the right. */
function diagram(s: Scene, o: { on?: Partial<Record<'f' | 'i' | 'g' | 'o' | 'cell', number>>; vals?: Vals; va?: Partial<Record<keyof Vals, number>> } = {}): void {
  const L = layout(s);
  const on = o.on ?? {};
  const wire = s.tint('gold', 0.55 + 0.45 * (on.cell ?? 0));
  const lw = 0.5 + 0.3 * (on.cell ?? 0);
  // The cell wire.
  s.line(L.xL, L.yc, L.xf - 2.8 * s.u, L.yc, wire, lw);
  s.line(L.xf + 2.8 * s.u, L.yc, L.xp - 2.8 * s.u, L.yc, wire, lw);
  s.arrow(L.xp + 2.8 * s.u, L.yc, L.xR, L.yc, wire, lw, 2.2);
  s.text('cₜ₋₁', L.xL, L.yc - 4.5 * s.u, { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c('gold') });
  s.text('cₜ', L.xR, L.yc - 4.5 * s.u, { size: 3.2, font: 'mono', weight: 650, align: 'right', color: s.c('gold') });
  // Inputs: the old h and this token, fed to every gate from below.
  const ink = s.tint('slate', 0.6);
  const ox = L.xo + 11 * s.u;
  s.line(L.xf, L.bus, ox, L.bus, ink, 0.35);
  s.text('hₜ₋₁, xₜ', L.xf - 3 * s.u, L.bus, { size: 3, font: 'mono', align: 'right', color: s.c('--ink-2') });
  s.arrow(L.xf, L.bus, L.xf, L.fy + 4.4 * s.u, ink, 0.35, 1.6);
  s.arrow(L.xp - 10 * s.u, L.bus, L.xp - 10 * s.u, L.gy + 4.4 * s.u, ink, 0.35, 1.6);
  s.arrow(L.xp + 10 * s.u, L.bus, L.xp + 10 * s.u, L.gy + 4.4 * s.u, ink, 0.35, 1.6);
  s.arrow(ox, L.bus, ox, L.oy + 4.4 * s.u, ink, 0.35, 1.6);
  // Forget: f scales the old cell.
  s.arrow(L.xf, L.fy - 4.4 * s.u, L.xf, L.yc + 2.8 * s.u, s.tint('red', 0.8), 0.4, 1.8);
  op(s, L.xf, L.yc, '×');
  gate(s, L.xf, L.fy, 'f', 'red', on.f ?? 0);
  // Write: i times g, added to the cell.
  s.arrow(L.xp - 10 * s.u, L.gy - 4.4 * s.u, L.xp - 2.2 * s.u, L.ig + 2.2 * s.u, s.tint('green', 0.8), 0.4, 1.6);
  s.arrow(L.xp + 10 * s.u, L.gy - 4.4 * s.u, L.xp + 2.2 * s.u, L.ig + 2.2 * s.u, s.tint('purple', 0.8), 0.4, 1.6);
  s.arrow(L.xp, L.ig - 2.8 * s.u, L.xp, L.yc + 2.8 * s.u, s.tint('green', 0.8), 0.4, 1.8);
  op(s, L.xp, L.ig, '×');
  op(s, L.xp, L.yc, '+');
  gate(s, L.xp - 10 * s.u, L.gy, 'i', 'green', on.i ?? 0);
  gate(s, L.xp + 10 * s.u, L.gy, 'g', 'purple', on.g ?? 0);
  // Show: o times tanh of the new cell gives h.
  s.arrow(L.xo, L.yc, L.xo, L.th - 3.5 * s.u, s.tint('gold', 0.7), 0.4, 1.8);
  s.rrect(L.xo - 6 * s.u, L.th - 3.5 * s.u, 12 * s.u, 7 * s.u, 1.4, { fill: s.c('--card'), stroke: s.tint('slate', 0.9), lw: 0.35 });
  s.text('tanh', L.xo, L.th + 0.2 * s.u, { size: 2.9, font: 'mono', color: s.c('--ink-2') });
  s.arrow(L.xo, L.th + 3.5 * s.u, L.xo, L.oy - 2.8 * s.u, s.tint('slate', 0.8), 0.4, 1.6);
  s.arrow(ox - 4.4 * s.u, L.oy, L.xo + 2.8 * s.u, L.oy, s.tint('blue', 0.8), 0.4, 1.6);
  op(s, L.xo, L.oy, '×');
  gate(s, ox, L.oy, 'o', 'blue', on.o ?? 0);
  s.arrow(L.xo, L.oy + 2.8 * s.u, L.xo, L.hy - 3 * s.u, s.tint('gold', 0.8), 0.45, 1.8);
  s.text('hₜ', L.xo, L.hy, { size: 3.4, font: 'mono', weight: 700, color: s.c('gold') });
  // Values, when the step is worked in numbers.
  const v = o.vals ?? {};
  const va = o.va ?? {};
  const num = (key: keyof Vals, x: number, y: number, k: Color | `--${string}`, align: CanvasTextAlign = 'center') => {
    const t = v[key];
    if (t) s.alpha(va[key] ?? 1, () => s.text(t, x, y, { size: 3.2, font: 'mono', weight: 650, align, color: s.c(k), halo: true }));
  };
  num('c0', L.xL, L.yc + 4.5 * s.u, 'gold', 'left');
  num('fc', (L.xf + L.xp) / 2, L.yc - 4 * s.u, 'gold');
  num('f', L.xf - 6 * s.u, L.fy, 'red', 'right');
  num('i', L.xp - 15.5 * s.u, L.gy, 'green', 'right');
  num('g', L.xp + 15.5 * s.u, L.gy, 'purple', 'left');
  num('ig', L.xp + 4 * s.u, L.ig, '--ink-2', 'left');
  num('c', L.xR, L.yc + 4.5 * s.u, 'gold', 'right');
  num('tc', L.xo - 7.5 * s.u, L.th, '--ink-2', 'right');
  num('o', ox, L.oy - 7 * s.u, 'blue');
  num('h', L.xo + 4 * s.u, L.hy, 'gold', 'left');
}

const gates: SceneDef = {
  draw(s) {
    const L = layout(s);
    const g = s.win('gates', 'roles');
    diagram(s, { on: { cell: s.win('cell', 'gates'), f: g, i: g, o: g, g: s.win('cand', 'roles') } });
    const note = { size: 2.8, font: 'mono', color: s.c('--ink-3') } as const;
    s.alpha(s.win('gates', 'roles'), () => {
      s.text('σ: 0 to 1', L.xf - 6 * s.u, L.fy + 6.5 * s.u, { ...note, align: 'right' });
      s.text('σ', L.xp - 15.5 * s.u, L.gy, { ...note, align: 'right' });
      s.text('σ', L.xo + 11 * s.u, L.oy - 7 * s.u, note);
    });
    s.alpha(s.win('cand', 'roles'), () => s.text('−1 to 1', L.xp + 15.5 * s.u, L.gy, { ...note, align: 'left' }));
    s.alpha(s.ease('roles', 0.6), () => {
      const o = { size: 3, font: 'mono', weight: 650, halo: true } as const;
      s.text('keep', L.xf - 6 * s.u, L.fy, { ...o, align: 'right', color: s.c('red') });
      s.text('write', L.xp - 15.5 * s.u, L.gy, { ...o, align: 'right', color: s.c('green') });
      s.text('content', L.xp + 15.5 * s.u, L.gy, { ...o, align: 'left', color: s.c('purple') });
      s.text('show', L.xo + 11 * s.u, L.oy - 7 * s.u, { ...o, color: s.c('blue') });
    });
  },
};

const update: SceneDef = {
  draw(s) {
    const k = s.ease('keep', 0.6);
    const w = s.ease('write', 0.6);
    const a = s.ease('add', 0.6);
    const sh = s.ease('show', 0.6);
    diagram(s, {
      on: { f: s.win('keep', 'write'), i: s.win('write', 'add'), g: s.win('write', 'add'), o: s.win('show', undefined), cell: s.win('add', 'show') },
      vals: { c0: '2', f: '0.3', fc: '0.6', i: '0.8', g: '0.5', ig: '0.4', c: '1.0', tc: '0.76', o: '0.5', h: '0.38' },
      va: { c0: 1, f: k, fc: s.ease('keep', 0.6, 1.5), i: w, g: w, ig: s.ease('write', 0.6, 1.5), c: a, tc: sh, o: sh, h: s.ease('show', 0.6, 2) },
    });
    const line = { size: 3.2, font: 'mono' } as const;
    s.alpha(s.ease('add', 0.6, 1) * (1 - s.ease('show', 0.5)), () => s.text('cₜ = 0.3 × 2 + 0.8 × 0.5 = 1.0', s.w / 2, s.h * 0.06, { ...line, color: s.c('gold') }));
    s.alpha(s.ease('show', 0.6, 2.5), () => s.text('hₜ = 0.5 × tanh(1.0) ≈ 0.38', s.w / 2, s.h * 0.06, { ...line, color: s.c('gold') }));
  },
};

const path: SceneDef = {
  draw(s) {
    // The cell highway: each step back multiplies by f.
    const xs = [-44, -22, 0, 22, 44].map((d) => s.w / 2 + d * s.u);
    const y = s.h * 0.14;
    xs.forEach((x, i) => {
      s.circle(x, y, 4 * s.u, { fill: s.tint('gold', 0.14), stroke: s.tint('gold', 0.8), lw: 0.35 });
      s.text(`c${'₀₁₂₃₄'[i]}`, x, y + 0.2 * s.u, { size: 3, font: 'mono', weight: 650, color: s.c('gold') });
    });
    for (let i = 0; i < 4; i++) {
      s.arrow(xs[i]! + 4 * s.u, y, xs[i + 1]! - 4 * s.u, y, s.tint('gold', 0.7), 0.4, 1.6);
      s.alpha(s.ease('path', 0.5, 1 + 0.5 * (3 - i)), () => {
        s.arrow(xs[i + 1]! - 4 * s.u, y + 7 * s.u, xs[i]! + 4 * s.u, y + 7 * s.u, s.c('red'), 0.4, 1.8);
        s.text('× f', (xs[i]! + xs[i + 1]!) / 2, y + 10.5 * s.u, { size: 2.8, font: 'mono', weight: 650, color: s.c('red') });
      });
    }
    // Gradient kept after k steps back: f^k for the cell, 0.5^k for a plain RNN.
    const L = s.w / 2 - 36 * s.u;
    const R = s.w / 2 + 40 * s.u;
    const T = s.h * 0.4;
    const B = s.h * 0.86;
    const X = (k: number) => L + ((R - L) * k) / 20;
    const Y = (v: number) => B - (B - T) * v;
    s.alpha(s.ease('lstm', 0.6), () => {
      s.line(L, T, L, B, s.c('--axis'), 0.35);
      s.line(L, B, R, B, s.c('--axis'), 0.35);
      const tick = { size: 2.8, font: 'mono', color: s.c('--ink-3') } as const;
      s.text('1', L - 1.5 * s.u, Y(1), { ...tick, align: 'right' });
      s.text('0', L - 1.5 * s.u, Y(0), { ...tick, align: 'right' });
      s.text('20 steps back', R, B + 4 * s.u, { ...tick, align: 'right' });
    });
    const curve = (a: number, k: 'gold' | 'blue', upto: number) => {
      const n = Math.floor(upto * 20);
      for (let i = 0; i < n; i++) s.line(X(i), Y(a ** i), X(i + 1), Y(a ** (i + 1)), s.c(k), 0.55);
      for (let i = 0; i <= n; i++) s.circle(X(i), Y(a ** i), 0.75 * s.u, { fill: s.c(k) });
    };
    s.alpha(s.ease('lstm', 0.6, 0.6), () => {
      curve(0.95, 'gold', s.ease('lstm', 2, 0.6));
      s.alpha(s.ease('lstm', 0.6, 2.8), () => s.text('cell, f = 0.95: 0.36', X(20), Y(0.36) + 6 * s.u, { size: 3, font: 'mono', weight: 650, align: 'right', color: s.c('gold'), halo: true }));
    });
    s.alpha(s.ease('rnn', 0.6), () => {
      curve(0.5, 'blue', s.ease('rnn', 2, 0.4));
      s.alpha(s.ease('rnn', 0.6, 2.6), () => s.text('plain RNN, × 0.5: 0.000001', X(20), Y(0) - 4 * s.u, { size: 3, font: 'mono', weight: 650, align: 'right', color: s.c('blue'), halo: true }));
    });
  },
};

export const scenes: Record<string, SceneDef> = { gates, update, path };
