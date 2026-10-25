// Drawing for the backprop explainers: gates as circles, wires carrying a value above and a gradient below.
import type { Color } from '../../core/symbols';
import { type Scene, clamp01, smooth } from '../../lecture/scene';

export type Ink = Color | `--${string}`;
/** A point of a graph: x across the graph's band (0 to 1), y as a fraction of the stage height. */
export type P = [number, number];

/** Maps graph points onto the stage: x across a centered band at most `maxW` units wide. */
export function band(s: Scene, maxW = 120, margin = 11): (p: P) => [number, number] {
  const w = Math.min(s.w / s.u - 2 * margin, maxW) * s.u;
  const x0 = (s.w - w) / 2;
  return ([fx, fy]) => [x0 + fx * w, fy * s.h];
}

/** A gate: a circle of radius `r` units with its operation inside; `on` lights it. */
export function gate(s: Scene, x: number, y: number, glyph: string, k: Ink = '--ink-2', on = 0, r = 5): void {
  s.circle(x, y, r * s.u, { fill: s.tint(k, 0.1 + 0.22 * on), stroke: s.tint(k, 0.55 + 0.45 * on), lw: 0.35 + 0.25 * on });
  const size = glyph.length > 2 ? r * 0.62 : r * 0.95;
  s.text(glyph, x, y + 0.2 * s.u, { size, font: glyph.length > 2 ? 'mono' : 'ui', weight: 600, color: s.c(k) });
}

/** A variable's name at a wire's end: right-aligned before `x` (an input) or left-aligned after it (an output). */
export function name(s: Scene, x: number, y: number, text: string, k: Ink, side: 'in' | 'out' = 'in', size = 4.8): void {
  s.text(text, side === 'in' ? x - 1.6 * s.u : x + 1.6 * s.u, y, { size, italic: true, weight: 550, align: side === 'in' ? 'right' : 'left', color: s.c(k) });
}

export interface WireOpts {
  /** Units trimmed from the start (a gate's radius) and the end. */
  r0?: number;
  r1?: number;
  /** The forward value, drawn above the wire. */
  val?: string;
  va?: number;
  /** The gradient, drawn below the wire in red. */
  grad?: string;
  ga?: number;
  /** A quiet label below the wire, such as the value's name, where no gradient is shown. */
  note?: string;
  na?: number;
  /** Where along the wire the labels sit, 0 to 1. */
  t?: number;
  /** Lights the wire, 0 to 1. */
  hot?: number;
  size?: number;
  /** Bends the wire: it runs level at the start's height until this fraction of the way, then turns. */
  elbow?: number;
}

/** The wire's drawn ends after trimming, and its unit normal pointing up the stage. */
function geom(s: Scene, x0: number, y0: number, x1: number, y1: number, r0 = 0, r1 = 0) {
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const ux = (x1 - x0) / len;
  const uy = (y1 - y0) / len;
  let nx = -uy;
  let ny = ux;
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  return { len, ax: x0 + ux * r0 * s.u, ay: y0 + uy * r0 * s.u, bx: x1 - ux * (r1 + 0.6) * s.u, by: y1 - uy * (r1 + 0.6) * s.u, nx, ny };
}

/** Where a label sits beside a wire: `t` along it, `side` 1 above or -1 below, `size` its text size. */
export function beside(s: Scene, x0: number, y0: number, x1: number, y1: number, t: number, side: 1 | -1, size = 3.7, r0 = 0, r1 = 0): [number, number] {
  const g = geom(s, x0, y0, x1, y1, r0, r1);
  const off = (size * 0.55 + 1.6) * s.u * side;
  return [g.ax + (g.bx - g.ax) * t + g.nx * off, g.ay + (g.by - g.ay) * t + g.ny * off];
}

