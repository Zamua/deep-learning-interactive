import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp, smooth } from '../../../lecture/scene';
import { after, band, beside, gate, mono, name, type P, pulse, runAfter, wire } from '../draw';

const R = 7;
const SIZE = 4.2;
const XI: P = [0, 0.3];
const ZI: P = [0, 0.72];
const G: P = [0.33, 0.51];
const Q: P = [0.62, 0.51];
/** The rest of the graph, a box between q and the final output f. */
const BOX: P = [0.8, 0.51];
const F: P = [1, 0.51];

function pts(s: Scene) {
  const at = band(s, 104, 12);
  const [l] = at([0, 0]);
  const [r] = at([1, 0]);
  return { x: at(XI), z: at(ZI), g: at(G), q: at(Q), box: at(BOX), f: at(F), bw: Math.min(0.13 * (r - l), 14 * s.u) };
}

/** Where a label sits by input k's wire: `t` along it, above (1) or below (-1). */
function spot(s: Scene, k: 0 | 1, t: number, side: 1 | -1): [number, number] {
  const p = pts(s);
  const [x0, y0] = k === 0 ? p.x : p.z;
  return beside(s, x0, y0, p.g[0], p.g[1], t, side, SIZE, 0, R);
}

/** The spot above the q wire where q's value sits. */
function qSpot(s: Scene): [number, number] {
  const p = pts(s);
  return beside(s, p.g[0], p.g[1], p.q[0], p.q[1], 0.55, 1, SIZE, R, 0);
}

const goldText = (s: Scene, text: string, at: [number, number], size = SIZE) => s.text(text, at[0], at[1], { size, font: 'mono', weight: 650, color: s.c('gold'), halo: true });

interface Nudge {
  /** The nudged values of x, z and q (null keeps the forward value), and how far f moves. */
  vals: [string | null, string | null, string | null];
  df: string;
  a: number;
}

interface Gate {
  glyph: string;
  /** Forward values of x, z and q. */
  vals: [string, string, string];
  va: number;
  /** The rest of the graph and f. */
  rest: number;
  /** The gradient from above, its label and its pulse back from f. */
  ua: number;
  ut: number;
  /** Local slopes beside each input wire, in gold. */
  local: [string, string];
  la: [number, number];
  /** Gradients sent back to x and z, with their pulses; `ask` shows a question mark until then. */
  grads: [string, string];
  ga: [number, number];
  gt: [number, number];
  ask?: [number, number];
  on: number;
  hot?: [number, number];
  nudges?: Nudge[];
}

function drawGate(s: Scene, c: Gate): void {
  const p = pts(s);
  const [gx, gy] = p.g;
  const hot = c.hot ?? [0, 0];
  const ask = c.ask ?? [0, 0];
  const nudges = c.nudges ?? [];
  // A nudged value replaces the forward one where it sits.
  const moved = (i: number) => Math.min(1, nudges.reduce((t, n) => t + (n.vals[i] !== null ? n.a : 0), 0));
  const va = (i: number) => c.va * (1 - moved(i));
  name(s, ...p.x, 'x', 'orange', 'in', 5.4);
  name(s, ...p.z, 'z', '--ink-2', 'in', 5.4);
  const grad = (k: 0 | 1) => (ask[k] > 0.003 && c.ga[k] < 0.5 ? '?' : c.grads[k]);
  const ga = (k: 0 | 1) => (ask[k] > 0.003 && c.ga[k] < 0.5 ? ask[k] * (1 - 2 * c.ga[k]) : c.ga[k]);
  wire(s, ...p.x, gx, gy, { r1: R, val: c.vals[0], va: va(0), grad: grad(0), ga: ga(0), t: 0.4, size: SIZE, hot: hot[0] });
  wire(s, ...p.z, gx, gy, { r1: R, val: c.vals[1], va: va(1), grad: grad(1), ga: ga(1), t: 0.4, size: SIZE, hot: hot[1] });
  wire(s, gx, gy, ...p.q, { r0: R, val: c.vals[2], va: va(2), grad: '2', ga: c.ua, t: 0.55, size: SIZE });
  name(s, ...p.q, 'q', '--ink-2', 'out', 5.4);
  gate(s, gx, gy, c.glyph, '--ink-2', c.on, R);
  // The rest of the graph, through to its final output f.
  s.alpha(c.rest, () => {
    const [bx, by] = p.box;
    const hw = p.bw / 2;
    s.arrow(p.q[0] + 6 * s.u, p.q[1], bx - hw - 0.6 * s.u, by, s.c('--ink-3'), 0.35, 2.2);
    s.rrect(bx - hw, by - 5 * s.u, 2 * hw, 10 * s.u, 1.6, { fill: s.tint('--ink-3', 0.08), stroke: s.c('--ink-3'), lw: 0.3 });
    s.text('⋯', bx, by, { size: 4.4, font: 'mono', weight: 700, color: s.c('--ink-2') });
    s.text('rest of graph', bx, by + 8.5 * s.u, { size: 2.9, italic: true, color: s.c('--ink-3'), halo: true });
    s.arrow(bx + hw, by, p.f[0] - 0.6 * s.u, p.f[1], s.c('--ink-3'), 0.35, 2.2);
    name(s, ...p.f, 'f', 'purple', 'out', 5.4);
  });
  // A nudge: the moved values in gold where the forward ones were, and f's move above f.
  for (const n of nudges) {
    s.alpha(n.a, () => {
      if (n.vals[0] !== null) goldText(s, n.vals[0], spot(s, 0, 0.4, 1));
      if (n.vals[1] !== null) goldText(s, n.vals[1], spot(s, 1, 0.4, 1));
      if (n.vals[2] !== null) goldText(s, n.vals[2], qSpot(s));
      goldText(s, n.df, [p.f[0] + 2.4 * s.u, p.f[1] - 7 * s.u], SIZE * 0.9);
    });
  }
  s.alpha(c.la[0], () => goldText(s, c.local[0], spot(s, 0, 0.84, 1)));
  s.alpha(c.la[1], () => goldText(s, c.local[1], spot(s, 1, 0.84, -1)));
  pulse(s, p.box[0] - p.bw / 2, p.box[1], gx + R * s.u, gy, c.ut, 'red');
  pulse(s, gx, gy, ...p.x, c.gt[0], 'red');
  pulse(s, gx, gy, ...p.z, c.gt[1], 'red');
}

