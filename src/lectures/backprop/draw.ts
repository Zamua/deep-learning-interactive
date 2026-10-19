import type { Color } from '../../core/symbols';
import { type CircuitSpec, type Evaluated, glyph } from '../../lib/backprop-circuit';
import { type Scene, clamp01, lerp, smooth } from '../../lecture/scene';

export type Rect = [number, number, number, number];

/** The stage inside a margin, leaving `top` (a fraction of the height) clear for the scene chip. */
export function area(s: Scene, top = 0.12, pad = 0.05): Rect {
  const m = s.w * pad;
  return [m, s.h * top, s.w - 2 * m, s.h * (1 - top) - m];
}

/** Circuit numbers: integers stay integers, everything else gets two decimals, with a real minus sign. */
export function num(v: number, digits = 2): string {
  const r = Math.round(v);
  const t = Math.abs(v - r) < 0.5 * 10 ** -digits ? String(r) : v.toFixed(digits);
  return t === '-0' || /^-0\.0+$/.test(t) ? t.slice(1) : t.replace('-', '−');
}

/** Maps a data window onto a stage rectangle (y up). */
export class Frame {
  kx: number;
  ky: number;
  ox: number;
  oy: number;
  constructor(
    readonly s: Scene,
    readonly rect: Rect,
    readonly dom: [number, number, number, number],
  ) {
    const [rx, ry, rw, rh] = rect;
    const [x0, x1, y0, y1] = dom;
    this.kx = rw / (x1 - x0);
    this.ky = rh / (y1 - y0);
    this.ox = rx - this.kx * x0;
    this.oy = ry + this.ky * y1;
  }
  X(x: number): number {
    return this.ox + this.kx * x;
  }
  Y(y: number): number {
    return this.oy - this.ky * y;
  }
  axes(a = 1, step = 1): void {
    const s = this.s;
    const [x0, x1, y0, y1] = this.dom;
    s.alpha(a, () => {
      for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) s.line(this.X(x), this.Y(y0), this.X(x), this.Y(y1), s.c('--grid'), 0.2);
      if (x0 <= 0 && x1 >= 0) s.line(this.X(0), this.Y(y0), this.X(0), this.Y(y1), s.c('--axis'), 0.3);
      if (y0 <= 0 && y1 >= 0) s.line(this.X(x0), this.Y(0), this.X(x1), this.Y(0), s.c('--axis'), 0.3);
    });
  }
  clip(fn: () => void): void {
    const c = this.s.ctx;
    c.save();
    c.beginPath();
    c.rect(...this.rect);
    c.clip();
    fn();
    c.restore();
  }
  fn(f: (x: number) => number, col: string, width = 0.7, from = this.dom[0], to = this.dom[1], dash?: number[]): void {
    const c = this.s.ctx;
    this.clip(() => {
      c.beginPath();
      const n = 200;
      for (let i = 0; i <= n; i++) {
        const x = from + ((to - from) * i) / n;
        const py = Math.max(-1e4, Math.min(1e4, this.Y(f(x))));
        if (i) c.lineTo(this.X(x), py);
        else c.moveTo(this.X(x), py);
      }
      c.strokeStyle = col;
      c.lineWidth = width * this.s.u;
      c.lineJoin = 'round';
      c.setLineDash(dash ? dash.map((d) => d * this.s.u) : []);
      c.stroke();
      c.setLineDash([]);
    });
  }
  dot(x: number, y: number, r: number, col: string): void {
    this.s.circle(this.X(x), this.Y(y), r * this.s.u, { fill: col, stroke: this.s.c('--card'), lw: 0.35 });
  }
}

/** A rounded panel with an optional colored edge, the lecture's card. */
export function card(s: Scene, x: number, y: number, w: number, h: number, k: Color | `--${string}`, on = 0): void {
  s.rrect(x, y, w, h, 2, { fill: s.tint(k, 0.05 + 0.12 * on), stroke: s.tint(k, 0.3 + 0.7 * on), lw: 0.3 + 0.3 * on });
}

