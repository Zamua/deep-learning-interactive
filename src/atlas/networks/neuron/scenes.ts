import type { Scene, SceneDef } from '../../../lecture/scene';
import { caption, Frame, reluGlyph, unit, vcells } from '../draw';

const W = [1, -3];
const B = 2;
const XA = [2, 1];
const XB = [1, 2];
const z = (x: number[], b = B) => W[0]! * x[0]! + W[1]! * x[1]! + b;

/** Where the inputs, the sum, the ReLU and the output sit, centered on the stage. */
function layout(s: Scene) {
  const cx = s.w / 2;
  const yc = s.h * 0.46;
  return { yc, xin: cx - 40 * s.u, xs: cx - 6 * s.u, xr: cx + 19 * s.u, xo: cx + 40 * s.u, ys: [yc - 11 * s.u, yc + 11 * s.u] };
}

const sum: SceneDef = {
  draw(s) {
    const L = layout(s);
    const u = s.u;
    const ng = s.ease('neg', 0.8);
    const lab = { size: 3.8, font: 'mono', weight: 650 } as const;
    // Inputs, then the weighted arrows into the sum.
    s.text('x', L.xin, L.ys[0]! - 9 * u, { ...lab, color: s.c('orange') });
    s.alpha(1 - ng, () => vcells(s, L.xin, L.ys, XA.map(String), 'orange', { w: 11, on: [s.win('weights', 'sum'), s.win('weights', 'sum')] }));
    s.alpha(ng, () => vcells(s, L.xin, L.ys, XB.map(String), 'orange', { w: 11, on: [1, 1] }));
    s.alpha(s.ease('weights', 0.6), () => {
      L.ys.forEach((y, i) => {
        const x0 = L.xin + 6.5 * u;
        const x1 = L.xs - 7.5 * u;
        const y1 = L.yc + (i ? 2.5 : -2.5) * u;
        s.arrow(x0, y, x1, y1, s.tint('blue', 0.8), 0.4, 2.2);
        s.text(`×${W[i]! < 0 ? '−' : ''}${Math.abs(W[i]!)}`, (x0 + x1) / 2, (y + y1) / 2 + (i ? 4 : -4) * u, { size: 3.6, font: 'mono', weight: 650, color: s.c('blue'), halo: true });
      });
      s.text('w', (L.xin + L.xs) / 2, L.ys[0]! - 9 * u, { ...lab, color: s.c('blue') });
    });
    // The bias drops into the sum from above.
    const bA = s.ease('sum', 0.6);
    s.alpha(bA, () => {
      const by = L.yc - 21 * u;
      s.text('b', L.xs - 9 * u, by, { ...lab, color: s.c('green') });
      s.cell(L.xs - 5 * u, by - 4 * u, 10 * u, 8 * u, String(B), 'green');
      s.arrow(L.xs, by + 4.5 * u, L.xs, L.yc - 7.5 * u, s.tint('green', 0.8), 0.4, 2);
    });
    const zA = s.ease('sum', 0.6, 2);
    const zv = zA > 0 ? (ng > 0.5 ? z(XB) : z(XA)) : null;
    unit(s, L.xs, L.yc, 7, zv === null ? 'Σ' : String(zv).replace('-', '−'), zv !== null && zv < 0 ? 'red' : 'purple', s.win('sum', 'relu'), 4.2);
    s.alpha(zA, () => s.text('z', L.xs, L.yc + 11 * u, { ...lab, color: s.c('purple') }));
    // The bend, then the output.
    const rA = s.ease('relu', 0.6);
    s.alpha(Math.max(0.25, rA), () => {
      s.text('ReLU', L.xr, L.yc - 10 * u, { size: 3.4, font: 'mono', weight: 600, color: s.c('--ink-2') });
      s.arrow(L.xs + 7.5 * u, L.yc, L.xr - 8 * u, L.yc, s.c('--ink-3'), 0.4, 2);
      reluGlyph(s, L.xr, L.yc, 14, 11, 'gold', { z: rA > 0.5 ? (ng > 0.5 ? z(XB) : z(XA)) : undefined, dot: ng > 0.5 ? 'red' : 'gold', on: s.win('relu', 'neg') });
    });
    s.alpha(rA, () => {
      s.arrow(L.xr + 7.5 * u, L.yc, L.xo - 6.5 * u, L.yc, s.c('--ink-3'), 0.4, 2);
      s.text('a', L.xo, L.yc - 9 * u, { ...lab, color: s.c('gold') });
      s.alpha(1 - ng, () => s.cell(L.xo - 5.5 * u, L.yc - 4.25 * u, 11 * u, 8.5 * u, String(Math.max(0, z(XA))), 'gold', { on: s.win('relu', 'neg') }));
      s.alpha(ng, () => s.cell(L.xo - 5.5 * u, L.yc - 4.25 * u, 11 * u, 8.5 * u, '0', 'gold', { on: 1 }));
    });
    // The arithmetic, under the figure.
    const cy = s.h * 0.86;
    s.alpha(s.win('weights', 'sum'), () => caption(s, '2·1 + 1·(−3)', cy));
    s.alpha(s.win('sum', 'relu'), () => caption(s, '2·1 + 1·(−3) + 2 = 1', cy, 'purple', 3.8));
    s.alpha(s.win('relu', 'neg'), () => caption(s, 'max(0, 1) = 1', cy, 'gold', 3.8));
    s.alpha(ng, () => caption(s, '1·1 + 2·(−3) + 2 = −3  →  max(0, −3) = 0', cy, '--ink-2', 3.4));
  },
};

