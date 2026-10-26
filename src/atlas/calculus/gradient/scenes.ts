import { Rng } from '../../../core/rand';
import { type Scene, type SceneDef, lerp } from '../../../lecture/scene';
import { Frame, type Rect, after } from '../draw';

const f = (u: number, v: number) => u * u + 2 * v * v;
const LEVELS = [0.5, 1.5, 3, 4.5, 6, 8];
const P = [1, 1] as const;
const G = [2, 4] as const;
const SCALE = 0.25;

/** The contour plot, and where its legend goes: below it on a phone, beside it on a desktop. */
function layout(s: Scene) {
  const plot: Rect = s.tall ? [s.w * 0.05, s.h * 0.03, s.w * 0.9, s.h * 0.5] : [s.w * 0.04, s.h * 0.06, s.w * 0.58, s.h * 0.88];
  const F = new Frame(s, plot, [-2.3, 2.3, -1.6, 2.3], true);
  const legend = s.tall ? { x: s.w / 2 - 22 * s.u, y: s.h * 0.75, dy: 7.2 * s.u } : { x: s.w * 0.65, y: s.h * 0.34, dy: 8 * s.u };
  // The formula sits above the legend, with room for the per-term braces under it.
  const fy = s.tall ? s.h * 0.6 : legend.y - 1.9 * legend.dy;
  return { F, legend, fy };
}

/** The ring where f = c: an ellipse with semi-axes sqrt(c) in u and sqrt(c / 2) in v. */
function ring(s: Scene, F: Frame, c: number, stroke: string, lw: number) {
  const ctx = s.ctx;
  F.clip(() => {
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const t = (i / 120) * 2 * Math.PI;
      const x = F.X(Math.sqrt(c) * Math.cos(t));
      const y = F.Y(Math.sqrt(c / 2) * Math.sin(t));
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw * s.u;
    ctx.stroke();
  });
}

function rings(s: Scene, F: Frame, hi = -1, hiA = 0) {
  F.axes(0.8);
  for (const c of LEVELS) ring(s, F, c, s.tint('purple', c === hi ? 0.35 + 0.65 * hiA : 0.35), c === hi ? 0.3 + 0.35 * hiA : 0.3);
  const o = { size: 3.4, font: 'mono', color: s.c('--ink-3'), halo: true } as const;
  s.text('u', F.X(2.15), F.Y(0) + 3 * s.u, o);
  s.text('v', F.X(0) - 3 * s.u, F.Y(2.15), o);
}

function legendLine(s: Scene, L: { x: number; y: number; dy: number }, row: number, text: string, k: Parameters<Scene['c']>[0], a: number) {
  s.alpha(a, () => s.text(text, L.x, L.y + row * L.dy, { size: 3.9, font: 'mono', weight: 600, align: 'left', color: s.c(k) }));
}

const partials: SceneDef = {
  marks: {
    f: { tex: String.raw`\symf(u, v) = u^2 + 2v^2`, x: 0.5, y: 0.5, size: 4.6, align: 'left' },
    fu: { tex: String.raw`\symf(u, v) = \underbrace{u^2}_{2u} + \underbrace{2v^2}_{0}`, x: 0.5, y: 0.5, size: 4.6, align: 'left' },
    fv: { tex: String.raw`\symf(u, v) = \underbrace{u^2}_{0} + \underbrace{2v^2}_{4v}`, x: 0.5, y: 0.5, size: 4.6, align: 'left' },
  },
  draw(s) {
    const { F, legend: L, fy } = layout(s);
    rings(s, F, 3, s.ease('two', 0.6, 1.5));
    F.dot(P[0], P[1], 'purple', 1.3);
    // f, then f with what each term gives in u, then in v.
    const tu = s.ease('terms', 0.6, 0.4);
    const tv = s.ease('dv', 0.6, 0.4);
    const back = s.ease('grad', 0.6);
    const at = { x: L.x / s.w, y: fy / s.h };
    s.show('f', s.ease('two', 0.6) * (1 - tu) + back, at);
    s.show('fu', tu * (1 - tv), at);
    s.show('fv', tv * (1 - back), at);
    const du = s.ease('du', 0.6);
    s.alpha(du, () => {
      F.seg(-2.3, 1, 2.3, 1, 'gold', 0.3, [1, 1]);
      F.arrow(P[0], P[1], P[0] + G[0] * SCALE, P[1], 'gold', 0.6);
    });
    legendLine(s, L, 0, '∂f/∂u = 2u = 2', 'gold', after(s, 'terms', 0.6));
    const dv = s.ease('dv', 0.6);
    s.alpha(dv, () => {
      F.seg(1, -1.6, 1, 2.3, 'teal', 0.3, [1, 1]);
      F.arrow(P[0], P[1], P[0], P[1] + G[1] * SCALE, 'teal', 0.6);
    });
    legendLine(s, L, 1, '∂f/∂v = 4v = 4', 'teal', after(s, 'dv', 0.6));
    const g = s.ease('grad', 0.8);
    s.alpha(g, () => F.arrow(P[0], P[1], P[0] + G[0] * SCALE, P[1] + G[1] * SCALE, 'red', 0.8, 3.2));
    legendLine(s, L, 2, '∇f = [2, 4]', 'red', g);
  },
};

