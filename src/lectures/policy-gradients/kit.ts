import { fmt } from '../../core/code';
import type { Color } from '../../core/symbols';
import { type Scene, clamp01 } from '../../lecture/scene';
import { PROMPT, REWARD, TREE, leafOf } from '../../lib/policy-gradients-toy';

export type K = Color | `--${string}`;
export type Rect = [number, number, number, number];

/** The drawing area below the scene chip, inside a margin. */
export function area(s: Scene, top = 0.13, pad = 0.045): Rect {
  const m = Math.max(s.w, s.h) * pad;
  const mt = s.h * top;
  return [m, mt, s.w - 2 * m, s.h - mt - m];
}

/** Stages narrower than this are stacked: side-by-side panels would be tall and thin. */
export const stacked = (s: Scene): boolean => s.w < s.h * 1.45;

/** Two panels: side by side on a wide stage, stacked otherwise. */
export function split(s: Scene, r: Rect, frac = 0.5, gap = 5): [Rect, Rect] {
  const [x, y, w, h] = r;
  const g = gap * s.u;
  if (stacked(s)) {
    const h1 = (h - g) * frac;
    return [
      [x, y, w, h1],
      [x, y + h1 + g, w, h - h1 - g],
    ];
  }
  const w1 = (w - g) * frac;
  return [
    [x, y, w1, h],
    [x + w1 + g, y, w - w1 - g, h],
  ];
}

/** A rounded tag of text; returns its width. */
export function chip(s: Scene, x: number, y: number, text: string, k: K, o: { on?: number; size?: number; align?: 'left' | 'center'; mono?: boolean; fill?: number } = {}): number {
  const size = o.size ?? 3.6;
  const font = o.mono === false ? 'ui' : 'mono';
  const tw = s.measure(text, { font, size, weight: 600 });
  const pw = tw + s.u * size * 0.9;
  const ph = s.u * size * 1.75;
  const on = o.on ?? 0;
  const x0 = o.align === 'left' ? x : x - pw / 2;
  s.rrect(x0, y - ph / 2, pw, ph, size * 0.55, { fill: s.tint(k, (o.fill ?? 0.1) + 0.22 * on), stroke: s.tint(k, 0.45 + 0.55 * on), lw: 0.25 + 0.3 * on });
  s.text(text, x0 + pw / 2, y + s.u * 0.15, { font, size, weight: 600, color: s.c('--ink') });
  return pw;
}

export interface BarsOpts {
  labels: string[];
  pi: number[];
  k?: K;
  ghost?: number[];
  ghostK?: K;
  tick?: number[];
  hi?: number;
  sub?: string[];
  subK?: K;
  show?: (i: number) => string;
  max?: number;
  /** Per-bar opacity. */
  a?: (i: number) => number;
  size?: number;
  /** A line of text above the bars, with room kept for it. */
  title?: string;
  titleK?: K;
}

/** Probability bars for a few answers, labels underneath. */
export function bars(s: Scene, r: Rect, o: BarsOpts): { xs: number[]; bw: number; y0: number; sy: (v: number) => number } {
  const [x, y, w, h] = r;
  const { u } = s;
  const n = o.labels.length;
  const slot = w / n;
  const bw = Math.min(slot * 0.56, u * 13);
  const widest = Math.max(...o.labels.map((l) => s.measure(l, { font: 'mono', size: 1, weight: 650 })));
  const fs = Math.min(o.size ?? 3.6, (slot * 0.94) / widest);
  const labelH = u * fs * (o.sub ? 3.3 : 1.9);
  const y0 = y + h - labelH;
  const top = y + u * fs * 1.8 + (o.title ? u * 6 : 0);
  if (o.title) s.text(o.title, x + w / 2, y + u * 2.2, { size: 3.6, font: 'mono', weight: 650, color: s.c(o.titleK ?? '--ink-2'), halo: true });
  const max = o.max ?? 1;
  const sy = (v: number) => y0 - (y0 - top) * clamp01(v / max);
  s.line(x, y0, x + w, y0, s.c('--axis'), 0.3);
  const xs: number[] = [];
  for (let i = 0; i < n; i++) {
    const cx = x + slot * (i + 0.5);
    xs.push(cx);
    const a = o.a ? o.a(i) : 1;
    s.alpha(a, () => {
      const k = o.k ?? 'purple';
      const yv = sy(o.pi[i]!);
      if (o.hi === i) s.rrect(cx - bw / 2 - u * 1.1, Math.min(yv, y0 - u) - u * 1.1, bw + u * 2.2, y0 - Math.min(yv, y0 - u) + u * 1.1, 1.2, { fill: s.tint('gold', 0.15), stroke: s.c('gold'), lw: 0.5 });
      if (y0 - yv > 0.5) s.rrect(cx - bw / 2, yv, bw, y0 - yv, 0.8, { fill: s.tint(k, 0.6), stroke: s.c(k), lw: 0.25 });
      if (o.ghost) {
        const gy = sy(o.ghost[i]!);
        const c = s.ctx;
        c.save();
        c.setLineDash([u * 1.1, u * 0.8]);
        s.rrect(cx - bw / 2 - u * 0.5, gy, bw + u, y0 - gy, 0.8, { stroke: s.c(o.ghostK ?? 'orange'), lw: 0.35 });
        c.restore();
      }
      if (o.tick) {
        const ty = sy(o.tick[i]!);
        s.line(cx - bw / 2 - u * 1.4, ty, cx + bw / 2 + u * 1.4, ty, s.c('--ink'), 0.55);
      }
      if (o.show) {
        const top2 = Math.min(yv, o.ghost ? sy(o.ghost[i]!) : yv, o.tick ? sy(o.tick[i]!) : yv);
        s.text(o.show(i), cx, top2 - u * (o.hi === i ? 3.4 : 2.4), { size: fs * 0.9, font: 'mono', color: s.c('--ink-2'), halo: true });
      }
      s.text(o.labels[i]!, cx, y0 + u * fs * 0.95, { size: fs, font: 'mono', weight: o.hi === i ? 650 : 500 });
      if (o.sub) s.text(o.sub[i]!, cx, y0 + u * fs * 2.45, { size: fs * 0.9, font: 'mono', color: s.c(o.subK ?? 'gold') });
    });
  }
  return { xs, bw, y0, sy };
}

