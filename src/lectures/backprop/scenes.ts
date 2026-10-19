import { Rng } from '../../core/rand';
import type { Color } from '../../core/symbols';
import { type CircuitSpec, type Op, evaluate, sigmoid } from '../../lib/backprop-circuit';
import { type Mark, type Scene, type SceneDef, clamp01, lerp, smooth } from '../../lecture/scene';
import { Frame, type Rect, area, card, circuit, fog, lock, num, track } from './draw';

/** Gradient (teal) and local-gradient (gold) fractions, as in the chapter. */
const G = (a: string, b: string) => String.raw`\sym{g}{\dfrac{\partial ${a}}{\partial ${b}}}`;
const LG = (a: string, b: string) => String.raw`\sym{loc}{\dfrac{\partial ${a}}{\partial ${b}}}`;

/** Marks render inline; display style keeps their fractions full size. */
const big = (m: Record<string, Mark>): Record<string, Mark> =>
  Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.tex ? { ...v, tex: `\\displaystyle ${v.tex}` } : v]));

/** Numbers for code slots: like `num`, with an ASCII minus. */
const cnum = (v: number) => num(v).replace('−', '-');

/** Walk position: the latest started beat's keys (see `track`) win. */
function walk(s: Scene, stages: [string, [number, number][]][], k0 = 0): number {
  let k = k0;
  for (const [beat, keys] of stages) if (s.since(beat) >= 0) k = track(s.prog(beat), keys);
  return k;
}

/** A rounded speech bubble centered near (cx, cy), with a leader line to what is speaking at (tx, ty). */
function bubble(s: Scene, cx: number, cy: number, tx: number, ty: number, text: string, k: Color, a: number, size = 3.4): void {
  if (a <= 0) return;
  const u = s.u;
  const tw = s.measure(text, { size, font: 'mono', weight: 600 });
  const bw = tw + 3 * u;
  const bh = size * u * 1.9;
  const bx = Math.max(u * 4, Math.min(s.w - u * 4 - bw, cx - bw / 2));
  const by = cy - bh / 2;
  s.alpha(a, () => {
    const ex = Math.max(bx + 2 * u, Math.min(bx + bw - 2 * u, tx));
    const ey = ty < by ? by : by + bh;
    s.line(ex, ey, tx, ty, s.c(k), 0.35);
    s.circle(tx, ty, 0.7 * u, { fill: s.c(k) });
    s.rrect(bx, by, bw, bh, 1.6, { fill: s.c('--card'), stroke: s.c(k), lw: 0.4 });
    s.text(text, bx + bw / 2, by + bh / 2 + 0.1 * u, { size, font: 'mono', weight: 600, color: s.c(k) });
  });
}

// ---------------------------------------------------------------- circuits

const CHAIN: CircuitSpec = {
  inputs: [
    { id: 'x', at: [0, 0.1] },
    { id: 'y', at: [0, 1.25] },
    { id: 'z', at: [0, 2.35] },
  ],
  ops: [
    { id: 'q', op: 'add', ins: ['x', 'y'], at: [1, 0.68], name: 'q', t: [0.4, 0.4] },
    { id: 'f', op: 'mul', ins: ['q', 'z'], at: [2, 1.5], t: [0.45, 0.45] },
  ],
  size: [2.65, 2.35],
  outName: 'f',
};
const CHAIN_IN = { x: -2, y: 5, z: -4 };
const CHAIN_EV = evaluate(CHAIN, CHAIN_IN);

const ONE: CircuitSpec = {
  inputs: [
    { id: 'x', at: [0, 0] },
    { id: 'y', at: [0, 1.5] },
  ],
  ops: [{ id: 'out', op: 'mul', ins: ['x', 'y'], at: [1, 0.75] }],
  size: [1.5, 1.5],
};
const ONE_EV = evaluate(ONE, { x: 3, y: -2 }, 2);

const NEURON_INPUTS = ['w0', 'x0', 'w1', 'x1', 'w2'].map((id) => ({ id }));
const NEURON_WIDE: CircuitSpec = {
  inputs: NEURON_INPUTS.map((i, k) => ({ ...i, at: [0, [0, 0.85, 1.9, 2.75, 3.6][k]!] as [number, number] })),
  ops: [
    { id: 'p0', op: 'mul', ins: ['w0', 'x0'], at: [1, 0.42] },
    { id: 'p1', op: 'mul', ins: ['w1', 'x1'], at: [1, 2.32] },
    { id: 's', op: 'add', ins: ['p0', 'p1'], at: [2, 1.37] },
    { id: 'dot', op: 'add', ins: ['s', 'w2'], at: [3, 2.1], t: [0.5, 0.72] },
    { id: 'neg', op: 'mulc', c: -1, ins: ['dot'], at: [4, 2.1] },
    { id: 'ex', op: 'exp', ins: ['neg'], at: [5, 2.1] },
    { id: 'den', op: 'addc', c: 1, ins: ['ex'], at: [6, 2.1] },
    { id: 'f', op: 'inv', ins: ['den'], at: [7, 2.1] },
  ],
  size: [7.5, 3.6],
  labels: 'node',
  outName: 'f',
};
const NEURON_TALL: CircuitSpec = {
  ...NEURON_WIDE,
  inputs: NEURON_INPUTS.map((i, k) => ({ ...i, at: [0, [0, 0.8, 1.6, 2.4, 3.2][k]!] as [number, number] })),
  ops: [
    { id: 'p0', op: 'mul', ins: ['w0', 'x0'], at: [1.05, 0.4] },
    { id: 'p1', op: 'mul', ins: ['w1', 'x1'], at: [1.05, 2.0] },
    { id: 's', op: 'add', ins: ['p0', 'p1'], at: [2.05, 1.2] },
    { id: 'dot', op: 'add', ins: ['s', 'w2'], at: [3, 1.9] },
    { id: 'neg', op: 'mulc', c: -1, ins: ['dot'], at: [0.45, 4.2] },
    { id: 'ex', op: 'exp', ins: ['neg'], at: [1.3, 4.2] },
    { id: 'den', op: 'addc', c: 1, ins: ['ex'], at: [2.15, 4.2] },
    { id: 'f', op: 'inv', ins: ['den'], at: [3, 4.2] },
  ],
  size: [3.45, 4.2],
};
const NEURON_VALS = { w0: 2, x0: -1, w1: -3, x1: -2, w2: -3 };
const NEURON_EV = evaluate(NEURON_WIDE, NEURON_VALS);
const neuronColor = (id: string): Color => (id.startsWith('w') ? 'blue' : 'orange');

const SIG4: CircuitSpec = {
  inputs: [{ id: 'dot', label: 'z', at: [0, 0.5] }],
  ops: [
    { id: 'neg', op: 'mulc', c: -1, ins: ['dot'], at: [1, 0.5] },
    { id: 'ex', op: 'exp', ins: ['neg'], at: [2, 0.5] },
    { id: 'den', op: 'addc', c: 1, ins: ['ex'], at: [3, 0.5] },
    { id: 'f', op: 'inv', ins: ['den'], at: [4, 0.5] },
  ],
  size: [4.5, 1],
  labels: 'node',
  outName: 'f',
};
const SIG4_EV = evaluate(SIG4, { dot: 1 });

const GROUPED: CircuitSpec = {
  inputs: NEURON_WIDE.inputs,
  ops: [
    { id: 'p0', op: 'mul', ins: ['w0', 'x0'], at: [1, 0.42] },
    { id: 'p1', op: 'mul', ins: ['w1', 'x1'], at: [1, 2.32] },
    { id: 's', op: 'add', ins: ['p0', 'p1'], at: [2, 1.37] },
    { id: 'dot', op: 'add', ins: ['s', 'w2'], at: [3, 2.1], name: 'dot' },
    { id: 'f', op: 'sig', ins: ['dot'], at: [4, 2.1] },
  ],
  size: [4.45, 3.6],
  labels: 'node',
  outName: 'f',
};
const GROUPED_EV = evaluate(GROUPED, NEURON_VALS);

const STAGED: CircuitSpec = {
  inputs: [
    { id: 'x', at: [0, 1.0] },
    { id: 'y', at: [0, 2.75] },
  ],
  ops: [
    { id: 'sigy', op: 'sig', ins: ['y'], at: [1, 3.6], name: 'sigy' },
    { id: 'num', op: 'add', ins: ['x', 'sigy'], at: [2.1, 4.35], name: 'num', t: [0.56, 0.5] },
    { id: 'sigx', op: 'sig', ins: ['x'], at: [1, 0.0], name: 'sigx' },
    { id: 'xpy', op: 'add', ins: ['x', 'y'], at: [1, 1.75], name: 'xpy', t: [0.55, 0.55] },
    { id: 'xpysqr', op: 'sq', ins: ['xpy'], at: [2, 1.75], name: 'xpysqr' },
    { id: 'den', op: 'add', ins: ['sigx', 'xpysqr'], at: [3, 0.85], name: 'den' },
    { id: 'invden', op: 'inv', ins: ['den'], at: [4, 0.85], name: 'invden' },
    { id: 'f', op: 'mul', ins: ['num', 'invden'], at: [5, 2.4], name: 'f' },
  ],
  size: [5.4, 4.35],
  labels: 'node',
};
const STAGED_EV = evaluate(STAGED, { x: 3, y: -4 });

const gate1 = (op: Op, x: number, y: number, up: number, names: [string, string] = ['x', 'y']): [CircuitSpec, ReturnType<typeof evaluate>] => {
  const spec: CircuitSpec = {
    inputs: [
      { id: names[0], at: [0, 0] },
      { id: names[1], at: [0, 1.5] },
    ],
    ops: [{ id: 'out', op, ins: names, at: [1, 0.75] }],
    size: [1.5, 1.5],
  };
  return [spec, evaluate(spec, { [names[0]]: x, [names[1]]: y }, up)];
};
const PERSONAS: [string, string, Op][] = [
  ['add', 'add: distributes', 'add'],
  ['max', 'max: routes', 'max'],
  ['mul', 'multiply: swaps', 'mul'],
];
const PERSONA_CIRCUITS = PERSONAS.map(([, , op]) => gate1(op, 3, -4, 2));
const SCALE_CIRCUIT = gate1('mul', 0.1, 80, 1, ['w', 'x']);

const PATTERNS: CircuitSpec = {
  inputs: [
    { id: 'x', at: [0, 0] },
    { id: 'y', at: [0, 0.95] },
    { id: 'z', at: [0, 2.05] },
    { id: 'w', at: [0, 3.0] },
  ],
  ops: [
    { id: 'm', op: 'mul', ins: ['x', 'y'], at: [1, 0.48], name: 'm' },
    { id: 'n', op: 'max', ins: ['z', 'w'], at: [1, 2.52], name: 'n' },
    { id: 's', op: 'add', ins: ['m', 'n'], at: [2, 1.5], name: 's' },
    { id: 'f', op: 'mulc', c: 2, ins: ['s'], at: [3, 1.5] },
  ],
  size: [3.55, 3.0],
  outName: 'f',
};
const PATTERNS_EV = evaluate(PATTERNS, { x: 3, y: -4, z: 2, w: -1 });

// ---------------------------------------------------------------- 1. intro

const GRID_C = 8;
const GRID_R = 5;
const GRID_G = (() => {
  const r = new Rng(11);
  return Array.from({ length: GRID_C * GRID_R }, () => r.randn() * 0.8);
})();