const uphill: SceneDef = {
  draw(s) {
    const { F, legend: L } = layout(s);
    const st = s.ease('small', 1.4, 0.6);
    const q = [lerp(P[0], P[0] - 0.1 * G[0], st), lerp(P[1], P[1] - 0.1 * G[1], st)];
    rings(s, F, 3, 1 - st);
    // The ring through the new point, drawn in green as the step lands.
    s.alpha(st, () => ring(s, F, f(q[0]!, q[1]!), s.c('green'), 0.55));
    // Level direction at P: perpendicular to the gradient.
    const n = Math.hypot(G[0], G[1]);
    const tx = -G[1] / n;
    const ty = G[0] / n;
    s.alpha(s.ease('up', 0.6, 1) * (1 - st), () => F.seg(P[0] - 0.7 * tx, P[1] - 0.7 * ty, P[0] + 0.7 * tx, P[1] + 0.7 * ty, '--ink-3', 0.35, [1, 1]));
    F.arrow(P[0], P[1], P[0] + G[0] * SCALE, P[1] + G[1] * SCALE, 'red', 0.8, 3.2);
    legendLine(s, L, 0, '∇f: uphill', 'red', 1);
    const d = s.ease('down', 0.7);
    s.alpha(d, () => F.arrow(P[0], P[1], P[0] - G[0] * SCALE, P[1] - G[1] * SCALE, 'green', 0.8, 3.2));
    legendLine(s, L, 1, '−∇f: downhill', 'green', d);
    F.dot(P[0], P[1], 'purple', 1.3);
    s.alpha(st, () => F.dot(q[0]!, q[1]!, 'green', 1.3));
    legendLine(s, L, 2, `f: 3 → ${f(q[0]!, q[1]!).toFixed(2)}`, 'green', s.ease('small', 0.6));
  },
};

const rng = new Rng(7);
const WV = Array.from({ length: 12 }, () => Math.round(rng.randn() * 10) / 10);
const GV = Array.from({ length: 12 }, () => Math.round(rng.randn() * 8) / 100);

/** A 3 by 4 grid of cells centered at (cx, cy); `hi` lights row 1, column 2. */
function grid(s: Scene, cx: number, cy: number, vals: number[], k: 'blue' | 'red', hi: number, fmt: (v: number) => string) {
  const cw = 12.5 * s.u;
  const ch = 8 * s.u;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      const x = cx + (c - 2) * cw + 0.4 * s.u;
      const y = cy + (r - 1.5) * ch + 0.4 * s.u;
      s.cell(x, y, cw - 0.8 * s.u, ch - 0.8 * s.u, fmt(vals[r * 4 + c]!), k, { on: r === 1 && c === 2 ? hi : 0, size: 3.2 });
    }
  }
}

