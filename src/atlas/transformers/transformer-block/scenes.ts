import { type Ink, lerp, type Scene, type SceneDef } from '../../../lecture/scene';
import { after, cite, columns, fmt } from '../../draw';
import { rich } from '../../linear-algebra/draw';
import { Frame, reluGlyph } from '../../networks/draw';
import { heat, stage } from '../draw';

/** Mono text centered on x, faded in by `a`. */
function label(s: Scene, text: string, x: number, y: number, a: number, k: Ink = '--ink-2', o: { size?: number; align?: CanvasTextAlign; weight?: number } = {}) {
  s.alpha(a, () => s.text(text, x, y, { size: o.size ?? 3.3, font: 'mono', weight: o.weight ?? 550, align: o.align ?? 'center', color: s.c(k), halo: true }));
}

/** A circled plus on the main path. */
function plus(s: Scene, x: number, y: number, on: number): void {
  s.circle(x, y, 3 * s.u, { fill: s.c('--card') });
  s.circle(x, y, 3 * s.u, { fill: s.tint('green', 0.15 + 0.25 * on), stroke: s.tint('green', 0.6 + 0.4 * on), lw: 0.35 });
  s.text('+', x, y + 0.2 * s.u, { size: 4, font: 'mono', weight: 700, color: s.c('green') });
}

// ---- gather, then think: attention mixes the tokens, then one MLP works on each token alone

const WORDS = ['cats', 'like', 'fish'];
/** How fish splits its attention over cats, like and itself. */
const FISH = [0.5, 0.25, 0.25];

const why: SceneDef = {
  draw(s) {
    const u = s.u;
    const xs = columns(s, 3, s.tall ? 27 : 32);
    const cw = s.tall ? 15 : 17;
    const [yT, yB, yM, yO] = [0.14, 0.38, 0.6, 0.8].map((f) => s.h * f);
    const line = s.tint('--ink-3', 0.8);

    // The block's outline, with two copies behind it for the stack.
    const blk = s.ease('stack', 0.8);
    s.alpha(blk, () => {
      const l = xs[0]! - (cw / 2 + 4) * u;
      const r = xs[2]! + (cw / 2 + 4) * u;
      const t = yT + 6.5 * u;
      const b = yO - 6.5 * u;
      for (const k of [2, 1]) s.rrect(l + 1.2 * k * u, t - 1.2 * k * u, r - l, b - t, 2, { fill: s.c('--card'), stroke: s.tint('--ink-3', 0.5), lw: 0.3 });
      s.rrect(l, t, r - l, b - t, 2, { fill: s.c('--card'), stroke: s.c('--ink-2'), lw: 0.4 });
      s.text('one block · 6 stacked', l + 2 * u, t + 3.2 * u, { size: 3, font: 'mono', weight: 600, align: 'left', color: s.c('--ink-2'), halo: true });
    });

    // Fish gathers from every token, with its weights; then every token does the same.
    const dim = 1 - 0.65 * s.ease('alone', 0.6);
    s.alpha(dim, () => {
      WORDS.forEach((_, i) => {
        const a = s.ease('gather', 0.6, 0.6 + 0.3 * i);
        s.alpha(a, () => s.line(xs[i]!, yT + 3.5 * u, xs[2]!, yB - 3.5 * u, s.tint('teal', 0.75), 0.3 + 2 * FISH[i]!));
      });
      s.alpha(after(s, 'gather', 0.62), () => {
        for (const j of [0, 1]) for (let i = 0; i < 3; i++) s.line(xs[i]!, yT + 3.5 * u, xs[j]!, yB - 3.5 * u, s.tint('--ink-3', 0.45), 0.25);
      });
      // Each weight beside the start of its line, clear of the lines heading right.
      WORDS.forEach((_, i) => {
        const a = s.ease('gather', 0.6, 1 + 0.3 * i) * (1 - s.ease('alone', 0.6));
        label(s, String(FISH[i]), xs[i]! + (i === 2 ? 5 : -5.5) * u, yT + 7.5 * u, a, 'teal', { size: 3.1, weight: 650 });
      });
    });

    WORDS.forEach((w, i) => s.cell(xs[i]! - (cw / 2) * u, yT - 3.5 * u, cw * u, 7 * u, w, 'orange', { size: 3.3 }));
    WORDS.forEach((w, i) => {
      const a = i === 2 ? s.ease('gather', 0.6, 1.4) : after(s, 'gather', 0.62);
      s.alpha(a, () => s.cell(xs[i]! - (cw / 2) * u, yB - 3.5 * u, cw * u, 7 * u, w, 'teal', { size: 3.3, on: i === 2 ? s.win('gather', 'alone') : 0 }));
    });

    // The same small network under every token.
    WORDS.forEach((w, i) => {
      const a = s.ease('alone', 0.6, 0.8 + 0.25 * i);
      s.alpha(a, () => {
        s.arrow(xs[i]!, yB + 3.8 * u, xs[i]!, yM - 4.6 * u, line, 0.35, 1.8);
        const named = s.ease('mlp', 0.6);
        s.alpha(1 - named, () => reluGlyph(s, xs[i]!, yM, cw, 8, 'gold', { on: s.win('alone', 'mlp') }));
        s.alpha(named, () => stage(s, xs[i]!, yM, cw, 8, 'MLP', 'gold', { on: s.win('mlp', 'paper') }));
        s.arrow(xs[i]!, yM + 4.4 * u, xs[i]!, yO - 4 * u, line, 0.35, 1.8);
        s.cell(xs[i]! - (cw / 2) * u, yO - 3.5 * u, cw * u, 7 * u, w, 'green', { size: 3.3 });
      });
    });

    // The shape in and out, once the block has to stack.
    const sx = xs[0]! - (cw / 2 + 2) * u;
    label(s, '(T, d)', sx, yT, blk, 'orange', { size: 3.1, align: 'right' });
    label(s, '(T, d)', sx, yO, blk, 'green', { size: 3.1, align: 'right' });

    cite(s, 'Vaswani et al., 2017', s.ease('paper', 0.6));
    const cy = s.h * 0.93;
    label(s, 'attention: each token gathers from all', s.w / 2, cy, s.win('gather', 'alone'), 'teal');
    label(s, 'then each token, alone, through one network', s.w / 2, cy, s.win('alone', 'mlp'), 'gold');
    label(s, 'MLP: multilayer perceptron', s.w / 2, cy, s.win('mlp', 'paper'), 'gold');
    label(s, 'attention, then an MLP: the Transformer', s.w / 2, cy, s.win('paper', 'stack'));
    label(s, 'same shape out as in, so blocks stack', s.w / 2, cy, blk);
  },
};

