import type { Scene, SceneDef } from '../../../lecture/scene';
import { after, band, gate, mono, name, NEURON, neuron, type P, pulse, runAfter, wire } from '../draw';

const R = 5;

/** One line of working under the graph, `row` 0 or 1. */
const line = (s: Scene, text: string, row: number, a: number) => s.alpha(a, () => mono(s, text, s.w / 2, s.h * (0.85 + 0.08 * row), 'red', 3.8, 'center', 600));

const walk: SceneDef = {
  marks: { f: { tex: String.raw`f = (\symx z + c)^{2}`, x: 0.5, y: 0.11, size: 5.6 } },
  draw(s) {
    s.show('f', 1);
    const at = band(s, 110);
    const p = (k: keyof typeof NEURON) => at(NEURON[k]);
    neuron(s, {
      show: [1, 1, 1],
      on: [s.win('mul', 'all'), s.win('add', 'mul'), s.win('sq', 'add')],
      vals: ['2', '3', '−4', '6', '2', '4'],
      va: [after(s, 'fwd', 0.3), after(s, 'fwd', 0.36), after(s, 'fwd', 0.44), after(s, 'fwd', 0.62), after(s, 'fwd', 0.76), after(s, 'fwd', 0.9)],
      grads: ['12', '8', '4', '4', '4', '1'],
      ga: [after(s, 'mul', 0.4), after(s, 'mul', 0.8), after(s, 'add', 0.6), after(s, 'add', 0.45), after(s, 'sq', 0.85), after(s, 'seed', 0.55)],
    });
    pulse(s, ...p('out'), ...p('sq'), runAfter(s, 'seed', 0.2), 'red');
    pulse(s, ...p('sq'), ...p('add'), runAfter(s, 'sq', 0.6), 'red');
    pulse(s, ...p('add'), ...p('mul'), runAfter(s, 'add', 0.15), 'red');
    pulse(s, ...p('add'), ...p('c'), runAfter(s, 'add', 0.15), 'red');
    pulse(s, ...p('mul'), ...p('x'), runAfter(s, 'mul', 0.1), 'red');
    pulse(s, ...p('mul'), ...p('z'), runAfter(s, 'mul', 0.5), 'red');
    const out = (id: string) => 1 - s.ease(id, 0.4);
    line(s, '∂f/∂r = 2r × 1 = 4', 0, after(s, 'sq', 0.75) * out('add'));
    line(s, '∂f/∂q = ∂f/∂c = 4', 0, after(s, 'add', 0.5) * out('mul'));
    line(s, '∂f/∂x = z × 4 = 12', 0, after(s, 'mul', 0.4) * out('all'));
    line(s, '∂f/∂z = x × 4 = 8', 1, after(s, 'mul', 0.8) * out('all'));
    line(s, 'x: 12    z: 8    c: 4', 0, after(s, 'all', 0.35));
  },
};

const X: P = [0, 0.3];
const Z: P = [0, 0.72];
const MUL: P = [0.4, 0.6];
const ADD: P = [0.74, 0.42];
const OUT: P = [1, 0.42];

const twice: SceneDef = {
  marks: { f: { tex: String.raw`f = \symx z + \symx`, x: 0.5, y: 0.11, size: 5.6 } },
  draw(s) {
    s.show('f', 1);
    const at = band(s, 110);
    const [xx, xy] = at(X);
    const [zx, zy] = at(Z);
    const [mx, my] = at(MUL);
    const [ax, ay] = at(ADD);
    const [ox, oy] = at(OUT);
    const fork = s.win('fork', 'paths');
    const va = s.ease('fork', 0.5);
    const g1 = after(s, 'paths', 0.3);
    const g2 = after(s, 'paths', 0.8);
    name(s, xx - 1.4 * s.u, xy, 'x', 'orange');
    name(s, zx, zy, 'z', '--ink-2');
    wire(s, xx, xy, mx, my, { r1: R, val: '3', va, grad: '2', ga: g2, t: 0.45, hot: fork });
    wire(s, zx, zy, mx, my, { r1: R, val: '2', va, grad: '3', ga: g2, t: 0.45 });
    wire(s, xx, xy, ax, ay, { r1: R, val: '3', va, grad: '1', ga: g1, t: 0.5, hot: fork });
    wire(s, mx, my, ax, ay, { r0: R, r1: R, val: '6', va, grad: '1', ga: g1 });
    wire(s, ax, ay, ox, oy, { r0: R, val: '9', va, grad: '1', ga: s.ease('paths', 0.5) });
    name(s, ox, oy, 'f', 'purple', 'out');
    gate(s, mx, my, '×', '--ink-2', s.win('paths', 'sum') * after(s, 'paths', 0.55));
    gate(s, ax, ay, '+', '--ink-2', s.win('paths', 'sum') * (1 - after(s, 'paths', 0.55)));
    const ring = s.ease('sum', 0.5);
    s.alpha(ring, () => s.circle(xx, xy, 2.2 * s.u, { stroke: s.c('red'), lw: 0.5 }));
    s.circle(xx, xy, 0.9 * s.u, { fill: s.c('--ink-3') });
    pulse(s, ax, ay, xx, xy, runAfter(s, 'paths', 0.1), 'red');
    pulse(s, ax, ay, mx, my, runAfter(s, 'paths', 0.1), 'red');
    pulse(s, mx, my, xx, xy, runAfter(s, 'paths', 0.55), 'red');
    pulse(s, mx, my, zx, zy, runAfter(s, 'paths', 0.55), 'red');
    line(s, 'via +: 1     via ×: z × 1 = 2', 0, after(s, 'paths', 0.85));
    line(s, '∂f/∂x = 1 + 2 = 3', 1, after(s, 'sum', 0.25));
  },
};

export const scenes: Record<string, SceneDef> = { walk, twice };