const shape: SceneDef = {
  draw(s) {
    const [wx, wy, gx, gy] = s.tall ? [s.w / 2, s.h * 0.27, s.w / 2, s.h * 0.76] : [s.w * 0.28, s.h * 0.55, s.w * 0.72, s.h * 0.55];
    const hi = s.ease('entry', 0.6);
    const label = (t: string, x: number, y: number, k: 'blue' | 'red') => s.text(t, x, y - 16 * s.u, { size: 4, font: 'mono', weight: 650, color: s.c(k) });
    s.alpha(s.ease('loss', 0.6), () => {
      grid(s, wx, wy, WV, 'blue', hi, (v) => v.toFixed(1));
      label('W  (3, 4)', wx, wy, 'blue');
    });
    s.alpha(s.ease('loss', 0.6, 2.5), () => {
      const [lx, ly] = s.tall ? [s.w / 2, s.h * 0.49] : [s.w / 2, s.h * 0.17];
      s.text('f: one number', lx, ly, { size: 4, font: 'mono', weight: 650, color: s.c('purple') });
    });
    s.alpha(s.ease('g', 0.6), () => {
      grid(s, gx, gy, GV, 'red', hi, (v) => v.toFixed(2));
      label('∇f  (3, 4)', gx, gy, 'red');
    });
    s.alpha(hi, () => {
      const [tx, ty] = s.tall ? [s.w / 2, s.h * 0.94] : [s.w / 2, s.h * 0.86];
      s.text('∇f[1, 2] = ∂f/∂W[1, 2]', tx, ty, { size: 3.8, font: 'mono', weight: 600, color: s.c('--ink-2') });
    });
  },
};

type Ink = Parameters<Scene['c']>[0];
/** Term-table sizes in stage units: cell, gap (holding a plus sign), label column. */
const TW = 14;
const TH = 7.5;
const TGAP = 4.6;
const TLW = 13;
const ROW = [0.25, 0.37, 0.49];
const RES = [0.65, 0.75, 0.85];

/** Where cell i of an n-term table starts, the table centered on the stage. */
const cellX = (s: Scene, n: number, i: number) => s.w / 2 + (-(TLW + 2 + n * TW + (n - 1) * TGAP) / 2 + TLW + 2 + i * (TW + TGAP)) * s.u;

/**
 * One row of a term table: a label, then what each term of f becomes, joined by plus signs.
 * `next` crossfades the row into another label and cells as `next.t` goes 0 -> 1.
 */
function termRow(s: Scene, n: number, row: number, k: Ink, a: number, label: string, cells: string[], on: number[] = [], next?: { label: string; cells: string[]; t: number; k: Ink }) {
  const y = s.h * ROW[row]!;
  const t = next?.t ?? 0;
  s.alpha(a, () => {
    const x0 = cellX(s, n, 0);
    for (let i = 0; i < n; i++) {
      const x = cellX(s, n, i);
      if (i) s.text('+', x - (TGAP / 2) * s.u, y, { size: 3.6, font: 'mono', color: s.c('--ink-3') });
      s.alpha(1 - t, () => s.cell(x, y - (TH / 2) * s.u, TW * s.u, TH * s.u, '', k, { on: on[i] ?? 0 }));
      if (next) s.alpha(t, () => s.cell(x, y - (TH / 2) * s.u, TW * s.u, TH * s.u, '', next.k, { on: on[i] ?? 0 }));
    }
    const words = (lab: string, cs: string[], kk: Ink, w: number) =>
      s.alpha(w, () => {
        s.text(lab, x0 - 2 * s.u, y, { size: 3.4, font: 'mono', weight: 600, align: 'right', color: s.c(kk) });
        cs.forEach((c, i) => s.text(c, cellX(s, n, i) + (TW / 2) * s.u, y + 0.2 * s.u, { size: 3.6, font: 'mono', weight: 600 }));
      });
    words(label, cells, k, 1 - t);
    if (next) words(next.label, next.cells, next.k, t);
  });
}

/** A result line under the table. */
const result = (s: Scene, t: string, row: number, k: Ink, a: number) =>
  s.alpha(a, () => s.text(t, s.w / 2, s.h * RES[row]!, { size: 3.8, font: 'mono', weight: 600, color: s.c(k), halo: true }));

/** `v` once `a` is past halfway: a cell filled in as the voice reaches it. */
const fill = (a: number, v: string) => (a > 0.5 ? v : '');

