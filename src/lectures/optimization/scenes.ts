import { fmt } from '../../core/code';
import { CLASS_COLORS } from '../../core/plot';
import { Rng } from '../../core/rand';
import type { Color } from '../../core/symbols';
import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../lecture/scene';
import {
  BATCH,
  CREASES,
  GRAD,
  HCURVE,
  MINI,
  ONE,
  POLL,
  RACE,
  START,
  SOFT_ANA,
  TOY,
  TOY_LR,
  TOY_SEL,
  TOY_STEPS,
  W00,
  hRel,
  lazy,
  lossAll,
  lossOne,
  lossReg,
  softLoss,
  toyParts,
} from './data';
import { Field, Frame, Heat, type Rect, area, card, dial, lock, mesh } from './draw';

// ---------------------------------------------------------------- shared pieces

const DOM: [number, number, number, number] = [-4.2, 4.2, -4.2, 4.2];
const MN = 30;

const normed = (F: Field): Float64Array => F.vals.map((v) => (v - F.lo) / (F.hi - F.lo));

/** Normalized heights of the three landscapes on the mesh grid, plus the regularized range. */
const MESH = lazy(() => {
  const one = new Field(lossOne, DOM, MN, MN);
  const all = new Field(lossAll, DOM, MN, MN);
  const reg = new Field(lossReg, DOM, MN, MN);
  return { one: normed(one), all: normed(all), reg: normed(reg), lo: reg.lo, hi: reg.hi, oneLo: one.lo, oneHi: one.hi };
});

/** The 1-D slices (b = 0), each normalized to 0..1. */
const CURVES = lazy(() => {
  const n = 168;
  const xs: number[] = [];
  const raw = { one: [] as number[], all: [] as number[], reg: [] as number[] };
  for (let k = 0; k <= n; k++) {
    const a = -4.2 + (8.4 * k) / n;
    xs.push(a);
    raw.one.push(lossOne(a, 0));
    raw.all.push(lossAll(a, 0));
    raw.reg.push(lossReg(a, 0));
  }
  const nz = (v: number[]) => {
    const lo = Math.min(...v);
    const hi = Math.max(...v);
    return v.map((x) => (x - lo) / (hi - lo));
  };
  return { xs, one: nz(raw.one), all: nz(raw.all), reg: nz(raw.reg), rawOne: raw.one };
});

const LEVELS = [0.85, 1, 1.25, 1.6, 2, 2.5, 3, 3.6, 4.2];
const RACE_HEAT = new Heat(lazy(() => new Field(lossReg, DOM, 84, 84)), { hue: 'red', lo: 0.75, hi: 4.6, levels: LEVELS });
const VALLEY_C = 10;
const VALLEY_HEAT = new Heat(lazy(() => new Field((a, b) => 0.5 * (a * a + VALLEY_C * b * b), [-5, 5, -2.6, 2.6], 100, 52)), {
  hue: 'red',
  lo: 0,
  hi: 40,
  gamma: 0.45,
  levels: [0.25, 1, 2.5, 5, 9, 14, 21, 30],
});

/** Shrinks a text size until the string fits `maxW` pixels. */
function fit(s: Scene, text: string, maxW: number, size: number, font: 'display' | 'serif' | 'mono' | 'ui' = 'display', weight = 560): number {
  const wd = s.measure(text, { size, font, weight });
  return wd > maxW ? (size * maxW) / wd : size;
}

const mixRect = (a: Rect, b: Rect, t: number): Rect => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)];

/** The 1-D slice panel and the main picture beside (or under) it. `p` slides the panel in. */
function sliceLayout(s: Scene, p: number): { panel: Rect; main: Rect } {
  const { w, h } = s;
  if (s.tall) {
    return {
      panel: [w * 0.1, h * 0.17, w * 0.82, h * 0.2],
      main: mixRect([w * 0.05, h * 0.12, w * 0.9, h * 0.84], [w * 0.05, h * 0.43, w * 0.9, h * 0.54], p),
    };
  }
  return {
    panel: [w * 0.05, h * 0.24, w * 0.4, h * 0.38],
    main: mixRect([w * 0.05, h * 0.1, w * 0.9, h * 0.86], [w * 0.48, h * 0.08, w * 0.5, h * 0.88], p),
  };
}

/** Draws a normalized 1-D slice in a panel, up to `upTo` (0..1 of its length). */
function panelCurve(s: Scene, fr: Frame, ys: (k: number) => number, col: string, upTo = 1, width = 0.7): void {
  const C = CURVES();
  const n = Math.round((C.xs.length - 1) * clamp01(upTo));
  const pts: [number, number][] = [];
  for (let k = 0; k <= n; k++) pts.push([C.xs[k]!, ys(k)]);
  fr.poly(pts, col, width);
}

function panelAxes(s: Scene, fr: Frame, a = 1): void {
  const u = s.u;
  const [bx, by, bw, bh] = fr.box;
  s.alpha(a, () => {
    s.line(bx, by + bh, bx + bw, by + bh, s.c('--axis'), 0.35);
    s.line(fr.X(0), by + bh - u, fr.X(0), by + bh + u, s.c('--axis'), 0.35);
    s.text('a', bx + bw, by + bh + u * 3, { size: 3.2, italic: true, color: s.c('--ink-3'), align: 'right' });
    s.text('0', fr.X(0), by + bh + u * 3, { size: 3, font: 'mono', color: s.c('--ink-3') });
    s.text('loss', bx, by - u * 1.5, { size: 3.2, font: 'mono', color: s.c('red'), align: 'left' });
  });
}

/** A note about the slice panel: above it on a phone, below its axis on a wide stage (line 0 or 1). */
function panelNote(s: Scene, fr: Frame, text: string, col: string, line = 0): void {
  const [bx, by, bw, bh] = fr.box;
  const u = s.u;
  if (s.tall) s.text(text, bx + bw, by - u * 1.5, { size: 3.3, italic: true, color: col, align: 'right' });
  else s.text(text, bx + bw / 2, by + bh + u * (9 + 5.5 * line), { size: fit(s, text, bw, 3.6, 'serif', 450), italic: true, color: col });
}

/** A 3 x 2 weight grid (row-major values), with per-cell emphasis. */
function grid32(s: Scene, x: number, y: number, cw: number, ch: number, vals: string[], k: Color, on: (i: number) => number, size?: number, a = 1): void {
  s.alpha(a, () => {
    for (let i = 0; i < 6; i++) {
      const r = Math.floor(i / 2);
      const c = i % 2;
      s.cell(x + c * cw, y + r * ch, cw - s.u * 0.6, ch - s.u * 0.6, vals[i] ?? '', k, { on: on(i), size });
    }
  });
}

const f2 = (v: number) => (v >= 0 ? ' ' : '') + v.toFixed(2);

function check(s: Scene, x: number, y: number, r: number, col: string): void {
  s.circle(x, y, r, { fill: col });
  s.line(x - r * 0.45, y, x - r * 0.1, y + r * 0.38, '#ffffff', r / s.u / 4.5);
  s.line(x - r * 0.1, y + r * 0.38, x + r * 0.5, y - r * 0.38, '#ffffff', r / s.u / 4.5);
}

/** A blindfolded figure standing at (x, y = feet), `sz` stage units tall. */
function hiker(s: Scene, x: number, y: number, sz: number, lean: number): void {
  const u = s.u;
  const H = sz * u;
  const ink = s.c('--ink-2');
  const hx = x + lean * H * 0.1;
  const hy = y - H * 0.86;
  s.line(x - H * 0.12, y, x, y - H * 0.42, ink, 0.6);
  s.line(x + H * 0.14, y, x, y - H * 0.42, ink, 0.6);
  s.line(x, y - H * 0.42, hx, hy + H * 0.1, ink, 0.6);
  s.line(hx, hy + H * 0.24, hx - H * 0.2, y - H * 0.5, ink, 0.55);
  s.line(hx, hy + H * 0.24, hx + H * 0.26, y - H * 0.36, ink, 0.55);
  s.circle(hx, hy, H * 0.11, { fill: s.c('--card'), stroke: ink, lw: 0.6 });
  s.rrect(hx - H * 0.13, hy - H * 0.04, H * 0.26, H * 0.07, 0.3, { fill: s.c('--ink') });
}

// ---------------------------------------------------------------- 1. the third piece

const PIECES: [string, string, Color][] = [
  ['score function', 'scores = W x', 'purple'],
  ['loss function', 'L(W): one number', 'red'],
  ['optimization', 'find the best W', 'teal'],
];

const DIALS = (() => {
  const r = new Rng(5);
  return Array.from({ length: 60 }, () => [r.uniform(-2.6, 2.6), r.uniform(-0.6, 0.6), r.uniform(0, 6)] as [number, number, number]);
})();

const intro: SceneDef = {
  marks: {
    obj: { tex: String.raw`\symL(\symW) = \frac{1}{N}\sum_{i=1}^{N} \symL_i(\symW) \;+\; \lambda \sum_{k,l} \symW_{k,l}^{2}`, x: 0.5, y: 0.25, size: 5 },
  },
  draw(s) {
    const { w, h, u } = s;
    s.alpha(s.win('hello', 'recap'), () => {
      s.text('Optimization', w / 2, h * 0.45, { size: 11, font: 'display', weight: 600 });
      s.text('how a classifier finds its weights', w / 2, h * 0.58, { size: 4.6, italic: true, color: s.c('--ink-2') });
    });
    // The three pieces.
    const cA = s.win('recap', 'objective');
    if (cA > 0) {
      s.alpha(cA, () => {
        PIECES.forEach(([title, code, k], i) => {
          const a = s.ease(['recap', 'loss', 'third'][i]!, 0.6);
          if (a <= 0) return;
          const r: Rect = s.tall ? [w * 0.12, h * (0.15 + i * 0.27), w * 0.76, h * 0.2] : [w * (0.05 + i * 0.32), h * 0.34, w * 0.26, h * 0.32];
          const glow = i === 2 ? s.ease('third', 0.6, 0.8) * (0.75 + 0.25 * Math.sin(s.t * 3)) : 0;
          s.alpha(a, () => {
            s.rrect(r[0], r[1] + (1 - a) * u * 3, r[2], r[3], 2.2, { fill: s.tint(k, 0.08 + 0.1 * glow), stroke: s.tint(k, 0.55 + 0.45 * glow), lw: 0.4 + 0.4 * glow });
            const cx = r[0] + r[2] / 2;
            const fs = fit(s, title, r[2] * 0.8, s.tall ? 5.2 : 5.4);
            s.text(title, cx, r[1] + r[3] * 0.38, { size: fs, font: 'display', weight: 600, color: s.c(k) });
            s.text(code, cx, r[1] + r[3] * 0.68, { size: fit(s, code, r[2] * 0.8, 3.8, 'mono', 500), font: 'mono', color: s.c('--ink-2') });
            if (i > 0) {
              if (s.tall) s.arrow(cx, r[1] - h * 0.065, cx, r[1] - u * 0.8, s.c('--ink-3'), 0.5);
              else s.arrow(r[0] - w * 0.055, r[1] + r[3] / 2, r[0] - u * 0.8, r[1] + r[3] / 2, s.c('--ink-3'), 0.5);
            }
          });
        });
      });
    }
    // The objective, and what is free to change.
    const oA = s.win('objective', 'dials');
    if (oA > 0) {
      s.show('obj', oA, { y: 0.24 });
      s.alpha(oA, () => {
        s.alpha(s.ease('objective', 0.6, 1.2), () => {
          s.text('average loss over the N training examples', w / 2, h * 0.41, { size: fit(s, 'average loss over the N training examples', w * 0.86, 3.8, 'serif', 450), color: s.c('red') });
          s.text('+ a penalty on big weights', w / 2, h * 0.48, { size: 3.8, color: s.c('--ink-2') });
        });
        const fA = s.ease('free', 0.6);
        s.alpha(fA, () => {
          const x0 = w / 2 - Math.min(w * 0.3, u * 30);
          lock(s, x0, h * 0.64, 5, s.c('orange'));
          s.text('X, y', x0 + u * 6, h * 0.64, { size: 5, italic: true, weight: 600, color: s.c('orange'), align: 'left' });
          s.text('fixed data', x0 + u * 19, h * 0.64, { size: 4, color: s.c('--ink-2'), align: 'left' });
          dial(s, x0, h * 0.77, u * 2.6, s.t * 1.2, s.c('blue'));
          s.text('W', x0 + u * 6, h * 0.77, { size: 5, italic: true, weight: 600, color: s.c('blue'), align: 'left' });
          s.text('free to change', x0 + u * 19, h * 0.77, { size: 4, color: s.c('--ink-2'), align: 'left' });
        });
      });
    }
    // W as a panel of dials, and the loss they set.
    const dA = s.ease('dials', 0.6);
    let loss = 9.02;
    if (dA > 0) {
      const g = s.tall ? [w * 0.08, h * 0.14, w * 0.84, h * 0.42] : [w * 0.05, h * 0.16, w * 0.56, h * 0.6];
      const cols = 10;
      const rows = 6;
      const cs = Math.min(g[2]! / cols, g[3]! / rows);
      const ox = g[0]! + (g[2]! - cs * cols) / 2;
      const oy = g[1]! + (g[3]! - cs * rows) / 2;
      const turn = s.ease('goal', 4.5, 0.3);
      s.alpha(dA, () => {
        DIALS.forEach(([a0, a1, ph], i) => {
          const jig = s.since('goal') < 0 ? 0.35 * Math.sin(s.t * 1.7 + ph) : 0;
          const ang = lerp(a0 + jig, a1, turn);
          dial(s, ox + (i % cols + 0.5) * cs, oy + (Math.floor(i / cols) + 0.5) * cs, cs * 0.36, ang, s.c('blue'));
        });
        s.text('60 of the 30,730 dials in W', ox + (cs * cols) / 2, oy + cs * rows + u * 3, { size: 3.3, font: 'mono', color: s.c('--ink-3') });
        loss = s.since('goal') < 0 ? 9.02 + 0.6 * Math.sin(s.t * 1.3) : lerp(9.02, 0.78, turn);
        const bx = s.tall ? w / 2 : w * 0.8;
        const by = s.tall ? h * 0.74 : h * 0.44;
        s.rrect(bx - u * 15, by - u * 8, u * 30, u * 16, 2, { fill: s.tint('red', 0.1), stroke: s.c('red'), lw: 0.5 });
        s.text('loss', bx, by - u * 4, { size: 3.4, font: 'mono', color: s.c('red') });
        s.text(loss.toFixed(2), bx, by + u * 2.6, { size: 7, font: 'mono', weight: 650, color: s.c('red') });
      });
      s.alpha(s.ease('general', 0.6), () => {
        const y = s.tall ? h * 0.9 : h * 0.86;
        const t = 'today: the SVM loss.  later: millions of weights.';
        s.text(t, w / 2, y, { size: fit(s, t, w * 0.9, 3.8, 'serif', 450), italic: true, color: s.c('--ink-2') });
      });
    }
    s.slot('loss', fmt(Math.round(loss * 100) / 100));
  },
};