// ---- the block's diagram: a main path, two branches, two adds

interface Geo {
  mx: number;
  bx: number;
  top: number;
  bot: number;
  /** Per branch: where it leaves the path, its norm, its layer, its add, and the norm's spot on the path after the add. */
  br: { d: number; ln: number; f: number; p: number; q: number }[];
}

function geo(s: Scene): Geo {
  const y = (f: number) => s.h * f;
  return {
    mx: s.w / 2 - (s.tall ? 22 : 24) * s.u,
    bx: s.w / 2 + (s.tall ? 14 : 16) * s.u,
    top: y(0.06),
    bot: y(0.94),
    br: [
      { d: y(0.12), ln: y(0.19), f: y(0.29), p: y(0.38), q: y(0.455) },
      { d: y(0.53), ln: y(0.6), f: y(0.7), p: y(0.79), q: y(0.865) },
    ],
  };
}

interface Look {
  /** How far the main path has drawn in, top to bottom. */
  path: number;
  /** Each branch's opacity, its add's opacity, and how lit its layer is. */
  show: [number, number];
  add: [number, number];
  on: [number, number];
  /** 0: norms at the start of each branch; 1: norms on the path, after each add. */
  post: number;
  /** The MLP box widened to show d, 4d, d. */
  wide: number;
  /** The path's color and glow. */
  pathInk?: Ink;
  glow?: number;
  /** How lit the norms are. */
  lnOn?: number;
}

/** An opaque backing, so lines behind a box do not show through its tint. */
function card(s: Scene, x: number, y: number, w: number, h: number) {
  s.rrect(x - (w * s.u) / 2, y - (h * s.u) / 2, w * s.u, h * s.u, 1.6, { fill: s.c('--card') });
}