/** The weights of a network, each with its gradient arrow, flowing into one loss number. */
function weightGrid(s: Scene): void {
  const { w, h, u } = s;
  const n = GRID_C * GRID_R;
  const cs = Math.min((w * 0.56) / GRID_C, (h * 0.44) / GRID_R);
  const gx = w * 0.07;
  const gy = h * 0.15;
  const bw = Math.min(w * 0.24, 30 * u);
  const bh = 17 * u;
  const lx = w * 0.93 - bw;
  const ly = gy + (cs * GRID_R) / 2;
  for (let r = 0; r < GRID_R; r++) s.line(gx + cs * GRID_C + u, gy + (r + 0.5) * cs, lx - u, ly + (r - 2) * 1.6 * u, s.tint('--ink-3', 0.5), 0.25);
  const loss = s.since('need') >= 0 ? 1.87 : lerp(2.31, 1.87, smooth(s.prog('recall') * 1.2 - 0.1));
  s.rrect(lx, ly - bh / 2, bw, bh, 2, { fill: s.tint('red', 0.08), stroke: s.c('red'), lw: 0.45 });
  s.text('loss', lx + bw / 2, ly - bh * 0.22, { size: 3.4, font: 'mono', color: s.c('--ink-2') });
  s.text(loss.toFixed(2), lx + bw / 2, ly + bh * 0.18, { size: 5.4, font: 'mono', weight: 650, color: s.c('red') });
  s.alpha(s.win('recall', 'need'), () => s.text('walk downhill', lx + bw / 2, ly + bh / 2 + 4 * u, { size: 3.4, italic: true, color: s.c('--ink-2') }));

  let visited = -1;
  if (s.since('num') >= 0 && s.since('slow') < 0) visited = Math.min(n, Math.floor(s.prog('num') * 1.15 * n));
  for (let i = 0; i < n; i++) {
    const c = i % GRID_C;
    const r = Math.floor(i / GRID_C);
    const x = gx + c * cs;
    const y = gy + r * cs;
    const cur = i === visited;
    s.cell(x + cs * 0.06, y + cs * 0.06, cs * 0.88, cs * 0.88, '', 'blue', { on: cur ? 1 : 0 });
    let a = 0;
    if (s.since('need') >= 0) a = s.ease('need', 0.4, 0.6 + i * 0.04);
    if (visited >= 0) a = i < visited ? 1 : 0;
    if (s.since('slow') >= 0) a = 1;
    const g = GRID_G[i]!;
    const len = cs * 0.36 * Math.min(1, Math.abs(g) + 0.25);
    s.alpha(a, () => s.arrow(x + cs / 2, y + cs / 2 + (g > 0 ? len : -len), x + cs / 2, y + cs / 2 + (g > 0 ? -len : len), s.c('teal'), 0.4, 1.6));
    if (cur) s.circle(x + cs / 2, y + cs / 2, cs * 0.55, { stroke: s.c('--accent'), lw: 0.6 });
  }
  const ty = gy + cs * GRID_R + 5 * u;
  s.alpha(s.win('need', 'num'), () => s.text('one gradient per weight', gx, ty, { size: 3.8, align: 'left', color: s.c('teal') }));
  if (visited >= 0) s.text(`loss evaluations: ${visited}`, gx, ty, { size: 3.8, font: 'mono', align: 'left' });
  s.alpha(s.ease('slow', 0.4), () => {
    const v = Math.round(40 * 10 ** (4.4 * smooth(s.prog('slow') * 1.8)));
    s.text(`loss evaluations: ${v.toLocaleString('en-US')}`, gx, ty, { size: 3.8, font: 'mono', align: 'left', color: s.c('red') });
    s.alpha(s.ease('slow', 0.5, 1.2), () => s.text('a real network: millions of weights', gx, ty + 5.5 * u, { size: 3.6, italic: true, align: 'left', color: s.c('--ink-2') }));
  });
}

const intro: SceneDef = {
  marks: big({
    nd: { tex: String.raw`\frac{L(\symW + \symh) - L(\symW)}{\symh}`, x: 0.5, y: 0.85, size: 4.6 },
    w1: { tex: String.raw`\frac{\partial L}{\partial \symW_1} = \Big(\symW_2^{\top}(p - y) \odot \mathbf{1}(\symW_1 \symx > 0)\Big)\,\symx^{\top}`, x: 0.5, y: 0.2, size: 4 },
    w2: { tex: String.raw`\frac{\partial}{\partial w_0}\,\frac{1}{1 + e^{-(w_0 x_0 + w_1 x_1 + w_2)}}`, x: 0.33, y: 0.42, size: 4.2 },
    w3: { tex: String.raw`\frac{\partial L_i}{\partial s_j} = \frac{e^{s_j}}{\sum_k e^{s_k}} - \mathbf{1}(j = y_i)`, x: 0.66, y: 0.6, size: 4 },
    w4: { tex: String.raw`\frac{\partial}{\partial x}\,\frac{x + \sigma(y)}{\sigma(x) + (x + y)^2}`, x: 0.36, y: 0.78, size: 4.2 },
  }),
  draw(s) {
    const { w, h, u } = s;
    s.alpha(s.win('hello', 'recall'), () => {
      s.text('Backpropagation', w / 2, h * 0.45, { size: 10, font: 'display', weight: 600 });
      s.text('exact gradients, one tiny gate at a time', w / 2, h * 0.59, { size: 4.4, italic: true, color: s.c('--ink-2') });
    });
    const gA = s.win('recall', 'ana');
    if (gA > 0) s.alpha(gA, () => weightGrid(s));
    s.show('nd', s.win('slow', 'ana') * s.ease('slow', 0.6, 4.5));
    s.alpha(s.win('slow', 'ana') * s.ease('slow', 0.6, 5.2), () => s.text('only approximate: h is never truly 0', w / 2, h * 0.95, { size: 3.4, italic: true, color: s.c('slate') }));
    const wall = s.win('ana', 'bp', 0.8);
    ['w1', 'w2', 'w3', 'w4'].forEach((k, i) => s.show(k, wall * s.ease('ana', 0.7, 0.3 + i * 0.45) * 0.9, { y: [0.2, 0.42, 0.6, 0.78][i]! + Math.sin(s.t * 0.4 + i) * 0.006 }));
    s.alpha(wall * s.ease('ana', 0.6, 4.5), () => s.text('by hand, for a whole network: hopeless', w / 2, h * 0.93, { size: 3.8, italic: true, color: s.c('red') }));
    const cA = s.ease('bp', 0.6);
    if (cA > 0) {
      const k = walk(s, [
        ['bp', [[0.15, 0], [0.85, 2]]],
        ['how', [[0.05, 2], [0.85, 5]]],
      ]);
      s.alpha(cA, () => {
        const ring = s.ease('plan', 0.5, 2.6);
        circuit(s, [w * 0.06, h * 0.1, w * 0.88, h * 0.66], CHAIN, CHAIN_EV, { k, size: 3.6, ring: { x: ring, y: ring, z: ring } });
        const ly = h * 0.86;
        s.alpha(s.win('bp', 'how'), () => s.text('forward: values flow right', w / 2, ly, { size: 4, italic: true, color: s.c('--accent') }));
        s.alpha(s.win('how', 'plan'), () => s.text('backward: gradients flow left', w / 2, ly, { size: 4, italic: true, color: s.c('teal') }));
        s.alpha(s.ease('plan', 0.6, 2.6), () => s.text('start small: three numbers in', w / 2, ly, { size: 4, italic: true, color: s.c('orange') }));
      });
    }
  },
};

// ---------------------------------------------------------------- 2. the problem

const PROB_IN = [0.8, -1.2, 0.3, 0.5, -0.7, 1.1];
const PROB_G = [0.12, -0.4, 0.25, -0.3, 0.6, -0.15];

const problem: SceneDef = {
  marks: big({
    grad: { tex: String.raw`\symg = \Big[\frac{\partial \symf}{\partial \symx_1},\; \frac{\partial \symf}{\partial \symx_2},\; \dots\Big]`, x: 0.5, y: 0.11, size: 4 },
  }),
  draw(s) {
    const { w, h, u } = s;
    const A = s.ease('state', 0.6);
    const split = s.ease('inputs', 0.8);
    const cw = Math.min(w * 0.15, 16 * u);
    const ch = Math.min(h * 0.075, 7.5 * u);
    const gap = 1.3 * u;
    const top = h * 0.24;
    const cellY = (i: number) => top + i * (ch + gap) + (i >= 3 ? split * 6 * u : 0);
    const cx = w * 0.27;
    const gx = w * 0.07;
    const bx = w * 0.52;
    const bw = w * 0.2;
    const by = top - 2 * u;
    const bh = cellY(5) + ch - by + 2 * u;
    const cyMid = by + bh / 2;
    const fixed = s.ease('fixed', 0.5);
    const dw = s.ease('dw', 0.5);
    const dx = s.ease('dx', 0.5);
    s.alpha(A, () => {
      PROB_IN.forEach((v, i) => {
        const y = cellY(i);
        s.line(cx + cw + 5 * u, y + ch / 2, bx - u, cyMid + (i - 2.5) * 2.2 * u, s.tint('--ink-3', 0.5), 0.28);
        const k: Color = i >= 3 && split > 0.5 ? 'blue' : 'orange';
        s.alpha(i < 3 ? 1 - 0.45 * fixed : 1, () => s.cell(cx, y, cw, ch, num(v, 1), k, { size: 3.6 }));
        if (i < 3) s.alpha(fixed, () => lock(s, cx + cw + 2.6 * u, y + ch / 2 + 0.6 * u, 2.6 * u, s.c('--ink-3')));
        else
          s.alpha(fixed, () => {
            s.arrow(cx + cw + 2.6 * u, y + ch / 2, cx + cw + 2.6 * u, y + ch / 2 - 2.6 * u, s.c('blue'), 0.35, 1.2);
            s.arrow(cx + cw + 2.6 * u, y + ch / 2, cx + cw + 2.6 * u, y + ch / 2 + 2.6 * u, s.c('blue'), 0.35, 1.2);
          });
        const ga = s.ease('want', 0.5, 0.5 + i * 0.18);
        const on = i >= 3 ? dw : dx;
        const dim = i < 3 && dw > 0 ? 1 - 0.6 * dw * (1 - dx) : 1;
        s.alpha(ga * dim, () => s.cell(gx, y, cw, ch, num(PROB_G[i]!), 'teal', { size: 3.4, on }));
      });
      s.alpha(1 - split, () => s.text('inputs x', cx, top - 3 * u, { size: 3.6, italic: true, align: 'left', color: s.c('orange') }));
      s.alpha(split, () => {
        s.text('data X', cx, top - 3 * u, { size: 3.6, italic: true, align: 'left', color: s.c('orange') });
        s.text('weights W', cx, cellY(3) - 3 * u, { size: 3.6, italic: true, align: 'left', color: s.c('blue') });
      });
      s.alpha(s.ease('want', 0.5), () => s.text('gradient', gx, top - 3 * u, { size: 3.6, italic: true, align: 'left', color: s.c('teal') }));
      s.rrect(bx, by, bw, bh, 3, { fill: s.tint('purple', 0.08), stroke: s.c('purple'), lw: 0.5 });
      const lossA = s.ease('loss', 0.6);
      s.text('f', bx + bw / 2, cyMid - lossA * 4 * u, { size: 9, italic: true, weight: 600, color: s.c('purple') });
      s.alpha(lossA, () => s.text('the loss', bx + bw / 2, cyMid + 5 * u, { size: 3.6, font: 'mono', color: s.c('--ink-2') }));
      const ox = w * 0.8;
      const ow = Math.min(w * 0.13, 14 * u);
      s.arrow(bx + bw + u, cyMid, ox - u, cyMid, s.c('--ink-3'), 0.4);
      s.cell(ox, cyMid - ch / 2, ow, ch, '2.31', 'purple', { size: 3.6, on: lossA });
      s.text('one number', ox + ow / 2, cyMid + ch / 2 + 3.4 * u, { size: 3.2, italic: true, color: s.c('--ink-3') });
    });
    s.show('grad', s.ease('want', 0.6));
    const ty = h * 0.93;
    s.alpha(s.win('dw', 'dx'), () => s.text('W -= step_size * dW', w / 2, ty, { size: 3.8, font: 'mono', weight: 600, color: s.c('blue') }));
    s.alpha(dx, () => s.text('dX: free, and handy for visualizing', w / 2, ty, { size: 3.8, font: 'mono', weight: 600, color: s.c('teal') }));
  },
};