// ---------------------------------------------------------------- 2. the landscape

/** Height of the regularized loss, normalized like the mesh. */
function zReg(a: number, b: number): number {
  const M = MESH();
  return (lossReg(a, b) - M.lo) / (M.hi - M.lo);
}

const landscape: SceneDef = {
  marks: {
    s1: { tex: String.raw`\symL(\symW + a\,W_1)`, x: 0.5, y: 0.1, size: 4.2 },
    s2: { tex: String.raw`\symL(\symW + a\,W_1 + b\,W_2)`, x: 0.5, y: 0.4, size: 4.2 },
  },
  draw(s) {
    const { w, h, u } = s;
    const M = MESH();
    // On a phone the panel leaves when the map arrives, so the map can use the whole stage.
    const out = s.tall ? s.ease('map', 0.9, 1.6) : 0;
    const pin = s.ease('walk', 0.9) * (1 - out);
    const lay = sliceLayout(s, pin);
    const panel = lay.panel;
    const main = s.tall ? mixRect(lay.main, [w * 0.05, h * 0.18, w * 0.9, h * 0.79], out) : lay.main;
    const morph = s.ease('map', 2.4, 0.4);
    const cam = { az: lerp(0.62 + 0.1 * Math.sin(s.t * 0.2), 0, morph), el: lerp(0.62, Math.PI / 2, morph), zk: lerp(3.4, 0, morph) };
    const heatA = s.ease('map', 1, 2.5);
    const proj = mesh(s, main, DOM, MN, (i, j) => M.reg[j * (MN + 1) + i]!, cam, 'red', 1 - heatA);
    const fr = new Frame(s, main, DOM, true);
    if (heatA > 0) {
      RACE_HEAT.draw(fr, heatA);
      s.alpha(heatA, () => {
        s.line(fr.X(-4.2), fr.Y(0), fr.X(4.2), fr.Y(0), s.tint('--ink', 0.6), 0.4, [1.4, 1]);
        s.text('a →', fr.X(-4.0), fr.Y(0) - u * 2.4, { size: 3.2, color: s.c('--ink-2'), align: 'left', halo: true });
        s.text('b ↑', fr.X(0.25), fr.Y(3.8), { size: 3.2, color: s.c('--ink-2'), align: 'left', halo: true });
      });
      const [bx, by] = fr.box;
      s.show('s2', heatA, { x: (bx + fr.box[2] / 2) / s.w, y: (by - u * 4.2) / s.h });
    }
    // A walker on the surface, with its altitude.
    const wA = s.win('loc', 'low');
    if (wA > 0) {
      const p = smooth(s.prog('loc') * 1.1);
      const a = lerp(-3.4, 2.6, p);
      const b = 2.6 * Math.sin(p * Math.PI * 0.9) - 0.6;
      const z = zReg(a, b);
      const top = proj(a, b, z);
      const base = proj(a, b, 0);
      s.alpha(wA, () => {
        s.line(base[0], base[1], top[0], top[1], s.c('--ink-2'), 0.35, [0.8, 0.8]);
        s.circle(top[0], top[1], u * 1.5, { fill: s.c('orange'), stroke: s.c('--card'), lw: 0.4 });
        s.text(`loss ${lossReg(a, b).toFixed(2)}`, top[0], top[1] - u * 4, { size: 3.6, font: 'mono', weight: 600, color: s.c('red'), halo: true });
        s.alpha(s.ease('loc', 0.5, 1), () => s.text('altitude = loss', base[0] + u * 1.5, (base[1] + top[1]) / 2, { size: 3.2, italic: true, color: s.c('--ink-2'), align: 'left', halo: true }));
      });
    }
    const lA = s.win('low', 'dims');
    if (lA > 0) {
      const [fx, fy] = proj(0, 0, zReg(0, 0));
      s.alpha(lA, () => {
        s.line(fx, fy, fx, fy - u * 11, s.c('--ink'), 0.4);
        const c = s.ctx;
        c.beginPath();
        c.moveTo(fx, fy - u * 11);
        c.lineTo(fx + u * 6, fy - u * 9);
        c.lineTo(fx, fy - u * 7);
        c.closePath();
        c.fillStyle = s.c('green');
        c.fill();
        s.text('lowest point', fx + u * 7, fy - u * 9, { size: 3.6, italic: true, align: 'left', halo: true });
      });
    }
    // Far too many directions to picture.
    const dA = s.win('dims', 'slice');
    if (dA > 0) {
      const [cx, cy] = proj(0, 0, zReg(0, 0));
      const rng = new Rng(11);
      s.alpha(dA, () => {
        for (let k = 0; k < 26; k++) {
          const ang = rng.uniform(0, Math.PI * 2);
          const len = u * rng.uniform(6, 13) * s.ease('dims', 0.8, k * 0.04);
          s.arrow(cx, cy, cx + Math.cos(ang) * len, cy + Math.sin(ang) * len * 0.75, s.tint('blue', 0.75), 0.3, 1.6);
        }
        s.text('30,730 directions', cx, cy - u * 15, { size: 4.4, font: 'display', weight: 600, color: s.c('blue'), halo: true });
      });
    }
    // Standing on W, a random heading.
    const sA = s.ease('slice', 0.6) * (1 - heatA);
    if (sA > 0) {
      const z0 = zReg(0, 0);
      const [cx, cy] = proj(0, 0, z0);
      const [ex, ey] = proj(2.6, 0, z0);
      s.alpha(sA, () => {
        s.alpha(s.ease('slice', 0.6, 1.6), () => {
          s.arrow(cx, cy, ex, ey, s.c('blue'), 0.7, 2.6);
          s.text('W₁', ex + u * 1.5, ey + u * 1.5, { size: 4, italic: true, weight: 600, color: s.c('blue'), align: 'left', halo: true });
        });
        s.circle(cx, cy, u * 1.4, { fill: s.c('blue'), stroke: s.c('--card'), lw: 0.4 });
        s.text('W', cx - u * 2, cy - u * 2.5, { size: 4.2, italic: true, weight: 600, color: s.c('blue'), align: 'right', halo: true });
      });
    }
    // The 1-D slice: along the surface, and flattened into a plot.
    if (pin > 0.003) {
      const C = CURVES();
      const p = s.since('map') >= 0 ? 1 : clamp01(s.prog('walk') * 1.15);
      const pts: [number, number][] = [];
      const n = Math.round((C.xs.length - 1) * p);
      for (let k = 0; k <= n; k++) {
        const a = C.xs[k]!;
        pts.push(proj(a, 0, zReg(a, 0)));
      }
      s.alpha(pin * (1 - heatA), () => {
        const c = s.ctx;
        c.beginPath();
        pts.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y)));
        c.strokeStyle = s.c('red');
        c.lineWidth = u * 0.7;
        c.stroke();
      });
      const pf = new Frame(s, panel, [-4.2, 4.2, -0.08, 1.08]);
      s.alpha(pin, () => {
        panelAxes(s, pf);
        panelCurve(s, pf, (k) => C.reg[k]!, s.c('red'), p, 0.7);
        if (p < 1) {
          const k = n;
          pf.dot(C.xs[k]!, C.reg[k]!, 1.1, s.c('orange'));
        }
        pf.dot(0, C.reg[84]!, 1.1, s.c('blue'));
      });
      s.show('s1', pin, { x: (panel[0] + panel[2] / 2) / s.w, y: (panel[1] - u * 5) / s.h });
    }
  },
};

// ---------------------------------------------------------------- 3. creases and bowls

/** Interpolates the three landscapes: 0 one example, 1 all examples, 2 regularized. */
function stageMix(s: Scene): number {
  const m1 = s.ease('all', 2.4, 0.3);
  const m2 = s.ease('reg', 2, 0.3);
  const back = s.ease('kink', 1.6, 0.2);
  return lerp(m1 + m2, 0, back);
}
const pick3 = (one: number, all: number, reg: number, m: number) => (m <= 1 ? lerp(one, all, m) : lerp(all, reg, m - 1));

/** The bumpy curve of a non-convex loss, on the panel's a axis. */
const bumpy = (a: number) => 0.06 * a * a + 0.28 * Math.sin(1.7 * a + 0.4) + 0.12 * Math.sin(3.1 * a);

const creases: SceneDef = {
  marks: {
    hinge: { tex: String.raw`\max(0,\ \cdot\,)`, x: 0.5, y: 0.1, size: 4.4 },
  },
  draw(s) {
    const { w, h, u } = s;
    const M = MESH();
    const C = CURVES();
    const { panel, main } = sliceLayout(s, 1);
    const m = stageMix(s);
    const proj = mesh(s, main, DOM, MN, (i, j) => {
      const k = j * (MN + 1) + i;
      return pick3(M.one[k]!, M.all[k]!, M.reg[k]!, m);
    }, { az: 0.62 + 0.1 * Math.sin(s.t * 0.2), el: 0.62, zk: 3.4 }, 'red');
    // The creases of the single-example surface: where one hinge switches on.
    const crA = clamp01(1 - m * 3);
    if (crA > 0) {
      const c = s.ctx;
      s.alpha(crA, () => {
        for (const line of CREASES) {
          c.beginPath();
          line.forEach(([a, b], k) => {
            const [X, Y] = proj(a, b, (lossOne(a, b) - M.oneLo) / (M.oneHi - M.oneLo));
            if (k) c.lineTo(X, Y);
            else c.moveTo(X, Y);
          });
          c.strokeStyle = s.c('--ink');
          c.lineWidth = u * 0.45;
          c.setLineDash([u * 1.2, u * 0.8]);
          c.stroke();
          c.setLineDash([]);
        }
      });
    }
    const pf = new Frame(s, panel, [-4.2, 4.2, -0.08, 1.08]);
    const yv = (k: number) => pick3(C.one[k]!, C.all[k]!, C.reg[k]!, m);
    const nn = s.win('nn', 'kink');
    panelAxes(s, pf);
    // Floors and ramps of the single-example slice.
    const fl = s.win('hinge', 'all');
    s.alpha(1 - 0.75 * nn, () => {
      if (fl > 0) {
        const pts = C.xs.map((a, k) => [a, yv(k)] as [number, number]);
        for (let k = 0; k < pts.length - 1; k++) {
          const flat = Math.abs(C.rawOne[k + 1]! - C.rawOne[k]!) < 1e-9;
          s.line(pf.X(pts[k]![0]), pf.Y(pts[k]![1]), pf.X(pts[k + 1]![0]), pf.Y(pts[k + 1]![1]), flat ? s.c('slate') : s.c('red'), 0.7 + 0.4 * fl);
        }
      } else panelCurve(s, pf, yv, s.c('red'), 1, 0.7);
    });
    if (fl > 0) {
      // Label the middle of the longest flat run, and the middle of the steepest ramp.
      const n = C.xs.length - 1;
      let best = [0, 0];
      let run = 0;
      for (let k = 0; k < n; k++) {
        run = Math.abs(C.rawOne[k + 1]! - C.rawOne[k]!) < 1e-9 ? run + 1 : 0;
        if (run > best[1]!) best = [k, run];
      }
      const kf = best[0]! - Math.floor(best[1]! / 2);
      let ks = 0;
      for (let k = 0; k < n; k++) if (Math.abs(C.one[k + 1]! - C.one[k]!) > Math.abs(C.one[ks + 1]! - C.one[ks]!)) ks = k;
      s.alpha(fl, () => {
        s.text('off: flat', pf.X(C.xs[kf]!), pf.Y(C.one[kf]!) - u * 3, { size: 3.3, font: 'mono', color: s.c('slate'), halo: true });
        s.text('on: ramp', pf.X(C.xs[ks]!) - u * 2, pf.Y(C.one[ks]!) - u * 3.5, { size: 3.3, font: 'mono', color: s.c('red'), halo: true, align: 'right' });
      });
      s.show('hinge', fl, { x: (panel[0] + panel[2] / 2) / w, y: (panel[1] - u * 4.5) / h });
    }
    // Convexity: every chord stays above the curve.
    const cvA = s.win('convex', 'nn');
    if (cvA > 0) {
      const ka = 22;
      const kb = 150;
      const pa: [number, number] = [C.xs[ka]!, yv(ka)];
      const pb: [number, number] = [C.xs[kb]!, yv(kb)];
      s.alpha(cvA * s.ease('convex', 0.6, 0.6), () => {
        const c = s.ctx;
        c.beginPath();
        c.moveTo(pf.X(pa[0]), pf.Y(pa[1]));
        for (let k = ka; k <= kb; k++) c.lineTo(pf.X(C.xs[k]!), pf.Y(yv(k)));
        c.closePath();
        c.fillStyle = s.tint('--accent', 0.12);
        c.fill();
        s.line(pf.X(pa[0]), pf.Y(pa[1]), pf.X(pb[0]), pf.Y(pb[1]), s.c('--accent'), 0.5);
        pf.dot(pa[0], pa[1], 0.9, s.c('--accent'));
        pf.dot(pb[0], pb[1], 0.9, s.c('--accent'));
        panelNote(s, pf, 'the chord never dips below', s.c('--accent'));
      });
      // A ball rolling to the one bottom there is.
      s.alpha(s.win('nodips', 'nn'), () => {
        const k = Math.round(lerp(22, 84, smooth(s.prog('nodips') * 1.4)));
        s.circle(pf.X(C.xs[k]!), pf.Y(yv(k)) - u * 1.3, u * 1.3, { fill: s.c('orange') });
        s.alpha(s.ease('nodips', 0.5, 2), () => (s.tall ? s.text('one bottom', pf.X(0), pf.Y(0) - u * 5.2, { size: 3.2, italic: true, color: s.c('--ink-2'), halo: true }) : panelNote(s, pf, 'one bottom', s.c('--ink-2'), 1)));
      });
    }
    // Neural networks: bumpy.
    if (nn > 0) {
      s.alpha(nn, () => {
        const lo = Math.min(...C.xs.map(bumpy));
        const hi = Math.max(...C.xs.map(bumpy));
        pf.fn((a) => (bumpy(a) - lo) / (hi - lo), s.c('purple'), 0.7, -4.2, 4.2);
        const ka = -1.95;
        s.circle(pf.X(ka), pf.Y((bumpy(ka) - lo) / (hi - lo)) - u * 1.3, u * 1.3, { fill: s.c('orange') });
        panelNote(s, pf, 'a neural network: bumpy', s.c('purple'));
      });
    }
    // Every piece convex, so the sum is.
    const vA = s.win('svm', 'nn');
    if (vA > 0) {
      const rows = ['each hinge: convex', 'the penalty: convex', 'their sum: convex'];
      const x = s.tall ? w * 0.5 : main[0] + main[2] * 0.52;
      const y = s.tall ? h * 0.82 : h * 0.74;
      s.alpha(vA, () => {
        const bw = Math.max(...rows.map((r) => s.measure(r, { size: 3.4, font: 'mono' }))) + u * 11;
        s.rrect(x - bw / 2, y - u * 3, bw, u * 17.5, 1.6, { fill: s.tint('--card', 0.92), stroke: s.c('--rule'), lw: 0.3 });
        rows.forEach((r, i) => {
          const a = s.ease('svm', 0.4, 0.3 + i * 1.6);
          s.alpha(a, () => {
            check(s, x - bw / 2 + u * 4.5, y + u * 2 + i * u * 5.2, u * 1.6, s.c('green'));
            s.text(r, x - bw / 2 + u * 8, y + u * 2 + i * u * 5.2, { size: 3.4, font: 'mono', align: 'left' });
          });
        });
      });
    }
    // A crease: the slope jumps, use either side.
    const kA = s.ease('kink', 0.6, 1.4);
    if (kA > 0) {
      let kk = 0;
      let best = 0;
      for (let k = 1; k < C.xs.length - 1; k++) {
        const d = Math.abs(C.rawOne[k + 1]! - 2 * C.rawOne[k]! + C.rawOne[k - 1]!);
        if (d > best && C.xs[k]! > -3 && C.xs[k]! < 3) {
          best = d;
          kk = k;
        }
      }
      const ax = C.xs[kk]!;
      const ay = C.one[kk]!;
      const sl = (k0: number, k1: number) => (C.one[k1]! - C.one[k0]!) / (C.xs[k1]! - C.xs[k0]!);
      const sL = sl(kk - 6, kk - 1);
      const sR = sl(kk + 1, kk + 6);
      s.alpha(kA, () => {
        s.line(pf.X(ax - 1.6), pf.Y(ay - 1.6 * sL), pf.X(ax + 1.6), pf.Y(ay + 1.6 * sL), s.c('teal'), 0.4, [1, 0.8]);
        s.line(pf.X(ax - 1.6), pf.Y(ay - 1.6 * sR), pf.X(ax + 1.6), pf.Y(ay + 1.6 * sR), s.c('teal'), 0.4, [1, 0.8]);
        pf.dot(ax, ay, 1.1, s.c('teal'));
        panelNote(s, pf, 'the slope jumps: use either side', s.c('teal'));
      });
    }
    const allNow = m > 0.5;
    s.slot('which', allNow ? 'all 300 points' : 'one example');
    s.slot('idx', allNow ? ':' : `${ONE}:${ONE + 1}`);
    s.slot('reg', m > 1.5 ? 0.05 : 0);
  },
};

