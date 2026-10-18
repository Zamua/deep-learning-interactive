import { color, withAlpha } from '../core/plot';

/** Gate types a circuit can contain; `c` is the constant for addc / mulc. */
export type Op = 'add' | 'mul' | 'max' | 'exp' | 'inv' | 'addc' | 'mulc' | 'sig' | 'sq';

export interface CInput {
  id: string;
  label?: string;
  at: [number, number];
}

export interface COp {
  id: string;
  op: Op;
  ins: string[];
  c?: number;
  at: [number, number];
  /** Variable name drawn above the gate (staged code), e.g. "num". */
  name?: string;
  /** Position of each incoming wire's labels along the wire, 0..1 (default 0.5). */
  t?: number[];
}

export interface CircuitSpec {
  inputs: CInput[];
  ops: COp[];
  /** Grid extent in layout units: [cols, rows]. */
  size: [number, number];
  /** 'wire': value above / gradient below every wire. 'node': both under each gate. */
  labels?: 'wire' | 'node';
  /** Name of the final output drawn on its stub wire. */
  outName?: string;
}

export interface Evaluated {
  val: Record<string, number>;
  /** Total gradient of the output with respect to every node. */
  grad: Record<string, number>;
  /** Gradient flowing down the k-th input wire of op o, keyed `o:k`. */
  edge: Record<string, number>;
  /** Local gradient of op o with respect to its k-th input, keyed `o:k`. */
  local: Record<string, number>;
  /** Gradient seeded at the output (1 for a whole circuit, any upstream value for one gate). */
  seed: number;
}

export const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

export function glyph(o: COp): string {
  switch (o.op) {
    case 'add':
      return '+';
    case 'mul':
      return '×';
    case 'max':
      return 'max';
    case 'exp':
      return 'exp';
    case 'inv':
      return '1/x';
    case 'addc':
      return `+${o.c}`;
    case 'mulc':
      return `×${o.c! < 0 ? '−' + Math.abs(o.c!) : o.c}`;
    case 'sig':
      return 'σ';
    case 'sq':
      return 'x²';
  }
}

function fwd(o: COp, a: number[]): number {
  switch (o.op) {
    case 'add':
      return a[0]! + a[1]!;
    case 'mul':
      return a[0]! * a[1]!;
    case 'max':
      return Math.max(a[0]!, a[1]!);
    case 'exp':
      return Math.exp(a[0]!);
    case 'inv':
      return 1 / a[0]!;
    case 'addc':
      return a[0]! + o.c!;
    case 'mulc':
      return a[0]! * o.c!;
    case 'sig':
      return sigmoid(a[0]!);
    case 'sq':
      return a[0]! * a[0]!;
  }
}

/** d(out)/d(input k), computed only from the gate's own inputs and output. */
function localGrad(o: COp, k: number, a: number[], out: number): number {
  switch (o.op) {
    case 'add':
      return 1;
    case 'mul':
      return a[1 - k]!;
    case 'max':
      return k === 0 ? (a[0]! >= a[1]! ? 1 : 0) : a[1]! > a[0]! ? 1 : 0;
    case 'exp':
      return out;
    case 'inv':
      return -1 / (a[0]! * a[0]!);
    case 'addc':
      return 1;
    case 'mulc':
      return o.c!;
    case 'sig':
      return out * (1 - out);
    case 'sq':
      return 2 * a[0]!;
  }
}

export function evaluate(spec: CircuitSpec, inputs: Record<string, number>, seed = 1): Evaluated {
  const val: Record<string, number> = { ...inputs };
  for (const o of spec.ops) val[o.id] = fwd(o, o.ins.map((i) => val[i]!));
  const grad: Record<string, number> = {};
  const edge: Record<string, number> = {};
  const local: Record<string, number> = {};
  const last = spec.ops[spec.ops.length - 1]!;
  grad[last.id] = seed;
  for (const o of [...spec.ops].reverse()) {
    const up = grad[o.id] ?? 0;
    const a = o.ins.map((i) => val[i]!);
    o.ins.forEach((src, k) => {
      const lg = localGrad(o, k, a, val[o.id]!);
      local[`${o.id}:${k}`] = lg;
      edge[`${o.id}:${k}`] = up * lg;
      grad[src] = (grad[src] ?? 0) + up * lg;
    });
  }
  return { val, grad, edge, local, seed };
}