// ---------------------------------------------------------------- 3. derivative

const derivative: SceneDef = {
  marks: big({
    fxy: { tex: String.raw`\symf(\symx, y) = \symx\, y`, x: 0.5, y: 0.34, size: 9 },
    slope: { tex: String.raw`\frac{\symf(\symx + \symh,\, y) - \symf(\symx, y)}{\symh}`, x: 0.5, y: 0.4, size: 3.9, align: 'left' },
    px: { tex: String.raw`${G('f', 'x')} = y = -3`, x: 0.5, y: 0.26, size: 6 },
    py: { tex: String.raw`${G('f', 'y')} = \symx = 4`, x: 0.5, y: 0.5, size: 6 },
    grad: { tex: String.raw`\symg = \big[\,{-3},\;\; 4\,\big]`, x: 0.5, y: 0.78, size: 6.5 },
  }),
  draw(s) {
    const { w, h, u } = s;
    // Phase 1: the function and its values.
    const pA = s.win('small', 'nudge');
    s.show('fxy', pA);
    s.alpha(pA * s.ease('vals', 0.5), () => {
      const cw = Math.min(w * 0.2, 20 * u);
      const ch = 9 * u;
      const items: [string, string, Color][] = [
        ['x', '4', 'orange'],
        ['y', '−3', 'orange'],
        ['f', '−12', 'purple'],
      ];
      items.forEach(([name, v, k], i) => {
        const x = w / 2 + (i - 1) * (cw + 5 * u) - cw / 2;
        s.alpha(s.ease('vals', 0.5, i * 0.7), () => {
          s.text(name, x + cw / 2, h * 0.6 - 3.6 * u, { size: 4.4, italic: true, weight: 600, color: s.c(k) });
          s.cell(x, h * 0.6, cw, ch, v, k, { size: 4.2, on: i === 2 ? 0.6 : 0 });
        });
      });
    });
    // Phase 2: the slice f(x, -3) and a nudge.
    const gA = s.win('nudge', 'partial');
    if (gA > 0) {
      const fr = new Frame(s, area(s, 0.1, 0.06), [-0.8, 6.4, -20.5, 3.2]);
      let hh = 1;
      if (s.since('shrink') >= 0) hh = 10 ** lerp(0, -2, smooth((s.prog('shrink') - 0.1) / 0.6));
      s.slot('h', hh > 0.995 ? 1 : num(hh, hh < 0.1 ? 2 : 1));
      s.slot('slope', -3);
      s.alpha(gA, () => {
        fr.axes(0.9);
        s.text('x', fr.X(6.25), fr.Y(0) - 2.6 * u, { size: 3.6, italic: true, color: s.c('orange') });
        s.text('f', fr.X(0) + 2 * u, fr.Y(2.6), { size: 3.6, italic: true, color: s.c('purple'), align: 'left' });
        fr.fn((x) => -3 * x, s.c('purple'), 0.8);
        s.text('y frozen at −3', fr.X(1.4), fr.Y(1.6), { size: 3.4, italic: true, color: s.c('--ink-3'), align: 'left', halo: true });
        const nA = s.ease('nudge', 0.6, 0.8) * (1 - s.ease('sens', 0.5) * 0.7);
        s.alpha(nA, () => {
          s.line(fr.X(4), fr.Y(-12), fr.X(4 + hh), fr.Y(-12), s.c('slate'), 0.6);
          s.line(fr.X(4 + hh), fr.Y(-12), fr.X(4 + hh), fr.Y(-12 - 3 * hh), s.c('purple'), 0.6);
          fr.dot(4 + hh, -12 - 3 * hh, 0.9, s.c('purple'));
          s.alpha(clamp01((hh - 0.25) * 3), () => {
            s.text('h', fr.X(4 + hh / 2), fr.Y(-12) - 2.4 * u, { size: 3.4, font: 'mono', color: s.c('slate'), halo: true });
            s.text(`f moves ${num(-3 * hh)}`, fr.X(4 + hh) + 1.5 * u, fr.Y(-12 - 1.5 * hh), { size: 3.4, font: 'mono', color: s.c('purple'), align: 'left', halo: true });
          });
        });
        fr.dot(4, -12, 1.4, s.c('orange'));
        // The reading, lower left where the line is not.
        const ix = fr.X(-0.4);
        const iy = fr.Y(-10.5);
        const line = (i: number) => iy + i * 5.4 * u;
        s.alpha(s.ease('nudge', 0.5), () => s.text(`nudge x by h = ${hh > 0.995 ? 1 : num(hh, hh < 0.1 ? 2 : 1)}`, ix, line(0), { size: 3.6, font: 'mono', align: 'left', color: s.c('slate'), halo: true }));
        s.alpha(s.ease('why', 0.5), () => s.text('f = x · (−3)', ix, line(1), { size: 3.6, font: 'mono', align: 'left', color: s.c('purple'), halo: true }));
        s.show('slope', gA * s.ease('def', 0.6), { x: ix / w, y: (line(2) + 3.6 * u) / h });
        s.alpha(s.ease('def', 0.6, 1.2), () => s.text('= −3   (always)', ix, line(4.5), { size: 3.8, font: 'mono', weight: 650, align: 'left', color: s.c('teal'), halo: true }));
        s.alpha(s.ease('sens', 0.6), () => {
          s.arrow(fr.X(4), fr.Y(-12), fr.X(5.1), fr.Y(-12), s.c('orange'), 0.7, 2.4);
          s.text('push x up', fr.X(4.55), fr.Y(-12) - 2.6 * u, { size: 3.4, font: 'mono', color: s.c('orange'), halo: true });
          s.arrow(fr.X(4), fr.Y(-12), fr.X(4), fr.Y(-16.5), s.c('purple'), 0.7, 2.4);
          s.text('f drops 3×', fr.X(4), fr.Y(-16.5) + 3.4 * u, { size: 3.4, font: 'mono', color: s.c('purple'), halo: true });
        });
      });
    }
    // Phase 3: one partial derivative per input, and the gradient.
    const dA = s.ease('partial', 0.6);
    s.show('px', dA);
    s.show('py', s.ease('partial', 0.6, 1.4));
    s.alpha(dA, () => {
      s.text('slope along x, with y frozen', w / 2, h * 0.36, { size: 3.4, italic: true, color: s.c('--ink-3') });
      s.alpha(s.ease('partial', 0.6, 1.4), () => s.text('slope along y, with x frozen', w / 2, h * 0.6, { size: 3.4, italic: true, color: s.c('--ink-3') }));
    });
    s.show('grad', s.ease('grad', 0.6, 0.6));
    s.alpha(s.ease('grad', 0.6, 0.6), () => s.text('the gradient: all the partials, in a list', w / 2, h * 0.88, { size: 3.4, italic: true, color: s.c('teal') }));
  },
};

// ---------------------------------------------------------------- 4. three gates

interface GateInfo {
  head: string;
  fx: (x: number) => number;
  dom: [number, number, number, number];
  slope: number;
  lines: [string, string];
  sub: string;
}
const GATE_INFO: GateInfo[] = [
  { head: 'f = x · y', fx: (x) => -3 * x, dom: [-6, 6, -20, 20], slope: -3, lines: ['∂f/∂x = y = −3', '∂f/∂y = x = 4'], sub: 'the other input' },
  { head: 'f = x + y', fx: (x) => x - 3, dom: [-6, 6, -10, 4], slope: 1, lines: ['∂f/∂x = 1', '∂f/∂y = 1'], sub: 'always exactly 1' },
  { head: 'f = max(x, y)', fx: (x) => Math.max(x, -3), dom: [-6, 6, -5, 8], slope: 1, lines: ['∂f/∂x = 1', '∂f/∂y = 0'], sub: 'all or nothing' },
];

const gates: SceneDef = {
  draw(s) {
    const { u } = s;
    const [ax, ay, aw, ah] = area(s, 0.13, 0.04);
    const gap = 2 * u;
    const lit = (i: number) => {
      if (s.since('push') >= 0) return 1;
      if (s.since('max') >= 0) return i === 2 ? 1 : 0;
      if (s.since('add') >= 0) return i === 1 ? 1 : 0;
      return i === 0 ? 1 : 0;
    };
    const alongY = s.ease('maxwhy', 0.9);
    GATE_INFO.forEach((g, i) => {
      const a = s.ease('three', 0.5, i * 0.35);
      if (a <= 0) return;
      const rect: Rect = s.tall ? [ax, ay + i * ((ah - 2 * gap) / 3 + gap), aw, (ah - 2 * gap) / 3] : [ax + i * ((aw - 2 * gap) / 3 + gap), ay, (aw - 2 * gap) / 3, ah];
      const [px, py, pw, ph] = rect;
      const on = lit(i);
      s.alpha(a * (0.45 + 0.55 * on), () => {
        card(s, px, py, pw, ph, 'purple', on);
        const row = pw > ph * 1.5;
        const plot: Rect = row ? [px + 3 * u, py + 2.5 * u, pw * 0.48 - 3 * u, ph - 5 * u] : [px + 3 * u, py + 10 * u, pw - 6 * u, Math.min(pw - 6 * u, ph * 0.46)];
        const tx = row ? px + pw * 0.53 : px + 3 * u;
        const fsz = Math.min(3.6, ((row ? pw * 0.45 : pw - 6 * u) / u) / 9.5);
        const hy = row ? py + ph * 0.2 : py + 5.2 * u;
        const l1 = row ? py + ph * 0.44 : plot[1] + plot[3] + 6 * u;
        const l2 = l1 + fsz * u * 1.5;
        const l3 = l2 + fsz * u * 1.7;
        s.text(g.head, tx, hy, { size: fsz * 1.15, font: 'mono', weight: 650, color: s.c('purple'), align: 'left' });
        const maxY = i === 2 ? alongY : 0;
        const fr = new Frame(s, plot, g.dom);
        fr.axes(0.8, 2);
        const along = maxY > 0.5 ? 'y' : 'x';
        s.text(along, fr.X(5.4), fr.Y(0) - 1.8 * u, { size: 3, italic: true, color: s.c('orange') });
        const f = maxY > 0 ? (t: number) => lerp(g.fx(t), Math.max(4, t), maxY) : g.fx;
        fr.fn(f, s.c('purple'), 0.6);
        const wig = i === 2 && s.since('maxwhy') >= 0 && s.since('push') < 0 ? Math.sin(s.since('maxwhy') * 3.2) * 1.3 * smooth(s.since('maxwhy') - 0.8) : 0;
        const x0 = lerp(4, -3 + wig, maxY);
        const y0 = f(x0);
        const sl = lerp(g.slope, 0, maxY);
        s.alpha(on, () => {
          const run = 1.6;
          s.line(fr.X(x0), fr.Y(y0), fr.X(x0 + run), fr.Y(y0), s.c('slate'), 0.45);
          s.line(fr.X(x0 + run), fr.Y(y0), fr.X(x0 + run), fr.Y(y0 + sl * run), s.c('teal'), 0.6);
        });
        fr.dot(x0, y0, 1.1, s.c('orange'));
        s.alpha(i === 2 ? s.win('kink', 'push') : 0, () => {
          s.circle(fr.X(4), fr.Y(4), 2.2 * u, { stroke: s.c('--accent'), lw: 0.5 });
          s.text('tie: a kink', fr.X(4) - 3 * u, fr.Y(4) - 3.4 * u, { size: 3, font: 'mono', color: s.c('--accent'), align: 'right', halo: true });
        });
        const hiY = i === 2 && maxY > 0.5 && s.since('push') < 0;
        s.text(g.lines[0], tx, l1, { size: fsz, font: 'mono', weight: 600, color: hiY ? s.c('--ink-3') : s.c('teal'), align: 'left' });
        s.text(g.lines[1], tx, l2, { size: fsz, font: 'mono', weight: 600, color: s.c('teal'), align: 'left' });
        s.alpha(i === 2 ? s.win('maxwhy', 'kink') : 0, () => s.text('wiggle y: f stays 4', tx, l3, { size: fsz * 0.9, italic: true, color: s.c('--ink-2'), align: 'left' }));
        s.alpha(s.ease('push', 0.5, 1.2 + i * 0.5), () => s.text(g.sub, tx, l3, { size: fsz * 0.95, italic: true, color: s.c('--ink-2'), align: 'left' }));
      });
    });
  },
};