function diagram(s: Scene, G: Geo, L: Look): void {
  const u = s.u;
  const line = s.tint('--ink-3', 0.8);
  const pk = L.pathInk ?? '--ink-2';
  const y1 = lerp(G.top + 3 * u, G.bot - 4 * u, L.path);
  if (L.glow) s.alpha(L.glow, () => s.line(G.mx, G.top + 3 * u, G.mx, G.bot - 4 * u, s.tint(pk, 0.25), 2.2));
  s.line(G.mx, G.top + 3 * u, G.mx, y1, s.c(pk), 0.5);
  rich(s, [['x', 'orange'], ['  (T, d)', '--ink-3']], G.mx, G.top, { size: 3.4, weight: 600, halo: true });
  s.alpha(L.path, () => rich(s, [['out', 'green'], ['  (T, d)', '--ink-3']], G.mx, G.bot, { size: 3.4, weight: 600, halo: true }));

  G.br.forEach((b, i) => {
    const show = L.show[i]!;
    s.alpha(show, () => {
      const lnX = lerp(G.bx, G.mx, L.post);
      const lnY = lerp(b.ln, b.q, L.post);
      // The branch: off the path, down through its layer, and back into the add.
      s.line(G.mx, b.d, G.bx, b.d, line, 0.35);
      s.arrow(G.bx, b.d, G.bx, b.f - 3.6 * u, line, 0.35, 1.6);
      const fw = i === 0 ? 26 : lerp(22, 34, L.wide);
      const name = i === 0 ? 'attention' : L.wide > 0.5 ? 'd → 4d → d' : 'MLP';
      card(s, G.bx, b.f, fw, 6.5);
      stage(s, G.bx, b.f, fw, 6.5, name, i === 0 ? 'teal' : 'gold', { on: L.on[i] });
      s.line(G.bx, b.f + 3.3 * u, G.bx, b.p, line, 0.35);
      s.alpha(L.add[i]!, () => {
        s.arrow(G.bx, b.p, G.mx + 3.2 * u, b.p, line, 0.35, 1.8);
        plus(s, G.mx, b.p, L.on[i]!);
      });
      card(s, lnX, lnY, 22, 6);
      stage(s, lnX, lnY, 22, 6, 'layer norm', 'slate', { on: L.lnOn ?? 0, size: 3 });
    });
  });
}

// ---- the block, part by part

const parts: SceneDef = {
  draw(s) {
    const G = geo(s);
    const u = s.u;
    const wide = s.ease('width', 0.8);
    diagram(s, G, {
      path: s.ease('path', 1.2, 0.4),
      show: [s.ease('branch', 0.6), s.ease('mlp', 0.6)],
      add: [s.ease('add', 0.6), s.ease('mlp', 0.6, 1.4)],
      on: [s.win('branch', 'mlp'), s.win('mlp', 'out')],
      post: 0,
      wide,
      lnOn: s.win('branch', 'add') * after(s, 'branch', 0.2) * (1 - after(s, 'branch', 0.6)),
      glow: s.win('path', 'branch'),
    });
    label(s, 'x + Attn(LN(x))', G.bx, G.br[0]!.q, after(s, 'add', 0.45), 'green', { size: 3.3, weight: 650 });

    // Inside attention: a T by T grid of weights, but one vector of d numbers per token out.
    s.alpha(s.win('grid', 'mlp'), () => {
      const cx = G.bx;
      const t = s.h * 0.51;
      const b = s.h * 0.9;
      s.rrect(cx - 18 * u, t, 36 * u, b - t, 1.6, { fill: s.c('--card'), stroke: s.tint('teal', 0.6), lw: 0.35 });
      s.text('inside attention', cx, t + 4 * u, { size: 3, font: 'mono', color: s.c('--ink-2') });
      const c = 5.2;
      heat(s, cx - c * u, s.h * 0.66 - c * u, 3, c, (i, j) => [[0.6, 0.2, 0.2], [0.3, 0.5, 0.2], [0.5, 0.25, 0.25]][i]![j]!, 'green');
      s.text('weights: T × T', cx, s.h * 0.66 + 10 * u, { size: 3.1, font: 'mono', weight: 600, color: s.c('green') });
      s.alpha(after(s, 'grid', 0.5), () => s.text('hands back: (T, d)', cx, s.h * 0.66 + 16 * u, { size: 3.1, font: 'mono', weight: 650, color: s.c('teal') }));
    });

    label(s, 'paper: 512 → 2,048 → 512', G.bx, G.br[1]!.q, after(s, 'width', 0.6), 'gold', { size: 3.1 });
    s.alpha(s.ease('out', 0.6), () => s.rrect(G.mx - 14 * u, G.bot - 3.4 * u, 28 * u, 6.8 * u, 1.4, { stroke: s.tint('green', 0.8), lw: 0.35 }));
  },
};