const GATE_NAME: Record<Op, string> = { add: 'add', mul: 'multiply', max: 'max', exp: 'exp', inv: '1/x', addc: 'add-a-constant', mulc: 'multiply-by-a-constant', sig: 'sigmoid', sq: 'square' };

function expr(o: COp, n: string[]): string {
  switch (o.op) {
    case 'add':
      return `${n[0]} + ${n[1]}`;
    case 'mul':
      return `${n[0]} × ${n[1]}`;
    case 'max':
      return `max(${n[0]}, ${n[1]})`;
    case 'exp':
      return `exp(${n[0]})`;
    case 'inv':
      return `1 / ${n[0]}`;
    case 'addc':
      return `${n[0]} + ${o.c}`;
    case 'mulc':
      return `${o.c} × ${n[0]}`;
    case 'sig':
      return `σ(${n[0]})`;
    case 'sq':
      return `${n[0]}²`;
  }
}

/** Markdown narrating step `step` of a walk (see `reveal`), with the real numbers. */
export function describe(spec: CircuitSpec, ev: Evaluated, step: number, nameOf: (id: string) => string = (id) => id): string {
  const n = spec.ops.length;
  if (step === 0) return `The inputs: ${spec.inputs.map((i) => `${nameOf(i.id)} = ${f2(ev.val[i.id]!)}`).join(', ')}. Step forward to run the circuit.`;
  if (step <= n) {
    const o = spec.ops[step - 1]!;
    const ins = o.ins.map(nameOf);
    const nums = o.ins.map((i) => f2(ev.val[i]!));
    return `**Forward**, ${GATE_NAME[o.op]} gate: ${nameOf(o.id)} = ${expr(o, ins)} = ${expr(o, nums)} = **${f2(ev.val[o.id]!)}**.${step === n ? ' The forward pass is done.' : ''}`;
  }
  if (step === n + 1) return `**Backward** starts at the output. Its gradient with respect to itself is ${f2(ev.seed)}${ev.seed === 1 ? ': nudge the output by 1 and it moves by 1' : ''}.`;
  const r = step - n - 2;
  const o = spec.ops[n - 1 - r]!;
  const up = ev.grad[o.id]!;
  const parts = o.ins.map((src, k) => {
    const key = `${o.id}:${k}`;
    const used = spec.ops.filter((c) => c.ins.includes(src)).length;
    return `\`d${src}\` ${used > 1 ? '+=' : '='} ${f2(ev.local[key]!)} × ${f2(up)} = ${f2(ev.edge[key]!)}`;
  });
  return `**Backward** through the ${GATE_NAME[o.op]} gate. Upstream gradient ${f2(up)}, times each local gradient: ${parts.join('; ')}.`;
}

/**
 * One frame of a forward/backward walk. Step 0 shows only the inputs; steps 1..n reveal each
 * op's output; step n+1 seeds the output gradient with 1; then one step per op in reverse.
 */
export interface Reveal {
  values: Set<string>;
  edges: Set<string>;
  seeded: boolean;
  /** Ops lit this step, and which direction the step runs. */
  active: string[];
  phase: 'inputs' | 'forward' | 'seed' | 'backward';
}

export function stepCount(spec: CircuitSpec): number {
  return 2 * spec.ops.length + 2;
}

export function reveal(spec: CircuitSpec, step: number): Reveal {
  const n = spec.ops.length;
  const values = new Set(spec.inputs.map((i) => i.id));
  const edges = new Set<string>();
  const nf = Math.min(step, n);
  for (let k = 0; k < nf; k++) values.add(spec.ops[k]!.id);
  const seeded = step >= n + 1;
  const nb = Math.max(0, step - n - 1);
  for (let r = 0; r < nb; r++) {
    const o = spec.ops[n - 1 - r]!;
    o.ins.forEach((_, k) => edges.add(`${o.id}:${k}`));
  }
  let active: string[] = [];
  let phase: Reveal['phase'] = 'inputs';
  if (step >= 1 && step <= n) {
    active = [spec.ops[step - 1]!.id];
    phase = 'forward';
  } else if (step === n + 1) {
    active = [spec.ops[n - 1]!.id];
    phase = 'seed';
  } else if (step > n + 1) {
    active = [spec.ops[n - 1 - (nb - 1)]!.id];
    phase = 'backward';
  }
  return { values, edges, seeded, active, phase };
}