/** A dashed "rest of the circuit" cloud. */
export function fog(s: Scene, x: number, y: number, w: number, h: number, a: number): void {
  s.alpha(a, () => {
    const c = s.ctx;
    c.save();
    c.setLineDash([1.2 * s.u, 1 * s.u]);
    s.rrect(x, y, w, h, 3, { fill: s.tint('--ink-3', 0.06), stroke: s.tint('--ink-3', 0.6), lw: 0.3 });
    c.restore();
    s.text('?', x + w / 2, y + h / 2, { size: 7, font: 'display', color: s.tint('--ink-3', 0.7) });
  });
}

/** A small padlock, for data the training loop may not change. */
export function lock(s: Scene, cx: number, cy: number, size: number, col: string): void {
  const c = s.ctx;
  const w = size;
  const h = size * 0.75;
  c.beginPath();
  c.arc(cx, cy - h * 0.45, w * 0.3, Math.PI, 0);
  c.strokeStyle = col;
  c.lineWidth = s.u * 0.45;
  c.stroke();
  s.rrect(cx - w / 2, cy - h * 0.45, w, h, 0.6, { fill: col });
}

export interface CircOpts {
  /**
   * Walk position. Op i runs forward over [i, i + 1]; the output is seeded over [n, n + 1]; then op i
   * runs backward over [2n - i, 2n - i + 1], last op first. Fractions animate the pulses.
   */
  k: number;
  /** Label text size, in u. */
  size?: number;
  /** Padding inside `rect` (left, top, right, bottom), in u. */
  pad?: [number, number, number, number];
  group?: { ids: string[]; label: string; a: number; lit?: number };
  /** Edge keys `op:k` drawn emphasized, with their emphasis 0..1. */
  hot?: Record<string, number>;
  /** Gate or input ids ringed in the accent color. */
  ring?: Record<string, number>;
  /** Op ids whose local gradients are shown in gold on their input wires, with an alpha. */
  locals?: Record<string, number>;
  /** Node mode: per-branch gradients on the wires of a value used more than once. */
  forkLabels?: boolean;
  /** Wire width by |gradient|. */
  thick?: boolean;
  /** Alpha of every gradient label (and of the seed). */
  gradsA?: number;
  /** Input labels: the default draws the input's id in italics. */
  inputLabel?: (id: string) => string;
  /** Colors an input's name. */
  inputColor?: (id: string) => Color;
  /** Largest gate radius, in u (default 6). */
  rMax?: number;
}

export interface Geo {
  at: Map<string, [number, number]>;
  r: number;
  /** Where the output stub ends. */
  out: [number, number];
}

