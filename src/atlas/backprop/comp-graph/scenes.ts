import type { Scene, SceneDef } from '../../../lecture/scene';
import { clamp01 } from '../../../lecture/scene';
import type { Ink } from '../../../lecture/scene';
import { after, cite } from '../../draw';
import { band, gate, mono, name, neuron, NEURON, type P, pulse, wire } from '../draw';

const R = 5;
const { x: X_IN, z: Z_IN, c: C_IN, mul: MUL, add: ADD, sq: SQ, out: OUT } = NEURON;

/** Where a forward pulse is along a wire, from `start` seconds into beat `id`. */
const travel = (s: Scene, id: string, start = 0, dur = 0.9) => clamp01((s.since(id) - start) / dur);

const FORMULA = { tex: String.raw`f = (\symx z + c)^{2}`, x: 0.5, y: 0.11, size: 5.6 };

// ---- the chain from the chain rule, then a formula whose paths join, taken apart into steps

/** Across the band: the input, the two links and the output's end. */
const C_FX = [0, 0.36, 0.68, 0.96];
const STEPS = [String.raw`q = \symx \cdot z`, String.raw`r = q + c`, String.raw`f = r^{2}`];
const STEP_Y = [0.62, 0.72, 0.82];
const STEP_X = 0.46;

const steps: SceneDef = {
  marks: {
    f: { ...FORMULA, y: 0.47 },
    ...Object.fromEntries(STEPS.map((t, i) => [`s${i}`, { tex: t, x: STEP_X, y: STEP_Y[i]!, size: 5, align: 'left' as const }])),
  },
  draw(s) {
    const at = band(s, 110);
    // Centered while it is the whole story, then lifted to make room.
    const cy = 0.42 - 0.18 * s.ease('more', 0.8);
    const [[xx, xy], [ax, ay], [bx, by], [ox, oy]] = C_FX.map((fx) => at([fx, cy]));
    const dim = 1 - 0.6 * s.ease('more', 0.6);
    const grow = [s.ease('chain', 0.5), s.ease('chain', 0.6, 1.2), s.ease('chain', 0.6, 3.6)];
    s.alpha(dim, () => {
      s.alpha(grow[0]!, () => name(s, xx, xy, 'x', 'orange'));
      s.alpha(grow[1]!, () => {
        wire(s, xx, xy, ax, ay, { r1: R });
        gate(s, ax, ay, '3x+1', '--ink-2', 1 - after(s, 'chain', 0.6));
      });
      s.alpha(grow[2]!, () => {
        wire(s, ax, ay, bx, by, { r0: R, r1: R, note: 'u', na: 1 });
        gate(s, bx, by, 'u²', '--ink-2', after(s, 'chain', 0.6) * (1 - s.ease('more', 0.6)));
        wire(s, bx, by, ox, oy, { r0: R });
      });
    });
    pulse(s, xx, xy, ax, ay, travel(s, 'chain', 1.8), 'orange');
    pulse(s, ax, ay, bx, by, travel(s, 'chain', 4.2), 'orange');
    s.alpha(s.win('chain', 'more') * after(s, 'chain', 0.7), () => mono(s, 'one input, one path', s.w / 2, s.h * (cy + 0.14), '--ink-2', 3.4));

    s.show('f', s.ease('more', 0.6));
    s.alpha(s.win('more', 'list'), () => mono(s, 'three inputs, and their paths join', s.w / 2, s.h * 0.57, '--ink-2', 3.4));
    cite(s, 'R. E. Wengert, General Electric, 1964', s.ease('wengert', 0.6));
    s.alpha(s.win('wengert', 'list'), () => mono(s, 'a series of elementary steps', s.w / 2, s.h * 0.67, 'teal', 3.6));

    STEPS.forEach((_, i) => {
      const a = after(s, 'list', 0.12 + 0.28 * i);
      s.show(`s${i}`, a);
      s.alpha(a, () => s.text(`step ${i + 1}`, s.w * STEP_X - 4 * s.u, s.h * STEP_Y[i]!, { size: 3.2, font: 'mono', align: 'right', color: s.c('--ink-3') }));
    });
    s.alpha(s.ease('why', 0.6, 0.4), () => mono(s, 'one simple step at a time', s.w / 2, s.h * 0.92, 'teal', 3.6));
  },
};

// ---- the same steps drawn as nodes and wires