// ---------------------------------------------------------------- 5. chain rule

const chain: SceneDef = {
  marks: big({
    expr: { tex: String.raw`\symf = (\symx + y)\, z`, x: 0.5, y: 0.17, size: 7 },
    q1: { tex: String.raw`q = \symx + y`, x: 0.27, y: 0.36, size: 5.4 },
    q2: { tex: String.raw`\symf = q\, z`, x: 0.73, y: 0.36, size: 5.4 },
    l1: { tex: String.raw`\begin{aligned} ${LG('q', 'x')} &= 1 \\[8pt] ${LG('q', 'y')} &= 1 \end{aligned}`, x: 0.27, y: 0.57, size: 4.6 },
    l2: { tex: String.raw`\begin{aligned} ${LG('f', 'q')} &= z \\[8pt] ${LG('f', 'z')} &= q \end{aligned}`, x: 0.73, y: 0.57, size: 4.6 },
    want: { tex: String.raw`${G('f', 'x')} = \;?`, x: 0.5, y: 0.82, size: 5.4 },
    rule: { tex: String.raw`${G('f', 'x')} = ${G('f', 'q')} \cdot ${LG('q', 'x')}`, x: 0.5, y: 0.82, size: 5.4 },
    rulen: { tex: String.raw`${G('f', 'x')} = ${G('f', 'q')} \cdot ${LG('q', 'x')} = (-4)(1) = -4`, x: 0.5, y: 0.82, size: 5 },
    calc: { tex: String.raw`\big(g(h(x))\big)' = g'\big(h(x)\big)\; h'(x)`, x: 0.5, y: 0.42, size: 5.4 },
    dx: { tex: String.raw`\texttt{dx} \;\text{means}\; ${G('f', 'x')}`, x: 0.5, y: 0.88, size: 4.6 },
  }),
  draw(s) {
    const { w, h, u } = s;
    const eA = s.win('real', 'circuit');
    s.show('expr', eA);
    const pieces = s.win('name', 'gears');
    s.show('q1', pieces);
    s.show('q2', pieces * s.ease('name', 0.6, 1.6));
    s.show('l1', pieces * s.ease('local', 0.6, 3.2));
    s.show('l2', pieces * s.ease('local', 0.6, 0.2));
    s.show('want', s.win('want', 'chain'));
    s.show('rule', s.win('chain', 'gears'));
    s.show('rulen', s.win('gears', 'circuit'));
    // gears: a nudge rippling through the pipeline x -> q -> f
    const gA = s.win('gears', 'calc');
    s.alpha(gA, () => {
      const cy = h * 0.47;
      const xs = [w * 0.18, w * 0.5, w * 0.82];
      const names: [string, Color][] = [
        ['x', 'orange'],
        ['q', '--ink-2' as Color],
        ['f', 'purple'],
      ];
      const R = Math.min(7 * u, w * 0.07);
      const t = s.since('gears');
      xs.forEach((x, i) => {
        const pulse = i === 0 ? smooth((t - 1) / 0.4) : i === 1 ? smooth((t - 3.2) / 0.4) : smooth((t - 5.4) / 0.4);
        s.circle(x, cy, R, { fill: s.tint(names[i]![0] === 'q' ? '--ink-3' : names[i]![1], 0.08 + 0.12 * pulse), stroke: s.c(names[i]![1]), lw: 0.5 });
        s.text(names[i]![0], x, cy + 0.2 * u, { size: 5.4, italic: true, weight: 600, color: s.c(names[i]![1]) });
        const nudge = ['+0.1', '+0.1', '−0.4'][i]!;
        s.alpha(pulse, () => s.text(nudge, x, cy + R + 5 * u, { size: 4, font: 'mono', weight: 650, color: i === 2 ? s.c('purple') : s.c('--ink-2') }));
        if (i < 2) {
          s.arrow(x + R + u, cy, xs[i + 1]! - R - u, cy, s.c('--ink-3'), 0.45, 2);
          s.alpha(s.ease('gears', 0.5, i === 0 ? 1.8 : 4), () => s.text(i === 0 ? 'rate 1' : 'rate −4', (x + xs[i + 1]!) / 2, cy - 3.4 * u, { size: 3.8, font: 'mono', weight: 600, color: s.c('gold') }));
        }
      });
      s.alpha(s.ease('gears', 0.6, 6.4), () => s.text('rates multiply: 1 × (−4) = −4', w / 2, h * 0.67, { size: 4, font: 'mono', weight: 600, color: s.c('teal') }));
    });
    s.show('calc', s.win('calc', 'circuit'));
    s.alpha(s.win('calc', 'circuit'), () => s.text('outside, at the inside, times inside', w / 2, h * 0.54, { size: 3.6, italic: true, color: s.c('--ink-2') }));
    // the circuit
    const cA = s.ease('circuit', 0.6);
    if (cA > 0) {
      const k = walk(s, [
        ['fwd', [[0.25, 0], [0.5, 1], [0.62, 1], [0.92, 2]]],
        ['seed', [[0.05, 2], [0.5, 3]]],
        ['mulback', [[0.05, 3], [0.45, 4]]],
        ['addback', [[0.05, 4], [0.55, 5]]],
      ]);
      s.slot('q', k >= 0.9 ? 3 : '…');
      s.slot('f', k >= 1.9 ? -12 : '…');
      s.slot('dq', k >= 3.9 ? -4 : '…');
      s.slot('dz', k >= 3.9 ? 3 : '…');
      s.slot('dx', k >= 4.9 ? -4 : '…');
      s.slot('dy', k >= 4.9 ? -4 : '…');
      s.alpha(cA, () => {
        circuit(s, [w * 0.05, h * 0.1, w * 0.9, h * 0.68], CHAIN, CHAIN_EV, { k, size: 4, rMax: 7 });
        const ty = h * 0.86;
        s.alpha(s.win('result', 'dx'), () => {
          s.text('gradient [−4, −4, 3]', w / 2, ty - 2.4 * u, { size: 4.2, font: 'mono', weight: 650, color: s.c('teal') });
          s.alpha(s.ease('result', 0.5, 3), () => s.text('nudge x by 0.01: f moves −0.04', w / 2, ty + 3.4 * u, { size: 3.4, italic: true, color: s.c('--ink-2') }));
        });
        s.show('dx', cA * s.ease('dx', 0.6));
      });
    }
  },
};

// ---------------------------------------------------------------- 6. backprop is local