/** Two lines under the graph. */
function lines(s: Scene, text: [string, string], a: [number, number], k: ['red' | 'gold' | '--ink-2', 'red' | 'gold' | '--ink-2'] = ['red', 'red']): void {
  text.forEach((t, i) => s.alpha(a[i]!, () => mono(s, t, s.w / 2, s.h * (0.85 + 0.075 * i), k[i]!, 3.7, 'center', 600)));
}

/** The gradient's direction: back from f toward the inputs, from upstream. */
function upstream(s: Scene, a: number): void {
  const p = pts(s);
  const y = p.q[1] - 13 * s.u;
  s.alpha(a, () => {
    s.arrow(p.f[0] + 2 * s.u, y, p.g[0] + R * s.u, y, s.tint('red', 0.8), 0.4, 2.4);
    s.text('upstream', p.f[0] + 3 * s.u, y - 3.6 * s.u, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c('red'), halo: true });
  });
}

const add: SceneDef = {
  marks: { f: { tex: String.raw`q = \symx + z`, x: 0.5, y: 0.1, size: 5.6 } },
  draw(s) {
    s.show('f', s.ease('gate', 0.6));
    drawGate(s, {
      glyph: '+',
      vals: ['3', '−4', '−1'],
      va: after(s, 'gate', 0.2),
      rest: after(s, 'gate', 0.55),
      ua: after(s, 'up', 0.15),
      ut: runAfter(s, 'up', 0.05),
      local: ['×1', '×1'],
      la: [after(s, 'nudge', 0.55), after(s, 'copy', 0.2)],
      grads: ['2', '2'],
      ga: [after(s, 'dx', 0.5), after(s, 'copy', 0.6)],
      gt: [runAfter(s, 'dx', 0.4), runAfter(s, 'copy', 0.5)],
      ask: [s.ease('problem', 0.6, 1.5), s.ease('problem', 0.6, 1.5)],
      on: Math.max(s.win('name', 'above'), s.ease('nudge', 0.6)),
      nudges: [
        { vals: [null, null, '−0.99'], df: '+0.02', a: s.win('above', 'up') },
        { vals: ['3.01', null, '−0.99'], df: '+0.02', a: s.win('nudge', 'dx') },
        { vals: [null, '−3.99', '−0.99'], df: '+0.02', a: s.win('copy') * (1 - after(s, 'copy', 0.55)) },
      ],
    });
    upstream(s, s.win('upstream', 'nudge'));
    s.alpha(s.win('problem', 'gate'), () => mono(s, 'two inputs: how much goes to each?', s.w / 2, s.h * 0.85, '--ink-2', 3.6));
    s.alpha(s.win('name', 'above'), () => mono(s, 'a gate: inputs in, one output out', s.w / 2, s.h * 0.85, '--ink-2', 3.6));
    lines(s, ['q + 0.01  →  f + 0.02', ''], [s.win('above', 'up'), 0], ['gold', 'gold']);
    lines(s, ['∂f/∂q = 0.02 / 0.01 = 2', ''], [s.win('up', 'nudge'), 0]);
    lines(s, ['x + 0.01  →  q + 0.01: slope 1', ''], [s.win('nudge', 'dx'), 0], ['gold', 'gold']);
    lines(s, ['∂f/∂x = 1 × 2 = 2', '∂f/∂z = 1 × 2 = 2'], [s.ease('dx', 0.6, 0.3), after(s, 'copy', 0.7)]);
  },
};

