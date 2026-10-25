import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp, smooth } from '../../../lecture/scene';
import { after, band, beside, gate, mono, name, type P, pulse, runAfter, wire } from '../draw';

const R = 7;
const SIZE = 4.4;
const XI: P = [0, 0.3];
const ZI: P = [0, 0.72];
const G: P = [0.55, 0.51];
const O: P = [1, 0.51];

interface Gate {
  glyph: string;
  /** Forward values of x, z and q. */
  vals: [string, string, string];
  va: number;
  /** The upstream gradient's label and pulse. */
  ua: number;
  ut: number;
  /** Local slopes beside each input wire, in gold. */
  local: [string, string];
  la: [number, number];
  /** Gradients sent back to x and z, with their pulses. */
  grads: [string, string];
  ga: [number, number];
  gt: [number, number];
  on: number;
  hot?: [number, number];
}

function pts(s: Scene) {
  const at = band(s, 100, 12);
  return { x: at(XI), z: at(ZI), g: at(G), o: at(O) };
}

/** Where a label sits by input k's wire: `t` along it, above (1) or below (-1). */
function spot(s: Scene, k: 0 | 1, t: number, side: 1 | -1): [number, number] {
  const p = pts(s);
  const [x0, y0] = k === 0 ? p.x : p.z;
  return beside(s, x0, y0, p.g[0], p.g[1], t, side, SIZE, 0, R);
}

const goldText = (s: Scene, text: string, at: [number, number]) => s.text(text, at[0], at[1], { size: SIZE, font: 'mono', weight: 650, color: s.c('gold'), halo: true });

function drawGate(s: Scene, c: Gate): void {
  const p = pts(s);
  const [gx, gy] = p.g;
  const hot = c.hot ?? [0, 0];
  name(s, ...p.x, 'x', 'orange', 'in', 5.4);
  name(s, ...p.z, 'z', '--ink-2', 'in', 5.4);
  wire(s, ...p.x, gx, gy, { r1: R, val: c.vals[0], va: c.va, grad: c.grads[0], ga: c.ga[0], t: 0.4, size: SIZE, hot: hot[0] });
  wire(s, ...p.z, gx, gy, { r1: R, val: c.vals[1], va: c.va, grad: c.grads[1], ga: c.ga[1], t: 0.4, size: SIZE, hot: hot[1] });
  wire(s, gx, gy, ...p.o, { r0: R, val: c.vals[2], va: c.va, grad: '2', ga: c.ua, size: SIZE });
  name(s, ...p.o, 'q', '--ink-2', 'out', 5.4);
  gate(s, gx, gy, c.glyph, '--ink-2', c.on, R);
  s.alpha(c.la[0], () => goldText(s, c.local[0], spot(s, 0, 0.82, 1)));
  s.alpha(c.la[1], () => goldText(s, c.local[1], spot(s, 1, 0.82, -1)));
  pulse(s, ...p.o, gx, gy, c.ut, 'red');
  pulse(s, gx, gy, ...p.x, c.gt[0], 'red');
  pulse(s, gx, gy, ...p.z, c.gt[1], 'red');
}

/** Two equation lines under the graph. */
function equations(s: Scene, lines: [string, string], a: [number, number]): void {
  lines.forEach((t, i) => s.alpha(a[i]!, () => mono(s, t, s.w / 2, s.h * (0.84 + 0.08 * i), 'red', 3.8, 'center', 600)));
}

const add: SceneDef = {
  marks: { f: { tex: String.raw`q = \symx + z`, x: 0.5, y: 0.1, size: 5.6 } },
  draw(s) {
    const a = s.ease('gate', 0.6);
    s.show('f', a);
    s.alpha(a, () =>
      drawGate(s, {
        glyph: '+',
        vals: ['3', '−4', '−1'],
        va: after(s, 'gate', 0.5),
        ua: after(s, 'up', 0.55),
        ut: runAfter(s, 'up', 0.3),
        local: ['×1', '×1'],
        la: [after(s, 'local', 0.25), after(s, 'local', 0.35)],
        grads: ['2', '2'],
        ga: [after(s, 'copy', 0.3), after(s, 'copy', 0.3)],
        gt: [runAfter(s, 'copy', 0.05), runAfter(s, 'copy', 0.05)],
        on: s.win('local', 'copy'),
      }),
    );
    equations(s, ['∂L/∂x = 1 × 2 = 2', '∂L/∂z = 1 × 2 = 2'], [after(s, 'copy', 0.45), after(s, 'copy', 0.55)]);
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
    const fx = runAfter(s, 'slope', 0.4, 1.2);
    const fz = runAfter(s, 'swap', 0.5, 1.2);
    drawGate(s, {
      glyph: '×',
      vals: ['3', '−4', '−12'],
      va: after(s, 'gate', 0.45),
      ua: after(s, 'gate', 0.72),
      ut: runAfter(s, 'gate', 0.55),
      local: ['×(−4)', '×3'],
      la: [fx >= 1 ? 1 : 0, fz >= 1 ? 1 : 0],
      grads: ['−8', '6'],
      ga: [after(s, 'swap', 0.3), after(s, 'swap', 0.85)],
      gt: [runAfter(s, 'swap', 0.1), runAfter(s, 'swap', 0.65)],
      on: s.win('slope', 'rule'),
    });
    fly(s, '−4', spot(s, 1, 0.4, 1), spot(s, 0, 0.82, 1), fx);
    fly(s, '3', spot(s, 0, 0.4, 1), spot(s, 1, 0.82, -1), fz);
    equations(s, ['∂L/∂x = z × 2 = −8', '∂L/∂z = x × 2 = 6'], [after(s, 'swap', 0.4), after(s, 'swap', 0.9)]);
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
      ua: after(s, 'gate', 0.55),
      ut: runAfter(s, 'gate', 0.4),
      local: ['×0', '×1'],
      la: [after(s, 'route', 0.12), after(s, 'route', 0.4)],
      grads: ['0', '2'],
      ga: [after(s, 'route', 0.9), after(s, 'route', 0.72)],
      gt: [0, runAfter(s, 'route', 0.55)],
      on: s.win('route', 'router'),
      hot: [0, after(s, 'gate', 0.75)],
    });
    const eq = 1 - s.ease('router', 0.5);
    equations(s, ['∂L/∂x = 0', '∂L/∂z = 1 × 2 = 2'], [after(s, 'route', 0.92) * eq, after(s, 'route', 0.75) * eq]);
    const gap = s.tall ? 30 : 34;
    RULES.forEach(([g, verb], i) => {
      s.alpha(after(s, 'router', 0.1 + 0.15 * i), () => {
        const x = s.w / 2 + (i - 1) * gap * s.u - 5 * s.u;
        const y = s.h * 0.88;
        gate(s, x, y, g, 'teal', 0.4, 4);
        s.text(verb, x + 5.6 * s.u, y, { size: 3.6, font: 'mono', weight: 600, align: 'left', color: s.c('teal') });
      });
    });
  },
};

export const scenes: Record<string, SceneDef> = { add, mul, max };