// ---------------------------------------------------------------- 4. three ways to search

const COL = { rs: 'gold', ls: 'purple', gd: 'teal' } as const;

function racePath(at: [number, number][], n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let r = 0; r <= n; r++) {
    const p = at[r]!;
    const q = out[out.length - 1];
    if (!q || q[0] !== p[0] || q[1] !== p[1]) out.push(p);
  }
  return out;
}

function drawWalkers(s: Scene, fr: Frame, n: { rs: number; ls: number; gd: number }, a: { rs: number; ls: number; gd: number }): void {
  fr.clip(() => {
    s.alpha(a.rs, () => {
      for (let r = 1; r <= n.rs; r++) fr.dot(RACE.rsTry[r]![0], RACE.rsTry[r]![1], 0.65, s.tint(COL.rs, 0.55), false);
      fr.poly(racePath(RACE.rsAt, n.rs), s.c(COL.rs), 0.45);
    });
    s.alpha(a.ls, () => {
      for (let r = 1; r <= n.ls; r++) fr.dot(RACE.lsTry[r]![0], RACE.lsTry[r]![1], 0.45, s.tint(COL.ls, 0.5), false);
      fr.poly(racePath(RACE.lsAt, n.ls), s.c(COL.ls), 0.55);
    });
    s.alpha(a.gd, () => {
      const pts = RACE.gdAt.slice(0, n.gd + 1);
      fr.poly(pts, s.c(COL.gd), 0.6);
      pts.forEach(([x, y]) => fr.dot(x, y, 0.55, s.c(COL.gd), false));
    });
  });
  s.circle(fr.X(START[0]), fr.Y(START[1]), s.u * 1.7, { stroke: s.c('--ink'), lw: 0.4 });
  if (a.rs > 0.01 && n.rs > 0) s.alpha(a.rs, () => fr.dot(RACE.rsAt[n.rs]![0], RACE.rsAt[n.rs]![1], 1.3, s.c(COL.rs)));
  if (a.ls > 0.01 && n.ls > 0) s.alpha(a.ls, () => fr.dot(RACE.lsAt[n.ls]![0], RACE.lsAt[n.ls]![1], 1.3, s.c(COL.ls)));
  if (a.gd > 0.01 && n.gd > 0) s.alpha(a.gd, () => fr.dot(RACE.gdAt[n.gd]![0], RACE.gdAt[n.gd]![1], 1.3, s.c(COL.gd)));
}

/** The map's frame for the race scenes, and the free strip beside it (wide stages only). */
function mapLayout(s: Scene): { fr: Frame; side: Rect | null } {
  const { w, h } = s;
  if (s.tall) return { fr: new Frame(s, [w * 0.04, h * 0.11, w * 0.92, h * 0.86], DOM, true), side: null };
  const fr = new Frame(s, [w * 0.04, h * 0.08, w * 0.58, h * 0.88], DOM, true);
  const [bx, , bw] = fr.box;
  return { fr, side: [bx + bw + s.u * 4, h * 0.12, w - (bx + bw) - s.u * 8, h * 0.8] };
}

const search: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    // A blindfolded hiker on a hillside.
    const hA = s.win('blind', 'rs');
    if (hA > 0) {
      const ground = (xf: number) => h * (0.36 + 0.46 * smooth(xf * 1.15));
      s.alpha(hA, () => {
        const c = s.ctx;
        c.beginPath();
        c.moveTo(0, h);
        for (let k = 0; k <= 60; k++) c.lineTo((w * k) / 60, ground(k / 60));
        c.lineTo(w, h);
        c.closePath();
        c.fillStyle = s.tint('red', 0.12);
        c.fill();
        c.beginPath();
        for (let k = 0; k <= 60; k++) (k ? c.lineTo : c.moveTo).call(c, (w * k) / 60, ground(k / 60));
        c.strokeStyle = s.c('red');
        c.lineWidth = u * 0.6;
        c.stroke();
        const fx = w * 0.24;
        hiker(s, fx, ground(0.24), 22, 1);
        s.text('?', fx + u * 6, ground(0.24) - u * 25 + Math.sin(s.t * 2) * u * 0.6, { size: 6, font: 'display', color: s.c('--ink-3') });
        s.text('valley floor', w * 0.86, ground(0.95) - u * 3, { size: 3.6, italic: true, color: s.c('--ink-2') });
        const rows: [string, Color][] = [
          ['1  random search', COL.rs],
          ['2  random local search', COL.ls],
          ['3  follow the slope', COL.gd],
        ];
        rows.forEach(([t, k], i) => {
          s.alpha(s.ease('three', 0.5, 0.3 + i * 0.6), () => {
            const x = s.tall ? w * 0.42 : w * 0.5;
            const y = h * (s.tall ? 0.2 : 0.22) + i * u * 8;
            s.circle(x, y, u * 1.3, { fill: s.c(k) });
            s.text(t, x + u * 3, y, { size: fit(s, t, w * 0.5, 4.2, 'ui', 500), font: 'ui', weight: 500, align: 'left' });
          });
        });
      });
    }
    const mA = s.ease('rs', 0.6);
    if (mA <= 0) return;
    const { fr, side } = mapLayout(s);
    const racing = s.since('race') >= 0;
    // Slow early rounds, where gradient descent pulls ahead.
    const rr = Math.round(60 * clamp01(s.prog('race') * 1.1) ** 1.7);
    const n = racing
      ? { rs: rr, ls: rr, gd: rr }
      : {
          rs: Math.round(60 * clamp01(s.span('rs', 'rsacc') * 1.15)),
          ls: s.since('ls') >= 0 ? Math.round(60 * clamp01(s.span('ls', 'lsacc') * 1.15)) : 0,
          gd: 0,
        };
    const lsOn = s.ease('ls', 0.6);
    const cav = s.ease('caveat', 0.6) * 0.65;
    const al = racing ? { rs: 1, ls: 1, gd: 1 } : { rs: 1 - 0.6 * lsOn, ls: lsOn, gd: 0 };
    s.alpha(mA, () => {
      RACE_HEAT.draw(fr, 1 - cav);
      s.alpha(1 - cav, () => drawWalkers(s, fr, n, al));
      if (racing) s.alpha(1 - cav, () => s.text(`round ${rr}`, fr.box[0] + fr.box[2] - u * 2, fr.box[1] + u * 3.5, { size: 3.6, font: 'mono', weight: 600, align: 'right', halo: true }));
      // The slope's suggestion at the start.
      s.alpha(s.win('slope', 'race'), () => {
        const [ga, gb] = GRAD.slice;
        const L = Math.hypot(ga, gb);
        fr.arrow(START[0], START[1], START[0] - (1.5 * ga) / L, START[1] - (1.5 * gb) / L, s.c(COL.gd), 0.9);
        s.text('steepest way down', fr.X(START[0] - (1.5 * ga) / L) - u * 2, fr.Y(START[1] - (1.5 * gb) / L) + u * 4, { size: 3.4, italic: true, color: s.c(COL.gd), align: 'left', halo: true });
      });
      const legend = [
        { text: 'random search', dot: s.c(COL.rs), on: 1, loss: RACE.rsLoss[n.rs]! },
        { text: 'random local search', dot: s.c(COL.ls), on: s.ease('ls', 0.5), loss: RACE.lsLoss[n.ls]! },
        { text: 'gradient descent', dot: s.c(COL.gd), on: s.ease('slope', 0.5), loss: RACE.gdLoss[n.gd]! },
      ].filter((r) => r.on > 0.5);
      const rows = legend.map((r) => ({ text: racing ? `${r.text}  ${r.loss.toFixed(2)}` : r.text, dot: r.dot }));
      const [bx, by, bw, bh] = fr.box;
      const accRows: { text: string; mono: boolean; col?: string }[] = [{ text: 'test accuracy', mono: false }, { text: 'chance         10%', mono: true }];
      if (s.ease('rsacc', 0.5) > 0.5) accRows.push({ text: 'random search  15.5%', mono: true, col: s.c(COL.rs) });
      if (s.ease('lsacc', 0.5) > 0.5) accRows.push({ text: 'local search   21.4%', mono: true, col: s.c(COL.ls) });
      const accA = s.ease('rsacc', 0.6) * (1 - s.ease('slope', 0.6));
      if (side) {
        card(s, side[0], side[1], rows, { size: 3.3 });
        if (accA > 0) card(s, side[0], side[1] + side[3] * 0.45, accRows, { size: 3.3, a: accA });
      } else {
        const lh = rows.length * 3.3 * u * 1.45 + u * 2.2;
        card(s, bx + u * 1.5, by + bh - lh - u * 1.5, rows, { size: 3.1 });
        if (accA > 0) card(s, bx + bw - u * 1.5, by + u * 1.5, accRows, { size: 3.1, align: 'right', a: accA });
      }
    });
    if (cav > 0) {
      s.alpha(cav / 0.65, () => {
        const [bx, by, bw, bh] = fr.box;
        const cx = bx + bw / 2;
        const cy = by + bh / 2;
        s.rrect(cx - bw * 0.44, cy - u * 11, bw * 0.88, u * 22, 2, { fill: s.tint('--card', 0.94), stroke: s.c('--rule'), lw: 0.3 });
        const t1 = '2 directions: darts cover the map';
        const t2 = '30,730 directions: they cover nothing';
        s.text(t1, cx, cy - u * 4, { size: fit(s, t1, bw * 0.8, 4, 'serif', 450), color: s.c(COL.rs) });
        s.text(t2, cx, cy + u * 4.5, { size: fit(s, t2, bw * 0.8, 4, 'serif', 450), weight: 600, color: s.c('--ink') });
      });
    }
  },
};


// ---------------------------------------------------------------- 5. slopes and the gradient

const pow10 = (e: number) => (e === 0 ? '1' : `1e${e}`);

/** Two 3 x 2 grids side by side (W and its gradient), centered at `cy`. Returns cell size and origins. */
function gridPair(s: Scene, cy: number): { cw: number; ch: number; x1: number; x2: number; y: number } {
  const { w, u } = s;
  const cw = Math.min(u * 15, w * 0.19);
  const ch = cw * 0.6;
  const gap = Math.max(u * 10, w * 0.08);
  const x1 = w / 2 - gap / 2 - 2 * cw;
  return { cw, ch, x1, x2: w / 2 + gap / 2, y: cy - 1.5 * ch };
}

function mapFrame(s: Scene): Frame {
  const { w, h } = s;
  return new Frame(s, s.tall ? [w * 0.04, h * 0.11, w * 0.92, h * 0.86] : [w * 0.15, h * 0.08, w * 0.7, h * 0.88], DOM, true);
}