const graph: SceneDef = {
  marks: { f: FORMULA },
  draw(s) {
    s.show('f', 1);
    const all = s.win('count', 'ends');
    neuron(s, {
      show: [s.ease('mul', 0.6), s.ease('add', 0.6), s.ease('sq', 0.6)],
      on: [Math.max(s.win('mul', 'add'), all), Math.max(s.win('add', 'sq'), all), Math.max(s.win('sq', 'name'), all)],
      names: 1,
    });
    const at = band(s, 110);
    // The inputs wait on the left before the first node arrives.
    s.alpha(1 - s.ease('mul', 0.6), () => {
      name(s, ...at(X_IN), 'x', 'orange');
      name(s, ...at(Z_IN), 'z', '--ink-2');
    });
    s.alpha(1 - s.ease('add', 0.6), () => name(s, ...at(C_IN), 'c', '--ink-2'));
    const cy = s.h * 0.88;
    s.alpha(s.win('mul', 'add') * after(s, 'mul', 0.3), () => mono(s, 'a node: one operation', s.w / 2, cy, '--ink-2', 3.6));
    s.alpha(s.win('name', 'count'), () => mono(s, 'nodes + wires: a graph, not a plot', s.w / 2, cy, '--ink-2', 3.6));
    s.alpha(all, () => mono(s, '3 operations, 3 nodes', s.w / 2, cy, 'teal', 3.6));

    // Where values come in and where the result goes out: not nodes.
    const ends = s.ease('ends', 0.6);
    s.alpha(ends, () => {
      const box = (x: number, y: number) => s.rrect(x - 3.6 * s.u, y - 3.8 * s.u, 7.2 * s.u, 7.6 * s.u, 1.6, { fill: s.tint('gold', 0.12), stroke: s.tint('gold', 0.8), lw: 0.35 });
      [X_IN, Z_IN, C_IN].forEach((p) => {
        const [x, y] = at(p);
        box(x - 3.2 * s.u, y);
      });
      const [ox, oy] = at(OUT);
      box(ox + 3.4 * s.u, oy);
      mono(s, 'inputs and output: not nodes', s.w / 2, cy, 'gold', 3.6);
    });
  },
};

// ---- the forward pass: values flow from the inputs to the output, then again with a new x

const FIRST = ['2', '3', '−4', '6', '2', '4'];
const SECOND = ['3', '3', '−4', '9', '5', '25'];

const forward: SceneDef = {
  marks: { f: FORMULA },
  draw(s) {
    s.show('f', 1);
    const at = band(s, 110);
    const order = [s.ease('ready', 0.5, 0.3), s.ease('ready', 0.5, 1.6), s.ease('ready', 0.5, 2.9)];
    // The second run: each wire takes its new value as the pulse reaches it.
    const reach = [travel(s, 'again', 0.4), 0, 0, travel(s, 'again', 1.6), travel(s, 'again', 2.8), travel(s, 'again', 4.0)];
    const vals = FIRST.map((v, i) => (reach[i]! >= 1 ? SECOND[i]! : v));
    const fresh = reach.map((r) => (r >= 1 ? 1 : 0));
    neuron(s, {
      show: [1, 1, 1],
      on: [s.win('mul', 'add'), s.win('add', 'sq'), s.win('sq', 'ready')].map((v, i) => Math.max(v, order[i]! * 0.6 * (1 - s.ease('again', 0.5)))),
      vals,
      va: [s.ease('inputs', 0.5, 0.8), s.ease('inputs', 0.5, 1.4), s.ease('inputs', 0.5, 2.2), s.ease('mul', 0.5, 1.1), s.ease('add', 0.5, 0.9), s.ease('sq', 0.5, 0.9)],
      hot: [fresh[0]!, 0, s.win('add', 'sq'), Math.max(s.win('add', 'sq'), fresh[3]!), fresh[4]!, fresh[5]!],
      names: 0.8,
    });
    s.slot('xv', vals[0]!);
    s.slot('qv', vals[3]!);
    s.slot('rv', vals[4]!);
    s.slot('fv', vals[5]!);
    const k: Ink = 'orange';
    const [mx, my] = at(MUL);
    const [ax, ay] = at(ADD);
    const [sx, sy] = at(SQ);
    const [ox, oy] = at(OUT);
    pulse(s, ...at(X_IN), mx, my, travel(s, 'mul'), k);
    pulse(s, ...at(Z_IN), mx, my, travel(s, 'mul'), k);
    pulse(s, mx, my, ax, ay, travel(s, 'add'), k);
    pulse(s, ...at(C_IN), ax, ay, travel(s, 'add'), k);
    pulse(s, ax, ay, sx, sy, travel(s, 'sq'), k);
    pulse(s, sx, sy, ox, oy, travel(s, 'sq', 0.5, 0.6), k);
    // The order the nodes run in.
    const badges = 1 - s.ease('again', 0.5);
    [MUL, ADD, SQ].forEach((p, i) => {
      s.alpha(order[i]! * badges, () => {
        const [x, y] = at(p);
        const by = y - (R + 3.4) * s.u;
        s.circle(x, by, 2.4 * s.u, { fill: s.c('gold'), stroke: s.c('--card'), lw: 0.3 });
        s.text(String(i + 1), x, by + 0.15 * s.u, { size: 3, font: 'mono', weight: 700, color: s.c('--card') });
      });
    });
    const cy = s.h * 0.88;
    s.alpha(s.win('add', 'sq') * after(s, 'add', 0.45), () => mono(s, 'the add sees only q and c', s.w / 2, cy, '--ink-2', 3.6));
    s.alpha(s.win('ready', 'pass'), () => mono(s, 'a node runs once its inputs arrive', s.w / 2, cy, 'gold', 3.6));
    s.alpha(s.win('pass', 'again'), () => mono(s, 'the forward pass: inputs → output', s.w / 2, cy, 'orange', 3.6));
    s.alpha(s.ease('again', 0.6, 4.8), () => mono(s, 'x = 3:  f = 25', s.w / 2, cy, 'orange', 3.8));
    // The second run's pulses, along the path that depends on x.
    pulse(s, ...at(X_IN), mx, my, travel(s, 'again', 0.4, 1.1), k);
    pulse(s, mx, my, ax, ay, travel(s, 'again', 1.6, 1.1), k);
    pulse(s, ax, ay, sx, sy, travel(s, 'again', 2.8, 1.1), k);
    pulse(s, sx, sy, ox, oy, travel(s, 'again', 4.0, 0.8), k);
  },
};