/** A value gliding from one wire to another as `t` goes 0 to 1. */
function fly(s: Scene, text: string, from: [number, number], to: [number, number], t: number): void {
  if (t <= 0 || t >= 1) return;
  const e = smooth(t);
  goldText(s, text, [lerp(from[0], to[0], e), lerp(from[1], to[1], e)]);
}

const mul: SceneDef = {
  marks: { f: { tex: String.raw`q = \symx \cdot z`, x: 0.5, y: 0.1, size: 5.6 } },
  draw(s) {
    s.show('f', 1);
    const fx = runAfter(s, 'nudge', 0.7, 1.2);
    const fz = runAfter(s, 'dz', 0.35, 1.2);
    drawGate(s, {
      glyph: '×',
      vals: ['3', '−4', '−12'],
      va: after(s, 'gate', 0.45),
      rest: 1,
      ua: after(s, 'gate', 0.72),
      ut: runAfter(s, 'gate', 0.55),
      local: ['×(−4)', '×3'],
      la: [fx >= 1 ? 1 : 0, fz >= 1 ? 1 : 0],
      grads: ['−8', '6'],
      ga: [after(s, 'dx', 0.5), after(s, 'dz', 0.8)],
      gt: [runAfter(s, 'dx', 0.3), runAfter(s, 'dz', 0.65)],
      ask: [1, 1],
      on: s.win('nudge'),
      nudges: [
        { vals: ['3.01', null, '−12.04'], df: '−0.08', a: s.ease('nudge', 0.6, 0.6) * (1 - s.ease('dx', 0.6, 0.8)) },
        { vals: [null, '−3.99', '−11.97'], df: '+0.06', a: s.ease('dz', 0.6, 0.3) * (1 - after(s, 'dz', 0.6)) },
      ],
    });
    fly(s, '−4', spot(s, 1, 0.4, 1), spot(s, 0, 0.84, 1), fx);
    fly(s, '3', spot(s, 0, 0.4, 1), spot(s, 1, 0.84, -1), fz);
    lines(s, ['3.01 × (−4) = −12.04', ''], [s.win('nudge', 'dx'), 0], ['gold', 'gold']);
    lines(s, ['∂f/∂x = z × 2 = −8', '∂f/∂z = x × 2 = 6'], [s.ease('dx', 0.6, 0.3), after(s, 'dz', 0.85)]);
  },
};

const RULES: [string, string][] = [
  ['+', 'copies'],
  ['×', 'swaps'],
  ['max', 'routes'],
];

const max: SceneDef = {
  marks: { f: { tex: String.raw`q = \max(\symx, z)`, x: 0.5, y: 0.1, size: 5.6 } },
  draw(s) {
    s.show('f', 1);
    drawGate(s, {
      glyph: 'max',
      vals: ['3', '5', '5'],
      va: after(s, 'gate', 0.3),
      rest: 1,
      ua: after(s, 'gate', 0.55),
      ut: runAfter(s, 'gate', 0.4),
      local: ['×0', '×1'],
      la: [after(s, 'x', 0.55), after(s, 'z', 0.45)],
      grads: ['0', '2'],
      ga: [after(s, 'x', 0.85), after(s, 'z', 0.8)],
      gt: [0, runAfter(s, 'z', 0.65)],
      ask: [1, 1],
      on: s.win('x', 'router'),
      hot: [0, after(s, 'gate', 0.75)],
      nudges: [
        { vals: ['3.01', null, '5'], df: '+0', a: s.ease('x', 0.6, 0.6) * (1 - s.ease('z', 0.5)) },
        { vals: [null, '5.01', '5.01'], df: '+0.02', a: s.ease('z', 0.6, 0.6) * (1 - s.ease('router', 0.5)) },
      ],
    });
    const eq = 1 - s.ease('router', 0.5);
    lines(s, ['∂f/∂x = 0 × 2 = 0', '∂f/∂z = 1 × 2 = 2'], [after(s, 'x', 0.85) * eq, after(s, 'z', 0.8) * eq]);
    const gap = s.tall ? 30 : 34;
    RULES.forEach(([g, verb], i) => {
      s.alpha(after(s, 'router', 0.1 + 0.15 * i), () => {
        const x = s.w / 2 + (i - 1) * gap * s.u - 5 * s.u;
        const y = s.h * 0.89;
        gate(s, x, y, g, 'teal', 0.4, 4);
        s.text(verb, x + 5.6 * s.u, y, { size: 3.6, font: 'mono', weight: 600, align: 'left', color: s.c('teal') });
      });
    });
  },
};

export const scenes: Record<string, SceneDef> = { add, mul, max };