/** Draws a gate circuit in stage units, with forward (accent) and backward (teal) pulses driven by `o.k`. */
export function circuit(s: Scene, rect: Rect, spec: CircuitSpec, ev: Evaluated, o: CircOpts): Geo {
  const u = s.u;
  const n = spec.ops.length;
  const node = (spec.labels ?? 'wire') === 'node';
  const fs = o.size ?? 3.4;
  const th = fs * u;
  const [pl, pt, pr, pb] = o.pad ?? (node ? [12, 7, 12, 9] : [8, 5, 12, 5]);
  const [rx, ry, rw, rh] = rect;
  const [cols, rows] = spec.size;
  const cw = (rw - (pl + pr) * u) / cols;
  const rhh = (rh - (pt + pb) * u) / Math.max(0.01, rows);
  const P = (a: [number, number]): [number, number] => [rx + pl * u + a[0] * cw, ry + pt * u + a[1] * rhh];
  const rMax = (o.rMax ?? 6) * u;
  const r = Math.max(2.6 * u, Math.min(rMax, cw * 0.24, rows > 0 ? rhh * 0.36 : rMax));
  const at = new Map<string, [number, number]>();
  spec.inputs.forEach((i) => at.set(i.id, P(i.at)));
  spec.ops.forEach((op) => at.set(op.id, P(op.at)));
  const idx = new Map(spec.ops.map((op, i) => [op.id, i]));
  const isOp = (id: string) => idx.has(id);
  const consumers = new Map<string, string[]>();
  spec.ops.forEach((op) => op.ins.forEach((src, k) => consumers.set(src, [...(consumers.get(src) ?? []), `${op.id}:${k}`])));

  const fP = (i: number) => clamp01(o.k - i);
  const bP = (i: number) => clamp01(o.k - (2 * n - i));
  const seedP = clamp01(o.k - n);
  const gA = o.gradsA ?? 1;
  const valA = (id: string) => (isOp(id) ? smooth((fP(idx.get(id)!) - 0.5) / 0.4) : 1);
  const edgeA = (key: string) => gA * smooth((bP(idx.get(key.split(':')[0]!)!) - 0.5) / 0.4);
  const last = spec.ops[n - 1]!;
  const seedA = gA * smooth((seedP - 0.3) / 0.5);
  const gradA = (id: string) => {
    if (id === last.id) return seedA;
    const cs = consumers.get(id) ?? [];
    return cs.length ? Math.min(...cs.map(edgeA)) : 0;
  };
  const maxEdge = Math.max(1e-9, ...Object.values(ev.edge).map(Math.abs));

  // group box
  if (o.group && o.group.a > 0) {
    const g = o.group;
    const pts = g.ids.map((id) => at.get(id)!);
    const x0 = Math.min(...pts.map((p) => p[0])) - r - 2 * u;
    const x1 = Math.max(...pts.map((p) => p[0])) + r + 2 * u;
    const y0 = Math.min(...pts.map((p) => p[1])) - r - 2.4 * u;
    const y1 = Math.max(...pts.map((p) => p[1])) + r + (node ? 2 * th + 2.6 * u : 2.4 * u);
    s.alpha(g.a, () => {
      const c = s.ctx;
      c.save();
      c.setLineDash([1.2 * u, 0.9 * u]);
      s.rrect(x0, y0, x1 - x0, y1 - y0, 2.4, { fill: s.tint('purple', 0.03 + 0.07 * (g.lit ?? 0)), stroke: s.tint('purple', 0.45 + 0.5 * (g.lit ?? 0)), lw: 0.3 + 0.25 * (g.lit ?? 0) });
      c.restore();
      s.text(g.label, x0 + u, y0 - 2.6 * u, { size: fs * 0.95, font: 'mono', weight: 600, color: s.c('purple'), align: 'left', halo: true });
    });
  }

  const wireEnds = (op: (typeof spec.ops)[number], src: string): [number, number, number, number] => {
    const [tx, ty] = at.get(op.id)!;
    const [px, py] = at.get(src)!;
    const sx = isOp(src) ? px + r : px + 0.7 * u;
    const sy = py;
    const a = Math.atan2(sy - ty, sx - tx);
    return [sx, sy, tx + r * Math.cos(a), ty + r * Math.sin(a)];
  };

  // wires and pulses
  spec.ops.forEach((op, i) => {
    op.ins.forEach((src, k) => {
      const key = `${op.id}:${k}`;
      const [sx, sy, ex, ey] = wireEnds(op, src);
      const fwd = fP(i) > 0 && fP(i) < 1;
      const bwd = bP(i) > 0 && bP(i) < 1;
      const hot = o.hot?.[key] ?? 0;
      let col = s.tint('--ink-3', 0.85);
      let lw = 0.32;
      if (o.thick && edgeA(key) > 0) {
        col = s.tint('teal', 0.75);
        lw = 0.3 + 1.6 * (Math.abs(ev.edge[key]!) / maxEdge) * edgeA(key);
      }
      if (fwd) {
        col = s.c('--accent');
        lw = 0.5;
      }
      if (bwd) {
        col = s.c('teal');
        lw = Math.max(lw, 0.5);
      }
      if (hot > 0.01) {
        s.alpha(hot, () => s.line(sx, sy, ex, ey, s.tint('--accent', 0.35), lw + 1.6));
      }
      s.arrow(sx, sy, ex, ey, col, lw, 1.9);
      if (fwd && fP(i) < 0.55) {
        const p = smooth(fP(i) / 0.55);
        s.circle(lerp(sx, ex, p), lerp(sy, ey, p), 1.1 * u, { fill: s.c('--accent') });
      }
      if (bwd && bP(i) < 0.55) {
        const p = smooth(bP(i) / 0.55);
        s.circle(lerp(ex, sx, p), lerp(ey, sy, p), 1.1 * u, { fill: s.c('teal') });
      }
    });
  });

  // output stub
  const [lx, ly] = at.get(last.id)!;
  const nameW = spec.outName ? s.measure(spec.outName, { size: fs * 1.25, italic: true, weight: 600 }) + 1.5 * u : 0;
  const sx0 = lx + r;
  const sx1 = Math.min(rx + rw - nameW - 0.5 * u, lx + r + Math.max(7 * u, cw * 0.6));
  const seeding = seedP > 0 && seedP < 1;
  s.line(sx0, ly, sx1, ly, seeding ? s.c('teal') : s.tint('--ink-3', 0.85), seeding ? 0.55 : 0.32);
  if (seeding && seedP < 0.6) s.circle(lerp(sx1, sx0, smooth(seedP / 0.6)), ly, 1.1 * u, { fill: s.c('teal') });
  if (spec.outName) s.text(spec.outName, sx1 + u, ly, { size: fs * 1.25, italic: true, weight: 600, color: s.c('purple'), align: 'left' });

  // gates
  spec.ops.forEach((op, i) => {
    const [x, y] = at.get(op.id)!;
    const fa = fP(i) > 0 && fP(i) < 1 ? Math.sin(Math.PI * fP(i)) : 0;
    const ba = bP(i) > 0 && bP(i) < 1 ? Math.sin(Math.PI * bP(i)) : 0;
    const shown = valA(op.id) > 0.5;
    const k: Color | `--${string}` = ba > fa ? 'teal' : '--accent';
    const on = Math.max(fa, ba);
    s.circle(x, y, r, { fill: on > 0.01 ? s.tint(k, 0.08 + 0.14 * on) : s.c('--card'), stroke: on > 0.01 ? s.c(k) : shown ? s.c('--ink') : s.c('--ink-3'), lw: 0.3 + 0.3 * on });
    const ring = o.ring?.[op.id] ?? 0;
    if (ring > 0) s.alpha(ring, () => s.circle(x, y, r + 1 * u, { stroke: s.c('--accent'), lw: 0.55 }));
    const g = glyph(op).replace('-', '−');
    const gs = g.length > 2 ? (r / u) * 0.66 : g.length === 2 ? (r / u) * 0.8 : (r / u) * 1.15;
    s.text(g, x, y + 0.15 * u, { size: Math.min(gs, fs * 1.6), font: 'mono', weight: g.length > 1 ? 600 : 500, color: shown || on > 0 ? s.c('--ink') : s.c('--ink-3') });
    if (op.name) s.text(op.name, x, y - r - 1.6 * u, { size: fs, italic: true, weight: 600, color: s.c('--ink-2'), halo: true });
  });

  // labels
  const along = (sx: number, sy: number, ex: number, ey: number, t: number, text: string, side: 1 | -1, col: string, weight: number, a: number, size = fs) => {
    if (a <= 0.01) return;
    const len = Math.hypot(ex - sx, ey - sy) || 1;
    let nx = (ey - sy) / len;
    let ny = -(ex - sx) / len;
    if (ny > 0 || (ny === 0 && nx < 0)) {
      nx = -nx;
      ny = -ny;
    }
    nx *= side;
    ny *= side;
    const tw = s.measure(text, { size, font: 'mono', weight });
    const off = 0.9 * u + 0.5 * (Math.abs(nx) * tw + Math.abs(ny) * size * u);
    const mx = lerp(sx, ex, t) + nx * off;
    const my = lerp(sy, ey, t) + ny * off;
    s.alpha(a, () => s.text(text, mx, my, { size, font: 'mono', weight, color: col, halo: true }));
  };
  spec.ops.forEach((op) => {
    op.ins.forEach((src, k) => {
      const key = `${op.id}:${k}`;
      const [sx, sy, ex, ey] = wireEnds(op, src);
      const t = op.t?.[k] ?? 0.5;
      const fork = (consumers.get(src)?.length ?? 0) > 1;
      if (!node) along(sx, sy, ex, ey, t, num(ev.val[src]!), 1, s.c('--ink'), 500, valA(src));
      if (!node || (fork && o.forkLabels)) along(sx, sy, ex, ey, t, num(ev.edge[key]!), -1, s.c('teal'), 650, edgeA(key), node ? fs * 0.92 : fs);
      const la = o.locals?.[op.id] ?? 0;
      if (la > 0) {
        const a = Math.atan2(ey - sy, ex - sx);
        const lx2 = ex - Math.cos(a) * 3.2 * u;
        const ly2 = ey - Math.sin(a) * 3.2 * u;
        s.alpha(la, () => {
          const txt = num(ev.local[key]!);
          const tw = s.measure(txt, { size: fs * 0.95, font: 'mono', weight: 650 });
          s.rrect(lx2 - tw / 2 - 0.8 * u, ly2 - fs * u * 0.62, tw + 1.6 * u, fs * u * 1.24, 1, { fill: s.c('--card'), stroke: s.c('gold'), lw: 0.3 });
          s.text(txt, lx2, ly2 + 0.1 * u, { size: fs * 0.95, font: 'mono', weight: 650, color: s.c('gold') });
        });
      }
    });
  });
  if (!node) {
    along(sx0, ly, sx1, ly, 0.5, num(ev.val[last.id]!), 1, s.c('--ink'), 650, valA(last.id));
    along(sx0, ly, sx1, ly, 0.5, num(ev.seed), -1, s.c('teal'), 650, seedA);
  } else {
    spec.ops.forEach((op) => {
      const [x, y] = at.get(op.id)!;
      s.alpha(valA(op.id), () => s.text(num(ev.val[op.id]!), x, y + r + 0.8 * u + th / 2, { size: fs, font: 'mono', color: s.c('--ink'), halo: true }));
      s.alpha(gradA(op.id), () => s.text(num(ev.grad[op.id]!), x, y + r + 1.2 * u + th * 1.5, { size: fs, font: 'mono', weight: 650, color: s.c('teal'), halo: true }));
    });
  }

  // inputs
  spec.inputs.forEach((inp) => {
    const [x, y] = at.get(inp.id)!;
    s.circle(x, y, 0.75 * u, { fill: s.c('--ink') });
    const lab = o.inputLabel ? o.inputLabel(inp.id) : (inp.label ?? inp.id);
    const ring = o.ring?.[inp.id] ?? 0;
    const lo = { size: fs * 1.25, italic: true, weight: 600 } as const;
    if (ring > 0) {
      const tw = s.measure(lab, lo);
      s.alpha(ring, () => s.rrect(x - 2.2 * u - tw, y - fs * u * 0.8, tw + 3.6 * u, fs * u * 1.6, 1.4, { stroke: s.c('--accent'), lw: 0.5 }));
    }
    s.text(lab, x - 1.4 * u, y, { ...lo, color: s.c(o.inputColor?.(inp.id) ?? 'orange'), align: 'right' });
    if (node) {
      s.text(num(ev.val[inp.id]!), x - 1.4 * u, y + th * 1.25, { size: fs, font: 'mono', align: 'right', halo: true });
      const cs = consumers.get(inp.id) ?? [];
      let tot = 0;
      let a = 0;
      for (const key of cs) {
        const ea = edgeA(key);
        if (ea > 0.5) tot += ev.edge[key]!;
        a = Math.max(a, ea);
      }
      s.alpha(a, () => s.text(num(tot), x - 1.4 * u, y + th * 2.45, { size: fs, font: 'mono', weight: 650, align: 'right', color: s.c('teal'), halo: true }));
    }
  });
  return { at, r, out: [sx1, ly] };
}

/** Piecewise walk position: `keys` are [time-fraction, k] pairs, eased between neighbors. */
export function track(p: number, keys: [number, number][]): number {
  if (p <= keys[0]![0]) return keys[0]![1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, k1] = keys[i]!;
    const [t0, k0] = keys[i - 1]!;
    if (p <= t1) return lerp(k0, k1, (p - t0) / Math.max(1e-6, t1 - t0));
  }
  return keys[keys.length - 1]![1];
}