const local: SceneDef = {
  marks: big({
    eq: {
      tex: String.raw`\underbrace{${G('f', 'x')}}_{\text{downstream}} = \underbrace{${G('f', 'q')}}_{\text{upstream}} \times \underbrace{${LG('q', 'x')}}_{\text{local}}`,
      x: 0.5,
      y: 0.83,
      size: 4.4,
    },
  }),
  draw(s) {
    const { w, h, u } = s;
    // Phase 1: one gate, alone.
    const oA = s.win('pov', 'story');
    if (oA > 0) {
      const k = walk(s, [
        ['fwd', [[0.2, 0], [0.9, 0.5]]],
        ['two', [[0.05, 0.5], [0.3, 1]]],
        ['up', [[0.3, 1], [0.75, 2]]],
        ['rule', [[0.15, 2], [0.6, 3]]],
      ]);
      s.alpha(oA, () => {
        const rect: Rect = [w * 0.16, h * 0.14, w * 0.62, h * 0.52];
        const blind = s.since('blind') >= 0 && s.since('up') < 0 ? 0.55 + 0.45 * Math.sin(s.since('blind') * 4) ** 2 : 0.55;
        fog(s, w * 0.03, h * 0.12, w * 0.1, h * 0.56, s.ease('pov', 0.6) * blind);
        const geo = circuit(s, rect, ONE, ONE_EV, { k, size: 4.2, pad: [8, 5, 6, 5], rMax: 8.5, locals: { out: s.ease('two', 0.5, 1.4) } });
        fog(s, geo.out[0] + 3 * u, h * 0.24, w * 0.95 - geo.out[0] - 3 * u, h * 0.32, s.ease('pov', 0.6) * blind);
        const ly = h * 0.76;
        s.alpha(s.win('two', 'blind') * s.ease('two', 0.5, 1.4), () => s.text('gold: the local gradients', w / 2, ly, { size: 3.6, italic: true, color: s.c('gold') }));
        s.alpha(s.win('blind', 'up'), () => s.text('the rest of the circuit: unknown', w / 2, ly, { size: 3.6, italic: true, color: s.c('--ink-3') }));
        s.alpha(s.ease('up', 0.5, 1.6), () => s.text('upstream', (geo.at.get('out')![0] + geo.r + geo.out[0]) / 2, geo.out[1] + 8.4 * u, { size: 3.3, italic: true, color: s.c('teal'), halo: true }));
        s.alpha(s.win('rule', 'eq') * s.ease('rule', 0.5, 2), () => s.text('downstream = upstream × local', w / 2, ly, { size: 3.6, font: 'mono', weight: 600, color: s.c('teal') }));
      });
      s.show('eq', s.win('eq', 'story'));
    }
    // Phase 2: gates talking.
    const tA = s.win('story', 'libs');
    if (tA > 0) {
      const nudge = -0.25 * s.ease('story3', 1.4, 2.6);
      const ev = nudge ? evaluate(CHAIN, { x: CHAIN_IN.x + nudge, y: CHAIN_IN.y + nudge, z: CHAIN_IN.z }) : CHAIN_EV;
      s.alpha(tA, () => {
        const geo = circuit(s, [w * 0.05, h * 0.16, w * 0.9, h * 0.62], CHAIN, ev, {
          k: 5,
          size: 3.6,
          locals: { q: s.ease('story', 0.5, 2) },
          hot: { 'f:0': s.win('story2', 'story3'), 'q:0': s.win('story3', 'talk'), 'q:1': s.win('story3', 'talk') },
          ring: { q: s.ease('story', 0.5, 1) * (1 - s.ease('talk', 0.5)) },
        });
        const [qx, qy] = geo.at.get('q')!;
        const [fx, fy] = geo.at.get('f')!;
        const fb: [number, number, number, number] = [fx, fy + geo.r + 10 * u, fx, fy + geo.r];
        const qb: [number, number, number, number] = [qx + 31 * u, qy - geo.r - 6 * u, qx + geo.r * 0.7, qy - geo.r * 0.7];
        const talk = s.ease('talk', 0.5);
        bubble(s, ...fb, talk > 0.5 ? 'up or down? how hard?' : 'q: go down, force 4', 'teal', s.ease('story2', 0.5) * (talk > 0 ? Math.abs(1 - 2 * talk) : 1));
        bubble(s, ...qb, talk > 0.5 ? 'up or down? how hard?' : 'x, y: go down, force 4', 'teal', s.ease('story3', 0.5, 0.4) * (talk > 0 ? Math.abs(1 - 2 * talk) : 1));
        s.alpha(s.ease('story3', 0.6, 4), () => s.text(`f rises: −12 → ${num(ev.val.f!)}`, w / 2, h * 0.88, { size: 4, font: 'mono', weight: 650, color: s.c('green') }));
      });
    }
    // Phase 3: layers in a library.
    const lA = s.ease('libs', 0.6);
    if (lA > 0) {
      s.alpha(lA, () => {
        const n = 4;
        const cy = h * 0.42;
        const bw = w * 0.16;
        const bh = h * 0.2;
        const gap = (w * 0.88 - n * bw) / (n - 1);
        const t = s.since('graph');
        const fwd = t > 0 ? clamp01((t - 0.3) / 1.6) : 0;
        const bwd = t > 0 ? clamp01((t - 2.4) / 1.6) : 0;
        for (let i = 0; i < n; i++) {
          const x = w * 0.06 + i * (bw + gap);
          const fl = fwd * n > i + 0.5 ? 1 : 0;
          const bl = bwd * n > n - 0.5 - i ? 1 : 0;
          const k: Color = bl ? 'teal' : 'purple';
          s.rrect(x, cy - bh / 2, bw, bh, 2, { fill: s.tint(k, 0.06 + 0.12 * Math.max(fl * 0.6, bl)), stroke: s.c(k), lw: 0.45 });
          const lab = i === n - 1 ? 'loss' : s.since('a2') >= 0 && i === 0 ? 'affine' : 'layer';
          s.text(lab, x + bw / 2, cy, { size: 3.4, font: 'mono', weight: 600, color: s.c('--ink-2') });
          s.alpha(i < n - 1 ? 1 : 0, () => s.text('cache', x + bw / 2, cy + bh / 2 + 3.4 * u, { size: 3, font: 'mono', color: s.c('slate') }));
          if (i < n - 1) {
            s.arrow(x + bw + u, cy - bh * 0.25, x + bw + gap - u, cy - bh * 0.25, s.tint('--accent', fwd * n > i + 0.8 ? 1 : 0.4), 0.45, 1.8);
            s.arrow(x + bw + gap - u, cy + bh * 0.25, x + bw + u, cy + bh * 0.25, s.tint('teal', bwd * n > n - 1.2 - i ? 1 : 0.35), 0.45, 1.8);
          }
        }
        s.text('forward: compute, cache', w / 2, cy - bh / 2 - 4.5 * u, { size: 3.6, italic: true, color: s.c('--accent') });
        s.text('backward: upstream × local', w / 2, cy + bh / 2 + 9 * u, { size: 3.6, italic: true, color: s.c('teal') });
        s.alpha(s.ease('a2', 0.6), () => {
          s.text('affine_forward(x, w, b) → out, cache', w / 2, h * 0.82, { size: 3.2, font: 'mono', weight: 600, color: s.c('--accent') });
          s.text('affine_backward(dout, cache) → dx, dw, db', w / 2, h * 0.89, { size: 3.2, font: 'mono', weight: 600, color: s.c('teal') });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- 7. sigmoid neuron

function neuronSlots(s: Scene, k: number): void {
  const v = (id: string, at: number) => (k >= at - 0.1 ? cnum(NEURON_EV.val[id]!) : '…');
  const g = (id: string, at: number) => (k >= at - 0.1 ? cnum(NEURON_EV.grad[id]!) : '…');
  s.slot('dot', v('dot', 4));
  s.slot('neg', v('neg', 5));
  s.slot('ex', v('ex', 6));
  s.slot('den', v('den', 7));
  s.slot('f', v('f', 8));
  s.slot('dden', g('den', 10));
  s.slot('dex', g('ex', 11));
  s.slot('dneg', g('neg', 12));
  s.slot('ddot', g('dot', 13));
}

const GATE_CARDS: [string, string, string, string][] = [
  ['1/x', 'one over x', 'slope −1/x²', 'inv'],
  ['+c', 'add a constant', 'slope 1', 'addc'],
  ['×a', 'times a constant', 'slope a', 'addc'],
  ['exp', 'e to the x', 'slope eˣ', 'exp'],
];

const neuron: SceneDef = {
  marks: big({
    f: { tex: String.raw`\symf = \frac{1}{1 + e^{-(\sym{W}{w_0}\sym{x}{x_0} + \sym{W}{w_1}\sym{x}{x_1} + \sym{W}{w_2})}}`, x: 0.5, y: 0.15, size: 5 },
  }),
  draw(s) {
    const { w, h, u } = s;
    // Phase 1: the neuron.
    const nA = s.win('any', 'gates');
    s.show('f', s.win('formula', 'gates'));
    if (nA > 0) {
      s.alpha(nA, () => {
        const B: [number, number] = [w * 0.52, h * 0.6];
        const RB = Math.min(h * 0.13, w * 0.11);
        const ins: [number, number, string, string, string][] = [
          [w * 0.13, h * 0.44, 'x0', '−1', 'w0 = 2'],
          [w * 0.13, h * 0.78, 'x1', '−2', 'w1 = −3'],
        ];
        const vals = s.ease('nums', 0.5, 0.4);
        ins.forEach(([x, y, name, v, wl], i) => {
          s.arrow(x + 4 * u, y, B[0] - RB * 0.98, B[1] + (i ? 0.4 : -0.4) * RB, s.c('--ink-3'), 0.4, 2);
          s.circle(x, y, 4 * u, { fill: s.tint('orange', 0.12), stroke: s.c('orange'), lw: 0.45 });
          s.text(name, x - 5.5 * u, y, { size: 4.4, italic: true, weight: 600, color: s.c('orange'), align: 'right' });
          s.alpha(vals, () => s.text(v, x, y + 0.2 * u, { size: 3.4, font: 'mono', weight: 600 }));
          const mx = lerp(x, B[0] - RB, 0.5);
          const my = lerp(y, B[1] + (i ? 0.4 : -0.4) * RB, 0.5);
          const lab = vals > 0.5 ? wl : wl.split(' ')[0]!;
          const ly = my + (i ? 3.6 : -3.6) * u;
          s.alpha(s.ease('formula', 0.5, 0.8), () => s.text(lab, mx, ly, { size: 3.6, font: 'mono', weight: 600, color: s.c('blue'), halo: true }));
          const qx = mx + s.measure(lab, { size: 3.6, font: 'mono', weight: 600 }) / 2 + 2.6 * u;
          s.alpha(s.ease('question', 0.5, 0.3 + i * 0.4), () => s.text('?', qx, ly, { size: 5, font: 'display', weight: 650, color: s.c('teal'), halo: true }));
        });
        // bias from above
        s.arrow(B[0], B[1] - RB - 9 * u, B[0], B[1] - RB - u, s.c('--ink-3'), 0.4, 2);
        s.alpha(s.ease('formula', 0.5, 0.8), () => s.text(vals > 0.5 ? 'bias w2 = −3' : 'bias w2', B[0] + 2 * u, B[1] - RB - 6 * u, { size: 3.6, font: 'mono', weight: 600, color: s.c('blue'), align: 'left', halo: true }));
        s.alpha(s.ease('question', 0.5, 1.1), () => s.text('?', B[0] - 3 * u, B[1] - RB - 6 * u, { size: 5, font: 'display', weight: 650, color: s.c('teal') }));
        s.circle(B[0], B[1], RB, { fill: s.tint('purple', 0.07), stroke: s.c('purple'), lw: 0.55 });
        s.line(B[0], B[1] - RB, B[0], B[1] + RB, s.tint('purple', 0.5), 0.35);
        s.text('Σ', B[0] - RB * 0.48, B[1], { size: (RB / u) * 0.6, color: s.c('purple') });
        s.text('σ', B[0] + RB * 0.48, B[1], { size: (RB / u) * 0.6, italic: true, color: s.c('purple') });
        s.alpha(s.ease('formula', 0.5, 1.6), () => {
          s.text('sum', B[0] - RB * 0.48, B[1] + RB + 3.4 * u, { size: 3.2, italic: true, color: s.c('--ink-3') });
          s.text('squash', B[0] + RB * 0.48, B[1] + RB + 3.4 * u, { size: 3.2, italic: true, color: s.c('--ink-3') });
        });
        s.alpha(vals, () => s.text('1', B[0] - RB * 0.48, B[1] + RB * 0.5, { size: 3.4, font: 'mono', weight: 650 }));
        const ox = w * 0.9;
        s.arrow(B[0] + RB + u, B[1], ox - 4 * u, B[1], s.c('--ink-3'), 0.45, 2);
        s.text('f', ox - 2 * u, B[1], { size: 5, italic: true, weight: 600, color: s.c('purple'), align: 'left' });
        s.alpha(vals, () => s.text('0.73', (B[0] + RB + ox) / 2 - u, B[1] - 3.6 * u, { size: 3.8, font: 'mono', weight: 650, color: s.c('purple'), halo: true }));
      });
    }
    // Phase 2: four new gates.
    const gA = s.win('gates', 'fwd');
    if (gA > 0) {
      s.alpha(gA, () => {
        const [ax, ay, aw, ah] = area(s, 0.14, 0.07);
        const gap = 2.5 * u;
        const cwid = (aw - gap) / 2;
        const chei = Math.min((ah - gap) / 2, cwid * 0.62);
        const oy = ay + (ah - (2 * chei + gap)) / 2;
        GATE_CARDS.forEach(([glyph, name, slope, beat], i) => {
          const x = ax + (i % 2) * (cwid + gap);
          const y = oy + Math.floor(i / 2) * (chei + gap);
          const on = s.since(beat) >= 0 && (beat !== 'addc' || s.since('exp') < 0) && (beat !== 'inv' || s.since('addc') < 0) ? 1 : 0;
          s.alpha(s.ease('gates', 0.5, 0.3 + i * 0.3), () => {
            card(s, x, y, cwid, chei, 'gold', on);
            const r = Math.min(chei * 0.26, 6.5 * u);
            const cx = x + r + 3 * u;
            s.circle(cx, y + chei / 2, r, { fill: s.c('--card'), stroke: s.c('--ink'), lw: 0.4 });
            s.text(glyph, cx, y + chei / 2 + 0.15 * u, { size: (r / u) * (glyph.length > 2 ? 0.62 : 0.78), font: 'mono', weight: 600 });
            const fsz = Math.min(3.6, (cwid - 2 * r - 6 * u) / u / 9);
            s.text(name, cx + r + 2.4 * u, y + chei * 0.36, { size: fsz, align: 'left', color: s.c('--ink-2') });
            s.text(slope, cx + r + 2.4 * u, y + chei * 0.66, { size: fsz * 1.1, font: 'mono', weight: 650, align: 'left', color: s.c('gold') });
          });
        });
      });
    }
    // Phase 3: forward and backward through every gate.
    const cA = s.ease('fwd', 0.6);
    if (cA > 0) {
      const k = walk(s, [
        ['fwd', [[0.05, 0], [0.22, 4], [0.38, 5], [0.55, 6], [0.72, 7], [0.92, 8]]],
        ['back1', [[0.1, 8], [0.4, 9], [0.85, 10]]],
        ['back2', [[0.05, 10], [0.25, 11], [0.45, 11], [0.6, 12], [0.72, 12], [0.9, 13]]],
        ['back3', [[0.05, 13], [0.25, 15], [0.5, 16], [0.75, 17]]],
      ]);
      neuronSlots(s, k);
      s.alpha(cA, () => {
        const spec = s.tall ? NEURON_TALL : NEURON_WIDE;
        const geo = circuit(s, s.tall ? [w * 0.03, h * 0.04, w * 0.94, h * 0.92] : [w * 0.03, h * 0.1, w * 0.95, h * 0.84], spec, NEURON_EV, {
          k,
          size: 3.3,
          pad: s.tall ? [11, 4, 6, 15] : [12, 5, 7, 14],
          group: { ids: ['neg', 'ex', 'den', 'f'], label: 'together: σ', a: 0.85 },
          inputColor: neuronColor,
          ring: { w0: s.ease('answer', 0.5), w1: s.ease('answer', 0.5), w2: s.ease('answer', 0.5) },
        });
        s.alpha(s.ease('answer', 0.6, 1), () => {
          const bx = s.tall ? w * 0.56 : geo.at.get('dot')![0] + 4 * u;
          const by = s.tall ? h * 0.07 : h * 0.14;
          const bw = w * 0.4;
          s.rrect(bx, by, bw, 15 * u, 1.6, { fill: s.c('--card'), stroke: s.c('teal'), lw: 0.4 });
          s.text('to raise f:', bx + 2 * u, by + 4.4 * u, { size: 3.2, italic: true, align: 'left', color: s.c('--ink-2') });
          s.text('w0 ↓   w1 ↓   w2 ↑', bx + 2 * u, by + 10.4 * u, { size: 3.6, font: 'mono', weight: 650, align: 'left', color: s.c('blue') });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- 8. one sigmoid gate

const sigmoidScene: SceneDef = {
  marks: big({
    sig: { tex: String.raw`\sigma(z) = \frac{1}{1 + e^{-z}}`, x: 0.5, y: 0.16, size: 5.6 },
    dsig: { tex: String.raw`${LG('\\sigma', 'z')} = (1 - \sigma)\,\sigma`, x: 0.5, y: 0.82, size: 5.2 },
    val: { tex: String.raw`0.73 \times 0.27 = 0.197`, x: 0.5, y: 0.93, size: 4.4 },
  }),
  draw(s) {
    const { w, h, u } = s;
    // Phase 1: the four gates as one box.
    const bA = s.win('box', 'deriv');
    s.show('sig', bA);
    if (bA > 0) {
      s.alpha(bA, () => {
        circuit(s, [w * 0.03, h * 0.32, w * 0.94, h * 0.36], SIG4, SIG4_EV, {
          k: 9,
          size: 3.5,
          pad: [7, 6, 9, 6],
          group: { ids: ['neg', 'ex', 'den', 'f'], label: 'σ(z), in four gates', a: 1, lit: s.ease('box', 0.5, 1) },
        });
        s.alpha(s.ease('total', 0.6), () => {
          s.text('gradient in: 1      gradient out: 0.20', w / 2, h * 0.79, { size: 3.6, font: 'mono', color: s.c('teal') });
          s.text('× 0.197', w / 2, h * 0.88, { size: 6, font: 'mono', weight: 650, color: s.c('teal') });
        });
      });
    }
    // Phase 2: the curve and its slope.
    const pA = s.win('deriv', 'group');
    if (pA > 0) {
      const fr = new Frame(s, [w * 0.08, h * 0.1, w * 0.86, h * 0.6], [-6, 6, -0.08, 1.08]);
      s.alpha(pA, () => {
        fr.axes(0.9, 2);
        [0.5, 1].forEach((v) => s.text(String(v), fr.X(0) - 1.4 * u, fr.Y(v), { size: 3, font: 'mono', color: s.c('--ink-3'), align: 'right' }));
        s.text('z', fr.X(5.7), fr.Y(0) + 3 * u, { size: 3.4, italic: true });
        fr.fn(sigmoid, s.c('purple'), 0.8);
        s.text('σ(z)', fr.X(4.2), fr.Y(0.93), { size: 3.8, italic: true, color: s.c('purple'), halo: true });
        const cv = s.ease('curve', 0.9);
        s.alpha(cv, () => {
          fr.fn((z) => sigmoid(z) * (1 - sigmoid(z)), s.c('gold'), 0.7, -6, lerp(-6, 6, cv));
          s.text('slope peaks at 1/4', fr.X(0.7), fr.Y(0.33), { size: 3.4, font: 'mono', color: s.c('gold'), align: 'left', halo: true });
          s.alpha(s.ease('curve', 0.5, 2.4), () => {
            s.text('≈ 0', fr.X(-4.6), fr.Y(0.06) - 3 * u, { size: 3.2, font: 'mono', color: s.c('gold'), halo: true });
            s.text('≈ 0', fr.X(4.6), fr.Y(0.06) - 3 * u, { size: 3.2, font: 'mono', color: s.c('gold'), halo: true });
          });
        });
        const z0 = 1;
        const y0 = sigmoid(z0);
        s.alpha(s.ease('output', 0.6, 0.8), () => {
          fr.fn((z) => y0 + 0.1966 * (z - z0), s.c('teal'), 0.55, z0 - 2.4, z0 + 2.4, [1, 0.8]);
          s.text('slope 0.197', fr.X(1.6), fr.Y(0.6), { size: 3.4, font: 'mono', color: s.c('teal'), align: 'left', halo: true });
        });
        fr.dot(z0, y0, 1.3, s.c('orange'));
        s.text('σ(1) = 0.73', fr.X(z0) - 2 * u, fr.Y(y0) - 3 * u, { size: 3.4, font: 'mono', color: s.c('purple'), align: 'right', halo: true });
      });
      s.show('dsig', pA * s.ease('deriv', 0.6, 2.4));
      s.show('val', pA * s.ease('output', 0.6, 3.4));
    }
    // Phase 3: four gates collapse into one.
    const gA = s.win('group', 'code');
    if (gA > 0) {
      s.alpha(gA, () => {
        const cy = h * 0.44;
        const p = s.ease('group', 1.4, 0.4);
        const gx = (i: number) => lerp(w * 0.32, w * 0.74, i / 3);
        const cx = w * 0.53;
        const r = Math.min(6 * u, w * 0.05);
        s.text('z', w * 0.08, cy, { size: 4.6, italic: true, weight: 600, color: s.c('orange'), align: 'right' });
        s.line(w * 0.1, cy, w * 0.9, cy, s.tint('--ink-3', 0.85), 0.35);
        s.text('f', w * 0.92, cy, { size: 4.6, italic: true, weight: 600, color: s.c('purple'), align: 'left' });
        ['×−1', 'exp', '+1', '1/x'].forEach((g, i) => {
          s.alpha(1 - smooth((p - 0.6) / 0.4), () => {
            const x = lerp(gx(i), cx, p);
            s.circle(x, cy, r, { fill: s.c('--card'), stroke: s.c('--ink'), lw: 0.4 });
            s.text(g, x, cy + 0.15 * u, { size: (r / u) * (g.length > 2 ? 0.6 : 0.75), font: 'mono', weight: 600 });
          });
        });
        s.alpha(smooth((p - 0.55) / 0.4), () => {
          s.circle(cx, cy, r * 1.4, { fill: s.tint('purple', 0.1), stroke: s.c('purple'), lw: 0.6 });
          s.text('σ', cx, cy, { size: (r / u) * 1.3, italic: true, color: s.c('purple') });
          s.text('backward: dz = (1 − f) · f · df', w / 2, h * 0.66, { size: 3.8, font: 'mono', weight: 600, color: s.c('teal') });
        });
        s.alpha(s.ease('modular', 0.6), () => s.text('any group with a simple derivative can be one gate', w / 2, h * 0.78, { size: 3.6, italic: true, color: s.c('--ink-2') }));
      });
    }
    // Phase 4: the grouped neuron.
    const cA = s.ease('code', 0.6);
    if (cA > 0) {
      const k = walk(s, [
        ['code', [[0.1, 0], [0.55, 4], [0.95, 5]]],
        ['back', [[0.05, 5], [0.3, 7], [0.85, 11]]],
      ]);
      s.alpha(cA, () => {
        const geo = circuit(s, [w * 0.04, h * 0.2, w * 0.92, h * 0.76], GROUPED, GROUPED_EV, { k, size: 3.4, pad: [12, 5, 9, 14], inputColor: neuronColor });
        const st = s.ease('staged', 0.6);
        s.alpha(st, () => {
          const y = h * 0.16;
          const span = (x0: number, x1: number, label: string, k2: Color) => {
            s.line(x0, y, x1, y, s.c(k2), 0.45);
            s.line(x0, y, x0, y + 2 * u, s.c(k2), 0.45);
            s.line(x1, y, x1, y + 2 * u, s.c(k2), 0.45);
            s.text(label, (x0 + x1) / 2, y - 3 * u, { size: 3.4, font: 'mono', weight: 600, color: s.c(k2) });
          };
          span(geo.at.get('p0')![0] - geo.r, geo.at.get('dot')![0] + geo.r, 'stage 1: dot', 'blue');
          span(geo.at.get('f')![0] - geo.r, geo.at.get('f')![0] + geo.r * 1.6, 'stage 2: f', 'purple');
        });
      });
    }
  },
};

// ---------------------------------------------------------------- 9. staged backprop

const staged: SceneDef = {
  marks: big({
    fx: { tex: String.raw`\symf(\symx, y) = \frac{\symx + \sigma(y)}{\sigma(\symx) + (\symx + y)^2}`, x: 0.5, y: 0.4, size: 6.4 },
    m1: { tex: String.raw`\frac{\partial f}{\partial x} = \frac{\big(1\big)\big(\sigma(x) + (x+y)^2\big) - \big(x + \sigma(y)\big)\big(\sigma(x)(1-\sigma(x)) + 2(x+y)\big)}{\big(\sigma(x) + (x+y)^2\big)^2}`, x: 0.5, y: 0.66, size: 3.2 },
    m2: { tex: String.raw`\frac{\partial f}{\partial y} = \frac{\sigma(y)(1-\sigma(y))\big(\sigma(x) + (x+y)^2\big) - \big(x + \sigma(y)\big)\,2(x+y)}{\big(\sigma(x) + (x+y)^2\big)^2}`, x: 0.5, y: 0.84, size: 3.2 },
    sum: { tex: String.raw`${G('f', 'x')} = \sum_k ${G('f', 'q_k')}\, ${LG('q_k', 'x')}`, x: 0.5, y: 0.4, size: 5.4 },
  }),
  draw(s) {
    const { w, h, u } = s;
    const fA = s.win('awkward', 'stages');
    s.show('fx', fA, { y: lerp(0.4, 0.28, s.ease('page', 0.8)) });
    const mess = s.win('page', 'value', 0.8);
    s.show('m1', mess * s.ease('page', 0.6, 0.4) * 0.8);
    s.show('m2', mess * s.ease('page', 0.6, 1.4) * 0.8);
    s.alpha(s.win('value', 'stages'), () => {
      s.text('x = 3,  y = −4', w / 2, h * 0.6, { size: 5, font: 'mono', weight: 600, color: s.c('orange') });
      s.text('we only need a number, not a formula', w / 2, h * 0.72, { size: 3.6, italic: true, color: s.c('--ink-2') });
    });
    const cA = s.ease('stages', 0.6);
    if (cA <= 0) return;
    const k = walk(s, [
      ['stages', [[0.1, 0], [0.9, 4]]],
      ['graph', [[0.05, 4], [0.8, 8]]],
      ['back', [[0.05, 8], [0.25, 9], [0.85, 13]]],
      ['pieces', [[0.3, 13], [0.7, 14]]],
      ['total', [[0.25, 14], [0.42, 15], [0.6, 15], [0.78, 16]]],
      ['why', [[0.1, 16], [0.5, 17]]],
    ]);
    const x1 = STAGED_EV.edge['xpy:0']!;
    const x2 = x1 + STAGED_EV.edge['sigx:0']!;
    const x3 = x2 + STAGED_EV.edge['num:0']!;
    s.slot('f', k >= 7.9 ? cnum(STAGED_EV.val.f!) : '…');
    s.slot('dx1', k >= 13.9 ? cnum(x1) : '…');
    s.slot('dx2', k >= 14.9 ? cnum(x2) : '…');
    s.slot('dx3', k >= 15.9 ? cnum(x3) : '…');
    const fork = s.win('fork', 'why');
    const cache = s.win('cache', 'fork');
    const bA = s.ease('why', 0.6, 1.2);
    s.alpha(cA * (1 - 0.82 * bA), () => {
      circuit(s, [w * 0.03, h * 0.07, w * 0.94, h * 0.9], STAGED, STAGED_EV, {
        k,
        size: s.tall ? 3.2 : 3.3,
        pad: [11, 6, 5, 9],
        forkLabels: !s.tall,
        hot: { 'sigx:0': fork, 'xpy:0': fork, 'num:0': fork },
        ring: { x: fork, xpy: cache, sigx: cache, den: cache },
      });
    });
    s.alpha(bA, () => {
      const bw = Math.min(w * 0.84, 80 * u);
      const bx = (w - bw) / 2;
      const by = h * 0.26;
      const bh = h * 0.48;
      s.rrect(bx, by, bw, bh, 2.4, { fill: s.tint('--card', 0.92), stroke: s.c('--rule'), lw: 0.3 });
      s.show('sum', bA, { y: (by + bh * 0.3) / h });
      s.alpha(s.ease('bug', 0.6), () => {
        const tx = bx + bw * 0.12;
        s.text('dx += …   keeps every path', tx, by + bh * 0.66, { size: 3.6, font: 'mono', weight: 600, align: 'left', color: s.c('green') });
        s.text('dx  = …   drops a path', tx, by + bh * 0.84, { size: 3.6, font: 'mono', weight: 600, align: 'left', color: s.c('red') });
      });
    });
  },
};

// ---------------------------------------------------------------- 10. gate personalities

const BAR_X = [0.6, -0.3, 0.9, 0.4];

const patterns: SceneDef = {
  marks: big({
    s: { tex: String.raw`s = \sum_i w_i \symx_i \;\Rightarrow\; ${G('s', 'w_i')} = \symx_i`, x: 0.5, y: 0.18, size: 4.6 },
  }),
  draw(s) {
    const { w, h, u } = s;
    // Phase 1: one gate, three personalities.
    const pA = s.win('pers', 'all');
    if (pA > 0) {
      const cur = s.since('mul') >= 0 ? 2 : s.since('max') >= 0 ? 1 : 0;
      const beat = s.since('add') >= 0 ? (['add', 'max', 'mul'] as const)[cur] : 'pers';
      s.alpha(pA, () => {
        const tw = (w * 0.9) / 3;
        PERSONAS.forEach(([, label], i) => {
          const on = s.since('add') >= 0 ? (i === cur ? 1 : 0) : 0.4;
          const x = w * 0.05 + i * tw;
          s.rrect(x + u, h * 0.14, tw - 2 * u, 8 * u, 4, { fill: s.tint('purple', 0.04 + 0.14 * on), stroke: s.tint('purple', 0.25 + 0.75 * on), lw: 0.3 + 0.3 * on });
          s.text(label, x + tw / 2, h * 0.14 + 4.2 * u, { size: Math.min(3.4, (tw - 3 * u) / u / 10), font: 'mono', weight: 600, color: on > 0.5 ? s.c('purple') : s.c('--ink-3') });
        });
        const [spec, ev] = PERSONA_CIRCUITS[cur]!;
        s.alpha(s.ease(beat, 0.5), () => circuit(s, [w * 0.12, h * 0.26, w * 0.74, h * 0.6], spec, ev, { k: 3, size: 4, thick: true, pad: [8, 6, 10, 6] }));
        s.alpha(s.ease(beat, 0.5, 1), () => {
          const note = s.since('add') < 0 ? 'upstream gradient: 2' : ['both get 2, whatever x and y are', 'x was larger: it gets all 2', 'x gets y × 2, y gets x × 2'][cur]!;
          s.text(note, w / 2, h * 0.92, { size: 3.6, italic: true, color: s.c('teal') });
        });
      });
    }
    // Phase 2: all three in one circuit.
    const cA = s.win('all', 'scale');
    if (cA > 0) {
      const k = walk(s, [
        ['fwd', [[0.1, 0], [0.3, 1], [0.48, 2], [0.68, 3], [0.9, 4]]],
        ['b1', [[0.05, 4], [0.2, 5], [0.42, 6], [0.8, 7]]],
        ['b2', [[0.1, 7], [0.45, 8]]],
        ['b3', [[0.1, 8], [0.45, 9]]],
      ]);
      s.slot('m', k >= 0.9 ? -12 : '…');
      s.slot('n', k >= 1.9 ? 2 : '…');
      s.slot('f', k >= 3.9 ? -20 : '…');
      s.slot('ds', k >= 5.9 ? 2 : '…');
      s.alpha(cA, () => {
        const geo = circuit(s, [w * 0.05, h * 0.1, w * 0.9, h * 0.84], PATTERNS, PATTERNS_EV, { k, size: 3.5, ring: { w: s.ease('b2', 0.5, 2.2) * (1 - s.ease('b3', 0.4)) } });
        const tag = (id: string, text: string, a: number, dx: number, dy: number, align: CanvasTextAlign) => {
          const [x, y] = geo.at.get(id)!;
          s.alpha(a, () => s.text(text, x + dx * (geo.r + u), y + dy * (geo.r + 2.6 * u), { size: 3.2, italic: true, color: s.c('--accent'), align, halo: true }));
        };
        tag('s', 'distributes', s.ease('b1', 0.5, 3), 0.4, 1, 'left');
        tag('n', 'routes', s.ease('b2', 0.5, 1), 0, 1, 'center');
        tag('m', 'swaps', s.ease('b3', 0.5, 1), 0.5, -1, 'left');
      });
    }
    // Phase 3: input scale leaks into the gradient.
    const sA = s.win('scale', 'lin');
    if (sA > 0) {
      const [spec, ev] = SCALE_CIRCUIT;
      s.alpha(sA, () => {
        const geo = circuit(s, [w * 0.12, h * 0.14, w * 0.74, h * 0.62], spec, ev, { k: 3, size: 4, thick: true, pad: [8, 6, 10, 6], inputColor: (id) => (id === 'w' ? 'blue' : 'orange') });
        const [wx, wy] = geo.at.get('w')!;
        const [xx, xy] = geo.at.get('x')!;
        s.text('tiny', wx - 7 * u, wy + 5 * u, { size: 3.2, italic: true, color: s.c('--ink-3') });
        s.text('huge', xx - 7 * u, xy + 5 * u, { size: 3.2, italic: true, color: s.c('--ink-3') });
        s.alpha(s.ease('scale', 0.6, 2.5), () => s.text('the tiny input gets the huge gradient', w / 2, h * 0.88, { size: 3.6, italic: true, color: s.c('teal') }));
      });
    }
    const lA = s.ease('lin', 0.6);
    if (lA > 0) {
      const boost = s.ease('thousand', 1, 0.4) * (1 - s.ease('pre', 1, 0.6));
      s.show('s', lA);
      s.alpha(lA, () => {
        const base = h * 0.6;
        const unit = h * 0.28;
        const n = BAR_X.length;
        const gw = (w * 0.8) / n;
        s.line(w * 0.08, base, w * 0.92, base, s.c('--axis'), 0.35);
        BAR_X.forEach((v, i) => {
          const x = w * 0.1 + i * gw;
          const bw = gw * 0.3;
          const vv = v * lerp(1, 1000, boost);
          const hh = Math.max(-unit * 0.4, Math.min(unit, v * unit * lerp(1, 6, boost)));
          s.rrect(x + gw * 0.08, hh >= 0 ? base - hh : base, bw, Math.abs(hh), 0.6, { fill: s.tint('orange', 0.6) });
          s.rrect(x + gw * 0.08 + bw + u, hh >= 0 ? base - hh : base, bw, Math.abs(hh), 0.6, { fill: s.tint('teal', 0.6) });
          const ly = hh >= 0 ? base - hh - 2.6 * u : base - hh + 2.8 * u;
          s.text(num(vv, boost > 0.5 ? 0 : 1), x + gw * 0.08 + bw + u / 2, ly, { size: 3, font: 'mono', weight: 600, halo: true });
        });
        s.alpha(1 - boost, () => {
          s.text('data x', w / 2 - 2 * u, h * 0.84, { size: 3.6, font: 'mono', weight: 600, color: s.c('orange'), align: 'right' });
          s.text('gradient dw', w / 2 + 2 * u, h * 0.84, { size: 3.6, font: 'mono', weight: 600, color: s.c('teal'), align: 'left' });
        });
        s.alpha(boost, () => s.text('data × 1000  →  dw × 1000', w / 2, h * 0.84, { size: 3.8, font: 'mono', weight: 650, color: s.c('red') }));
        s.alpha(s.ease('pre', 0.6, 1), () => s.text('preprocess: center and scale the data', w / 2, h * 0.92, { size: 3.6, font: 'mono', weight: 600, color: s.c('green') }));
      });
    }
  },
};

// ---------------------------------------------------------------- 11. matrices

type Shape = [number, number];

/** A matrix drawn to scale: one square per number. */
function block(s: Scene, x: number, y: number, cs: number, [r, c]: Shape, k: Color, name: string, a = 1, hiRow = -1, hiCol = -1, hiCell?: Shape): void {
  s.alpha(a, () => {
    const c2 = s.ctx;
    c2.fillStyle = s.tint(k, 0.16);
    c2.fillRect(x, y, c * cs, r * cs);
    if (hiRow >= 0) {
      c2.fillStyle = s.tint(k, 0.45);
      c2.fillRect(x, y + hiRow * cs, c * cs, cs);
    }
    if (hiCol >= 0) {
      c2.fillStyle = s.tint(k, 0.45);
      c2.fillRect(x + hiCol * cs, y, cs, r * cs);
    }
    if (hiCell) {
      c2.fillStyle = s.c('gold');
      c2.fillRect(x + hiCell[1] * cs, y + hiCell[0] * cs, cs, cs);
    }
    c2.strokeStyle = s.tint(k, 0.3);
    c2.lineWidth = 1;
    c2.beginPath();
    for (let i = 1; i < c; i++) {
      c2.moveTo(x + i * cs, y);
      c2.lineTo(x + i * cs, y + r * cs);
    }
    for (let i = 1; i < r; i++) {
      c2.moveTo(x, y + i * cs);
      c2.lineTo(x + c * cs, y + i * cs);
    }
    c2.stroke();
    c2.strokeStyle = s.c(k);
    c2.lineWidth = s.u * 0.35;
    c2.strokeRect(x, y, c * cs, r * cs);
    s.text(name, x, y - 5.2 * s.u, { size: 3.6, font: 'mono', weight: 650, color: s.c(k), align: 'left' });
    s.text(`(${r}, ${c})`, x, y - 1.8 * s.u, { size: 2.9, font: 'mono', color: s.c('--ink-3'), align: 'left' });
  });
}

const RELU_X = [1.5, -0.7, 2.1, -2.0, 0.3, -0.4];
const RELU_D = [0.8, -0.5, 0.3, 0.9, -0.2, 0.6];

const matrices: SceneDef = {
  marks: big({
    dW: { tex: String.raw`\sym{g}{dW} = \sym{g}{dD}\, \sym{x}{X}^{\top}`, x: 0.3, y: 0.89, size: 5 },
    dX: { tex: String.raw`\sym{g}{dX} = \symW^{\top} \sym{g}{dD}`, x: 0.72, y: 0.89, size: 5 },
  }),
  draw(s) {
    const { w, h, u } = s;
    // One number becomes a whole matrix.
    const oA = s.win('mats', 'same');
    s.alpha(oA, () => {
      const cs = Math.min(w, h) * 0.1;
      const p = s.ease('mats', 1.2, 1.6);
      for (let r = 0; r < 5; r++)
        for (let c = 0; c < 3; c++) {
          const first = r === 2 && c === 1;
          s.alpha(first ? 1 : p, () => s.cell(w / 2 + (c - 1.5) * cs, h * 0.5 + (r - 2.5) * cs, cs * 0.92, cs * 0.92, first ? '3.0' : '', 'orange', { size: 3.4 }));
        }
      s.alpha(p, () => s.text('a whole matrix at once', w / 2, h * 0.88, { size: 3.8, italic: true, color: s.c('--ink-2') }));
    });
    const mA = s.win('same', 'jac');
    if (mA > 0) {
      const lay = s.ease('shape', 0.9);
      const n = s.since('sizes') >= 0 ? 5 : 5;
      const d = s.since('sizes') >= 0 ? 5 : 10;
      const m = 3;
      const showD = s.ease('mm', 0.5, 0.6);
      const showUp = s.ease('up', 0.5);
      const cols = d + 3 * m + 3 * 2.2;
      const cs0 = Math.min((w * 0.9) / cols, (h * 0.5) / 10);
      const cs1 = Math.min((w * 0.9) / cols, (h * 0.3) / 10);
      const cs = lerp(cs0, cs1, lay);
      const gap = 2.2 * cs;
      const total = (d + m + m + m) * cs + 3 * gap;
      const x0 = (w - total) / 2;
      const y0 = lerp(h * 0.22, h * 0.17, lay);
      const why = s.win('why', 'shape');
      s.alpha(mA, () => {
        block(s, x0, y0, cs, [n, d], 'blue', 'W', 1, -1, -1, why > 0.5 ? [1, 6] : undefined);
        s.text('·', x0 + d * cs + gap / 2, y0 + 2.5 * cs, { size: 5, color: s.c('--ink-3') });
        block(s, x0 + d * cs + gap, y0, cs, [d, m], 'orange', 'X', s.ease('mm', 0.5, 0.3), why > 0.5 ? 6 : -1);
        s.alpha(showD, () => s.text('=', x0 + (d + m) * cs + gap * 1.5, y0 + 2.5 * cs, { size: 5, color: s.c('--ink-3') }));
        block(s, x0 + (d + m) * cs + 2 * gap, y0, cs, [n, m], 'purple', 'D', showD, why > 0.5 ? 1 : -1);
        block(s, x0 + (d + 2 * m) * cs + 3 * gap, y0, cs, [n, m], 'teal', 'dD', showUp, why > 0.5 ? 1 : -1);
        s.alpha(showUp * (1 - lay), () => s.text('dD: same shape as D', x0 + (d + 2 * m) * cs + 2.5 * gap, y0 + n * cs + 4 * u, { size: 3.2, italic: true, color: s.c('teal') }));
        s.alpha(why, () => s.text('dW[1, 6] = dD[1, :] · X[6, :]', w / 2, h * 0.76, { size: 3.8, font: 'mono', weight: 650, color: s.c('teal') }));
        // Candidates: only one product has the right shape.
        s.alpha(lay, () => {
          const target = s.since('dX') >= 0 ? 'dX' : 'dW';
          const shp = (k: string): Shape => ({ W: [n, d], 'W.T': [d, n], X: [d, m], 'X.T': [m, d], dD: [n, m], 'dD.T': [m, n] })[k] as Shape;
          const cands: [string, string][] = target === 'dW' ? [['dD', 'X'], ['dD', 'X.T'], ['X', 'dD'], ['X.T', 'dD']] : [['W', 'dD'], ['W.T', 'dD'], ['dD', 'W'], ['dD.T', 'W']];
          const want = target === 'dW' ? shp('W') : shp('X');
          const ty = y0 + 10 * cs1 + 6 * u;
          s.text(`${target} must have the shape of ${target === 'dW' ? 'W' : 'X'}: (${want[0]}, ${want[1]})`, w * 0.06, ty, { size: 3.4, font: 'mono', weight: 650, align: 'left' });
          const rowH = Math.min(8.5 * u, (h * 0.95 - ty - 3 * u) / 4);
          cands.forEach(([a, b], i) => {
            const A = shp(a);
            const B = shp(b);
            const inner = A[1] === B[0];
            const ok = inner && A[0] === want[0] && B[1] === want[1];
            const right = (target === 'dW' && a === 'dD' && b === 'X.T') || (target === 'dX' && a === 'W.T');
            const y = ty + 3 * u + i * rowH;
            const k: Color = ok ? (right ? 'green' : 'gold') : 'red';
            s.alpha(s.ease(target === 'dX' ? 'dX' : 'shape', 0.4, 0.6 + i * 0.35), () => {
              s.rrect(w * 0.05, y, w * 0.9, rowH - u, 1.2, { fill: s.tint(k, ok ? 0.14 : 0.05) });
              s.text(`${a}.dot(${b})`, w * 0.07, y + (rowH - u) / 2, { size: 3.2, font: 'mono', weight: 650, align: 'left' });
              const note = !inner ? `${A[1]} ≠ ${B[0]}` : ok ? `→ (${A[0]}, ${B[1]}) ${right ? 'fits' : 'fits by accident'}` : `→ (${A[0]}, ${B[1]}) wrong`;
              s.text(note, w * 0.5, y + (rowH - u) / 2, { size: 3, font: 'mono', align: 'left', color: s.c(k) });
              s.text(ok ? '✓' : '✗', w * 0.93, y + (rowH - u) / 2, { size: 3.8, font: 'mono', weight: 700, color: s.c(k), align: 'right' });
            });
          });
        });
      });
      s.show('dW', mA * s.ease('formula', 0.6) * (1 - lay));
      s.show('dX', mA * s.ease('formula', 0.6, 1.6) * (1 - lay));
    }
    // Element-wise operations never build their Jacobian.
    const jA = s.win('jac', 'relu');
    if (jA > 0) {
      s.alpha(jA, () => {
        const N = 14;
        const size = Math.min(w * 0.6, h * 0.62);
        const cs = size / N;
        const gx = (w - size) / 2;
        const gy = h * 0.16;
        const diag = s.ease('diag', 1.2, 0.6);
        const rng = new Rng(5);
        for (let i = 0; i < N; i++)
          for (let j = 0; j < N; j++) {
            const v = rng.uniform(0.15, 0.6);
            const a = i === j ? 0.6 : v * (1 - diag);
            s.ctx.fillStyle = s.tint(i === j ? 'teal' : 'slate', a);
            s.ctx.fillRect(gx + j * cs + 0.5, gy + i * cs + 0.5, cs - 1, cs - 1);
          }
        s.rrect(gx, gy, size, size, 0.4, { stroke: s.c('--rule'), lw: 0.3 });
        s.text('Jacobian: 4096 × 4096 for one ReLU layer', w / 2, gy + size + 5 * u, { size: 3.4, font: 'mono', color: s.c('--ink-2') });
        s.alpha(diag, () => s.text('element-wise: only the diagonal', w / 2, gy + size + 11 * u, { size: 3.6, italic: true, color: s.c('teal') }));
      });
    }
    const rA = s.ease('relu', 0.6);
    if (rA > 0) {
      s.alpha(rA, () => {
        const rows: [string, string[], Color][] = [
          ['x', RELU_X.map((v) => num(v, 1)), 'orange'],
          ['x > 0', RELU_X.map((v) => (v > 0 ? '1' : '0')), 'slate'],
          ['dout', RELU_D.map((v) => num(v, 1)), 'teal'],
          ['dx', RELU_X.map((v, i) => (v > 0 ? num(RELU_D[i]!, 1) : '0')), 'teal'],
        ];
        const lw = 14 * u;
        const cw = (w * 0.9 - lw) / RELU_X.length;
        const ch = Math.min(9 * u, h * 0.15);
        const x0 = w * 0.05 + lw;
        const y0 = h * 0.17;
        rows.forEach(([name, vals, k], r) => {
          const y = y0 + r * (ch + 2.4 * u);
          s.alpha(s.ease('relu', 0.5, r * 0.8), () => {
            s.text(name, x0 - 2 * u, y + ch / 2, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c(k) });
            vals.forEach((v, i) => {
              const pass = RELU_X[i]! > 0;
              s.cell(x0 + i * cw + 0.4 * u, y, cw - 0.8 * u, ch, v, k, { size: 3.2, on: r === 3 && pass ? 0.8 : 0 });
            });
          });
        });
        s.alpha(s.ease('relu', 0.6, 3), () => s.text('dx = dout * (x > 0)', w / 2, h * 0.9, { size: 4, font: 'mono', weight: 650, color: s.c('teal') }));
      });
    }
  },
};

// ---------------------------------------------------------------- 12. recap

const TILES: [string, string, Color, string][] = [
  ['stages + cache', 'keep every value', 'purple', 'fwd'],
  ['upstream × local', 'one rule', 'teal', 'bwd'],
  ['forks add up', 'dx += …', 'teal', 'fork'],
  ['add', 'distributes', 'blue', 'pers'],
  ['max', 'routes', 'blue', 'pers'],
  ['multiply', 'swaps', 'blue', 'pers'],
  ['sigmoid', '(1 − f) · f', 'purple', 'sig'],
  ['matrices', 'shapes decide', 'orange', 'mat'],
];

const recap: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const cA = s.win('recap', 'fwd');
    if (cA > 0) {
      const k = lerp(0, 5, smooth(s.span('recap', 'fwd') * 1.1 - 0.05));
      s.alpha(cA, () => circuit(s, [w * 0.06, h * 0.16, w * 0.88, h * 0.7], CHAIN, CHAIN_EV, { k, size: 3.6 }));
    }
    const tA = s.ease('fwd', 0.6) * (1 - s.ease('next', 0.6, 0.3));
    if (tA > 0) {
      s.alpha(tA, () => {
        const [ax, ay, aw, ah] = area(s, 0.12, 0.05);
        const cols = s.tall ? 2 : 3;
        const rows = Math.ceil(TILES.length / cols);
        const gap = 2 * u;
        const tw = (aw - gap * (cols - 1)) / cols;
        const th = Math.min((ah - gap * (rows - 1)) / rows, tw * 0.6);
        const oy = ay + (ah - (th * rows + gap * (rows - 1))) / 2;
        TILES.forEach(([title, sub, k, beat], i) => {
          const a = s.ease(beat, 0.5, beat === 'pers' ? (i - 3) * 0.9 : 0);
          const row = Math.floor(i / cols);
          const inRow = Math.min(cols, TILES.length - row * cols);
          const x = ax + (aw - (inRow * tw + (inRow - 1) * gap)) / 2 + (i % cols) * (tw + gap);
          const y = oy + row * (th + gap);
          const on = a * (s.since('next') >= 0 ? 0.4 : 1);
          s.alpha(0.35 + 0.65 * a, () => {
            card(s, x, y, tw, th, k, on);
            const fsz = Math.min(4.6, (tw / u) * 0.11);
            s.text(title, x + tw / 2, y + th * 0.4, { size: fsz, font: 'display', weight: 600 });
            s.alpha(a, () => s.text(sub, x + tw / 2, y + th * 0.7, { size: fsz * 0.75, font: 'mono', color: s.c(k) }));
          });
        });
      });
    }
    const nA = s.ease('next', 0.7, 0.3);
    s.alpha(nA, () => {
      s.text('next: neural networks', w / 2, h * 0.42, { size: 6.2, font: 'display', weight: 600 });
      s.text('layers of simple gates, trained by this backward walk', w / 2, h * 0.55, { size: 3.5, italic: true, color: s.c('--ink-2') });
    });
  },
};

export const scenes: Record<string, SceneDef> = {
  intro,
  problem,
  derivative,
  gates,
  chain,
  local,
  neuron,
  sigmoid: sigmoidScene,
  staged,
  patterns,
  matrices,
  recap,
};