/** A wire from (x0, y0) to (x1, y1) with an arrowhead, its value above and its gradient below. */
export function wire(s: Scene, x0: number, y0: number, x1: number, y1: number, o: WireOpts = {}): void {
  const g = geom(s, x0, y0, x1, y1, o.r0, o.r1);
  if (g.len < 1) return;
  const hot = o.hot ?? 0;
  const col = hot > 0 ? s.tint('--ink-2', 0.55 + 0.45 * hot) : s.c('--ink-3');
  s.arrow(g.ax, g.ay, g.bx, g.by, col, 0.35 + 0.2 * hot, 2.2);
  const t = o.t ?? 0.5;
  const size = o.size ?? 3.7;
  const at = (side: 1 | -1) => beside(s, x0, y0, x1, y1, t, side, size, o.r0, o.r1);
  if (o.val !== undefined) s.alpha(o.va ?? 1, () => s.text(o.val!, ...at(1), { size, font: 'mono', weight: 600, color: s.c('--ink'), halo: true }));
  if (o.grad !== undefined) s.alpha(o.ga ?? 1, () => s.text(o.grad!, ...at(-1), { size, font: 'mono', weight: 650, color: s.c('red'), halo: true }));
  if (o.note !== undefined) s.alpha(o.na ?? 1, () => s.text(o.note!, ...at(-1), { size: size * 0.95, italic: true, color: s.c('--ink-3'), halo: true }));
}

/** A dot travelling from (x0, y0) to (x1, y1) as `t` goes 0 to 1: a value going forward, a gradient going back. */
export function pulse(s: Scene, x0: number, y0: number, x1: number, y1: number, t: number, k: Ink): void {
  if (t <= 0 || t >= 1) return;
  const a = Math.sin(Math.PI * clamp01(t));
  s.alpha(a, () => s.circle(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 1.3 * s.u, { fill: s.c(k), stroke: s.c('--card'), lw: 0.3 }));
}

/** A line of mono text, centered on x. */
export function mono(s: Scene, text: string, x: number, y: number, k: Ink = '--ink-2', size = 3.6, align: CanvasTextAlign = 'center', weight = 550): void {
  s.text(text, x, y, { size, font: 'mono', weight, align, color: s.c(k), halo: true });
}

/** Maps a data window onto a stage rectangle, y up, for the plots. */
export class Frame {
  constructor(
    readonly s: Scene,
    readonly l: number,
    readonly t: number,
    readonly r: number,
    readonly b: number,
    readonly dom: [number, number, number, number],
  ) {}
  X(x: number): number {
    const [x0, x1] = this.dom;
    return this.l + ((x - x0) / (x1 - x0)) * (this.r - this.l);
  }
  Y(y: number): number {
    const [, , y0, y1] = this.dom;
    return this.b - ((y - y0) / (y1 - y0)) * (this.b - this.t);
  }
  /** The graph of `f` from `from` to `to`, clipped to the window. */
  fn(f: (x: number) => number, k: Ink, width = 0.7, from = this.dom[0], to = this.dom[1], dash?: number[]): void {
    const s = this.s;
    const c = s.ctx;
    c.save();
    c.beginPath();
    c.rect(this.l, this.t, this.r - this.l, this.b - this.t);
    c.clip();
    c.beginPath();
    const steps = 160;
    for (let i = 0; i <= steps; i++) {
      const x = from + ((to - from) * i) / steps;
      const py = Math.max(-1e4, Math.min(1e4, this.Y(f(x))));
      if (i) c.lineTo(this.X(x), py);
      else c.moveTo(this.X(x), py);
    }
    c.strokeStyle = s.c(k);
    c.lineWidth = width * s.u;
    c.lineJoin = 'round';
    c.setLineDash(dash ? dash.map((d) => d * s.u) : []);
    c.stroke();
    c.setLineDash([]);
    c.restore();
  }
  /** The axes through 0 where they fall inside the window. */
  axes(a = 1): void {
    const s = this.s;
    const [x0, x1, y0, y1] = this.dom;
    s.alpha(a, () => {
      if (y0 <= 0 && y1 >= 0) s.line(this.X(x0), this.Y(0), this.X(x1), this.Y(0), s.c('--axis'), 0.3);
      if (x0 <= 0 && x1 >= 0) s.line(this.X(0), this.Y(y0), this.X(0), this.Y(y1), s.c('--axis'), 0.3);
    });
  }
  dot(x: number, y: number, k: Ink, r = 1.3): void {
    this.s.circle(this.X(x), this.Y(y), r * this.s.u, { fill: this.s.c(k), stroke: this.s.c('--card'), lw: 0.35 });
  }
}