/** Everything visible: values and every gradient. */
export function revealAll(spec: CircuitSpec): Reveal {
  return reveal(spec, stepCount(spec) - 1);
}

/** Two decimals, the way circuit diagrams usually print numbers; never "-0.00". */
export function f2(v: number): string {
  const s = v.toFixed(2);
  return s === '-0.00' ? '0.00' : s;
}

interface DrawOpts {
  /** Scale wires by |gradient| (the gate-patterns playground). */
  thickByGrad?: boolean;
  /** Ops to box together with a caption, e.g. the four gates that make up a sigmoid. */
  group?: { ids: string[]; label: string; lit?: boolean };
  /** Total gradient badges under inputs with more than one outgoing wire. */
  forkTotals?: boolean;
  /** Branch gradients on the wires of a value used more than once (default true). */
  forkLabels?: boolean;
  fmt?: (v: number) => string;
}

/** Renders a circuit with whatever `rv` reveals. Values in ink, gradients in teal. */
export function drawCircuit(ctx: CanvasRenderingContext2D, w: number, h: number, spec: CircuitSpec, ev: Evaluated, rv: Reveal, opts: DrawOpts = {}): void {
  const fm = opts.fmt ?? f2;
  const [cols, rows] = spec.size;
  const padL = Math.max((spec.labels ?? 'wire') === 'node' ? 50 : 26, w * 0.05);
  const padR = Math.max(44, w * 0.08);
  const nodeMode = (spec.labels ?? 'wire') === 'node';
  const padT = nodeMode ? 58 : 34;
  const padB = nodeMode ? 58 : 26;
  const cw = (w - padL - padR) / Math.max(1, cols);
  const rh = (h - padT - padB) / Math.max(1, rows);
  const P = (at: [number, number]): [number, number] => [padL + at[0] * cw, padT + at[1] * rh];
  const r = Math.max(13, Math.min(19, cw * 0.2, rh * 0.32));
  const fs = Math.max(11, Math.min(13.5, cw * 0.15));
  const mono = (wt = 500, sz = fs) => `${wt} ${sz}px 'JetBrains Mono Variable', ui-monospace, monospace`;
  const ink = color('--ink');
  const ink3 = color('--ink-3');
  const teal = color('teal');
  const accent = color('--accent');
  const node = new Map<string, { at: [number, number]; isOp: boolean }>();
  spec.inputs.forEach((i) => node.set(i.id, { at: P(i.at), isOp: false }));
  spec.ops.forEach((o) => node.set(o.id, { at: P(o.at), isOp: true }));
  const consumers = new Map<string, number>();
  spec.ops.forEach((o) => o.ins.forEach((s) => consumers.set(s, (consumers.get(s) ?? 0) + 1)));
  const activeSet = new Set(rv.active);

  // legend
  ctx.font = mono(500, 11);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = ink;
  ctx.fillText('value', 8, 13);
  const vw = ctx.measureText('value').width;
  ctx.fillStyle = teal;
  ctx.fillText('gradient', 8 + vw + 14, 13);

  if (opts.group) {
    const pts = opts.group.ids.map((id) => node.get(id)!.at);
    const x0 = Math.min(...pts.map((p) => p[0])) - r - 10;
    const x1 = Math.max(...pts.map((p) => p[0])) + r + 10;
    const y0 = Math.min(...pts.map((p) => p[1])) - r - 22;
    const y1 = Math.max(...pts.map((p) => p[1])) + r + (nodeMode ? 40 : 26);
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = withAlpha(color('purple'), opts.group.lit ? 0.9 : 0.45);
    ctx.lineWidth = opts.group.lit ? 2 : 1.2;
    ctx.fillStyle = withAlpha(color('purple'), opts.group.lit ? 0.08 : 0.03);
    ctx.beginPath();
    ctx.roundRect(x0, y0, x1 - x0, y1 - y0, 10);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = color('purple');
    ctx.font = mono(600, 11);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(opts.group.label, x0 + 8, y1 - 4);
  }

  const startOf = (id: string): [number, number] => {
    const nd = node.get(id)!;
    return nd.isOp ? [nd.at[0] + r, nd.at[1]] : [nd.at[0] + 4, nd.at[1]];
  };
  const maxG = Math.max(1e-9, ...Object.values(ev.edge).map(Math.abs));

  const label = (s: string, x: number, y: number, col: string, nx: number, ny: number, bold = false) => {
    ctx.font = mono(bold ? 650 : 500);
    ctx.fillStyle = col;
    ctx.textAlign = nx > 0.4 ? 'left' : nx < -0.4 ? 'right' : 'center';
    ctx.textBaseline = ny < -0.4 ? 'bottom' : ny > 0.4 ? 'top' : 'middle';
    const tw = ctx.measureText(s).width;
    const ax = ctx.textAlign === 'left' ? x : ctx.textAlign === 'right' ? x - tw : x - tw / 2;
    const ay = ctx.textBaseline === 'bottom' ? y - fs : ctx.textBaseline === 'top' ? y : y - fs / 2;
    ctx.fillStyle = withAlpha(color('--paper'), 0.85);
    ctx.fillRect(ax - 2, ay - 1, tw + 4, fs + 2);
    ctx.fillStyle = col;
    ctx.fillText(s, x, y);
  };

  // wires
  for (const o of spec.ops) {
    const [tx, ty] = node.get(o.id)!.at;
    o.ins.forEach((src, k) => {
      const [sx, sy] = startOf(src);
      const toward = Math.atan2(sy - ty, sx - tx);
      const ex = tx + r * Math.cos(toward);
      const ey = ty + r * Math.sin(toward);
      const key = `${o.id}:${k}`;
      const gShown = rv.edges.has(key);
      const isActive = activeSet.has(o.id) && (rv.phase === 'backward' || rv.phase === 'forward');
      let lw = 1.6;
      if (opts.thickByGrad && gShown) lw = 1.4 + 6 * (Math.abs(ev.edge[key]!) / maxG);
      ctx.strokeStyle = isActive ? (rv.phase === 'backward' ? teal : accent) : withAlpha(ink3, 0.9);
      if (opts.thickByGrad && gShown) ctx.strokeStyle = withAlpha(teal, 0.75);
      ctx.lineWidth = isActive ? Math.max(lw, 2.6) : lw;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      // arrowhead
      const a = Math.atan2(ey - sy, ex - sx);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - 7 * Math.cos(a - 0.4), ey - 7 * Math.sin(a - 0.4));
      ctx.lineTo(ex - 7 * Math.cos(a + 0.4), ey - 7 * Math.sin(a + 0.4));
      ctx.closePath();
      ctx.fill();
      const wireLabels = (spec.labels ?? 'wire') === 'wire' || ((consumers.get(src) ?? 0) > 1 && opts.forkLabels !== false);
      if (!wireLabels) return;
      const t = o.t?.[k] ?? 0.5;
      const mx = sx + (ex - sx) * t;
      const my = sy + (ey - sy) * t;
      const len = Math.hypot(ex - sx, ey - sy) || 1;
      let nx = (ey - sy) / len;
      let ny = -(ex - sx) / len;
      if (ny > 0 || (ny === 0 && nx < 0)) {
        nx = -nx;
        ny = -ny;
      }
      const off = 4;
      if ((spec.labels ?? 'wire') === 'wire' && rv.values.has(src)) label(fm(ev.val[src]!), mx + nx * off, my + ny * off, ink, nx, ny);
      if (gShown) label(fm(ev.edge[key]!), mx - nx * off, my - ny * off, teal, -nx, -ny, true);
    });
  }

  // output stub
  const last = spec.ops[spec.ops.length - 1]!;
  {
    const [lx, ly] = node.get(last.id)!.at;
    const sx = lx + r;
    ctx.font = `italic 600 ${fs + 2}px 'Source Serif 4 Variable', Georgia, serif`;
    const nameW = spec.outName ? ctx.measureText(spec.outName).width + 8 : 0;
    const ex = Math.min(w - 6 - nameW, lx + r + Math.max(40, cw * 0.62));
    ctx.strokeStyle = rv.phase === 'seed' ? teal : withAlpha(ink3, 0.9);
    ctx.lineWidth = rv.phase === 'seed' ? 2.6 : 1.6;
    ctx.beginPath();
    ctx.moveTo(sx, ly);
    ctx.lineTo(ex, ly);
    ctx.stroke();
    const mx = (sx + ex) / 2;
    if (!nodeMode && rv.values.has(last.id)) label(fm(ev.val[last.id]!), mx, ly - 4, ink, 0, -1, true);
    if (!nodeMode && rv.seeded) label(fm(ev.seed), mx, ly + 4, teal, 0, 1, true);
    if (spec.outName) {
      ctx.font = `italic 600 ${fs + 2}px 'Source Serif 4 Variable', Georgia, serif`;
      ctx.fillStyle = color('purple');
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(spec.outName, ex + 4, ly);
    }
  }

  // gates
  for (const o of spec.ops) {
    const [x, y] = node.get(o.id)!.at;
    const on = activeSet.has(o.id) && rv.phase !== 'inputs';
    const shown = rv.values.has(o.id);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = on ? withAlpha(rv.phase === 'forward' ? accent : teal, 0.16) : color('--card');
    ctx.fill();
    ctx.lineWidth = on ? 2.6 : 1.5;
    ctx.strokeStyle = on ? (rv.phase === 'forward' ? accent : teal) : shown ? ink : ink3;
    ctx.stroke();
    const g = glyph(o);
    ctx.fillStyle = shown || on ? ink : ink3;
    ctx.font = g.length > 2 ? mono(600, Math.max(10, r * 0.62)) : g.length === 2 ? mono(600, r * 0.8) : mono(500, r * 1.25);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(g, x, y + 0.5);
    if (o.name) {
      ctx.font = `italic 600 ${fs + 1}px 'Source Serif 4 Variable', Georgia, serif`;
      ctx.fillStyle = color('--ink-2');
      ctx.textBaseline = 'bottom';
      ctx.fillText(o.name, x, y - r - 3);
    }
    if (nodeMode) {
      if (shown) label(fm(ev.val[o.id]!), x, y + r + 3, ink, 0, 1);
      const consumersShown = spec.ops.some((c) => c.ins.some((s, k) => s === o.id && rv.edges.has(`${c.id}:${k}`)));
      if (consumersShown || (o === last && rv.seeded)) label(fm(ev.grad[o.id]!), x, y + r + 3 + fs + 3, teal, 0, 1, true);
    }
  }

  // inputs
  for (const i of spec.inputs) {
    const [x, y] = node.get(i.id)!.at;
    ctx.beginPath();
    ctx.arc(x + 4, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = ink;
    ctx.fill();
    ctx.font = `italic 600 ${fs + 3}px 'Source Serif 4 Variable', Georgia, serif`;
    ctx.fillStyle = color('orange');
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(i.label ?? i.id, x - 3, y);
    const nOut = consumers.get(i.id) ?? 0;
    const showTotal = (spec.labels ?? 'wire') === 'node' || (opts.forkTotals && nOut > 1);
    if (showTotal) {
      // partial sum over the branches revealed so far
      let tot = 0;
      let any = false;
      for (const c of spec.ops) c.ins.forEach((s, k) => {
        if (s === i.id && rv.edges.has(`${c.id}:${k}`)) {
          tot += ev.edge[`${c.id}:${k}`]!;
          any = true;
        }
      });
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      if ((spec.labels ?? 'wire') === 'node') {
        ctx.font = mono(500);
        ctx.fillStyle = ink;
        ctx.fillText(fm(ev.val[i.id]!), x + 2, y + 11);
      }
      if (any) {
        ctx.font = mono(650);
        ctx.fillStyle = teal;
        ctx.fillText(fm(tot), x + 2, y + 11 + ((spec.labels ?? 'wire') === 'node' ? fs + 3 : 0));
      }
    }
  }
}