// ---- where the norm goes: after the add (2017) or at the start of each branch (pre-norm)

/** A small chart of the step size over training: raised slowly at first, or full from the start. */
function stepSize(s: Scene, ramp: number, k: Ink, a: number) {
  const u = s.u;
  const r = s.w - 5 * u;
  const l = r - 18 * u;
  const t = 9 * u;
  const b = 16 * u;
  s.alpha(a, () => {
    s.line(l, b, r, b, s.c('--axis'), 0.3);
    s.line(l, t - 1 * u, l, b, s.c('--axis'), 0.3);
    const xr = l + ramp * 0.5 * (r - l);
    s.line(l, b, xr, t, s.c(k), 0.5);
    s.line(xr, t, r, t, s.c(k), 0.5);
    s.text('step size', (l + r) / 2, b + 3.2 * u, { size: 2.9, font: 'mono', color: s.c('--ink-2') });
  });
}

const norms: SceneDef = {
  draw(s) {
    const G = geo(s);
    const u = s.u;
    const post = s.ease('post', 1.4, 0.3) * (1 - s.ease('pre', 1.4, 0.3));
    const bare = s.ease('pre', 0.6, 1.6);
    const grad = s.ease('road', 0.8);
    const pathInk: Ink = bare > 0.5 ? 'green' : '--ink-2';
    // The gradient's way back, up along the path, drawn first so the norms on the path sit over it.
    s.alpha(grad, () => {
      const gx = G.mx - 4 * u;
      const k: Ink = bare > 0.5 ? 'green' : 'red';
      s.line(gx, G.bot - 4 * u, gx, G.top + 6 * u, s.tint(k, 0.8), 0.4, [1.2, 1]);
      s.arrow(gx, G.top + 8 * u, gx, G.top + 4 * u, s.c(k), 0.4, 1.8);
      s.text('gradient', gx - 1.5 * u, s.h * 0.66, { size: 3, font: 'mono', weight: 600, align: 'right', color: s.c(k), halo: true });
    });
    // Large near the output, at the start of training.
    s.alpha(s.win('xiong', 'pre'), () => {
      const gx = G.mx - 4 * u;
      s.line(gx, G.bot - 4 * u, gx, s.h * 0.72, s.c('red'), 1.4);
      s.text('large', gx - 1.5 * u, s.h * 0.8, { size: 3, font: 'mono', weight: 650, align: 'right', color: s.c('red'), halo: true });
    });
    diagram(s, G, {
      path: 1,
      show: [1, 1],
      add: [1, 1],
      on: [0, 0],
      post,
      wide: 0,
      pathInk,
      glow: bare,
      lnOn: s.win('road', 'pre'),
    });

    s.alpha(s.ease('calm', 0.6), () => s.text('calm', G.mx - 5.5 * u, s.h * 0.8, { size: 3, font: 'mono', weight: 650, align: 'right', color: s.c('green'), halo: true }));

    const flat = s.ease('calm', 1.2, 0.4);
    stepSize(s, 1 - flat, flat > 0.5 ? 'green' : 'red', s.ease('xiong', 0.6, 2));
    cite(s, 'Xiong et al., 2020', s.ease('xiong', 0.6));

    const tag = { size: 3.2, weight: 650 };
    label(s, 'post-norm, 2017', G.bx, G.bot, s.ease('post', 0.6) * (1 - s.ease('pre', 0.6)), 'red', tag);
    label(s, 'pre-norm: only adds', G.bx, G.bot, s.ease('pre', 0.6, 1.2), 'green', tag);
  },
};

// ---- one token's arrow, nudged by each branch

const X0 = [1, 2];
const A = [0.5, -1];
const S1 = [1.5, 1];
const M = [-0.5, 2];
const OUT = [1, 3];

/** The sums go under the plane unless the stage is wide enough to hold them beside it. */
const stacked = (s: Scene) => s.tall || s.w / s.h < 1.5;

