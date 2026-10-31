import type { Ink, Scene, SceneDef } from '../../../lecture/scene';
import { after, cite } from '../../draw';
import { band, beside, gate, mono, name, neuron, NEURON, type P, pulse, runAfter, wire } from '../draw';

const R = 5;

/** One line of working under the graph, `row` 0 or 1. */
const line = (s: Scene, text: string, row: number, a: number, k: Ink = 'red') => s.alpha(a, () => mono(s, text, s.w / 2, s.h * (0.85 + 0.08 * row), k, 3.8, 'center', 600));

type Node = keyof typeof NEURON;
/** The wires of f = (x z + c)^2 as neuron() draws them: ends, trims, and where along each its labels sit. */
const WIRES: Record<'x' | 'z' | 'c' | 'q' | 'r' | 'f', { from: Node; to: Node; r0: number; r1: number; t: number }> = {
  x: { from: 'x', to: 'mul', r0: 0, r1: R, t: 0.32 },
  z: { from: 'z', to: 'mul', r0: 0, r1: R, t: 0.32 },
  c: { from: 'c', to: 'add', r0: 0, r1: R, t: 0.42 },
  q: { from: 'mul', to: 'add', r0: R, r1: R, t: 0.5 },
  r: { from: 'add', to: 'sq', r0: R, r1: R, t: 0.5 },
  f: { from: 'sq', to: 'out', r0: R, r1: 0, t: 0.5 },
};
type Wire = keyof typeof WIRES;

/** A label beside one wire of the graph, matching neuron(): above for a value, below for a gradient. */
function onWire(s: Scene, w: Wire, side: 1 | -1, text: string, k: Ink, a: number) {
  const at = band(s, 110);
  const g = WIRES[w];
  const [x0, y0] = at(NEURON[g.from]);
  const [x1, y1] = at(NEURON[g.to]);
  s.alpha(a, () => s.text(text, ...beside(s, x0, y0, x1, y1, g.t, side, 3.7, g.r0, g.r1), { size: 3.7, font: 'mono', weight: side > 0 ? 600 : 650, color: s.c(k), halo: true }));
}

/** A dot running along a wire of the graph: forward from its start, or back from its end. */
function run(s: Scene, w: Wire, t: number, back: boolean) {
  const at = band(s, 110);
  const g = WIRES[w];
  const a = at(NEURON[g.from]);
  const b = at(NEURON[g.to]);
  if (back) pulse(s, ...b, ...a, t, 'red');
  else pulse(s, ...a, ...b, t, 'orange');
}

/** A whole forward run from the input wire `from`, one wire after another, starting at `t0` seconds into beat `id`. */
function forward(s: Scene, id: string, from: 'x' | 'z' | 'c', t0: number) {
  const path: Wire[] = from === 'c' ? ['c', 'r', 'f'] : [from, 'q', 'r', 'f'];
  path.forEach((w, i) => run(s, w, (s.since(id) - t0 - 0.45 * i) / 0.45, false));
}

/** A whole backward walk from f to every input, starting a fraction `f` of the way through beat `id`. */
function backward(s: Scene, id: string, f: number) {
  const step = 0.5;
  const at0 = s.at(id) + f * (s.end(id) - s.at(id));
  const p = (k: number) => (s.t - at0 - k * step) / step;
  run(s, 'f', p(0), true);
  run(s, 'r', p(1), true);
  run(s, 'q', p(2), true);
  run(s, 'c', p(2), true);
  run(s, 'x', p(3), true);
  run(s, 'z', p(3), true);
}

const formula = { tex: String.raw`f = (\symx z + c)^{2}`, x: 0.5, y: 0.11, size: 5.6 };