/** Eased 0 -> 1 starting a fraction `f` of the way through beat `id`, so it tracks the voice at any pace. */
export const after = (s: Scene, id: string, f: number, dur = 0.5): number => smooth((s.t - s.at(id) - f * (s.end(id) - s.at(id))) / dur);

/** Linear 0 -> 1 over `dur` seconds, from a fraction `f` of the way through beat `id`. */
export const runAfter = (s: Scene, id: string, f: number, dur = 1): number => clamp01((s.t - s.at(id) - f * (s.end(id) - s.at(id))) / dur);

/** Points of the graph of f = (x z + c)^2, which the comp-graph and backprop-graph explainers share. */
export const NEURON = {
  x: [0, 0.3] as P,
  z: [0, 0.5] as P,
  c: [0, 0.74] as P,
  mul: [0.32, 0.4] as P,
  add: [0.6, 0.56] as P,
  sq: [0.83, 0.56] as P,
  out: [1, 0.56] as P,
};

export interface NeuronOpts {
  /** Entrance of each gate with its wires: multiply, add, square. */
  show: number[];
  on?: number[];
  /** Per wire, in the order x, z, c, q, r, f: the value above and its alpha. */
  vals?: string[];
  va?: number[];
  /** The gradient below each wire, in red, and its alpha. */
  grads?: string[];
  ga?: number[];
  /** Alpha of the names q and r under their wires, where no gradient is shown. */
  names?: number;
  hot?: number[];
}

/** The graph of f = (x z + c)^2: inputs on the left, one gate per operation, the output on the right. */
export function neuron(s: Scene, g: NeuronOpts, r = 5): void {
  const at = band(s, 110);
  const [wx, wy] = at(NEURON.x);
  const [xx, xy] = at(NEURON.z);
  const [bx, by] = at(NEURON.c);
  const [mx, my] = at(NEURON.mul);
  const [ax, ay] = at(NEURON.add);
  const [sx, sy] = at(NEURON.sq);
  const [ox, oy] = at(NEURON.out);
  const v = g.vals ?? [];
  const va = g.va ?? [];
  const gr = g.grads ?? [];
  const ga = g.ga ?? [];
  const hot = g.hot ?? [];
  const on = g.on ?? [0, 0, 0];
  const nm = g.names ?? 0;
  const o = (i: number) => ({ val: v[i], va: va[i] ?? 0, grad: gr[i], ga: ga[i] ?? 0, hot: hot[i] ?? 0 });
  s.alpha(g.show[0]!, () => {
    name(s, wx, wy, 'x', 'orange');
    name(s, xx, xy, 'z', '--ink-2');
    wire(s, wx, wy, mx, my, { r1: r, t: 0.32, ...o(0) });
    wire(s, xx, xy, mx, my, { r1: r, t: 0.32, ...o(1) });
    wire(s, mx, my, ax, ay, { r0: r, r1: r, ...o(3), note: 'q', na: nm });
    gate(s, mx, my, '×', '--ink-2', on[0]);
  });
  s.alpha(g.show[1]!, () => {
    name(s, bx, by, 'c', '--ink-2');
    wire(s, bx, by, ax, ay, { r1: r, t: 0.42, ...o(2) });
    wire(s, ax, ay, sx, sy, { r0: r, r1: r, ...o(4), note: 'r', na: nm });
    gate(s, ax, ay, '+', '--ink-2', on[1]);
  });
  s.alpha(g.show[2]!, () => {
    wire(s, sx, sy, ox, oy, { r0: r, ...o(5) });
    name(s, ox, oy, 'f', 'purple', 'out');
    gate(s, sx, sy, 'x²', '--ink-2', on[2]);
  });
}