const gradient: SceneDef = {
  marks: {
    deriv: { tex: String.raw`\frac{df(x)}{dx} = \lim_{\symh \to 0} \frac{f(x + \symh) - f(x)}{\symh}`, x: 0.5, y: 0.15, size: 4.4 },
    partial: { tex: String.raw`\frac{\partial \symL}{\partial \symW_{k}}`, x: 0.5, y: 0.19, size: 7 },
    grad: { tex: String.raw`\symdW = \Big[\, \frac{\partial \symL}{\partial \symW_{1}},\ \dots,\ \frac{\partial \symL}{\partial \symW_{n}} \,\Big]`, x: 0.5, y: 0.17, size: 4.4 },
  },
  draw(s) {
    const { w, h, u } = s;
    // Phase 1: the slope of x squared at 3.
    const aA = s.win('deriv', 'many');
    if (aA > 0) {
      const fr = new Frame(s, s.tall ? [w * 0.06, h * 0.27, w * 0.88, h * 0.68] : [w * 0.1, h * 0.27, w * 0.8, h * 0.68], [-4.5, 5.3, -2, 27]);
      const f = (x: number) => x * x;
      let hh = 2;
      if (s.since('shrink') >= 0) hh = 2 * 10 ** (-2.3 * smooth(s.prog('shrink') * 1.2));
      if (s.since('six') >= 0) hh = 1e-5;
      const slope = (f(3 + hh) - f(3)) / hh;
      s.slot('h', s.since('six') >= 0 ? '1e-5' : fmt(hh, 2));
      s.slot('sl', s.since('six') >= 0 ? '6.00001' : fmt(slope, 3));
      s.alpha(aA, () => {
        s.line(fr.X(-4.5), fr.Y(0), fr.X(5.3), fr.Y(0), s.c('--axis'), 0.35);
        s.line(fr.X(0), fr.Y(-2), fr.X(0), fr.Y(27), s.c('--axis'), 0.35);
        fr.fn(f, s.c('--ink-2'), 0.7);
        s.text('f(x) = x²', fr.X(-3.9), fr.Y(23), { size: 4, italic: true, color: s.c('--ink-2'), align: 'left', halo: true });
        const sec = s.win('rise', 'six');
        s.alpha(sec, () => {
          fr.fn((x) => 9 + slope * (x - 3), s.c('--accent'), 0.45, 2.2, 5.3, [1.2, 1]);
          if (hh > 0.08) {
            s.line(fr.X(3), fr.Y(9), fr.X(3 + hh), fr.Y(9), s.c('purple'), 0.6);
            s.line(fr.X(3 + hh), fr.Y(9), fr.X(3 + hh), fr.Y(f(3 + hh)), s.c('--ink-2'), 0.5);
            s.text('h', fr.X(3 + hh / 2), fr.Y(9) + u * 3, { size: 3.8, italic: true, weight: 600, color: s.c('purple'), halo: true });
            s.text('rise', fr.X(3 + hh) + u * 1.5, fr.Y((9 + f(3 + hh)) / 2), { size: 3.4, italic: true, color: s.c('--ink-2'), align: 'left', halo: true });
            fr.dot(3 + hh, f(3 + hh), 1.1, s.c('--accent'));
          }
          s.text(`rise / run = ${slope.toFixed(hh < 0.05 ? 3 : 2)}`, fr.X(5.2), fr.Y(1.6), { size: 3.8, font: 'mono', weight: 600, color: s.c('--accent'), align: 'right', halo: true });
        });
        s.alpha(s.win('six', 'sign'), () => {
          fr.fn((x) => 9 + 6 * (x - 3), s.c('teal'), 0.7, 2.0, 5.3);
          s.text('tangent: slope 6', fr.X(5.2), fr.Y(1.6), { size: 3.8, font: 'mono', weight: 600, color: s.c('teal'), align: 'right', halo: true });
        });
        if (s.since('rise') >= 0 && s.since('sign') < 0) fr.dot(3, 9, 1.3, s.c('orange'));
        s.show('deriv', aA * s.win('shrink', 'sign'));
        // Reading the sign.
        s.alpha(s.ease('sign', 0.6), () => {
          const pts: [number, string, Color][] = [
            [-2, 'slope −4', 'red'],
            [0, 'slope 0', 'slate'],
            [3, 'slope +6', 'green'],
          ];
          pts.forEach(([x0, lab, k], i) =>
            s.alpha(s.ease('sign', 0.5, 0.4 + i * 1.4), () => {
              const m = 2 * x0;
              fr.fn((x) => f(x0) + m * (x - x0), s.c(k), 0.7, x0 - 1, x0 + 1);
              fr.dot(x0, f(x0), 1.2, s.c(k));
              const side = x0 < 0 ? -1 : x0 > 0 ? 1 : 0;
              s.text(lab, fr.X(x0) + side * u * 3, fr.Y(f(x0)) + u * (side ? 3.5 : 4.5), { size: 3.8, font: 'mono', weight: 600, color: s.c(k), align: side < 0 ? 'right' : side > 0 ? 'left' : 'center', halo: true });
            }),
          );
        });
      });
    }
    // Phase 2: one slope per weight.
    const bA = s.win('many', 'uphill');
    if (bA > 0) {
      const g = gridPair(s, h * 0.55);
      const filled = s.since('every') >= 0 ? 1 + Math.floor(clamp01(s.prog('every') * 1.15) * 5.999) : s.since('partial') >= 0 && s.ease('partial', 0.5, 3) > 0.5 ? 1 : 0;
      const cur = s.since('every') >= 0 ? Math.min(5, filled - 1) : s.since('partial') >= 0 ? 0 : -1;
      const jig = cur >= 0 ? 0.5 + 0.5 * Math.sin(s.t * 7) : 0;
      s.alpha(bA, () => {
        s.text('W', g.x1 + g.cw, g.y - u * 4, { size: 5, italic: true, weight: 600, color: s.c('blue') });
        s.text('∇L', g.x2 + g.cw, g.y - u * 4, { size: 5, italic: true, weight: 600, color: s.c('teal') });
        for (let i = 0; i < 6; i++) {
          const still = cur >= 0 && i !== cur;
          s.alpha(still ? 0.35 : 1, () => {
            const r = Math.floor(i / 2);
            const c = i % 2;
            s.cell(g.x1 + c * g.cw, g.y + r * g.ch, g.cw - u * 0.6, g.ch - u * 0.6, f2(GRAD.W[i]!), 'blue', { on: i === cur ? 1 : 0, size: 3.4 });
          });
        }
        grid32(s, g.x2, g.y, g.cw, g.ch, GRAD.ana.map((v, i) => (i < filled ? f2(v) : '')), 'teal', (i) => (i === cur ? 1 : i < filled ? 0.35 : 0), 3.4);
        if (cur >= 0) {
          const cx = g.x1 + (cur % 2) * g.cw + (g.cw - u * 0.6) / 2;
          const cy = g.y + Math.floor(cur / 2) * g.ch + (g.ch - u * 0.6) / 2;
          s.rrect(cx - g.cw / 2 - u * 0.4 - jig * u * 0.6, cy - g.ch / 2 - u * 0.4 - jig * u * 0.6, g.cw + u * 0.2 + jig * u * 1.2, g.ch + u * 0.2 + jig * u * 1.2, 1.6, { stroke: s.c('purple'), lw: 0.5 });
        }
        const note = s.since('partial') >= 0 ? 'nudge one, hold the rest still' : '6 weights here, 30,730 for CIFAR-10';
        s.text(note, w / 2, g.y + 3 * g.ch + u * 5, { size: fit(s, note, w * 0.9, 3.6, 'mono', 500), font: 'mono', color: s.c('--ink-3') });
        s.alpha(s.ease('every', 0.6, 0.4), () => s.text('same shape as W', g.x2 + g.cw, g.y + 3 * g.ch + u * 11, { size: 3.6, italic: true, color: s.c('teal') }));
      });
      s.show('partial', bA * s.win('partial', 'every'));
      s.show('grad', bA * s.ease('every', 0.6));
    }
    // Phase 3: the gradient on the map.
    const cA = s.ease('uphill', 0.6);
    if (cA > 0) {
      const fr = mapFrame(s);
      const [ga, gb] = GRAD.slice;
      const L = Math.hypot(ga, gb);
      s.alpha(cA, () => {
        RACE_HEAT.draw(fr);
        fr.dot(START[0], START[1], 1.5, s.c('orange'));
        s.alpha(s.ease('uphill', 0.6, 0.6), () => {
          fr.arrow(START[0], START[1], START[0] + (1.3 * ga) / L, START[1] + (1.3 * gb) / L, s.c('teal'), 0.9);
          s.text('∇L: steepest way up', fr.X(START[0]) + u * 3, fr.Y(START[1]) - u * 2.5, { size: 3.6, italic: true, color: s.c('teal'), align: 'left', halo: true });
        });
        s.alpha(s.ease('down', 0.6), () => {
          fr.arrow(START[0], START[1], START[0] - (2 * ga) / L, START[1] - (2 * gb) / L, s.c('--accent'), 1);
          s.text('−∇L: steepest way down', fr.X(START[0] - (2 * ga) / L) - u * 3, fr.Y(START[1] - (2 * gb) / L) + u * 4.5, { size: 3.6, italic: true, color: s.c('--accent'), align: 'left', halo: true });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- 6. the numerical gradient

const numerical: SceneDef = {
  marks: {
    ctr: { tex: String.raw`\frac{\symL(\symW + \symh\,e_k) - \symL(\symW - \symh\,e_k)}{2\symh}`, x: 0.5, y: 0.17, size: 5.4 },
  },
  draw(s) {
    const { w, h, u } = s;
    const aA = s.win('recipe', 'centered');
    if (aA > 0) {
      const g = gridPair(s, h * (s.tall ? 0.36 : 0.34));
      let cur = -1;
      let filled = 0;
      let sub = 0;
      if (s.since('loop') >= 0) cur = 0;
      if (s.since('nudge') >= 0) sub = s.prog('nudge') < 0.5 ? 1 : 2;
      if (s.since('back') >= 0) sub = 3;
      if (s.since('div') >= 0) {
        sub = 4;
        filled = s.ease('div', 0.4, 1.4) > 0.5 ? 1 : 0;
      }
      if (s.since('fill') >= 0) {
        const p = clamp01(s.prog('fill') * 1.15) * 5;
        cur = Math.min(5, 1 + Math.floor(p));
        filled = Math.min(6, 1 + Math.floor(p + 0.6));
        sub = 4;
      }
      s.slot('idx', cur < 0 ? '(0, 0)' : `(${Math.floor(cur / 2)}, ${cur % 2})`);
      s.alpha(aA, () => {
        s.text('W', g.x1 + g.cw, g.y - u * 4, { size: 5, italic: true, weight: 600, color: s.c('blue') });
        s.text('grad', g.x2 + g.cw, g.y - u * 4, { size: 4.4, font: 'mono', weight: 600, color: s.c('teal') });
        const wv = GRAD.W.map((v, i) => (i === cur && (sub === 1 || sub === 2) ? `${v.toFixed(2)}${sub === 1 ? '+h' : '−h'}` : f2(v)));
        grid32(s, g.x1, g.y, g.cw, g.ch, wv, 'blue', (i) => (i === cur ? 1 : 0), 3.2);
        grid32(s, g.x2, g.y, g.cw, g.ch, GRAD.ana.map((v, i) => (i < filled ? f2(v) : '')), 'teal', (i) => (i === cur && sub === 4 ? 1 : i < filled ? 0.35 : 0), 3.2);
        // The readout for the current weight.
        if (cur >= 0) {
          const k = cur;
          const lines: [string, string, number][] = [
            [`L(W + h) = ${GRAD.up[k]!.toFixed(7)}`, 'red', sub >= 1 ? 1 : 0],
            [`L(W − h) = ${GRAD.dn[k]!.toFixed(7)}`, 'red', sub >= 2 ? 1 : 0],
            [`slope = difference / 2h = ${GRAD.num[k]!.toFixed(4)}`, 'teal', sub >= 4 ? 1 : 0],
          ];
          const y0 = g.y + 3 * g.ch + u * 8;
          lines.forEach(([t, k2, on], i) =>
            s.alpha(on, () => s.text(t, w / 2, y0 + i * u * 6.5, { size: fit(s, t, w * 0.9, 3.8, 'mono', 500), font: 'mono', weight: i === 2 ? 600 : 500, color: s.c(k2 as Color) })),
          );
          if (sub === 3) s.text('W[idx] = old: put it back', w / 2, y0 + u * 6.5 * 2, { size: 3.6, font: 'mono', color: s.c('--ink-2') });
        } else {
          s.text('nudge, re-run the loss, compare', w / 2, g.y + 3 * g.ch + u * 10, { size: 4, italic: true, color: s.c('--ink-2') });
        }
      });
    }
    // Phase 2: one-sided versus centered.
    const bA = s.ease('centered', 0.6);
    if (bA > 0) {
      const fr = new Frame(s, s.tall ? [w * 0.07, h * 0.3, w * 0.86, h * 0.62] : [w * 0.08, h * 0.3, w * 0.84, h * 0.6], [W00 - 1.25, W00 + 1.25, 0.15, 1.6]);
      const H = 0.8;
      const f = (x: number) => softLoss(x);
      const w0 = W00;
      const fw = (f(w0 + H) - f(w0)) / H;
      const ce = (f(w0 + H) - f(w0 - H)) / (2 * H);
      s.show('ctr', bA * (1 - s.ease('lean', 0.5)));
      const lean = s.ease('lean', 0.6);
      const cancel = s.ease('cancel', 0.6, 0.4);
      s.alpha(bA, () => {
        s.line(fr.X(W00 - 1.25), fr.Y(0.15), fr.X(W00 + 1.25), fr.Y(0.15), s.c('--axis'), 0.35);
        fr.fn(f, s.c('red'), 0.8);
        fr.fn((x) => f(w0) + SOFT_ANA * (x - w0), s.c('--ink'), 0.4, w0 - 1.25, w0 + 1.25, [1, 0.9]);
        const tick = (x: number, lab: string, k: string) => {
          s.line(fr.X(x), fr.Y(0.15), fr.X(x), fr.Y(f(x)), s.tint('--ink-3', 0.6), 0.25, [0.6, 0.6]);
          s.text(lab, fr.X(x), fr.Y(0.15) + u * 3, { size: 3.3, font: 'mono', color: k, halo: true });
          fr.dot(x, f(x), 1, k);
        };
        s.alpha(s.ease('centered', 0.5, 0.8), () => {
          fr.fn((x) => f(w0 - H) + ce * (x - (w0 - H)), s.c('teal'), 0.6, w0 - 1.25, w0 + 1.25);
          tick(w0 - H, 'w − h', s.c('purple'));
          tick(w0 + H, 'w + h', s.c('purple'));
        });
        tick(w0, 'w', s.c('orange'));
        s.alpha(lean, () => fr.fn((x) => f(w0) + fw * (x - w0), s.c('orange'), 0.6, w0 - 1.25, w0 + 1.25));
        const rows = [
          { text: cancel > 0.5 ? `true slope   ${SOFT_ANA.toFixed(3)}` : 'true slope (dashed)', dot: s.c('--ink'), mono: cancel > 0.5 },
          { text: cancel > 0.5 ? `centered     ${ce.toFixed(3)}  error ~ h²` : 'centered', dot: s.c('teal'), mono: cancel > 0.5 },
        ];
        if (lean > 0.5) rows.push({ text: cancel > 0.5 ? `one sided    ${fw.toFixed(3)}  error ~ h` : 'one sided', dot: s.c('orange'), mono: cancel > 0.5 });
        const [bx, by] = fr.box;
        card(s, bx + u * 1, by + u * 1, rows, { size: 3.2 });
      });
    }
  },
};

// ---------------------------------------------------------------- 7. how small should h be

const tinyH: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    let lh = 0;
    if (s.since('fall') >= 0) lh = lerp(0, -5, smooth(s.prog('fall') * 1.1));
    if (s.since('rise') >= 0) lh = lerp(-5, -12, smooth(s.prog('rise') * 1.1));
    if (s.since('sweet') >= 0) lh = lerp(-12, -4.9, s.ease('sweet', 1.4));
    const f32 = s.ease('f32', 0.8, 0.6);
    if (f32 > 0) lh = lerp(-4.9, -1.9, f32);
    const reveal = s.since('sweet') >= 0 ? -12 : lh;
    const hv = 10 ** lh;
    s.slot('h', fmt(Number(hv.toPrecision(2)), 2));
    s.slot('dtype', f32 > 0.5 && s.since('slow') < 0 ? 'float32' : 'float64');
    s.slot('err', hRel(hv, f32 > 0.5).toExponential(1));
    const cA = s.win('small', 'slow');
    if (cA > 0) {
      const fr = new Frame(s, s.tall ? [w * 0.15, h * 0.16, w * 0.8, h * 0.68] : [w * 0.1, h * 0.14, w * 0.84, h * 0.7], [-12.3, 0.3, -14.5, 0.8]);
      const [bx, by, bw, bh] = fr.box;
      s.alpha(cA, () => {
        for (const e of [-12, -10, -8, -6, -4, -2, 0]) {
          s.line(fr.X(e), by, fr.X(e), by + bh, s.c('--grid'), 0.25);
          s.text(pow10(e), fr.X(e), by + bh + u * 3.2, { size: 3, font: 'mono', color: s.c('--ink-3') });
        }
        for (const e of [-12, -9, -6, -3, 0]) {
          s.line(bx, fr.Y(e), bx + bw, fr.Y(e), s.c('--grid'), 0.25);
          s.text(pow10(e), bx - u * 1.2, fr.Y(e), { size: 3, font: 'mono', color: s.c('--ink-3'), align: 'right' });
        }
        s.text('h', bx + bw, by + bh + u * 7, { size: 3.6, italic: true, weight: 600, color: s.c('purple'), align: 'right' });
        s.text('relative error', bx, by - u * 2.4, { size: 3.3, font: 'mono', color: s.c('--ink-3'), align: 'left' });
        const series = (ys: number[], k: Color, a: number, dash?: number[]) => {
          const pts: [number, number][] = [];
          HCURVE.lh.forEach((x, i) => x >= reveal - 0.05 && pts.push([x, Math.max(-14.5, ys[i]!)]));
          s.alpha(a, () =>
            fr.clip(() => {
              const c = s.ctx;
              c.setLineDash(dash ? dash.map((d) => d * u) : []);
              fr.poly(pts, s.c(k), 0.6);
              c.setLineDash([]);
            }),
          );
        };
        // A faint preview of the whole sweep, then the solid curve follows h down.
        const ghost = 0.22 * s.ease('small', 0.8, 1) * (1 - s.ease('sweet', 0.5));
        if (ghost > 0) {
          const all = (ys: number[], k: Color) => s.alpha(ghost, () => fr.clip(() => fr.poly(HCURVE.lh.map((x, i) => [x, Math.max(-14.5, ys[i]!)] as [number, number]), s.c(k), 0.5)));
          all(HCURVE.f64, 'orange');
          all(HCURVE.c64, 'teal');
        }
        series(HCURVE.f64, 'orange', 1);
        series(HCURVE.c64, 'teal', 1);
        series(HCURVE.f32, 'orange', 0.75 * f32, [1.2, 0.9]);
        series(HCURVE.c32, 'teal', 0.75 * f32, [1.2, 0.9]);
        const lg = [
          { text: 'one sided', dot: s.c('orange') },
          { text: 'centered', dot: s.c('teal') },
        ];
        if (f32 > 0.5) lg.push({ text: 'dashed: float32', dot: s.c('--ink-3') });
        card(s, bx + u * 1.5, by + bh - u * (f32 > 0.5 ? 16.3 : 11.6), lg, { size: 3.1 });
        s.alpha(s.win('fall', 'rise'), () => {
          const at = (ys: number[]) => ys[HCURVE.lh.findIndex((x) => x >= -1.6)]!;
          s.text('slope 1', fr.X(-1.6) - u * 1.5, fr.Y(at(HCURVE.f64)) - u * 3, { size: 3.2, font: 'mono', color: s.c('orange'), align: 'right', halo: true });
          s.text('slope 2', fr.X(-1.6) + u * 1.5, fr.Y(at(HCURVE.c64)) + u * 3, { size: 3.2, font: 'mono', color: s.c('teal'), align: 'left', halo: true });
        });
        s.alpha(s.ease('rise', 0.6, 2.4) * (1 - f32), () => s.text('rounding noise', fr.X(-10), fr.Y(-1.8), { size: 3.6, italic: true, color: s.c('--ink-2'), halo: true }));
        const best = HCURVE.c64.indexOf(Math.min(...HCURVE.c64));
        s.alpha(s.ease('sweet', 0.6, 1.2) * (1 - f32), () => {
          s.circle(fr.X(HCURVE.lh[best]!), fr.Y(HCURVE.c64[best]!), u * 2.4, { stroke: s.c('teal'), lw: 0.5 });
          s.text('best: h ≈ 1e-5', fr.X(HCURVE.lh[best]!) + u * 3.4, fr.Y(HCURVE.c64[best]!) + u * 1.5, { size: 3.6, font: 'mono', weight: 600, color: s.c('teal'), align: 'left', halo: true });
        });
        s.alpha(f32, () => {
          const b32 = HCURVE.c32.indexOf(Math.min(...HCURVE.c32));
          s.circle(fr.X(HCURVE.lh[b32]!), fr.Y(HCURVE.c32[b32]!), u * 2.4, { stroke: s.c('teal'), lw: 0.5 });
        });
        // The h marker.
        s.line(fr.X(lh), by, fr.X(lh), by + bh, s.c('purple'), 0.4, [1, 0.8]);
        const lab = `h = ${fmt(Number(hv.toPrecision(2)), 2)}`;
        s.text(lab, fr.X(lh) + (lh > -1.5 ? -u : u), by + u * 2.5, { size: 3.4, font: 'mono', weight: 600, color: s.c('purple'), align: lh > -1.5 ? 'right' : 'left', halo: true });
      });
    }
    // Phase 2: the cost.
    const dA = s.ease('slow', 0.6);
    if (dA > 0) {
      s.alpha(dA * (1 - s.ease('cost', 0.5)), () => {
        s.text('approximate', w / 2, h * 0.42, { size: 7, font: 'display', weight: 600, color: s.c('orange') });
        s.alpha(s.ease('slow', 0.5, 2.4), () => s.text('and slow', w / 2, h * 0.58, { size: 7, font: 'display', weight: 600, color: s.c('red') }));
      });
      s.alpha(s.ease('cost', 0.6), () => {
        s.text('2 × 30,730 weights', w / 2, h * 0.24, { size: 4.6, font: 'mono', color: s.c('--ink-2') });
        const n = Math.round(61460 * smooth(s.prog('cost') * 1.2));
        s.text(n.toLocaleString('en-US'), w / 2, h * 0.42, { size: 12, font: 'mono', weight: 650, color: s.c('red') });
        s.text('passes over the training set, for one step', w / 2, h * 0.56, { size: fit(s, 'passes over the training set, for one step', w * 0.9, 4.2, 'serif', 450), italic: true, color: s.c('--ink-2') });
        const bw = w * 0.8;
        s.rrect(w * 0.1, h * 0.64, bw, u * 3, 1.5, { fill: s.tint('red', 0.12) });
        s.rrect(w * 0.1, h * 0.64, bw * (n / 61460), u * 3, 1.5, { fill: s.c('red') });
        s.alpha(s.ease('better', 0.6), () => {
          const t = 'a modern network: millions of weights';
          s.text(t, w / 2, h * 0.8, { size: fit(s, t, w * 0.9, 5, 'display', 600), font: 'display', weight: 600 });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- 8. the analytic gradient

const DOTW = [0.5, -1.2, 0.8];
const DOTX = [2, 3, 1];

const analytic: SceneDef = {
  marks: {
    Li: { tex: String.raw`\symL_i = \sum_{j \ne \symy_i} \max\!\big(0,\ \sym{W}{w_j}^{\top}\symx_i - \sym{W}{w_{\symy_i}}^{\top}\symx_i + 1\big)`, x: 0.5, y: 0.17, size: 4.2 },
    wrong: { tex: String.raw`\nabla_{\sym{W}{w_j}} \symL_i = \mathbf{1}\big(\text{margin}_j > 0\big)\, \symx_i`, x: 0.5, y: 0.42, size: 4.8 },
    right: { tex: String.raw`\nabla_{\sym{W}{w_{\symy_i}}} \symL_i = -\big(\text{number of violators}\big)\, \symx_i`, x: 0.5, y: 0.68, size: 4.8 },
    full: { tex: String.raw`\symdW = \frac{1}{N}\sum_{i} \nabla_{\symW} \symL_i \,+\, 2\lambda \symW`, x: 0.5, y: 0.5, size: 5.6 },
  },
  draw(s) {
    const { w, h, u } = s;
    // Phase 1: numerical versus analytic.
    const aA = s.win('formula', 'one');
    if (aA > 0) {
      s.alpha(aA, () => {
        const boxes: [string, string[], Color][] = [
          ['numerical', ['nudge every weight', '61,460 loss passes a step', 'approximate'], 'orange'],
          ['analytic', ['one formula, from calculus', 'about one loss pass', 'exact'], 'teal'],
        ];
        boxes.forEach(([title, lines, k], i) => {
          const r: Rect = s.tall ? [w * 0.08, h * (0.12 + i * 0.4), w * 0.84, h * 0.35] : [w * (0.05 + i * 0.47), h * 0.2, w * 0.43, h * 0.5];
          const a = s.ease('formula', 0.5, i * 1.2);
          s.alpha(a, () => {
            s.rrect(r[0], r[1], r[2], r[3], 2, { fill: s.tint(k, 0.07), stroke: s.tint(k, 0.6), lw: 0.4 });
            s.text(title, r[0] + r[2] / 2, r[1] + r[3] * 0.2, { size: 5, font: 'display', weight: 600, color: s.c(k) });
            lines.forEach((t, j) => s.text(t, r[0] + r[2] / 2, r[1] + r[3] * (0.44 + j * 0.18), { size: fit(s, t, r[2] * 0.88, 3.8, 'ui', 450), font: 'ui', color: s.c(j === 2 ? k : '--ink-2') }));
          });
        });
        s.alpha(s.ease('catch', 0.6), () => {
          const t = 'but easy to get subtly wrong: check it numerically';
          s.text(t, w / 2, s.tall ? h * 0.94 : h * 0.82, { size: fit(s, t, w * 0.92, 4, 'serif', 450), italic: true, color: s.c('red') });
        });
      });
    }
    // Phase 2: the two facts, one at a time, then multiplied.
    const bA = s.win('one', 'picture');
    if (bA > 0) {
      s.show('Li', bA * s.win('one', 'wrong'));
      const F: Rect = s.tall ? [w * 0.1, h * 0.3, w * 0.8, h * 0.4] : [w * 0.2, h * 0.3, w * 0.6, h * 0.42];
      const chipY = h * (s.tall ? 0.83 : 0.84);
      // The example's three scores: a wrong class costs how far it sits above (correct score − 1).
      s.alpha(bA * s.win('one', 'fact1'), () => {
        const P = toyParts(TOY_STEPS[0]!);
        const fr = new Frame(s, F, [-0.6, 2.6, -2, 1.3]);
        const line = P.s[P.yi]! - 1;
        const cols = CLASS_COLORS.slice(0, 3);
        s.line(fr.X(-0.6), fr.Y(0), fr.X(2.6), fr.Y(0), s.c('--axis'), 0.35);
        P.s.forEach((v, c) => {
          const bw = fr.kx * 0.42;
          s.rrect(fr.X(c) - bw / 2, Math.min(fr.Y(v), fr.Y(0)), bw, Math.abs(fr.Y(v) - fr.Y(0)), 0.6, { fill: s.tint(cols[c]!, 0.55) });
          s.text(c === P.yi ? 'correct' : `class ${c}`, fr.X(c), (v > 0 ? fr.Y(v) : fr.Y(0)) - u * 3, { size: 3.2, font: 'mono', color: s.c(cols[c]!), halo: true });
        });
        s.line(fr.X(-0.6), fr.Y(line), fr.X(2.6), fr.Y(line), s.c('--ink-2'), 0.4, [1.2, 0.9]);
        s.text('correct score − 1', fr.X(2.6), fr.Y(line) + u * 3.2, { size: 3.2, italic: true, color: s.c('--ink-2'), align: 'right' });
        s.alpha(s.ease('one', 0.6, 3), () =>
          P.viol.forEach((c) => {
            const x = fr.X(c) + fr.kx * 0.3;
            s.line(x, fr.Y(line), x, fr.Y(P.s[c]!), s.c('red'), 0.6);
            s.text(fmt(P.m[c]!, 3), x + u * 1.2, fr.Y((line + P.s[c]!) / 2), { size: 3.4, font: 'mono', weight: 600, color: s.c('red'), align: 'left', halo: true });
          }),
        );
      });
      s.alpha(bA * s.win('fact1', 'fact2'), () => {
        const fr = new Frame(s, F, [-2, 2, -0.5, 2.3]);
        s.line(fr.X(-2), fr.Y(0), fr.X(2), fr.Y(0), s.c('--axis'), 0.35);
        s.line(fr.X(-2), fr.Y(0), fr.X(0), fr.Y(0), s.c('slate'), 0.9);
        s.line(fr.X(0), fr.Y(0), fr.X(2), fr.Y(2), s.c('red'), 0.9);
        s.text('max(0, margin)', fr.X(-1), fr.Y(1.9), { size: 3.6, font: 'mono', color: s.c('--ink-2') });
        s.text('slope 0', fr.X(-1), fr.Y(0) - u * 3, { size: 3.6, font: 'mono', weight: 600, color: s.c('slate') });
        s.text('slope 1', fr.X(1) + u * 2, fr.Y(0.9), { size: 3.6, font: 'mono', weight: 600, color: s.c('red'), align: 'left' });
        s.text('margin', fr.X(2), fr.Y(0) + u * 3, { size: 3.2, font: 'mono', color: s.c('--ink-3'), align: 'right' });
      });
      // A score is a dot product: one more unit of weight adds that input.
      s.alpha(bA * s.win('fact2', 'multiply'), () => {
        const cw = Math.min(u * 13, (F[2] * 0.8) / 3);
        const ch = cw * 0.6;
        const x0 = F[0] + F[2] / 2 - 1.5 * cw;
        const y0 = F[1] + F[3] * 0.08;
        const bump = s.ease('fact2', 0.6, 2.6);
        const wv = DOTW.map((v, i) => v + (i === 1 ? bump : 0));
        const score = wv.reduce((acc, v, i) => acc + v * DOTX[i]!, 0);
        s.text('w_j', x0 - u * 1.5, y0 + ch / 2, { size: 3.8, italic: true, weight: 600, color: s.c('blue'), align: 'right' });
        s.text('x', x0 - u * 1.5, y0 + ch * 1.85, { size: 3.8, italic: true, weight: 600, color: s.c('orange'), align: 'right' });
        wv.forEach((v, i) => s.cell(x0 + i * cw, y0, cw - u * 0.5, ch, fmt(Math.round(v * 10) / 10), 'blue', { on: i === 1 ? bump : 0, size: 3.4 }));
        DOTX.forEach((v, i) => s.cell(x0 + i * cw, y0 + ch * 1.35, cw - u * 0.5, ch, String(v), 'orange', { on: i === 1 ? bump : 0, size: 3.4 }));
        s.text(`score = w_j · x = ${fmt(Math.round(score * 10) / 10)}`, F[0] + F[2] / 2, y0 + ch * 3.2, { size: 4, font: 'mono', weight: 600, color: s.c('purple') });
        s.alpha(bump, () => s.text('one more unit of weight: +3 score', F[0] + F[2] / 2, y0 + ch * 3.2 + u * 6, { size: fit(s, 'one more unit of weight: +3 score', F[2], 3.5, 'mono', 500), font: 'mono', color: s.c('--ink-2') }));
      });
      // The two slopes, carried along as chips, then multiplied.
      s.alpha(bA * s.win('fact2', 'wrong'), () => {
        const t1 = 'hinge slope: 0 or 1';
        const t2 = 'score slope: x';
        const mul = s.ease('multiply', 0.8);
        s.text(t1, lerp(w * 0.28, w * 0.5, mul), lerp(chipY, h * 0.42, mul), { size: fit(s, t1, w * 0.44, 3.6, 'mono', 600), font: 'mono', weight: 600, color: s.c('red') });
        s.alpha(s.ease('fact2', 0.6, 5) + mul, () => s.text(t2, lerp(w * 0.74, w * 0.5, mul), lerp(chipY, h * 0.52, mul), { size: fit(s, t2, w * 0.4, 3.6, 'mono', 600), font: 'mono', weight: 600, color: s.c('orange') }));
        s.alpha(s.ease('multiply', 0.6, 1), () => {
          s.text('×', w / 2, h * 0.47, { size: 4.4, color: s.c('--ink-3') });
          const t = '= 1(margin > 0) · x';
          s.text(t, w / 2, h * 0.64, { size: fit(s, t, w * 0.9, 5.4, 'mono', 600), font: 'mono', weight: 600, color: s.c('teal') });
        });
      });
      const rA = s.ease('wrong', 0.6);
      if (rA > 0) {
        s.show('wrong', bA * rA, { y: s.tall ? 0.3 : 0.32 });
        const t1 = 'wrong class j, if it violates: its row gets +x';
        s.alpha(bA * rA, () => s.text(t1, w / 2, h * (s.tall ? 0.42 : 0.45), { size: fit(s, t1, w * 0.9, 3.8, 'serif', 450), italic: true, color: s.c('--ink-2') }));
        const qA = s.ease('right', 0.6);
        s.show('right', bA * qA, { y: s.tall ? 0.62 : 0.64 });
        const t2 = 'correct class: −x, once per violator';
        s.alpha(bA * qA, () => s.text(t2, w / 2, h * (s.tall ? 0.74 : 0.77), { size: fit(s, t2, w * 0.9, 3.8, 'serif', 450), italic: true, color: s.c('--ink-2') }));
      }
    }
    // Phase 3: what one example's gradient does.
    const cA = s.ease('picture', 0.6);
    if (cA > 0) {
      const sp = s.since('step') >= 0 ? clamp01(s.prog('step') * 1.15) * 3 : 0;
      const k0 = Math.min(2, Math.floor(sp));
      const fk = smooth(Math.min(1, (sp - k0) * 1.6));
      const W = TOY_STEPS[k0]!.map((v, j) => lerp(v, TOY_STEPS[Math.min(3, k0 + 1)]![j]!, sp >= 3 ? 1 : fk));
      const done = Math.min(3, Math.floor(sp + 0.45));
      const P = toyParts(TOY_STEPS[done]!);
      s.slot('i', TOY_SEL);
      s.slot('yc', `${P.yi} (${['blue', 'orange', 'green'][P.yi]})`);
      s.slot('s0', fmt(P.s[0]!, 2));
      s.slot('s1', fmt(P.s[1]!, 2));
      s.slot('s2', fmt(P.s[2]!, 2));
      ['m0', 'm1', 'm2'].forEach((n, j) => s.slot(n, j === P.yi ? '1' : fmt(P.m[j]!, 2)));
      const fr = s.tall ? new Frame(s, [w * 0.04, h * 0.11, w * 0.92, h * 0.86], [-1.75, 1.75, -1.75, 1.75], true) : new Frame(s, [w * 0.04, h * 0.08, w * 0.6, h * 0.88], [-1.75, 1.75, -1.75, 1.75], true);
      const live = toyParts(W);
      const cols = CLASS_COLORS.slice(0, 3);
      const fullA = s.ease('full', 0.6);
      s.alpha(cA * (1 - 0.82 * fullA), () => {
        fr.clip(() => {
          const n = 36;
          const [bx, by, bw, bh] = fr.box;
          for (let a = 0; a < n; a++)
            for (let b = 0; b < n; b++) {
              const xa = -1.75 + (3.5 * (a + 0.5)) / n;
              const xb = 1.75 - (3.5 * (b + 0.5)) / n;
              let best = 0;
              let bs = -Infinity;
              for (let c = 0; c < 3; c++) {
                const v = W[2 * c]! * xa + W[2 * c + 1]! * xb;
                if (v > bs) {
                  bs = v;
                  best = c;
                }
              }
              s.ctx.fillStyle = s.tint(cols[best]!, 0.11);
              s.ctx.fillRect(bx + (a * bw) / n, by + (b * bh) / n, bw / n + 0.5, bh / n + 0.5);
            }
        });
        s.rrect(...fr.box, 0.8, { stroke: s.c('--rule'), lw: 0.3 });
        for (let i = 0; i < TOY.n; i++) {
          if (i === TOY_SEL) continue;
          fr.dot(TOY.X[2 * i]!, TOY.X[2 * i + 1]!, 0.9, s.c(cols[TOY.y[i]!]!));
        }
        s.line(fr.X(0), fr.Y(0), fr.X(live.x0), fr.Y(live.x1), s.c('--ink-2'), 0.4, [1, 0.8]);
        s.circle(fr.X(live.x0), fr.Y(live.x1), u * 1.6, { fill: s.c(cols[live.yi]!), stroke: s.c('--ink'), lw: 0.5 });
        s.text('x', fr.X(live.x0) + u * 2.6, fr.Y(live.x1) + u * 2.6, { size: 4.4, italic: true, weight: 650, color: s.c('orange'), align: 'left', halo: true });
        for (let c = 0; c < 3; c++) {
          fr.arrow(0, 0, W[2 * c]!, W[2 * c + 1]!, s.c(cols[c]!), 0.9);
          s.text(`w${'₀₁₂'[c]}`, fr.X(W[2 * c]! * 1.16), fr.Y(W[2 * c + 1]! * 1.16), { size: 4, italic: true, weight: 650, color: s.c(cols[c]!), halo: true });
        }
        const showSteps = s.since('step') < 0 || sp < 3;
        s.alpha(s.ease('push', 0.6) * (showSteps ? 1 : 0), () => {
          for (const j of live.viol) fr.arrow(W[2 * j]!, W[2 * j + 1]!, W[2 * j]! - TOY_LR * live.x0, W[2 * j + 1]! - TOY_LR * live.x1, s.c('teal'), 0.7, 2);
        });
        s.alpha(s.ease('pull', 0.6) * (showSteps ? 1 : 0), () => {
          const yi = live.yi;
          const n = live.viol.length;
          fr.arrow(W[2 * yi]!, W[2 * yi + 1]!, W[2 * yi]! + TOY_LR * n * live.x0, W[2 * yi + 1]! + TOY_LR * n * live.x1, s.c('teal'), 0.7, 2);
        });
        const loss = live.m.reduce((a, v, j) => a + (j === live.yi ? 0 : Math.max(0, v)), 0);
        const rows = [
          { text: `violators: ${live.viol.length}`, mono: true },
          { text: `loss: ${loss.toFixed(2)}`, mono: true, col: s.c('red') },
        ];
        if (s.tall) card(s, fr.box[0] + u * 1.5, fr.box[1] + fr.box[3] - u * 12.5, rows, { size: 3.1 });
        else card(s, fr.box[0] + fr.box[2] + u * 4, h * 0.3, rows, { size: 3.4 });
      });
      s.show('full', cA * fullA);
    }
  },
};


// ---------------------------------------------------------------- 9. the gradient check

const check9: SceneDef = {
  marks: {
    rel: { tex: String.raw`\frac{\big|\,f'_a - f'_n\,\big|}{\max\!\big(|f'_a|,\ |f'_n|\big)}`, x: 0.5, y: 0.53, size: 4.2 },
  },
  draw(s) {
    const { w, h, u } = s;
    // Phase 1: analytic and numerical, side by side.
    const aA = s.win('both', 'why');
    if (aA > 0) {
      const cw = Math.min(u * 17, w * 0.2);
      const ch = cw * 0.5;
      const gap = Math.max(u * 8, w * 0.06);
      const x1 = w / 2 - gap / 2 - 2 * cw;
      const x2 = w / 2 + gap / 2;
      const y = h * 0.22;
      const f6 = (v: number) => (v >= 0 ? ' ' : '') + v.toFixed(6);
      s.alpha(aA, () => {
        s.text('analytic', x1 + cw, y - u * 3.5, { size: 3.8, font: 'mono', weight: 600, color: s.c('teal') });
        s.text('numerical', x2 + cw, y - u * 3.5, { size: 3.8, font: 'mono', weight: 600, color: s.c('teal') });
        grid32(s, x1, y, cw, ch, GRAD.ana.map(f6), 'teal', () => 0.2, 2.8);
        s.alpha(s.ease('both', 0.6, 1.2), () => grid32(s, x2, y, cw, ch, GRAD.num.map(f6), 'teal', () => 0.2, 2.8));
        const rA = s.ease('rel', 0.6, 1.2);
        s.show('rel', aA * s.ease('rel', 0.6), { y: s.tall ? 0.53 : 0.52 });
        s.alpha(rA, () => {
          const ry = h * 0.65;
          grid32(s, w / 2 - cw, ry, cw, ch, GRAD.rel.map((v) => v.toExponential(1)), 'green', () => 0.3, 2.8);
        });
      });
    }
    // Phase 2: why divide by the size.
    const bA = s.win('why', 'good');
    if (bA > 0) {
      s.alpha(bA, () => {
        const rows: [string, string, string, Color][] = [
          ['gradients near 0.002', '0.002 vs 0.003', 'relative error 0.33: alarming', 'red'],
          ['gradients near 1,000', '1000.000 vs 1000.001', 'relative error 0.000001: fine', 'green'],
        ];
        rows.forEach(([t, v, r, k], i) => {
          const y = h * (0.24 + i * 0.36);
          s.alpha(s.ease('why', 0.6, i * 3), () => {
            s.text(t, w / 2, y, { size: 4, font: 'display', weight: 600 });
            s.text(v, w / 2, y + u * 6.5, { size: 3.8, font: 'mono', color: s.c('--ink-2') });
            s.text('the same gap: 0.001', w / 2, y + u * 12, { size: 3.3, font: 'mono', color: s.c('--ink-3') });
            s.text(r, w / 2, y + u * 18, { size: fit(s, r, w * 0.9, 3.8, 'mono', 600), font: 'mono', weight: 600, color: s.c(k) });
          });
        });
      });
    }
    // Phase 3: the yardstick.
    const cA = s.win('good', 'table');
    if (cA > 0) {
      const x0 = w * 0.08;
      const x1 = w * 0.92;
      const X = (e: number) => x0 + ((e + 12) / 12.5) * (x1 - x0);
      const y = h * 0.5;
      const zones: [number, number, Color, string][] = [
        [-12, -7, 'green', 'correct'],
        [-7, -2, 'gold', 'look closer'],
        [-2, 0.5, 'red', 'bug'],
      ];
      s.alpha(cA, () => {
        zones.forEach(([a, b, k, t]) => {
          s.rrect(X(a), y - u * 3, X(b) - X(a), u * 6, 0.6, { fill: s.tint(k, 0.3) });
          s.text(t, (X(a) + X(b)) / 2, y + u * 0.2, { size: fit(s, t, X(b) - X(a) - u, 3.4, 'ui', 600), font: 'ui', weight: 600, color: s.c(k) });
        });
        for (const e of [-12, -9, -7, -4, -2]) s.text(pow10(e), X(e), y - u * 6, { size: 3, font: 'mono', color: s.c('--ink-3') });
        s.text('relative error', w / 2, h * 0.24, { size: 4.4, font: 'display', weight: 600 });
        const pin = (e: number, label: string, k: Color, a: number, dy: number) =>
          s.alpha(a, () => {
            const px = X(e);
            const below = dy > 0;
            const ty = y + u * dy;
            s.line(px, y + (below ? u * 3 : -u * 3), px, ty + (below ? -u * 2.5 : u * 2.5), s.c(k), 0.45);
            s.circle(px, y + (below ? u * 3 : -u * 3), u * 1.2, { fill: s.c(k), stroke: s.c('--card'), lw: 0.4 });
            const al = px < w * 0.3 ? 'left' : px > w * 0.7 ? 'right' : 'center';
            s.text(label, px + (al === 'left' ? -u * 2 : al === 'right' ? u * 2 : 0), ty, { size: fit(s, label, w * 0.6, 3.5, 'mono', 600), font: 'mono', weight: 600, color: s.c(k), align: al, halo: true });
          });
        pin(Math.log10(GRAD.maxRel), `our SVM check: ${GRAD.maxRel.toExponential(1)}`, 'green', s.ease('good', 0.6, 0.6), 13);
        pin(Math.log10(2), 'a flipped sign: 2', 'red', s.ease('bad', 0.6, 1), -13);
        pin(-4, 'a nudge across a crease', 'gold', s.ease('crease', 0.6, 0.8), 23);
      });
      s.slot('rel', s.since('crease') >= 0 ? '1e-4 (crease)' : s.since('bad') >= 0 ? '2.0 (sign bug)' : GRAD.maxRel.toExponential(1));
    } else s.slot('rel', GRAD.maxRel.toExponential(1));
    // Phase 4: the comparison.
    const dA = s.ease('table', 0.6);
    if (dA > 0) {
      const rows: [string, string, string][] = [
        ['', 'numerical', 'analytic'],
        ['speed', 'slow', 'fast'],
        ['accuracy', 'approximate', 'exact'],
        ['getting it right', 'hard to get wrong', 'easy to get wrong'],
        ['use it for', 'checking', 'training'],
      ];
      const cx = [w * 0.05, w * (s.tall ? 0.36 : 0.38), w * (s.tall ? 0.69 : 0.7)];
      const y0 = h * 0.22;
      const rh = h * 0.13;
      s.alpha(dA, () => {
        rows.forEach((r, i) => {
          const y = y0 + i * rh;
          const last = i === rows.length - 1;
          if (last) s.alpha(s.ease('use', 0.6), () => s.rrect(w * 0.03, y - rh * 0.42, w * 0.94, rh * 0.84, 1.4, { fill: s.tint('--accent', 0.1) }));
          if (i > 0) s.line(w * 0.04, y - rh / 2, w * 0.96, y - rh / 2, s.c('--rule'), 0.25);
          r.forEach((t, j) => {
            const col = i === 0 ? s.c(j === 1 ? 'orange' : 'teal') : j === 0 ? s.c('--ink-3') : s.c('--ink');
            const size = i === 0 ? 4.4 : 3.6;
            const maxW = j === 0 ? cx[1]! - cx[0]! - u * 2 : w * 0.3;
            s.text(t, cx[j]!, y, { size: fit(s, t, maxW, size, i === 0 ? 'display' : 'ui', 500), font: i === 0 ? 'display' : 'ui', weight: i === 0 || last ? 600 : 450, color: col, align: 'left' });
          });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- 10. gradient descent

const RUNS: [string, number, string, Color][] = [
  ['crawl', 0.005, 'crawling: safe, but tiny steps', 'slate'],
  ['smooth', 0.05, 'smooth: down the wall, then along the floor', 'green'],
  ['zigzag', 0.15, 'zig-zag: overshoots the steep direction', 'gold'],
  ['diverge', 0.21, 'diverging: every bounce bigger than the last', 'red'],
];

function valleyPath(lr: number, n: number): [number, number][] {
  const out: [number, number][] = [[-4.2, 1.6]];
  let a = -4.2;
  let b = 1.6;
  for (let k = 0; k < n; k++) {
    a -= lr * a;
    b -= lr * VALLEY_C * b;
    out.push([a, b]);
  }
  return out;
}

const bowl = (x: number) => 0.22 * x * x + 0.3;

const descent: SceneDef = {
  marks: {
    upd: { tex: String.raw`\symW \;\leftarrow\; \symW - \symeta\,\symdW`, x: 0.5, y: 0.17, size: 6 },
  },
  draw(s) {
    const { w, h, u } = s;
    // Phase 1: a ball on a 1-D bowl.
    const aA = s.win('simple', 'valley');
    if (aA > 0) {
      s.show('upd', aA);
      const fr = new Frame(s, s.tall ? [w * 0.06, h * 0.3, w * 0.88, h * 0.64] : [w * 0.1, h * 0.3, w * 0.8, h * 0.64], [-4.6, 4.6, -1.6, 5]);
      const eta = 1.2;
      const steps: number[] = [-3.6];
      for (let k = 0; k < 7; k++) steps.push(steps[k]! - eta * 0.44 * steps[k]!);
      const ns = s.since('loop') >= 0 && s.since('why') < 0 ? Math.min(7, Math.floor(s.since('loop') / 0.75)) : s.since('why') >= 0 ? 0 : 0;
      s.alpha(aA, () => {
        s.line(fr.X(-4.6), fr.Y(0), fr.X(4.6), fr.Y(0), s.c('--axis'), 0.35);
        fr.fn(bowl, s.c('red'), 0.8);
        s.text('loss', fr.X(-4.4), fr.Y(4.7), { size: 3.4, font: 'mono', color: s.c('red'), align: 'left' });
        s.text('W', fr.X(4.5), fr.Y(0) + u * 3.2, { size: 3.8, italic: true, weight: 600, color: s.c('blue'), align: 'right' });
        for (let k = 0; k < ns; k++) {
          fr.dot(steps[k]!, bowl(steps[k]!), 0.8, s.tint('orange', 0.5), false);
          s.arrow(fr.X(steps[k]!), fr.Y(bowl(steps[k]!)) - u * 2.5, fr.X(steps[k + 1]!), fr.Y(bowl(steps[k + 1]!)) - u * 2.5, s.tint('--accent', 0.8), 0.4, 1.8);
        }
        const bx = steps[ns]!;
        // Why small: the slope only holds near the ball.
        const tA = s.win('why', 'eta');
        s.alpha(tA, () => {
          const x0 = -3.6;
          const m = 0.44 * x0;
          fr.fn((x) => bowl(x0) + m * (x - x0), s.c('teal'), 0.55, -4.6, 1.2, [1.2, 0.9]);
          const far = -1.2;
          s.alpha(s.ease('why', 0.6, 2.4), () => {
            const ty = bowl(x0) + m * (far - x0);
            s.line(fr.X(far), fr.Y(ty), fr.X(far), fr.Y(bowl(far)), s.c('red'), 0.45, [0.8, 0.7]);
            fr.dot(far, ty, 1.1, s.c('teal'));
            fr.dot(far, bowl(far), 1.1, s.c('red'));
            s.text('the slope says: down here', fr.X(far) + u * 2, fr.Y(ty), { size: 3.4, italic: true, color: s.c('teal'), align: 'left', halo: true });
            s.text('the ground', fr.X(far) + u * 2, fr.Y(bowl(far)) - u * 3.5, { size: 3.4, italic: true, color: s.c('red'), align: 'left', halo: true });
          });
        });
        // The step size.
        s.alpha(s.ease('eta', 0.6), () => {
          const x0 = -3.6;
          const step = 1.2 * 0.44 * 3.6;
          s.arrow(fr.X(x0), fr.Y(-0.8), fr.X(x0 + step), fr.Y(-0.8), s.c('slate'), 0.7, 2.4);
          s.text('step = η × slope', fr.X(x0 + step / 2), fr.Y(-0.8) + u * 3.6, { size: 3.6, font: 'mono', weight: 600, color: s.c('slate'), halo: true });
        });
        fr.dot(s.since('why') >= 0 ? -3.6 : bx, bowl(s.since('why') >= 0 ? -3.6 : bx), 1.6, s.c('orange'));
      });
    }
    // Phase 2: a narrow valley and four step sizes.
    const bA = s.ease('valley', 0.6);
    if (bA <= 0) return;
    const fr = new Frame(s, s.tall ? [w * 0.04, h * 0.12, w * 0.92, h * 0.5] : [w * 0.05, h * 0.1, w * 0.9, h * 0.56], [-5, 5, -2.6, 2.6], true);
    let run = -1;
    RUNS.forEach(([id], i) => s.since(id) >= 0 && (run = i));
    const until = s.since('thresh') >= 0 ? 'thresh' : null;
    const lr = run >= 0 ? RUNS[run]![1] : 0.05;
    const n = run < 0 ? 0 : until ? 60 : Math.round(60 * clamp01(s.prog(RUNS[run]![0]) * 1.25));
    s.slot('lr', lr);
    s.slot('it', n);
    const [bx, by, bw, bh] = fr.box;
    s.alpha(bA, () => {
      VALLEY_HEAT.draw(fr);
      fr.dot(0, 0, 0.8, s.c('--ink'), false);
      s.alpha(s.win('valley', 'crawl'), () => {
        s.arrow(fr.X(2.6), fr.Y(-2.2), fr.X(2.6), fr.Y(2.2), s.c('--ink-2'), 0.45, 2.2);
        s.text('steep across', fr.X(2.6) + u * 1.6, fr.Y(1.4), { size: 3.4, italic: true, color: s.c('--ink-2'), align: 'left', halo: true });
        s.arrow(fr.X(-3.2), fr.Y(-1.9), fr.X(1.8), fr.Y(-1.9), s.c('--ink-2'), 0.45, 2.2);
        s.text('nearly flat along', fr.X(-0.7), fr.Y(-1.9) - u * 2.6, { size: 3.4, italic: true, color: s.c('--ink-2'), halo: true });
      });
      if (run >= 0) {
        const k = RUNS[run]![3];
        s.alpha(1 - 0.65 * s.ease('thresh', 0.6), () => fr.clip(() => {
          const pts = valleyPath(lr, n);
          fr.poly(pts, s.c('teal'), 0.5);
          pts.forEach(([a, b]) => fr.dot(a, b, 0.5, s.c('teal'), false));
          const [a, b] = pts[pts.length - 1]!;
          fr.dot(a, b, 1.3, s.c('teal'));
        }));
        s.text(`η = ${lr}`, bx + u * 2, by + u * 3.2, { size: 3.6, font: 'mono', weight: 600, color: s.c('slate'), align: 'left', halo: true });
        const t = RUNS[run]![2];
        const [ea, eb] = valleyPath(lr, n)[n]!;
        const lv = 0.5 * (ea * ea + VALLEY_C * eb * eb);
        s.alpha(1 - s.ease('thresh', 0.5), () => {
          s.text(t, w / 2, by + bh + u * 6, { size: fit(s, t, w * 0.92, 3.9, 'serif', 450), italic: true, color: s.c(k) });
          s.text(`step ${n} of 60:  loss ${lv > 1e4 ? lv.toExponential(1).replace('e+', 'e') : lv.toFixed(3)}`, w / 2, by + bh + u * 13, { size: 3.6, font: 'mono', weight: 600, color: s.c('red') });
        });
      }
      fr.dot(-4.2, 1.6, 1.1, s.c('--ink'), false);
      // The step-size number line.
      const tA = s.ease('thresh', 0.6);
      if (tA > 0) {
        const lx0 = w * 0.1;
        const lx1 = w * 0.9;
        const X = (v: number) => lx0 + (v / 0.25) * (lx1 - lx0);
        const ly = by + bh + (h - (by + bh)) * 0.42;
        s.alpha(tA, () => {
          const zones: [number, number, Color, string][] = [
            [0, 0.1, 'green', 'smooth'],
            [0.1, 0.2, 'gold', 'zig-zag'],
            [0.2, 0.25, 'red', 'diverge'],
          ];
          zones.forEach(([a, b, k, t]) => {
            s.rrect(X(a), ly - u * 1.6, X(b) - X(a), u * 3.2, 0.5, { fill: s.tint(k, 0.35) });
            s.text(t, (X(a) + X(b)) / 2, ly + u * 5, { size: 3.3, font: 'ui', weight: 500, color: s.c(k) });
          });
          [
            [0.1, '1/c'],
            [0.2, '2/c'],
          ].forEach(([v, t]) => s.text(`${t} = ${v}`, X(v as number), ly - u * 4.5, { size: 3.1, font: 'mono', color: s.c('--ink-2') }));
          s.text('η', X(0) - u * 2.5, ly, { size: 4, italic: true, weight: 600, color: s.c('slate'), align: 'right' });
          RUNS.forEach(([, v]) => s.circle(X(v), ly, u * 0.9, { fill: s.c('teal'), stroke: s.c('--card'), lw: 0.3 }));
        });
      }
      s.alpha(s.ease('tune', 0.6), () => {
        s.rrect(bx + bw * 0.12, by + bh * 0.32, bw * 0.76, bh * 0.36, 2, { fill: s.tint('--card', 0.94), stroke: s.c('--rule'), lw: 0.3 });
        const t = 'no formula: find η by experiment';
        s.text(t, bx + bw / 2, by + bh / 2, { size: fit(s, t, bw * 0.7, 4.6, 'display', 600), font: 'display', weight: 600, color: s.c('slate') });
      });
    });
  },
};

// ---------------------------------------------------------------- 11. mini-batches

const IMG = (() => {
  const r = new Rng(17);
  return Array.from({ length: 600 }, () => [r.int(8), r.uniform(0.25, 0.75)] as [number, number]);
})();
const PAL: Color[] = ['blue', 'orange', 'green', 'purple', 'red', 'teal', 'gold', 'slate'];

/** A field of tiny "images": `on(i)` sets each one's emphasis, `ring(i)` outlines it. */
function dataset(s: Scene, rect: Rect, on: (i: number) => number, tone: (i: number) => [number, number], ring: (i: number) => boolean = () => false): { cs: number; cols: number; rows: number; ox: number; oy: number } {
  const cols = s.tall ? 24 : 36;
  const rows = s.tall ? 14 : 14;
  const cs = Math.min(rect[2] / cols, rect[3] / rows);
  const ox = rect[0] + (rect[2] - cs * cols) / 2;
  const oy = rect[1] + (rect[3] - cs * rows) / 2;
  for (let i = 0; i < cols * rows; i++) {
    const [k, v] = tone(i);
    const e = on(i);
    const x = ox + (i % cols) * cs;
    const y = oy + Math.floor(i / cols) * cs;
    s.ctx.fillStyle = s.tint(PAL[k]!, v * (0.25 + 0.75 * e));
    s.ctx.fillRect(x + cs * 0.08, y + cs * 0.08, cs * 0.84, cs * 0.84);
    if (ring(i)) s.rrect(x - cs * 0.05, y - cs * 0.05, cs * 1.1, cs * 1.1, 0.3, { stroke: s.c('green'), lw: 0.5 });
  }
  return { cs, cols, rows, ox, oy };
}

const minibatch: SceneDef = {
  marks: {
    mb: { tex: String.raw`\symdW \;\approx\; \frac{1}{\symB} \sum_{i \in \mathcal{B}} \nabla_{\symW} \symL_i`, x: 0.5, y: 0.88, size: 4.4 },
  },
  draw(s) {
    const { w, h, u } = s;
    const drect: Rect = s.tall ? [w * 0.06, h * 0.2, w * 0.88, h * 0.54] : [w * 0.08, h * 0.2, w * 0.84, h * 0.54];
    // Phase 1: a full pass versus a sample.
    const aA = s.win('avg', 'poll');
    if (aA > 0) {
      const N = (s.tall ? 24 : 36) * 14;
      const scan = (s.t * 0.45) % 1;
      const bt = s.since('code') >= 0 ? Math.floor(s.since('code') / 0.8) : 0;
      const pick = new Set<number>();
      const r = new Rng(31 + bt);
      while (pick.size < 16) pick.add(r.int(N));
      const bOn = s.ease('batch', 0.6, 0.4);
      s.alpha(aA, () => {
        // Before the batch: a sweep over every example. After: only the batch lights up.
        dataset(
          s,
          drect,
          (i) => lerp(Math.abs(i / N - scan) < 0.06 ? 1 : 0.45, pick.has(i) ? 1 : 0.2, bOn),
          (i) => IMG[i % IMG.length]!,
          (i) => bOn > 0.5 && pick.has(i),
        );
        const top = s.since('imagenet') >= 0 ? '1.2 million training images' : 'every example, every step';
        s.text(top, w / 2, h * 0.14, { size: fit(s, top, w * 0.9, 4.4, 'display', 600), font: 'display', weight: 600 });
        s.alpha(s.win('batch', 'code'), () => {
          const t = 'a mini-batch: 256 of the 1.2 million';
          s.text(t, w / 2, h * 0.82, { size: fit(s, t, w * 0.9, 4, 'serif', 450), italic: true, color: s.c('green') });
        });
        s.show('mb', aA * s.ease('code', 0.6));
      });
    }
    // Phase 2: estimates scatter around the truth.
    const bA = s.win('poll', 'race');
    if (bA > 0) {
      const cx = s.tall ? w * 0.68 : w * 0.6;
      const cy = s.tall ? h * 0.8 : h * 0.78;
      const k = (Math.min(w, h) * 0.42) / Math.hypot(...POLL.full);
      const shown = Math.min(POLL.est.length, Math.floor(s.since('poll') / 0.3));
      s.alpha(bA, () => {
        s.alpha(1 - s.ease('trade', 0.6), () => {
          for (let i = 0; i < shown; i++) {
            const [ga, gb] = POLL.est[i]!;
            s.arrow(cx, cy, cx + ga * k, cy - gb * k, s.tint('orange', 0.55), 0.35, 2);
          }
          const [ga, gb] = POLL.full;
          s.arrow(cx, cy, cx + ga * k, cy - gb * k, s.c('teal'), 0.9, 3);
          s.circle(cx, cy, u * 1.2, { fill: s.c('--ink') });
          card(s, s.tall ? w * 0.06 : w * 0.06, s.tall ? h * 0.14 : h * 0.14, [
            { text: 'full gradient: all 300 points', dot: s.c('teal') },
            { text: 'mini-batch estimates: 16 each', dot: s.c('orange') },
          ], { size: 3.3 });
        });
        s.alpha(s.ease('trade', 0.6), () => {
          s.text('one exact step', w / 2, h * 0.3, { size: 4.6, font: 'display', weight: 600, color: s.c('teal') });
          s.text('1,200,000 examples', w / 2, h * 0.38, { size: 4, font: 'mono', color: s.c('--ink-2') });
          s.text('=', w / 2, h * 0.49, { size: 6, color: s.c('--ink-3') });
          s.text('about 4,700 mini-batch steps', w / 2, h * 0.6, { size: fit(s, 'about 4,700 mini-batch steps', w * 0.9, 4.6, 'display', 600), font: 'display', weight: 600, color: s.c('orange') });
          s.text('of 256 examples each', w / 2, h * 0.68, { size: 4, font: 'mono', color: s.c('--ink-2') });
        });
      });
    }
    // Phase 3: the race on the slice, and the work it took.
    const cA = s.win('race', 'redundant');
    if (cA > 0) {
      const wk = s.ease('work', 0.8);
      const fr = s.tall
        ? new Frame(s, mixRect([w * 0.04, h * 0.11, w * 0.92, h * 0.86], [w * 0.04, h * 0.1, w * 0.92, h * 0.5], wk), DOM, true)
        : new Frame(s, mixRect([w * 0.15, h * 0.08, w * 0.7, h * 0.88], [w * 0.03, h * 0.08, w * 0.52, h * 0.88], wk), DOM, true);
      const it = s.since('work') >= 0 ? 100 : Math.round(100 * clamp01(s.prog('race') * 1.15 + (s.since('race') >= 0 ? 0 : 0)));
      s.slot('nf', (it * 300).toLocaleString('en-US'));
      s.slot('nm', (it * BATCH).toLocaleString('en-US'));
      s.alpha(cA, () => {
        RACE_HEAT.draw(fr);
        fr.clip(() => {
          fr.poly(MINI.full.slice(0, it + 1), s.c('teal'), 0.55);
          fr.poly(MINI.mini.slice(0, it + 1), s.c('orange'), 0.4);
        });
        s.circle(fr.X(START[0]), fr.Y(START[1]), u * 1.7, { stroke: s.c('--ink'), lw: 0.4 });
        fr.dot(MINI.full[it]![0], MINI.full[it]![1], 1.2, s.c('teal'));
        fr.dot(MINI.mini[it]![0], MINI.mini[it]![1], 1.2, s.c('orange'));
        // Loss against examples looked at, on a log scale.
        const cr: Rect = s.tall ? [w * 0.14, h * 0.66, w * 0.8, h * 0.24] : [w * 0.63, h * 0.26, w * 0.33, h * 0.46];
        s.alpha(s.ease('work', 0.6), () => {
          const ch = new Frame(s, cr, [0, 4.5, 0.65, 2.35]);
          const [bx, by, bw, bh] = ch.box;
          s.line(bx, by + bh, bx + bw, by + bh, s.c('--axis'), 0.35);
          s.line(bx, by, bx, by + bh, s.c('--axis'), 0.35);
          ['1', '10', '100', '1k', '10k'].forEach((t, e) => s.text(t, ch.X(e), by + bh + u * 3, { size: 2.9, font: 'mono', color: s.c('--ink-3') }));
          s.text('examples looked at', bx + bw, by + bh + u * 7, { size: 3, font: 'mono', color: s.c('--ink-3'), align: 'right' });
          s.text('loss', bx - u * 1, by - u * 2.4, { size: 3, font: 'mono', color: s.c('red'), align: 'left' });
          const p = clamp01(s.prog('work') * 1.3);
          const lim = 4.5 * p;
          const pf: [number, number][] = [];
          const pm: [number, number][] = [];
          for (let k = 1; k <= 100; k++) {
            const xf = Math.log10(k * 300);
            const xm = Math.log10(k * BATCH);
            if (xf <= lim) pf.push([xf, MINI.lf[k]!]);
            if (xm <= lim) pm.push([xm, MINI.lm[k]!]);
          }
          ch.poly(pf, s.c('teal'), 0.55);
          ch.poly(pm, s.c('orange'), 0.55);
        });
        const lg = [
          { text: 'full batch: 300 a step', dot: s.c('teal') },
          { text: 'mini-batch: 4 a step', dot: s.c('orange') },
        ];
        if (s.tall) card(s, fr.box[0] + u * 1.2, fr.box[1] + fr.box[3] - u * 10.5, lg, { size: 2.9 });
        else card(s, fr.box[0] + u * 1.5, fr.box[1] + fr.box[3] - u * 12, lg, { size: 3.3 });
      });
    }
    // Phase 4: redundancy.
    const dA = s.win('redundant', 'pow');
    if (dA > 0) {
      const distinct = 12;
      const hl = s.ease('copies', 0.6, 0.3);
      s.alpha(dA, () => {
        dataset(
          s,
          drect,
          (i) => lerp(0.75, i < distinct ? 1 : 0.3, hl),
          (i) => IMG[i % distinct]!,
          (i) => hl > 0.5 && i < distinct,
        );
        const t = '1.2 million = 1,000 distinct images, copied';
        s.text(t, w / 2, h * 0.14, { size: fit(s, t, w * 0.9, 4.2, 'display', 600), font: 'display', weight: 600 });
        s.alpha(hl, () => {
          const t2 = 'the distinct ones alone give the exact gradient';
          s.text(t2, w / 2, h * 0.84, { size: fit(s, t2, w * 0.9, 4, 'serif', 450), italic: true, color: s.c('green') });
        });
      });
    }
    // Phase 5: conventions.
    const eA = s.ease('pow', 0.6);
    if (eA > 0) {
      s.alpha(eA, () => {
        const sizes = ['32', '64', '128', '256'];
        const cw = Math.min(u * 16, w * 0.18);
        const x0 = w / 2 - (sizes.length * cw + (sizes.length - 1) * u * 3) / 2;
        s.text('batch size B', w / 2, h * 0.2, { size: 4.2, font: 'display', weight: 600, color: s.c('green') });
        sizes.forEach((t, i) => s.alpha(s.ease('pow', 0.4, 0.5 + i * 0.5), () => s.cell(x0 + i * (cw + u * 3), h * 0.28, cw, cw * 0.62, t, 'green', { on: 0.5, size: 4.4 })));
        s.text('powers of two, whatever fits in memory', w / 2, h * 0.28 + cw * 0.62 + u * 6, { size: fit(s, 'powers of two, whatever fits in memory', w * 0.9, 3.6, 'serif', 450), italic: true, color: s.c('--ink-2') });
        s.alpha(s.ease('sgd', 0.6), () => {
          s.cell(w / 2 - cw / 2, h * 0.62, cw, cw * 0.62, '1', 'green', { on: 1, size: 4.4 });
          const t = 'stochastic gradient descent (SGD)';
          s.text(t, w / 2, h * 0.62 + cw * 0.62 + u * 6, { size: fit(s, t, w * 0.9, 4.2, 'display', 600), font: 'display', weight: 600 });
          s.alpha(s.ease('sgd', 0.6, 3.2), () => s.text('in practice, "SGD" means mini-batches too', w / 2, h * 0.62 + cw * 0.62 + u * 13, { size: fit(s, 'in practice, "SGD" means mini-batches too', w * 0.9, 3.6, 'serif', 450), italic: true, color: s.c('--ink-2') }));
        });
      });
    }
  },
};

// ---------------------------------------------------------------- 12. the whole pipeline

const TILES: [string, string, Color, string][] = [
  ['score function', 'scores = W x', 'purple', 'score'],
  ['loss function', 'L(W): one number', 'red', 'loss'],
  ['gradient', '∇L: which way is up', 'teal', 'grad'],
  ['update', 'W −= η ∇L', 'slate', 'update'],
];

const summary: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const tA = s.ease('four', 0.6) * (1 - s.ease('recap', 0.6));
    if (tA > 0) {
      const tw = s.tall ? w * 0.4 : w * 0.34;
      const th = s.tall ? h * 0.27 : h * 0.28;
      const gx = s.tall ? w * 0.06 : w * 0.12;
      const gy = h * 0.15;
      const gapX = s.tall ? w * 0.08 : w * 0.08;
      const gapY = s.tall ? h * 0.16 : h * 0.14;
      // Clockwise: score, loss (right), gradient (below loss), update (left).
      const pos = [
        [gx, gy],
        [gx + tw + gapX, gy],
        [gx + tw + gapX, gy + th + gapY],
        [gx, gy + th + gapY],
      ];
      const order = ['score', 'loss', 'grad', 'update'];
      let lit = -1;
      order.forEach((b, i) => s.since(b) >= 0 && (lit = i));
      if (s.since('rest') >= 0) lit = -1;
      s.alpha(tA, () => {
        TILES.forEach(([title, sub, k], i) => {
          const [x, y] = pos[i]!;
          const a = s.ease('four', 0.5, 0.3 + i * 0.35);
          let t2 = sub;
          let t1 = title;
          if (i === 0 && s.since('rest') >= 0) {
            t1 = 'neural network';
            t2 = 'scores = f(x; W)';
          }
          if (i === 2 && s.since('hard') >= 0) t2 = s.since('backprop') >= 0 ? 'backprop: next chapter' : 'by hand: hopeless';
          const on = i === lit ? 1 : (i === 0 && s.since('rest') >= 0 && s.since('hard') < 0) || (i === 2 && s.since('hard') >= 0) ? 1 : 0;
          s.alpha(a, () => {
            s.rrect(x!, y!, tw, th, 2, { fill: s.tint(k, 0.07 + 0.13 * on), stroke: s.tint(k, 0.5 + 0.5 * on), lw: 0.35 + 0.35 * on });
            s.text(t1, x! + tw / 2, y! + th * 0.38, { size: fit(s, t1, tw * 0.86, 4.8), font: 'display', weight: 600, color: s.c(k) });
            const subCol = i === 2 && s.since('hard') >= 0 && s.since('backprop') < 0 ? s.c('red') : s.c('--ink-2');
            s.text(t2, x! + tw / 2, y! + th * 0.68, { size: fit(s, t2, tw * 0.86, 3.6, 'mono', 500), font: 'mono', color: subCol });
          });
        });
        const ar = (x0: number, y0: number, x1: number, y1: number) => s.arrow(x0, y0, x1, y1, s.c('--ink-3'), 0.5, 2.4);
        const [p0, p1, p2, p3] = pos as [number[], number[], number[], number[]];
        s.alpha(s.ease('four', 0.5, 1.6), () => {
          ar(p0[0]! + tw + u, p0[1]! + th / 2, p1[0]! - u, p1[1]! + th / 2);
          ar(p1[0]! + tw / 2, p1[1]! + th + u, p2[0]! + tw / 2, p2[1]! - u);
          ar(p2[0]! - u, p2[1]! + th / 2, p3[0]! + tw + u, p3[1]! + th / 2);
          ar(p3[0]! + tw / 2, p3[1]! - u, p0[0]! + tw / 2, p0[1]! + th + u);
        });
        s.text('repeat', gx + tw + gapX / 2, gy + th + gapY / 2, { size: 3.6, italic: true, color: s.c('--ink-3') });
      });
    }
    // Takeaways.
    const rA = s.win('recap', 'next');
    if (rA > 0) {
      const lines: [string, Color | '--ink'][] = [
        ['training is optimization', '--ink'],
        ['the loss is a landscape', 'red'],
        ['the gradient points uphill', 'teal'],
        ['step against it, one mini-batch at a time', 'slate'],
      ];
      s.alpha(rA, () =>
        lines.forEach(([t, k], i) =>
          s.alpha(s.ease('recap', 0.5, i * 1.6), () => s.text(t, w / 2, h * (0.26 + i * 0.15), { size: fit(s, t, w * 0.9, 5, 'display', 600), font: 'display', weight: 600, color: s.c(k) })),
        ),
      );
    }
    const nA = s.ease('next', 0.7);
    if (nA > 0) {
      s.alpha(nA, () => {
        s.text('next: the interactive chapter', w / 2, h * 0.4, { size: fit(s, 'next: the interactive chapter', w * 0.9, 6.4, 'display', 600), font: 'display', weight: 600 });
        const t = 'slice the landscape, race the searches, push the step size';
        s.text(t, w / 2, h * 0.53, { size: fit(s, t, w * 0.9, 3.8, 'serif', 450), italic: true, color: s.c('--ink-2') });
        s.alpha(s.ease('bye', 0.6), () => s.text('see you there', w / 2, h * 0.68, { size: 4.6, font: 'display', italic: true, color: s.c('--accent') }));
      });
    }
  },
};

export const scenes: Record<string, SceneDef> = {
  intro,
  landscape,
  creases,
  search,
  gradient,
  numerical,
  'tiny-h': tinyH,
  analytic,
  check: check9,
  descent,
  minibatch,
  summary,
};