const ask: SceneDef = {
  marks: { f: formula },
  draw(s) {
    s.show('f', 1 - s.ease('found', 0.6) * 0.75);
    const nudged = s.win('nudge', 'cost');
    neuron(s, {
      show: [1, 1, 1],
      on: [0, 0, 0],
      vals: ['2', '3', '−4', '', '', '4'],
      va: [1 - after(s, 'nudge', 0.4) * (1 - s.ease('cost', 0.6)), 1, 1, 0, 0, 1 - after(s, 'nudge', 0.85) * (1 - s.ease('cost', 0.6))],
      hot: [s.win('nudge', 'cost'), 0, 0, 0, 0, 0],
    });
    // The nudge: x becomes 2.01, a forward run, and f becomes 4.12.
    onWire(s, 'x', 1, '2.01', 'orange', after(s, 'nudge', 0.4) * nudged);
    onWire(s, 'f', 1, '4.12', 'orange', after(s, 'nudge', 0.85) * nudged);
    forward(s, 'nudge', 'x', 0.45 * (s.end('nudge') - s.at('nudge')));
    // The other two reruns, one per input.
    forward(s, 'cost', 'z', 0.25 * (s.end('cost') - s.at('cost')));
    forward(s, 'cost', 'c', 0.5 * (s.end('cost') - s.at('cost')));
    // One question mark per input, until the nudge estimates x's.
    const q = s.ease('grad', 0.5, 0.6);
    const est = after(s, 'slope', 0.45);
    onWire(s, 'x', -1, '?', 'red', q * (1 - est));
    onWire(s, 'x', -1, '≈ 12', 'red', est);
    onWire(s, 'z', -1, '?', 'red', s.ease('grad', 0.5, 1.4));
    onWire(s, 'c', -1, '?', 'red', s.ease('grad', 0.5, 1.9));
    // The backward walks.
    backward(s, 'walk', 0.45);
    backward(s, 'name', 0.6);
    backward(s, 'named', 0.2);
    line(s, '∂f/∂x   ∂f/∂z   ∂f/∂c', 0, s.win('grad', 'nudge'));
    line(s, 'the gradient of f', 1, s.win('grad', 'nudge') * after(s, 'grad', 0.6), '--ink-2');
    line(s, 'x: 2 → 2.01    f: 4 → 4.1209', 0, after(s, 'nudge', 0.85) * (1 - s.ease('cost', 0.5)), 'orange');
    line(s, '0.1209 / 0.01 ≈ 12', 1, after(s, 'slope', 0.3) * (1 - s.ease('cost', 0.5)));
    line(s, 'one rerun per input: 3 inputs, 3 reruns', 0, s.win('cost', 'walk') * after(s, 'cost', 0.15), '--ink-2');
    line(s, '1,000,000 inputs: 1,000,000 reruns', 1, s.win('cost', 'walk') * after(s, 'cost', 0.7), '--ink-2');
    line(s, 'one walk back, every slope', 0, s.win('walk', 'name') * after(s, 'walk', 0.5));
    line(s, 'backpropagation', 0, after(s, 'name', 0.1));
    // The way the gradient goes: from the output back to the inputs.
    s.alpha(after(s, 'name', 0.1), () => {
      const at = band(s, 110);
      const y = s.h * 0.795;
      s.arrow(at(NEURON.out)[0], y, at(NEURON.x)[0], y, s.tint('red', 0.6), 0.4, 2.2);
    });
    line(s, 'the gradient, passed backward', 1, after(s, 'name', 0.6), '--ink-2');
    cite(s, 'Seppo Linnainmaa · master\'s thesis, 1970', s.win('found', 'named'));
    cite(s, 'Rumelhart, Hinton & Williams, 1986', s.ease('named', 0.6));
  },
};