// ---- f = e^max(x, z) * z: two more kinds of node, and z feeding two of them

const X2: P = [0, 0.34];
const Z2: P = [0, 0.7];
const MAX2: P = [0.3, 0.45];
const EXP2: P = [0.56, 0.45];
const MUL2: P = [0.76, 0.58];
const OUT2: P = [1, 0.58];

const PIECES: [string, string][] = [
  ['+', 'add'],
  ['×', 'multiply'],
  ['max', 'max'],
  ['eˣ', 'exp'],
  ['x²', 'square'],
];

const more: SceneDef = {
  marks: {
    f: { tex: String.raw`f = e^{\max(\symx,\, z)} \cdot z`, x: 0.5, y: 0.11, size: 5.6 },
  },
  draw(s) {
    const at = band(s, 110);
    const [xx, xy] = at(X2);
    const [zx, zy] = at(Z2);
    const [mx, my] = at(MAX2);
    const [ex, ey] = at(EXP2);
    const [px, py] = at(MUL2);
    const [ox, oy] = at(OUT2);
    const a = s.ease('max', 0.6);
    s.show('f', a);
    const vin = s.ease('max', 0.5, 1.2);
    const vmax = s.ease('max', 0.5, 3.4);
    const vexp = s.ease('exp', 0.5, 1.4);
    const vz2 = s.ease('share', 0.5, 1.6);
    const vout = s.ease('mul', 0.5, 1.8);
    const share = s.win('share', 'mul');
    s.alpha(a, () => {
      name(s, xx, xy, 'x', 'orange');
      name(s, zx, zy, 'z', '--ink-2');
      wire(s, xx, xy, mx, my, { r1: R, val: '1', va: vin });
      wire(s, zx, zy, mx, my, { r1: R, val: '−2', va: vin, t: 0.45, hot: share });
      wire(s, zx, zy, px, py, { r1: R, val: '−2', va: vz2, t: 0.72, hot: Math.max(share, s.win('mul', 'pieces')) });
      s.circle(zx, zy, 0.9 * s.u, { fill: s.c('--ink-3') });
      wire(s, mx, my, ex, ey, { r0: R, r1: R, val: '1', va: vmax });
      wire(s, ex, ey, px, py, { r0: R, r1: R, val: '2.72', va: vexp });
      wire(s, px, py, ox, oy, { r0: R, val: '−5.44', va: vout });
      name(s, ox, oy, 'f', 'purple', 'out');
      gate(s, mx, my, 'max', '--ink-2', s.win('max', 'exp'));
      gate(s, ex, ey, 'eˣ', '--ink-2', s.win('exp', 'share'));
      gate(s, px, py, '×', '--ink-2', s.win('mul', 'pieces'));
    });
    const k: Ink = 'orange';
    pulse(s, xx, xy, mx, my, travel(s, 'max', 2.3), k);
    pulse(s, zx, zy, mx, my, travel(s, 'max', 2.3), k);
    pulse(s, mx, my, ex, ey, travel(s, 'exp', 0.4), k);
    pulse(s, zx, zy, mx, my, travel(s, 'share', 0.6), k);
    pulse(s, zx, zy, px, py, travel(s, 'share', 0.6, 1.2), k);
    pulse(s, ex, ey, px, py, travel(s, 'mul', 0.6), k);
    s.alpha(share * after(s, 'share', 0.5), () => mono(s, 'one input, two wires', s.w / 2, s.h * 0.88, '--ink-2', 3.6));

    // The pieces every formula here is built from.
    const gap = s.tall ? 19 : 22;
    PIECES.forEach(([g, label], i) => {
      const x = s.w / 2 + (i - 2) * gap * s.u;
      const y = s.h * 0.86;
      s.alpha(s.ease('pieces', 0.5, 0.35 * i), () => {
        gate(s, x, y, g, 'teal', 0.4, 4.2);
        s.text(label, x, y + 7.2 * s.u, { size: 2.9, font: 'mono', color: s.c('--ink-3') });
      });
    });
  },
};

export const scenes: Record<string, SceneDef> = { steps, graph, forward, more };