/** The input plane, square, centered above the captions. */
function plane(s: Scene): Frame {
  const side = Math.min(s.h * 0.74, s.w - 24 * s.u);
  const l = s.w / 2 - side / 2;
  const t = s.h * 0.06;
  return new Frame(s, l, t, l + side, t + side, [-3, 3], [-3, 3]);
}

/** |z| at the far corner of the plane, where the shading is fullest. */
const ZMAX = 14;

const bend: SceneDef = {
  draw(s) {
    const F = plane(s);
    const u = s.u;
    const flat = s.ease('half', 1);
    // The score over the plane: gold above 0, slate below; the ReLU flattens the slate away.
    // z rises along w, and the frame is square, so a linear gradient along w paints it exactly.
    const along = (t: number) => [-2 + t / 10, (-3 * t) / 10];
    const [a0, a1] = [along(-ZMAX), along(ZMAX)];
    const g = s.ctx.createLinearGradient(F.X(a0[0]!), F.Y(a0[1]!), F.X(a1[0]!), F.Y(a1[1]!));
    g.addColorStop(0, s.tint('slate', 0.6 * (1 - flat)));
    g.addColorStop(0.5, s.tint('slate', 0));
    g.addColorStop(0.5, s.tint('gold', 0));
    g.addColorStop(1, s.tint('gold', 0.6));
    s.ctx.fillStyle = g;
    s.ctx.fillRect(F.l, F.t, F.r - F.l, F.b - F.t);
    s.rrect(F.l, F.t, F.r - F.l, F.b - F.t, 1, { stroke: s.c('--axis'), lw: 0.3 });
    F.axes();
    const ax = { size: 3.4, font: 'mono', weight: 600, color: s.c('orange'), halo: true } as const;
    s.text('x₀', F.r - 3 * u, F.Y(0) - 3 * u, ax);
    s.text('x₁', F.X(0) + 3.5 * u, F.t + 3.5 * u, ax);
    // The line where the score is 0.
    const lineA = s.ease('line', 0.8);
    const lineAt = (b: number) => (x0: number) => (x0 + b) / 3;
    s.alpha(lineA, () => F.fn(lineAt(B), 'purple', 0.7));
    s.alpha(s.win('line', 'half'), () => {
      s.text('z > 0', F.X(1.8), F.Y(-1.6), { size: 3.8, font: 'mono', weight: 650, color: s.c('gold'), halo: true });
      s.text('z < 0', F.X(-1.6), F.Y(1.8), { size: 3.8, font: 'mono', weight: 650, color: s.c('slate'), halo: true });
    });
    s.alpha(s.ease('half', 0.6, 0.6), () => {
      s.text('a = z', F.X(1.8), F.Y(-1.6), { size: 3.8, font: 'mono', weight: 650, color: s.c('gold'), halo: true });
      s.text('a = 0', F.X(-1.6), F.Y(1.8), { size: 3.8, font: 'mono', weight: 650, color: s.c('--ink-2'), halo: true });
    });
    // The two inputs of the first scene, one on each side.
    s.alpha(s.ease('half', 0.6, 1.6) * (1 - s.ease('bias', 0.6)), () => {
      F.dot(XA[0]!, XA[1]!, 'gold', 1.5);
      F.dot(XB[0]!, XB[1]!, 'slate', 1.5);
      s.text('[2, 1]', F.X(XA[0]!), F.Y(XA[1]!) + 4.5 * u, { size: 3.2, font: 'mono', color: s.c('orange'), halo: true });
      s.text('[1, 2]', F.X(XB[0]!) + 2.8 * u, F.Y(XB[1]!), { size: 3.2, font: 'mono', align: 'left', color: s.c('orange'), halo: true });
    });
    // With no bias the line is pinned to the origin.
    s.alpha(s.ease('bias', 0.8, 1.2), () => {
      F.fn(lineAt(0), 'purple', 0.45, -3, 3, [1.4, 1]);
      F.dot(0, 0, 'purple', 1.1);
      s.text('b = 0', F.X(-2), F.Y(-2 / 3) + 4.5 * u, { size: 3.4, font: 'mono', weight: 600, color: s.c('purple'), halo: true });
      s.text('b = 2', F.X(-1.2), F.Y(lineAt(B)(-1.2)) - 4 * u, { size: 3.4, font: 'mono', weight: 600, color: s.c('purple'), halo: true });
    });
    const cy = Math.min(s.h - 5 * u, F.b + 7 * u);
    s.alpha(s.win('linear', 'line'), () => caption(s, 'z = x₀ − 3x₁ + 2: a linear score', cy));
    s.alpha(s.win('line', 'half'), () => caption(s, 'z = 0 along a line', cy, 'purple'));
    s.alpha(s.win('half', 'bias'), () => caption(s, 'a = max(0, z): silent on one side', cy, 'gold'));
    s.alpha(s.ease('bias', 0.6), () => caption(s, 'w turns the line, b slides it', cy, 'purple'));
  },
};

export const scenes: Record<string, SceneDef> = { sum, bend };