const walk: SceneDef = {
  marks: { f: formula },
  draw(s) {
    s.show('f', 1);
    const fwd = (f: number) => after(s, 'fwd', f);
    neuron(s, {
      show: [1, 1, 1],
      on: [s.win('mul', 'all'), s.win('add', 'mul'), s.win('sq', 'add')],
      vals: ['2', '3', '−4', '6', '2', '4'],
      va: [1, 1, 1, fwd(0.3), fwd(0.55), fwd(0.8)],
      grads: ['12', '8', '4', '4', '4', '1'],
      ga: [after(s, 'mul', 0.75), after(s, 'mulz', 0.6), after(s, 'add', 0.6), after(s, 'add', 0.45), after(s, 'sq2', 0.6), after(s, 'seed', 0.6)],
    });
    // The forward run, silently: one dot per wire as each value appears.
    const w = (id: string, f: number) => runAfter(s, id, f, 0.6);
    run(s, 'x', w('fwd', 0.12), false);
    run(s, 'z', w('fwd', 0.12), false);
    run(s, 'q', w('fwd', 0.3), false);
    run(s, 'c', w('fwd', 0.36), false);
    run(s, 'r', w('fwd', 0.55), false);
    run(s, 'f', w('fwd', 0.75), false);
    // Question marks carried from the first scene, replaced as the walk reaches each input.
    onWire(s, 'x', -1, '?', 'red', 1 - after(s, 'mul', 0.6));
    onWire(s, 'z', -1, '?', 'red', 1 - after(s, 'mulz', 0.45));
    onWire(s, 'c', -1, '?', 'red', 1 - after(s, 'add', 0.45));
    // The gradient going back.
    run(s, 'f', runAfter(s, 'seed', 0.3), true);
    run(s, 'r', runAfter(s, 'sq2', 0.2), true);
    run(s, 'q', runAfter(s, 'add', 0.15), true);
    run(s, 'c', runAfter(s, 'add', 0.15), true);
    run(s, 'x', runAfter(s, 'mul', 0.3), true);
    run(s, 'z', runAfter(s, 'mulz', 0.15), true);
    backward(s, 'once', 0.15);
    const out = (id: string) => 1 - s.ease(id, 0.4);
    line(s, '∂f/∂f = 1', 0, after(s, 'seed', 0.6) * out('rule'));
    line(s, '+ copies     × swaps     max routes', 0, after(s, 'rule', 0.55) * out('sq'), '--ink-2');
    line(s, 'slope of r²: 2r = 2 × 2 = 4', 0, after(s, 'sq', 0.3) * out('add'));
    line(s, '∂f/∂r = 4 × 1 = 4', 1, after(s, 'sq2', 0.4) * out('add'));
    line(s, '∂f/∂q = ∂f/∂c = 4', 0, after(s, 'add', 0.5) * out('mul'));
    line(s, '∂f/∂x = z × 4 = 3 × 4 = 12', 0, after(s, 'mul', 0.6) * out('all'));
    line(s, '∂f/∂z = x × 4 = 2 × 4 = 8', 1, after(s, 'mulz', 0.5) * out('all'));
    line(s, 'x: 12    z: 8    c: 4', 0, s.win('all', 'once') * after(s, 'all', 0.1));
    line(s, 'and on the way, q: 4    r: 4', 1, s.win('all', 'once') * after(s, 'all', 0.6), '--ink-2');
    line(s, 'one walk back: each node once', 0, after(s, 'once', 0.2));
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
    const fork = s.win('fork', 'add');
    const va = s.ease('fork', 0.5);
    const g1 = after(s, 'add', 0.45);
    const g2 = after(s, 'mul', 0.6);
    name(s, xx - 1.4 * s.u, xy, 'x', 'orange');
    name(s, zx, zy, 'z', '--ink-2');
    wire(s, xx, xy, mx, my, { r1: R, val: '3', va, grad: '2', ga: g2, t: 0.45, hot: Math.max(fork, s.win('mul', 'sum')) });
    wire(s, zx, zy, mx, my, { r1: R, val: '2', va, grad: '3', ga: g2, t: 0.45 });
    wire(s, xx, xy, ax, ay, { r1: R, val: '3', va, grad: '1', ga: g1, t: 0.5, hot: Math.max(fork, s.win('add', 'mul')) });
    wire(s, mx, my, ax, ay, { r0: R, r1: R, val: '6', va, grad: '1', ga: g1 });
    wire(s, ax, ay, ox, oy, { r0: R, val: '9', va, grad: '1', ga: s.ease('add', 0.5) });
    name(s, ox, oy, 'f', 'purple', 'out');
    gate(s, mx, my, '×', '--ink-2', s.win('mul', 'sum'));
    gate(s, ax, ay, '+', '--ink-2', s.win('add', 'mul'));
    const ring = s.win('sum', 'turn');
    s.alpha(ring, () => s.circle(xx, xy, 2.2 * s.u, { stroke: s.c('red'), lw: 0.5 }));
    s.circle(xx, xy, 0.9 * s.u, { fill: s.c('--ink-3') });
    // The nudge: one dot down each of x's wires at once, then on to f.
    const n = s.since('nudge') - 0.25 * (s.end('nudge') - s.at('nudge'));
    pulse(s, xx, xy, mx, my, n / 0.8, 'orange');
    pulse(s, xx, xy, ax, ay, n / 0.8, 'orange');
    pulse(s, mx, my, ax, ay, (n - 0.8) / 0.5, 'orange');
    pulse(s, ax, ay, ox, oy, (n - 1.3) / 0.5, 'orange');
    s.alpha(s.win('nudge', 'add') * after(s, 'nudge', 0.3), () => {
      mono(s, 'via +', ...beside(s, xx, xy, ax, ay, 0.82, 1, 3.2, 0, R), 'orange', 3.2, 'center', 600);
      mono(s, 'via ×', (xx + mx) / 2 - 4 * s.u, (xy + my) / 2 + 2 * s.u, 'orange', 3.2, 'right', 600);
    });
    // The walk back.
    pulse(s, ox, oy, ax, ay, runAfter(s, 'add', 0.1, 0.6), 'red');
    pulse(s, ax, ay, xx, xy, runAfter(s, 'add', 0.3), 'red');
    pulse(s, ax, ay, mx, my, runAfter(s, 'add', 0.3), 'red');
    pulse(s, mx, my, xx, xy, runAfter(s, 'mul', 0.3), 'red');
    pulse(s, mx, my, zx, zy, runAfter(s, 'mul', 0.3), 'red');
    line(s, 'via +: 1', 0, after(s, 'add', 0.6) * (1 - s.ease('mul', 0.4)));
    line(s, 'via +: 1     via ×: z × 1 = 2', 0, after(s, 'mul', 0.5) * (1 - s.ease('check', 0.4)));
    line(s, '∂f/∂x = 1 + 2 = 3', 1, after(s, 'sum', 0.4) * (1 - s.ease('check', 0.4)));
    line(s, 'f = xz + x', 0, after(s, 'check', 0.2), '--ink-2');
    line(s, '∂f/∂x = z + 1 = 2 + 1 = 3', 1, after(s, 'check', 0.5));
  },
};

export const scenes: Record<string, SceneDef> = { ask, walk, twice };