/** Axes for a small chart; returns data-to-pixel maps. */
export function chart(
  s: Scene,
  r: Rect,
  dom: [number, number, number, number],
  o: { xTicks?: number[]; yTicks?: number[]; xLabel?: string; title?: string; titleK?: K; logX?: boolean; xFmt?: (v: number) => string; size?: number } = {},
): { X: (v: number) => number; Y: (v: number) => number; inner: Rect } {
  const [x, y, w, h] = r;
  const { u } = s;
  const fs = o.size ?? 3.1;
  const left = x + u * 7.5;
  const right = x + w - u * 2;
  const top = y + (o.title ? u * 6.5 : u * 2);
  const bottom = y + h - u * 5;
  const [x0, x1, y0, y1] = dom;
  const fx = (v: number) => (o.logX ? Math.log10(v) : v);
  const X = (v: number) => left + ((fx(v) - fx(x0)) / (fx(x1) - fx(x0))) * (right - left);
  const Y = (v: number) => bottom - ((v - y0) / (y1 - y0)) * (bottom - top);
  if (o.title) s.text(o.title, x + u, y + u * 2.4, { size: fs * 1.08, font: 'ui', weight: 600, align: 'left', color: s.c(o.titleK ?? '--ink-2') });
  for (const t of o.yTicks ?? []) {
    s.line(left, Y(t), right, Y(t), s.c('--grid'), 0.2);
    s.text(fmt(t), left - u * 1.2, Y(t), { size: fs, font: 'mono', align: 'right', color: s.c('--ink-3') });
  }
  for (const t of o.xTicks ?? []) {
    s.line(X(t), top, X(t), bottom, s.c('--grid'), 0.2);
    s.text(o.xFmt ? o.xFmt(t) : fmt(t), X(t), bottom + u * 2.6, { size: fs, font: 'mono', color: s.c('--ink-3') });
  }
  s.line(left, bottom, right, bottom, s.c('--axis'), 0.3);
  s.line(left, top, left, bottom, s.c('--axis'), 0.3);
  if (o.xLabel) s.text(o.xLabel, right, bottom - u * 2.2, { size: fs, font: 'ui', align: 'right', color: s.c('--ink-3'), halo: true });
  return { X, Y, inner: [left, top, right - left, bottom - top] };
}

export function poly(s: Scene, xs: ArrayLike<number>, ys: ArrayLike<number>, n: number, col: string, lw = 0.45, dash?: number[]): void {
  if (n < 2) return;
  const c = s.ctx;
  c.beginPath();
  for (let i = 0; i < n; i++) {
    if (i) c.lineTo(xs[i]!, ys[i]!);
    else c.moveTo(xs[i]!, ys[i]!);
  }
  c.strokeStyle = col;
  c.lineWidth = lw * s.u;
  c.lineJoin = 'round';
  c.setLineDash(dash ? dash.map((d) => d * s.u) : []);
  c.stroke();
  c.setLineDash([]);
}

export interface TreeOpts {
  /** 0..1 per first-level branch, 0..1 per leaf: how lit the path is. */
  lit1?: number[];
  lit2?: number[];
  /** Opacity of the branch probabilities, the leaf texts and the rewards. */
  probs?: number;
  rewards?: number;
  /** Extra emphasis on parts of the tree. */
  rootOn?: number;
  branchOn?: number;
  /** Red wash over the "Yes" subtree. */
  wrong?: number;
}