/** The plane, square: on top of a narrow stage, at the left of a wide one. */
function plane(s: Scene): Frame {
  const st = stacked(s);
  const side = st ? Math.min(s.w - 24 * s.u, s.h * 0.58) : Math.min(s.h * 0.84, s.w * 0.4);
  const l = st ? s.w / 2 - side / 2 : s.w * 0.05;
  const t = st ? 4 * s.u : (s.h - side) / 2;
  return new Frame(s, l, t, l + side, t + side, [-1, 3], [-0.6, 3.4]);
}

/** An arrow from p to q in the plane, drawn in as `g` goes 0 -> 1. */
function vec(s: Scene, F: Frame, p: number[], q: number[], k: Ink, g: number, width = 0.6) {
  if (g <= 0.003) return;
  const x1 = lerp(p[0]!, q[0]!, g);
  const y1 = lerp(p[1]!, q[1]!, g);
  s.arrow(F.X(p[0]!), F.Y(p[1]!), F.X(x1), F.Y(y1), s.c(k), width, 2.4);
}
const vt = (v: number[]) => `[${v.map(fmt).join(', ')}]`;

const flow: SceneDef = {
  draw(s) {
    const F = plane(s);
    const u = s.u;
    // Light grid lines at the integers.
    for (let i = -1; i <= 3; i++) F.seg(i, -0.6, i, 3.4, '--axis', 0.15);
    for (let i = 0; i <= 3; i++) F.seg(-1, i, 3, i, '--axis', 0.15);
    F.axes();
    const gx = s.ease('x', 0.8, 0.3);
    const ga = s.ease('a', 0.8, 0.5);
    const gm = s.ease('m', 0.8, 0.5);
    const path = s.ease('path', 0.6);
    const lab = { size: 3.2, weight: 650 };

    s.alpha(after(s, 'a', 0.6) * (1 - after(s, 'm', 0.7)), () => vec(s, F, [0, 0], S1, 'green', 1, 0.35));
    vec(s, F, [0, 0], X0, 'orange', gx, 0.6 + 0.5 * path);
    vec(s, F, X0, S1, 'teal', ga);
    vec(s, F, S1, OUT, 'gold', gm);
    s.alpha(after(s, 'm', 0.7), () => vec(s, F, [0, 0], OUT, 'green', 1, 0.45));

    label(s, 'x', F.X(0.75) + 1.5 * u, F.Y(0.95), gx, 'orange', { size: 3.6, weight: 700 });
    label(s, 'attention', F.X(1.4) + 2 * u, F.Y(1.6), ga, 'teal', { ...lab, align: 'left' });
    label(s, vt(S1), F.X(1.6) + 1.5 * u, F.Y(0.75), after(s, 'a', 0.6) * (1 - after(s, 'm', 0.7)), 'green', { ...lab, align: 'left' });
    label(s, 'MLP', F.X(1.3) + 2.5 * u, F.Y(2.2), gm, 'gold', { ...lab, align: 'left' });
    label(s, `out ${vt(OUT)}`, F.X(1) + 2 * u, F.Y(3.1), after(s, 'm', 0.7), 'green', { ...lab, align: 'left' });
    s.alpha(path, () => F.dot(0, 0, 'orange', 1.1));

    // The arithmetic, under the plane on a phone and beside it on a desktop.
    const st = stacked(s);
    const ex = st ? s.w / 2 - 33 * u : F.r + 6 * u;
    const ys = st ? [F.b + 6 * u, F.b + 13 * u, F.b + 20 * u] : [s.h * 0.34, s.h * 0.46, s.h * 0.58];
    const o = { size: 3.2, weight: 600, align: 'left' as const };
    s.alpha(gx, () => rich(s, [['x', 'orange'], [`  ${vt(X0)}`, '--ink-2']], ex, ys[0]!, o));
    s.alpha(ga, () => rich(s, [['+ attention ', 'teal'], [vt(A), '--ink-2'], [' = ', '--ink-3'], [vt(S1), 'green']], ex, ys[1]!, o));
    s.alpha(gm, () => rich(s, [['+ MLP ', 'gold'], [vt(M), '--ink-2'], [' = ', '--ink-3'], [vt(OUT), 'green']], ex, ys[2]!, o));
    const cy = st ? s.h * 0.94 : s.h * 0.74;
    const cx = st ? s.w / 2 : ex;
    label(s, 'nudged twice, never replaced', cx, cy, path, 'orange', { size: 3.3, align: st ? 'center' : 'left' });
  },
};

export const scenes: Record<string, SceneDef> = { why, parts, norms, flow };