const mixed: SceneDef = {
  marks: {
    f: { tex: String.raw`\symf(u, v) = u^2 + 3uv \quad \text{at } (1, 2)`, x: 0.5, y: 0.1, size: 4.6 },
    p1: { tex: String.raw`\symf(u, v) = 2u^2 + uv + 4v \quad \text{at } (1, 2)`, x: 0.5, y: 0.1, size: 4.6 },
    p2: { tex: String.raw`\symf(u, v) = u^2 v + 2v^2 + 3u \quad \text{at } (2, 1)`, x: 0.5, y: 0.1, size: 4.6 },
  },
  draw(s) {
    const A = 1 - s.ease('p1', 0.5);
    const B = s.ease('p1', 0.6, 0.3) * (1 - s.ease('p2', 0.5));
    const C = s.ease('p2', 0.6, 0.3);

    // u² + 3uv: hold v, then hold u.
    s.show('f', s.ease('mix', 0.6) * A);
    s.alpha(A, () => {
      const tv = s.ease('pv', 0.6);
      termRow(s, 2, 0, 'purple', s.ease('mix', 0.6, 0.8), 'f =', ['u²', '3uv']);
      termRow(s, 2, 1, 'purple', s.ease('held', 0.6), 'v = 2', ['u²', '6u'], [0, s.win('held', 'pu')], { label: 'u = 1', cells: ['1', '3v'], t: tv, k: 'purple' });
      termRow(s, 2, 2, 'gold', s.ease('pu', 0.6), '∂f/∂u', ['2u', '3v'], [0, s.win('pu', 'pv')], { label: '∂f/∂v', cells: ['0', '3u'], t: tv, k: 'teal' });
      const nx = cellX(s, 2, 2) - TGAP * s.u + 2 * s.u;
      const ny = s.h * ROW[1]!;
      const note = { size: 3, font: 'mono', weight: 600, align: 'left', halo: true } as const;
      s.alpha(s.ease('held', 0.6, 1.4) * (1 - tv), () => s.text('slope 6 = 3v', nx, ny, { ...note, color: s.c('gold') }));
      s.alpha(after(s, 'pv', 0.45), () => s.text('slope 3 = 3u', nx, ny, { ...note, color: s.c('teal') }));
      result(s, '∂f/∂u = 2u + 3v = 2 + 6 = 8', 0, 'gold', after(s, 'pu', 0.6));
      result(s, '∂f/∂v = 3u = 3', 1, 'teal', after(s, 'pv', 0.75));
      result(s, '∇f = [8, 3]', 2, 'red', s.ease('both', 0.6));
    });

    // Worked: the gradient of 2u² + uv + 4v at (1, 2).
    s.show('p1', B);
    s.alpha(B, () => {
      const u = [0.1, 0.35, 0.6].map((f) => after(s, 'a1u', f));
      const v = [0.1, 0.35, 0.55].map((f) => after(s, 'a1v', f));
      termRow(s, 3, 0, 'purple', 1, 'f =', ['2u²', 'uv', '4v']);
      termRow(s, 3, 1, 'gold', s.ease('a1u', 0.5), '∂f/∂u', [fill(u[0]!, '4u'), fill(u[1]!, 'v'), fill(u[2]!, '0')]);
      termRow(s, 3, 2, 'teal', s.ease('a1v', 0.5), '∂f/∂v', [fill(v[0]!, '0'), fill(v[1]!, 'u'), fill(v[2]!, '4')]);
      result(s, '∂f/∂u = 4u + v = 4 + 2 = 6', 0, 'gold', after(s, 'a1u', 0.8));
      result(s, '∂f/∂v = u + 4 = 1 + 4 = 5', 1, 'teal', after(s, 'a1v', 0.55));
      result(s, '∇f = [6, 5]', 2, 'red', after(s, 'a1v', 0.75));
    });

    // Worked: one partial of u²v + 2v² + 3u at (2, 1).
    s.show('p2', C);
    s.alpha(C, () => {
      const u = [0.1, 0.55, 0.7].map((f) => after(s, 'a2', f));
      termRow(s, 3, 0, 'purple', 1, 'f =', ['u²v', '2v²', '3u']);
      termRow(s, 3, 1, 'gold', s.ease('a2', 0.5), '∂f/∂u', [fill(u[0]!, '2uv'), fill(u[1]!, '0'), fill(u[2]!, '3')]);
      result(s, 'u²v is v · u²: gives v · 2u', 0, '--ink-2', after(s, 'a2', 0.1));
      result(s, '∂f/∂u = 2uv + 3 = 4 + 3 = 7', 1, 'gold', after(s, 'a2', 0.72));
    });
  },
};

export const scenes: Record<string, SceneDef> = { partials, uphill, shape, mixed };