/** The two-token tree for "Is 91 prime?" inside `r`. Returns leaf centers. */
export function tree(s: Scene, r: Rect, o: TreeOpts = {}): { lx: number[]; ly: number; root: [number, number] } {
  const [x, y, w, h] = r;
  const { u } = s;
  const fs = Math.min(3.8, (w / u) * 0.042);
  const rootY = y + u * 3.5;
  const ly = y + h - u * fs * 3.8;
  const midY = (rootY + ly) / 2;
  const mid = [x + w * 0.27, x + w * 0.73];
  const lx = [x + w * 0.135, x + w * 0.405, x + w * 0.595, x + w * 0.865];
  const lit1 = o.lit1 ?? [0, 0];
  const lit2 = o.lit2 ?? [0, 0, 0, 0];
  const pa = o.probs ?? 1;
  const edge = (x0: number, y0: number, x1: number, y1: number, p: number, on: number, emph = 0) => {
    s.line(x0, y0 + u * 3, x1, y1 - u * 3, on > 0 ? s.tint('purple', 0.35 + 0.65 * on) : s.tint('--ink-3', 0.55), 0.3 + 0.55 * on);
    s.alpha(pa, () => s.text(fmt(p, 2), (x0 + x1) / 2 + (x1 > x0 ? u * 2.4 : -u * 2.4), (y0 + y1) / 2, { size: fs * 0.95, font: 'mono', align: x1 > x0 ? 'left' : 'right', color: on > 0.5 || emph > 0.5 ? s.c('purple') : s.c('--ink-2'), weight: on > 0.5 || emph > 0.5 ? 650 : 450, halo: true }));
  };
  if ((o.wrong ?? 0) > 0)
    s.alpha(o.wrong!, () => s.rrect(x + u, midY - u * 5, w * 0.5 - u * 2, ly - midY + u * fs * 6, 2, { fill: s.tint('red', 0.08), stroke: s.tint('red', 0.6), lw: 0.3 }));
  TREE.first.forEach((t, i) => {
    edge(x + w / 2, rootY, mid[i]!, midY, t.p, lit1[i]!, o.branchOn);
    TREE.second[i]!.forEach((t2, j) => edge(mid[i]!, midY, lx[leafOf(i, j)]!, ly, t2.p, lit2[leafOf(i, j)]!));
  });
  chip(s, x + w / 2, rootY, PROMPT, 'slate', { on: o.rootOn ?? 0, size: fs });
  TREE.first.forEach((t, i) => chip(s, mid[i]!, midY, t.tok, 'purple', { on: lit1[i]!, size: fs }));
  TREE.second.forEach((row, i) =>
    row.forEach((t, j) => {
      const k = leafOf(i, j);
      chip(s, lx[k]!, ly, t.tok, 'purple', { on: lit2[k]!, size: fs });
    }),
  );
  s.alpha(o.rewards ?? 0, () =>
    lx.forEach((cx, k) => {
      const on = lit2[k]!;
      chip(s, cx, ly + u * fs * 2.4, `R ${REWARD[k]}`, 'gold', { on, size: fs * 0.92 });
    }),
  );
  return { lx, ly, root: [x + w / 2, rootY] };
}

/** A green check mark in a disc. */
export function check(s: Scene, cx: number, cy: number, r: number): void {
  s.circle(cx, cy, r, { fill: s.c('green') });
  const k = r / (1.9 * s.u);
  s.line(cx - s.u * 0.9 * k, cy, cx - s.u * 0.2 * k, cy + s.u * 0.7 * k, '#fff', 0.45 * k);
  s.line(cx - s.u * 0.2 * k, cy + s.u * 0.7 * k, cx + s.u * 1 * k, cy - s.u * 0.7 * k, '#fff', 0.45 * k);
}

/** A labeled box, for pipelines and roadmaps. */
export function box(s: Scene, x: number, y: number, w: number, h: number, head: string, sub: string, k: K, on = 0, size = 4): void {
  const { u } = s;
  s.rrect(x, y, w, h, 2, { fill: s.tint(k, 0.07 + 0.18 * on), stroke: s.tint(k, 0.45 + 0.55 * on), lw: 0.3 + 0.3 * on });
  const two = sub.length > 0;
  const room = w - u * 3;
  const hw = s.measure(head, { size, font: 'display', weight: 600 });
  const hs = hw > room ? (size * room) / hw : size;
  s.text(head, x + w / 2, y + h / 2 - (two ? u * size * 0.55 : 0), { size: hs, font: 'display', weight: 600, color: s.c(k) });
  if (two) {
    const sw = s.measure(sub, { size: size * 0.72, font: 'ui' });
    s.text(sub, x + w / 2, y + h / 2 + u * size * 0.7, { size: sw > room ? (size * 0.72 * room) / sw : size * 0.72, font: 'ui', color: s.c('--ink-2') });
  }
}
