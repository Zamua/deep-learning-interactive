import type { Scene, SceneDef } from '../../../lecture/scene';
import { clamp01 } from '../../../lecture/scene';
import { band, gate, type Ink, name, NEURON, neuron, type P, pulse, wire } from '../draw';

const R = 5;
const { x: X_IN, z: Z_IN, c: C_IN, mul: MUL, add: ADD, sq: SQ, out: OUT } = NEURON;
const VALS = ['2', '3', '−4', '6', '2', '4'];

/** Where a forward pulse is along a wire, from `start` seconds into beat `id`. */
const travel = (s: Scene, id: string, start = 0, dur = 0.9) => clamp01((s.since(id) - start) / dur);

const PIECES: [string, string][] = [
  ['+', 'add'],
  ['×', 'multiply'],
  ['max', 'max'],
  ['eˣ', 'exp'],
  ['x²', 'square'],
];

const graph: SceneDef = {
  marks: {
    f: { tex: String.raw`f = (\symx z + c)^{2}`, x: 0.5, y: 0.11, size: 5.6 },
  },
  draw(s) {
    s.show('f', s.ease('formula', 0.6));
    neuron(s, {
      show: [s.ease('mul', 0.6), s.ease('add', 0.6), s.ease('sq', 0.6)],
      on: [s.win('mul', 'add'), s.win('add', 'sq'), s.win('sq', 'pieces')],
      names: 1,
    });
    const at = band(s, 110);
    const pre = s.ease('formula', 0.6, 1.2);
    s.alpha(pre * (1 - s.ease('mul', 0.6)), () => {
      name(s, ...at(X_IN), 'x', 'orange');
      name(s, ...at(Z_IN), 'z', '--ink-2');
    });
    s.alpha(pre * (1 - s.ease('add', 0.6)), () => name(s, ...at(C_IN), 'c', '--ink-2'));
    const pa = s.ease('pieces', 0.6);
    s.alpha(pa, () => {
      const gap = s.tall ? 19 : 22;
      PIECES.forEach(([g, label], i) => {
        const x = s.w / 2 + (i - 2) * gap * s.u;
        const y = s.h * 0.86;
        s.alpha(s.ease('pieces', 0.5, 0.25 * i), () => {
          gate(s, x, y, g, 'teal', 0.4, 4.2);
          s.text(label, x, y + 7.2 * s.u, { size: 2.9, font: 'mono', color: s.c('--ink-3') });
        });
      });
    });
  },
};

const forward: SceneDef = {
  marks: {
    f: { tex: String.raw`f = (\symx z + c)^{2}`, x: 0.5, y: 0.11, size: 5.6 },
  },
  draw(s) {
    s.show('f', 1);
    const at = band(s, 110);
    const order = [s.ease('ready', 0.5, 0.3), s.ease('ready', 0.5, 1.6), s.ease('ready', 0.5, 2.9)];
    neuron(s, {
      show: [1, 1, 1],
      on: [s.win('mul', 'add'), s.win('add', 'sq'), s.win('sq', 'ready')].map((v, i) => Math.max(v, order[i]! * 0.6)),
      vals: VALS,
      va: [s.ease('inputs', 0.5, 0.8), s.ease('inputs', 0.5, 1.4), s.ease('inputs', 0.5, 2.2), s.ease('mul', 0.5, 1.1), s.ease('add', 0.5, 0.9), s.ease('sq', 0.5, 0.9)],
      names: 0.8,
    });
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
    [MUL, ADD, SQ].forEach((p, i) => {
      s.alpha(order[i]!, () => {
        const [x, y] = at(p);
        const bx = x;
        const by = y - (R + 3.4) * s.u;
        s.circle(bx, by, 2.4 * s.u, { fill: s.c('gold'), stroke: s.c('--card'), lw: 0.3 });
        s.text(String(i + 1), bx, by + 0.15 * s.u, { size: 3, font: 'mono', weight: 700, color: s.c('--card') });
      });
    });
  },
};

// f = e^max(x, z) * z: z feeds two nodes.
const X2: P = [0, 0.34];
const Z2: P = [0, 0.7];
const MAX2: P = [0.3, 0.45];
const EXP2: P = [0.56, 0.45];
const MUL2: P = [0.76, 0.58];
const OUT2: P = [1, 0.58];

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
    const vz2 = s.ease('mul', 0.5, 0.6);
    const vout = s.ease('mul', 0.5, 2.6);
    s.alpha(a, () => {
      name(s, xx, xy, 'x', 'orange');
      name(s, zx, zy, 'z', '--ink-2');
      wire(s, xx, xy, mx, my, { r1: R, val: '1', va: vin });
      wire(s, zx, zy, mx, my, { r1: R, val: '−2', va: vin, t: 0.45 });
      wire(s, zx, zy, px, py, { r1: R, val: '−2', va: vz2, t: 0.72, hot: s.win('mul', 'turn') });
      s.circle(zx, zy, 0.9 * s.u, { fill: s.c('--ink-3') });
      wire(s, mx, my, ex, ey, { r0: R, r1: R, val: '1', va: vmax });
      wire(s, ex, ey, px, py, { r0: R, r1: R, val: '2.72', va: vexp });
      wire(s, px, py, ox, oy, { r0: R, val: '−5.44', va: vout });
      name(s, ox, oy, 'f', 'purple', 'out');
      gate(s, mx, my, 'max', '--ink-2', s.win('max', 'exp'));
      gate(s, ex, ey, 'eˣ', '--ink-2', s.win('exp', 'mul'));
      gate(s, px, py, '×', '--ink-2', s.win('mul', 'turn'));
    });
    const k: Ink = 'orange';
    pulse(s, xx, xy, mx, my, travel(s, 'max', 2.3), k);
    pulse(s, zx, zy, mx, my, travel(s, 'max', 2.3), k);
    pulse(s, mx, my, ex, ey, travel(s, 'exp', 0.4), k);
    pulse(s, ex, ey, px, py, travel(s, 'mul', 1.4), k);
    pulse(s, zx, zy, px, py, travel(s, 'mul', 1.4), k);
  },
};

export const scenes: Record<string, SceneDef> = { graph, forward, more };
